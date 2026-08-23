import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/utils/supabase/server';
import { sendWebPush } from '@/lib/services/web-push';

export async function POST(req: Request) {
  try {
    const { supabase, user } = await getAuthenticatedUser(req);

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required to test push notifications' },
        { status: 401 }
      );
    }

    // Get user profile for personalized name
    let name = 'Wellness Explorer';
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

    const testPayload = {
      title: '✨ Svanexa AI Phone Alert',
      message: `Hello ${name}! Background push notifications are active and working on your device.`,
      url: '/dashboard',
      actionUrl: '/dashboard',
      actionLabel: 'Open Svanexa',
      tag: 'test-push-notification',
      category: 'system' as const,
    };

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
        testPayload
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
          ? `Test alert dispatched to ${successCount} device(s). Check your phone lock screen / notification tray!`
          : 'Failed to send push notification to registered devices.',
    });
  } catch (error: any) {
    console.error('Error in /api/notifications/test-push:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to dispatch test push' },
      { status: 500 }
    );
  }
}
