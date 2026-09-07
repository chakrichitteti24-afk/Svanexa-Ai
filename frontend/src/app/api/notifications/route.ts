import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { supabase, user } = await getAuthenticatedUser(req);

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const url = new URL(req.url);
    const category = url.searchParams.get('category');
    const unreadOnly = url.searchParams.get('unreadOnly') === 'true';
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));

    let query = supabase
      .from('notifications')
      .select('id, user_id, title, message, category, priority, action_url, action_label, read, dismissed, metadata, created_at')
      .eq('user_id', user.id)
      .eq('dismissed', false)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    if (unreadOnly) {
      query = query.eq('read', false);
    }

    const { data: notifications, error } = await query;

    if (error) {
      // If table does not exist yet, return gracefully with empty notifications
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json({
          success: true,
          notifications: [],
          unreadCount: 0,
          schemaMigrated: false,
        });
      }
      console.warn('Error fetching notifications:', error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const items = (notifications || []).map((n: any) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      category: n.category,
      priority: n.priority || 'normal',
      timestamp: n.created_at,
      read: Boolean(n.read),
      dismissed: Boolean(n.dismissed),
      actionUrl: n.action_url || undefined,
      actionLabel: n.action_label || undefined,
      metadata: n.metadata || {},
    }));

    const unreadCount = items.filter((n: any) => !n.read).length;

    return NextResponse.json({
      success: true,
      notifications: items,
      unreadCount,
      schemaMigrated: true,
    });
  } catch (error: any) {
    console.error('Error in GET /api/notifications:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const { supabase, user } = await getAuthenticatedUser(req);

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { id, ids, all, action = 'markRead' } = body;

    const now = new Date().toISOString();

    if (all) {
      if (action === 'dismiss') {
        await supabase
          .from('notifications')
          .update({ dismissed: true, updated_at: now })
          .eq('user_id', user.id);
      } else {
        // Mark all as read
        await supabase
          .from('notifications')
          .update({ read: true, updated_at: now })
          .eq('user_id', user.id)
          .eq('read', false);
      }
      return NextResponse.json({ success: true, message: 'All notifications updated' });
    }

    if (ids && Array.isArray(ids) && ids.length > 0) {
      const updates = action === 'dismiss' ? { dismissed: true, updated_at: now } : { read: true, updated_at: now };
      await supabase
        .from('notifications')
        .update(updates)
        .eq('user_id', user.id)
        .in('id', ids);

      return NextResponse.json({ success: true, count: ids.length });
    }

    if (id) {
      const updates: any = { updated_at: now };
      if (typeof body.read === 'boolean') updates.read = body.read;
      if (typeof body.dismissed === 'boolean') updates.dismissed = body.dismissed;
      if (action === 'dismiss') updates.dismissed = true;
      if (action === 'markRead') updates.read = true;

      const { error } = await supabase
        .from('notifications')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, id });
    }

    return NextResponse.json({ success: false, error: 'Invalid update payload' }, { status: 400 });
  } catch (error: any) {
    console.error('Error in PATCH /api/notifications:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update notification' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { supabase, user } = await getAuthenticatedUser(req);

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const dismissedOnly = url.searchParams.get('dismissedOnly') === 'true';

    if (id) {
      await supabase
        .from('notifications')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      return NextResponse.json({ success: true, deleted: id });
    }

    if (dismissedOnly) {
      await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id)
        .eq('dismissed', true);

      return NextResponse.json({ success: true, message: 'Cleared dismissed notifications' });
    }

    // Clear all
    await supabase
      .from('notifications')
      .delete()
      .eq('user_id', user.id);

    return NextResponse.json({ success: true, message: 'Cleared all notifications' });
  } catch (error: any) {
    console.error('Error in DELETE /api/notifications:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete notifications' },
      { status: 500 }
    );
  }
}
