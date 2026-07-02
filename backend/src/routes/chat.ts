import { Response, Router } from 'express';
import { AIService } from '../lib/ai-service';

const router = Router();

router.post('/', async (req, res: Response) => {
  try {
    const { message, history, userName = 'there', aiName = 'Luna', summary = '{}' } = req.body || {};

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const formattedHistory = (history || []).map((msg: any) => ({
      role: msg.role === 'model' || msg.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: msg.content || msg.text || ''
    }));

    const contextContext = `[HEALTH SUMMARY]: ${summary}`;

    const ai = new AIService();
    const result = await ai.generateCompanionResponse(
      message,
      formattedHistory,
      contextContext,
      aiName,
      userName,
      false
    );

    return res.json({
      success: true,
      response: result.response,
      modelUsed: result.modelUsed,
      error: result.error
    });
  } catch (error) {
    console.error('API Error in POST /api/chat:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
