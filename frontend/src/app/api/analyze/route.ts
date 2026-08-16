import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/utils/supabase/server';
import { AIService } from '@/lib/services/ai-service';

export async function POST(req: Request) {
  try {
    const { supabase, user, error: authError } = await getAuthenticatedUser(req);

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }


    const { type: reportType = 'weekly' } = await req.json().catch(() => ({ type: 'weekly' }));
    const userId = user.id;

    // Fetch user profile
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
    
    // Fetch reports/logs to determine if there's enough data
    const { data: checkins } = await supabase.from('daily_checkins').select('id').eq('user_id', userId);

    if (!checkins || checkins.length < 3) {
      return NextResponse.json({ 
        success: false, 
        message: "Not enough data yet. Track more wellness data to unlock insights." 
      });
    }

    // Prepare full summary for AI
    const [
      { data: moodLogs },
      { data: sleepLogs },
      { data: waterLogs }
    ] = await Promise.all([
      supabase.from('mood_logs').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(7),
      supabase.from('sleep_logs').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(7),
      supabase.from('water_logs').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(7),
    ]);

    const summary = {
      total_logs_count: checkins.length,
      mood: moodLogs,
      sleep: sleepLogs,
      water: waterLogs
    };

    const analysisMessage = `Perform a deep ${reportType} reasoning analysis of my wellness logs. 
Here is my current wellness summary: ${JSON.stringify(summary)}. 
Please compile a warm, supportive, and emotionally aware report reflecting on my symptoms, sleep averages, and hydration trends. 
Do not show empty placeholders or invent fake predictions. Format the analysis beautifully.`;

    const ai = new AIService();
    const result = await ai.generateCompanionResponse(
      analysisMessage,
      [],
      JSON.stringify(summary),
      'Luna',
      profile?.first_name || 'there',
      true
    );

    return NextResponse.json({
      success: true,
      reportType,
      analysis: result.response,
      modelUsed: result.modelUsed,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
