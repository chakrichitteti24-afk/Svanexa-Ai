import { NextResponse } from 'next/server';
import { format, subDays } from 'date-fns';
import { getCronSupabaseClient } from '@/lib/services/cron-utils';
import { sendWebPush } from '@/lib/services/web-push';

export const dynamic = 'force-dynamic';

const MILESTONE_DAYS = [3, 7, 14, 21, 30, 50, 75, 100];

function getMilestoneMessage(name: string, streak: number): { title: string; body: string } | null {
  if (!MILESTONE_DAYS.includes(streak)) return null;

  if (streak === 3) return {
    title: `3 days in a row, ${name}! You are building something beautiful`,
    body: `Three check-ins in a row! A habit is being born. Research shows it takes 21 days to form a habit — you are already 3 days in. Keep going, your body will thank you`,
  };
  if (streak === 7) return {
    title: `One full week, ${name}! Luna is so proud of you`,
    body: `Seven days of check-ins! That is one complete week of caring for your body. Your wellness data is already getting richer and your AI insights will be much more personal now`,
  };
  if (streak === 14) return {
    title: `14 days strong, ${name}! You are halfway to a habit`,
    body: `Two weeks of consistency! You are halfway through building a true wellness habit. Luna has noticed patterns in your data — open the app to see what she discovered`,
  };
  if (streak === 21) return {
    title: `21 days, ${name}! The habit is officially formed!`,
    body: `Science says 21 days forms a habit — and you did it! You have now officially made wellness check-ins part of your daily life. This is such a huge milestone`,
  };
  if (streak === 30) return {
    title: `30 DAYS, ${name}! You have unlocked the Gold Wellness Badge!`,
    body: `One full month of daily check-ins! You are in the top 5% of Svanexa users. Luna has so much rich data about your cycle, mood, and energy now. Open the app to see your full 30-day report`,
  };
  if (streak === 50) return {
    title: `50 days of wellness, ${name}! You are incredible!`,
    body: `Fifty days! That is almost 2 full months of caring for yourself every single day. You are a true wellness champion and Luna's insights about your health patterns are now deeply personalised`,
  };
  if (streak === 75) return {
    title: `75 days, ${name}! Diamond Wellness Status unlocked!`,
    body: `Seventy-five days of daily check-ins — you are extraordinary! Most people give up in week one. You have transformed tracking your health into a beautiful daily ritual. Svanexa is honoured to be part of your journey`,
  };
  if (streak === 100) return {
    title: `100 DAYS, ${name}! You are a Wellness Legend!`,
    body: `ONE HUNDRED DAYS! This is the most incredible milestone on Svanexa. You have logged your health every single day for 100 days. Luna now knows your body deeply. Your health data is a treasure. Congratulations from all of us`,
  };
  return null;
}

function getStreakBrokenMessage(name: string, lostStreak: number): { title: string; body: string } {
  if (lostStreak >= 30) return {
    title: `${name}, your ${lostStreak}-day streak ended — but you are still amazing`,
    body: `Your incredible ${lostStreak}-day streak ended, and that is okay. You should be SO proud of what you built. Today is a fresh start — jump back in and begin your next great streak. Luna never forgets your history`,
  };
  if (lostStreak >= 7) return {
    title: `${name}, your ${lostStreak}-day streak ended — restart today!`,
    body: `Your ${lostStreak}-day streak ended but that is perfectly okay! Life happens. The important thing is getting back on track. Log today and start a brand new streak. You have done it before and you can do it again`,
  };
  return {
    title: `${name}, missed yesterday? No worries — restart now!`,
    body: `Your ${lostStreak}-day streak ended but every single day is a fresh opportunity. Come on, log today and start again. Progress is not always linear and Svanexa is always here for you`,
  };
}

export async function GET(req: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get('authorization');
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getCronSupabaseClient();
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const yesterdayStr = format(subDays(today, 1), 'yyyy-MM-dd');

    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth');

    if (error || !subscriptions?.length) {
      return NextResponse.json({ success: true, remindersSent: 0, message: 'No subscriptions' });
    }

    const userIds = [...new Set(subscriptions.map((s: any) => s.user_id))];

    // Get profiles
    const profileMap = new Map<string, string>();
    try {
      const { data: profiles } = await supabase
        .from('profiles').select('id, username, first_name, last_name').in('id', userIds);
      if (profiles) {
        for (const p of profiles) {
          profileMap.set(p.id, (p.username && p.username !== 'User' ? p.username : p.first_name) || 'there');
        }
      }
    } catch {}

    // Get current streaks
    const { data: streaks } = await supabase
      .from('wellness_streaks').select('user_id, current_streak, longest_streak').in('user_id', userIds);

    const streakMap = new Map<string, { current: number; longest: number }>();
    if (streaks) {
      for (const s of streaks) streakMap.set(s.user_id, { current: s.current_streak || 0, longest: s.longest_streak || 0 });
    }

    // Check who checked in today and who didn't (to detect broken streaks)
    const { data: todayCheckins } = await supabase
      .from('daily_checkins').select('user_id').in('user_id', userIds).eq('date', todayStr);
    const checkedInToday = new Set((todayCheckins || []).map((c: any) => c.user_id));

    // Check yesterday's checkins (to find streak that just broke)
    const { data: yesterdayCheckins } = await supabase
      .from('daily_checkins').select('user_id').in('user_id', userIds).eq('date', yesterdayStr);
    const checkedInYesterday = new Set((yesterdayCheckins || []).map((c: any) => c.user_id));

    const userSubMap = new Map<string, any[]>();
    for (const s of subscriptions) {
      const l = userSubMap.get(s.user_id) || [];
      l.push(s); userSubMap.set(s.user_id, l);
    }

    const deadIds: string[] = [];
    let milestoneSent = 0;
    let brokenSent = 0;

    for (const userId of userIds) {
      const name = profileMap.get(userId) || 'there';
      const streakData = streakMap.get(userId) || { current: 0, longest: 0 };
      const subs = userSubMap.get(userId) || [];

      // 1. Check for milestone (user checked in today and streak hit a milestone)
      if (checkedInToday.has(userId)) {
        const msg = getMilestoneMessage(name, streakData.current);
        if (msg) {
          for (const sub of subs) {
            const r = await sendWebPush(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              { title: msg.title, message: msg.body, url: '/dashboard', actionLabel: 'See My Progress', tag: `streak-milestone-${streakData.current}`, category: 'system' }
            );
            if (r.success) milestoneSent++;
            if (r.shouldDeleteSubscription) deadIds.push(sub.id);
          }
        }
        continue; // skip broken check if checked in today
      }

      // 2. Check for broken streak (checked in yesterday but not today, had streak >= 2)
      if (checkedInYesterday.has(userId) && streakData.longest >= 2) {
        const lostStreak = streakData.longest;
        if (lostStreak >= 2) {
          const msg = getStreakBrokenMessage(name, lostStreak);
          for (const sub of subs) {
            const r = await sendWebPush(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              { title: msg.title, message: msg.body, url: '/check-in', actionLabel: 'Restart My Streak', tag: 'streak-broken', category: 'checkin' }
            );
            if (r.success) brokenSent++;
            if (r.shouldDeleteSubscription) deadIds.push(sub.id);
          }
        }
      }
    }

    if (deadIds.length > 0) await supabase.from('push_subscriptions').delete().in('id', deadIds);

    return NextResponse.json({
      success: true,
      date: todayStr,
      milestoneSent,
      brokenSent,
      totalSent: milestoneSent + brokenSent,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}