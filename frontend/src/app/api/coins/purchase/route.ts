import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/utils/supabase/server';

// Authoritative server-side price catalog to prevent client-side price tampering
const STORE_ITEM_PRICES: Record<string, number> = {
  // Themes
  'theme:default': 0,
  'theme:lavender': 50,
  'theme:rose': 50,
  'theme:ocean': 50,
  'theme:midnight': 50,
  'theme:sage': 50,
  'theme:sunrise': 50,
  // Dashboard Styles
  'dashboard_style:minimal': 0,
  'dashboard_style:soft_glow': 40,
  'dashboard_style:nature': 40,
  'dashboard_style:calm': 40,
  'dashboard_style:rose_tint': 40,
  'dashboard_style:midnight': 40,
  // Companion Styles
  'companion_style:friendly': 0,
  'companion_style:empathetic': 30,
  'companion_style:motivational': 30,
  'companion_style:gentle': 30,
  'companion_style:joy': 30,
  'companion_style:poetic': 60,
  'companion_style:energizing': 60,
  'companion_style:mindful': 60,
  'companion_style:clinical': 60,
};

export async function POST(req: Request) {
  try {
    const { supabase, user, error: authError } = await getAuthenticatedUser(req);

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { itemType, itemId, itemName } = body;

    if (!itemType || !itemId || !itemName) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters: itemType, itemId, itemName' },
        { status: 400 }
      );
    }

    // Authoritative server-side price lookup
    const catalogKey = `${itemType}:${itemId}`;
    const authoritativeCost = STORE_ITEM_PRICES[catalogKey];

    if (authoritativeCost === undefined) {
      return NextResponse.json(
        { success: false, error: 'Invalid store item' },
        { status: 400 }
      );
    }

    const userId = user.id;

    // Call PostgreSQL RPC function for atomic purchase with server-verified cost
    const { data, error } = await supabase.rpc('purchase_store_item', {
      p_user_id: userId,
      p_item_type: itemType,
      p_item_id: itemId,
      p_cost: authoritativeCost,
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
