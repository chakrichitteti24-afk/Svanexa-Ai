import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { extractDateFromRequest } from '@/utils/date-utils';

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;
    const today = extractDateFromRequest(req);

    // ── Query the coin transactions table for today's reference IDs ─────────
    const { data: txRows } = await supabase
      .from('user_coin_transactions')
      .select('reference_id, amount')
      .eq('user_id', userId)
      .gte('created_at', `${today}T00:00:00.000Z`)
      .lt('created_at', `${today}T23:59:59.999Z`);

    const claimedRefs = new Set((txRows || []).map((t: any) => t.reference_id));

    const morningClaimed   = claimedRefs.has(`checkin:${today}:morning`);
    const afternoonClaimed = claimedRefs.has(`checkin:${today}:afternoon`);
    const eveningClaimed   = claimedRefs.has(`checkin:${today}:evening`);
    const bonusClaimed     = claimedRefs.has(`checkin:${today}:all_slots_bonus`);

    // ── Read today's check-in completion state ──────────────────────────
    const { data: checkinRow } = await supabase
      .from('daily_checkins')
      .select('summary')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle();

    let slotMeta: Record<string, any> = {};
    if (checkinRow?.summary) {
      try {
        slotMeta = JSON.parse(checkinRow.summary);
      } catch {
        slotMeta = {};
      }
    }

    const allSlotsComplete =
      slotMeta.morning?.completed &&
      slotMeta.afternoon?.completed &&
      slotMeta.evening?.completed;

    // All 3 must be claimed before bonus is available
    const bonusUnlocked = morningClaimed && afternoonClaimed && eveningClaimed;

    return NextResponse.json({
      success: true,
      data: {
        date: today,
        claimed: {
          morning:   morningClaimed,
          afternoon: afternoonClaimed,
          evening:   eveningClaimed,
          bonus:     bonusClaimed,
        },
        completed: {
          morning:   slotMeta.morning?.completed   ?? false,
          afternoon: slotMeta.afternoon?.completed ?? false,
          evening:   slotMeta.evening?.completed   ?? false,
        },
        allSlotsComplete: !!allSlotsComplete,
        bonusUnlocked,
      },
    });
  } catch (error: any) {
    console.error('[checkin/claim-status GET error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
