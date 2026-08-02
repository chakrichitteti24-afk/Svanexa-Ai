import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { AIService } from '@/lib/services/ai-service';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { message, history } = await req.json();

    if (!message) {
      return NextResponse.json({ success: false, error: 'Message is required' }, { status: 400 });
    }

    const userId = user.id;

    // 1. Fetch ALL Real Data
    const [
      { data: profile },
      { data: preferences },
      { data: dailyCheckins },
      { data: moodLogs },
      { data: sleepLogs },
      { data: waterLogs },
      { data: exerciseLogs },
      { data: cycleLogs },
      { data: pregnancyLogs },
      { data: skinLogs },
      { data: reports }
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('user_preferences').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('daily_checkins').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(5),
      supabase.from('mood_logs').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(5),
      supabase.from('sleep_logs').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(5),
      supabase.from('water_logs').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(5),
      supabase.from('exercise_logs').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(5),
      supabase.from('cycle_logs').select('*').eq('user_id', userId).order('start_date', { ascending: false }).limit(3),
      supabase.from('pregnancy_logs').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1),
      supabase.from('skin_logs').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(5),
      supabase.from('reports').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1)
    ]);

    // Derive wellness mode from preferences.theme field
    const wellnessMode = preferences?.theme || 'general';
    // Fetch AI companion name from profile
    const companionName = profile?.ai_name || 'Luna';

    const realDataSummary = JSON.stringify({
      userMode: wellnessMode,
      profile: profile || {},
      preferences: preferences || {},
      dailyCheckins: dailyCheckins || [],
      moodLogs: moodLogs || [],
      sleepLogs: sleepLogs || [],
      waterLogs: waterLogs || [],
      exerciseLogs: exerciseLogs || [],
      cycleLogs: cycleLogs || [],
      pregnancyLogs: pregnancyLogs || [],
      skinLogs: skinLogs || [],
      reports: reports || []
    });

    const contextContext = `[HEALTH SUMMARY]: ${realDataSummary}\n[USER MEMORY]: ${JSON.stringify(profile || {})}`;

    const formattedHistory = (history || []).map((msg: any) => ({
      role: msg.role === 'model' || msg.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: msg.content || msg.text || ''
    }));

    const ai = new AIService();
    const result = await ai.generateCompanionResponse(
      message,
      formattedHistory,
      contextContext,
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
