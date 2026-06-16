'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  HeartPulse, 
  Target, 
  AlertCircle, 
  ArrowRight,
  BrainCircuit,
  Loader2,
  CalendarHeart,
  Smile,
  Moon,
  Activity
} from 'lucide-react';
import Link from 'next/link';
import { apiFetch } from '@/utils/api-client';

interface HealthSummary {
  sleep_avg: number | null;
  stress_trend: 'low' | 'moderate' | 'high' | 'insufficient_data';
  mood_trend: 'improving' | 'declining' | 'stable' | 'insufficient_data';
  cycle_status: string;
  risk_flags: string[];
  total_logs_count: number;
  has_checked_in_today: boolean;
  today_log: any;
}

interface PeriodPrediction {
  hasData: boolean;
  prediction?: {
    earliestDate: string;
    likelyDate: string;
    latestDate: string;
    confidenceScore: number;
    confidenceLabel: string;
    isPCOSMode: boolean;
    message: string;
    expectedPeriod: string;
    explanation: string;
  };
}

interface WellnessPlanData {
  hasData: boolean;
  plan: {
    id: string;
    tasks: { id: string; text: string; category: string; completed: boolean }[];
  } | null;
  streak: {
    currentStreak: number;
    longestStreak: number;
  } | null;
  message?: string;
}

