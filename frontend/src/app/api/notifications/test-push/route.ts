import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/utils/supabase/server';
import { sendWebPush, generateCheckinReminderPayload } from '@/lib/services/web-push';

export async function POST(req: Request) {
  try {
    const { supabase, user } = await getAuthenticatedUser(req);

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required to test push notifications. Please log in first.' },
        { status: 401 }
      );
    }

    // Parse options from body or query
    let delaySeconds = 0;
    let reminderType: 'checkin' | 'system' = 'checkin';
    let slot: 'morning' | 'afternoon' | 'evening' | 'streak' = 'morning';

    try {
      const body = await req.json();
      if (typeof body.delaySeconds === 'number') {
        delaySeconds = Math.max(0, body.delaySeconds);
      }
      if (body.type) reminderType = body.type;
      if (body.slot) slot = body.slot;
    } catch {
      const url = new URL(req.url);
      const qDelay = url.searchParams.get('delay');
      if (qDelay) delaySeconds = parseInt(qDelay, 10) || 0;
    }

    // Get user profile for personalized name
    let name = 'there';
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.username && profile.username !== 'User') {
        name = profile.username;
      } else if (profile?.full_name) {
        name = profile.full_name;
      }
    } catch {}

    // Retrieve active push subscriptions for this user
    const { data: subscriptions, error: fetchErr } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', user.id);

    if (fetchErr) {
      console.error('Error fetching push subscriptions:', fetchErr);
      return NextResponse.json({ success: false, error: fetchErr.message }, { status: 500 });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'NO_DEVICE_REGISTERED',
        deviceCount: 0,
        message:
          '❌ This phone is not registered yet.\n\n' +
          'To fix this:\n' +
          '1. Stay on this page (Profile → Notifications)\n' +
          '2. Tap the purple "Register This Phone" button\n' +
          '3. Tap "Allow" when browser asks for permission\n' +
          '4. Wait for the badge to show "Registered ✅"\n' +
          '5. Then tap "Send Phone Push Alert" again',
      });
    }

    const payload =
      reminderType === 'checkin'
        ? generateCheckinReminderPayload(name, slot, 0)
        : {
            title: '✨ Svanexa AI Phone Alert',
            message: `Hello ${name}! Background push notifications are active and working on your device.`,
            url: '/dashboard',
            actionUrl: '/dashboard',
            actionLabel: 'Open Svanexa',
            tag: 'test-push-notification',
            category: 'system' as const,
          };

    // NOTE: setTimeout does NOT work on serverless (Vercel/Edge) because the function
    // terminates after the response is returned. Delayed pushes are handled client-side
    // via the Service Worker scheduler. Here we always send immediately from the server.
    if (delaySeconds > 0) {
      // Send immediately — the client's Service Worker handles the visual delay
      const immediateResults = [];
      const deadIds: string[] = [];

      for (const sub of subscriptions) {
        const pushResult = await sendWebPush(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        immediateResults.push({ id: sub.id, success: pushResult.success, statusCode: pushResult.statusCode, error: pushResult.error });
        if (pushResult.shouldDeleteSubscription) deadIds.push(sub.id);
      }

      if (deadIds.length > 0) {
        await supabase.from('push_subscriptions').delete().in('id', deadIds);
      }

      const successCount = immediateResults.filter((r) => r.success).length;
      const delayMinutes = Math.round(delaySeconds / 60);
      const timeLabel = delaySeconds >= 60 ? `${delayMinutes} minute(s)` : `${delaySeconds} seconds`;

      return NextResponse.json({
        success: successCount > 0,
        scheduled: true,
        delaySeconds,
        totalDevices: subscriptions.length,
        sentCount: successCount,
        message:
          successCount > 0
            ? `✅ Push dispatched to ${successCount} device(s). Note: server-side delay scheduling is handled by the Service Worker on your device.`
            : `Failed to send push. Error: ${immediateResults[0]?.error || 'Push service rejected'}`,
      });
    }

    // Immediate dispatch
    const results = [];
    const deadSubIds: string[] = [];

    for (const sub of subscriptions) {
      const pushResult = await sendWebPush(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        payload
      );

      results.push({
        id: sub.id,
        success: pushResult.success,
        statusCode: pushResult.statusCode,
        error: pushResult.error,
      });

      if (pushResult.shouldDeleteSubscription) {
        deadSubIds.push(sub.id);
      }
    }

    // Cleanup expired subscriptions
    if (deadSubIds.length > 0) {
      await supabase.from('push_subscriptions').delete().in('id', deadSubIds);
    }

    const successCount = results.filter((r) => r.success).length;

    return NextResponse.json({
      success: successCount > 0,
      sentCount: successCount,
      totalDevices: subscriptions.length,
      results,
      message:
        successCount > 0
          ? `✅ Health reminder dispatched to ${successCount} device(s). Check your phone lock screen / notification tray!`
          : `Failed to send push notification. Error: ${results[0]?.error || 'Push service rejected'}`,
    });
  } catch (error: any) {
    console.error('Error in /api/notifications/test-push:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to dispatch test push' },
      { status: 500 }
    );
  }
}
