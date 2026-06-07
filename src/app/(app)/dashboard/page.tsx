'use client';

import { useEffect, useState } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { createClient } from '@/utils/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  HeartPulse, 
  Target, 
  AlertCircle, 
  ArrowRight,
  TrendingUp,
  BrainCircuit,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CycleIntelligenceEngine, CycleEntry, CheckInEntry } from '@/lib/cycle-intelligence';
import Link from 'next/link';

export default function DashboardPage() {
  const supabase = createClient();
  const [userName, setUserName] = useState<string>('there');
  const [aiName, setAiName] = useState<string>('Luna');
  const [loading, setLoading] = useState(true);

  const [hasPCOS] = useLocalStorage('hersync_has_pcos', false);
  const [cycles] = useLocalStorage<CycleEntry[]>('hersync_cycles', []);
  const [checkIns] = useLocalStorage<Record<string, CheckInEntry>>('hersync_checkins', {});

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('username, ai_name')
          .eq('id', user.id)
          .single();
        
        if (data) {
          setUserName(data.username);
          setAiName(data.ai_name);
        }
      }
      setLoading(false);
    }
    loadProfile();
  }, [supabase]);

  const engine = new CycleIntelligenceEngine(cycles, checkIns, hasPCOS);
  const analytics = engine.analyzeCycles();
  const prediction = engine.predictNextPeriod();
  const healthScore = engine.calculateHealthScore();

  // Find today's checkin
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayCheckIn = checkIns[todayStr];

  // Calculate Today's Wellness Score
  let wellnessScore = 0;
  let hasCheckedInToday = false;
  if (todayCheckIn) {
    hasCheckedInToday = true;
    const sleepScore = Math.min(25, (todayCheckIn.sleep / 8) * 25);
    const waterScore = Math.min(25, (todayCheckIn.water / 2.5) * 25);
    const exerciseScore = Math.min(20, (todayCheckIn.exercise / 30) * 20);
    const stressScore = Math.min(15, (10 - todayCheckIn.stress) * 1.5);
    
    let moodScore = 10;
    if (todayCheckIn.mood === 'happy') moodScore = 15;
    else if (todayCheckIn.mood === 'calm') moodScore = 13;
    else if (todayCheckIn.mood === 'anxious') moodScore = 8;
    else if (todayCheckIn.mood === 'sad' || todayCheckIn.mood === 'angry') moodScore = 5;
    
    wellnessScore = Math.round(sleepScore + waterScore + exerciseScore + stressScore + moodScore);
  }

  // Generate chart data
  const sortedDates = Object.keys(checkIns).sort().slice(-7);
  const chartData = sortedDates.map(date => {
    const entry = checkIns[date];
    let moodVal = 3;
    if (entry.mood === 'happy') moodVal = 5;
    if (entry.mood === 'calm') moodVal = 4;
    if (entry.mood === 'anxious') moodVal = 2;
    if (entry.mood === 'sad' || entry.mood === 'angry') moodVal = 1;
    
    return {
      day: new Date(date).toLocaleDateString(undefined, { weekday: 'short' }),
      mood: moodVal,
      sleep: entry.sleep,
      stress: entry.stress,
    };
  });

  const getTodayInsight = () => {
    if (!hasCheckedInToday) {
      return `Log today's wellness check-in to get a personalized hormone and wellness insight from ${aiName}!`;
    }
    if (todayCheckIn.sleep < 6.5) {
      return "Your sleep is a bit low today. Rest supports progesterone synthesis and keeps cortisol spikes in check.";
    }
    if (todayCheckIn.stress > 7) {
      return "Stress levels are high today. High cortisol suppresses ovulation. Try deep breathing for 3 minutes.";
    }
    if (todayCheckIn.water < 1.5) {
      return "Your water intake is below target. Drink water to flush excess hormones and manage cycle bloating.";
    }
    return "Your hydration, sleep, and activity are aligned! Great job stabilizing your endocrine system today.";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-6 pb-24 animate-in fade-in duration-500">
      
      <div className="flex flex-col gap-1 mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Good Morning, {userName} 🌸</h1>
        <p className="text-sm font-medium text-violet-400">{aiName} is here for you 💜</p>
      </div>

      {hasPCOS && (
        <div className="bg-pink-500/10 border border-pink-500/20 text-pink-500 p-3 rounded-xl flex items-start gap-2.5 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">PCOS Mode active:</span> predictions are calibrated to account for cycle variability.
          </div>
        </div>
      )}

      {/* 1. Today's Wellness Score Circle */}
      <Card className="border-pink-500/15 bg-gradient-to-br from-pink-500/5 to-transparent relative overflow-hidden">
        <CardContent className="pt-6 flex flex-col items-center text-center">
          <span className="text-xs font-semibold text-muted-foreground mb-4 uppercase tracking-wider">Today's Wellness Score</span>
          
          <div className="relative w-36 h-36 flex items-center justify-center">
            {/* SVG Progress Circle */}
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                className="stroke-secondary"
                strokeWidth="8"
                fill="transparent"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                className="stroke-pink-500 transition-all duration-1000"
                strokeWidth="8"
                fill="transparent"
                strokeDasharray="251.2"
                strokeDashoffset={251.2 - (251.2 * (hasCheckedInToday ? wellnessScore : 75)) / 100}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-3xl font-extrabold text-foreground">{hasCheckedInToday ? `${wellnessScore}%` : '--'}</span>
              <span className="text-[10px] text-muted-foreground mt-0.5">{hasCheckedInToday ? 'Complete' : 'Pending Log'}</span>
            </div>
          </div>

          {!hasCheckedInToday ? (
            <div className="mt-5 w-full">
              <Link href="/check-in">
                <Button className="w-full h-11 rounded-full bg-gradient-to-r from-pink-500 to-violet-500 text-white font-medium text-xs hover:from-pink-600 hover:to-violet-600">
                  Log Today's Habits
                </Button>
              </Link>
            </div>
          ) : (
            <div className="mt-4 text-xs text-green-500 font-medium flex items-center gap-1">
              ✓ Daily check-in complete! Keep up the good work.
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2 & 3. Cycle Metrics Side-by-Side */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-border/40 bg-card/60 backdrop-blur-xs">
          <CardContent className="p-4 flex flex-col justify-between h-28">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-pink-500" /> Next Period
            </span>
            {prediction ? (
              <div>
                <div className="text-sm font-bold leading-tight text-foreground mt-2">
                  {prediction.earliestDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  Conf: <span className="font-semibold text-pink-500">{prediction.confidenceScore}%</span>
                </div>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground mt-2">No prediction yet.</span>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-card/60 backdrop-blur-xs">
          <CardContent className="p-4 flex flex-col justify-between h-28">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase flex items-center gap-1.5">
              <HeartPulse className="w-3.5 h-3.5 text-green-500" /> Cycle Health
            </span>
            <div>
              <div className="text-xl font-bold leading-none text-foreground mt-2">
                {healthScore.score}/100
              </div>
              <div className={`text-[10px] font-bold mt-1.5 ${
                healthScore.category === 'Excellent' ? 'text-green-500' :
                healthScore.category === 'Good' ? 'text-blue-500' :
                healthScore.category === 'Moderate' ? 'text-yellow-500' : 'text-red-500'
              }`}>
                {healthScore.category}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 4. Today's AI Insight */}
      <Card className="border-violet-500/10 bg-card/60 backdrop-blur-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/10 blur-2xl rounded-full" />
        <CardContent className="p-4 space-y-2 relative z-10">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-violet-400 font-bold uppercase flex items-center gap-1.5">
              <BrainCircuit className="w-4 h-4 text-violet-500" /> {aiName}'s Insight
            </span>
          </div>
          <p className="text-sm leading-relaxed font-medium text-foreground">{getTodayInsight()}</p>
          <div className="pt-3 flex justify-end">
             <Link href="/companion" className="text-xs text-white bg-violet-600/80 hover:bg-violet-600 px-4 py-2 rounded-full font-semibold transition-colors flex items-center gap-2">
                Chat with {aiName} <ArrowRight className="w-3 h-3" />
             </Link>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions (as requested) */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/check-in">
            <Button variant="outline" className="w-full h-12 rounded-xl bg-card/50 border-border/50 justify-start px-4">
              Log Mood & Symptoms
            </Button>
          </Link>
          <Link href="/cycle">
            <Button variant="outline" className="w-full h-12 rounded-xl bg-card/50 border-border/50 justify-start px-4">
              Track Period
            </Button>
          </Link>
        </div>
      </div>

    </div>
  );
}
