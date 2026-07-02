import { Response, Router } from 'express';
import { AIService } from '../lib/ai-service';

const router = Router();

router.post('/', async (req, res: Response) => {
  try {
    const { type: reportType = 'weekly', userName = 'there', aiName = 'Luna', summary = {} } = req.body || {};

    if (!summary || summary.total_logs_count < 3) {
      return res.json({ 
        success: false, 
        message: "Not enough data yet. Track more wellness data to unlock insights." 
      });
    }

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
