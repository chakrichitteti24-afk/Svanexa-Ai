import { SupabaseClient } from '@supabase/supabase-js';
import { differenceInDays, addDays, format } from 'date-fns';
import { WellnessTask, WellnessPlan, PremiumStreak } from '../../types/wellness-plan';
import Groq from 'groq-sdk';

export class WellnessPlanService {
  private supabase: SupabaseClient;
  private groq: Groq | null = null;

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
    if (process.env.GROQ_API_KEY) {
      this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    }
  }

  // ── PUBLIC ─────────────────────────────────────────────────────────────────

  async getDailyWellnessPlan(userId: string, todayStr: string, wellnessMode: string): Promise<{
    hasData: boolean;
    plan: WellnessPlan | null;
    streak: PremiumStreak | null;
    message?: string;
    logsCount?: number;
  }> {
    const streak = await this.getOrCreateStreak(userId);
    const metrics = await this.loadMetrics(userId, todayStr);
    
    // Load existing plan
    const { data: existing } = await this.supabase
      .from('wellness_plans')
      .select('*')
      .eq('user_id', userId)
      .eq('title', todayStr)
      .maybeSingle();

    if (!existing && metrics.completedSlots.length === 0) {
      return {
        hasData: false,
        plan: null,
        streak,
        message: "No Check-in logged today yet."
      };
    }

    let tasks: WellnessTask[] = existing ? JSON.parse(existing.content) : [];
    let isUpdated = false;
    let planId = existing?.id || 'temp';
    let createdAt = existing?.created_at || new Date().toISOString();
    let updatedAt = existing?.updated_at || new Date().toISOString();

    // Check which slots we need to generate
    const existingSlots = new Set(tasks.map(t => t.timeSlot));
    const slotsToGenerate = metrics.completedSlots.filter((s: string) => !existingSlots.has(s as any));

    if (slotsToGenerate.length > 0) {
      // Generate tasks for these specific slots
      for (const slot of slotsToGenerate) {
         const newTasks = await this.generateTasksForSlot(metrics, wellnessMode, slot);
         tasks = [...tasks, ...newTasks];
      }
      isUpdated = true;
    }

    if (isUpdated) {
      updatedAt = new Date().toISOString();
      if (existing) {
        await this.supabase.from('wellness_plans').update({ content: JSON.stringify(tasks), updated_at: updatedAt }).eq('id', existing.id);
      } else {
        const { data: newPlan } = await this.supabase.from('wellness_plans').insert({ user_id: userId, title: todayStr, content: JSON.stringify(tasks), is_active: true }).select('*').single();
        if (newPlan) {
          planId = newPlan.id;
          createdAt = newPlan.created_at;
          updatedAt = newPlan.updated_at;
        }
      }
    }

    const score = this.computeScore(metrics, tasks);
    const insight = this.generateInsight(metrics, wellnessMode, tasks);

    return {
      hasData: true,
      plan: {
        id: planId, userId, planDate: todayStr, tasks,
        wellnessScore: score, aiInsight: insight, wellnessMode,
        createdAt, updatedAt,
      },
      streak,
    };
  }

  async toggleTask(userId: string, planId: string, taskId: string, todayStr: string, targetStatus?: 'pending' | 'completed' | 'skipped') {
    let planData: any = null;

    if (planId && planId !== 'temp') {
      const { data } = await this.supabase
        .from('wellness_plans').select('*').eq('id', planId).maybeSingle();
      planData = data;
    }

    if (!planData) {
      const { data } = await this.supabase
        .from('wellness_plans').select('*').eq('user_id', userId).eq('title', todayStr).maybeSingle();
      planData = data;
    }

    if (!planData) {
      const loaded = await this.getDailyWellnessPlan(userId, todayStr, 'general');
      if (loaded.plan) {
        const { data } = await this.supabase
          .from('wellness_plans').select('*').eq('user_id', userId).eq('title', todayStr).maybeSingle();
        planData = data;
      }
    }

    if (!planData) throw new Error('Plan not found for today');

    const tasks: WellnessTask[] = JSON.parse(planData.content).map((t: any) => {
      if (t.id === taskId) {
        let newStatus = targetStatus;
        if (!newStatus) {
          newStatus = t.completed || t.status === 'completed' ? 'pending' : 'completed';
        }
        const completed = newStatus === 'completed';
        return { 
          ...t, 
          status: newStatus, 
          completed, 
          completedAt: completed ? (t.completedAt || new Date().toISOString()) : null 
        };
      }
      return t;
    });

    await this.supabase.from('wellness_plans')
      .update({ content: JSON.stringify(tasks), updated_at: new Date().toISOString() })
      .eq('id', planData.id);

    if (tasks.every(t => t.completed || t.status === 'completed')) {
      await this.updateStreak(userId, todayStr);
    }

    const metrics = await this.loadMetrics(userId, todayStr);
    const [streak, prefs] = await Promise.all([
      this.getOrCreateStreak(userId),
      this.supabase.from('user_preferences').select('theme').eq('user_id', userId).maybeSingle()
    ]);
    const mode = prefs.data?.theme || 'general';
    const score = this.computeScore(metrics, tasks);
    const insight = this.generateInsight(metrics, mode, tasks);

    return { tasks, score, insight, streak };
  }

  // ── METRICS ────────────────────────────────────────────────────────────────

  private async loadMetrics(userId: string, todayStr: string) {
    const [checkinsRes, todayCheckinRes, cycleRes, skinRes, sleepRes, waterRes, moodRes, exerciseRes] =
      await Promise.all([
        this.supabase.from('daily_checkins').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(14),
        // Read slot completion state from daily_checkins.summary JSON
        this.supabase.from('daily_checkins').select('summary').eq('user_id', userId).eq('date', todayStr).maybeSingle(),
        this.supabase.from('cycle_logs').select('*').eq('user_id', userId).order('start_date', { ascending: false }).limit(3),
        this.supabase.from('skin_logs').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(7),
        this.supabase.from('sleep_logs').select('*').eq('user_id', userId).eq('date', todayStr).maybeSingle(),
        this.supabase.from('water_logs').select('*').eq('user_id', userId).eq('date', todayStr).maybeSingle(),
        this.supabase.from('mood_logs').select('*').eq('user_id', userId).eq('date', todayStr).maybeSingle(),
        this.supabase.from('exercise_logs').select('*').eq('user_id', userId).eq('date', todayStr).maybeSingle(),
      ]);

    const checkins = checkinsRes.data || [];
    const recent = checkins.slice(0, 7);

    const sleepAvg = recent.length
      ? recent.reduce((s, c) => s + Number(c.sleep_hours || 7), 0) / recent.length : 7;
    const waterAvg = recent.length
      ? recent.reduce((s, c) => s + Number(c.water_liters || 2), 0) / recent.length : 2;
    const exerciseAvg = recent.length
      ? recent.reduce((s, c) => s + Number(c.exercise_minutes || 30), 0) / recent.length : 30;
    const stressAvg = recent.length
      ? recent.reduce((s, c) => s + Number(c.stress_level || 5), 0) / recent.length : 5;

    // Parse slot completion from daily_checkins.summary
    let slotMeta: Record<string, any> = {};
    if (todayCheckinRes.data?.summary) {
      try { slotMeta = JSON.parse(todayCheckinRes.data.summary); } catch { slotMeta = {}; }
    }
    if (typeof slotMeta !== 'object' || slotMeta === null) slotMeta = {};
    const completedSlots = ['morning', 'afternoon', 'evening'].filter(s => slotMeta[s]?.completed);
    const allSlotsComplete = completedSlots.length === 3;

    // Extract latest check-in data from today's slots
    const latestSlotData = slotMeta.evening?.data || slotMeta.afternoon?.data || slotMeta.morning?.data || {};

    const todaySleep = sleepRes.data?.duration_hours ?? latestSlotData.sleep ?? null;
    const todayWater = waterRes.data ? Number(waterRes.data.amount_ml) / 1000 : null;
    const todayMood = latestSlotData.q1_feeling ? `Feeling ${latestSlotData.q1_feeling}/5` : (moodRes.data?.mood ?? null);
    const todayStressScore = latestSlotData.averageScore ?? (moodRes.data?.intensity ? moodRes.data.intensity / 2 : null);
    const todayStressIndicator = latestSlotData.stressIndicator ?? null;
    const todayExercise = exerciseRes.data?.duration_minutes ?? null;

    const skins = skinRes.data || [];
    const acneAvg = skins.length ? skins.reduce((s, sk) => s + Number(sk.condition || 3), 0) / skins.length : 3;

    const cycles = cycleRes.data || [];
    let cycleStatus = 'insufficient_data';
    if (cycles.length > 0) {
      const diff = differenceInDays(new Date(), new Date(cycles[0].start_date));
      if (diff <= 5) cycleStatus = 'menstrual';
      else if (diff <= 13) cycleStatus = 'follicular';
      else if (diff <= 17) cycleStatus = 'ovulation';
      else cycleStatus = 'luteal';
    }

    return {
      totalLogs: checkins.length,
      sleepAvg, waterAvg, exerciseAvg, stressAvg,
      todaySleep, todayWater, todayMood, todayStress: todayStressScore, todayStressIndicator,
      todayExercise, latestSlotData,
      acneAvg, cycleStatus,
      hasCheckedInToday: completedSlots.length > 0,
      allSlotsComplete,
      completedSlotsCount: completedSlots.length,
      completedSlots, // Expose actual slots
    };
  }

  // ── SCORE ──────────────────────────────────────────────────────────────────

  private computeScore(m: any, tasks: WellnessTask[]): number {
    if (!tasks || tasks.length === 0) {
      return 0;
    }

    const morningTasks = tasks.filter(t => t.timeSlot === 'morning');
    const afternoonTasks = tasks.filter(t => t.timeSlot === 'afternoon');
    const eveningTasks = tasks.filter(t => t.timeSlot === 'evening');

    const morningDone = morningTasks.filter(t => t.completed || t.status === 'completed').length;
    const afternoonDone = afternoonTasks.filter(t => t.completed || t.status === 'completed').length;
    const eveningDone = eveningTasks.filter(t => t.completed || t.status === 'completed').length;

    // Slot Weight Allocation: Morning = 30%, Afternoon = 30%, Evening = 40% -> Total 100%
    const morningScore = morningTasks.length > 0 ? (morningDone / morningTasks.length) * 30 : 0;
    const afternoonScore = afternoonTasks.length > 0 ? (afternoonDone / afternoonTasks.length) * 30 : 0;
    const eveningScore = eveningTasks.length > 0 ? (eveningDone / eveningTasks.length) * 40 : 0;

    const totalScore = Math.round(morningScore + afternoonScore + eveningScore);
    return Math.min(100, Math.max(0, totalScore));
  }

  // ── INSIGHT ────────────────────────────────────────────────────────────────

  private generateInsight(m: any, mode: string, tasks: WellnessTask[]): string {
    const completedCount = tasks.filter(t => t.completed).length;
    const total = tasks.length;
    const remaining = total - completedCount;

    if (!m.hasCheckedInToday) {
      return "Complete today's check-in so I can give you personalized wellness guidance based on your real data.";
    }
    if (m.todayWater !== null && Number(m.todayWater) < 1.5) {
      const needed = (2.5 - Number(m.todayWater)).toFixed(1);
      return `You've had ${Number(m.todayWater).toFixed(1)}L of water today. Drinking ${needed}L more before evening will help you reach your hydration goal.`;
    }
    if (m.todaySleep !== null && Number(m.todaySleep) < 6.5) {
      return `You slept ${Number(m.todaySleep).toFixed(1)} hours last night — a little below your goal. A short nap or early bedtime tonight can help you recover well.`;
    }
    if (m.todayStress !== null && Number(m.todayStress) > 3.0) {
      return `Your responses suggest you may be feeling more stressed today (${m.todayStressIndicator ?? 'Elevated'}). Try the mindfulness task in your plan — even 5 minutes of breathing can make a real difference.`;
    }
    if (mode === 'pregnancy') {
      return `You're doing wonderfully. Remember to rest when needed and keep sipping water throughout the day.`;
    }
    if (mode === 'pcos') {
      return `Consistent sleep and stress management are key for hormonal balance. You have ${remaining} wellness task${remaining !== 1 ? 's' : ''} remaining for today — keep going!`;
    }
    if (completedCount === total && total > 0) {
      return `Incredible! You've completed all ${total} wellness tasks today. You're building powerful healthy habits. 🌟`;
    }
    return `Great progress today! You have ${remaining} task${remaining !== 1 ? 's' : ''} remaining. Each one you complete brings you closer to your wellness goals.`;
  }

  // ── TASK GENERATION ────────────────────────────────────────────────────────

  private async generateTasksForSlot(m: any, mode: string, slot: string): Promise<WellnessTask[]> {
    const prompt = this.buildPromptForSlot(m, mode, slot);
    let raw: any[] = [];

    try {
      if (this.groq) {
        const groqCall = this.groq.chat.completions.create({
          model: 'llama-3.1-8b-instant',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.55,
          max_tokens: 800,
          response_format: { type: 'json_object' },
        });

        const timeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Groq timeout')), 8000)
        );

        const resp: any = await Promise.race([groqCall, timeout]);
        const parsed = JSON.parse(resp.choices[0]?.message?.content || '{}');
        raw = parsed.tasks || [];
      }
    } catch { /* Instant fallback to rule tasks */ }

    if (raw.length < 3) {
      raw = this.ruleTasksForSlot(m, mode, slot);
    }

    return raw.slice(0, 5).map((t: any, i: number) => ({
      id: `${slot}-${t.category}-${Date.now()}-${i}`,
      text: t.text,
      category: t.category || 'mindfulness',
      timeSlot: slot as any,
      priority: (t.priority || 'recommended') as any,
      status: 'pending',
      estimatedTime: t.estimatedTime || '5 mins',
      rationale: t.rationale || 'Tailored to your daily health check-in data and wellness goals.',
      completed: false,
      completedAt: null,
    }));
  }

  private buildPromptForSlot(m: any, mode: string, slot: string): string {
    const slotContext = {
      morning: 'The user is starting their day. Tasks should be energizing, grounding, and practical for the morning.',
      afternoon: 'The user is in the middle of their day. Tasks should help maintain energy, reduce midday fatigue, and support focus.',
      evening: 'The user is winding down. Tasks should promote relaxation, reflection, and preparation for restful sleep.',
    }[slot] || '';

    return `You are a premium personal AI wellness coach. Generate exactly 3 to 5 personalized daily tasks for the ${slot.toUpperCase()} time slot.

SLOT CONTEXT: ${slotContext}

USER DATA (use only this — never invent values):
- Mode: ${mode} (general | pcos | pregnancy)
- Avg Sleep: ${m.sleepAvg.toFixed(1)}h (today: ${m.todaySleep ?? 'not logged'}h)
- Avg Water: ${m.waterAvg.toFixed(1)}L (today: ${m.todayWater ?? 'not logged'}L)
- Avg Exercise: ${m.exerciseAvg.toFixed(0)}min (today: ${m.todayExercise ?? 'not logged'}min)
- Stress Wellness Indicator: ${m.todayStress ? `${m.todayStress}/5.0 (${m.todayStressIndicator ?? 'Calculated'})` : 'not logged'}
  IMPORTANT: never say "you have stress" — say "your responses suggest..."
- Q1 Feeling/Mood Score: ${m.latestSlotData?.q1_feeling ?? 'N/A'} (1=relaxed, 5=overwhelmed)
- Q2 Focus Score: ${m.latestSlotData?.q2_focus ?? 'N/A'} (1=easy, 5=difficult)
- Q3 Body Comfort Score: ${m.latestSlotData?.q3_body ?? 'N/A'} (1=relaxed, 5=tense)
- Q4 Mental Load Score: ${m.latestSlotData?.q4_thoughts ?? 'N/A'} (1=clear, 5=overwhelmed)
- Cycle Phase: ${m.cycleStatus}

RULES:
- Only generate tasks for the '${slot}' slot — DO NOT mix slots.
- Each task must include a 1-sentence 'rationale' tied to the user's actual data above.
- NEVER recommend medicines, supplements, or diagnose anything.
- PCOS mode: prioritize stress relief, cycle awareness, gentle exercise, low-GI nutrition.
- PREGNANCY mode: gentle tasks only — hydration, rest, gentle movement, mother wellness.
- estimatedTime must be realistic (e.g., "3 mins", "10 mins", "15 mins").

Return ONLY raw JSON — no markdown, no code blocks:
{
  "tasks": [
    { 
      "text": "Task instruction here", 
      "category": "hydration|sleep|stress|mood|cycle|exercise|nutrition|mindfulness|pregnancy", 
      "priority": "high|recommended|optional",
      "estimatedTime": "5 mins",
      "rationale": "Wellness rationale based on user data..."
    }
  ]
}`;
  }

  private ruleTasksForSlot(m: any, mode: string, slot: string): any[] {
    const tasks: any[] = [];
    const skipWater = m.todayWater !== null && Number(m.todayWater) >= 2;
    const skipExercise = m.todayExercise !== null && Number(m.todayExercise) >= 30;
    const isElevatedStress = (m.todayStress !== null && m.todayStress > 3.0) || (m.latestSlotData?.q1_feeling >= 4);

    if (slot === 'morning') {
      tasks.push({ 
        text: 'Drink a full glass of water (500ml) to hydrate.', 
        category: 'hydration', 
        priority: 'high',
        estimatedTime: '2 mins',
        rationale: 'Rehydrating after sleep restores your cognitive function and metabolic momentum.'
      });
      if (isElevatedStress) {
        tasks.push({ 
          text: 'Practice 4-7-8 calming breath technique for 3 minutes.', 
          category: 'stress', 
          priority: 'high',
          estimatedTime: '3 mins',
          rationale: 'Your check-in responses suggest feeling overwhelmed today. Controlled breathing calms the nervous system.'
        });
      } else if (m.sleepAvg < 6.5) {
        tasks.push({ 
          text: `Plan an earlier bedtime tonight to recover from your recent ${m.sleepAvg.toFixed(1)}h sleep average.`, 
          category: 'sleep', 
          priority: 'high',
          estimatedTime: '5 mins',
          rationale: `Your recent sleep average is ${m.sleepAvg.toFixed(1)}h. Consistent sleep cycles stabilize cortisol levels.`
        });
      } else {
        tasks.push({ 
          text: 'Start with 5 deep breath cycles to center your mind.', 
          category: 'mindfulness', 
          priority: 'recommended',
          estimatedTime: '3 mins',
          rationale: 'Deep diaphragmatic breathing activates parasympathetic rest-and-digest pathways.'
        });
      }
      if (mode === 'pregnancy') {
        tasks.push({ 
          text: 'Enjoy a gentle, nutrient-dense breakfast for maternal wellness.', 
          category: 'pregnancy', 
          priority: 'high',
          estimatedTime: '15 mins',
          rationale: 'Balanced breakfast blood sugar helps reduce early pregnancy nausea and stabilizes energy.'
        });
      } else {
        tasks.push({ 
          text: 'Do a gentle 5-minute morning stretch routine.', 
          category: 'exercise', 
          priority: 'recommended',
          estimatedTime: '5 mins',
          rationale: 'Morning mobility lubricates joints and improves spinal posture for the workday.'
        });
      }
    } else if (slot === 'afternoon') {
      if (!skipWater) {
        tasks.push({ 
          text: 'Drink 2 full glasses of water with your lunch.', 
          category: 'hydration', 
          priority: 'high',
          estimatedTime: '2 mins',
          rationale: `You logged ${m.todayWater ?? '0'}L of water so far. Hitting 2L maintains afternoon focus.`
        });
      } else {
        tasks.push({ 
          text: 'Take a 5-minute screen break to rest your eyes.', 
          category: 'stress', 
          priority: 'recommended',
          estimatedTime: '5 mins',
          rationale: 'Visual distance breaks relieve ocular strain and mitigate mental fatigue.'
        });
      }
      if (isElevatedStress) {
        tasks.push({ 
          text: 'Practice 3 minutes of box breathing to ease stress.', 
          category: 'stress', 
          priority: 'high',
          estimatedTime: '3 mins',
          rationale: 'Your responses suggest you may be feeling more stressed today. Box breathing rapidly lowers tension.'
        });
      } else {
        tasks.push({ 
          text: 'Eat a fresh piece of fruit or healthy snack.', 
          category: 'nutrition', 
          priority: 'recommended',
          estimatedTime: '5 mins',
          rationale: 'Complex carbohydrates prevent the mid-afternoon energy slump.'
        });
      }
      if (!skipExercise) {
        tasks.push({ 
          text: mode === 'pregnancy' ? 'Take a gentle 10-minute walk for circulation.' : 'Take a 15-minute brisk walk to recharge.', 
          category: 'exercise', 
          priority: 'recommended',
          estimatedTime: mode === 'pregnancy' ? '10 mins' : '15 mins',
          rationale: 'Light physical movement boosts peripheral circulation and endorphin release.'
        });
      }
    } else if (slot === 'evening') {
      if (m.acneAvg > 4) {
        tasks.push({ 
          text: 'Complete a gentle double-cleansing skin routine.', 
          category: 'skin', 
          priority: 'high',
          estimatedTime: '10 mins',
          rationale: 'Cleansing removes environmental pollutants and excess sebum accumulated during the day.'
        });
      }
      if (mode === 'pcos' && m.cycleStatus === 'menstrual') {
        tasks.push({ 
          text: 'Sip warm chamomile or peppermint tea for pelvic relaxation.', 
          category: 'cycle', 
          priority: 'high',
          estimatedTime: '10 mins',
          rationale: 'Warm herbal tea relaxes smooth abdominal muscle tissues during your cycle.'
        });
      } else {
        tasks.push({ 
          text: 'Reflect on 1 positive highlight from your day.', 
          category: 'mindfulness', 
          priority: 'recommended',
          estimatedTime: '5 mins',
          rationale: 'Gratitude exercises promote dopamine release prior to sleep.'
        });
      }
      tasks.push({ 
        text: 'Dim screens and wind down 30 minutes before sleep.', 
        category: 'sleep', 
        priority: 'high',
        estimatedTime: '30 mins',
        rationale: 'Avoiding blue light exposure enables natural melatonin synthesis for deep sleep.'
      });
    }

    return tasks;
  }


  // ── STREAK ─────────────────────────────────────────────────────────────────

  async getOrCreateStreak(userId: string): Promise<PremiumStreak> {
    const { data } = await this.supabase.from('wellness_streaks').select('*').eq('user_id', userId).maybeSingle();
    if (data) {
      return {
        userId, currentStreak: data.current_streak, longestStreak: data.longest_streak,
        lastActiveDate: data.last_active_date, weeklyConsistency: data.weekly_consistency || 0,
        createdAt: data.created_at, updatedAt: data.updated_at,
      };
    }
    const { data: ns } = await this.supabase.from('wellness_streaks')
      .insert({ user_id: userId, current_streak: 0, longest_streak: 0, weekly_consistency: 0, last_active_date: null })
      .select('*').single();
    return {
      userId, currentStreak: 0, longestStreak: 0,
      lastActiveDate: null, weeklyConsistency: 0,
      createdAt: ns?.created_at || new Date().toISOString(),
      updatedAt: ns?.updated_at || new Date().toISOString(),
    };
  }

  private async updateStreak(userId: string, todayStr: string) {
    const { data: s } = await this.supabase.from('wellness_streaks').select('*').eq('user_id', userId).maybeSingle();
    if (!s) return;
    if (s.last_active_date === todayStr) return;

    const yest = format(addDays(new Date(), -1), 'yyyy-MM-dd');
    const next = (s.last_active_date === yest || s.current_streak === 0) ? s.current_streak + 1 : 1;
    const longest = Math.max(s.longest_streak, next);

    // Weekly consistency: count days in last 7 with completed plans
    const { data: recentPlans } = await this.supabase
      .from('wellness_plans').select('title, content').eq('user_id', userId)
      .gte('title', format(addDays(new Date(), -6), 'yyyy-MM-dd'));
    const completedDays = (recentPlans || []).filter(p => {
      try { const tasks = JSON.parse(p.content); return tasks.every((t: any) => t.completed); }
      catch { return false; }
    }).length;
    const weekly = Math.round((completedDays / 7) * 100);

    await this.supabase.from('wellness_streaks')
      .upsert({ user_id: userId, current_streak: next, longest_streak: longest, last_active_date: todayStr, weekly_consistency: weekly }, { onConflict: 'user_id' });
  }
}