export default function DashboardPage() {
  const supabase = createClient();
  const [userName, setUserName] = useState<string>('there');
  const [aiName, setAiName] = useState<string>('Luna');
  const [loading, setLoading] = useState(true);
  
  const [summary, setSummary] = useState<HealthSummary | null>(null);
  const [prediction, setPrediction] = useState<PeriodPrediction | null>(null);
  const [wellnessPlan, setWellnessPlan] = useState<WellnessPlanData | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Load profile info
          const { data: profile } = await supabase
            .from('profiles')
            .select('username, ai_name')
            .eq('id', user.id)
            .single();
          
          if (profile) {
            setUserName(profile.username);
            setAiName(profile.ai_name);
          }

          // Fetch health summary from server API
          const summaryRes = await apiFetch('/api/health-summary');
          if (summaryRes.ok) {
            const summaryData = await summaryRes.json();
            setSummary(summaryData);
          }

          // Fetch period predictions from server API
          const predictionRes = await apiFetch('/api/period-prediction');
          if (predictionRes.ok) {
            const predictionData = await predictionRes.json();
            setPrediction(predictionData);
          }

          // Fetch premium wellness plan from server API
          const wellnessRes = await apiFetch('/api/wellness-plan');
          if (wellnessRes.ok) {
            const wellnessData = await wellnessRes.json();
            setWellnessPlan(wellnessData);
          }
        }
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [supabase]);

  // Calculate Today's Wellness Score if checked in
  let wellnessScore = 0;
  const hasCheckedInToday = summary?.has_checked_in_today || false;
  if (hasCheckedInToday && summary?.today_log) {
    const log = summary.today_log;
    const sleepScore = Math.min(25, (Number(log.sleep) / 8) * 25);
    const waterScore = Math.min(25, (Number(log.water) / 2.5) * 25);
    const exerciseScore = Math.min(20, (Number(log.exercise) / 30) * 20);
    const stressScore = Math.min(15, (10 - Number(log.stress)) * 1.5);
    
    let moodScore = 10;
    if (log.mood === 'happy') moodScore = 15;
    else if (log.mood === 'calm') moodScore = 13;
    else if (log.mood === 'anxious') moodScore = 8;
    else if (log.mood === 'sad' || log.mood === 'angry') moodScore = 5;
    
    wellnessScore = Math.round(sleepScore + waterScore + exerciseScore + stressScore + moodScore);
  }

  const getTodayInsight = () => {
    if (!summary || summary.total_logs_count < 3) {
      return "Not enough data yet. Add a few more daily check-ins so I can synthesize personalized hormone and wellness insights.";
    }
    if (!hasCheckedInToday) {
      return `Good morning, ${userName}! Log today's wellness check-in to generate today's personalized insight.`;
    }
    const log = summary.today_log;
    if (log && log.sleep < 6.5) {
      return "Your sleep is a bit low today. Rest supports progesterone synthesis and helps keep cortisol levels stable.";
    }
    if (log && log.stress > 7) {
      return "Stress levels are elevated today. High cortisol can disrupt ovulation and shift period timing. Take a 3-minute breather.";
    }
    if (log && log.water < 1.5) {
      return "Your hydration is below target. Drink water to flush toxins, support metabolic flow, and reduce bloating.";
    }
    return "Your hydration, sleep, and physical activity are aligned! Great job stabilizing your wellness flow today.";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
      </div>
    );
  }

  // Determine if user has any real logged records
  const hasLogs = (summary?.total_logs_count || 0) > 0;
  const isPCOSMode = prediction?.prediction?.isPCOSMode || false;

  return (
    <div className="max-w-md mx-auto space-y-6 pb-24 animate-in fade-in duration-500">
      
      <div className="flex flex-col gap-1 mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Good Morning, {userName} 🌸</h1>
        <p className="text-sm font-medium text-violet-400">{aiName} is here for you 💜</p>
      </div>

      {isPCOSMode && (
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
          <span className="text-xs font-semibold text-muted-foreground mb-4 uppercase tracking-wider">{"Today's Wellness Score"}</span>
          
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
                strokeDashoffset={251.2 - (251.2 * (hasCheckedInToday ? wellnessScore : 0)) / 100}
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
                  {"Log Today's Habits"}
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

      {/* Premium Wellness Plan Progress Card */}
      <Card className="border-violet-500/20 bg-gradient-to-r from-violet-500/10 to-pink-500/5 hover:from-violet-500/15 hover:to-pink-500/10 transition-all duration-300 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/15 blur-2xl rounded-full" />
        <CardContent className="p-5 relative z-10">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-violet-400 uppercase tracking-wider flex items-center gap-1.5">
              ✨ Daily Wellness Plan (Premium)
            </span>
            {wellnessPlan?.hasData && wellnessPlan.streak && wellnessPlan.streak.currentStreak > 0 && (
              <span className="text-xs font-extrabold text-amber-500 flex items-center gap-1 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                🔥 {wellnessPlan.streak.currentStreak} Day Streak
              </span>
            )}
          </div>

          {!wellnessPlan ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-violet-500" />
            </div>
          ) : !wellnessPlan.hasData ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Not enough wellness data yet. Log check-ins for at least 3 days to unlock.
              </p>
              <Link href="/check-in" className="inline-block mt-1">
                <Button size="sm" variant="ghost" className="text-xs text-violet-400 hover:text-violet-300 p-0 h-auto gap-1">
                  Start logging now <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {(() => {
                const total = wellnessPlan.plan?.tasks.length || 0;
                const completed = wellnessPlan.plan?.tasks.filter(t => t.completed).length || 0;
                const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;
                return (
                  <>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{"Today's Progress: "}{completed}/{total} tasks</span>
                      <span className="font-bold text-foreground">{progressPct}%</span>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full bg-secondary/30 h-2 rounded-full overflow-hidden border border-border/20">
                      <div 
                        className="bg-gradient-to-r from-violet-500 to-pink-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    
                    <div className="flex justify-end pt-1">
                      <Link href="/wellness-plan" className="text-xs text-white bg-violet-600/90 hover:bg-violet-600 px-4 py-2 rounded-full font-bold transition-all shadow-md shadow-violet-600/20 hover:shadow-violet-600/30 flex items-center gap-1.5 active:scale-95">
                        Open Wellness Plan <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Next Period Window (Prediction V2 window format) */}
      <Card className="border-border/40 bg-card/60 backdrop-blur-xs">
        <CardContent className="p-5 flex flex-col justify-between">
          <span className="text-xs text-muted-foreground font-semibold uppercase flex items-center gap-1.5 mb-3">
            <Target className="w-4 h-4 text-pink-500" /> Expected Period Window
          </span>
          {prediction?.hasData && prediction.prediction ? (
            <div className="space-y-2">
              <div className="text-lg font-bold leading-tight text-foreground">
                {prediction.prediction.expectedPeriod}
              </div>
              <div className="text-xs text-muted-foreground">
                Confidence: <span className="font-semibold text-pink-500">{prediction.prediction.confidenceScore}%</span>
              </div>
              <p className="text-xs text-muted-foreground leading-normal mt-1">
                {prediction.prediction.explanation}
              </p>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground font-medium mt-1">Not enough data yet.</div>
          )}
        </CardContent>
      </Card>

      {/* 3. Trends Section (Sleep, Mood, Stress) - Rendered only if data exists */}
      {hasLogs && summary ? (
        <div className="space-y-3">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Wellness Trends</span>
          
          <div className="grid grid-cols-3 gap-2">
            {/* Sleep Trend */}
            <Card className="border-border/40 bg-card/40">
              <CardContent className="p-3 text-center flex flex-col items-center justify-between h-24">
                <Moon className="w-4 h-4 text-violet-400 mb-1" />
                <span className="text-[10px] text-muted-foreground font-semibold">SLEEP</span>
                <span className="text-xs font-bold text-foreground mt-0.5">
                  {summary.sleep_avg ? `${summary.sleep_avg} hrs` : 'N/A'}
                </span>
              </CardContent>
            </Card>

            {/* Mood Trend */}
            <Card className="border-border/40 bg-card/40">
              <CardContent className="p-3 text-center flex flex-col items-center justify-between h-24">
                <Smile className="w-4 h-4 text-pink-400 mb-1" />
                <span className="text-[10px] text-muted-foreground font-semibold">MOOD</span>
                <span className="text-xs font-bold text-foreground mt-0.5 capitalize">
                  {summary.mood_trend === 'insufficient_data' ? 'N/A' : summary.mood_trend}
                </span>
              </CardContent>
            </Card>

            {/* Stress Trend */}
            <Card className="border-border/40 bg-card/40">
              <CardContent className="p-3 text-center flex flex-col items-center justify-between h-24">
                <Activity className="w-4 h-4 text-emerald-400 mb-1" />
                <span className="text-[10px] text-muted-foreground font-semibold">STRESS</span>
                <span className="text-xs font-bold text-foreground mt-0.5 capitalize">
                  {summary.stress_trend === 'insufficient_data' ? 'N/A' : summary.stress_trend}
                </span>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <Card className="border-dashed border-border/50 bg-transparent">
          <CardContent className="p-5 text-center text-xs text-muted-foreground">
            No wellness trends available yet. Log daily check-ins to build metrics.
          </CardContent>
        </Card>
      )}

      {/* 4. Today's AI Insight */}
      <Card className="border-violet-500/10 bg-card/60 backdrop-blur-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/10 blur-2xl rounded-full" />
        <CardContent className="p-4 space-y-2 relative z-10">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-violet-400 font-bold uppercase flex items-center gap-1.5">
              <BrainCircuit className="w-4 h-4 text-violet-500" /> {`${aiName}'s Insight`}
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

      {/* Quick Actions */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/check-in">
            <Button variant="outline" className="w-full h-12 rounded-xl bg-card/50 border-border/50 justify-start px-4 text-xs font-medium">
              Log Mood & Symptoms
            </Button>
          </Link>
          <Link href="/cycle">
            <Button variant="outline" className="w-full h-12 rounded-xl bg-card/50 border-border/50 justify-start px-4 text-xs font-medium">
              Track Period
            </Button>
          </Link>
        </div>
      </div>

    </div>
  );
}
