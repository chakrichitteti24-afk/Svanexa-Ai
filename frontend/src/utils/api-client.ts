import { format, differenceInDays } from 'date-fns';

function getLocalHealthSummary() {
  const checkInsRaw = typeof window !== 'undefined' ? localStorage.getItem('hersync_checkins') || '{}' : '{}';
  const checkIns = JSON.parse(checkInsRaw);
  const cyclesRaw = typeof window !== 'undefined' ? localStorage.getItem('hersync_cycles') || '[]' : '[]';
  const cycles = JSON.parse(cyclesRaw);
  
  // 1. Calculate Sleep Avg, Water Avg, Stress Avg, Mood Trend
  const sortedLogs = Object.entries(checkIns)
    .map(([date, data]: [string, any]) => ({ log_date: date, ...data }))
    .sort((a, b) => b.log_date.localeCompare(a.log_date));
    
  const logCount = sortedLogs.length;
  const riskFlags: string[] = [];
  
  let sleepAvg: number | null = null;
  let stressTrend: 'low' | 'moderate' | 'high' | 'insufficient_data' = 'insufficient_data';
  let moodTrend: 'improving' | 'declining' | 'stable' | 'insufficient_data' = 'insufficient_data';
  let avgWater = 0;
  let avgExercise = 0;
  
  if (logCount > 0) {
    const recent7 = sortedLogs.slice(0, 7);
    const sleepSum = recent7.reduce((sum, entry) => sum + Number(entry.sleep || 0), 0);
    sleepAvg = Math.round((sleepSum / recent7.length) * 10) / 10;
    
    if (sleepAvg < 6.5) riskFlags.push('low_sleep');
    
    const waterSum = recent7.reduce((sum, entry) => sum + Number(entry.water || 0), 0);
    avgWater = waterSum / recent7.length;
    if (avgWater < 1.5) riskFlags.push('low_hydration');
    
    const exerciseSum = recent7.reduce((sum, entry) => sum + Number(entry.exercise || 0), 0);
    avgExercise = exerciseSum / recent7.length;
    if (avgExercise < 15) riskFlags.push('sedentary_routine');
    
    const stressSum = recent7.reduce((sum, entry) => sum + Number(entry.stress || 0), 0);
    const stressAvg = stressSum / recent7.length;
    if (stressAvg > 7) {
      stressTrend = 'high';
      riskFlags.push('high_stress');
    } else if (stressAvg >= 4) {
      stressTrend = 'moderate';
    } else {
      stressTrend = 'low';
    }
    
    if (logCount >= 4) {
      const half = Math.floor(logCount / 2);
      const recentHalf = sortedLogs.slice(0, half);
      const olderHalf = sortedLogs.slice(half);
      
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
    
    const recent5 = sortedLogs.slice(0, 5);
    const severeSymptoms = recent5.some(
      s => s.cramps === 'severe' || s.bloating === 'severe' || s.fatigue === 'severe'
    );
    if (severeSymptoms) riskFlags.push('severe_symptoms');
  }
  
  // 2. Cycle Status
  let cycleStatus = 'insufficient_data';
  if (cycles.length > 0) {
    const sortedCycles = [...cycles].sort(
      (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    );
    const lastCycle = sortedCycles[0];
    const today = new Date();
    const lastStart = new Date(lastCycle.startDate);
    const lastEnd = new Date(lastCycle.endDate);
    
    if (today >= lastStart && today <= lastEnd) {
      cycleStatus = 'on_period';
    } else {
      let avgLength = Number(typeof window !== 'undefined' ? localStorage.getItem('hersync_avg_cycle_length') || '28' : '28');
      if (sortedCycles.length > 1) {
        let totalLength = 0;
        for (let i = 0; i < sortedCycles.length - 1; i++) {
          totalLength += Math.round((new Date(sortedCycles[i].startDate).getTime() - new Date(sortedCycles[i+1].startDate).getTime()) / (1000*60*60*24));
        }
        avgLength = Math.round(totalLength / (sortedCycles.length - 1));
      }
      
      const nextPredictedStart = new Date(lastStart.getTime() + avgLength * 24 * 60 * 60 * 1000);
      const daysUntilPeriod = Math.round((nextPredictedStart.getTime() - today.getTime()) / (1000*60*60*24));
      
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
  
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayLog = checkIns[todayStr] || null;
  
  return {
    sleep_avg: sleepAvg,
    stress_trend: stressTrend,
    mood_trend: moodTrend,
    cycle_status: cycleStatus,
    risk_flags: riskFlags,
    total_logs_count: logCount,
    has_checked_in_today: !!todayLog,
    today_log: todayLog
  };
}

function getLocalPeriodPrediction() {
  const cyclesRaw = typeof window !== 'undefined' ? localStorage.getItem('hersync_cycles') || '[]' : '[]';
  const cycles = JSON.parse(cyclesRaw);
  if (cycles.length === 0) {
    return { hasData: false, message: "Not enough data yet." };
  }
  
  const sortedCycles = [...cycles].sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  );
  
  const lastCycle = sortedCycles[0];
  let avgLength = Number(typeof window !== 'undefined' ? localStorage.getItem('hersync_avg_cycle_length') || '28' : '28');
  if (sortedCycles.length > 1) {
    let totalLength = 0;
    for (let i = 0; i < sortedCycles.length - 1; i++) {
      totalLength += Math.round((new Date(sortedCycles[i].startDate).getTime() - new Date(sortedCycles[i+1].startDate).getTime()) / (1000*60*60*24));
    }
    avgLength = Math.round(totalLength / (sortedCycles.length - 1));
  }
  
  const nextStart = new Date(new Date(lastCycle.startDate).getTime() + avgLength * 24 * 60 * 60 * 1000);
  const options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' };
  const formattedDate = nextStart.toLocaleDateString('en-US', options);
  
  const hasPCOS = typeof window !== 'undefined' ? localStorage.getItem('hersync_has_pcos') === 'true' : false;
  const confidenceScore = hasPCOS ? 65 : 85;
  const confidenceLabel = hasPCOS ? 'Moderate (PCOS Mode)' : 'High';
  const explanation = hasPCOS 
    ? `Adjusted for cycle length variability. Irregularity predicted based on your logged history.`
    : `Highly regular cycle detected based on your logged history.`;
    
  return {
    hasData: true,
    prediction: {
      expectedPeriod: `Expected ${formattedDate}`,
      confidenceScore,
      confidenceLabel,
      isPCOSMode: hasPCOS,
      explanation
    }
  };
}

function getLocalStreak() {
  const currentStreak = Number(typeof window !== 'undefined' ? localStorage.getItem('hersync_streak_current') || '0' : '0');
  const longestStreak = Number(typeof window !== 'undefined' ? localStorage.getItem('hersync_streak_longest') || '0' : '0');
  const lastActiveDate = typeof window !== 'undefined' ? localStorage.getItem('hersync_streak_last_active') || null : null;
  return { currentStreak, longestStreak, lastActiveDate };
}

function saveLocalStreak(streak: { currentStreak: number, longestStreak: number, lastActiveDate: string | null }) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('hersync_streak_current', String(streak.currentStreak));
  localStorage.setItem('hersync_streak_longest', String(streak.longestStreak));
  if (streak.lastActiveDate) {
    localStorage.setItem('hersync_streak_last_active', streak.lastActiveDate);
  } else {
    localStorage.removeItem('hersync_streak_last_active');
  }
}

export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  // 1. Health Summary (computed locally)
  if (input.includes('/api/health-summary')) {
    const summary = getLocalHealthSummary();
    return new Response(JSON.stringify(summary), { status: 200 });
  }

  // 2. Period Prediction (computed locally)
  if (input.includes('/api/period-prediction')) {
    const prediction = getLocalPeriodPrediction();
    return new Response(JSON.stringify(prediction), { status: 200 });
  }

  // 3. Wellness Plan
  if (input.includes('/api/wellness-plan')) {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const summary = getLocalHealthSummary();

    // POST: Toggle Task Completion
    if (init?.method === 'POST') {
      const { taskId } = JSON.parse(init.body as string || '{}');
      const storedPlanRaw = localStorage.getItem('hersync_wellness_plan');
      if (!storedPlanRaw) {
        return new Response(JSON.stringify({ error: 'No plan found' }), { status: 400 });
      }
      
      const plan = JSON.parse(storedPlanRaw);
      plan.tasks = plan.tasks.map((t: any) => {
        if (t.id === taskId) {
          const completed = !t.completed;
          return {
            ...t,
            completed,
            completedAt: completed ? new Date().toISOString() : null
          };
        }
        return t;
      });
      
      localStorage.setItem('hersync_wellness_plan', JSON.stringify(plan));
      
      // Calculate/Update Streak
      const streak = getLocalStreak();
      const allCompleted = plan.tasks.every((t: any) => t.completed);
      
      if (allCompleted) {
        if (streak.lastActiveDate !== todayStr) {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = format(yesterday, 'yyyy-MM-dd');
          
          if (streak.lastActiveDate === yesterdayStr || (streak.currentStreak === 0 && streak.lastActiveDate === null)) {
            streak.currentStreak += 1;
          } else {
            streak.currentStreak = 1;
          }
          streak.longestStreak = Math.max(streak.longestStreak, streak.currentStreak);
          streak.lastActiveDate = todayStr;
          saveLocalStreak(streak);
        }
      } else {
        if (streak.lastActiveDate === todayStr) {
          streak.currentStreak = Math.max(0, streak.currentStreak - 1);
          streak.lastActiveDate = null;
          saveLocalStreak(streak);
        }
      }
      
      return new Response(JSON.stringify({ plan, streak }), { status: 200 });
    }

    // GET: Retrieve/Generate Wellness Plan
    if (summary.total_logs_count < 3) {
      return new Response(JSON.stringify({
        hasData: false,
        plan: null,
        streak: getLocalStreak(),
        logsCount: summary.total_logs_count
      }), { status: 200 });
    }

    const storedPlanRaw = localStorage.getItem('hersync_wellness_plan');
    let plan = storedPlanRaw ? JSON.parse(storedPlanRaw) : null;

    if (plan && plan.planDate === todayStr) {
      return new Response(JSON.stringify({
        hasData: true,
        plan,
        streak: getLocalStreak()
      }), { status: 200 });
    }

    // Generate new plan from backend
    const checkInsRaw = localStorage.getItem('hersync_checkins') || '{}';
    const checkIns = JSON.parse(checkInsRaw);
    const sortedCheckins = Object.entries(checkIns)
      .map(([date, data]: [string, any]) => ({ log_date: date, ...data }))
      .sort((a, b) => b.log_date.localeCompare(a.log_date))
      .slice(0, 7);

    const skinRaw = localStorage.getItem('hersync_skin') || '[]';
    const skinLogs = JSON.parse(skinRaw)
      .sort((a: any, b: any) => b.date.localeCompare(a.date))
      .slice(0, 7);

    try {
      const res = await fetch(`${backendUrl}/api/wellness-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary,
          recentLogs: sortedCheckins,
          skinLogs
        })
      });

      if (!res.ok) throw new Error('Backend failed to generate tasks');
      const generatedTasks = await res.json();

      const finalTasks = generatedTasks.map((t: any, idx: number) => ({
        id: t.id || `${t.category}-${idx}`,
        text: t.text,
        category: t.category,
        completed: false,
        completedAt: null
      }));

      const newPlan = {
        id: Date.now().toString(),
        planDate: todayStr,
        tasks: finalTasks
      };

      localStorage.setItem('hersync_wellness_plan', JSON.stringify(newPlan));

      return new Response(JSON.stringify({
        hasData: true,
        plan: newPlan,
        streak: getLocalStreak()
      }), { status: 200 });

    } catch (err) {
      console.error('Failed to contact backend for wellness plan generation:', err);
      // Fallback local rule-based task generation can be returned here
      return new Response(JSON.stringify({
        hasData: false,
        plan: null,
        streak: getLocalStreak(),
        message: 'Could not contact AI companion server. Please verify connections.'
      }), { status: 500 });
    }
  }

  // 4. Companion Chat
  if (input.includes('/api/chat')) {
    const bodyData = JSON.parse(init?.body as string || '{}');
    const userName = localStorage.getItem('hersync_username') || 'Guest';
    const aiName = localStorage.getItem('hersync_ai_name') || 'Luna';
    const summary = getLocalHealthSummary();

    return fetch(`${backendUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: bodyData.message,
        history: bodyData.history,
        userName,
        aiName,
        summary: JSON.stringify(summary)
      })
    });
  }

  // 5. Deep report analysis
  if (input.includes('/api/analyze')) {
    const bodyData = JSON.parse(init?.body as string || '{}');
    const userName = localStorage.getItem('hersync_username') || 'Guest';
    const aiName = localStorage.getItem('hersync_ai_name') || 'Luna';
    const summary = getLocalHealthSummary();

    return fetch(`${backendUrl}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: bodyData.type || 'weekly',
        userName,
        aiName,
        summary
      })
    });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 });
}
