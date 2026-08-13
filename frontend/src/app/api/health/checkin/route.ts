import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { format } from 'date-fns';

type CheckinSlot = 'morning' | 'afternoon' | 'evening';
const VALID_SLOTS: CheckinSlot[] = ['morning', 'afternoon', 'evening'];

/**
 * Safe upsert: check if a row exists first (avoids relying on DB unique constraints).
 */
async function safeUpsert(
  supabase: any,
  table: string,
  match: Record<string, any>,
  payload: Record<string, any>
) {
  const { data: existing, error: selectErr } = await supabase
    .from(table)
    .select('id')
    .match(match)
    .maybeSingle();

  if (selectErr) throw new Error(`[${table}] select failed: ${selectErr.message}`);

  if (existing?.id) {
    const { error } = await supabase.from(table).update(payload).eq('id', existing.id);
    if (error) throw new Error(`[${table}] update failed: ${error.message}`);
  } else {
    const { error } = await supabase.from(table).insert({ ...match, ...payload });
    if (error) throw new Error(`[${table}] insert failed: ${error.message}`);
  }
}

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
    const { slot, data } = body;

    if (!slot || !VALID_SLOTS.includes(slot)) {
      return NextResponse.json(
        { success: false, error: 'Invalid slot. Must be morning, afternoon, or evening.' },
        { status: 400 }
      );
    }

    const completedAt = new Date().toISOString();

    // ── Save to dedicated log tables (safely) ──────────────────────────────────
    try {
      if (data?.averageScore) {
        const moodText = data.q1_feeling <= 2 ? 'relaxed' : data.q1_feeling === 3 ? 'neutral' : 'overwhelmed';
        await safeUpsert(supabase, 'mood_logs',
          { user_id: userId, date: today },
          { mood: moodText, intensity: Math.round(Number(data.averageScore) * 2) }
        );
      }
      if (data?.sleep) {
        await safeUpsert(supabase, 'sleep_logs',
          { user_id: userId, date: today },
          { duration_hours: Number(data.sleep) }
        );
      }
    } catch (granularErr) {
      console.warn("Skipping granular logs:", granularErr);
    }

    // We use the daily_checkins summary field to store slot completion state as JSON
    const { data: existing, error: fetchErr } = await supabase
      .from('daily_checkins')
      .select('id, summary')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle();

    let slotMeta: Record<string, any> = {};
    if (existing?.summary) {
      try { slotMeta = JSON.parse(existing.summary); } catch { slotMeta = {}; }
    }
    if (typeof slotMeta !== 'object' || slotMeta === null) slotMeta = {};

    // Store slot data inside slotMeta
    slotMeta[slot] = { completed: true, completedAt, data };

    const newSummary = JSON.stringify(slotMeta);

    if (existing?.id) {
      const { error } = await supabase
        .from('daily_checkins')
        .update({ summary: newSummary, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (error) throw new Error(`daily_checkins update failed: ${error.message}`);
    } else {
      const { error } = await supabase
        .from('daily_checkins')
        .insert({ user_id: userId, date: today, summary: newSummary });
      if (error) throw new Error(`daily_checkins insert failed: ${error.message}`);
    }

    // ── Determine completed slots ─────────────────────────────────────────────
    const completedSlots = Object.keys({ ...slotMeta }).filter(
      (k) => slotMeta[k]?.completed
    );
    const allSlotsComplete = VALID_SLOTS.every((s) => completedSlots.includes(s));

    // ── Award Coins (Idempotent via database reference_id) ───────────────────
    let coinsEarned = 0;
    let newBalance = 0;

    try {
      const slotRef = `checkin:${today}:${slot}`;
      const slotCapName = slot.charAt(0).toUpperCase() + slot.slice(1);
      
      const { data: slotCoinRes } = await supabase.rpc('award_user_coins', {
        p_user_id: userId,
        p_amount: 10,
        p_type: 'checkin_slot',
        p_ref_id: slotRef,
        p_description: `${slotCapName} check-in completed`,
      });

      if (slotCoinRes?.awarded) {
        coinsEarned += slotCoinRes.amount;
        newBalance = slotCoinRes.new_balance;
      } else {
        newBalance = slotCoinRes?.new_balance ?? 0;
      }

      // Bonus coins if all 3 slots completed today
      if (allSlotsComplete) {
        const bonusRef = `checkin:${today}:all_slots_bonus`;
        const { data: bonusCoinRes } = await supabase.rpc('award_user_coins', {
          p_user_id: userId,
          p_amount: 10,
          p_type: 'checkin_all_bonus',
          p_ref_id: bonusRef,
          p_description: 'Completed all 3 daily check-ins!',
        });

        if (bonusCoinRes?.awarded) {
          coinsEarned += bonusCoinRes.amount;
          newBalance = bonusCoinRes.new_balance;
        }
      }
    } catch (coinErr) {
      console.warn('Skipping coin RPC award:', coinErr);
    }

    return NextResponse.json({
      success: true,
      data: {
        slot,
        completedAt,
        allSlotsComplete,
        completedSlots,
        coinsEarned,
        newBalance,
        message: `${slot.charAt(0).toUpperCase() + slot.slice(1)} check-in saved successfully.${coinsEarned > 0 ? ` Earned +${coinsEarned} 🪙!` : ''}`,
      },
    }, { status: 201 });

  } catch (error: any) {
    console.error('[checkin POST error]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
