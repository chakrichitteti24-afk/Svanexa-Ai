import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import { supabase } from '../config/supabase';
import { WellnessPlanService } from '../lib/wellness-plan-service';
import { format } from 'date-fns';

export class WellnessPlanController {
  static getOrCreate = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user.id;
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    // Get wellness mode from user preferences
    const { data: prefs } = await supabase.from('user_preferences').select('theme').eq('user_id', userId).single();
    const wellnessMode = prefs?.theme || 'general';

    const service = new WellnessPlanService(supabase);
    const result = await service.getDailyWellnessPlan(userId, todayStr, wellnessMode);

    return res.json({ success: true, ...result });
  });

  static toggleTask = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user.id;
    const { planId, taskId } = req.params;
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    if (!planId || !taskId) throw new AppError('planId and taskId are required', 400);

    const service = new WellnessPlanService(supabase);
    const result = await service.toggleTask(userId, planId, taskId, todayStr);

    return res.json({ success: true, ...result });
  });

  // Legacy POST — keep for backward compat
  static generatePlan = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user.id;
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const { data: prefs } = await supabase.from('user_preferences').select('theme').eq('user_id', userId).single();
    const wellnessMode = prefs?.theme || 'general';
    const service = new WellnessPlanService(supabase);
    const result = await service.getDailyWellnessPlan(userId, todayStr, wellnessMode);
    return res.json({ success: true, ...result });
  });
}
