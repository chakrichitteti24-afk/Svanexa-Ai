import { NextResponse } from 'next/server';
import { format } from 'date-fns';
import { getCronSupabaseClient, getUserPreferencesMap, buildWellnessTaskMessage } from '@/lib/services/cron-utils';
import { sendWebPush } from '@/lib/services/web-push';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get('authorization');
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getCronSupabaseClient();
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth');

    if (error || !subscriptions?.length) {
      return NextResponse.json({ success: true, remindersSent: 0, message: 'No subscriptions' });
    }

    const userIds = [...new Set(subscriptions.map((s: any) => s.user_id))];

    // Fetch user preferences in parallel
    const prefMap = await getUserPreferencesMap(supabase, userIds);

    // Fetch today's wellness plans
    const { data: plans } = await supabase
      .from('wellness_plans')
      .select('user_id, content')
      .in('user_id', userIds)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    const userPlanMap = new Map<string, any[]>();
    if (plans) {
      for (const p of plans) {
        if (!userPlanMap.has(p.user_id)) {
          try {
            const parsed = typeof p.content === 'string' ? JSON.parse(p.content) : p.content;
            if (Array.isArray(parsed)) {
              userPlanMap.set(p.user_id, parsed);
            }
          } catch {}
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

    for (const userId of userIds) {
      const pref = prefMap.get(userId);

      // Check Master & Individual Wellness Tasks preference
      if (pref) {
        if (pref.enabled === false || pref.wellnessTasks === false) {
          continue;
        }
      }

      const tasks = userPlanMap.get(userId) || [];

      // If user has tasks and at least one is pending (SUPPRESSION RULE: if all complete, do not send!)
      const hasPendingTasks = tasks.length > 0 && tasks.some((t: any) => !t.completed && t.status !== 'completed');

      if (hasPendingTasks) {
        const { title, body } = buildWellnessTaskMessage();

        for (const sub of (userSubMap.get(userId) || [])) {
          const r = await sendWebPush(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            {
              title,
              message: body,
              url: '/dashboard',
              actionLabel: 'View Tasks',
              tag: `tasks-reminder-${todayStr}`,
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
      date: todayStr,
      remindersSent: sentCount,
      usersChecked: userIds.length,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}