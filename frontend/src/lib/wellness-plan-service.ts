import { SupabaseClient } from '@supabase/supabase-js';
import { differenceInDays, addDays, format } from 'date-fns';
import { HealthMonitorService } from './health-monitor';
import { WellnessTask, WellnessPlan, PremiumStreak } from '@/types/wellness-plan';
import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

export class WellnessPlanService {
  private supabase: SupabaseClient;
  private groq: Groq | null = null;
  private gemini: GoogleGenerativeAI | null = null;

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
    if (process.env.GROQ_API_KEY) {
      this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    }
    if (process.env.GEMINI_API_KEY) {
      this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
  }

  /**
   * Generates or retrieves a daily wellness plan and the streak details.
   */
  async getDailyWellnessPlan(userId: string, todayStr: string): Promise<{
    hasData: boolean;
    plan: WellnessPlan | null;
    streak: PremiumStreak | null;
    message?: string;
    logsCount?: number;
  }> {
    // 1. Fetch current streak details
    const streak = await this.getOrCreateStreak(userId);

    // 2. Check if a plan already exists for today
    const { data: existingPlan, error: fetchPlanError } = await this.supabase
      .from('premium_wellness_plans')
      .select('*')
      .eq('user_id', userId)
      .eq('plan_date', todayStr)
      .maybeSingle();

    if (fetchPlanError) {
      console.error('Error fetching wellness plan:', fetchPlanError);
    }

    if (existingPlan) {
      return {
        hasData: true,
        plan: {
          id: existingPlan.id,
          userId: existingPlan.user_id,
          planDate: existingPlan.plan_date,
          tasks: existingPlan.tasks.map((t: any) => ({
            id: t.id,
            text: t.text,
            category: t.category,
            completed: !!t.completed,
            completedAt: t.completedAt || null,
          })),
          createdAt: existingPlan.created_at,
          updatedAt: existingPlan.updated_at,
        },
        streak,
      };
    }

    // 3. Collect health summary metrics
    const healthMonitor = new HealthMonitorService(this.supabase);
    const summary = await healthMonitor.generateHealthSummary(userId);

    // Rule 2 & Insufficient Data condition:
    // If the user has fewer than 3 logs, we do not generate a plan
    if (summary.total_logs_count < 3) {
      return {
        hasData: false,
        plan: null,
        streak,
        message: "Not enough wellness data yet. Log daily check-ins for at least 3 days to unlock your AI Wellness Plan.",
        logsCount: summary.total_logs_count,
      };
    }

    // 4. Fetch additional data needed (Latest skin logs & recent detailed check-in logs)
    const { data: recentLogs } = await this.supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', userId)
      .order('log_date', { ascending: false })
      .limit(7);

    const { data: skinLogs } = await this.supabase
      .from('skin_logs')
      .select('*')
      .eq('user_id', userId)
      .order('log_date', { ascending: false })
      .limit(7);

    // Calculate averages & extract latest metrics
    const latestLog = recentLogs?.[0] || null;
    const latestSkin = skinLogs?.[0] || null;

    const sleepAvg = summary.sleep_avg || 7.0;
    const stressTrend = summary.stress_trend;
    const moodTrend = summary.mood_trend;
    const cycleStatus = summary.cycle_status;

    const waterSum = recentLogs?.reduce((sum, entry) => sum + Number(entry.water), 0) || 0;
    const waterAvg = recentLogs?.length ? waterSum / recentLogs.length : 2.0;

    const exerciseSum = recentLogs?.reduce((sum, entry) => sum + Number(entry.exercise), 0) || 0;
    const exerciseAvg = recentLogs?.length ? exerciseSum / recentLogs.length : 30;

    const cramps = latestLog?.cramps || 'none';
    const bloating = latestLog?.bloating || 'none';
    const fatigue = latestLog?.fatigue || 'none';
    const hairFall = latestLog?.hair_fall || 'none';

    const acneAvg = skinLogs?.length
      ? skinLogs.reduce((sum, entry) => sum + Number(entry.acne), 0) / skinLogs.length
      : 3;
    const oilinessAvg = skinLogs?.length
      ? skinLogs.reduce((sum, entry) => sum + Number(entry.oiliness), 0) / skinLogs.length
      : 3;

    // 5. Generate tasks using AI (Groq/Gemini) with robust rule-based fallback
    let tasks: Omit<WellnessTask, 'completed' | 'completedAt'>[] = [];

    try {
      tasks = await this.generateTasksWithAI({
        sleepAvg,
        stressTrend,
        moodTrend,
        cycleStatus,
        waterAvg,
        exerciseAvg,
        cramps,
        bloating,
        fatigue,
        hairFall,
        acneAvg,
        oilinessAvg,
      });
    } catch (e) {
      console.warn('AI Task generation failed, falling back to rule-based tasks:', e);
      tasks = this.generateTasksWithRules({
        sleepAvg,
        stressTrend,
        moodTrend,
        cycleStatus,
        waterAvg,
        exerciseAvg,
        cramps,
        bloating,
        fatigue,
        hairFall,
        acneAvg,
        oilinessAvg,
      });
    }

    // Double check constraint 1: 3-8 tasks only
    if (tasks.length < 3) {
      // Pad with foundational general tasks if needed
      const fallbacks = this.generateTasksWithRules({
        sleepAvg,
        stressTrend,
        moodTrend,
        cycleStatus,
        waterAvg,
        exerciseAvg,
        cramps,
        bloating,
        fatigue,
        hairFall,
        acneAvg,
        oilinessAvg,
      });
      for (const t of fallbacks) {
        if (!tasks.some(existing => existing.category === t.category)) {
          tasks.push(t);
        }
        if (tasks.length >= 3) break;
      }
    }
    if (tasks.length > 8) {
      tasks = tasks.slice(0, 8);
    }

    // Map to full WellnessTask shape
    const finalTasks: WellnessTask[] = tasks.map((t, idx) => ({
      id: `${t.category}-${idx}`,
      text: t.text,
      category: t.category as any,
      completed: false,
      completedAt: null,
    }));

    // 6. Save newly generated plan to the database
    const { data: newPlan, error: insertError } = await this.supabase
      .from('premium_wellness_plans')
      .insert({
        user_id: userId,
        plan_date: todayStr,
        tasks: finalTasks,
      })
      .select('*')
      .single();

    if (insertError) {
      console.error('Error saving new wellness plan:', insertError);
      // Fallback in memory if insert fails (to avoid crashing UX)
      return {
        hasData: true,
        plan: {
          id: 'temp-id',
          userId,
          planDate: todayStr,
          tasks: finalTasks,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        streak,
      };
    }

    return {
      hasData: true,
      plan: {
        id: newPlan.id,
        userId: newPlan.user_id,
        planDate: newPlan.plan_date,
        tasks: newPlan.tasks,
        createdAt: newPlan.created_at,
        updatedAt: newPlan.updated_at,
      },
      streak,
    };
  }

  /**
   * Toggles completion status of a task and updates streaks accordingly.
   */
  async toggleTaskCompletion(
    userId: string,
    planId: string,
    taskId: string,
    todayStr: string
  ): Promise<{ plan: WellnessPlan; streak: PremiumStreak }> {
    // 1. Fetch current plan
    const { data: planData, error: planError } = await this.supabase
      .from('premium_wellness_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planError || !planData) {
      throw new Error(planError?.message || 'Plan not found');
    }

    // 2. Toggle target task
    const tasks: WellnessTask[] = planData.tasks.map((t: any) => {
      if (t.id === taskId) {
        const completed = !t.completed;
        return {
          ...t,
          completed,
          completedAt: completed ? new Date().toISOString() : null,
        };
      }
      return t;
    });

    // 3. Save updated tasks
    const { data: updatedPlan, error: updateError } = await this.supabase
      .from('premium_wellness_plans')
      .update({ tasks, updated_at: new Date().toISOString() })
      .eq('id', planId)
      .select('*')
      .single();

    if (updateError || !updatedPlan) {
      throw new Error(updateError?.message || 'Failed to update plan');
    }

    // 4. Update Streak based on completion progress
    const allCompleted = tasks.every(t => t.completed);
    await this.updateStreakStatus(userId, todayStr, allCompleted);

    const updatedStreak = await this.getOrCreateStreak(userId);

    return {
      plan: {
        id: updatedPlan.id,
        userId: updatedPlan.user_id,
        planDate: updatedPlan.plan_date,
        tasks: updatedPlan.tasks,
        createdAt: updatedPlan.created_at,
        updatedAt: updatedPlan.updated_at,
      },
      streak: updatedStreak,
    };
  }

  /**
   * Retrieves streak details or creates a default entry.
   */
  private async getOrCreateStreak(userId: string): Promise<PremiumStreak> {
    const { data: streak, error } = await this.supabase
      .from('premium_streaks')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching streak:', error);
    }

    if (streak) {
      return {
        userId: streak.user_id,
        currentStreak: streak.current_streak,
        longestStreak: streak.longest_streak,
        lastActiveDate: streak.last_active_date,
        createdAt: streak.created_at,
        updatedAt: streak.updated_at,
      };
    }

    // Initialize default streak
    const { data: newStreak } = await this.supabase
      .from('premium_streaks')
      .insert({
        user_id: userId,
        current_streak: 0,
        longest_streak: 0,
        last_active_date: null,
      })
      .select('*')
      .single();

    return {
      userId,
      currentStreak: newStreak?.current_streak || 0,
      longestStreak: newStreak?.longest_streak || 0,
      lastActiveDate: newStreak?.last_active_date || null,
      createdAt: newStreak?.created_at || new Date().toISOString(),
      updatedAt: newStreak?.updated_at || new Date().toISOString(),
    };
  }

