import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/utils/supabase/server';
import { getVapidPublicKey } from '@/lib/services/web-push';

export async function GET(req: Request) {
  try {
    const { supabase, user } = await getAuthenticatedUser(req);

    const vapidPublicKey = getVapidPublicKey();
    const hasVapidPrivate = !!process.env.VAPID_PRIVATE_KEY;
    const hasVapidPublic = !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

    if (!user) {
      return NextResponse.json({
        status: 'not_logged_in',
        message: 'User is not authenticated. Please log in first.',
        vapidPublicKey,
        hasVapidPrivate,
        hasVapidPublic,
      });
    }

    // Get this user's push subscriptions
    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, user_agent, created_at')
      .eq('user_id', user.id);

    return NextResponse.json({
      status: subs && subs.length > 0 ? 'device_registered' : 'no_device_registered',
      userId: user.id,
      email: user.email,
      registeredDevices: subs ? subs.length : 0,
      devices: subs
        ? subs.map((s) => ({
            id: s.id,
            endpointShort: s.endpoint.substring(0, 60) + '...',
            pushService: s.endpoint.includes('fcm.googleapis') ? 'Google FCM (Android/Chrome)' :
                         s.endpoint.includes('push.apple') ? 'Apple APNs (iOS Safari PWA)' :
                         s.endpoint.includes('mozilla') ? 'Mozilla (Firefox)' : 'Unknown',
            userAgent: s.user_agent ? s.user_agent.substring(0, 80) + '...' : 'Unknown',
            registeredAt: s.created_at,
          }))
        : [],
      vapidPublicKey,
      hasVapidPrivate,
      hasVapidPublic,
      message: subs && subs.length > 0
        ? `✅ ${subs.length} device(s) registered. Ready to receive push notifications!`
        : '❌ No devices registered. Open Profile > Notifications > Enable Push on THIS device.',
      dbError: error ? error.message : null,
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: 'error', error: error.message },
      { status: 500 }
    );
  }
}
