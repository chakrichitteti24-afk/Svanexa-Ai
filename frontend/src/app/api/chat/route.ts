import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/utils/supabase/server';
import { AIService } from '@/lib/services/ai-service';
import { format, differenceInDays, addDays } from 'date-fns';

function getCurrentSlotLabel(): 'morning' | 'afternoon' | 'evening' {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 18) return 'afternoon';
  return 'evening';
}

function calculateCycleDetails(cycleLogs: any[]) {
  if (!cycleLogs || cycleLogs.length === 0) {
    return {
      phase: 'unknown',
      cycleDay: null,
      daysUntilPeriod: null,
      isOnPeriod: false,
      isLate: false,
      lastPeriodStart: null,
      averageCycleLength: 28,
    };
  }

  const latest = cycleLogs[0];
  const today = new Date();
  const startDate = new Date(latest.start_date);
  const cycleDay = differenceInDays(today, startDate) + 1;

  let isOnPeriod = false;
  if (latest.end_date) {
    const endDate = new Date(latest.end_date);
    isOnPeriod = today >= startDate && today <= endDate;
  } else {
    isOnPeriod = cycleDay >= 1 && cycleDay <= 5;
  }

  let avgLength = 28;
  if (cycleLogs.length > 1) {
    let totalDays = 0;
    let validGaps = 0;
    for (let i = 0; i < cycleLogs.length - 1; i++) {
      const gap = differenceInDays(new Date(cycleLogs[i].start_date), new Date(cycleLogs[i + 1].start_date));
      if (gap >= 20 && gap <= 60) {
        totalDays += gap;
        validGaps++;
      }
    }
    if (validGaps > 0) {
      avgLength = Math.round(totalDays / validGaps);
    }
  }

  const nextPredictedDate = addDays(startDate, avgLength);
  const daysUntilPeriod = differenceInDays(nextPredictedDate, today);
  const isLate = daysUntilPeriod < 0;

  let phase = 'follicular';
  if (isOnPeriod || cycleDay <= 5) {
    phase = 'menstrual';
  } else if (cycleDay <= 13) {
    phase = 'follicular';
  } else if (cycleDay <= 17) {
    phase = 'ovulation';
  } else {
    phase = 'luteal';
  }

  return {
    phase,
    cycleDay: cycleDay > 0 && cycleDay <= 60 ? cycleDay : null,
    daysUntilPeriod,
    isOnPeriod,
    isLate,
    lastPeriodStart: latest.start_date,
    flowIntensity: latest.flow_intensity || null,
    averageCycleLength: avgLength,
  };
}

function calculatePregnancyDetails(pregnancyLog: any) {
  if (!pregnancyLog?.due_date) return null;
  try {
    const today = new Date();
    const dueDate = new Date(pregnancyLog.due_date);
    const daysRemaining = differenceInDays(dueDate, today);
    const totalDays = 280; // 40 weeks
    const daysPregnant = Math.max(0, totalDays - daysRemaining);
    const currentWeek = Math.min(42, Math.max(1, Math.floor(daysPregnant / 7) + 1));
    const trimester = currentWeek <= 13 ? 1 : currentWeek <= 27 ? 2 : 3;

    return {
      dueDate: pregnancyLog.due_date,
      currentWeek,
      trimester,
      daysRemaining: Math.max(0, daysRemaining),
    };
  } catch {
    return { dueDate: pregnancyLog.due_date };
  }
}

