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

    // ── Save to dedicated log tables ──────────────────────────────────────────
    try {
      if (slot === 'morning') {
        // Map new conversational fields
        await safeUpsert(supabase, 'mood_logs',
          { user_id: userId, date: today },
          { mood: data.mood || 'calm', intensity: data.energy === 'Very Low' ? 2 : data.energy === 'Excellent' ? 9 : 5 }
        );
        if (data.sleep) {
          await safeUpsert(supabase, 'sleep_logs',
            { user_id: userId, date: today },
            { duration_hours: data.sleep }
          );
        }
      } else if (slot === 'afternoon') {
        if (data.water_so_far) {
          await safeUpsert(supabase, 'water_logs',
            { user_id: userId, date: today },
            { amount_ml: Math.round(parseFloat(data.water_so_far) * 1000) }
          );
        }
        if (data.exercise === 'yes') {
          await safeUpsert(supabase, 'exercise_logs',
            { user_id: userId, date: today },
            { duration_minutes: 30, type: 'General' }
          );
        }
      } else if (slot === 'evening') {
        if (data.total_water) {
          await safeUpsert(supabase, 'water_logs',
            { user_id: userId, date: today },
            { amount_ml: Math.round(parseFloat(data.total_water) * 1000) }
          );
        }
        if (data.health_rating) {
          await safeUpsert(supabase, 'skin_logs',
            { user_id: userId, date: today },
            { condition: String(data.health_rating * 2), notes: data.reflection ?? '' }
          );
        }
      }
    } catch (granularErr) {
      console.warn("Skipping granular logs (tables may be missing):", granularErr);
    }

    // ── Upsert daily_checkins with slot meta stored as JSONB in summary ───────
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

    return NextResponse.json({
      success: true,
      data: {
        slot,
        completedAt,
        allSlotsComplete,
        completedSlots,
        message: `${slot.charAt(0).toUpperCase() + slot.slice(1)} check-in saved successfully.`,
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
