import { NextResponse } from 'next/server';
import { format } from 'date-fns';
import { getCronSupabaseClient, fetchWeatherForCron, buildSupplementsMessage } from '@/lib/services/cron-utils';
import { sendWebPush } from '@/lib/services/web-push';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get('authorization');
    if (cronSecret && authHeader !== `Bearer `) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getCronSupabaseClient();
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const weather = await fetchWeatherForCron();

    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth');
    if (error || !subscriptions?.length) {
      return NextResponse.json({ success: true, remindersSent: 0, message: 'No subscriptions' });
    }

    const userIds = [...new Set(subscriptions.map((s: any) => s.user_id))];
    const profileMap = new Map<string, string>();
    try {
      const { data: profiles } = await supabase.from('profiles').select('id, username, first_name, last_name').in('id', userIds);
      if (profiles) for (const p of profiles) profileMap.set(p.id, (p.username && p.username !== 'User' ? p.username : p.first_name) || 'there');
    } catch {}

    const { data: checkins } = await supabase
      .from('daily_checkins').select('user_id, summary').in('user_id', userIds).eq('date', todayStr);
    const supplementsDone = new Set<string>();
    if (checkins) {
      for (const c of checkins) {
        try {
          const s = typeof c.summary === 'string' ? JSON.parse(c.summary) : c.summary || {};
          if (s.supplements === true || s.supplements === 'taken') supplementsDone.add(c.user_id);
        } catch {}
      }
    }

    const userSubMap = new Map<string, any[]>();
    for (const s of subscriptions) { const l = userSubMap.get(s.user_id)||[]; l.push(s); userSubMap.set(s.user_id, l); }

    const deadIds: string[] = []; let sentCount = 0;

    for (const userId of userIds) {
      if (supplementsDone.has(userId)) continue;
      const name = profileMap.get(userId) || 'there';
      const { title, body } = buildSupplementsMessage(name, weather);
      for (const sub of (userSubMap.get(userId) || [])) {
        const r = await sendWebPush({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          { title, message: body, url: '/wellness-plan', actionLabel: 'View Care Plan', tag: 'supplements-reminder', category: 'supplements' });
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