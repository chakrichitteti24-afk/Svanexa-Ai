import { Response, Router } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { WellnessPlanService } from '../lib/wellness-plan-service';
import { format } from 'date-fns';

const router = Router();

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = req.supabase!;
    const user = req.user!;
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    const wellnessService = new WellnessPlanService(supabase);
    const result = await wellnessService.getDailyWellnessPlan(user.id, todayStr);

    return res.json(result);
  } catch (error) {
    console.error('API Error in GET /api/wellness-plan:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = req.supabase!;
    const user = req.user!;
    const { planId, taskId } = req.body || {};

    if (!planId || !taskId) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const wellnessService = new WellnessPlanService(supabase);
    const result = await wellnessService.toggleTaskCompletion(user.id, planId, taskId, todayStr);

    return res.json(result);
  } catch (error) {
    console.error('API Error in POST /api/wellness-plan:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
