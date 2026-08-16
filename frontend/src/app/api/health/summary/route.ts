import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/utils/supabase/server';
import { extractDateFromRequest } from '@/utils/date-utils';

type CheckinSlot = 'morning' | 'afternoon' | 'evening';

export async function GET(req: Request) {
  try {
    const { supabase, user, error: authError } = await getAuthenticatedUser(req);

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }


    const userId = user.id;
    const today = extractDateFromRequest(req);

    const [
      { data: profileRows },
      { data: todayCheckinRows },
      { count: checkinsCount },
      { data: streakDataRows },
      { data: cycles },
      { data: pregRows },
      { data: sleepRows },
      { data: waterRows },
      { data: moodRows },
      { data: exerciseRows },
      { data: todayPlanRows }
    ] = await Promise.all([
      supabase.from('profiles').select('id, first_name, last_name, username, ai_name, active_theme, active_dashboard_style, active_companion_style').eq('id', userId).limit(1),
      supabase.from('daily_checkins').select('summary').eq('user_id', userId).eq('date', today).limit(1),
      supabase.from('daily_checkins').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('wellness_streaks').select('current_streak, longest_streak, last_active_date, weekly_consistency').eq('user_id', userId).limit(1),
      supabase.from('cycle_logs').select('start_date').eq('user_id', userId).order('start_date', { ascending: false }).limit(1),
      supabase.from('pregnancy_logs').select('due_date, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(1),
      supabase.from('sleep_logs').select('duration_hours').eq('user_id', userId).eq('date', today).limit(1),
      supabase.from('water_logs').select('amount_ml').eq('user_id', userId).eq('date', today).limit(1),
      supabase.from('mood_logs').select('mood, intensity').eq('user_id', userId).eq('date', today).limit(1),
      supabase.from('exercise_logs').select('duration_minutes').eq('user_id', userId).eq('date', today).limit(1),
      supabase.from('wellness_plans').select('content').eq('user_id', userId).eq('title', today).limit(1),
    ]);

    const profile = profileRows && profileRows.length > 0 ? profileRows[0] : null;
    const todayCheckin = todayCheckinRows && todayCheckinRows.length > 0 ? todayCheckinRows[0] : null;
    const streakData = streakDataRows && streakDataRows.length > 0 ? streakDataRows[0] : null;
    const preg = pregRows && pregRows.length > 0 ? pregRows[0] : null;
    const sleep = sleepRows && sleepRows.length > 0 ? sleepRows[0] : null;
    const water = waterRows && waterRows.length > 0 ? waterRows[0] : null;
    const mood = moodRows && moodRows.length > 0 ? moodRows[0] : null;
    const exercise = exerciseRows && exerciseRows.length > 0 ? exerciseRows[0] : null;
    const todayPlan = todayPlanRows && todayPlanRows.length > 0 ? todayPlanRows[0] : null;

    let userProfile = profile;
    if (!userProfile) {
      const meta = user.user_metadata || {};
      try {
        const { data: newProfile } = await supabase.from('profiles').upsert({
          id: userId,
          first_name: meta.first_name || meta.username || 'User',
          last_name: meta.last_name || '',
          email: user.email,
          ai_name: meta.ai_name || 'Luna',
          active_theme: 'general',
          active_dashboard_style: 'minimal',
          active_companion_style: 'friendly',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' }).select('id, first_name, last_name, username, ai_name, active_theme, active_dashboard_style, active_companion_style').maybeSingle();

        userProfile = newProfile || {
          id: userId,
          first_name: meta.first_name || meta.username || 'there',
          last_name: meta.last_name || '',
          username: meta.username || 'User',
          ai_name: meta.ai_name || 'Luna',
          active_theme: 'general',
          active_dashboard_style: 'minimal',
          active_companion_style: 'friendly',
        };
      } catch {
        userProfile = {
          id: userId,
          first_name: meta.first_name || meta.username || 'there',
          last_name: meta.last_name || '',
          username: meta.username || 'User',
          ai_name: meta.ai_name || 'Luna',
          active_theme: 'general',
          active_dashboard_style: 'minimal',
          active_companion_style: 'friendly',
        };
      }
    }


    let wellness_tasks: any[] = [];
    if (todayPlan?.content) {
      try {
        const parsed = JSON.parse(todayPlan.content);
        if (Array.isArray(parsed)) {
          wellness_tasks = parsed;
        }
      } catch {
        wellness_tasks = [];
      }
    }

    // Parse slot meta from daily_checkins.summary
    let slotMeta: Record<string, any> = {};
    if (todayCheckin?.summary) {
      try {
        slotMeta = JSON.parse(todayCheckin.summary);
      } catch {
        slotMeta = {};
      }
    }
    if (typeof slotMeta !== 'object' || slotMeta === null) slotMeta = {};

    const slotsMap: Record<CheckinSlot, { completed: boolean; completedAt: string | null }> = {
      morning:   { completed: !!slotMeta.morning?.completed, completedAt: slotMeta.morning?.completedAt ?? null },
      afternoon: { completed: !!slotMeta.afternoon?.completed, completedAt: slotMeta.afternoon?.completedAt ?? null },
      evening:   { completed: !!slotMeta.evening?.completed, completedAt: slotMeta.evening?.completedAt ?? null },
    };

    const allSlotsComplete = slotsMap.morning.completed && slotsMap.afternoon.completed && slotsMap.evening.completed;
    const hasCheckedInToday = Object.values(slotsMap).some(s => s.completed);

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

    // Build preferences object from profile columns
    const userPreferences = {
      user_id: userId,
      theme: (userProfile?.active_theme as 'general' | 'pcos' | 'pregnancy') || 'general',
      tracking_goals: null,
      language: 'en',
      communication_style: userProfile?.active_companion_style || 'friendly',
      emoji_preference: true,
      response_length: 'concise',
      notifications_enabled: true,
    };

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
        date: today,
        profile: userProfile,
        preferences: userPreferences,
        total_logs_count: checkinsCount || 0,
        has_checked_in_today: hasCheckedInToday,
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
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
