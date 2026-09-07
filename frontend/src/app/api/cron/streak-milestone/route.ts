import { NextResponse } from 'next/server';
import { subDays, parseISO } from 'date-fns';
import { getCronSupabaseClient, getUserPreferencesMap, validateCronRequest } from '@/lib/services/cron-utils';
import { sendWebPush } from '@/lib/services/web-push';
import { getUserLocalTime, isNotificationAllowed, persistNotificationToDatabase } from '@/lib/services/notification-engine';

export const dynamic = 'force-dynamic';

const MILESTONE_DAYS = [3, 7, 14, 21, 30, 50, 75, 100];

function getMilestoneMessage(name: string, streak: number): { title: string; body: string } | null {
  if (!MILESTONE_DAYS.includes(streak)) return null;

  if (streak === 3) return {
    title: `🎉 3 days in a row, ${name}! You are building something beautiful`,
    body: `Three check-ins in a row! A habit is being born. Research shows it takes 21 days to form a habit — you are already 3 days in. Keep going, your body will thank you!`,
  };
  if (streak === 7) return {
    title: `🏆 One full week, ${name}! Luna is so proud of you`,
    body: `Seven days of check-ins! That is one complete week of caring for your body. Your wellness data is getting richer and your AI insights will be much more personal now.`,
  };
  if (streak === 14) return {
    title: `✨ 14 days strong, ${name}! You are halfway to a habit`,
    body: `Two weeks of consistency! You are halfway through building a true wellness habit. Open the app to see your latest health patterns.`,
  };
  if (streak === 21) return {
    title: `🌟 21 days, ${name}! The habit is officially formed!`,
    body: `Science says 21 days forms a habit — and you did it! You have now officially made wellness check-ins part of your daily life. Congratulations!`,
  };
  if (streak === 30) return {
    title: `🏅 30 DAYS, ${name}! Gold Wellness Status unlocked!`,
    body: `One full month of daily check-ins! You are in the top 5% of Svanexa users. Open the app to see your full 30-day health report.`,
  };
  if (streak === 50) return {
    title: `💫 50 days of wellness, ${name}! You are incredible!`,
    body: `Fifty days! That is almost 2 full months of caring for yourself every single day. Luna's insights about your health patterns are now deeply personalized.`,
  };
  if (streak === 75) return {
    title: `💎 75 days, ${name}! Diamond Wellness Status unlocked!`,
    body: `Seventy-five days of daily check-ins — extraordinary consistency! Svanexa is honored to be part of your journey.`,
  };
  if (streak === 100) return {
    title: `👑 100 DAYS, ${name}! You are a Wellness Legend!`,
    body: `ONE HUNDRED DAYS! You have logged your health every single day for 100 days. Your health data is a treasure. Congratulations from all of us!`,
  };
  return null;
}

