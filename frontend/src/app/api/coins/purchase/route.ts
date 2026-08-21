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
  'companion_style:calm': 30,
  'companion_style:focus': 30,
  'companion_style:joy': 30,
  'companion_style:empathetic': 30,
  'companion_style:motivational': 30,
  'companion_style:gentle': 30,
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

    // 1. Try PostgreSQL RPC purchase_store_item
    try {
      const { data, error } = await supabase.rpc('purchase_store_item', {
        p_user_id: userId,
        p_item_type: itemType,
        p_item_id: itemId,
        p_cost: authoritativeCost,
        p_item_name: itemName,
      });

      if (!error && data) {
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
      }
    } catch (rpcErr) {
      console.warn('[purchase_store_item RPC fallback]', rpcErr);
    }

    // 2. Resilient Direct Table Operations Fallback
    try {
      // Check if item is already unlocked
      const { data: unlockedRow } = await supabase
        .from('user_unlocked_items')
        .select('id')
        .eq('user_id', userId)
        .eq('item_type', itemType)
        .eq('item_id', itemId)
        .limit(1)
        .maybeSingle();

      const { data: balRow } = await supabase
        .from('user_coin_balances')
        .select('balance')
        .eq('user_id', userId)
        .maybeSingle();

      const currentBalance = typeof balRow?.balance === 'number' ? balRow.balance : 0;

      if (unlockedRow) {
        return NextResponse.json({
          success: true,
          message: 'Item is already unlocked.',
          newBalance: currentBalance,
          alreadyUnlocked: true,
        });
      }

      if (currentBalance < authoritativeCost) {
        return NextResponse.json(
          {
            success: false,
            error: 'Insufficient coins',
            message: 'Keep checking in to earn more coins.',
            newBalance: currentBalance,
          },
          { status: 400 }
        );
      }

      // Deduct balance
      const newBalance = currentBalance - authoritativeCost;
      await supabase.from('user_coin_balances').upsert(
        {
          user_id: userId,
          balance: newBalance,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

      // Record transaction
      const refId = `store:${itemType}:${itemId}`;
      const { error: txErr } = await supabase.from('user_coin_transactions').insert({
        user_id: userId,
        amount: -authoritativeCost,
        transaction_type: 'store_purchase',
        reference_id: refId,
        description: `Unlocked ${itemName}`,
      });

      if (txErr) {
        await supabase.from('user_coin_transactions').insert({
          user_id: userId,
          amount: -authoritativeCost,
          type: 'store_purchase',
          reference_id: refId,
          description: `Unlocked ${itemName}`,
        });
      }

      // Record unlocked item
      await supabase.from('user_unlocked_items').upsert(
        {
          user_id: userId,
          item_type: itemType,
          item_id: itemId,
        },
        { onConflict: 'user_id,item_type,item_id' }
      );

      // Update active selection in profiles
      const profileUpdate: Record<string, string> = {};
      if (itemType === 'theme') profileUpdate.active_theme = itemId;
      else if (itemType === 'dashboard_style') profileUpdate.active_dashboard_style = itemId;
      else if (itemType === 'companion_style') profileUpdate.active_companion_style = itemId;

      if (Object.keys(profileUpdate).length > 0) {
        await supabase.from('profiles').update(profileUpdate).eq('id', userId);
      }

      return NextResponse.json({
        success: true,
        message: `${itemName} unlocked successfully!`,
        newBalance,
        alreadyUnlocked: false,
      });
    } catch (directErr: any) {
      console.error('[direct purchase fallback error]', directErr);
      return NextResponse.json(
        { success: false, error: directErr?.message || 'Purchase transaction failed' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('[coins/purchase POST error]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
