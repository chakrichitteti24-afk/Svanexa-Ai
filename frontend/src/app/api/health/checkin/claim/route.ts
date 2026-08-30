import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/utils/supabase/server';
import { extractDateFromRequest } from '@/utils/date-utils';

type CheckinSlot = 'morning' | 'afternoon' | 'evening';
const VALID_SLOTS: CheckinSlot[] = ['morning', 'afternoon', 'evening'];
const SLOT_COIN_AMOUNT = 10;
const BONUS_COIN_AMOUNT = 10;

async function awardCoinsHelper(
  supabase: any,
  userId: string,
  amount: number,
  type: string,
  refId: string,
  description: string
): Promise<{ awarded: boolean; newBalance: number }> {
  // 1. Check if already claimed / awarded
  try {
    const { data: existingTx } = await supabase
      .from('user_coin_transactions')
      .select('id')
      .eq('user_id', userId)
      .eq('reference_id', refId)
      .limit(1)
      .maybeSingle();

    if (existingTx) {
      const { data: balRow } = await supabase
        .from('user_coin_balances')
        .select('balance')
        .eq('user_id', userId)
        .maybeSingle();
      const currentBalance = typeof balRow?.balance === 'number' ? balRow.balance : 0;
      return { awarded: false, newBalance: currentBalance };
    }
  } catch (checkErr) {
    console.warn('[awardCoinsHelper check warning]', checkErr);
  }

  // 2. Try PostgreSQL RPC award_user_coins
  try {
    const { data: rpcResult, error: rpcError } = await supabase.rpc('award_user_coins', {
      p_user_id: userId,
      p_amount: amount,
      p_type: type,
      p_ref_id: refId,
      p_description: description,
    });

    if (!rpcError && rpcResult !== null && rpcResult !== undefined) {
      if (typeof rpcResult === 'object') {
        const parsedBalance = typeof rpcResult.new_balance === 'number' ? rpcResult.new_balance : Number(rpcResult.new_balance ?? 0);
        return { awarded: rpcResult.awarded !== false, newBalance: isNaN(parsedBalance) ? amount : parsedBalance };
      }
      const numBal = Number(rpcResult);
      return { awarded: true, newBalance: isNaN(numBal) ? amount : numBal };
    }
  } catch (rpcErr) {
    console.warn('[award_user_coins RPC fallback]', rpcErr);
  }

  // 3. Resilient Direct Table Operations Fallback
  try {
    const { data: curBal } = await supabase
      .from('user_coin_balances')
      .select('balance')
      .eq('user_id', userId)
      .maybeSingle();

    const currentBalance = typeof curBal?.balance === 'number' ? curBal.balance : 0;
    const newBalance = currentBalance + amount;

    await supabase.from('user_coin_balances').upsert(
      {
        user_id: userId,
        balance: newBalance,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

    // Try standard transaction_type column first, then fallback to type column
    const { error: txErr } = await supabase.from('user_coin_transactions').insert({
      user_id: userId,
      amount,
      transaction_type: type,
      reference_id: refId,
      description,
    });

    if (txErr) {
      await supabase.from('user_coin_transactions').insert({
        user_id: userId,
        amount,
        type,
        reference_id: refId,
        description,
      });
    }

    return { awarded: true, newBalance };
  } catch (directErr) {
    console.warn('[direct coin award fallback warning]', directErr);
    return { awarded: true, newBalance: amount };
  }
}

export async function POST(req: Request) {
  try {
    const { supabase, user, error: authError } = await getAuthenticatedUser(req);

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;
    const body = await req.json();
    const { slot, claimBonus, date: bodyDate } = body as { slot?: CheckinSlot; claimBonus?: boolean; date?: string };

    const serverToday = new Date().toISOString().split('T')[0];
    const today = serverToday; // Always use server date — never trust client-supplied date

    // Reject if client sent a different date (prevents re-claiming past slots)
    if (bodyDate && bodyDate !== serverToday) {
      return NextResponse.json(
        { success: false, error: 'Claims can only be made for today.' },
        { status: 400 }
      );
    }

    // ── Validation ────────────────────────────────────────────────────────────
    if (slot && !VALID_SLOTS.includes(slot)) {
      return NextResponse.json(
        { success: false, error: 'Invalid slot. Must be morning, afternoon, or evening.' },
        { status: 400 }
      );
    }

    if (!slot && !claimBonus) {
      return NextResponse.json(
        { success: false, error: 'Provide either { slot } or { claimBonus: true }' },
        { status: 400 }
      );
    }

    // ── Load today's check-in meta ─────────────────────────────────────────────
    const { data: checkinRows } = await supabase
      .from('daily_checkins')
      .select('id, summary')
      .eq('user_id', userId)
      .eq('date', today)
      .limit(1);

    const checkinRow = checkinRows && checkinRows.length > 0 ? checkinRows[0] : null;

    let slotMeta: Record<string, any> = {};
    if (checkinRow?.summary) {
      try {
        slotMeta = JSON.parse(checkinRow.summary);
      } catch {
        slotMeta = {};
      }
    }

    // ── Handle slot claim ─────────────────────────────────────────────────────
    if (slot) {
      if (!slotMeta[slot]?.completed) {
        return NextResponse.json(
          { success: false, error: `${slot} check-in has not been completed yet.` },
          { status: 400 }
        );
      }

      const slotRef = `checkin:${today}:${slot}`;
      const slotCapName = slot.charAt(0).toUpperCase() + slot.slice(1);

      const { awarded, newBalance } = await awardCoinsHelper(
        supabase,
        userId,
        SLOT_COIN_AMOUNT,
        'checkin_slot',
        slotRef,
        `${slotCapName} check-in reward claimed`
      );

      // Mark claimed in slotMeta
      if (awarded && checkinRow?.id) {
        slotMeta[slot] = { ...slotMeta[slot], claimed: true };
        await supabase
          .from('daily_checkins')
          .update({ summary: JSON.stringify(slotMeta), updated_at: new Date().toISOString() })
          .eq('id', checkinRow.id);
      }

      return NextResponse.json({
        success: true,
        data: {
          slot,
          awarded,
          alreadyClaimed: !awarded,
          coinsEarned: awarded ? SLOT_COIN_AMOUNT : 0,
          newBalance,
          message: awarded
            ? `+${SLOT_COIN_AMOUNT} coins claimed for your ${slotCapName} check-in! 🪙`
            : `${slotCapName} reward was already claimed.`,
        },
      });
    }

    // ── Handle daily bonus claim ──────────────────────────────────────────────
    if (claimBonus) {
      const allComplete = VALID_SLOTS.every((s) => slotMeta[s]?.completed);
      if (!allComplete) {
        return NextResponse.json(
          { success: false, error: 'Complete all 3 daily check-ins first to claim the bonus.' },
          { status: 400 }
        );
      }

      const bonusRef = `checkin:${today}:all_slots_bonus`;

      const { awarded: bonusAwarded, newBalance } = await awardCoinsHelper(
        supabase,
        userId,
        BONUS_COIN_AMOUNT,
        'checkin_all_bonus',
        bonusRef,
        'Daily bonus: All 3 check-ins completed and claimed!'
      );

      if (bonusAwarded && checkinRow?.id) {
        slotMeta['_bonusClaimed'] = true;
        await supabase
          .from('daily_checkins')
          .update({ summary: JSON.stringify(slotMeta), updated_at: new Date().toISOString() })
          .eq('id', checkinRow.id);
      }

      return NextResponse.json({
        success: true,
        data: {
          bonusAwarded,
          alreadyClaimed: !bonusAwarded,
          coinsEarned: bonusAwarded ? BONUS_COIN_AMOUNT : 0,
          newBalance,
          message: bonusAwarded
            ? `+${BONUS_COIN_AMOUNT} bonus coins for completing all daily check-ins! 🌟`
            : 'Daily bonus was already claimed.',
        },
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid request.' }, { status: 400 });

  } catch (error: any) {
    console.error('[checkin/claim POST error]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
