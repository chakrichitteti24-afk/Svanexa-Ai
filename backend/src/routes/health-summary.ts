import { Response, Router } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { HealthMonitorService } from '../lib/health-monitor';
import { format } from 'date-fns';

const router = Router();

const handleHealthSummary = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = req.supabase!;
    const user = req.user!;

    const healthMonitor = new HealthMonitorService(supabase);
    const summary = await healthMonitor.generateHealthSummary(user.id);

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const { data: todayLog } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('log_date', todayStr)
      .maybeSingle();

    return res.json({
      ...summary,
      has_checked_in_today: !!todayLog,
      today_log: todayLog || null
    });
  } catch (error) {
    console.error('API Error in /api/health-summary:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

router.get('/', handleHealthSummary);
router.post('/', handleHealthSummary);

export default router;
