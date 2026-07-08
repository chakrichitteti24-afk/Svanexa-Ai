import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { AIService } from '../lib/ai-service';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';

export class ChatController {
  static handleChat = catchAsync(async (req: Request, res: Response) => {
    const { message, history } = req.body;
    const userId = req.user.id;

    if (!message) {
      throw new AppError('Message is required', 400);
    }

    const aiName = 'Luna'; // Or fetch from user preferences if dynamic

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
      supabase.from('user_preferences').select('*').eq('user_id', userId).single(),
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

    return res.json({
      success: true,
      response: result.response,
      modelUsed: result.modelUsed,
      error: result.error
    });
  });
}
