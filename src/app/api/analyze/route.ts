import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { HealthMonitorService } from '@/lib/health-monitor';
import { AIService } from '@/lib/ai-service';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const reportType = body.type || 'weekly'; // 'weekly' | 'monthly' | 'symptoms'

    // Retrieve health summary using HealthMonitorService
    const healthMonitor = new HealthMonitorService(supabase);
    const summary = await healthMonitor.generateHealthSummary(user.id);

    // If there is insufficient data (less than 3 logs on record), return clear error message
    if (summary.total_logs_count < 3) {
      return NextResponse.json({ 
        success: false, 
        message: "Not enough data yet. Track more wellness data to unlock insights." 
      });
    }

    // Fetch user profile properties
    const { data: profile } = await supabase
      .from('profiles')
      .select('username, ai_name')
      .eq('id', user.id)
      .single();

    const userName = profile?.username || 'there';
    const aiName = profile?.ai_name || 'Luna';

    // Prepare message instruction to force Gemini analysis
    const analysisMessage = `Perform a deep ${reportType} reasoning analysis of my wellness logs. 
Here is my current wellness summary: ${JSON.stringify(summary)}. 
Please compile a warm, supportive, and emotionally aware report reflecting on my symptoms, sleep averages, and hydration trends. 
Do not show empty placeholders or invent fake predictions. Format the analysis beautifully.`;

    const ai = new AIService();
    const result = await ai.generateCompanionResponse(
      analysisMessage,
      [], // Empty history for one-off report analysis
      JSON.stringify(summary),
      aiName,
      userName,
      true // Force Gemini 2.5 Flash for deep analysis
    );

    return NextResponse.json({
      success: true,
      reportType,
      analysis: result.response,
      modelUsed: result.modelUsed,
    });
  } catch (error) {
    console.error('API Error in /api/analyze:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
