import { Response, Router } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { CycleIntelligenceEngine, CycleEntry, CheckInEntry } from '../lib/cycle-intelligence';

const router = Router();

const handlePeriodPrediction = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = req.supabase!;
    const user = req.user!;

    const { data: dbCycles, error: cyclesError } = await supabase
      .from('cycle_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('start_date', { ascending: false });

    if (cyclesError) {
      console.warn('Error fetching cycles:', cyclesError);
      return res.json({ 
        hasData: false, 
        message: "Not enough data yet." 
      });
    }

    const { data: dbCheckIns, error: checkInsError } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('log_date', { ascending: false });

    if (checkInsError) {
      console.error('Error fetching check-ins:', checkInsError);
    }

    const cyclesMapped: CycleEntry[] = (dbCycles || []).map(c => ({
      startDate: new Date(c.start_date).toISOString(),
      endDate: new Date(c.end_date).toISOString(),
      notes: c.notes || ''
    }));

    const checkInsMapped: Record<string, CheckInEntry> = {};
    if (dbCheckIns) {
      dbCheckIns.forEach(c => {
        checkInsMapped[c.log_date] = {
          mood: c.mood,
          sleep: Number(c.sleep),
          water: Number(c.water),
          exercise: Number(c.exercise),
          stress: Number(c.stress),
          acne: Number(c.acne),
          hairFall: c.hair_fall,
          bloating: c.bloating,
          fatigue: c.fatigue,
          cramps: c.cramps,
          notes: c.notes || ''
        };
      });
    }

    const { data: memory } = await supabase
      .from('user_memory')
      .select('common_concerns')
      .eq('user_id', user.id)
      .maybeSingle();

    const hasPCOS = memory?.common_concerns?.includes('PCOS') || false; 

    const engine = new CycleIntelligenceEngine(cyclesMapped, checkInsMapped, hasPCOS);
    const prediction = engine.predictNextPeriod();

    if (!prediction) {
      return res.json({ 
        hasData: false, 
        message: "Not enough data yet." 
      });
    }

    return res.json({
      hasData: true,
      prediction: {
        earliestDate: prediction.earliestDate,
        likelyDate: prediction.likelyDate,
        latestDate: prediction.latestDate,
        confidenceScore: prediction.confidenceScore,
        confidenceLabel: prediction.confidenceLabel,
        isPCOSMode: prediction.isPCOSMode,
        message: prediction.message,
        expectedPeriod: prediction.expectedPeriod,
        explanation: prediction.explanation
      }
    });
  } catch (error) {
    console.error('API Error in /api/period-prediction:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

router.get('/', handlePeriodPrediction);
router.post('/', handlePeriodPrediction);

export default router;
