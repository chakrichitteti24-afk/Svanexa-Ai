'use client';

import React, { Component, ReactNode, useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BrainCircuit, CheckCircle2, Circle, Loader2, Sparkles, ArrowRight, Lock, Trophy, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { apiFetch } from '@/utils/api-client';
import { useHerSync } from '@/context/HerSyncContext';
import { format } from 'date-fns';
import { safeFormat } from '@/utils/date-utils';
import styles from './wellness.module.css';

class WellnessErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('WellnessPlan Boundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-background">
          <div className="max-w-md w-full text-center bg-card/80 backdrop-blur-xl border border-border/50 p-8 rounded-3xl shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-violet-500/10 text-violet-400 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-violet-400" />
            </div>
            <h2 className="text-xl font-extrabold text-foreground mb-2">No wellness plan available yet</h2>
            <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
              Complete your Morning Check-in to generate today&apos;s personalized wellness plan.
            </p>
            <div className="flex flex-col gap-3">
              <Link
                href="/check-in"
                className="w-full py-3.5 bg-gradient-to-r from-pink-500 to-violet-500 text-white font-bold rounded-full shadow-lg shadow-pink-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all text-center flex items-center justify-center gap-2 text-sm"
              >
                Go to Daily Check-in <ArrowRight className="w-4 h-4" />
              </Link>
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.location.reload();
                  } else {
                    this.setState({ hasError: false });
                  }
                }}
                className="w-full py-3 bg-secondary/60 hover:bg-secondary text-muted-foreground font-semibold rounded-full border border-border/50 text-xs transition-all cursor-pointer active:scale-95"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────

type TaskPriority = 'high' | 'recommended' | 'optional';
type TimeSlot = 'morning' | 'afternoon' | 'evening';
type TaskCategory = 'sleep' | 'stress' | 'mood' | 'cycle' | 'symptoms' | 'skin' | 'hydration' | 'exercise' | 'nutrition' | 'mindfulness' | 'pregnancy';

export type TaskStatus = 'pending' | 'completed' | 'skipped';

interface WellnessTask {
  id: string;
  text: string;
  category: TaskCategory;
  timeSlot: TimeSlot;
  priority: TaskPriority;
  status?: TaskStatus;
  estimatedTime?: string;
  rationale?: string;
  completed: boolean;
  completedAt: string | null;
}

interface WellnessPlan {
  id: string;
  planDate: string;
  tasks: WellnessTask[];
  wellnessScore: number;
  aiInsight: string;
  wellnessMode: string;
}

interface Streak {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  weeklyConsistency: number;
}

// ─── Category Config ─────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<TaskCategory, { label: string; emoji: string; color: string }> = {
  sleep:       { label: 'Sleep',       emoji: '🌙', color: 'rgba(139,92,246,0.15)' },
  stress:      { label: 'Stress',      emoji: '🧘', color: 'rgba(99,102,241,0.15)' },
  mood:        { label: 'Mood',        emoji: '😊', color: 'rgba(236,72,153,0.12)' },
  cycle:       { label: 'Cycle',       emoji: '🌺', color: 'rgba(239,68,68,0.12)'  },
  symptoms:    { label: 'Symptoms',    emoji: '💊', color: 'rgba(245,158,11,0.12)' },
  skin:        { label: 'Skin',        emoji: '✨', color: 'rgba(6,182,212,0.12)'  },
  hydration:   { label: 'Hydration',   emoji: '💧', color: 'rgba(59,130,246,0.12)' },
  exercise:    { label: 'Exercise',    emoji: '🏃', color: 'rgba(16,185,129,0.12)' },
  nutrition:   { label: 'Nutrition',   emoji: '🥗', color: 'rgba(34,197,94,0.12)'  },
  mindfulness: { label: 'Mindful',     emoji: '🌿', color: 'rgba(168,85,247,0.12)' },
  pregnancy:   { label: 'Pregnancy',   emoji: '💝', color: 'rgba(236,72,153,0.15)' },
};

const SLOT_CONFIG: Record<TimeSlot, { label: string; emoji: string; cssClass: string }> = {
  morning:   { label: 'Morning',   emoji: '🌅', cssClass: 'morning'   },
  afternoon: { label: 'Afternoon', emoji: '☀️',  cssClass: 'afternoon' },
  evening:   { label: 'Evening',   emoji: '🌙', cssClass: 'evening'   },
};

