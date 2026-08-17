import { SupabaseClient } from '@supabase/supabase-js';
import { differenceInDays } from 'date-fns';
import { WellnessTask, WellnessPlan, PremiumStreak, TaskCategory, TaskTimeSlot, TaskPriority } from '../../types/wellness-plan';
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

  // ── PUBLIC ─────────────────────────────────────────────────────────────────

  /**
   * Loads or generates the personalized wellness plan for today.
   * Ensures idempotency: will not recreate duplicate tasks for already generated slots unless forceRegenerate is true.
   */
  async getDailyWellnessPlan(
    userId: string,
    todayStr: string,
    wellnessMode: string = 'general',
    targetSlot?: TaskTimeSlot,
    forceRegenerate: boolean = false
  ): Promise<{
    hasData: boolean;
    plan: WellnessPlan | null;
    streak: PremiumStreak | null;
    message?: string;
    logsCount?: number;
  }> {
    const streak = await this.getOrCreateStreak(userId, todayStr);
    const metrics = await this.loadMetrics(userId, todayStr);

    // 1. Check existing plan in database
    const { data: existingRows, error: planFetchErr } = await this.supabase
      .from('wellness_plans')
      .select('*')
      .eq('user_id', userId)
      .eq('title', todayStr)
      .limit(1);

    const existing = existingRows && existingRows.length > 0 ? existingRows[0] : null;

    if (planFetchErr) {
      console.warn('[WellnessPlanService] Plan fetch error:', planFetchErr.message);
    }

    // If no plan exists and user has not completed any check-in today
    if (!existing && metrics.completedSlots.length === 0) {
      return {
        hasData: false,
        plan: null,
        streak,
        message: "No Check-in logged today yet."
      };
    }

    let tasks: WellnessTask[] = [];
    if (existing?.content) {
      try {
        const parsed = JSON.parse(existing.content);
        if (Array.isArray(parsed)) {
          tasks = parsed;
        }
      } catch (err) {
        console.error('[WellnessPlanService] JSON parse error in plan content:', err);
        tasks = [];
      }
    }

    let planId = existing?.id || `plan-${userId}-${todayStr}`;
    let createdAt = existing?.created_at || new Date().toISOString();
    let updatedAt = existing?.updated_at || new Date().toISOString();
    let isUpdated = false;

    // Determine which slots require task generation
    const existingSlots = new Set(tasks.map(t => t.timeSlot));

    let slotsToGenerate: TaskTimeSlot[] = [];

    if (targetSlot) {
      // Always generate/update tasks for the targeted check-in slot using fresh check-in metrics
      const isSlotCompleted = metrics.completedSlots.includes(targetSlot);
      if (isSlotCompleted) {
        tasks = tasks.filter(t => t.timeSlot !== targetSlot);
        slotsToGenerate = [targetSlot];
      } else if (!existingSlots.has(targetSlot)) {
        slotsToGenerate = [targetSlot];
      }
    } else {
      // General check: generate for all completed slots that don't have tasks yet
      if (forceRegenerate) {
        tasks = [];
        slotsToGenerate = (metrics.completedSlots.length > 0 ? metrics.completedSlots : ['morning']) as TaskTimeSlot[];
      } else {
        slotsToGenerate = metrics.completedSlots.filter(s => !existingSlots.has(s as TaskTimeSlot)) as TaskTimeSlot[];
      }
    }

    if (slotsToGenerate.length > 0) {
      for (const slot of slotsToGenerate) {
        const slotTasks = await this.generateTasksForSlot(metrics, wellnessMode, slot, userId, planId, todayStr);
        tasks = [...tasks, ...slotTasks];
      }
      isUpdated = true;
    }

    // Persist changes if newly generated or updated
    if (isUpdated && tasks.length > 0) {
      updatedAt = new Date().toISOString();
      if (existing) {
        await this.supabase
          .from('wellness_plans')
          .update({ content: JSON.stringify(tasks), updated_at: updatedAt })
          .eq('id', existing.id);
      } else {
        const { data: newPlan, error: insertErr } = await this.supabase
          .from('wellness_plans')
          .insert({
            user_id: userId,
            title: todayStr,
            content: JSON.stringify(tasks),
            is_active: true,
          })
          .select('*')
          .maybeSingle();

        if (newPlan) {
          planId = newPlan.id;
          createdAt = newPlan.created_at;
          updatedAt = newPlan.updated_at;
        } else if (insertErr) {
          console.error('[WellnessPlanService] Plan insert error:', insertErr.message);
        }
      }
    }

    const score = this.computeScore(metrics, tasks);
    const insight = this.generateInsight(metrics, wellnessMode, tasks);

    return {
      hasData: tasks.length > 0,
      plan: {
        id: planId,
        userId,
        planDate: todayStr,
        tasks,
        wellnessScore: score,
        aiInsight: insight,
        wellnessMode,
        createdAt,
        updatedAt,
      },
      streak,
      logsCount: metrics.totalLogs,
    };
  }

  /**
   * Toggles task status (pending / completed / skipped) and saves to database.
   */
  async toggleTask(
    userId: string,
    planId: string,
    taskId: string,
    todayStr: string,
    targetStatus?: 'pending' | 'completed' | 'skipped'
  ) {
    let planData: any = null;

    if (planId && planId !== 'temp' && !planId.startsWith('plan-')) {
      const { data } = await this.supabase
        .from('wellness_plans')
        .select('*')
        .eq('id', planId)
        .maybeSingle();
      planData = data;
    }

    if (!planData) {
      const { data } = await this.supabase
        .from('wellness_plans')
        .select('*')
        .eq('user_id', userId)
        .eq('title', todayStr)
        .maybeSingle();
      planData = data;
    }

    if (!planData) {
      throw new Error(`Wellness plan not found for date ${todayStr}`);
    }

    let tasks: WellnessTask[] = [];
    try {
      tasks = JSON.parse(planData.content);
    } catch {
      tasks = [];
    }

    const taskIndex = tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) {
      throw new Error(`Task with id ${taskId} not found in plan`);
    }

    const currentStatus = tasks[taskIndex].status || (tasks[taskIndex].completed ? 'completed' : 'pending');
    let nextStatus: 'pending' | 'completed' | 'skipped' = 'completed';

    if (targetStatus) {
      nextStatus = targetStatus;
    } else {
      nextStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    }

    const isCompleted = nextStatus === 'completed';
    tasks[taskIndex].status = nextStatus;
    tasks[taskIndex].completed = isCompleted;
    tasks[taskIndex].completedAt = isCompleted ? (tasks[taskIndex].completedAt || new Date().toISOString()) : null;

    const metrics = await this.loadMetrics(userId, todayStr);
    const newScore = this.computeScore(metrics, tasks);
    const newInsight = this.generateInsight(metrics, planData.wellness_mode || 'general', tasks);

    await this.supabase
      .from('wellness_plans')
      .update({
        content: JSON.stringify(tasks),
        updated_at: new Date().toISOString(),
      })
      .eq('id', planData.id);

    return {
      success: true,
      tasks,
      wellnessScore: newScore,
      insight: newInsight,
      plan: {
        id: planData.id,
        userId,
        planDate: todayStr,
        tasks,
        wellnessScore: newScore,
        aiInsight: newInsight,
        wellnessMode: planData.wellness_mode || 'general',
        createdAt: planData.created_at,
        updatedAt: new Date().toISOString(),
      }
    };
  }

  // ── METRICS ────────────────────────────────────────────────────────────────

  private async loadMetrics(userId: string, todayStr: string) {
    const [checkinsRes, todayCheckinRes, cycleRes, skinRes, sleepRes, waterRes, moodRes, exerciseRes] =
      await Promise.all([
        this.supabase.from('daily_checkins').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(14),
        this.supabase.from('daily_checkins').select('summary').eq('user_id', userId).eq('date', todayStr).limit(1),
        this.supabase.from('cycle_logs').select('*').eq('user_id', userId).order('start_date', { ascending: false }).limit(3),
        // NOTE: skin_logs column is log_date, not date
        this.supabase.from('skin_logs').select('*').eq('user_id', userId).order('log_date', { ascending: false }).limit(7),
        this.supabase.from('sleep_logs').select('*').eq('user_id', userId).eq('date', todayStr).limit(1),
        this.supabase.from('water_logs').select('*').eq('user_id', userId).eq('date', todayStr).limit(1),
        this.supabase.from('mood_logs').select('*').eq('user_id', userId).eq('date', todayStr).limit(1),
        this.supabase.from('exercise_logs').select('*').eq('user_id', userId).eq('date', todayStr).limit(1),
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
    const summaryRows = todayCheckinRes.data;
    const summaryStr = Array.isArray(summaryRows) && summaryRows.length > 0
      ? summaryRows[0].summary
      : (summaryRows as any)?.summary;

    if (summaryStr) {
      try {
        slotMeta = JSON.parse(summaryStr);
      } catch {
        slotMeta = {};
      }
    }
    if (typeof slotMeta !== 'object' || slotMeta === null) slotMeta = {};
    const completedSlots = ['morning', 'afternoon', 'evening'].filter(s => slotMeta[s]?.completed);
    const allSlotsComplete = completedSlots.length === 3;

    // Extract slot data per slot
    const morningData = slotMeta.morning?.data || {};
    const afternoonData = slotMeta.afternoon?.data || {};
    const eveningData = slotMeta.evening?.data || {};

    const latestSlotData = slotMeta.evening?.data || slotMeta.afternoon?.data || slotMeta.morning?.data || {};
    const indicators = latestSlotData.indicators || {};

    const sleepRow = Array.isArray(sleepRes.data) && sleepRes.data.length > 0 ? sleepRes.data[0] : (sleepRes.data as any);
    const waterRow = Array.isArray(waterRes.data) && waterRes.data.length > 0 ? waterRes.data[0] : (waterRes.data as any);
    const moodRow = Array.isArray(moodRes.data) && moodRes.data.length > 0 ? moodRes.data[0] : (moodRes.data as any);
    const exerciseRow = Array.isArray(exerciseRes.data) && exerciseRes.data.length > 0 ? exerciseRes.data[0] : (exerciseRes.data as any);

    const todaySleep = sleepRow?.duration_hours ?? (indicators.sleepRating ? indicators.sleepRating * 1.6 : null);
    const todayWater = waterRow ? Number(waterRow.amount_ml) / 1000 : (indicators.hydrationRating ? indicators.hydrationRating * 0.5 : null);
    const todayMood = indicators.mood?.state ? `Mood: ${indicators.mood.state}` : (moodRow?.mood ?? null);
    const todayStressScore = indicators.stress?.score ?? latestSlotData.averageScore ?? null;
    const todayStressIndicator = indicators.stress?.level ?? latestSlotData.stressIndicator ?? null;
    const todayEnergy = indicators.energy?.level ?? null;
    const todayWellnessScore = indicators.wellnessScore ?? null;
    const todaySupport = indicators.supportChoice ?? latestSlotData.supportChoice ?? null;
    const todayExercise = exerciseRow?.duration_minutes ?? null;

    const skins = skinRes.data || [];
    const acneAvg = skins.length ? skins.reduce((s, sk) => s + Number(sk.acne ?? sk.condition ?? 3), 0) / skins.length : 3;

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
      slotMeta, morningData, afternoonData, eveningData,
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
    const completedCount = tasks.filter(t => t.completed || t.status === 'completed').length;
    const total = tasks.length;
    const remaining = total - completedCount;

    if (!m.hasCheckedInToday) {
      return "Complete your daily check-in so I can tailor your personalized wellness tasks based on your real responses.";
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

  private async generateTasksForSlot(
    m: any,
    mode: string,
    slot: TaskTimeSlot,
    userId: string,
    planId: string,
    todayStr: string
  ): Promise<WellnessTask[]> {
    const prompt = this.buildPromptForSlot(m, mode, slot);
    let raw: any[] = [];

    try {
      // 1. Try Gemini first
      if (this.gemini) {
        try {
          let model: any;
          try {
            model = this.gemini.getGenerativeModel({ model: 'gemini-2.5-flash' });
          } catch {
            model = this.gemini.getGenerativeModel({ model: 'gemini-3.6-flash' });
          }
          const result = await model.generateContent(prompt);
          const text = result.response.text();
          // Extract JSON if wrapped in markdown code fence
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsed.tasks) && parsed.tasks.length > 0) {
              raw = parsed.tasks;
            }
          }
        } catch (geminiError) {
          console.warn('[WellnessPlanService] Gemini task generation error:', geminiError);
        }
      }

      // 2. Try Groq as secondary provider if Gemini did not produce tasks
      if ((!raw || raw.length === 0) && this.groq) {
        let resp: any = null;
        try {
          const groqCall = this.groq.chat.completions.create({
            model: 'openai/gpt-oss-120b',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.55,
            max_tokens: 800,
            response_format: { type: 'json_object' },
          });
          const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Groq timeout')), 6500)
          );
          resp = await Promise.race([groqCall, timeout]);
        } catch {
          const fallbackCall = this.groq.chat.completions.create({
            model: 'qwen/qwen3.6-27b',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.55,
            max_tokens: 800,
            response_format: { type: 'json_object' },
          });
          resp = await fallbackCall;
        }

        const parsed = JSON.parse(resp?.choices?.[0]?.message?.content || '{}');
        raw = parsed.tasks || [];
      }
    } catch {
      // Instant fallback to high quality rule tasks
    }

    if (!Array.isArray(raw) || raw.length < 3) {
      raw = this.ruleTasksForSlot(m, mode, slot);
    }

    const now = new Date().toISOString();

    return raw.slice(0, 4).map((t: any, i: number) => {
      const randSuffix = Math.random().toString(36).substring(2, 7);
      const cat = (t.category || 'mindfulness') as TaskCategory;
      const priority = (t.priority || (i === 0 ? 'high' : 'recommended')) as TaskPriority;

      return {
        id: `task-${todayStr}-${slot}-${cat}-${randSuffix}`,
        userId,
        planId,
        planDate: todayStr,
        text: t.text || 'Complete mindful pause',
        category: cat,
        timeSlot: slot,
        priority,
        status: 'pending',
        estimatedTime: t.estimatedTime || '5 mins',
        rationale: t.rationale || 'Tailored to your daily check-in assessment.',
        completed: false,
        completedAt: null,
        createdAt: now,
      };
    });
  }

  private buildPromptForSlot(m: any, mode: string, slot: TaskTimeSlot): string {
    const slotContext = {
      morning: 'The user is starting their day. Tasks should be energizing, grounding, and practical for the morning.',
      afternoon: 'The user is in the middle of their day. Tasks should help maintain energy, reduce midday fatigue, and support focus.',
      evening: 'The user is winding down. Tasks should promote relaxation, reflection, and preparation for restful sleep.',
    }[slot];

    const slotSpecificData = m.slotMeta?.[slot]?.data || m.latestSlotData || {};
    const slotIndicators = slotSpecificData.indicators || m.indicators || {};

    return `You are a premium personal AI wellness coach. Generate exactly 3 to 4 personalized daily tasks for the ${slot.toUpperCase()} time slot based on the user's daily wellness check-in.

SLOT CONTEXT: ${slotContext}

USER 10-DIMENSION WELLNESS ASSESSMENT FOR TODAY:
- Mode: ${mode} (general | pcos | pregnancy)
- Current Check-in Slot: ${slot}
- Stress Indicator: ${slotIndicators.stress?.score ? `${slotIndicators.stress.score}/5.0 (${slotIndicators.stress.level ?? 'Calculated'})` : (m.todayStress ? `${m.todayStress}/5.0` : 'not logged')}
- Emotional Headspace / Mood: ${slotIndicators.mood?.state ?? m.todayMood ?? 'balanced'}
- Energy Level: ${slotIndicators.energy?.level ?? m.todayEnergy ?? 'Moderate'}
- Sleep Quality: ${m.todaySleep ? `${m.todaySleep}h` : 'not logged'}
- Support Focus: ${slotSpecificData.supportChoice ?? m.todaySupport ?? 'general wellness'}
- Cycle Phase: ${m.cycleStatus}
- Skin / Acne Condition: ${m.acneAvg.toFixed(1)}/10

SMART PERSONALIZATION RULES:
- If energy is Low or sleep was poor: recommend a gentler, restorative plan (e.g. 5-min breathing, light stretch, warm hydration).
- If hydration is needed: prioritize water intake.
- If stress signals are elevated: include a calming nervous system reset task.
- Only generate tasks for the '${slot}' slot — DO NOT mix slots.
- Provide a brief 1-sentence 'rationale' explaining WHY this task was assigned based on the user's check-in.
- NEVER recommend medicines, medical drugs, or diagnose diseases.
- PCOS mode: prioritize stress reduction, metabolic rhythm, gentle mobility.
- PREGNANCY mode: gentle maternal wellness, hydration, posture rest.
- Include realistic 'estimatedTime' (e.g. "2 mins", "5 mins", "10 mins").

Return ONLY raw JSON with schema:
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

  private ruleTasksForSlot(m: any, mode: string, slot: TaskTimeSlot): any[] {
    const tasks: any[] = [];
    const isElevatedStress = (m.todayStress !== null && m.todayStress > 3.0) || m.todayEnergy === 'Low';

    if (slot === 'morning') {
      tasks.push({
        text: 'Drink a full glass of warm water (500ml) upon waking.',
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
          text: 'Take a 5-minute quiet pause and step away from all screens.',
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

  private async getOrCreateStreak(userId: string, todayStr: string): Promise<PremiumStreak> {
    const { data: existing, error: streakErr } = await this.supabase
      .from('wellness_streaks')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (streakErr) {
      console.warn('[WellnessPlanService] wellness_streaks query error:', streakErr.message);
    }

    if (existing) {
      return {
        userId,
        currentStreak: existing.current_streak || 1,
        longestStreak: existing.longest_streak || 1,
        lastActiveDate: existing.last_active_date || todayStr,
        weeklyConsistency: existing.weekly_consistency || 100,
        createdAt: existing.created_at || new Date().toISOString(),
        updatedAt: existing.updated_at || new Date().toISOString(),
      };
    }

    const newStreak: PremiumStreak = {
      userId,
      currentStreak: 1,
      longestStreak: 1,
      lastActiveDate: todayStr,
      weeklyConsistency: 100,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await this.supabase.from('wellness_streaks').upsert({
        user_id: userId,
        current_streak: 1,
        longest_streak: 1,
        last_active_date: todayStr,
        weekly_consistency: 100,
      }, { onConflict: 'user_id' });
    } catch (err) {
      console.warn('[WellnessPlanService] streak upsert error:', err);
    }

    return newStreak;
  }
}
