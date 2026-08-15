import { SupabaseClient } from '@supabase/supabase-js';
import { differenceInDays } from 'date-fns';
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

    if (!planData) throw new Error('Plan not found for toggle');

    const tasks: WellnessTask[] = JSON.parse(planData.content);
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) throw new Error('Task not found');

    const nowStatus = tasks[taskIndex].status;
    let nextStatus: 'pending' | 'completed' | 'skipped' = 'completed';

    if (targetStatus) {
      nextStatus = targetStatus;
    } else {
      nextStatus = nowStatus === 'completed' ? 'pending' : 'completed';
    }

    tasks[taskIndex].status = nextStatus;
    tasks[taskIndex].completed = nextStatus === 'completed';
    tasks[taskIndex].completedAt = nextStatus === 'completed' ? new Date().toISOString() : null;

    const metrics = await this.loadMetrics(userId, todayStr);
    const newScore = this.computeScore(metrics, tasks);

    await this.supabase
      .from('wellness_plans')
      .update({ content: JSON.stringify(tasks), updated_at: new Date().toISOString() })
      .eq('id', planData.id);

    return { success: true, tasks, wellnessScore: newScore };
  }

  async generateFreshPlan(userId: string, todayStr: string, mode: string) {
    const streak = await this.getOrCreateStreak(userId);
    const metrics = await this.loadMetrics(userId, todayStr);

    let tasks: WellnessTask[] = [];
    const slotsToGen = metrics.completedSlots.length > 0 ? metrics.completedSlots : ['morning'];
    for (const slot of slotsToGen) {
      const newTasks = await this.generateTasksForSlot(metrics, mode, slot);
      tasks = [...tasks, ...newTasks];
    }

    const { data: existing } = await this.supabase
      .from('wellness_plans')
      .select('*')
      .eq('user_id', userId)
      .eq('title', todayStr)
      .maybeSingle();

    if (existing) {
      await this.supabase.from('wellness_plans').update({ content: JSON.stringify(tasks), updated_at: new Date().toISOString() }).eq('id', existing.id);
    } else {
      await this.supabase.from('wellness_plans').insert({ user_id: userId, title: todayStr, content: JSON.stringify(tasks), is_active: true });
    }

    const score = this.computeScore(metrics, tasks);
    const insight = this.generateInsight(metrics, mode, tasks);

    return { tasks, score, insight, streak };
  }

  // ── METRICS ────────────────────────────────────────────────────────────────

  private async loadMetrics(userId: string, todayStr: string) {
    const [checkinsRes, todayCheckinRes, cycleRes, skinRes, sleepRes, waterRes, moodRes, exerciseRes] =
      await Promise.all([
        this.supabase.from('daily_checkins').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(14),
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

    // Extract latest 10-dimension check-in data from today's slots
    const latestSlotData = slotMeta.evening?.data || slotMeta.afternoon?.data || slotMeta.morning?.data || {};
    const indicators = latestSlotData.indicators || {};

    const todaySleep = sleepRes.data?.duration_hours ?? (indicators.sleepRating ? indicators.sleepRating * 1.6 : null);
    const todayWater = waterRes.data ? Number(waterRes.data.amount_ml) / 1000 : null;
    const todayMood = indicators.mood?.state ? `Mood: ${indicators.mood.state}` : (moodRes.data?.mood ?? null);
    const todayStressScore = indicators.stress?.score ?? latestSlotData.averageScore ?? null;
    const todayStressIndicator = indicators.stress?.level ?? latestSlotData.stressIndicator ?? null;
    const todayEnergy = indicators.energy?.level ?? null;
    const todayWellnessScore = indicators.wellnessScore ?? null;
    const todaySupport = indicators.supportChoice ?? latestSlotData.supportChoice ?? null;
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
      todayEnergy, todayWellnessScore, todaySupport,
      todayExercise, latestSlotData, indicators,
      acneAvg, cycleStatus,
      hasCheckedInToday: completedSlots.length > 0,
      allSlotsComplete,
      completedSlotsCount: completedSlots.length,
      completedSlots,
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
      return "Complete your 10-question daily check-in so I can tailor your personalized wellness tasks based on your real responses.";
    }
    if (m.todayEnergy === 'Low') {
      return `Your check-in responses suggest lower energy today. I've shaped your daily wellness plan around gentle pacing and restorative hydration.`;
    }
    if (m.todayStress !== null && Number(m.todayStress) > 3.0) {
      return `Your check-in responses suggest you may be navigating higher pressure today (${m.todayStressIndicator ?? 'Elevated'}). Try the calming breath task in your plan — even 3 minutes helps ground your nervous system.`;
    }
    if (mode === 'pregnancy') {
      return `You're doing wonderfully. Remember to rest comfortably, elevate your feet when seated, and keep sipping water throughout the day.`;
    }
    if (mode === 'pcos') {
      return `Consistent rest and low-impact movement support hormonal balance. You have ${remaining} wellness task${remaining !== 1 ? 's' : ''} left today.`;
    }
    if (completedCount === total && total > 0) {
      return `Incredible! You've completed all ${total} wellness tasks today. You're building healthy, sustainable momentum. 🌟`;
    }
    return `Great progress today! You have ${remaining} task${remaining !== 1 ? 's' : ''} remaining. Each completed task brings you closer to your wellness goals.`;
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
      rationale: t.rationale || 'Tailored to your 10-question daily check-in assessment.',
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

    return `You are a premium personal AI wellness coach. Generate exactly 3 to 5 personalized daily tasks for the ${slot.toUpperCase()} time slot based on the user's 10-question wellness assessment.

SLOT CONTEXT: ${slotContext}

USER 10-DIMENSION WELLNESS ASSESSMENT:
- Mode: ${mode} (general | pcos | pregnancy)
- Stress Indicator: ${m.todayStress ? `${m.todayStress}/5.0 (${m.todayStressIndicator ?? 'Calculated'})` : 'not logged'} (non-diagnostic)
- Mood Tone: ${m.todayMood ?? 'balanced'}
- Energy Level: ${m.todayEnergy ?? 'Moderate'}
- Sleep: ${m.todaySleep ? `${m.todaySleep}h` : 'not logged'}
- Support Focus: ${m.todaySupport ?? 'general wellness'}
- Cycle Phase: ${m.cycleStatus}
- Skin / Acne Avg: ${m.acneAvg.toFixed(1)}/10

SMART PERSONALIZATION RULES:
- If energy is Low or sleep was poor: recommend a gentler, restorative plan (e.g. 5-min breathing, light stretch, warm hydration).
- If hydration is needed: prioritize water intake.
- If stress signals are elevated: include a calming nervous system reset task.
- Only generate tasks for the '${slot}' slot — DO NOT mix slots.
- Provide a brief 1-sentence 'rationale' explaining WHY this task was assigned based on the user's check-in.
- NEVER recommend medicines, medical drugs, or diagnose diseases.
- PCOS mode: prioritize stress reduction, metabolic rhythm, gentle mobility.
- PREGNANCY mode: gentle maternal wellness, hydration, posture rest.
- Include realistic 'estimatedTime' (e.g. "3 mins", "5 mins", "10 mins").

Return ONLY raw JSON — no markdown, no code blocks:
{
  "tasks": [
    { 
      "text": "Task instruction here", 
      "category": "hydration|sleep|stress|mood|cycle|exercise|nutrition|mindfulness|pregnancy", 
      "priority": "high|recommended|optional",
      "estimatedTime": "5 mins",
      "rationale": "Wellness rationale based on user assessment..."
    }
  ]
}`;
  }

  private ruleTasksForSlot(m: any, mode: string, slot: string): any[] {
    const tasks: any[] = [];
    const isElevatedStress = (m.todayStress !== null && m.todayStress > 3.0) || m.todayEnergy === 'Low';

    if (slot === 'morning') {
      tasks.push({ 
        text: 'Drink a full glass of water (500ml) upon waking.', 
        category: 'hydration', 
        priority: 'high',
        estimatedTime: '2 mins',
        rationale: 'Rehydrating upon waking jumpstarts your metabolism and supports mental focus.'
      });
      if (isElevatedStress) {
        tasks.push({ 
          text: 'Practice 4-7-8 calming breathing technique for 3 minutes.', 
          category: 'stress', 
          priority: 'high',
          estimatedTime: '3 mins',
          rationale: 'Your check-in responses suggest a calmer pace today. Controlled breathing resets the nervous system.'
        });
      } else {
        tasks.push({ 
          text: 'Start with 5 deep breath cycles to center your morning.', 
          category: 'mindfulness', 
          priority: 'recommended',
          estimatedTime: '3 mins',
          rationale: 'Deep breathing oxygenates your brain and gently activates your morning energy.'
        });
      }
      if (mode === 'pregnancy') {
        tasks.push({ 
          text: 'Enjoy a nourishing, nutrient-dense maternal breakfast.', 
          category: 'pregnancy', 
          priority: 'high',
          estimatedTime: '15 mins',
          rationale: 'Balanced blood sugar in the morning stabilizes energy and minimizes pregnancy fatigue.'
        });
      } else {
        tasks.push({ 
          text: 'Do a gentle 5-minute morning mobility stretch.', 
          category: 'exercise', 
          priority: 'recommended',
          estimatedTime: '5 mins',
          rationale: 'Gentle morning stretching lubricates joints and promotes full-body circulation.'
        });
      }
    } else if (slot === 'afternoon') {
      tasks.push({ 
        text: 'Drink 2 full glasses of water to maintain midday hydration.', 
        category: 'hydration', 
        priority: 'high',
        estimatedTime: '2 mins',
        rationale: 'Sustained hydration prevents the common afternoon energy slump.'
      });
      if (isElevatedStress) {
        tasks.push({ 
          text: 'Take a 5-minute quiet pause and step away from screens.', 
          category: 'stress', 
          priority: 'high',
          estimatedTime: '5 mins',
          rationale: 'A screen break reduces ocular strain and resets mental fatigue.'
        });
      } else {
        tasks.push({ 
          text: 'Stand up and do a quick 3-minute posture and shoulder roll.', 
          category: 'exercise', 
          priority: 'recommended',
          estimatedTime: '3 mins',
          rationale: 'Releasing neck and shoulder tension improves posture and focus.'
        });
      }
      tasks.push({ 
        text: 'Enjoy a healthy, protein or fiber-rich midday snack.', 
        category: 'nutrition', 
        priority: 'recommended',
        estimatedTime: '5 mins',
        rationale: 'Nourishing fuel stabilizes afternoon blood sugar.'
      });
    } else {
      // Evening
      tasks.push({ 
        text: 'Dim bright screens and switch to warmer evening lighting.', 
        category: 'sleep', 
        priority: 'high',
        estimatedTime: '2 mins',
        rationale: 'Lower light levels stimulate natural melatonin production for deeper sleep.'
      });
      if (isElevatedStress) {
        tasks.push({ 
          text: 'Write down 3 lingering thoughts on paper to release them before bed.', 
          category: 'stress', 
          priority: 'high',
          estimatedTime: '5 mins',
          rationale: 'Externalizing active thoughts prevents nighttime rumination.'
        });
      } else {
        tasks.push({ 
          text: 'Reflect on one positive moment from today with gratitude.', 
          category: 'mindfulness', 
          priority: 'recommended',
          estimatedTime: '3 mins',
          rationale: 'Positive evening reflection cultivates emotional peace before sleep.'
        });
      }
      tasks.push({ 
        text: 'Do 5 minutes of gentle lying-down restorative stretches.', 
        category: 'exercise', 
        priority: 'optional',
        estimatedTime: '5 mins',
        rationale: 'Restorative stretching relaxes spinal muscles and prepares the body for deep rest.'
      });
    }

    return tasks;
  }

  // ── STREAK ─────────────────────────────────────────────────────────────────

  private async getOrCreateStreak(userId: string): Promise<PremiumStreak> {
    const { data: existing } = await this.supabase
      .from('user_streaks')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      return {
        userId,
        currentStreak: existing.current_streak || 1,
        longestStreak: existing.longest_streak || 1,
        lastActiveDate: existing.last_checkin_date || new Date().toISOString().split('T')[0],
        weeklyConsistency: 100,
        createdAt: existing.created_at || new Date().toISOString(),
        updatedAt: existing.updated_at || new Date().toISOString(),
      };
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const newStreak: PremiumStreak = {
      userId,
      currentStreak: 1,
      longestStreak: 1,
      lastActiveDate: todayStr,
      weeklyConsistency: 100,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.supabase.from('user_streaks').upsert({
      user_id: userId,
      current_streak: 1,
      longest_streak: 1,
      last_checkin_date: todayStr,
    }, { onConflict: 'user_id' });

    return newStreak;
  }
}
