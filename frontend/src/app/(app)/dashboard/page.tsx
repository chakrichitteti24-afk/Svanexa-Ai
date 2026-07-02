'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Target, AlertCircle, ArrowRight, BrainCircuit, Loader2,
  CalendarHeart, Smile, Moon, Activity, Sparkles, CheckCircle2
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
    expectedPeriod: string;
    confidenceScore: number;
    confidenceLabel: string;
    isPCOSMode: boolean;
    explanation: string;
  };
}

interface WellnessPlanData {
  hasData: boolean;
  plan: { id: string; tasks: { id: string; text: string; category: string; completed: boolean }[] } | null;
  streak: { currentStreak: number; longestStreak: number } | null;
  message?: string;
}

/* ── Small glassmorphism card wrapper ── */
function GlassCard({ children, className = '', style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`rounded-2xl p-4 border ${className}`}
      style={{
        background: 'rgba(18,16,28,0.7)',
        borderColor: 'rgba(168,85,247,0.12)',
        backdropFilter: 'blur(16px)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ── Trend chip ── */
function TrendChip({ label, value, icon: Icon, color }: { label: string; value: string; icon: any; color: string }) {
  return (
    <div
      className="flex flex-col items-center justify-between gap-2 py-3 px-2 rounded-xl"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(168,85,247,0.1)' }}
    >
      <Icon className={`w-4 h-4 ${color}`} />
      <span className="text-[10px] text-[#5a527a] font-semibold uppercase tracking-wider">{label}</span>
      <span className="text-xs font-bold text-white capitalize">{value}</span>
    </div>
  );
}

export default function DashboardPage() {
  const [userName, setUserName] = useState<string>('there');
  const [aiName, setAiName] = useState<string>('Luna');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<HealthSummary | null>(null);
  const [prediction, setPrediction] = useState<PeriodPrediction | null>(null);
  const [wellnessPlan, setWellnessPlan] = useState<WellnessPlanData | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const storedName = localStorage.getItem('hersync_username') || 'Guest';
        const storedAiName = localStorage.getItem('hersync_ai_name') || 'Luna';
        setUserName(storedName); 
        setAiName(storedAiName);
        
        const [sumRes, predRes, wellRes] = await Promise.all([
          apiFetch('/api/health-summary'),
          apiFetch('/api/period-prediction'),
          apiFetch('/api/wellness-plan'),
        ]);
        if (sumRes.ok) setSummary(await sumRes.json());
        if (predRes.ok) setPrediction(await predRes.json());
        if (wellRes.ok) setWellnessPlan(await wellRes.json());
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Wellness score
  let wellnessScore = 0;
  const hasCheckedIn = summary?.has_checked_in_today || false;
  if (hasCheckedIn && summary?.today_log) {
    const l = summary.today_log;
    wellnessScore = Math.round(
      Math.min(25, (Number(l.sleep) / 8) * 25) +
      Math.min(25, (Number(l.water) / 2.5) * 25) +
      Math.min(20, (Number(l.exercise) / 30) * 20) +
      Math.min(15, (10 - Number(l.stress)) * 1.5) +
      (l.mood === 'happy' ? 15 : l.mood === 'calm' ? 13 : l.mood === 'anxious' ? 8 : l.mood === 'sad' || l.mood === 'angry' ? 5 : 10)
    );
  }

  const getTodayInsight = () => {
    if (!summary || summary.total_logs_count < 3) return "Add a few more daily check-ins so I can generate personalized insights for you.";
    if (!hasCheckedIn) return `Morning, ${userName}! Log today's check-in to unlock your personalized insight.`;
    const l = summary.today_log;
    if (l?.sleep < 6.5) return "Your sleep is a bit low today — rest supports your hormonal balance. A short nap can help.";
    if (l?.stress > 7) return "Stress is elevated today. High cortisol can affect your cycle timing. Try a 3-minute breathing exercise.";
    if (l?.water < 1.5) return "Your hydration is below target. Drinking more water reduces bloating and supports your metabolism.";
    return "Your wellness habits look balanced today! Keep it up. 💜";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0f' }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-pink-400" />
          <p className="text-xs text-[#5a527a]">Loading your dashboard…</p>
        </div>
      </div>
    );
  }

  const hasLogs = (summary?.total_logs_count || 0) > 0;
  const isPCOSMode = prediction?.prediction?.isPCOSMode || false;

  // Wellness plan progress
  const planTasks = wellnessPlan?.plan?.tasks || [];
  const planCompleted = planTasks.filter(t => t.completed).length;
  const planTotal = planTasks.length;
  const planPct = planTotal > 0 ? Math.round((planCompleted / planTotal) * 100) : 0;

  return (
    <div className="max-w-md mx-auto space-y-4 pb-24 px-0.5">

      {/* Greeting */}
      <div className="pt-1 pb-2">
        <h1 className="text-[22px] font-bold text-white leading-tight">
          Good day, {userName} 🌸
        </h1>
        <p className="text-sm text-pink-300/70 mt-0.5 font-medium">{aiName} is here for you 💜</p>
      </div>

      {/* PCOS Mode Banner */}
      {isPCOSMode && (
        <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-pink-500/10 border border-pink-500/20 text-xs text-pink-300">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-pink-400" />
          <span><strong>PCOS Mode active:</strong> predictions are calibrated for cycle variability.</span>
        </div>
      )}

      {/* ── Wellness Score Ring ── */}
      <GlassCard className="flex flex-col items-center text-center py-6">
        <p className="text-[10px] font-bold text-[#5a527a] uppercase tracking-widest mb-4">Today's Wellness Score</p>
        <div className="relative w-32 h-32 flex items-center justify-center mb-4">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="7" />
            <circle
              cx="50" cy="50" r="42" fill="none"
              stroke="url(#scoreGrad)" strokeWidth="7" strokeLinecap="round"
              strokeDasharray="263.9"
              strokeDashoffset={263.9 - (263.9 * (hasCheckedIn ? wellnessScore : 0)) / 100}
              className="transition-all duration-1000"
            />
            <defs>
              <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ec4899" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="text-3xl font-extrabold text-white">{hasCheckedIn ? `${wellnessScore}%` : '--'}</span>
            <span className="text-[10px] text-[#5a527a] mt-0.5">{hasCheckedIn ? 'Today' : 'Log first'}</span>
          </div>
        </div>

        {!hasCheckedIn ? (
          <Link href="/check-in" className="w-full max-w-[240px]">
            <Button className="w-full h-10 rounded-full bg-gradient-to-r from-pink-500 to-violet-600 text-white text-xs font-semibold border-0 hover:opacity-90 shadow-lg shadow-violet-500/20">
              Log Today's Check-In
            </Button>
          </Link>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-green-400 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" /> Check-in complete!
          </div>
        )}
      </GlassCard>

      {/* ── Wellness Plan Progress ── */}
      <GlassCard
        className="relative overflow-hidden"
        style={{ borderColor: 'rgba(139,92,246,0.25)' }}
      >
        <div className="absolute top-0 right-0 w-28 h-28 bg-violet-500/10 blur-3xl rounded-full pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-violet-300 uppercase tracking-widest flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Daily Wellness Plan
            </span>
            {wellnessPlan?.streak && wellnessPlan.streak.currentStreak > 0 && (
              <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                🔥 {wellnessPlan.streak.currentStreak}d
              </span>
            )}
          </div>

          {!wellnessPlan ? (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
              <span className="text-xs text-[#5a527a]">Loading plan…</span>
            </div>
          ) : !wellnessPlan.hasData ? (
            <div className="space-y-2">
              <p className="text-xs text-[#7c71a4] leading-relaxed">Log check-ins for 3+ days to unlock your AI Wellness Plan.</p>
              <Link href="/check-in">
                <Button size="sm" variant="ghost" className="text-xs text-violet-400 hover:text-violet-300 p-0 h-auto gap-1">
                  Start logging <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#7c71a4]">{planCompleted}/{planTotal} tasks done</span>
                <span className="font-bold text-white">{planPct}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full overflow-hidden bg-white/5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500 transition-all duration-700"
                  style={{ width: `${planPct}%` }}
                />
              </div>
              <Link href="/wellness-plan">
                <Button size="sm" className="text-xs h-8 rounded-full bg-violet-600 hover:bg-violet-500 text-white border-0 gap-1.5 mt-1">
                  Open Plan <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
          )}
        </div>
      </GlassCard>

      {/* ── Period Prediction ── */}
      <GlassCard>
        <div className="flex items-center gap-1.5 mb-2.5">
          <Target className="w-4 h-4 text-pink-400" />
          <span className="text-[10px] font-bold text-[#5a527a] uppercase tracking-widest">Expected Period Window</span>
        </div>
        {prediction?.hasData && prediction.prediction ? (
          <div className="space-y-1.5">
            <p className="text-base font-bold text-white">{prediction.prediction.expectedPeriod}</p>
            <div className="flex items-center gap-2 text-xs text-[#7c71a4]">
              <span>Confidence:</span>
              <span className="text-pink-400 font-bold">{prediction.prediction.confidenceScore}%</span>
              <span>({prediction.prediction.confidenceLabel})</span>
            </div>
            <p className="text-xs text-[#5a527a] leading-relaxed">{prediction.prediction.explanation}</p>
            <p className="text-[10px] text-[#3d3558] mt-1">Predictions are estimates, not medical advice.</p>
          </div>
        ) : (
          <p className="text-sm text-[#5a527a]">Not enough data yet.</p>
        )}
      </GlassCard>

      {/* ── Wellness Trends Grid ── */}
      {hasLogs && summary ? (
        <div className="space-y-2.5">
          <p className="text-[10px] font-bold text-[#5a527a] uppercase tracking-widest px-0.5">Wellness Trends</p>
          <div className="grid grid-cols-3 gap-2">
            <TrendChip
              label="Sleep"
              value={summary.sleep_avg ? `${summary.sleep_avg}h` : 'N/A'}
              icon={Moon}
              color="text-violet-400"
            />
            <TrendChip
              label="Mood"
              value={summary.mood_trend === 'insufficient_data' ? 'N/A' : summary.mood_trend}
              icon={Smile}
              color="text-pink-400"
            />
            <TrendChip
              label="Stress"
              value={summary.stress_trend === 'insufficient_data' ? 'N/A' : summary.stress_trend}
              icon={Activity}
              color="text-emerald-400"
            />
          </div>
        </div>
      ) : (
        <GlassCard className="border-dashed text-center">
          <p className="text-xs text-[#5a527a]">No wellness trends yet. Log daily check-ins to build your data.</p>
        </GlassCard>
      )}

      {/* ── AI Insight ── */}
      <GlassCard className="relative overflow-hidden" style={{ borderColor: 'rgba(139,92,246,0.2)' }}>
        <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/8 blur-2xl rounded-full pointer-events-none" />
        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-1.5">
            <BrainCircuit className="w-4 h-4 text-violet-400" />
            <span className="text-[10px] font-bold text-violet-300 uppercase tracking-widest">{aiName}'s Insight</span>
          </div>
          <p className="text-sm text-[#ddd6fe] leading-relaxed font-medium">{getTodayInsight()}</p>
          <Link href="/companion">
            <Button size="sm" className="text-xs h-8 rounded-full bg-violet-600/80 hover:bg-violet-600 text-white border-0 gap-1.5 mt-1">
              Chat with {aiName} <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
        </div>
      </GlassCard>

      {/* ── Quick Actions ── */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold text-[#5a527a] uppercase tracking-widest px-0.5">Quick Actions</p>
        <div className="grid grid-cols-2 gap-2.5">
          <Link href="/check-in">
            <button className="w-full h-12 rounded-xl text-xs font-semibold text-[#c4b8f0] hover:text-white transition-all" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(168,85,247,0.12)' }}>
              Log Mood & Symptoms
            </button>
          </Link>
          <Link href="/cycle">
            <button className="w-full h-12 rounded-xl text-xs font-semibold text-[#c4b8f0] hover:text-white transition-all" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(168,85,247,0.12)' }}>
              Track Period
            </button>
          </Link>
        </div>
      </div>

    </div>
  );
}
