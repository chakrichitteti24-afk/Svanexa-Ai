import { Response, Router } from 'express';
import { WellnessPlanService } from '../lib/wellness-plan-service';

const router = Router();

router.post('/', async (req, res: Response) => {
  try {
    const { summary = {}, recentLogs = [], skinLogs = [] } = req.body || {};

    const sleepAvg = summary.sleep_avg || 7.0;
    const stressTrend = summary.stress_trend || 'insufficient_data';
    const moodTrend = summary.mood_trend || 'insufficient_data';
    const cycleStatus = summary.cycle_status || 'insufficient_data';

    const waterSum = recentLogs.reduce((sum: number, entry: any) => sum + Number(entry.water || 0), 0);
    const waterAvg = recentLogs.length ? waterSum / recentLogs.length : 2.0;

    const exerciseSum = recentLogs.reduce((sum: number, entry: any) => sum + Number(entry.exercise || 0), 0);
    const exerciseAvg = recentLogs.length ? exerciseSum / recentLogs.length : 30;

    const latestLog = recentLogs[0] || null;
    const cramps = latestLog?.cramps || 'none';
    const bloating = latestLog?.bloating || 'none';
    const fatigue = latestLog?.fatigue || 'none';
    const hairFall = latestLog?.hair_fall || 'none';

    const acneAvg = skinLogs.length
      ? skinLogs.reduce((sum: number, entry: any) => sum + Number(entry.acne || 0), 0) / skinLogs.length
      : 3;
    const oilinessAvg = skinLogs.length
      ? skinLogs.reduce((sum: number, entry: any) => sum + Number(entry.oiliness || 0), 0) / skinLogs.length
      : 3;

    const metrics = {
      sleepAvg,
      stressTrend,
      moodTrend,
      cycleStatus,
      waterAvg,
      exerciseAvg,
      cramps,
      bloating,
      fatigue,
      hairFall,
      acneAvg,
      oilinessAvg,
    };

    const wellnessService = new WellnessPlanService(null as any);
    let tasks: any[] = [];

    try {
      tasks = await (wellnessService as any).generateTasksWithAI(metrics);
    } catch (e) {
      console.warn('AI Task generation failed on backend, falling back to rule-based:', e);
      tasks = (wellnessService as any).generateTasksWithRules(metrics);
    }

    // Ensure we have at least 3 tasks
    if (tasks.length < 3) {
      const fallbacks = (wellnessService as any).generateTasksWithRules(metrics);
      for (const t of fallbacks) {
        if (!tasks.some(existing => existing.category === t.category)) {
          tasks.push(t);
        }
        if (tasks.length >= 3) break;
      }
    }

    if (tasks.length > 8) {
      tasks = tasks.slice(0, 8);
    }

    return res.json(tasks);
  } catch (error) {
    console.error('API Error in POST /api/wellness-plan:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
