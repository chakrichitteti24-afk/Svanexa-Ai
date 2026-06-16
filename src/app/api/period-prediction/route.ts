import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { CycleIntelligenceEngine, CycleEntry, CheckInEntry } from '@/lib/cycle-intelligence';

export async function GET() {
  try {
    const supabase = await createClient();
    
    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch cycle logs from Supabase
    const { data: dbCycles, error: cyclesError } = await supabase
      .from('cycle_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('start_date', { ascending: false });

    if (cyclesError) {
      console.warn('Error fetching cycles (table may be missing or empty):', cyclesError);
      return NextResponse.json({ 
        hasData: false, 
        message: "Not enough data yet." 
      });
    }

    // Fetch recent check-ins from daily_logs
    const { data: dbCheckIns, error: checkInsError } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('log_date', { ascending: false });

    if (checkInsError) {
      console.error('Error fetching check-ins:', checkInsError);
    }

    // Map db values to types expected by CycleIntelligenceEngine
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

    // Check PCOS mode from user memory
    const { data: memory } = await supabase
      .from('user_memory')
      .select('common_concerns')
      .eq('user_id', user.id)
      .maybeSingle();

    const hasPCOS = memory?.common_concerns?.includes('PCOS') || false; 

    // Instantiate prediction engine V2
    const engine = new CycleIntelligenceEngine(cyclesMapped, checkInsMapped, hasPCOS);
    const prediction = engine.predictNextPeriod();

    if (!prediction) {
      return NextResponse.json({ 
        hasData: false, 
        message: "Not enough data yet." 
      });
    }

    return NextResponse.json({
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
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
