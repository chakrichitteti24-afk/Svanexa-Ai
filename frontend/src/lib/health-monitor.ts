import { SupabaseClient } from '@supabase/supabase-js';
import { differenceInDays, addDays } from 'date-fns';

export interface HealthSummaryPayload {
  sleep_avg: number | null;
  stress_trend: 'low' | 'moderate' | 'high' | 'insufficient_data';
  mood_trend: 'improving' | 'declining' | 'stable' | 'insufficient_data';
  cycle_status: string;
  risk_flags: string[];
  total_logs_count: number;
}

export class HealthMonitorService {
  private supabase: SupabaseClient;

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
  }

  /**
   * Generates a structural wellness summary based strictly on the user's historical Supabase entries.
   * If there is no data or insufficient data, it reflects that cleanly without guessing.
   */
  async generateHealthSummary(userId: string): Promise<HealthSummaryPayload> {
    const riskFlags: string[] = [];

    // 1. Fetch check-ins from daily_logs (last 14 days)
    const { data: checkIns, error: checkInsError } = await this.supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', userId)
      .order('log_date', { ascending: false })
      .limit(14);

    if (checkInsError) {
    }

    // 2. Fetch cycles from cycle_logs (last 12 entries for Period Engine V2)
    const { data: cycles, error: cyclesError } = await this.supabase
      .from('cycle_logs')
      .select('*')
      .eq('user_id', userId)
      .order('start_date', { ascending: false })
      .limit(12);

    if (cyclesError) {
    }

    // 3. Process Check-In Analytics (Sleep, Stress, Mood, Water, Exercise)
    const logCount = checkIns?.length || 0;
    
    let sleepAvg: number | null = null;
    let stressTrend: HealthSummaryPayload['stress_trend'] = 'insufficient_data';
    let moodTrend: HealthSummaryPayload['mood_trend'] = 'insufficient_data';
    let avgWater = 0;
    let avgExercise = 0;

    if (logCount > 0 && checkIns) {
      // Sleep average (last 7 days or up to all available check-ins)
      const recent7CheckIns = checkIns.slice(0, 7);
      const sleepSum = recent7CheckIns.reduce((sum, entry) => sum + Number(entry.sleep), 0);
      sleepAvg = Math.round((sleepSum / recent7CheckIns.length) * 10) / 10;

      if (sleepAvg < 6.5) {
        riskFlags.push('low_sleep');
      }

      // Water and Exercise averages
      const waterSum = recent7CheckIns.reduce((sum, entry) => sum + Number(entry.water), 0);
      avgWater = waterSum / recent7CheckIns.length;
      if (avgWater < 1.5) {
        riskFlags.push('low_hydration');
      }

      const exerciseSum = recent7CheckIns.reduce((sum, entry) => sum + Number(entry.exercise), 0);
      avgExercise = exerciseSum / recent7CheckIns.length;
      if (avgExercise < 15) {
        riskFlags.push('sedentary_routine');
      }

      // Stress Trend (last 7 days average)
      const stressSum = recent7CheckIns.reduce((sum, entry) => sum + Number(entry.stress), 0);
      const stressAvg = stressSum / recent7CheckIns.length;
      if (stressAvg > 7) {
        stressTrend = 'high';
        riskFlags.push('high_stress');
      } else if (stressAvg >= 4) {
        stressTrend = 'moderate';
      } else {
        stressTrend = 'low';
      }

      // Mood Trend Calculation (compare first half of logs to second half)
      if (logCount >= 4) {
        const half = Math.floor(logCount / 2);
        const recentHalf = checkIns.slice(0, half);
        const olderHalf = checkIns.slice(half);

        const moodToNumeric = (m: string) => {
          if (m === 'happy') return 5;
          if (m === 'calm') return 4;
          if (m === 'mood_swings') return 3;
          if (m === 'anxious') return 2;
          return 1; // sad, angry
        };

        const recentMoodAvg = recentHalf.reduce((sum, entry) => sum + moodToNumeric(entry.mood), 0) / recentHalf.length;
        const olderMoodAvg = olderHalf.reduce((sum, entry) => sum + moodToNumeric(entry.mood), 0) / olderHalf.length;

        if (recentMoodAvg > olderMoodAvg + 0.3) {
          moodTrend = 'improving';
        } else if (recentMoodAvg < olderMoodAvg - 0.3) {
          moodTrend = 'declining';
        } else {
          moodTrend = 'stable';
        }
      } else {
        moodTrend = 'stable';
      }

      // Check symptoms for risk flags
      const recentSymptoms = checkIns.slice(0, 5);
      const severeSymptoms = recentSymptoms.some(
        s => s.cramps === 'severe' || s.bloating === 'severe' || s.fatigue === 'severe'
      );
      if (severeSymptoms) {
        riskFlags.push('severe_symptoms');
      }
    }

    // 4. Process Cycle predictions
    let cycleStatus = 'insufficient_data';
    if (cycles && cycles.length > 0) {
      const lastCycle = cycles[0];
      const today = new Date();
      const lastStart = new Date(lastCycle.start_date);
      const lastEnd = new Date(lastCycle.end_date);

      // Check if user is currently on their period
      if (today >= lastStart && today <= lastEnd) {
        cycleStatus = 'on_period';
      } else {
        // Calculate average cycle length
        let avgLength = 28;
        if (cycles.length > 1) {
          let totalLength = 0;
          for (let i = 0; i < cycles.length - 1; i++) {
            totalLength += differenceInDays(new Date(cycles[i].start_date), new Date(cycles[i + 1].start_date));
          }
          avgLength = Math.round(totalLength / (cycles.length - 1));
        }

        const nextPredictedStart = addDays(lastStart, avgLength);
        const daysUntilPeriod = differenceInDays(nextPredictedStart, today);

        if (daysUntilPeriod < 0) {
          cycleStatus = `period_late_by_${Math.abs(daysUntilPeriod)}_days`;
          riskFlags.push('period_late');
        } else if (daysUntilPeriod === 0) {
          cycleStatus = 'period_due_today';
        } else {
          cycleStatus = `period_due_in_${daysUntilPeriod}_days`;
        }
      }
    }

    return {
      sleep_avg: sleepAvg,
      stress_trend: stressTrend,
      mood_trend: moodTrend,
      cycle_status: cycleStatus,
      risk_flags: riskFlags,
      total_logs_count: logCount,
    };
  }
}
