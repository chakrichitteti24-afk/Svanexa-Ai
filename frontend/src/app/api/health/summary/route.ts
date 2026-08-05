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
      { count: checkinsCount },
      { data: streakData },
      { data: cycles },
      { data: preg },
      { data: sleep },
      { data: water },
      { data: mood },
      { data: exercise },
      { data: todayPlan }
    ] = await Promise.all([
      supabase.from('profiles').select('first_name, ai_name').eq('id', userId).single(),
      supabase.from('user_preferences').select('theme').eq('user_id', userId).maybeSingle(),
      supabase.from('daily_checkins').select('summary').eq('user_id', userId).eq('date', today).maybeSingle(),
      supabase.from('daily_checkins').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('wellness_streaks').select('current_streak').eq('user_id', userId).maybeSingle(),
      supabase.from('cycle_logs').select('start_date').eq('user_id', userId).order('start_date', { ascending: false }).limit(1),
      supabase.from('pregnancy_logs').select('due_date, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('sleep_logs').select('duration_hours').eq('user_id', userId).eq('date', today).maybeSingle(),
      supabase.from('water_logs').select('amount_ml').eq('user_id', userId).eq('date', today).maybeSingle(),
      supabase.from('mood_logs').select('mood, intensity').eq('user_id', userId).eq('date', today).maybeSingle(),
      supabase.from('exercise_logs').select('duration_minutes').eq('user_id', userId).eq('date', today).maybeSingle(),
      supabase.from('wellness_plans').select('content').eq('user_id', userId).eq('title', today).maybeSingle(),
    ]);

    let userProfile = profile;
    if (!userProfile && user.user_metadata) {
      const meta = user.user_metadata;
      const { data: newProfile } = await supabase.from('profiles').upsert({
        id: userId,
        first_name: meta.first_name || meta.username || 'User',
        last_name: meta.last_name || '',
        email: user.email,
        ai_name: meta.ai_name || 'Luna',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' }).select('first_name, ai_name').maybeSingle();

      userProfile = newProfile || { first_name: meta.first_name || 'User', ai_name: meta.ai_name || 'Luna' };
    }

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

    const currentStreak = streakData?.current_streak || 0;

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
        profile: userProfile,
        preferences: prefs,
        total_logs_count: checkinsCount || 0,
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
