import { NextResponse } from 'next/server';
import { getCronSupabaseClient, buildCycleMessage } from '@/lib/services/cron-utils';
import { sendWebPush } from '@/lib/services/web-push';
import { differenceInDays, parseISO, addDays, format } from 'date-fns';

export const dynamic = 'force-dynamic';

function predictNextPeriod(cycleLogs: { start_date: string; end_date?: string }[]): { daysUntil: number } | null {
  if (!cycleLogs || cycleLogs.length < 2) return null;
  const sorted = [...cycleLogs].sort((a, b) => a.start_date.localeCompare(b.start_date));
  const lengths: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = parseISO(sorted[i - 1].start_date);
    const curr = parseISO(sorted[i].start_date);
    const diff = differenceInDays(curr, prev);
    if (diff > 18 && diff < 50) lengths.push(diff);
  }
  if (lengths.length === 0) return null;
  const avgCycle = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
  const lastStart = parseISO(sorted[sorted.length - 1].start_date);
  const nextPredicted = addDays(lastStart, avgCycle);
  const daysUntil = differenceInDays(nextPredicted, new Date());
  return { daysUntil };
}

export async function GET(req: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get('authorization');
    if (cronSecret && authHeader !== `Bearer `) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
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

    const { data: cycleLogs } = await supabase
      .from('cycle_logs').select('user_id, start_date, end_date').in('user_id', userIds)
      .order('start_date', { ascending: true });

    const userCycles = new Map<string, { start_date: string }[]>();
    if (cycleLogs) {
      for (const c of cycleLogs) {
        const list = userCycles.get(c.user_id) || [];
        list.push({ start_date: c.start_date }); userCycles.set(c.user_id, list);
      }
    }

    const userSubMap = new Map<string, any[]>();
    for (const s of subscriptions) { const l = userSubMap.get(s.user_id)||[]; l.push(s); userSubMap.set(s.user_id, l); }

    const deadIds: string[] = []; let sentCount = 0;

    for (const userId of userIds) {
      const logs = userCycles.get(userId) || [];
      const prediction = predictNextPeriod(logs);
      if (!prediction) continue;
      const { daysUntil } = prediction;
      if (daysUntil < 0 || daysUntil > 3) continue; // Only notify if period is within 3 days

      const name = profileMap.get(userId) || 'there';
      const { title, body } = buildCycleMessage(name, daysUntil);

      for (const sub of (userSubMap.get(userId) || [])) {
        const r = await sendWebPush({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          { title, message: body, url: '/cycle', actionLabel: 'View Cycle Calendar', tag: 'cycle-prediction', category: 'cycle' });
        if (r.success) sentCount++;
        if (r.shouldDeleteSubscription) deadIds.push(sub.id);
      }
    }

    if (deadIds.length > 0) await supabase.from('push_subscriptions').delete().in('id', deadIds);
    return NextResponse.json({ success: true, date: format(new Date(), 'yyyy-MM-dd'), remindersSent: sentCount });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}