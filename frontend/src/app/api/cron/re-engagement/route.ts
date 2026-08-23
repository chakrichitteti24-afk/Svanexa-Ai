import { NextResponse } from 'next/server';
import { format, subDays, differenceInDays, parseISO } from 'date-fns';
import { getCronSupabaseClient } from '@/lib/services/cron-utils';
import { sendWebPush } from '@/lib/services/web-push';

export const dynamic = 'force-dynamic';

function getReEngagementMessage(name: string, daysSince: number): { title: string; body: string } {
  if (daysSince >= 14) {
    return {
      title: `We miss you, ${name}! Come back to Svanexa`,
      body: `It has been ${daysSince} days since you last checked in. Luna has been saving your insights and waiting to share new patterns about your health. Your wellness journey is still here, come back anytime`,
    };
  }
  if (daysSince >= 5) {
    return {
      title: `${name}, your health matters every day`,
      body: `You have not checked in for ${daysSince} days. Life gets busy, we totally understand! But even a 60-second log helps Svanexa give you better care. Come back today, no pressure`,
    };
  }
  return {
    title: `Hey ${name}, we have been thinking about you!`,
    body: `You missed your check-in yesterday. No worries at all! Come on back today and log how you are feeling. Every day of data makes your AI health insights smarter and more personal`,
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

    // Get all push subscriptions
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

    // Get each user's most recent check-in date
    const { data: recentCheckins } = await supabase
      .from('daily_checkins')
      .select('user_id, date')
      .in('user_id', userIds)
      .order('date', { ascending: false });

    // Build map: userId -> most recent checkin date
    const lastCheckinMap = new Map<string, string>();
    if (recentCheckins) {
      for (const c of recentCheckins) {
        if (!lastCheckinMap.has(c.user_id)) {
          lastCheckinMap.set(c.user_id, c.date);
        }
      }
    }

    const userSubMap = new Map<string, any[]>();
    for (const s of subscriptions) {
      const l = userSubMap.get(s.user_id) || [];
      l.push(s); userSubMap.set(s.user_id, l);
    }

    const deadIds: string[] = [];
    let sentCount = 0;
    const MILESTONES = [2, 5, 14]; // days of inactivity to send notification

    for (const userId of userIds) {
      const lastDateStr = lastCheckinMap.get(userId);

      // If user checked in today, skip
      if (lastDateStr === todayStr) continue;

      let daysSince = 99;
      if (lastDateStr) {
        daysSince = differenceInDays(today, parseISO(lastDateStr));
      }

      // Only send on specific milestone days (2, 5, 14) to avoid spamming
      if (!MILESTONES.includes(daysSince)) continue;

      const name = profileMap.get(userId) || 'there';
      const { title, body } = getReEngagementMessage(name, daysSince);

      for (const sub of (userSubMap.get(userId) || [])) {
        const r = await sendWebPush(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          { title, message: body, url: '/check-in', actionLabel: 'Log Check-In Now', tag: 're-engagement', category: 'checkin' }
        );
        if (r.success) sentCount++;
        if (r.shouldDeleteSubscription) deadIds.push(sub.id);
      }
    }

    if (deadIds.length > 0) await supabase.from('push_subscriptions').delete().in('id', deadIds);

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