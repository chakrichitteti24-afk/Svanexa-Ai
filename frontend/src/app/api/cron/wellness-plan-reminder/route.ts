import { NextResponse } from 'next/server';
import { format } from 'date-fns';
import { getCronSupabaseClient, getUserPreferencesMap, buildWellnessPlanMessage } from '@/lib/services/cron-utils';
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

      // Check Master & Individual Wellness Plan preference
      if (pref) {
        if (pref.enabled === false || pref.wellnessPlan === false) {
          continue;
        }
      }

      const { title, body } = buildWellnessPlanMessage();

      for (const sub of (userSubMap.get(userId) || [])) {
        const r = await sendWebPush(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          {
            title,
            message: body,
            url: '/wellness-plan',
            actionLabel: 'View Plan',
            tag: `plan-ready-${todayStr}`,
            category: 'system',
          }
        );
        if (r.success) sentCount++;
        if (r.shouldDeleteSubscription) deadIds.push(sub.id);
      }
    }

    if (deadIds.length > 0) {
      await supabase.from('push_subscriptions').delete().in('id', deadIds);
    }

    return NextResponse.json({
      success: true,
      date: todayStr,
      remindersSent: sentCount,
      usersNotified: userIds.length,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}