  /**
   * Recalculates and updates the streak based on task completion status.
   */
  private async updateStreakStatus(userId: string, todayStr: string, completedAll: boolean) {
    const { data: streak } = await this.supabase
      .from('premium_streaks')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!streak) return;

    if (!completedAll) {
      // If user uncompleted a task on today's perfect run, reduce streak if it was updated today
      if (streak.last_active_date === todayStr) {
        // Retrieve the previous plan status from yesterday
        const yesterdayStr = format(addDays(new Date(), -1), 'yyyy-MM-dd');
        
        // We can just decrement the streak or reset it depending on yesterday's activity
        const { data: yesterdayPlan } = await this.supabase
          .from('premium_wellness_plans')
          .select('*')
          .eq('user_id', userId)
          .eq('plan_date', yesterdayStr)
          .maybeSingle();

        const yesterdayFinished = yesterdayPlan?.tasks.length && yesterdayPlan.tasks.every((t: any) => t.completed);
        
        await this.supabase
          .from('premium_streaks')
          .update({
            current_streak: yesterdayFinished ? Math.max(0, streak.current_streak - 1) : 0,
            last_active_date: yesterdayFinished ? yesterdayStr : null,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);
      }
      return;
    }

    // If already marked complete today, no change
    if (streak.last_active_date === todayStr) {
      return;
    }

    let nextStreak = streak.current_streak;
    const yesterdayStr = format(addDays(new Date(), -1), 'yyyy-MM-dd');

    if (streak.last_active_date === yesterdayStr || (streak.current_streak === 0 && streak.last_active_date === null)) {
      // Continued streak (or first streak task)
      nextStreak += 1;
    } else {
      // Streak broken, start fresh with 1
      nextStreak = 1;
    }

    const nextLongest = Math.max(streak.longest_streak, nextStreak);

    await this.supabase
      .from('premium_streaks')
      .update({
        current_streak: nextStreak,
        longest_streak: nextLongest,
        last_active_date: todayStr,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);
  }

  /**
   * Communicates with LLM API (Groq/Gemini) to generate JSON-formatted wellness plan tasks.
   */
  private async generateTasksWithAI(metrics: any): Promise<Omit<WellnessTask, 'completed' | 'completedAt'>[]> {
    const prompt = `You are an expert, empathetic PCOS/PCOD wellness guide.
Your task is to generate 3 to 8 simple, positive, actionable daily wellness tasks for today based strictly on the user's data.

USER METRICS:
- Average Sleep: ${metrics.sleepAvg.toFixed(1)} hours
- Stress Level: ${metrics.stressTrend}
- Mood Trend: ${metrics.moodTrend}
- Period Cycle Status: ${metrics.cycleStatus}
- Average Daily Water: ${metrics.waterAvg.toFixed(1)} Liters
- Average Daily Exercise: ${metrics.exerciseAvg.toFixed(0)} minutes
- Recent Symptoms: Cramps: ${metrics.cramps}, Bloating: ${metrics.bloating}, Fatigue: ${metrics.fatigue}, Hair Fall: ${metrics.hairFall}
- Skin Status: Acne Score: ${metrics.acneAvg.toFixed(1)}/10, Oiliness Score: ${metrics.oilinessAvg.toFixed(1)}/10

RULES:
1. Generate between 3 and 8 tasks only.
2. Every task must be direct, simple, and realistic. 
3. Address the specific user metrics above (e.g. if stress is high, suggest stress relief; if sleep is low, suggest wind-down; if hydration is low, suggest drinking more water).
4. NEVER provide medical advice, diagnostic claims, medication recommendations, or clinical actions.
5. Do NOT generate placeholders or generic "daily routine" stuff. Keep it highly relevant to the provided metrics.
6. Return ONLY a valid JSON object with a "tasks" key containing the array of tasks:
{
  "tasks": [
    {
      "id": "slug-name",
      "text": "Specific task text...",
      "category": "sleep" | "stress" | "mood" | "cycle" | "symptoms" | "skin" | "hydration" | "exercise"
    }
  ]
}
Do NOT use markdown block ticks (e.g. \`\`\`json). Return raw JSON.`;

    if (this.groq) {
      const chatCompletion = await this.groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.1-8b-instant',
        temperature: 0.6,
        max_tokens: 800,
        response_format: { type: 'json_object' }
      });

      const text = chatCompletion.choices[0]?.message?.content || '';
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed;
      if (parsed.tasks && Array.isArray(parsed.tasks)) return parsed.tasks;
    }

