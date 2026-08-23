import { NextResponse } from 'next/server';
import { format } from 'date-fns';
import { getCronSupabaseClient, fetchWeatherForCron, buildWeatherWellnessMessage, SimpleWeather } from '@/lib/services/cron-utils';
import { sendWebPush } from '@/lib/services/web-push';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get('authorization');
    if (cronSecret && authHeader !== `Bearer `) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const weather = await fetchWeatherForCron();

    // Only send weather wellness tip if weather is notable (hot/rainy/cold/high-UV)
    const isNotable = weather && (weather.isHot || weather.isRainy || weather.isCold || weather.isHighUV);
    if (!isNotable) {
      return NextResponse.json({ success: true, skipped: true, reason: 'Weather is normal, no special alert needed', weather: weather?.condition });
    }

    const supabase = getCronSupabaseClient();

    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth');
    if (error || !subscriptions?.length) {
      return NextResponse.json({ success: true, remindersSent: 0, message: 'No subscriptions' });
    }

    const userIds = [...new Set(subscriptions.map((s: any) => s.user_id))];
    const profileMap = new Map<string, string>();
    try {
      const { data: profiles } = await supabase.from('profiles').select('id, username, full_name').in('id', userIds);
      if (profiles) for (const p of profiles) profileMap.set(p.id, (p.username && p.username !== 'User' ? p.username : p.full_name) || 'there');
    } catch {}

    const userSubMap = new Map<string, any[]>();
    for (const s of subscriptions) { const l = userSubMap.get(s.user_id)||[]; l.push(s); userSubMap.set(s.user_id, l); }

    const deadIds: string[] = []; let sentCount = 0;

    for (const userId of userIds) {
      const name = profileMap.get(userId) || 'there';
      const { title, body } = buildWeatherWellnessMessage(name, weather as SimpleWeather);
      for (const sub of (userSubMap.get(userId) || [])) {
        const r = await sendWebPush({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          { title, message: body, url: '/dashboard', actionLabel: 'Open Svanexa', tag: 'weather-wellness', category: 'system' });
        if (r.success) sentCount++;
        if (r.shouldDeleteSubscription) deadIds.push(sub.id);
      }
    }

    if (deadIds.length > 0) await supabase.from('push_subscriptions').delete().in('id', deadIds);
    return NextResponse.json({ success: true, date: format(new Date(), 'yyyy-MM-dd'), remindersSent: sentCount, weather: weather?.condition, temp: weather?.temp });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}