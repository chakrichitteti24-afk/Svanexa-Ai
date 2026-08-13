import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { itemType, itemId } = body;

    if (!itemType || !itemId) {
      return NextResponse.json(
        { success: false, error: 'Missing itemType or itemId' },
        { status: 400 }
      );
    }

    const userId = user.id;

    // Check if default (free) or unlocked
    if (itemId !== 'default' && itemId !== 'minimal' && itemId !== 'friendly') {
      const { data: unlocked } = await supabase
        .from('user_unlocked_items')
        .select('id')
        .eq('user_id', userId)
        .eq('item_type', itemType)
        .eq('item_id', itemId)
        .maybeSingle();

      if (!unlocked) {
        return NextResponse.json(
          { success: false, error: 'Item is not unlocked' },
          { status: 403 }
        );
      }
    }

    // Update profile column
    const updatePayload: Record<string, string> = {};
    if (itemType === 'theme') updatePayload.active_theme = itemId;
    else if (itemType === 'dashboard_style') updatePayload.active_dashboard_style = itemId;
    else if (itemType === 'companion_style') updatePayload.active_companion_style = itemId;

    const { error } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', userId);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Active style updated successfully',
      itemType,
      itemId,
    });
  } catch (error: any) {
    console.error('[coins/active POST error]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
