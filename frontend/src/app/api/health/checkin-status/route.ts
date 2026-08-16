import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/utils/supabase/server';
import { extractDateFromRequest } from '@/utils/date-utils';

type CheckinSlot = 'morning' | 'afternoon' | 'evening';

export async function GET(req: Request) {
  try {
    const { supabase, user } = await getAuthenticatedUser(req);

    const userId = user?.id || null;
    const today = extractDateFromRequest(req);


    if (!userId) {
      return NextResponse.json({
        success: true,
        data: {
          date: today,
          slots: {
            morning:   { completed: false, completedAt: null, data: null },
            afternoon: { completed: false, completedAt: null, data: null },
            evening:   { completed: false, completedAt: null, data: null },
          },
          allSlotsComplete: false,
          isGuest: true,
        },
      });
    }

    // Read daily_checkins.summary which stores slot meta as JSON
    const { data: checkinRows } = await supabase
      .from('daily_checkins')
      .select('summary')
      .eq('user_id', userId)
      .eq('date', today)
      .limit(1);

    const checkin = checkinRows && checkinRows.length > 0 ? checkinRows[0] : null;

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
