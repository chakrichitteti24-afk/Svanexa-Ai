import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/utils/supabase/server';

export async function POST(req: Request) {
  try {
    const { supabase, user } = await getAuthenticatedUser(req);

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { endpoint } = body;

    if (!endpoint) {
      return NextResponse.json(
        { success: false, error: 'Endpoint is required to unsubscribe' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user.id)
      .eq('endpoint', endpoint);

    if (error) {
      console.warn('Error deleting push subscription:', error.message);
    }

    return NextResponse.json({
      success: true,
      message: 'Push subscription removed successfully',
    });
  } catch (error: any) {
    console.error('Error in /api/notifications/unsubscribe:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to remove subscription' },
      { status: 500 }
    );
  }
}
