import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { extractDateFromRequest } from '@/utils/date-utils';

type CheckinSlot = 'morning' | 'afternoon' | 'evening';

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;
    const today = extractDateFromRequest(req);

    // Read daily_checkins.summary which stores slot meta as JSON
    const { data: checkin } = await supabase
      .from('daily_checkins')
      .select('summary')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle();

    let slotMeta: Record<string, any> = {};
    if (checkin?.summary) {
      try {
        slotMeta = JSON.parse(checkin.summary);
      } catch {
        slotMeta = {};
      }
    }
    if (typeof slotMeta !== 'object' || slotMeta === null) slotMeta = {};

    const slotsMap: Record<CheckinSlot, { completed: boolean; completedAt: string | null; data: any }> = {
      morning:   { completed: false, completedAt: null, data: null },
      afternoon: { completed: false, completedAt: null, data: null },
      evening:   { completed: false, completedAt: null, data: null },
    };

    for (const slot of ['morning', 'afternoon', 'evening'] as CheckinSlot[]) {
      if (slotMeta[slot]?.completed) {
        slotsMap[slot] = {
          completed: true,
          completedAt: slotMeta[slot].completedAt ?? null,
          data: slotMeta[slot].data ?? null,
        };
      }
    }

    const allSlotsComplete = slotsMap.morning.completed && slotsMap.afternoon.completed && slotsMap.evening.completed;

    return NextResponse.json({
      success: true,
      data: {
        date: today,
        slots: slotsMap,
        allSlotsComplete,
      },
    });
  } catch (error: any) {
    console.error('[checkin-status GET error]', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
