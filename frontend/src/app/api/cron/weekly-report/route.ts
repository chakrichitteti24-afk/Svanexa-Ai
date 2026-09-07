import { NextResponse } from 'next/server';
import { format, subDays } from 'date-fns';
import { getCronSupabaseClient, getUserPreferencesMap, validateCronRequest } from '@/lib/services/cron-utils';
import { sendWebPush } from '@/lib/services/web-push';
import { getUserLocalTime, isNotificationAllowed, persistNotificationToDatabase } from '@/lib/services/notification-engine';

export const dynamic = 'force-dynamic';

function getWeeklyReportMessage(
  name: string,
  checkinCount: number,
  avgMood: number | null,
  avgEnergy: number | null,
  streak: number,
  isMonthly = false
): { title: string; body: string } {
  const period = isMonthly ? 'Monthly' : 'Weekly';
  const periodDays = isMonthly ? 30 : 7;

  if (checkinCount === 0) {
    return {
      title: `📊 Your ${period} Wellness Report is ready, ${name}!`,
      body: `You did not check in this ${isMonthly ? 'month' : 'week'} yet, but your report is waiting! Come back and start logging to unlock personalized Luna AI insights. Every day counts!`,
    };
  }

  const moodText = avgMood ? `average mood ${avgMood.toFixed(1)}/10` : '';
  const energyText = avgEnergy ? `energy ${avgEnergy.toFixed(1)}/10` : '';
  const statsText = [moodText, energyText].filter(Boolean).join(', ');
  const streakText = streak > 0 ? ` Current streak: ${streak} days!` : '';

  const encouragement =
    checkinCount >= periodDays * 0.8
      ? 'Outstanding consistency!'
      : checkinCount >= periodDays * 0.5
      ? 'Great progress this week!'
      : 'Every check-in matters!';

  return {
    title: `📊 Your ${period} Wellness Report is ready, ${name}!`,
    body: `${encouragement} This ${isMonthly ? 'month' : 'week'}: ${checkinCount} check-in(s)${statsText ? ', ' + statsText : ''}.${streakText} Tap to view your full insights.`,
  };
}

async function handleReport(req: Request, isMonthly = false) {
  try {
    const auth = validateCronRequest(req);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    const supabase = getCronSupabaseClient();
    const nowUtc = new Date();
    const todayStr = format(nowUtc, 'yyyy-MM-dd');

    // Date range: last 7 days or last 30 days
    const fromDate = format(subDays(nowUtc, isMonthly ? 30 : 7), 'yyyy-MM-dd');

    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth');

    if (error || !subscriptions?.length) {
      return NextResponse.json({ success: true, remindersSent: 0, message: 'No subscriptions' });
    }

    const userIds = [...new Set(subscriptions.map((s: any) => s.user_id))] as string[];

    // Fetch profiles & preferences in parallel
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

    // Get check-ins for the period
    const { data: checkins } = await supabase
      .from('daily_checkins')
      .select('user_id, date, summary')
      .in('user_id', userIds)
      .gte('date', fromDate)
      .lte('date', todayStr);

    // Aggregate per user
    const userStats = new Map<string, { count: number; moodSum: number; moodCount: number; energySum: number; energyCount: number }>();
    if (checkins) {
      for (const c of checkins) {
        const prev = userStats.get(c.user_id) || { count: 0, moodSum: 0, moodCount: 0, energySum: 0, energyCount: 0 };
        prev.count++;
        try {
          const s = typeof c.summary === 'string' ? JSON.parse(c.summary) : c.summary || {};
          if (typeof s.mood === 'number') { prev.moodSum += s.mood; prev.moodCount++; }
          if (typeof s.energy === 'number') { prev.energySum += s.energy; prev.energyCount++; }
        } catch {}
        userStats.set(c.user_id, prev);
      }
    }

    // Get streaks
    const streakMap = new Map<string, number>();
    try {
      const { data: streaks } = await supabase
        .from('wellness_streaks').select('user_id, current_streak').in('user_id', userIds);
      if (streaks) for (const s of streaks) streakMap.set(s.user_id, s.current_streak || 0);
    } catch {}

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

      // Check Master & Reports preference
      if (!isNotificationAllowed(pref, 'reports')) {
        suppressedCount++;
        continue;
      }

      const name = profileMap.get(userId) || 'there';
      const stats = userStats.get(userId) || { count: 0, moodSum: 0, moodCount: 0, energySum: 0, energyCount: 0 };
      const streak = streakMap.get(userId) || 0;
      const avgMood = stats.moodCount > 0 ? stats.moodSum / stats.moodCount : null;
      const avgEnergy = stats.energyCount > 0 ? stats.energySum / stats.energyCount : null;

      const userTz = pref?.timezone || 'Asia/Kolkata';
      const localTime = getUserLocalTime(userTz, nowUtc);
      const { title, body } = getWeeklyReportMessage(name, stats.count, avgMood, avgEnergy, streak, isMonthly);
      const tag = isMonthly ? `monthly-report-${localTime.dateStr}` : `weekly-report-${localTime.dateStr}`;
      const actionLabel = isMonthly ? 'See Monthly Report' : 'See Weekly Report';

      // 1. Persist to inbox
      await persistNotificationToDatabase(supabase, {
        userId,
        title,
        message: body,
        category: 'reports',
        priority: 'normal',
        actionUrl: '/reports',
        actionLabel,
        metadata: { isMonthly, count: stats.count, date: localTime.dateStr },
      });

      // 2. Dispatch push if enabled
      if (pref?.browserPush !== false) {
        for (const sub of (userSubMap.get(userId) || [])) {
          const r = await sendWebPush(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            { title, message: body, url: '/reports', actionLabel, tag, category: 'system' }
          );
          if (r.success) sentCount++;
          if (r.shouldDeleteSubscription) deadIds.push(sub.id);
        }
      }
    }

    if (deadIds.length > 0) await supabase.from('push_subscriptions').delete().in('id', deadIds);

    return NextResponse.json({
      success: true,
      type: isMonthly ? 'monthly' : 'weekly',
      remindersSent: sentCount,
      suppressedCount,
      usersNotified: userIds.length,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// Weekly report — called every Sunday
export async function GET(req: Request) {
  const url = new URL(req.url);
  const isMonthly = url.searchParams.get('type') === 'monthly';
  return handleReport(req, isMonthly);
}