'use client';

import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  Moon, 
  Smile, 
  HeartPulse, 
  BrainCircuit, 
  Target, 
  AlertCircle, 
  Database,
  ArrowRight,
  TrendingUp,
  Droplet
} from 'lucide-react';
import { format } from 'date-fns';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CycleIntelligenceEngine, CycleEntry, CheckInEntry } from '@/lib/cycle-intelligence';
import Link from 'next/link';

export default function DashboardPage() {
  const [hasPCOS] = useLocalStorage('hersync_has_pcos', false);
  const [cycles] = useLocalStorage<CycleEntry[]>('hersync_cycles', []);
  const [checkIns] = useLocalStorage<Record<string, CheckInEntry>>('hersync_checkins', {});
  const [userName] = useLocalStorage('hersync_user_name', 'Sarah');

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

  // Today's AI Insight snippet based on metrics
  const getTodayInsight = () => {
    if (!hasCheckedInToday) {
      return "Log today's wellness check-in to get a personalized hormone and wellness insight!";
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

  return (
    <div className="max-w-md mx-auto space-y-6 pb-24 animate-in fade-in duration-500">
      
      {/* Premium Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Hi, {userName} ✨</h1>
          <p className="text-xs text-muted-foreground">Here is your daily wellness status.</p>
        </div>
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
        {/* Next Period Card */}
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

        {/* Cycle Health Score Card */}
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
      <Card className="border-violet-500/10 bg-card/60 backdrop-blur-xs">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase flex items-center gap-1.5">
              <BrainCircuit className="w-3.5 h-3.5 text-violet-500" /> Today's AI Insight
            </span>
            <Link href="/companion" className="text-[10px] text-primary flex items-center gap-0.5 hover:underline font-medium">
              Ask AI <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <p className="text-xs leading-relaxed text-foreground/80">{getTodayInsight()}</p>
        </CardContent>
      </Card>

      {/* 5. Cycle Stats summary */}
      <Card className="border-border/40 bg-card/60 backdrop-blur-xs">
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-2 text-center divide-x divide-border/30">
            <div>
              <div className="text-[10px] text-muted-foreground">Avg Cycle</div>
              <div className="text-sm font-bold text-foreground mt-1">{analytics.avgCycleLength} days</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">Avg Period</div>
              <div className="text-sm font-bold text-foreground mt-1">{analytics.avgPeriodDuration} days</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">Regularity</div>
              <div className="text-sm font-semibold text-foreground mt-1 truncate px-1">{analytics.regularityStatus}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 6. Recent Wellness Trends (Tabs to avoid crowding) */}
      <Card className="border-border/40 bg-card/60 backdrop-blur-xs">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-pink-500" /> Recent Trends
          </CardTitle>
          <CardDescription className="text-[10px]">Track your metrics over the last 7 logs.</CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          {chartData.length > 0 ? (
            <Tabs defaultValue="sleep" className="w-full">
              <TabsList className="grid grid-cols-3 h-9 rounded-full bg-secondary/20 p-1 mb-4">
                <TabsTrigger value="sleep" className="text-[10px] rounded-full">Sleep</TabsTrigger>
                <TabsTrigger value="mood" className="text-[10px] rounded-full">Mood</TabsTrigger>
                <TabsTrigger value="stress" className="text-[10px] rounded-full">Stress</TabsTrigger>
              </TabsList>
              
              <div className="h-44 w-full">
                <TabsContent value="sleep" className="h-full mt-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -30, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorSleep" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                      <XAxis dataKey="day" stroke="#666" fontSize={9} tickLine={false} />
                      <YAxis stroke="#666" fontSize={9} domain={[0, 10]} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', fontSize: '10px' }} />
                      <Area type="monotone" dataKey="sleep" stroke="#3b82f6" fillOpacity={1} fill="url(#colorSleep)" strokeWidth={1.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                </TabsContent>
                
                <TabsContent value="mood" className="h-full mt-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -30, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorMood" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ec4899" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                      <XAxis dataKey="day" stroke="#666" fontSize={9} tickLine={false} />
                      <YAxis stroke="#666" fontSize={9} domain={[1, 5]} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', fontSize: '10px' }} />
                      <Area type="monotone" dataKey="mood" stroke="#ec4899" fillOpacity={1} fill="url(#colorMood)" strokeWidth={1.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                </TabsContent>
                
                <TabsContent value="stress" className="h-full mt-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -30, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorStress" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                      <XAxis dataKey="day" stroke="#666" fontSize={9} tickLine={false} />
                      <YAxis stroke="#666" fontSize={9} domain={[0, 10]} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', fontSize: '10px' }} />
                      <Area type="monotone" dataKey="stress" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorStress)" strokeWidth={1.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                </TabsContent>
              </div>
            </Tabs>
          ) : (
            <div className="h-32 flex flex-col items-center justify-center text-muted-foreground text-xs italic text-center px-4">
              No recent history found. Please complete your daily wellness check-ins to generate personalized trends.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="text-center text-[10px] text-muted-foreground opacity-50 px-4">
        HerSync AI provides educational and lifestyle guidance. Insights are informational only and do not replace medical evaluation.
      </div>
    </div>
  );
}