    if (this.gemini) {
      const model = this.gemini.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
      });
      const text = result.response.text();
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed;
      if (parsed.tasks && Array.isArray(parsed.tasks)) return parsed.tasks;
    }

    throw new Error('No AI API keys configured or failed response');
  }

  /**
   * Rule-based generation to serve as fallback and guarantee accuracy.
   */
  private generateTasksWithRules(metrics: any): Omit<WellnessTask, 'completed' | 'completedAt'>[] {
    const tasks: Omit<WellnessTask, 'completed' | 'completedAt'>[] = [];

    // Sleep Tasks
    if (metrics.sleepAvg < 6.5) {
      tasks.push({
        id: 'sleep-1',
        text: `Wind down 30 minutes earlier tonight to support your ${metrics.sleepAvg.toFixed(1)}h sleep average.`,
        category: 'sleep',
      });
    }

    // Stress Tasks
    if (metrics.stressTrend === 'high' || metrics.stressTrend === 'moderate') {
      tasks.push({
        id: 'stress-1',
        text: 'Spend 5 minutes doing deep belly breathing or a mindful body scan.',
        category: 'stress',
      });
    }

    // Mood Tasks
    if (metrics.moodTrend === 'declining') {
      tasks.push({
        id: 'mood-1',
        text: 'Write down 3 tiny things that made you smile or brought you peace today.',
        category: 'mood',
      });
    }

    // Cycle Tasks
    if (metrics.cycleStatus === 'on_period' || metrics.cramps === 'severe' || metrics.cramps === 'moderate') {
      tasks.push({
        id: 'cycle-1',
        text: 'Sip warm herbal tea (ginger or peppermint) to help soothe period cramps.',
        category: 'cycle',
      });
    } else if (metrics.cycleStatus.includes('period_due_in_3') || metrics.cycleStatus.includes('period_due_in_2') || metrics.cycleStatus.includes('period_due_in_1')) {
      tasks.push({
        id: 'cycle-2',
        text: 'Ensure comfort items like a heating pad are accessible in preparation for your period.',
        category: 'cycle',
      });
    }

    // Symptom Tasks (Fatigue/Bloating/Hair Fall)
    if (metrics.fatigue === 'severe' || metrics.fatigue === 'moderate') {
      tasks.push({
        id: 'symptoms-1',
        text: 'Schedule a 15-minute screen-free break or rest session to combat fatigue.',
        category: 'symptoms',
      });
    }
    if (metrics.bloating === 'severe' || metrics.bloating === 'moderate') {
      tasks.push({
        id: 'symptoms-2',
        text: 'Eat slowly and enjoy warm, lightly spiced food to soothe your bloating.',
        category: 'symptoms',
      });
    }

    // Hydration Tasks
    if (metrics.waterAvg < 2.0) {
      tasks.push({
        id: 'hydration-1',
        text: `Drink at least 8 glasses of water today to hit your hydration target.`,
        category: 'hydration',
      });
    }

    // Exercise Tasks
    if (metrics.exerciseAvg < 20) {
      tasks.push({
        id: 'exercise-1',
        text: 'Incorporate 10-15 minutes of gentle pelvic stretches or a light walk.',
        category: 'exercise',
      });
    }

    // Skin Tasks
    if (metrics.acneAvg > 4 || metrics.oilinessAvg > 4) {
      tasks.push({
        id: 'skin-1',
        text: 'Follow a gentle, fragrance-free cleansing routine and avoid touching your skin.',
        category: 'skin',
      });
    }

    // General safeguards (Always guarantee at least 3 tasks)
    if (tasks.length < 3) {
      tasks.push({
        id: 'general-1',
        text: 'Take three deep breaths first thing in the morning to oxygenate your body.',
        category: 'stress',
      });
      tasks.push({
        id: 'general-2',
        text: 'Hydrate with a glass of warm water before breakfast.',
        category: 'hydration',
      });
      tasks.push({
        id: 'general-3',
        text: 'Do a quick, gentle 5-minute stretch to check in with your body.',
        category: 'exercise',
      });
    }

    return tasks;
  }
}
