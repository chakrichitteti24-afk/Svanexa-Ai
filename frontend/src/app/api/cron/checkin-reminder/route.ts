import { NextResponse } from 'next/server';
import { format } from 'date-fns';
import { sendWebPush } from '@/lib/services/web-push';
import { getCronSupabaseClient, getUserPreferencesMap, buildCheckinMessage, validateCronRequest } from '@/lib/services/cron-utils';

export const dynamic = 'force-dynamic';

function determineAutoSlot(currentHour: number): 'morning' | 'afternoon' | 'evening' {
  if (currentHour >= 5 && currentHour < 12) return 'morning';
  else if (currentHour >= 12 && currentHour < 18) return 'afternoon';
  else return 'evening';
}

async function handleCheckinReminders(req: Request) {
  try {
    const auth = validateCronRequest(req);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error || 'Unauthorized cron request' }, { status: 401 });
    }

    const url = new URL(req.url);

    const requestedSlot = url.searchParams.get('slot');
    const targetUserId = url.searchParams.get('userId');

    const now = new Date();
    const currentHour = now.getHours();
    const todayStr = format(now, 'yyyy-MM-dd');

    const slot: 'morning' | 'afternoon' | 'evening' | 'streak' =
      requestedSlot === 'morning' || requestedSlot === 'afternoon' ||
      requestedSlot === 'evening' || requestedSlot === 'streak'
        ? requestedSlot : determineAutoSlot(currentHour);

    const supabase = getCronSupabaseClient();


    // 1. Fetch all push subscriptions
    let subsQuery = supabase
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth, user_agent');

    if (targetUserId) {
      subsQuery = subsQuery.eq('user_id', targetUserId);
    }

    const { data: subscriptions, error: subsErr } = await subsQuery;

    if (subsErr) {
      console.error('Error fetching push subscriptions in cron:', subsErr);
      return NextResponse.json({ success: false, error: subsErr.message }, { status: 500 });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No push subscriptions found to check.',
        totalSubscriptions: 0,
        remindersSent: 0,
        date: todayStr,
        slot,
      });
    }

    // 2. Group subscriptions by user_id
    const userSubMap = new Map<string, typeof subscriptions>();
    for (const sub of subscriptions) {
      const list = userSubMap.get(sub.user_id) || [];
      list.push(sub);
      userSubMap.set(sub.user_id, list);
    }

    const userIds = Array.from(userSubMap.keys());

    // 3. Fetch profiles and user preferences in parallel
    const [profilesRes, prefMap] = await Promise.all([
      supabase.from('profiles').select('id, username, first_name, last_name').in('id', userIds),
      getUserPreferencesMap(supabase, userIds),
    ]);

    const profileMap = new Map<string, any>();
    if (profilesRes.data) {
      for (const p of profilesRes.data) {
        profileMap.set(p.id, p);
      }
    }

    // 4. Fetch today's check-ins to verify if user has already completed the slot
    const { data: todayCheckins } = await supabase
      .from('daily_checkins')
      .select('user_id, summary')
      .in('user_id', userIds)
      .eq('date', todayStr);

    const checkinMap = new Map<string, Record<string, any>>();
    if (todayCheckins) {
      for (const c of todayCheckins) {
        let parsed = {};
        try {
          parsed = typeof c.summary === 'string' ? JSON.parse(c.summary) : c.summary || {};
        } catch {}
        checkinMap.set(c.user_id, parsed);
      }
    }

    // 5. Fetch streak data for personalized streak preservation reminders
    const { data: streakRows } = await supabase
      .from('wellness_streaks')
      .select('user_id, current_streak')
      .in('user_id', userIds);

    const streakMap = new Map<string, number>();
    if (streakRows) {
      for (const s of streakRows) {
        streakMap.set(s.user_id, s.current_streak || 0);
      }
    }

    // 6. Process each user and send push notifications if check-in is incomplete
    const deadSubIds: string[] = [];
    let sentCount = 0;
    let incompleteUserCount = 0;
    const dispatchDetails: Array<{ userId: string; slot: string; sentDevices: number }> = [];

    for (const userId of userIds) {
      const userProfile = profileMap.get(userId);
      const userPref = prefMap.get(userId);

      // Check Master & Individual Notification Controls
      if (userPref) {
        if (userPref.enabled === false) continue;
        if (slot === 'morning' && userPref.morningCheckin === false) continue;
        if (slot === 'afternoon' && userPref.afternoonCheckin === false) continue;
        if (slot === 'evening' && userPref.eveningCheckin === false) continue;
      } else if (userProfile && userProfile.notifications_enabled === false) {
        continue;
      }

      const summary = checkinMap.get(userId) || {};
      const userStreak = streakMap.get(userId) || 0;
      const userName = userProfile?.full_name || userProfile?.username || 'there';

      // Determine if check-in is already completed for the target slot (SUPPRESSION RULE)
      let isCompleted = false;

      if (slot === 'morning') {
        isCompleted = Boolean(summary.morning?.completed);
      } else if (slot === 'afternoon') {
        isCompleted = Boolean(summary.afternoon?.completed);
      } else if (slot === 'evening') {
        isCompleted = Boolean(summary.evening?.completed);
      } else if (slot === 'streak') {
        // Any check-in slot completed today keeps streak alive
        isCompleted = Boolean(summary.morning?.completed || summary.afternoon?.completed || summary.evening?.completed);
      } else {
        isCompleted = Boolean(summary.morning?.completed && summary.afternoon?.completed && summary.evening?.completed);
      }

      // If user ALREADY completed check-in, SUPPRESS reminder (DO NOT SEND)
      if (!isCompleted) {
        incompleteUserCount++;
        const { title, body } = buildCheckinMessage(
          userName,
          slot === 'streak' || (currentHour >= 20 && userStreak > 1) ? 'streak' : slot,
          userStreak
        );
        const payload = {
          title,
          message: body,
          url: '/check-in',
          actionLabel: slot === 'streak' || userStreak > 0 ? 'Protect Streak' : 'Complete Check-In',
          tag: `checkin-${slot}-${todayStr}`,
          category: 'checkin' as const,
        };

        const userSubs = userSubMap.get(userId) || [];
        let userSentDevices = 0;

        for (const sub of userSubs) {
          const result = await sendWebPush(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            payload
          );

          if (result.success) {
            sentCount++;
            userSentDevices++;
          }

          if (result.shouldDeleteSubscription) {
            deadSubIds.push(sub.id);
          }
        }

        dispatchDetails.push({
          userId,
          slot,
          sentDevices: userSentDevices,
        });
      }
    }

    // 7. Cleanup expired / invalid subscriptions
    if (deadSubIds.length > 0) {
      await supabase.from('push_subscriptions').delete().in('id', deadSubIds);
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      date: todayStr,
      slot,
      totalSubscriptions: subscriptions.length,
      uniqueUsers: userIds.length,
      incompleteUsers: incompleteUserCount,
      remindersSent: sentCount,
      cleanedUpExpired: deadSubIds.length,
      dispatchDetails,
    });
  } catch (error: any) {
    console.error('Error in /api/cron/checkin-reminder:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal check-in reminder error' },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  return handleCheckinReminders(req);
}

export async function POST(req: Request) {
  return handleCheckinReminders(req);
}
