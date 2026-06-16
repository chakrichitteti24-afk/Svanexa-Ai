import { Response, Router } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { HealthMonitorService } from '../lib/health-monitor';
import { AIService } from '../lib/ai-service';

const router = Router();

router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = req.supabase!;
    const user = req.user!;
    const { type: reportType = 'weekly' } = req.body || {};

    const healthMonitor = new HealthMonitorService(supabase);
    const summary = await healthMonitor.generateHealthSummary(user.id);

    if (summary.total_logs_count < 3) {
      return res.json({ 
        success: false, 
        message: "Not enough data yet. Track more wellness data to unlock insights." 
      });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('username, ai_name')
      .eq('id', user.id)
      .single();

    const userName = profile?.username || 'there';
    const aiName = profile?.ai_name || 'Luna';

    const analysisMessage = `Perform a deep ${reportType} reasoning analysis of my wellness logs. 
Here is my current wellness summary: ${JSON.stringify(summary)}. 
Please compile a warm, supportive, and emotionally aware report reflecting on my symptoms, sleep averages, and hydration trends. 
Do not show empty placeholders or invent fake predictions. Format the analysis beautifully.`;

    const ai = new AIService();
    const result = await ai.generateCompanionResponse(
      analysisMessage,
      [],
      JSON.stringify(summary),
      aiName,
      userName,
      true
    );

    return res.json({
      success: true,
      reportType,
      analysis: result.response,
      modelUsed: result.modelUsed,
    });
  } catch (error) {
    console.error('API Error in POST /api/analyze:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
