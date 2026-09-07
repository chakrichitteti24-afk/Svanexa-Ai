import { NextResponse } from 'next/server';
import { getCronSupabaseClient, getUserPreferencesMap, fetchWeatherForCron, buildSkinMessage, validateCronRequest } from '@/lib/services/cron-utils';
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
      return NextResponse.json({ success: true, remindersSent: 0, message: 'No subscriptions' });
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

    // Check skin_logs for recent dates
    const twoDaysAgo = new Date(nowUtc.getTime() - 86400000).toISOString().slice(0, 10);
    const { data: skinLogs } = await supabase
      .from('skin_logs')
      .select('user_id, date')
      .in('user_id', userIds)
      .gte('date', twoDaysAgo);

    const skinDoneKeys = new Set<string>();
    if (skinLogs) {
      for (const s of skinLogs) {
        skinDoneKeys.add(`${s.user_id}_${s.date}`);
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

    for (const userId of userIds) {
      const pref = prefMap.get(userId);

      // Check Master & Skin preference
      if (!isNotificationAllowed(pref, 'skin')) {
        suppressedCount++;
        continue;
      }

      const userTz = pref?.timezone || 'Asia/Kolkata';
      const localTime = getUserLocalTime(userTz, nowUtc);

      // If already logged skin condition today, skip
      if (skinDoneKeys.has(`${userId}_${localTime.dateStr}`)) {
        continue;
      }

      const name = profileMap.get(userId) || 'there';
      const { title, body } = buildSkinMessage(name, weather);

      // 1. Persist to inbox
      await persistNotificationToDatabase(supabase, {
        userId,
        title,
        message: body,
        category: 'skin',
        priority: 'normal',
        actionUrl: '/skin',
        actionLabel: 'Log Skin Today',
        metadata: { date: localTime.dateStr },
      });

      // 2. Dispatch push if enabled
      if (pref?.browserPush !== false) {
        for (const sub of (userSubMap.get(userId) || [])) {
          const r = await sendWebPush(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            {
              title,
              message: body,
              url: '/skin',
              actionLabel: 'Log Skin Today',
              tag: `skin-reminder-${localTime.dateStr}`,
              category: 'skin',
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