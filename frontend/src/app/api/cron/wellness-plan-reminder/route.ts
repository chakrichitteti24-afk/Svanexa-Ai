import { NextResponse } from 'next/server';
import { getCronSupabaseClient, getUserPreferencesMap, buildWellnessPlanMessage, validateCronRequest } from '@/lib/services/cron-utils';
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

    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth');

    if (error || !subscriptions?.length) {
      return NextResponse.json({ success: true, remindersSent: 0, message: 'No subscriptions' });
    }

    const userIds = [...new Set(subscriptions.map((s: any) => s.user_id))] as string[];

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
    let suppressedCount = 0;

    for (const userId of userIds) {
      const pref = prefMap.get(userId);

      // Check Master & Individual Wellness Plan preference
      if (pref && (pref.enabled === false || pref.wellnessPlan === false)) {
        suppressedCount++;
        continue;
      }

      const userTz = pref?.timezone || 'Asia/Kolkata';
      const localTime = getUserLocalTime(userTz, nowUtc);
      const { title, body } = buildWellnessPlanMessage();

      // 1. Persist to inbox
      await persistNotificationToDatabase(supabase, {
        userId,
        title,
        message: body,
        category: 'system',
        priority: 'normal',
        actionUrl: '/wellness-plan',
        actionLabel: 'View Plan',
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
              url: '/wellness-plan',
              actionLabel: 'View Plan',
              tag: `plan-ready-${localTime.dateStr}`,
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
      usersNotified: userIds.length,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}