import { NextResponse } from 'next/server';
import { getCronSupabaseClient, getUserPreferencesMap, buildCycleMessage, validateCronRequest } from '@/lib/services/cron-utils';
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
    const auth = validateCronRequest(req);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    const supabase = getCronSupabaseClient();

    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth');
    if (error || !subscriptions?.length) {
      return NextResponse.json({ success: true, remindersSent: 0, message: 'No subscriptions' });
    }

    const userIds = [...new Set(subscriptions.map((s: any) => s.user_id))];
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    // Fetch user preferences in parallel
    const prefMap = await getUserPreferencesMap(supabase, userIds);

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
      const pref = prefMap.get(userId);

      // Check Master & Individual Cycle Tracker Preference
      if (pref) {
        if (pref.enabled === false || pref.cycleTracker === false) {
          continue;
        }
      }

      const logs = userCycles.get(userId) || [];
      const prediction = predictNextPeriod(logs);
      if (!prediction) continue;
      const { daysUntil } = prediction;
      if (daysUntil < 0 || daysUntil > 3) continue; // Only notify if period is within 3 days

      const { title, body } = buildCycleMessage();

      for (const sub of (userSubMap.get(userId) || [])) {
        const r = await sendWebPush({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          { title, message: body, url: '/cycle', actionLabel: 'View Calendar', tag: `cycle-tracker-${todayStr}`, category: 'cycle' });
        if (r.success) sentCount++;
        if (r.shouldDeleteSubscription) deadIds.push(sub.id);
      }
    }

    if (deadIds.length > 0) await supabase.from('push_subscriptions').delete().in('id', deadIds);
    return NextResponse.json({ success: true, date: todayStr, remindersSent: sentCount });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}