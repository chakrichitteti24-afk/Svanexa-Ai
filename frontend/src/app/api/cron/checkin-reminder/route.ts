import { NextResponse } from 'next/server';
import { sendWebPush } from '@/lib/services/web-push';
import {
  getCronSupabaseClient,
  getUserPreferencesMap,
  buildCheckinMessage,
  validateCronRequest,
} from '@/lib/services/cron-utils';
import {
  getUserLocalTime,
  determineUserSlot,
  isNotificationAllowed,
  persistNotificationToDatabase,
} from '@/lib/services/notification-engine';

export const dynamic = 'force-dynamic';

async function handleCheckinReminders(req: Request) {
  try {
    const auth = validateCronRequest(req);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error || 'Unauthorized cron request' }, { status: 401 });
    }

    const url = new URL(req.url);
    const requestedSlot = url.searchParams.get('slot') as 'morning' | 'afternoon' | 'evening' | 'streak' | null;
    const targetUserId = url.searchParams.get('userId');

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
        slot: requestedSlot || 'auto',
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
      supabase.from('profiles').select('id, username, first_name, last_name, notifications_enabled').in('id', userIds),
      getUserPreferencesMap(supabase, userIds),
    ]);

    const profileMap = new Map<string, any>();
    if (profilesRes.data) {
      for (const p of profilesRes.data) {
        profileMap.set(p.id, p);
      }
    }

    // 4. Fetch recent check-ins across last 2 days to account for all user timezones
    const nowUtc = new Date();
    const todayUtc = nowUtc.toISOString().slice(0, 10);
    const yesterdayUtc = new Date(nowUtc.getTime() - 86400000).toISOString().slice(0, 10);

    const { data: recentCheckins } = await supabase
      .from('daily_checkins')
      .select('user_id, date, summary')
      .in('user_id', userIds)
      .gte('date', yesterdayUtc)
      .lte('date', todayUtc);

    // checkinMap: userId -> Map<dateStr, summary>
    const checkinMap = new Map<string, Map<string, Record<string, any>>>();
    if (recentCheckins) {
      for (const c of recentCheckins) {
        let userMap = checkinMap.get(c.user_id);
        if (!userMap) {
          userMap = new Map();
          checkinMap.set(c.user_id, userMap);
        }
        let parsed = {};
        try {
          parsed = typeof c.summary === 'string' ? JSON.parse(c.summary) : c.summary || {};
        } catch {}
        userMap.set(c.date, parsed);
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
    let suppressedCount = 0;
    const dispatchDetails: Array<{ userId: string; slot: string; sentDevices: number }> = [];

    for (const userId of userIds) {
      const userProfile = profileMap.get(userId);
      const userPref = prefMap.get(userId);

      // Localized timezone calculation for each individual user
      const userTz = userPref?.timezone || 'Asia/Kolkata';
      const localTime = getUserLocalTime(userTz, nowUtc);

      // Determine slot: use requestedSlot if valid, else determine from local time & custom schedule
      const effectiveSlot = requestedSlot || determineUserSlot(localTime.hour, userPref?.reminderSchedule);

      // Verify preference enforcement
      if (!isNotificationAllowed(userPref, 'checkin', effectiveSlot)) {
        suppressedCount++;
        continue;
      }
      if (userProfile?.notifications_enabled === false) {
        suppressedCount++;
        continue;
      }

      const userDates = checkinMap.get(userId);
      const summary = userDates?.get(localTime.dateStr) || {};
      const userStreak = streakMap.get(userId) || 0;
      const userName = userProfile?.first_name || userProfile?.username || 'there';

      // Determine if check-in is already completed for the target slot (SUPPRESSION RULE)
      let isCompleted = false;

      if (effectiveSlot === 'morning') {
        isCompleted = Boolean(summary.morning?.completed);
      } else if (effectiveSlot === 'afternoon') {
        isCompleted = Boolean(summary.afternoon?.completed);
      } else if (effectiveSlot === 'evening') {
        isCompleted = Boolean(summary.evening?.completed);
      } else if (effectiveSlot === 'streak') {
        // Any check-in slot completed today keeps streak alive
        isCompleted = Boolean(summary.morning?.completed || summary.afternoon?.completed || summary.evening?.completed);
      } else {
        isCompleted = Boolean(summary.morning?.completed && summary.afternoon?.completed && summary.evening?.completed);
      }

      // If user ALREADY completed check-in, SUPPRESS reminder (DO NOT SEND)
      if (!isCompleted) {
        incompleteUserCount++;
        const isStreakSlot = effectiveSlot === 'streak' || (localTime.hour >= 20 && userStreak > 1);
        const { title, body } = buildCheckinMessage(
          userName,
          isStreakSlot ? 'streak' : effectiveSlot,
          userStreak
        );

        const actionLabel = isStreakSlot ? 'Protect Streak' : 'Complete Check-In';
        const tag = `checkin-${effectiveSlot}-${localTime.dateStr}`;

        // 1. Persist in database inbox
        await persistNotificationToDatabase(supabase, {
          userId,
          title,
          message: body,
          category: 'checkin',
          priority: isStreakSlot ? 'high' : 'normal',
          actionUrl: '/check-in',
          actionLabel,
          metadata: { slot: effectiveSlot, streak: userStreak, date: localTime.dateStr },
        });

        // 2. Dispatch push notifications to all user's registered devices if browserPush enabled
        let userSentDevices = 0;
        if (userPref?.browserPush !== false) {
          const userSubs = userSubMap.get(userId) || [];
          for (const sub of userSubs) {
            const result = await sendWebPush(
              {
                endpoint: sub.endpoint,
                keys: {
                  p256dh: sub.p256dh,
                  auth: sub.auth,
                },
              },
              {
                title,
                message: body,
                url: '/check-in',
                actionUrl: '/check-in',
                actionLabel,
                tag,
                category: 'checkin',
              }
            );

            if (result.success) {
              sentCount++;
              userSentDevices++;
            }

            if (result.shouldDeleteSubscription) {
              deadSubIds.push(sub.id);
            }
          }
        }

        dispatchDetails.push({
          userId,
          slot: effectiveSlot,
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
      timestamp: nowUtc.toISOString(),
      totalSubscriptions: subscriptions.length,
      uniqueUsers: userIds.length,
      incompleteUsers: incompleteUserCount,
      suppressedCount,
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