function getStreakWarningMessage(name: string, streak: number): { title: string; body: string } {
  return {
    title: `🔥 ${name}, protect your ${streak}-day streak!`,
    body: `You haven't checked in yet today. Take 60 seconds before midnight to log how you feel and keep your streak alive!`,
  };
}

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

    // 1. Fetch profiles and preferences in parallel
    const [profilesRes, prefMap] = await Promise.all([
      supabase.from('profiles').select('id, username, first_name, last_name, notifications_enabled').in('id', userIds),
      getUserPreferencesMap(supabase, userIds),
    ]);

    const profileMap = new Map<string, string>();
    if (profilesRes.data) {
      for (const p of profilesRes.data) {
        profileMap.set(p.id, (p.first_name || (p.username && p.username !== 'User' ? p.username : 'there')));
      }
    }

    // 2. Fetch current streaks
    const { data: streaks } = await supabase
      .from('wellness_streaks')
      .select('user_id, current_streak, longest_streak')
      .in('user_id', userIds);

    const streakMap = new Map<string, { current: number; longest: number }>();
    if (streaks) {
      for (const s of streaks) {
        streakMap.set(s.user_id, { current: s.current_streak || 0, longest: s.longest_streak || 0 });
      }
    }

    // 3. Fetch checkins from past 3 days to verify checkin status in any timezone
    const threeDaysAgo = subDays(nowUtc, 3).toISOString().slice(0, 10);
    const { data: recentCheckins } = await supabase
      .from('daily_checkins')
      .select('user_id, date')
      .in('user_id', userIds)
      .gte('date', threeDaysAgo);

    const userCheckinDates = new Map<string, Set<string>>();
    if (recentCheckins) {
      for (const c of recentCheckins) {
        let set = userCheckinDates.get(c.user_id);
        if (!set) {
          set = new Set();
          userCheckinDates.set(c.user_id, set);
        }
        set.add(c.date);
      }
    }

    const userSubMap = new Map<string, any[]>();
    for (const s of subscriptions) {
      const l = userSubMap.get(s.user_id) || [];
      l.push(s);
      userSubMap.set(s.user_id, l);
    }

    const deadIds: string[] = [];
    let milestoneSent = 0;
    let warningSent = 0;

    for (const userId of userIds) {
      const pref = prefMap.get(userId);
      if (!isNotificationAllowed(pref, 'rewards') || !isNotificationAllowed(pref, 'system')) {
        continue;
      }

      const name = profileMap.get(userId) || 'there';
      const streakData = streakMap.get(userId) || { current: 0, longest: 0 };
      const subs = userSubMap.get(userId) || [];

      const userTz = pref?.timezone || 'Asia/Kolkata';
      const localTime = getUserLocalTime(userTz, nowUtc);
      const userDates = userCheckinDates.get(userId) || new Set();

      const checkedInToday = userDates.has(localTime.dateStr);

      // Case A: User checked in today and reached a streak milestone
      if (checkedInToday) {
        const msg = getMilestoneMessage(name, streakData.current);
        if (msg) {
          await persistNotificationToDatabase(supabase, {
            userId,
            title: msg.title,
            message: msg.body,
            category: 'rewards',
            priority: 'high',
            actionUrl: '/dashboard',
            actionLabel: 'See My Progress',
            metadata: { milestone: streakData.current },
          });

          if (pref?.browserPush !== false) {
            for (const sub of subs) {
              const r = await sendWebPush(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                {
                  title: msg.title,
                  message: msg.body,
                  url: '/dashboard',
                  actionLabel: 'See My Progress',
                  tag: `streak-milestone-${streakData.current}-${localTime.dateStr}`,
                  category: 'system',
                }
              );
              if (r.success) milestoneSent++;
              if (r.shouldDeleteSubscription) deadIds.push(sub.id);
            }
          }
        }
        continue;
      }

      // Case B: User has NOT checked in yet today, but has an active streak (streak >= 2),
      // and it's late evening (local hour >= 20) -> send streak protection warning
      if (!checkedInToday && streakData.current >= 2 && localTime.hour >= 20) {
        const msg = getStreakWarningMessage(name, streakData.current);

        await persistNotificationToDatabase(supabase, {
          userId,
          title: msg.title,
          message: msg.body,
          category: 'checkin',
          priority: 'high',
          actionUrl: '/check-in',
          actionLabel: 'Protect Streak',
          metadata: { streak: streakData.current },
        });

        if (pref?.browserPush !== false) {
          for (const sub of subs) {
            const r = await sendWebPush(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              {
                title: msg.title,
                message: msg.body,
                url: '/check-in',
                actionLabel: 'Protect Streak',
                tag: `streak-warning-${localTime.dateStr}`,
                category: 'checkin',
              }
            );
            if (r.success) warningSent++;
            if (r.shouldDeleteSubscription) deadIds.push(sub.id);
          }
        }
      }
    }

    if (deadIds.length > 0) {
      await supabase.from('push_subscriptions').delete().in('id', deadIds);
    }

    return NextResponse.json({
      success: true,
      milestoneSent,
      warningSent,
      totalSent: milestoneSent + warningSent,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}