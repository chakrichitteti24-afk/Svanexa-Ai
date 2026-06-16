import { Response, Router } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { HealthMonitorService } from '../lib/health-monitor';
import { AIService } from '../lib/ai-service';

const router = Router();

router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = req.supabase!;
    const user = req.user!;
    const { message, history, conversationId: reqConversationId } = req.body || {};

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const formattedHistory = (history || []).map((msg: any) => ({
      role: msg.role === 'model' || msg.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: msg.content || msg.text || ''
    }));

    const healthMonitor = new HealthMonitorService(supabase);
    const summary = await healthMonitor.generateHealthSummary(user.id);

    const { data: profile } = await supabase
      .from('profiles')
      .select('username, ai_name')
      .eq('id', user.id)
      .single();

    const { data: memory } = await supabase
      .from('user_memory')
      .select('*')
      .eq('user_id', user.id)
      .single();

    const userName = profile?.username || 'there';
    const aiName = profile?.ai_name || 'Luna';

    const userMemoryText = JSON.stringify({
      preferred_language: memory?.preferred_language || 'en',
      communication_style: memory?.communication_style || 'friendly',
      wellness_goals: memory?.wellness_goals || [],
      common_concerns: memory?.common_concerns || [],
      ai_relationship_preferences: memory?.ai_relationship_preferences || '',
      summary: memory?.summary || ''
    });

    const healthSummaryText = JSON.stringify({
      sleep_avg: summary.sleep_avg,
      stress_trend: summary.stress_trend,
      mood_trend: summary.mood_trend,
      cycle_status: summary.cycle_status,
      risk_flags: summary.risk_flags,
      total_logs_count: summary.total_logs_count
    });

    const contextContext = `[HEALTH SUMMARY]: ${healthSummaryText}\n[USER MEMORY]: ${userMemoryText}`;

    const ai = new AIService();
    const result = await ai.generateCompanionResponse(
      message,
      formattedHistory,
      contextContext,
      aiName,
      userName,
      false
    );

    const lowerRes = result.response.toLowerCase();
    const contextAudit = {
      used_sleep_data: lowerRes.includes('sleep') || lowerRes.includes('hour') || lowerRes.includes('rest') || lowerRes.includes('tired'),
      used_mood_data: lowerRes.includes('mood') || lowerRes.includes('feel') || lowerRes.includes('happy') || lowerRes.includes('calm') || lowerRes.includes('anxious') || lowerRes.includes('sad') || lowerRes.includes('angry') || lowerRes.includes('swings'),
      used_stress_data: lowerRes.includes('stress') || lowerRes.includes('tense') || lowerRes.includes('pressure') || lowerRes.includes('relaxed'),
      used_cycle_data: lowerRes.includes('period') || lowerRes.includes('cycle') || lowerRes.includes('flow') || lowerRes.includes('fertile') || lowerRes.includes('due in') || lowerRes.includes('late'),
      used_symptom_data: lowerRes.includes('bloat') || lowerRes.includes('cramp') || lowerRes.includes('fatigue') || lowerRes.includes('acne') || lowerRes.includes('hair') || lowerRes.includes('symptom')
    };

    let conversationId = reqConversationId;
    try {
      if (!conversationId) {
        const { data: latestConv } = await supabase
          .from('conversations')
          .select('id')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestConv) {
          conversationId = latestConv.id;
        } else {
          const { data: newConv, error: convErr } = await supabase
            .from('conversations')
            .insert({ user_id: user.id, title: 'Wellness Session' })
            .select()
            .single();
          if (convErr) throw convErr;
          conversationId = newConv.id;
        }
      }

      await supabase.from('messages').insert({
        conversation_id: conversationId,
        role: 'user',
        content: message
      });

      await supabase.from('messages').insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: result.response,
        context_audit: contextAudit
      });

      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);
    } catch (saveError) {
      console.error('Failed to log message session to database:', saveError);
    }

    return res.json({
      success: true,
      response: result.response,
      modelUsed: result.modelUsed,
      conversationId: conversationId,
      error: result.error
    });
  } catch (error) {
    console.error('API Error in POST /api/chat:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