const MILESTONES = [
  { days: 7,   label: '7 Day',   emoji: '🔥' },
  { days: 30,  label: '30 Day',  emoji: '💎' },
  { days: 100, label: '100 Day', emoji: '👑' },
];

const scoreLabel = (s: number) => {
  if (s >= 90) return { text: 'Excellent', color: '#10B981' };
  if (s >= 75) return { text: 'Great',     color: '#34D399' };
  if (s >= 60) return { text: 'Good',      color: '#F59E0B' };
  if (s >= 45) return { text: 'Building',  color: '#F97316' };
  return              { text: 'Starting',  color: '#8B5CF6' };
};

// ─── Page Component ──────────────────────────────────────────────────────────

function getCurrentSlot(): TimeSlot {
  const h = new Date().getHours();
  if (h >= 6 && h < 12) return 'morning';
  if (h >= 12 && h < 18) return 'afternoon';
  return 'evening';
}

function WellnessPlanContent() {
  const { aiName, setWellnessTasks, refreshAll, checkinSlots } = useHerSync();

  const [loading, setLoading]       = useState(true);
  const [isError, setIsError]       = useState(false);
  const [generating, setGenerating] = useState(false);
  const [hasData, setHasData]       = useState(false);
  const [plan, setPlan]             = useState<WellnessPlan | null>(null);
  const [streak, setStreak]         = useState<Streak | null>(null);
  const [toggling, setToggling]     = useState<string | null>(null);
  const [animScore, setAnimScore]   = useState(0);
  const [activeFilter, setActiveFilter] = useState<TaskCategory | 'all'>('all');
  const [activePlanSlot, setActivePlanSlot] = useState<TimeSlot>(getCurrentSlot());

  // ── Load Plan ──
  const loadPlan = useCallback(async () => {
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const res = await apiFetch(`/api/wellness-plan?date=${todayStr}`);
      if (!res.ok) {
        setIsError(true);
        setLoading(false);
        return;
      }

      const body = await res.json();

      if (!body || (!body.hasData && !body.plan)) {
        setHasData(false);
        setPlan(null);
        setLoading(false);
        return;
      }

      const planDate = body.plan?.date || body.plan?.planDate;
      if (planDate && planDate !== todayStr) {
        setHasData(false);
        setPlan(null);
        setLoading(false);
        return;
      }

      setHasData(true);
      setPlan(body.plan || null);
      setStreak(body.streak || null);
      setWellnessTasks(body.plan?.tasks || []);

      if (body.plan?.wellnessScore !== undefined) {
        setTimeout(() => setAnimScore(body.plan.wellnessScore), 200);
      }
    } catch (err) {
      console.error('Error loading wellness plan:', err);
      setIsError(true);
      toast.error('Could not load your wellness plan.');
    } finally {
      setLoading(false);
    }
  }, [setWellnessTasks]);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  // ── Status Change (Pending / Completed / Skipped) ──
  const handleStatusChange = async (taskId: string, targetStatus: 'pending' | 'completed' | 'skipped') => {
    if (!plan || !plan.tasks || toggling) return;
    setToggling(taskId);

    const isDone = targetStatus === 'completed';
    const optimistic = plan.tasks.map(t =>
      t.id === taskId
        ? { 
            ...t, 
            status: targetStatus, 
            completed: isDone, 
            completedAt: isDone ? (t.completedAt || new Date().toISOString()) : null 
          }
        : t
    );
    setPlan(p => p ? { ...p, tasks: optimistic } : p);
    setWellnessTasks(optimistic);

    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const res = await apiFetch(`/api/wellness-plan/toggle`, {
        method: 'POST',
        body: JSON.stringify({ planId: plan.id, taskId, status: targetStatus, date: todayStr })
      });
      if (res.ok) {
        const body = await res.json();
        setPlan(p => p ? { ...p, tasks: body.tasks || [], wellnessScore: body.wellnessScore ?? body.score ?? p.wellnessScore, aiInsight: body.insight || p.aiInsight } : p);
        setStreak(body.streak || null);
        setWellnessTasks(body.tasks || []);
        if (body.wellnessScore !== undefined || body.score !== undefined) {
          setAnimScore(body.wellnessScore ?? body.score);
        }

        if (targetStatus === 'completed') toast.success('Task complete! Keep going 🌸');
        else if (targetStatus === 'skipped') toast.info('Task skipped.');

        if (body.tasks && body.tasks.every((t: any) => t.completed || t.status === 'completed')) {
          toast.success('🎉 Perfect day! All tasks complete!', { description: 'Your streak has been updated.' });
          refreshAll();
        }
      } else {
        setPlan(p => p ? { ...p, tasks: plan.tasks } : p);
        setWellnessTasks(plan.tasks);
        toast.error('Failed to update task.');
      }
    } catch {
      setPlan(p => p ? { ...p, tasks: plan.tasks } : p);
      setWellnessTasks(plan.tasks);
      toast.error('Network error.');
    } finally {
      setToggling(null);
    }
  };

  const handleToggle = (taskId: string) => {
    const current = plan?.tasks?.find(t => t.id === taskId);
    const nextStatus = current?.completed || current?.status === 'completed' ? 'pending' : 'completed';
    handleStatusChange(taskId, nextStatus);
  };

  // ── Regenerate ──
  const handleRegenerate = async () => {
    setGenerating(true);
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const res = await apiFetch('/api/wellness-plan', {
        method: 'POST',
        body: JSON.stringify({ date: todayStr, forceRegenerate: true })
      });
      if (res.ok) {
        await loadPlan();
        toast.success('Plan refreshed with fresh recommendations! 🌸');
      }
    } catch {
      toast.error('Could not regenerate plan.');
    } finally {
      setGenerating(false);
    }
  };

  // ── Derived data ──
  const activeCategories = useMemo(() => {
    if (!plan || !plan.tasks) return [];
    const cats = new Set(plan.tasks.map(t => t.category));
    return Array.from(cats) as TaskCategory[];
  }, [plan]);

  const filteredTasksBySlot = useCallback((slot: TimeSlot) => {
    if (!plan || !plan.tasks) return [];
    let tasks = plan.tasks.filter(t => t.timeSlot === slot);
    if (activeFilter !== 'all') {
      tasks = tasks.filter(t => t.category === activeFilter);
    }
    return tasks;
  }, [plan, activeFilter]);

  // ── Sequential slot unlocking ──
  const isSlotUnlocked = useCallback((slot: TimeSlot): boolean => {
    if (slot === 'morning') return !!checkinSlots?.morning?.completed;
    if (slot === 'afternoon') return !!checkinSlots?.afternoon?.completed;
    if (slot === 'evening') return !!checkinSlots?.evening?.completed;
    return false;
  }, [checkinSlots]);

  const isSlotAllDone = useCallback((slot: TimeSlot): boolean => {
    if (!plan || !plan.tasks) return false;
    const tasks = plan.tasks.filter(t => t.timeSlot === slot);
    return tasks.length > 0 && tasks.every(t => t.completed || t.status === 'completed');
  }, [plan]);

  // ── Premium AI Generation Loading Skeleton ──
  if (loading || generating) {
    return (
      <div className={styles.page}>
        <div className="max-w-5xl mx-auto w-full space-y-6 p-4 md:p-8">
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center text-center p-6 bg-card/80 backdrop-blur-xl border border-violet-500/25 rounded-3xl shadow-xl space-y-3 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-violet-500/10 via-pink-500/10 to-violet-500/10 animate-pulse pointer-events-none" />
            <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-violet-500 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-pink-500/25 animate-bounce">
              <Sparkles className="w-7 h-7 fill-white/20 animate-pulse" />
            </div>
            <div className="space-y-1 z-10">
              <h3 className="text-base md:text-lg font-bold text-foreground flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-pink-400" />
                Creating your personalized wellness plan...
              </h3>
              <p className="text-xs text-muted-foreground font-medium">
                Analyzing cycle phase, mood & vitals for tailored daily recommendations.
              </p>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-2 animate-pulse">
            <div className="md:col-span-5 space-y-4">
              <div className="h-56 bg-card/60 rounded-3xl border border-border/30" />
              <div className="h-40 bg-card/40 rounded-3xl border border-border/20" />
              <div className="h-32 bg-card/40 rounded-3xl border border-border/20" />
            </div>
            <div className="md:col-span-7 space-y-4">
              <div className="h-28 bg-card/60 rounded-2xl border border-border/30" />
              <div className="h-28 bg-card/60 rounded-2xl border border-border/30" />
              <div className="h-28 bg-card/60 rounded-2xl border border-border/30" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Error Retry Screen ──
  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="max-w-md w-full text-center bg-card/80 backdrop-blur-xl border border-border/50 p-8 rounded-3xl shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-violet-500/10 text-violet-400 flex items-center justify-center mx-auto mb-4 font-mono">
            <BrainCircuit className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-extrabold text-foreground mb-2">Unable to connect to AI Coach</h2>
          <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
            We couldn&apos;t load your wellness plan right now. Please check your connection and try again.
          </p>
          <button
            onClick={loadPlan}
            className="w-full py-3.5 bg-gradient-to-r from-pink-500 to-violet-500 text-white font-bold rounded-full shadow-lg shadow-pink-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all text-center flex items-center justify-center gap-2 text-sm"
          >
            <RotateCcw className="w-4 h-4" /> Retry Loading
          </button>
        </div>
      </div>
    );
  }

  // ── Empty State Screen ──
  if (!hasData || !plan || !plan.tasks || plan.tasks.length === 0) {
    return (
      <div className={styles.page}>
        <div className="max-w-2xl mx-auto w-full pt-8 px-4 pb-24 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center text-center p-8 bg-card/80 backdrop-blur-md border border-border/40 rounded-3xl shadow-xl"
          >
            <div className="w-20 h-20 rounded-full bg-violet-500/10 flex items-center justify-center mb-6">
              <Sparkles className="w-10 h-10 text-violet-400" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">
              No wellness plan available yet
            </h2>
            <p className="text-muted-foreground mb-8 text-sm max-w-md leading-relaxed">
              Complete your Morning Check-in to generate today&apos;s personalized wellness plan based on how you feel.
            </p>
            <Link
              href="/check-in"
              className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-gradient-to-r from-pink-500 to-violet-500 text-white font-bold shadow-lg shadow-pink-500/25 transition-all hover:scale-105 flex items-center justify-center gap-2"
            >
              Go to Daily Check-in <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </div>
    );
  }

  const slots: TimeSlot[] = ['morning', 'afternoon', 'evening'];
  const tasks = plan.tasks || [];
  const total = tasks.length;
  const done  = tasks.filter(t => t.completed || t.status === 'completed').length;
  const allComplete = done === total && total > 0;
  const modeName = (plan.wellnessMode || 'general').toUpperCase();
  const { text: scoreText, color: scoreColor } = scoreLabel(animScore);
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (animScore / 100) * circumference;

  return (
    <div className={styles.page}>

      {/* ── Header ── */}
      <motion.div className={styles.header} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className={styles.headerRow}>
          <span className={styles.badge}>✨ AI Wellness Coach</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', fontWeight: 600 }}>
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </span>
        </div>
        <h1 className={styles.title}>Daily Wellness Journey</h1>
        <p className={styles.subtitle}>Personalized plan for {modeName} mode · {done}/{total} tasks complete</p>
      </motion.div>

      {/* ── 2-COLUMN GRID ── */}
      <div className={styles.mainGrid}>

        {/* ════ LEFT COLUMN — Score + Insights ════ */}
        <div className={styles.leftCol}>

          {/* Score Card */}
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div className={styles.scoreCard}>
              <div className={styles.scoreGlow} />
              <div className={styles.scoreLeft}>
                <div>
                  <div className={styles.scoreLabel}>Today&apos;s Wellness Score</div>
                  <div className={styles.scoreValueRow}>
                    <div className={styles.scoreValue}>{animScore}%</div>
                    <div className={styles.scoreTag} style={{ color: scoreColor, background: `${scoreColor}20` }}>{scoreText}</div>
                  </div>
                </div>
                <div className={styles.progressBar}>
                  <div className={styles.progressFill} style={{ width: `${animScore}%` }} />
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', fontWeight: 600 }}>
                  {done} of {total} tasks completed
                </div>
                {/* Score Breakdown */}
                <div className={styles.scoreBreakdown}>
                  <div className={styles.scoreBreakdownItem}>
                    <span className={styles.scoreBreakdownDot} style={{ background: '#A78BFA' }} />
                    Sleep
                  </div>
                  <div className={styles.scoreBreakdownItem}>
                    <span className={styles.scoreBreakdownDot} style={{ background: '#3B82F6' }} />
                    Hydration
                  </div>
                  <div className={styles.scoreBreakdownItem}>
                    <span className={styles.scoreBreakdownDot} style={{ background: '#10B981' }} />
                    Exercise
                  </div>
                  <div className={styles.scoreBreakdownItem}>
                    <span className={styles.scoreBreakdownDot} style={{ background: '#F472B6' }} />
                    Mood
                  </div>
                </div>
              </div>
              <div className={styles.scoreRing}>
                <svg viewBox="0 0 96 96" width="96" height="96">
                  <circle className={styles.scoreRingBg} cx="48" cy="48" r="40" />
                  <circle
                    className={styles.scoreRingFill}
                    cx="48" cy="48" r="40"
                    stroke={`url(#scoreGrad)`}
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                  />
                  <defs>
                    <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="var(--hs-violet)" />
                      <stop offset="100%" stopColor="var(--hs-pink)" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className={styles.scoreRingText}>
                  <span>{animScore}%</span>
                  <span>Score</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Progress & Consistency Breakdown */}
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <div className={styles.premiumCard} style={{ padding: '1.25rem', marginBottom: '0.5rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--hs-pink)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
                📊 Progress Tracking
              </div>
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5 mb-2.5">
                <div className="bg-white/[0.03] border border-white/[0.06] p-2 sm:p-2.5 rounded-2xl text-center flex flex-col justify-center min-w-0">
                  <span className="text-[10px] sm:text-xs text-muted-foreground font-semibold truncate">🌅 Morning (30%)</span>
                  <div className="text-sm sm:text-base font-black text-amber-400 mt-0.5">
                    {plan.tasks.filter(t => t.timeSlot === 'morning').length > 0
                      ? Math.round((plan.tasks.filter(t => t.timeSlot === 'morning' && (t.completed || t.status === 'completed')).length / plan.tasks.filter(t => t.timeSlot === 'morning').length) * 100)
                      : 0}%
                  </div>
                </div>
                <div className="bg-white/[0.03] border border-white/[0.06] p-2 sm:p-2.5 rounded-2xl text-center flex flex-col justify-center min-w-0">
                  <span className="text-[10px] sm:text-xs text-muted-foreground font-semibold truncate">☀️ Midday (30%)</span>
                  <div className="text-sm sm:text-base font-black text-sky-400 mt-0.5">
                    {plan.tasks.filter(t => t.timeSlot === 'afternoon').length > 0
                      ? Math.round((plan.tasks.filter(t => t.timeSlot === 'afternoon' && (t.completed || t.status === 'completed')).length / plan.tasks.filter(t => t.timeSlot === 'afternoon').length) * 100)
                      : 0}%
                  </div>
                </div>
                <div className="bg-white/[0.03] border border-white/[0.06] p-2 sm:p-2.5 rounded-2xl text-center flex flex-col justify-center min-w-0">
                  <span className="text-[10px] sm:text-xs text-muted-foreground font-semibold truncate">🌙 Evening (40%)</span>
                  <div className="text-sm sm:text-base font-black text-purple-400 mt-0.5">
                    {plan.tasks.filter(t => t.timeSlot === 'evening').length > 0
                      ? Math.round((plan.tasks.filter(t => t.timeSlot === 'evening' && (t.completed || t.status === 'completed')).length / plan.tasks.filter(t => t.timeSlot === 'evening').length) * 100)
                      : 0}%
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
                <div className="bg-white/[0.03] border border-white/[0.06] p-2 sm:p-2.5 rounded-2xl text-center flex flex-col justify-center min-w-0">
                  <span className="text-[10px] sm:text-xs text-muted-foreground font-semibold truncate">Daily</span>
                  <div className="text-xs sm:text-sm font-extrabold text-emerald-400 mt-0.5">{animScore}%</div>
                </div>
                <div className="bg-white/[0.03] border border-white/[0.06] p-2 sm:p-2.5 rounded-2xl text-center flex flex-col justify-center min-w-0">
                  <span className="text-[10px] sm:text-xs text-muted-foreground font-semibold truncate">Weekly</span>
                  <div className="text-xs sm:text-sm font-extrabold text-violet-400 mt-0.5">{streak?.weeklyConsistency ?? 100}%</div>
                </div>
                <div className="bg-white/[0.03] border border-white/[0.06] p-2 sm:p-2.5 rounded-2xl text-center flex flex-col justify-center min-w-0">
                  <span className="text-[10px] sm:text-xs text-muted-foreground font-semibold truncate">Monthly</span>
                  <div className="text-xs sm:text-sm font-extrabold text-pink-400 mt-0.5">{Math.min(100, Math.round(((streak?.currentStreak ?? 1) / 30) * 100))}%</div>
                </div>
              </div>
            </div>

            <div className={styles.streakRow}>
              {[
                { icon: '🔥', val: streak?.currentStreak ?? 1, lbl: 'Streak', unit: 'd' },
                { icon: '🏆', val: streak?.longestStreak ?? 1, lbl: 'Best', unit: 'd' },
                { icon: '📅', val: `${done}/${total}`, lbl: "Today", unit: '' },
                { icon: '📊', val: `${streak?.weeklyConsistency ?? 100}%`, lbl: 'Weekly', unit: '' },
              ].map(({ icon, val, lbl, unit }) => (
                <motion.div key={lbl} className={styles.streakCard} whileHover={{ y: -3 }}>
                  <span className={styles.streakIcon}>{icon}</span>
                  <span className={styles.streakVal}>{val}{unit}</span>
                  <span className={styles.streakLbl}>{lbl}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Milestone Badges */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
            <div className={styles.milestoneRow}>
              {MILESTONES.map(m => {
                const achieved = (streak?.longestStreak ?? 1) >= m.days;
                return (
                  <div key={m.days} className={`${styles.milestoneBadge} ${achieved ? styles.achieved : ''}`}>
                    <span>{m.emoji}</span>
                    <span>{m.label}</span>
                    {achieved && <Trophy size={10} />}
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* AI Coach Card */}
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <div className={styles.coachCard}>
              <div className={styles.coachGlow} />
              <div className={styles.coachAvatar}>
                <BrainCircuit size={20} color="#fff" />
              </div>
              <div className={styles.coachContent}>
                <div className={styles.coachName}>{aiName} · AI Wellness Coach</div>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={plan.aiInsight}
                    className={styles.coachText}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.3 }}
                  >
                    {plan.aiInsight}
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>

          {/* Regenerate Button */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            style={{ display: 'flex', justifyContent: 'center' }}>
            <motion.button
              onClick={handleRegenerate}
              disabled={generating}
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              className={styles.regenBtn}
            >
              {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {generating ? 'Generating...' : 'Refresh Plan'}
            </motion.button>
          </motion.div>
        </div>

        {/* ════ RIGHT COLUMN — Tasks ════ */}
        <div className={styles.rightCol}>

          {/* All Complete Banner */}
          {allComplete && (
            <motion.div
              className={styles.completeBanner}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', bounce: 0.4 }}
            >
              <span className={styles.completeBannerEmoji}>🎉</span>
              <p className={styles.completeBannerText}>
                Perfect day! All {total} wellness tasks complete. Your streak is growing!
              </p>
            </motion.div>
          )}

          {/* Period Slot Switcher (Shows current period plan by default) */}
          <div className="flex items-center justify-between gap-1.5 sm:gap-2 mb-4 p-1.5 rounded-2xl bg-secondary/50 border border-border/40 w-full overflow-x-auto">
            {(['morning', 'afternoon', 'evening'] as const).map(slot => {
              const cfg = SLOT_CONFIG[slot];
              const isTabActive = slot === activePlanSlot;
              const isTabUnlocked = isSlotUnlocked(slot);
              return (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setActivePlanSlot(slot)}
                  className={`flex-1 min-w-0 py-2 sm:py-2.5 px-2 sm:px-3 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1 sm:gap-1.5 active:scale-[0.98] ${
                    isTabActive
                      ? 'bg-gradient-to-r from-pink-500 to-violet-500 text-white shadow-md shadow-pink-500/20'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/80'
                  }`}
                >
                  <span className="shrink-0">{cfg.emoji}</span>
                  <span className="truncate">{cfg.label}</span>
                  {isTabUnlocked && <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-300 ml-0.5 shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Category Filter Pills */}
          <div className={styles.filterRow}>
            <button
              className={`${styles.filterPill} ${activeFilter === 'all' ? styles.active : ''}`}
              onClick={() => setActiveFilter('all')}
            >
              All
            </button>
            {activeCategories.map(cat => {
              const cfg = CATEGORY_CONFIG[cat] || { label: cat, emoji: '✨', color: 'rgba(168,85,247,0.12)' };
              return (
                <button
                  key={cat}
                  className={`${styles.filterPill} ${activeFilter === cat ? styles.active : ''}`}
                  onClick={() => setActiveFilter(activeFilter === cat ? 'all' : cat)}
                >
                  {cfg.emoji} {cfg.label}
                </button>
              );
            })}
          </div>

          {/* Time-Slotted Tasks (Render active period plan) */}
          {[activePlanSlot].map((slot, slotIdx) => {
            const slotTasks = filteredTasksBySlot(slot);
            const slotDone = slotTasks.filter(t => t.completed || t.status === 'completed').length;
            const cfg = SLOT_CONFIG[slot] || { label: slot, emoji: '✨', cssClass: 'morning' };
            const unlocked = isSlotUnlocked(slot);
            const allDoneForSlot = isSlotAllDone(slot);

            return (
              <motion.div
                key={slot}
                className={styles.taskSection}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + slotIdx * 0.08 }}
              >
                {/* Slot Header */}
                <div className={`${styles.sectionHeader} ${styles[cfg.cssClass as keyof typeof styles] || ''}`}>
                  <span>{cfg.emoji}</span>
                  <span>{cfg.label}</span>
                  {unlocked && slotTasks.length > 0 && (
                    <span className={styles.sectionProgress}>{slotDone}/{slotTasks.length}</span>
                  )}
                  {!unlocked && <Lock size={12} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
                </div>

                {/* Slot all-done banner */}
                {allDoneForSlot && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '0.75rem', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', fontWeight: 700, color: '#34D399', marginBottom: '0.5rem' }}
                  >
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                    <span className="truncate">{cfg.label} Tasks Completed! {slotIdx < 2 ? `${SLOT_CONFIG[slots[slotIdx + 1] as TimeSlot]?.label || 'Next'} check-in is next.` : '🎉'}</span>
                  </motion.div>
                )}

                {/* Locked overlay */}
                {!unlocked ? (
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '0.75rem', padding: '1.25rem', textAlign: 'center', opacity: 0.7 }}>
                    <Lock size={20} style={{ color: 'rgba(255,255,255,0.4)', margin: '0 auto 0.5rem' }} />
                    <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
                      Complete your {cfg.label} Check-in to generate tasks for this slot.
                    </p>
                    <Link href="/check-in" style={{ display: 'inline-block', marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--hs-violet)', fontWeight: 600 }}>
                      Go to Check-in →
                    </Link>
                  </div>
                ) : slotTasks.length === 0 ? (
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '0.75rem', padding: '1.25rem', textAlign: 'center', opacity: 0.5 }}>
                    <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
                      No tasks for {cfg.label}.
                    </p>
                  </div>
                ) : (
                  /* Tasks */
                  slotTasks.map((task, taskIdx) => {
                    const catCfg = CATEGORY_CONFIG[task.category] || CATEGORY_CONFIG.mindfulness || { label: task.category, emoji: '✨', color: 'rgba(168,85,247,0.12)' };
                    const isLoading = toggling === task.id;
                    const isDone = task.completed || task.status === 'completed';
                    const isSkipped = task.status === 'skipped';

                    const priorityCls = isDone ? styles.priorityOpt
                      : task.priority === 'high' ? styles.priorityHigh
                      : task.priority === 'recommended' ? styles.priorityRec : styles.priorityOpt;
                    const priorityLabel = isDone ? '✓ Done'
                      : isSkipped ? '⏭️ Skipped'
                      : task.priority === 'high' ? '🔥 High'
                      : task.priority === 'recommended' ? '⭐ Rec' : 'Optional';

                    return (
                      <motion.div
                        key={task.id}
                        className={`${styles.taskCard} ${isDone ? styles.completed : ''} ${isSkipped ? 'opacity-50' : ''} ${styles[task.priority as keyof typeof styles] || ''}`}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 + slotIdx * 0.06 + taskIdx * 0.04, duration: 0.3, ease: 'easeOut' }}
                      >
                        {/* Top Row: Check Circle + Text & Badges */}
                        <div className={styles.taskTopRow}>
                          {/* Check circle */}
                          <button 
                            type="button"
                            aria-label={`Mark task as ${isDone ? 'incomplete' : 'complete'}`}
                            className={`${styles.taskCheck} ${isDone ? styles.done : ''} ${isLoading ? styles.loading : ''}`}
                            onClick={() => handleToggle(task.id)}
                          >
                            <AnimatePresence mode="wait">
                              {isLoading ? (
                                <motion.div key="spin" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                  <Loader2 size={12} style={{ color: 'var(--hs-violet)' }} className="animate-spin" />
                                </motion.div>
                              ) : isDone ? (
                                <motion.div key="done" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.5 }}>
                                  <CheckCircle2 size={14} color="#fff" fill="#fff" />
                                </motion.div>
                              ) : (
                                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                  <Circle size={14} color="var(--muted-foreground)" />
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </button>

                          {/* Content */}
                          <div className={styles.taskBody}>
                            <div className={styles.taskMeta}>
                              <span className={`${styles.taskBadge} ${priorityCls}`}>{priorityLabel}</span>
                              <span className={`${styles.taskBadge}`} style={{ background: catCfg.color, color: 'var(--foreground)', border: 'none' }}>
                                {catCfg.emoji} {catCfg.label}
                              </span>
                              {task.estimatedTime && (
                                <span className={styles.taskBadge} style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--muted-foreground)', border: 'none' }}>
                                  ⏱️ {task.estimatedTime}
                                </span>
                              )}
                            </div>
                            
                            <p className={`${styles.taskText} ${isDone ? styles.done : ''}`}>{task.text}</p>
                            
                            {/* Luna AI Rationale */}
                            {task.rationale && (
                              <div style={{ marginTop: '0.4rem', padding: '0.45rem 0.65rem', borderRadius: '0.5rem', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)', fontSize: '0.72rem', color: 'var(--muted-foreground)', lineHeight: '1.4' }}>
                                <span style={{ fontWeight: 700, color: 'var(--hs-violet)' }}>Luna AI: </span>
                                {task.rationale}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Status Actions Row */}
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-2 border-t border-white/5 w-full">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleStatusChange(task.id, 'completed'); }}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 cursor-pointer min-h-[32px] ${
                              isDone
                                ? 'bg-emerald-500 text-white shadow-sm'
                                : 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                            }`}
                          >
                            ✓ Done
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleStatusChange(task.id, 'pending'); }}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 cursor-pointer min-h-[32px] ${
                              !isDone && !isSkipped
                                ? 'bg-violet-600 text-white shadow-sm'
                                : 'bg-white/5 text-muted-foreground hover:bg-white/10'
                            }`}
                          >
                            ⏳ Pending
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleStatusChange(task.id, 'skipped'); }}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 cursor-pointer min-h-[32px] ${
                              isSkipped
                                ? 'bg-rose-500 text-white shadow-sm'
                                : 'bg-rose-500/15 text-rose-300 hover:bg-rose-500/25'
                            }`}
                          >
                            ⏭️ Skip
                          </button>
                          {task.completedAt && (
                            <span className="text-[10px] sm:text-xs text-emerald-400 font-semibold ml-auto truncate">
                              Completed {safeFormat(task.completedAt, 'h:mm a')}
                            </span>
                          )}
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function WellnessPlanPage() {
  return (
    <WellnessErrorBoundary>
      <WellnessPlanContent />
    </WellnessErrorBoundary>
  );
}
