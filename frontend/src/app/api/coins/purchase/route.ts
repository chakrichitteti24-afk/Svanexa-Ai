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
    const { itemType, itemId, cost, itemName } = body;

    if (!itemType || !itemId || typeof cost !== 'number' || !itemName) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters: itemType, itemId, cost, itemName' },
        { status: 400 }
      );
    }

    if (cost < 0) {
      return NextResponse.json({ success: false, error: 'Invalid cost' }, { status: 400 });
    }

    const userId = user.id;

    // Call PostgreSQL RPC function for atomic purchase
    const { data, error } = await supabase.rpc('purchase_store_item', {
      p_user_id: userId,
      p_item_type: itemType,
      p_item_id: itemId,
      p_cost: cost,
      p_item_name: itemName,
    });

    if (error) {
      console.error('[purchase_store_item RPC error]', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!data.success) {
      return NextResponse.json(
        { success: false, error: data.error || 'Purchase failed', message: data.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: data.message,
      newBalance: data.new_balance,
      alreadyUnlocked: data.already_unlocked,
    });
  } catch (error: any) {
    console.error('[coins/purchase POST error]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
