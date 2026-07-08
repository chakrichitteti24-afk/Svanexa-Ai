import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { supabase } from '../config/supabase';

export class HealthController {
  static getHealthSummary = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    // Fetch in parallel for speed
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
      { data: exercise }
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('user_preferences').select('*').eq('user_id', userId).single(),
      supabase.from('daily_checkins').select('*').eq('user_id', userId).eq('date', today).single(),
      supabase.from('daily_checkins').select('date').eq('user_id', userId).order('date', { ascending: false }),
      supabase.from('cycle_logs').select('*').eq('user_id', userId).order('start_date', { ascending: false }).limit(1),
      supabase.from('pregnancy_logs').select('*').eq('user_id', userId).single(),
      supabase.from('sleep_logs').select('*').eq('user_id', userId).eq('date', today).single(),
      supabase.from('water_logs').select('*').eq('user_id', userId).eq('date', today).single(),
      supabase.from('mood_logs').select('*').eq('user_id', userId).eq('date', today).single(),
      supabase.from('exercise_logs').select('*').eq('user_id', userId).eq('date', today).single(),
    ]);

    // Calculate streak
    let currentStreak = 0;
    if (checkins && checkins.length > 0) {
      const sortedDates = checkins.map(c => c.date);
      let d = new Date();
      d.setHours(0,0,0,0);
      const last = new Date(sortedDates[0]);
      last.setHours(0,0,0,0);
      const diff = Math.floor((d.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diff <= 1) {
        currentStreak = 1;
        for (let i = 0; i < sortedDates.length - 1; i++) {
          const d1 = new Date(sortedDates[i]); d1.setHours(0,0,0,0);
          const d2 = new Date(sortedDates[i+1]); d2.setHours(0,0,0,0);
          const diffDays = Math.floor((d1.getTime() - d2.getTime()) / 86400000);
          if (diffDays === 1) currentStreak++;
          else break;
        }
      }
    }

    // Determine cycle phase
    let cycle_status = 'insufficient_data';
    if (cycles && cycles.length > 0) {
      const diffDays = Math.floor((new Date().getTime() - new Date(cycles[0].start_date).getTime()) / 86400000);
      if (diffDays <= 5) cycle_status = 'menstrual_phase';
      else if (diffDays <= 13) cycle_status = 'follicular_phase';
      else if (diffDays <= 17) cycle_status = 'ovulation_phase';
      else cycle_status = 'luteal_phase';
    }

    const today_log = {
      sleep: sleep ? sleep.duration_hours : null,
      water: water ? (water.amount_ml / 1000).toFixed(1) : null,
      mood: mood ? mood.mood : null,
      stress: mood ? mood.intensity : null,
      exercise: exercise ? exercise.duration_minutes : null,
    };

    return res.json({
      success: true,
      data: {
        profile,
        preferences: prefs,
        total_logs_count: checkins ? checkins.length : 0,
        has_checked_in_today: !!todayCheckin,
        current_streak: currentStreak,
        cycle_status,
        pregnancy: preg,
        today_log,
        message: "Health summary generated successfully."
      }
    });
  });

  static getPeriodPrediction = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user.id;
    const { data: cycleLogs } = await supabase.from('cycle_logs').select('*').eq('user_id', userId).order('start_date', { ascending: false }).limit(3);
    
    return res.json({
      success: true,
      data: {
        cycleLogs,
        message: "Period predictions returned."
      }
    });
  });
}
