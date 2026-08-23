import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/utils/supabase/server';

export async function POST(req: Request) {
  try {
    const { supabase, user } = await getAuthenticatedUser(req);

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required to subscribe to push notifications' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { endpoint, keys, userAgent } = body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json(
        { success: false, error: 'Invalid push subscription payload. Endpoint and keys are required.' },
        { status: 400 }
      );
    }

    const ua = userAgent || req.headers.get('user-agent') || 'Unknown Device';

    // Upsert subscription into push_subscriptions table
    const { data: existing, error: selectErr } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('endpoint', endpoint)
      .limit(1);

    if (selectErr && selectErr.code !== 'PGRST116') {
      console.warn('Push subscription select warning:', selectErr.message);
    }

    const existingId = existing && existing.length > 0 ? existing[0].id : null;

    if (existingId) {
      const { error: updateErr } = await supabase
        .from('push_subscriptions')
        .update({
          user_id: user.id,
          p256dh: keys.p256dh,
          auth: keys.auth,
          user_agent: ua,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingId);

      if (updateErr) {
        console.error('Error updating push subscription:', updateErr);
        return NextResponse.json({ success: false, error: updateErr.message }, { status: 500 });
      }
    } else {
      const { error: insertErr } = await supabase
        .from('push_subscriptions')
        .insert({
          user_id: user.id,
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          user_agent: ua,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (insertErr) {
        // Fallback update on conflict
        const { error: fallbackErr } = await supabase
          .from('push_subscriptions')
          .update({
            user_id: user.id,
            p256dh: keys.p256dh,
            auth: keys.auth,
            user_agent: ua,
            updated_at: new Date().toISOString(),
          })
          .eq('endpoint', endpoint);

        if (fallbackErr) {
          console.error('Error saving push subscription:', fallbackErr);
          return NextResponse.json({ success: false, error: fallbackErr.message }, { status: 500 });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Device registered for background push notifications successfully.',
    });
  } catch (error: any) {
    console.error('Error in /api/notifications/subscribe:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to process subscription' },
      { status: 500 }
    );
  }
}
