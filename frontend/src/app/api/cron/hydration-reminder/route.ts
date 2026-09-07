import { NextResponse } from 'next/server';
import { getCronSupabaseClient, getUserPreferencesMap, fetchWeatherForCron, buildHydrationMessage, validateCronRequest } from '@/lib/services/cron-utils';
import { sendWebPush } from '@/lib/services/web-push';
import { getUserLocalTime, isNotificationAllowed, persistNotificationToDatabase } from '@/lib/services/notification-engine';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const auth = validateCronRequest(req);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    const supabase = getCronSupabaseClient();
    const nowUtc = new Date();
    const weather = await fetchWeatherForCron();

    const { data: subscriptions, error: subsErr } = await supabase
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth');

    if (subsErr || !subscriptions?.length) {
      return NextResponse.json({ success: true, remindersSent: 0, message: 'No subscriptions found' });
    }

    const userIds = [...new Set(subscriptions.map((s: any) => s.user_id))] as string[];

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

    // Check water logs for the past 2 days across user timezones
    const twoDaysAgo = new Date(nowUtc.getTime() - 86400000).toISOString().slice(0, 10);
    const { data: checkins } = await supabase
      .from('daily_checkins')
      .select('user_id, date, summary')
      .in('user_id', userIds)
      .gte('date', twoDaysAgo);

    const userWaterMap = new Map<string, Map<string, number>>();
    if (checkins) {
      for (const c of checkins) {
        let dateMap = userWaterMap.get(c.user_id);
        if (!dateMap) {
          dateMap = new Map();
          userWaterMap.set(c.user_id, dateMap);
        }
        try {
          const s = typeof c.summary === 'string' ? JSON.parse(c.summary) : c.summary || {};
          dateMap.set(c.date, parseFloat(s.water) || 0);
        } catch {}
      }
    }

    const deadIds: string[] = [];
    let sentCount = 0;
    let suppressedCount = 0;

    const userSubMap = new Map<string, any[]>();
    for (const s of subscriptions) {
      const list = userSubMap.get(s.user_id) || [];
      list.push(s);
      userSubMap.set(s.user_id, list);
    }

    for (const userId of userIds) {
      const pref = prefMap.get(userId);

      // Check Master & Hydration preference
      if (!isNotificationAllowed(pref, 'hydration')) {
        suppressedCount++;
        continue;
      }

      const userTz = pref?.timezone || 'Asia/Kolkata';
      const localTime = getUserLocalTime(userTz, nowUtc);
      const name = profileMap.get(userId) || 'there';

      const userWaterToday = userWaterMap.get(userId)?.get(localTime.dateStr) ?? 0;
      if (userWaterToday >= 2.0) {
        // Hydration goal met -> suppress reminder
        continue;
      }

      const { title, body } = buildHydrationMessage(name, userWaterToday, weather);

      // 1. Persist to inbox
      await persistNotificationToDatabase(supabase, {
        userId,
        title,
        message: body,
        category: 'hydration',
        priority: 'normal',
        actionUrl: '/check-in',
        actionLabel: 'Log Water',
        metadata: { currentWater: userWaterToday, date: localTime.dateStr },
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
              actionLabel: 'Log Water',
              tag: `hydration-reminder-${localTime.dateStr}`,
              category: 'hydration',
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
      weather: weather?.condition,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}