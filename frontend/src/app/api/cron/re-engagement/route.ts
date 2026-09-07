import { NextResponse } from 'next/server';
import { getCronSupabaseClient, getUserPreferencesMap, validateCronRequest } from '@/lib/services/cron-utils';
import { sendWebPush } from '@/lib/services/web-push';
import { getUserLocalTime, isNotificationAllowed, persistNotificationToDatabase } from '@/lib/services/notification-engine';
import { format, differenceInDays, parseISO } from 'date-fns';

export const dynamic = 'force-dynamic';

function getReEngagementMessage(name: string, daysSince: number): { title: string; body: string } {
  const cleanName = name && name.trim() && name !== 'there' ? name.trim() : '';
  const greeting = cleanName ? `, ${cleanName}` : '';

  if (daysSince >= 14) {
    return {
      title: `🌸 Thinking of you${greeting}`,
      body: `We hope you are taking gentle care of yourself! Your wellness journey is always here whenever you'd like to return. No rush or pressure — we are always in your corner.`,
    };
  }
  if (daysSince >= 5) {
    return {
      title: `🌿 A gentle hello${greeting}`,
      body: `Life gets full and busy, and that is completely natural! Whenever you have a quiet moment, we're here to help you reflect on your wellness. Take good care.`,
    };
  }
  return {
    title: `✨ A gentle check-in${greeting}`,
    body: `Hope you had a restful day yesterday! Whenever you're ready today, take 60 seconds to note how you're feeling. Wishing you a peaceful day ahead.`,
  };
}

export async function GET(req: Request) {
  try {
    const auth = validateCronRequest(req);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    const supabase = getCronSupabaseClient();
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');

    // Get all push subscriptions
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth');

    if (error || !subscriptions?.length) {
      return NextResponse.json({ success: true, remindersSent: 0, message: 'No subscriptions' });
    }

    const userIds = [...new Set(subscriptions.map((s: any) => s.user_id))] as string[];

    // Get profiles and preferences in parallel
    const [profilesRes, prefMap] = await Promise.all([
      supabase.from('profiles').select('id, username, first_name, last_name, notifications_enabled').in('id', userIds),
      getUserPreferencesMap(supabase, userIds),
    ]);

    const profileMap = new Map<string, string>();
    if (profilesRes.data) {
      for (const p of profilesRes.data) {
        profileMap.set(p.id, p.first_name || (p.username && p.username !== 'User' ? p.username : 'there'));
      }
    }

    // Get each user's most recent check-in date
    const { data: recentCheckins } = await supabase
      .from('daily_checkins')
      .select('user_id, date')
      .in('user_id', userIds)
      .order('date', { ascending: false });

    // Build map: userId -> most recent checkin date
    const lastCheckinMap = new Map<string, string>();
    if (recentCheckins) {
      for (const c of recentCheckins) {
        if (!lastCheckinMap.has(c.user_id)) {
          lastCheckinMap.set(c.user_id, c.date);
        }
      }
    }

    const userSubMap = new Map<string, any[]>();
    for (const s of subscriptions) {
      const l = userSubMap.get(s.user_id) || [];
      l.push(s);
      userSubMap.set(s.user_id, l);
    }

    const deadIds: string[] = [];
    let sentCount = 0;
    let suppressedCount = 0;
    const MILESTONES = [2, 5, 14]; // days of inactivity to send polite check-in

    for (const userId of userIds) {
      const pref = prefMap.get(userId);

      // Check Master & Checkin preferences
      if (!isNotificationAllowed(pref, 'checkin')) {
        suppressedCount++;
        continue;
      }

      const userTz = pref?.timezone || 'Asia/Kolkata';
      const localTime = getUserLocalTime(userTz, today);

      const lastDateStr = lastCheckinMap.get(userId);

      // If user checked in today, skip
      if (lastDateStr === localTime.dateStr) continue;

      let daysSince = 99;
      if (lastDateStr) {
        daysSince = differenceInDays(today, parseISO(lastDateStr));
      }

      // Only send on specific milestone days (2, 5, 14) to avoid unnecessary notification frequency
      if (!MILESTONES.includes(daysSince)) continue;

      const name = profileMap.get(userId) || 'there';
      const { title, body } = getReEngagementMessage(name, daysSince);

      // 1. Persist to inbox
      await persistNotificationToDatabase(supabase, {
        userId,
        title,
        message: body,
        category: 'checkin',
        priority: 'low',
        actionUrl: '/check-in',
        actionLabel: 'Check In When Ready',
        metadata: { daysSince, date: localTime.dateStr },
      });

      // 2. Dispatch push if enabled
      if (pref?.browserPush !== false) {
        for (const sub of (userSubMap.get(userId) || [])) {
          const r = await sendWebPush(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            {
              title,
              message: body,
              url: '/check-in',
              actionLabel: 'Check In When Ready',
              tag: `re-engagement-${localTime.dateStr}`,
              category: 'checkin',
            }
          );
          if (r.success) sentCount++;
          if (r.shouldDeleteSubscription) deadIds.push(sub.id);
        }
      }
    }

    if (deadIds.length > 0) {
      await supabase.from('push_subscriptions').delete().in('id', deadIds);
    }

    return NextResponse.json({
      success: true,
      remindersSent: sentCount,
      suppressedCount,
      usersChecked: userIds.length,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}