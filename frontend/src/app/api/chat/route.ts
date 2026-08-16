import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/utils/supabase/server';
import { AIService } from '@/lib/services/ai-service';
import { format } from 'date-fns';

function getCurrentSlotLabel(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 18) return 'afternoon';
  return 'evening';
}

export async function POST(req: Request) {
  try {
    const { supabase, user, error: authError } = await getAuthenticatedUser(req);

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }


    const body = await req.json().catch(() => ({}));
    const { message, history } = body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Message is required' }, { status: 400 });
    }

    if (message.length > 2000) {
      return NextResponse.json({ success: false, error: 'Message cannot exceed 2000 characters' }, { status: 400 });
    }

    const sanitizedMessage = message.trim();
    const userId = user.id;
    const today = format(new Date(), 'yyyy-MM-dd');
    const currentSlot = getCurrentSlotLabel();

    // Fetch all context in parallel — only what is needed for AI
    const [
      { data: profile },
      { data: todayCheckin },
      { data: recentCheckins },
      { data: cycleLogs },
      { data: pregnancyLog },
      { data: todayPlan },
      { data: sleepLog },
      { data: moodLog },
    ] = await Promise.all([
      supabase.from('profiles').select('first_name, ai_name, active_theme').eq('id', userId).maybeSingle(),
      // Today's check-in slot data
      supabase.from('daily_checkins').select('summary').eq('user_id', userId).eq('date', today).maybeSingle(),
      // Recent check-ins (last 5 days)
      supabase.from('daily_checkins').select('date, summary').eq('user_id', userId).order('date', { ascending: false }).limit(5),
      // Cycle phase data
      supabase.from('cycle_logs').select('start_date, flow_intensity').eq('user_id', userId).order('start_date', { ascending: false }).limit(3),
      // Pregnancy info if applicable
      supabase.from('pregnancy_logs').select('due_date').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      // Today's wellness plan tasks
      supabase.from('wellness_plans').select('content').eq('user_id', userId).eq('title', today).maybeSingle(),
      // Today's sleep log
      supabase.from('sleep_logs').select('duration_hours').eq('user_id', userId).eq('date', today).maybeSingle(),
      // Today's mood log
      supabase.from('mood_logs').select('mood, intensity').eq('user_id', userId).eq('date', today).maybeSingle(),
    ]);

    const wellnessMode = profile?.active_theme || 'general';
    const companionName = profile?.ai_name || 'Luna';

    // Parse today's slot data from daily_checkins.summary
    let slotMeta: Record<string, any> = {};
    if (todayCheckin?.summary) {
      try { slotMeta = JSON.parse(todayCheckin.summary); } catch { slotMeta = {}; }
    }

    // Extract most recent slot data & 10-dimension assessment
    const latestSlotData = slotMeta.evening?.data || slotMeta.afternoon?.data || slotMeta.morning?.data || {};
    const indicators = latestSlotData.indicators || {};
    const completedSlots = ['morning', 'afternoon', 'evening'].filter(s => slotMeta[s]?.completed);

    // Parse today's wellness plan tasks
    let wellnessTasks: any[] = [];
    if (todayPlan?.content) {
      try { wellnessTasks = JSON.parse(todayPlan.content); } catch { wellnessTasks = []; }
    }
    const completedTasks = wellnessTasks.filter((t: any) => t.completed || t.status === 'completed');
    const pendingTasks = wellnessTasks.filter((t: any) => !t.completed && t.status !== 'completed');

    // Build structured context for the AI (Priority 1-5 hierarchy)
    const aiContext = {
      // Priority 2: Conversation context is passed via `history` parameter
      // Priority 3: Latest 10-dimension check-in assessment
      currentSlot,
      todayCheckIns: {
        completedSlots,
        stressIndicator: indicators.stress?.level || latestSlotData.stressIndicator || null,
        stressScore: indicators.stress?.score || latestSlotData.averageScore || null,
        moodTone: indicators.mood?.state || null,
        energyLevel: indicators.energy?.level || null,
        wellnessScore: indicators.wellnessScore || null,
        supportFocus: indicators.supportChoice || latestSlotData.supportChoice || null,
        sleep: sleepLog?.duration_hours ?? (indicators.sleepRating ? `${indicators.sleepRating}/5 rating` : null),
      },
      // Priority 4: Wellness plan
      wellnessPlan: {
        totalTasks: wellnessTasks.length,
        completedTasksCount: completedTasks.length,
        pendingTasks: pendingTasks.slice(0, 3).map((t: any) => ({ text: t.text, category: t.category })),
      },
      // Priority 5: Historical context
      mood: moodLog?.mood ?? null,
      recentCheckinDates: (recentCheckins || []).map((c: any) => c.date),
      cyclePhase: (() => {
        if (!cycleLogs || cycleLogs.length === 0) return 'unknown';
        const diff = Math.floor((Date.now() - new Date(cycleLogs[0].start_date).getTime()) / 86400000);
        if (diff <= 5) return 'menstrual';
        if (diff <= 13) return 'follicular';
        if (diff <= 17) return 'ovulation';
        return 'luteal';
      })(),
      pregnancyDueDate: pregnancyLog?.due_date ?? null,
      userMode: wellnessMode,
      userName: profile?.first_name || 'there',
    };

    const contextStr = `[USER CONTEXT]:\n${JSON.stringify(aiContext, null, 0)}`;

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
      profile?.first_name || 'there',
      false
    );

    return NextResponse.json({
      success: true,
      response: result.response,
      modelUsed: result.modelUsed,
      error: result.error
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
