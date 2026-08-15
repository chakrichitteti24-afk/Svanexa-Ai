import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { format } from 'date-fns';

type CheckinSlot = 'morning' | 'afternoon' | 'evening';
const VALID_SLOTS: CheckinSlot[] = ['morning', 'afternoon', 'evening'];
const SLOT_COIN_AMOUNT = 10;
const BONUS_COIN_AMOUNT = 10;

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;
    const today = format(new Date(), 'yyyy-MM-dd');
    const body = await req.json();
    const { slot, claimBonus } = body as { slot?: CheckinSlot; claimBonus?: boolean };

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
    const { data: checkinRow } = await supabase
      .from('daily_checkins')
      .select('id, summary')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle();

    let slotMeta: Record<string, any> = {};
    if (checkinRow?.summary) {
      try { slotMeta = JSON.parse(checkinRow.summary); } catch { slotMeta = {}; }
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

      const { data: rpcResult, error: rpcError } = await supabase.rpc('award_user_coins', {
        p_user_id: userId,
        p_amount: SLOT_COIN_AMOUNT,
        p_type: 'checkin_slot',
        p_ref_id: slotRef,
        p_description: `${slotCapName} check-in reward claimed`,
      });

      if (rpcError) {
        console.error('[claim RPC error]', rpcError);
        return NextResponse.json(
          { success: false, error: 'Failed to process your reward. Please try again.' },
          { status: 500 }
        );
      }

      const awarded: boolean = rpcResult?.awarded ?? false;
      const newBalance: number = rpcResult?.new_balance ?? 0;

      // If awarded, also mark as claimed inside slotMeta (for UI persistence without DB query)
      if (awarded && checkinRow?.id) {
        slotMeta[slot] = { ...slotMeta[slot], claimed: true };
        await supabase
          .from('daily_checkins')
          .update({ summary: JSON.stringify(slotMeta), updated_at: new Date().toISOString() })
          .eq('id', checkinRow.id);
      }

      // Check if already claimed (awarded = false but the ref_id exists → already claimed)
      const alreadyClaimed = !awarded;

      return NextResponse.json({
        success: true,
        data: {
          slot,
          awarded,
          alreadyClaimed,
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
      // All 3 slots must be completed
      const allComplete = VALID_SLOTS.every((s) => slotMeta[s]?.completed);
      if (!allComplete) {
        return NextResponse.json(
          { success: false, error: 'Complete all 3 daily check-ins first to claim the bonus.' },
          { status: 400 }
        );
      }

      // All 3 slots must be individually claimed before the bonus is available
      const allSlotsClaimed = VALID_SLOTS.every((s) => slotMeta[s]?.claimed);
      if (!allSlotsClaimed) {
        return NextResponse.json(
          { success: false, error: 'Claim your individual slot rewards first.' },
          { status: 400 }
        );
      }

      const bonusRef = `checkin:${today}:all_slots_bonus`;

      const { data: bonusRpcResult, error: bonusRpcError } = await supabase.rpc('award_user_coins', {
        p_user_id: userId,
        p_amount: BONUS_COIN_AMOUNT,
        p_type: 'checkin_all_bonus',
        p_ref_id: bonusRef,
        p_description: 'Daily bonus: All 3 check-ins completed and claimed!',
      });

      if (bonusRpcError) {
        console.error('[bonus claim RPC error]', bonusRpcError);
        return NextResponse.json(
          { success: false, error: 'Failed to process your bonus reward. Please try again.' },
          { status: 500 }
        );
      }

      const bonusAwarded: boolean = bonusRpcResult?.awarded ?? false;
      const newBalance: number = bonusRpcResult?.new_balance ?? 0;

      // Mark bonus claimed inside slotMeta
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
