import { NextResponse } from 'next/server';
import { format } from 'date-fns';
import { getCronSupabaseClient, fetchWeatherForCron, buildHydrationMessage } from '@/lib/services/cron-utils';
import { sendWebPush } from '@/lib/services/web-push';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get('authorization');
    if (cronSecret && authHeader !== `Bearer `) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getCronSupabaseClient();
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const weather = await fetchWeatherForCron();

    const { data: subscriptions, error: subsErr } = await supabase
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth');

    if (subsErr || !subscriptions?.length) {
      return NextResponse.json({ success: true, remindersSent: 0, message: 'No subscriptions found' });
    }

    const userIds = [...new Set(subscriptions.map((s: any) => s.user_id))];

    const profileMap = new Map<string, string>();
    try {
      const { data: profiles } = await supabase.from('profiles').select('id, username, full_name').in('id', userIds);
      if (profiles) {
        for (const p of profiles) {
          profileMap.set(p.id, (p.username && p.username !== 'User' ? p.username : p.full_name) || 'there');
        }
      }
    } catch {}

    const { data: checkins } = await supabase
      .from('daily_checkins').select('user_id, summary').in('user_id', userIds).eq('date', todayStr);

    const waterMap = new Map<string, number>();
    if (checkins) {
      for (const c of checkins) {
        try {
          const s = typeof c.summary === 'string' ? JSON.parse(c.summary) : c.summary || {};
          waterMap.set(c.user_id, parseFloat(s.water) || 0);
        } catch {}
      }
    }

    const deadIds: string[] = [];
    let sentCount = 0;

    const userSubMap = new Map<string, any[]>();
    for (const s of subscriptions) {
      const list = userSubMap.get(s.user_id) || [];
      list.push(s); userSubMap.set(s.user_id, list);
    }

    for (const userId of userIds) {
      const name = profileMap.get(userId) || 'there';
      const water = waterMap.get(userId) ?? 0;
      if (water >= 2.0) continue;

      const { title, body } = buildHydrationMessage(name, water, weather);
      for (const sub of (userSubMap.get(userId) || [])) {
        const r = await sendWebPush({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          { title, message: body, url: '/check-in', actionLabel: 'Log Water', tag: 'hydration-reminder', category: 'hydration' });
        if (r.success) sentCount++;
        if (r.shouldDeleteSubscription) deadIds.push(sub.id);
      }
    }

    if (deadIds.length > 0) await supabase.from('push_subscriptions').delete().in('id', deadIds);

    return NextResponse.json({ success: true, date: todayStr, remindersSent: sentCount, weather: weather?.condition });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}