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

  /**
   * Swaps an individual task with an alternative from the diversified wellness task bank.
   */
  async swapTask(
    userId: string,
    planId: string,
    taskId: string,
    todayStr: string,
    wellnessMode: string = 'general'
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

    const currentTask = tasks[taskIndex];
    const metrics = await this.loadMetrics(userId, todayStr);
    const candidateTasks = this.getAllRuleTasksForSlot(currentTask.timeSlot, wellnessMode, metrics);

    // Filter out candidate tasks already present in user's plan
    const existingTexts = new Set(tasks.map(t => t.text.toLowerCase().trim()));
    let alternatives = candidateTasks.filter(c => !existingTexts.has(c.text.toLowerCase().trim()));

    // Prefer same category if available, otherwise take any different task for this slot
    const sameCategory = alternatives.filter(c => c.category === currentTask.category);
    const chosenCandidate = sameCategory.length > 0
      ? sameCategory[Math.floor(Math.random() * sameCategory.length)]
      : alternatives.length > 0
        ? alternatives[Math.floor(Math.random() * alternatives.length)]
        : candidateTasks[0];

    const randSuffix = Math.random().toString(36).substring(2, 7);
    const replacementTask: WellnessTask = {
      id: `task-${todayStr}-${currentTask.timeSlot}-${chosenCandidate.category}-${randSuffix}`,
      text: chosenCandidate.text,
      category: chosenCandidate.category as TaskCategory,
      timeSlot: currentTask.timeSlot,
      priority: currentTask.priority,
      status: 'pending',
      estimatedTime: chosenCandidate.estimatedTime || '5 mins',
      rationale: chosenCandidate.rationale || 'Tailored alternative selected for your daily routine.',
      completed: false,
      completedAt: null,
    };

    tasks[taskIndex] = replacementTask;

    const newScore = this.computeScore(metrics, tasks);
    const newInsight = this.generateInsight(metrics, planData.wellness_mode || wellnessMode, tasks);

    await this.supabase
      .from('wellness_plans')
      .update({
        content: JSON.stringify(tasks),
        updated_at: new Date().toISOString(),
      })
      .eq('id', planData.id);

    return {
      success: true,
      task: replacementTask,
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
        wellnessMode: planData.wellness_mode || wellnessMode,
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
      // 1. Try Mistral AI first (high speed, reliable JSON format)
      const mistralKey = process.env.MISTRAL_API_KEY;
      if (mistralKey) {
        for (const mName of ['open-mistral-nemo', 'open-mistral-7b']) {
          try {
            const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${mistralKey}`,
              },
              body: JSON.stringify({
                model: mName,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.55,
                max_tokens: 1200,
                response_format: { type: 'json_object' },
              }),
            });
            const d = await res.json();
            const text = d?.choices?.[0]?.message?.content;
            if (text) {
              const jsonMatch = text.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (Array.isArray(parsed.tasks) && parsed.tasks.length > 0) {
                  raw = parsed.tasks;
                  break;
                }
              }
            }
          } catch (mistralErr) {
            console.warn(`[WellnessPlanService] Mistral model ${mName} task generation error:`, mistralErr);
          }
        }
      }

      // 2. Try Gemini as secondary fallback if Mistral did not produce tasks
      if ((!raw || raw.length === 0) && this.gemini) {
        for (const mName of ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-flash-latest']) {
          try {
            const model = this.gemini.getGenerativeModel({ model: mName });
            const result = await model.generateContent(prompt);
            const text = result.response.text();
            // Extract JSON if wrapped in markdown code fence
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              if (Array.isArray(parsed.tasks) && parsed.tasks.length > 0) {
                raw = parsed.tasks;
                break;
              }
            }
          } catch (geminiError) {
            console.warn(`[WellnessPlanService] Gemini model ${mName} task generation error:`, geminiError);
          }
        }
      }

      // 3. Try Groq as tertiary provider if Gemini and Mistral did not produce tasks
      if ((!raw || raw.length === 0) && this.groq) {
        let resp: any = null;
        try {
          const groqCall = this.groq.chat.completions.create({
            model: 'openai/gpt-oss-20b',
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
          try {
            const fallbackCall = this.groq.chat.completions.create({
              model: 'openai/gpt-oss-120b',
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.55,
              max_tokens: 800,
              response_format: { type: 'json_object' },
            });
            resp = await fallbackCall;
          } catch {
            const fallbackCall2 = this.groq.chat.completions.create({
              model: 'llama-3.3-70b-versatile',
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.55,
              max_tokens: 800,
              response_format: { type: 'json_object' },
            });
            resp = await fallbackCall2;
          }
        }

        const parsed = JSON.parse(resp?.choices?.[0]?.message?.content || '{}');
        raw = parsed.tasks || [];
      }
    } catch {
      // Instant fallback to high quality rule tasks
    }

    if (!Array.isArray(raw) || raw.length < 3) {
      raw = this.ruleTasksForSlot(m, mode, slot, todayStr);
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

    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];
    const slotSpecificData = m.slotMeta?.[slot]?.data || m.latestSlotData || {};
    const slotIndicators = slotSpecificData.indicators || m.indicators || {};

    let cycleContext = 'standard wellness balance';
    if (m.cycleStatus === 'menstrual') {
      cycleContext = 'User is in menstrual phase. Emphasize warm hydration, iron-rich nutrition, gentle pelvic ease, and calming rest.';
    } else if (m.cycleStatus === 'follicular') {
      cycleContext = 'User is in follicular phase. Energy is rising. Support progressive mobility, creative focus, and nutrient variety.';
    } else if (m.cycleStatus === 'ovulation') {
      cycleContext = 'User is in ovulation phase. Peak vitality and confidence. Support hydration, steady movement, and high motivation.';
    } else if (m.cycleStatus === 'luteal') {
      cycleContext = 'User is in luteal phase. Prioritize blood-sugar balance, cortisol lowering, magnesium, and soothing premenstrual tension.';
    }

    return `You are a premium personal AI wellness coach. Generate exactly 3 to 4 personalized, non-repetitive daily tasks for the ${slot.toUpperCase()} time slot on ${dayName} based on the user's daily wellness check-in.

SLOT CONTEXT: ${slotContext}

USER 10-DIMENSION WELLNESS ASSESSMENT FOR TODAY:
- Mode: ${mode} (general | pcos | pregnancy)
- Current Check-in Slot: ${slot}
- Stress Indicator: ${slotIndicators.stress?.score ? `${slotIndicators.stress.score}/5.0 (${slotIndicators.stress.level ?? 'Calculated'})` : (m.todayStress ? `${m.todayStress}/5.0` : 'not logged')}
- Emotional Headspace / Mood: ${slotIndicators.mood?.state ?? m.todayMood ?? 'balanced'}
- Energy Level: ${slotIndicators.energy?.level ?? m.todayEnergy ?? 'Moderate'}
- Sleep Quality: ${m.todaySleep ? `${m.todaySleep}h` : 'not logged'}
- Support Focus: ${slotSpecificData.supportChoice ?? m.todaySupport ?? 'general wellness'}
- Cycle Phase: ${m.cycleStatus} (${cycleContext})
- Skin / Acne Condition: ${m.acneAvg.toFixed(1)}/10

SMART PERSONALIZATION RULES:
- High Variety: Create fresh, distinctive micro-actions for today (${dayName}) rather than repetitive generic tasks.
- If energy is Low or sleep was poor: recommend a gentler, restorative plan (e.g. 5-min breathing, light stretch, warm hydration).
- If hydration is needed: prioritize water intake.
- If stress signals are elevated: include an interactive calming nervous system reset task (e.g. box breathing or 4-7-8 breath).
- Only generate tasks for the '${slot}' slot — DO NOT mix slots.
- Provide a brief 1-sentence 'rationale' explaining WHY this task was assigned based on the user's check-in.
- NEVER recommend medicines, medical drugs, or diagnose diseases.
- PCOS mode: prioritize stress reduction, metabolic rhythm, gentle mobility.
- PREGNANCY mode: gentle maternal wellness, hydration, posture rest.
- Include realistic 'estimatedTime' (e.g. "2 mins", "3 mins", "5 mins", "10 mins").

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

  /**
   * Complete 36+ science-backed wellness tasks library across all dimensions,
   * adapted for mode and menstrual cycle phase.
   */
  getAllRuleTasksForSlot(slot: TaskTimeSlot, mode: string, m?: any): any[] {
    const cycle = m?.cycleStatus || 'insufficient_data';
    const isElevatedStress = (m?.todayStress !== null && m?.todayStress > 3.0) || m?.todayEnergy === 'Low';

    if (slot === 'morning') {
      const pool = [
        {
          text: 'Drink a full glass of warm water (500ml) with optional lemon upon waking.',
          category: 'hydration',
          priority: 'high',
          estimatedTime: '2 mins',
          rationale: 'Rehydrating upon waking jumpstarts metabolism and clears morning brain fog.',
        },
        {
          text: 'Sip a glass of water before reaching for coffee or tea.',
          category: 'hydration',
          priority: 'recommended',
          estimatedTime: '2 mins',
          rationale: 'Pre-caffeine hydration prevents cortisol spikes and supports adrenal balance.',
        },
        {
          text: 'Practice 4-7-8 calming breathing technique for 3 minutes.',
          category: 'stress',
          priority: isElevatedStress ? 'high' : 'recommended',
          estimatedTime: '3 mins',
          rationale: 'Controlled breathing down-regulates morning sympathetic nervous activation.',
        },
        {
          text: 'Do 3 minutes of grounding box breathing (4s in, 4s hold, 4s out, 4s hold).',
          category: 'stress',
          priority: 'recommended',
          estimatedTime: '3 mins',
          rationale: 'Box breathing stabilizes blood pressure and clears mental scatter.',
        },
        {
          text: 'Take 5 deep conscious breath cycles and set one gentle intention for today.',
          category: 'mindfulness',
          priority: 'recommended',
          estimatedTime: '3 mins',
          rationale: 'Conscious intention setting centers your headspace before daytime demands.',
        },
        {
          text: 'Step by a window or outside for 3 minutes of natural morning sunlight.',
          category: 'mindfulness',
          priority: 'recommended',
          estimatedTime: '3 mins',
          rationale: 'Morning sunlight stimulates retinal receptors to set your circadian rhythm and nighttime melatonin.',
        },
        {
          text: 'Do a gentle 5-minute morning mobility stretch for spine and hips.',
          category: 'exercise',
          priority: 'recommended',
          estimatedTime: '5 mins',
          rationale: 'Gentle stretching lubricates joints and promotes full-body circulation after sleep.',
        },
        {
          text: 'Take an energizing 10-minute brisk walk to wake up your body.',
          category: 'exercise',
          priority: 'optional',
          estimatedTime: '10 mins',
          rationale: 'Brisk morning walking promotes glucose uptake and elevates natural dopamine.',
        },
        {
          text: 'Enjoy a balanced breakfast with protein and healthy fats to stabilize insulin.',
          category: 'nutrition',
          priority: 'high',
          estimatedTime: '15 mins',
          rationale: 'Protein-first morning fuel prevents blood-sugar crashes and reduces afternoon cravings.',
        },
        {
          text: 'Sip warm ginger or spearmint infusion to soothe digestion and balance hormones.',
          category: 'cycle',
          priority: 'recommended',
          estimatedTime: '5 mins',
          rationale: 'Spearmint and ginger support gentle androgen balance and digestive comfort.',
        },
      ];

      if (mode === 'pcos') {
        pool.push({
          text: 'Add 1 tablespoon of ground flaxseeds or chia seeds to your morning meal.',
          category: 'nutrition',
          priority: 'high',
          estimatedTime: '2 mins',
          rationale: 'Lignans and omega-3s in seeds assist healthy estrogen metabolism and insulin response.',
        });
      } else if (mode === 'pregnancy') {
        pool.push({
          text: 'Enjoy a nourishing maternal breakfast with eggs or whole oats and hydrate slowly.',
          category: 'pregnancy',
          priority: 'high',
          estimatedTime: '15 mins',
          rationale: 'Steady morning protein supports maternal tissue growth and minimizes morning nausea.',
        });
      } else if (cycle === 'menstrual') {
        pool.push({
          text: 'Apply gentle warmth to your lower abdomen and do seated pelvic tilts.',
          category: 'cycle',
          priority: 'high',
          estimatedTime: '5 mins',
          rationale: 'Gentle pelvic mobility relaxes uterine ligaments and eases menstrual cramp tension.',
        });
      }

      return pool;
    }

    if (slot === 'afternoon') {
      const pool = [
        {
          text: 'Drink 2 full glasses of water (500ml) to conquer the afternoon energy dip.',
          category: 'hydration',
          priority: 'high',
          estimatedTime: '2 mins',
          rationale: 'Midday hydration directly combats cellular fatigue and improves focus.',
        },
        {
          text: 'Infuse cold water with cucumber or fresh mint for refreshing cellular hydration.',
          category: 'hydration',
          priority: 'recommended',
          estimatedTime: '3 mins',
          rationale: 'Electrolyte-infused water encourages optimal fluid absorption during peak afternoon hours.',
        },
        {
          text: 'Take a 5-minute screen-free quiet pause to rest your eyes and nervous system.',
          category: 'stress',
          priority: isElevatedStress ? 'high' : 'recommended',
          estimatedTime: '5 mins',
          rationale: 'Stepping away from blue light reduces optic strain and lowers midday cortisol.',
        },
        {
          text: 'Practice a 3-minute physiological sigh (double inhale through nose, long slow exhale through mouth).',
          category: 'stress',
          priority: 'recommended',
          estimatedTime: '3 mins',
          rationale: 'The double inhale rapidly offloads carbon dioxide and immediately slows heart rate.',
        },
        {
          text: 'Stand up and do a quick 3-minute posture reset with shoulder and neck rolls.',
          category: 'exercise',
          priority: 'recommended',
          estimatedTime: '3 mins',
          rationale: 'Releasing trapezius tension relieves desk posture strain and opens the chest for better breathing.',
        },
        {
          text: 'Take a short 8-minute walking lap around your building or block.',
          category: 'exercise',
          priority: 'optional',
          estimatedTime: '8 mins',
          rationale: 'Post-lunch walking blunts the glucose peak and prevents sluggish brain fog.',
        },
        {
          text: 'Enjoy a protein or fiber-rich afternoon snack (handful of almonds or berries).',
          category: 'nutrition',
          priority: 'recommended',
          estimatedTime: '5 mins',
          rationale: 'A smart fiber-protein snack prevents cortisol-driven sugar cravings before dinner.',
        },
        {
          text: 'Opt for warm green or herbal tea instead of high-sugar coffee.',
          category: 'nutrition',
          priority: 'recommended',
          estimatedTime: '5 mins',
          rationale: 'L-theanine in green tea provides calm, focused alert energy without caffeine jitters.',
        },
        {
          text: 'Do a 2-minute posture check: relax your jaw, drop your shoulders, and breathe into your belly.',
          category: 'mindfulness',
          priority: 'recommended',
          estimatedTime: '2 mins',
          rationale: 'Releasing subconscious micro-tensions restores natural alignment.',
        },
        {
          text: 'Rest your lower back against a supportive cushion and take 5 slow deep breaths.',
          category: 'cycle',
          priority: 'recommended',
          estimatedTime: '5 mins',
          rationale: 'Relieving pelvic pressure supports lumbar stability during luteal or menstrual phases.',
        },
      ];

      if (mode === 'pcos') {
        pool.push({
          text: 'Pair any afternoon snack with raw nuts or cinnamon to smooth the insulin response.',
          category: 'nutrition',
          priority: 'high',
          estimatedTime: '3 mins',
          rationale: 'Cinnamon and healthy fats slow carbohydrate absorption for hormonal stability.',
        });
      } else if (mode === 'pregnancy') {
        pool.push({
          text: 'Sit comfortably with feet elevated on a stool for 10 minutes to support venous return.',
          category: 'pregnancy',
          priority: 'high',
          estimatedTime: '10 mins',
          rationale: 'Gentle leg elevation reduces dependent edema and relieves maternal pelvic pressure.',
        });
      }

      return pool;
    }

    // Evening slot
    const pool = [
      {
        text: 'Dim bright overhead lights and switch to warm, soft lighting 1 hour before bed.',
        category: 'sleep',
        priority: 'high',
        estimatedTime: '2 mins',
        rationale: 'Warm low light signals your pineal gland to naturally produce melatonin for deep sleep.',
      },
      {
        text: 'Put all work screens into Night Mode or step away from digital devices 30 minutes before sleep.',
        category: 'sleep',
        priority: 'recommended',
        estimatedTime: '5 mins',
        rationale: 'Eliminating blue light before bed prevents sleep fragmentation.',
      },
      {
        text: 'Do a 5-minute brain dump on paper to release lingering to-do thoughts.',
        category: 'stress',
        priority: isElevatedStress ? 'high' : 'recommended',
        estimatedTime: '5 mins',
        rationale: 'Externalizing worries onto paper clears working memory and halts bedtime rumination.',
      },
      {
        text: 'Practice 3 minutes of legs-up-the-wall pose (Viparita Karani) to calm your nervous system.',
        category: 'stress',
        priority: 'recommended',
        estimatedTime: '5 mins',
        rationale: 'Elevating legs promotes venous drainage and strongly stimulates vagal tone for deep relaxation.',
      },
      {
        text: 'Reflect on 2 things you are grateful for or proud of navigating today.',
        category: 'mindfulness',
        priority: 'recommended',
        estimatedTime: '3 mins',
        rationale: 'Gratitude rewires neural pathways for safety and restful emotional processing during sleep.',
      },
      {
        text: 'Listen to a soothing 5-minute guided sleep meditation or ambient white noise.',
        category: 'mindfulness',
        priority: 'recommended',
        estimatedTime: '5 mins',
        rationale: 'Soothing frequencies lower autonomic arousal and prepare brain waves for slow-wave sleep.',
      },
      {
        text: 'Sip a warm cup of caffeine-free chamomile, peppermint, or lavender tea.',
        category: 'hydration',
        priority: 'recommended',
        estimatedTime: '5 mins',
        rationale: 'Warm herbal tea relaxes gastrointestinal muscles and creates a soothing sensory bedtime cue.',
      },
      {
        text: 'Do 5 minutes of gentle lying-down restorative twists and hamstring stretches in bed.',
        category: 'exercise',
        priority: 'optional',
        estimatedTime: '5 mins',
        rationale: 'Restorative stretching down-regulates muscle spindles and eases somatic tension.',
      },
      {
        text: 'Take 3 long, audible exhales, letting go of today’s unfinished tasks until tomorrow.',
        category: 'stress',
        priority: 'recommended',
        estimatedTime: '2 mins',
        rationale: 'Verbalized exhalations signal absolute completion of the day to your subconscious mind.',
      },
    ];

    if (mode === 'pcos') {
      pool.push({
        text: 'Take a warm magnesium bath or sip magnesium glycinate tea for restorative sleep and cortisol support.',
        category: 'nutrition',
        priority: 'high',
        estimatedTime: '10 mins',
        rationale: 'Magnesium regulates GABA receptors, soothing the nervous system and improving insulin sensitivity.',
      });
    } else if (mode === 'pregnancy') {
      pool.push({
        text: 'Settle into a comfortable side-sleeping position with a pillow between knees for spine alignment.',
        category: 'pregnancy',
        priority: 'high',
        estimatedTime: '5 mins',
        rationale: 'Left-side sleeping optimizes placental blood flow and relieves pressure on the inferior vena cava.',
      });
    } else if (cycle === 'menstrual') {
      pool.push({
        text: 'Apply a warm hot water bottle or heating pad to lower abdomen for 10 minutes.',
        category: 'cycle',
        priority: 'high',
        estimatedTime: '10 mins',
        rationale: 'Mild warmth increases local vasodilation, easing uterine contractions and pelvic stiffness.',
      });
    }

    return pool;
  }

  private ruleTasksForSlot(m: any, mode: string, slot: TaskTimeSlot, todayStr?: string): any[] {
    const all = this.getAllRuleTasksForSlot(slot, mode, m);
    const dayIndex = todayStr && todayStr.length >= 10
      ? (parseInt(todayStr.slice(8, 10), 10) || 0) % 3
      : new Date().getDay() % 3;

    // Pick 3 diverse tasks rotated by dayIndex
    const isElevatedStress = (m?.todayStress !== null && m?.todayStress > 3.0) || m?.todayEnergy === 'Low';
    const selected: any[] = [];

    // 1. Primary Slot Task
    selected.push(all[0]);

    // 2. Stress / Mindfulness Task
    const stressOrMind = all.filter(t => t.category === 'stress' || t.category === 'mindfulness');
    if (stressOrMind.length > 0) {
      const idx = isElevatedStress ? 0 : (dayIndex % stressOrMind.length);
      selected.push(stressOrMind[idx]);
    }

    // 3. Movement / Mode / Nutrition Task
    const modeOrMovement = all.filter(t => ['exercise', 'nutrition', 'pregnancy', 'cycle'].includes(t.category));
    if (modeOrMovement.length > 0) {
      const idx = (dayIndex + 1) % modeOrMovement.length;
      selected.push(modeOrMovement[idx]);
    }

    return selected;
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