export async function POST(req: Request) {
  try {
    const { supabase, user, error: authError } = await getAuthenticatedUser(req);

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { message, history, currentPage } = body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Message is required' }, { status: 400 });
    }

    if (message.length > 4000) {
      return NextResponse.json({ success: false, error: 'Message cannot exceed 4000 characters' }, { status: 400 });
    }

    const sanitizedMessage = message.trim();
    const userId = user.id;
    const today = format(new Date(), 'yyyy-MM-dd');
    const currentSlot = getCurrentSlotLabel();

    // Fetch all user activity and health logs in parallel
    const [
      { data: profile },
      { data: userPref },
      { data: todayCheckin },
      { data: recentCheckins },
      { data: todaySleep },
      { data: recentSleep },
      { data: todayMood },
      { data: recentMoods },
      { data: todayWater },
      { data: recentWater },
      { data: todayExercise },
      { data: recentExercise },
      { data: recentSkin },
      { data: cycleLogs },
      { data: pregnancyLog },
      { data: todayPlan },
      { data: streakData },
      { data: coinBalance },
    ] = await Promise.all([
      // Profile information
      supabase.from('profiles').select('first_name, ai_name, active_theme, date_of_birth').eq('id', userId).maybeSingle(),
      // User preferences
      supabase.from('user_preferences').select('theme, language, reminders').eq('user_id', userId).maybeSingle(),
      // Today's check-in summary
      supabase.from('daily_checkins').select('summary, updated_at').eq('user_id', userId).eq('date', today).maybeSingle(),
      // Recent check-ins (last 7 days)
      supabase.from('daily_checkins').select('date, summary').eq('user_id', userId).order('date', { ascending: false }).limit(7),
      // Today's sleep log
      supabase.from('sleep_logs').select('duration_hours, quality').eq('user_id', userId).eq('date', today).maybeSingle(),
      // Recent sleep logs (last 7 days)
      supabase.from('sleep_logs').select('date, duration_hours, quality').eq('user_id', userId).order('date', { ascending: false }).limit(7),
      // Today's mood log
      supabase.from('mood_logs').select('mood, intensity, notes').eq('user_id', userId).eq('date', today).maybeSingle(),
      // Recent mood logs (last 7 days)
      supabase.from('mood_logs').select('date, mood, intensity').eq('user_id', userId).order('date', { ascending: false }).limit(7),
      // Today's water log
      supabase.from('water_logs').select('amount_ml').eq('user_id', userId).eq('date', today).maybeSingle(),
      // Recent water logs (last 7 days)
      supabase.from('water_logs').select('date, amount_ml').eq('user_id', userId).order('date', { ascending: false }).limit(7),
      // Today's exercise log
      supabase.from('exercise_logs').select('duration_minutes, type, intensity').eq('user_id', userId).eq('date', today).maybeSingle(),
      // Recent exercise logs (last 7 days)
      supabase.from('exercise_logs').select('date, duration_minutes, type, intensity').eq('user_id', userId).order('date', { ascending: false }).limit(7),
      // Recent skin logs (last 5 entries)
      supabase.from('skin_logs').select('log_date, acne_level, skin_type, notes, breakouts').eq('user_id', userId).order('log_date', { ascending: false }).limit(5),
      // Cycle logs (last 6 cycles)
      supabase.from('cycle_logs').select('start_date, end_date, flow_intensity, notes').eq('user_id', userId).order('start_date', { ascending: false }).limit(6),
      // Pregnancy log
      supabase.from('pregnancy_logs').select('due_date, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      // Today's wellness plan tasks
      supabase.from('wellness_plans').select('content').eq('user_id', userId).eq('title', today).maybeSingle(),
      // Wellness streaks
      supabase.from('wellness_streaks').select('current_streak, longest_streak, weekly_consistency, last_active_date').eq('user_id', userId).maybeSingle(),
      // User coin balance
      supabase.from('user_coin_balances').select('balance, total_earned').eq('user_id', userId).maybeSingle(),
    ]);

    const wellnessMode =
      userPref?.theme && ['general', 'pcos', 'pregnancy'].includes(userPref.theme)
        ? userPref.theme
        : profile?.active_theme && ['general', 'pcos', 'pregnancy'].includes(profile.active_theme)
        ? profile.active_theme
        : pregnancyLog
        ? 'pregnancy'
        : 'general';
    const companionName = profile?.ai_name || 'Luna';
    const userName = profile?.first_name || 'there';

    // ── Parse today's check-in slot details ──────────────────────────────────
    let slotMeta: Record<string, any> = {};
    if (todayCheckin?.summary) {
      try {
        slotMeta = JSON.parse(todayCheckin.summary);
      } catch {
        slotMeta = {};
      }
    }

    const completedSlots = ['morning', 'afternoon', 'evening'].filter(s => slotMeta[s]?.completed);
    const morningData = slotMeta.morning?.data || null;
    const afternoonData = slotMeta.afternoon?.data || null;
    const eveningData = slotMeta.evening?.data || null;

    const latestSlotData = eveningData || afternoonData || morningData || {};
    const indicators = latestSlotData.indicators || {};

    // ── Parse today's wellness plan tasks ────────────────────────────────────
    let wellnessTasks: any[] = [];
    if (todayPlan?.content) {
      try {
        wellnessTasks = JSON.parse(todayPlan.content);
      } catch {
        wellnessTasks = [];
      }
    }
    const completedTasks = wellnessTasks.filter((t: any) => t.completed || t.status === 'completed');
    const pendingTasks = wellnessTasks.filter((t: any) => !t.completed && t.status !== 'completed');

    // ── Parse multi-day averages ─────────────────────────────────────────────
    const validSleepLogs = (recentSleep || []).filter((s: any) => s.duration_hours && Number(s.duration_hours) > 0);
    const avgSleep = validSleepLogs.length > 0
      ? Math.round((validSleepLogs.reduce((acc: number, s: any) => acc + Number(s.duration_hours), 0) / validSleepLogs.length) * 10) / 10
      : null;

    const validWaterLogs = (recentWater || []).filter((w: any) => w.amount_ml && Number(w.amount_ml) > 0);
    const avgWater = validWaterLogs.length > 0
      ? Math.round(validWaterLogs.reduce((acc: number, w: any) => acc + Number(w.amount_ml), 0) / validWaterLogs.length)
      : null;

    const totalExerciseRecent = (recentExercise || []).reduce((acc: number, e: any) => acc + (Number(e.duration_minutes) || 0), 0);

    const cycleInfo = calculateCycleDetails(cycleLogs || []);
    const pregnancyInfo = calculatePregnancyDetails(pregnancyLog);

    // ── Comprehensive Omni-Aware Context Object ─────────────────────────────
    const aiContext = {
      user: {
        name: userName,
        mode: wellnessMode,
        companionName: companionName,
        currentPage: currentPage || 'App',
      },
      currentSlot,
      date: today,
      todayActivity: {
        checkinSlotsCompleted: completedSlots,
        isAllSlotsComplete: completedSlots.length === 3,
        morning: morningData ? {
          sleepRating: morningData.sleep || morningData.answers?.m_sleep || null,
          energyLevel: morningData.indicators?.energy?.level || morningData.answers?.m_energy || null,
          stressIndicator: morningData.indicators?.stress?.level || morningData.stressIndicator || null,
          focus: morningData.answers?.m_focus || morningData.supportChoice || null,
        } : null,
        afternoon: afternoonData ? {
          stressLevel: afternoonData.stress || afternoonData.indicators?.stress?.level || null,
          energyLevel: afternoonData.indicators?.energy?.level || afternoonData.answers?.a_energy || null,
          lunchLogged: afternoonData.answers?.a_lunch || null,
          symptoms: afternoonData.answers?.a_symptoms || null,
        } : null,
        evening: eveningData ? {
          eveningMood: eveningData.mood || eveningData.indicators?.mood?.state || null,
          winddown: eveningData.answers?.e_winddown || null,
          reflection: eveningData.answers?.e_reflection || null,
          dinner: eveningData.answers?.e_dinner || null,
        } : null,
        sleep: todaySleep?.duration_hours ? `${todaySleep.duration_hours} hours` : (indicators.sleepRating ? `${indicators.sleepRating}/5 rating` : null),
        water: todayWater?.amount_ml ? `${todayWater.amount_ml} ml` : null,
        exercise: todayExercise?.duration_minutes ? `${todayExercise.duration_minutes} mins (${todayExercise.type || 'activity'})` : null,
        mood: todayMood?.mood || indicators.mood?.state || null,
      },
      wellnessPlan: {
        totalTasksCount: wellnessTasks.length,
        completedTasksCount: completedTasks.length,
        pendingTasksCount: pendingTasks.length,
        pendingTasks: pendingTasks.map((t: any) => ({
          title: t.title || t.text || t.name,
          category: t.category,
          timeSlot: t.timeSlot || t.slot,
        })),
        completedTasks: completedTasks.map((t: any) => ({
          title: t.title || t.text || t.name,
          category: t.category,
        })),
      },
      healthTrends: {
        sevenDayAvgSleep: avgSleep ? `${avgSleep} hours/night` : null,
        sevenDayAvgWater: avgWater ? `${avgWater} ml/day` : null,
        sevenDayTotalExercise: totalExerciseRecent > 0 ? `${totalExerciseRecent} minutes` : '0 minutes',
        recentMoods: (recentMoods || []).slice(0, 5).map((m: any) => ({ date: m.date, mood: m.mood })),
        recentCheckinDates: (recentCheckins || []).map((c: any) => c.date),
      },
      skinTracking: recentSkin && recentSkin.length > 0 ? {
        latestDate: recentSkin[0].log_date,
        acneLevel: recentSkin[0].acne_level,
        skinType: recentSkin[0].skin_type,
        notes: recentSkin[0].notes,
        breakouts: recentSkin[0].breakouts,
      } : null,
      cycleIntelligence: cycleInfo,
      pregnancyIntelligence: pregnancyInfo,
      gamification: {
        streakDays: streakData?.current_streak || 0,
        longestStreak: streakData?.longest_streak || 0,
        coinBalance: coinBalance?.balance || 0,
        totalEarnedCoins: coinBalance?.total_earned || 0,
      },
    };

    const contextStr = `[USER CONTEXT]:\n${JSON.stringify(aiContext, null, 2)}`;

    const formattedHistory = (history || []).map((msg: any) => ({
      role: msg.role === 'model' || msg.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: msg.content || msg.text || ''
    }));

    const ai = new AIService();
    const result = await ai.generateCompanionResponse(
      sanitizedMessage,
      formattedHistory,
      contextStr,
      companionName,
      userName,
      false
    );

    return NextResponse.json({
      success: true,
      response: result.response,
      modelUsed: result.modelUsed,
      error: result.error
    });
  } catch (error: any) {
    console.error('[Chat API Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

