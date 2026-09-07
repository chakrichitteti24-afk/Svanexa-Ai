import { NextResponse } from 'next/server';
import { getCronSupabaseClient, getUserPreferencesMap, fetchWeatherForCron, buildWeatherWellnessMessage, SimpleWeather, validateCronRequest } from '@/lib/services/cron-utils';
import { sendWebPush } from '@/lib/services/web-push';
import { getUserLocalTime, isNotificationAllowed, persistNotificationToDatabase } from '@/lib/services/notification-engine';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const auth = validateCronRequest(req);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    const weather = await fetchWeatherForCron();

    // Only send weather wellness tip if weather is notable (hot/rainy/cold/high-UV)
    const isNotable = weather && (weather.isHot || weather.isRainy || weather.isCold || weather.isHighUV);
    if (!isNotable) {
      return NextResponse.json({ success: true, skipped: true, reason: 'Weather is normal, no special alert needed', weather: weather?.condition });
    }

    const supabase = getCronSupabaseClient();
    const nowUtc = new Date();

    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth');
    if (error || !subscriptions?.length) {
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

      // Check Master preference
      if (pref && pref.enabled === false) {
        suppressedCount++;
        continue;
      }

      const name = profileMap.get(userId) || 'there';
      const userTz = pref?.timezone || 'Asia/Kolkata';
      const localTime = getUserLocalTime(userTz, nowUtc);
      const { title, body } = buildWeatherWellnessMessage(name, weather as SimpleWeather);

      // 1. Persist to inbox
      await persistNotificationToDatabase(supabase, {
        userId,
        title,
        message: body,
        category: 'system',
        priority: 'low',
        actionUrl: '/dashboard',
        actionLabel: 'Open Svanexa',
        metadata: { condition: weather?.condition, temp: weather?.temp, date: localTime.dateStr },
      });

      // 2. Dispatch push if enabled
      if (pref?.browserPush !== false) {
        for (const sub of (userSubMap.get(userId) || [])) {
          const r = await sendWebPush(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            {
              title,
              message: body,
              url: '/dashboard',
              actionLabel: 'Open Svanexa',
              tag: `weather-wellness-${localTime.dateStr}`,
              category: 'system',
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
      temp: weather?.temp,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}