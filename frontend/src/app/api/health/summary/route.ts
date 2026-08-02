import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { format } from 'date-fns';

type CheckinSlot = 'morning' | 'afternoon' | 'evening';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;
    const today = format(new Date(), 'yyyy-MM-dd');

    const [
      { data: profile },
      { data: prefs },
      { data: todayCheckin },
      { data: checkins },
      { data: cycles },
      { data: preg },
      { data: sleep },
      { data: water },
      { data: mood },
      { data: exercise },
      { data: todayPlan }
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('user_preferences').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('daily_checkins').select('summary').eq('user_id', userId).eq('date', today).maybeSingle(),
      supabase.from('daily_checkins').select('date').eq('user_id', userId).order('date', { ascending: false }).limit(365),
      supabase.from('cycle_logs').select('*').eq('user_id', userId).order('start_date', { ascending: false }).limit(1),
      supabase.from('pregnancy_logs').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('sleep_logs').select('*').eq('user_id', userId).eq('date', today).maybeSingle(),
      supabase.from('water_logs').select('*').eq('user_id', userId).eq('date', today).maybeSingle(),
      supabase.from('mood_logs').select('*').eq('user_id', userId).eq('date', today).maybeSingle(),
      supabase.from('exercise_logs').select('*').eq('user_id', userId).eq('date', today).maybeSingle(),
      supabase.from('wellness_plans').select('content').eq('user_id', userId).eq('title', today).maybeSingle(),
    ]);

    let wellness_tasks = [];
    if (todayPlan?.content) {
      try { wellness_tasks = JSON.parse(todayPlan.content); } catch { wellness_tasks = []; }
    }

    // Parse slot meta from daily_checkins.summary
    let slotMeta: Record<string, any> = {};
    if (todayCheckin?.summary) {
      try { slotMeta = JSON.parse(todayCheckin.summary); } catch { slotMeta = {}; }
    }
    if (typeof slotMeta !== 'object' || slotMeta === null) slotMeta = {};

    const slotsMap: Record<CheckinSlot, { completed: boolean; completedAt: string | null }> = {
      morning:   { completed: !!slotMeta.morning?.completed, completedAt: slotMeta.morning?.completedAt ?? null },
      afternoon: { completed: !!slotMeta.afternoon?.completed, completedAt: slotMeta.afternoon?.completedAt ?? null },
      evening:   { completed: !!slotMeta.evening?.completed, completedAt: slotMeta.evening?.completedAt ?? null },
    };

    const allSlotsComplete = slotsMap.morning.completed && slotsMap.afternoon.completed && slotsMap.evening.completed;

    // Calculate streak
    let currentStreak = 0;
    if (checkins && checkins.length > 0) {
      const sortedDates = checkins.map(c => c.date);
      const d = new Date(); d.setHours(0, 0, 0, 0);
      const last = new Date(sortedDates[0]); last.setHours(0, 0, 0, 0);
      const diff = Math.floor((d.getTime() - last.getTime()) / 86400000);
      if (diff <= 1) {
        currentStreak = 1;
        for (let i = 0; i < sortedDates.length - 1; i++) {
          const d1 = new Date(sortedDates[i]); d1.setHours(0, 0, 0, 0);
          const d2 = new Date(sortedDates[i + 1]); d2.setHours(0, 0, 0, 0);
          const diffDays = Math.floor((d1.getTime() - d2.getTime()) / 86400000);
          if (diffDays === 1) currentStreak++;
          else break;
        }
      }
    }

    // Determine cycle phase
    let cycle_status = 'insufficient_data';
    if (cycles && cycles.length > 0) {
      const diffDays = Math.floor((Date.now() - new Date(cycles[0].start_date).getTime()) / 86400000);
      if (diffDays <= 5) cycle_status = 'menstrual_phase';
      else if (diffDays <= 13) cycle_status = 'follicular_phase';
      else if (diffDays <= 17) cycle_status = 'ovulation_phase';
      else cycle_status = 'luteal_phase';
    }

    const today_log = {
      sleep:    sleep    ? sleep.duration_hours                  : null,
      water:    water    ? (water.amount_ml / 1000).toFixed(1)  : null,
      mood:     mood     ? mood.mood                             : null,
      stress:   mood     ? mood.intensity                        : null,
      exercise: exercise ? exercise.duration_minutes             : null,
    };

    return NextResponse.json({
      success: true,
      data: {
        profile,
        preferences: prefs,
        total_logs_count: checkins ? checkins.length : 0,
        has_checked_in_today: allSlotsComplete || Object.values(slotsMap).some(s => s.completed),
        current_streak: currentStreak,
        cycle_status,
        pregnancy: preg,
        today_log,
        checkin_slots: slotsMap,
        all_slots_complete: allSlotsComplete,
        wellness_tasks,
        message: 'Health summary generated successfully.',
      },
    });
  } catch (error: any) {
    console.error('[summary GET error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
