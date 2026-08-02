'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BrainCircuit, CheckCircle2, Circle, Loader2, Sparkles, ArrowRight, Lock, Trophy, PartyPopper } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { apiFetch } from '@/utils/api-client';
import { useHerSync } from '@/context/HerSyncContext';
import { format } from 'date-fns';
import styles from './wellness.module.css';

// ─── Types ──────────────────────────────────────────────────────────────────

type TaskPriority = 'high' | 'recommended' | 'optional';
type TimeSlot = 'morning' | 'afternoon' | 'evening';
type TaskCategory = 'sleep' | 'stress' | 'mood' | 'cycle' | 'symptoms' | 'skin' | 'hydration' | 'exercise' | 'nutrition' | 'mindfulness' | 'pregnancy';

interface WellnessTask {
  id: string;
  text: string;
  category: TaskCategory;
  timeSlot: TimeSlot;
  priority: TaskPriority;
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

// ─── Page ────────────────────────────────────────────────────────────────────

export default function WellnessPlanPage() {
  const { aiName, setWellnessTasks, refreshAll, totalCheckIns, checkinSlots } = useHerSync();

  const [loading, setLoading]     = useState(true);
  const [generating, setGenerating] = useState(false);
  const [hasData, setHasData]     = useState(false);
  const [logsCount, setLogsCount] = useState(0);
  const [plan, setPlan]           = useState<WellnessPlan | null>(null);
  const [streak, setStreak]       = useState<Streak | null>(null);
  const [toggling, setToggling]   = useState<string | null>(null);
  const [animScore, setAnimScore] = useState(0);
  const [activeFilter, setActiveFilter] = useState<TaskCategory | 'all'>('all');

  // ── Load Plan ──
  const loadPlan = useCallback(async () => {
    try {
      const res = await apiFetch('/api/v1/wellness-plan');
      if (!res.ok) { setLoading(false); return; }
      const body = await res.json();

      if (!body.hasData) {
        setHasData(false);
        setLogsCount(body.logsCount ?? totalCheckIns);
        setLoading(false);
        return;
      }

      setHasData(true);
      setPlan(body.plan);
      setStreak(body.streak);
      setWellnessTasks(body.plan.tasks);

      // Animate score
      setTimeout(() => setAnimScore(body.plan.wellnessScore), 300);
    } catch {
      toast.error('Could not load your wellness plan.');
    } finally {
      setLoading(false);
    }
  }, [setWellnessTasks, totalCheckIns]);

  useEffect(() => { loadPlan(); }, [loadPlan]);

  // ── Toggle Task ──
  const handleToggle = async (taskId: string) => {
    if (!plan || toggling) return;
    setToggling(taskId);

    // Optimistic update
    const optimistic = plan.tasks.map(t =>
      t.id === taskId
        ? { ...t, completed: !t.completed, completedAt: !t.completed ? new Date().toISOString() : null }
        : t
    );
    setPlan(p => p ? { ...p, tasks: optimistic } : p);
    setWellnessTasks(optimistic);

    try {
      const res = await apiFetch(`/api/wellness-plan/toggle`, {
        method: 'POST',
        body: JSON.stringify({ planId: plan.id, taskId })
      });
      if (res.ok) {
        const body = await res.json();
        setPlan(p => p ? { ...p, tasks: body.tasks, wellnessScore: body.score, aiInsight: body.insight } : p);
        setStreak(body.streak);
        setWellnessTasks(body.tasks);
        setAnimScore(body.score);

        const task = plan.tasks.find(t => t.id === taskId);
        const nowDone = !task?.completed;
        if (nowDone) toast.success('Task complete! Keep going 🌸');

        if (body.tasks.every((t: WellnessTask) => t.completed)) {
          toast.success('🎉 Perfect day! All tasks complete!', { description: 'Your streak has been updated.' });
          refreshAll();
        }
      } else {
        // Revert
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

  // ── Regenerate ──
  const handleRegenerate = async () => {
    setGenerating(true);
    try {
      const res = await apiFetch('/api/v1/wellness-plan', { method: 'POST' });
      if (res.ok) { await loadPlan(); toast.success('Plan regenerated!'); }
    } catch { toast.error('Could not regenerate plan.'); }
    finally { setGenerating(false); }
  };

  // ── Derived data ──
  const activeCategories = useMemo(() => {
    if (!plan) return [];
    const cats = new Set(plan.tasks.map(t => t.category));
    return Array.from(cats) as TaskCategory[];
  }, [plan]);

  const filteredTasksBySlot = useCallback((slot: TimeSlot) => {
    if (!plan) return [];
    let tasks = plan.tasks.filter(t => t.timeSlot === slot);
    if (activeFilter !== 'all') {
      tasks = tasks.filter(t => t.category === activeFilter);
    }
    return tasks;
  }, [plan, activeFilter]);

  // ── Sequential slot unlocking ──
  // A slot is unlocked if its corresponding check-in is completed.
  const isSlotUnlocked = useCallback((slot: TimeSlot): boolean => {
    if (slot === 'morning') return !!checkinSlots?.morning?.completed;
    if (slot === 'afternoon') return !!checkinSlots?.afternoon?.completed;
    if (slot === 'evening') return !!checkinSlots?.evening?.completed;
    return false;
  }, [checkinSlots]);

  const isSlotAllDone = useCallback((slot: TimeSlot): boolean => {
    if (!plan) return false;
    const tasks = plan.tasks.filter(t => t.timeSlot === slot);
    return tasks.length > 0 && tasks.every(t => t.completed);
  }, [plan]);

  if (loading) {
    return (
      <div className={styles.loader}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
          <BrainCircuit className="w-10 h-10" style={{ color: 'var(--hs-violet)' }} />
        </motion.div>
        <p className={styles.loaderText}>Building your personalized wellness journey...</p>
      </div>
    );
  }

  // ─── Empty State ──────────────────────────────────────────────────────────

  if (!hasData) {
    const pct = Math.min(100, Math.round((logsCount / 3) * 100));
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <div className={styles.headerRow}>
            <span className={styles.badge}>AI Wellness Coach</span>
          </div>
          <h1 className={styles.title}>Daily Wellness Journey</h1>
        </div>

        <motion.div className={styles.empty} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Lock className="w-10 h-10 opacity-60" style={{ color: 'var(--hs-violet)' }} />
          <p className={styles.emptyTitle}>Not enough data yet</p>
          <p className={styles.emptyText}>
            Complete your Morning, Afternoon, and Evening check-ins. {aiName} will then generate a personalized wellness plan for you.
          </p>
          <div style={{ width: '100%', maxWidth: 240 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--muted-foreground)' }}>
              <span>{logsCount}/3 Check-ins</span><span>{pct}%</span>
            </div>
            <div className={styles.emptyBar}><div className={styles.emptyBarFill} style={{ width: `${pct}%` }} /></div>
          </div>
          <Link href="/check-in">
            <motion.button
              whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
              style={{ marginTop: '0.5rem', padding: '0.6rem 1.4rem', borderRadius: 99, background: 'linear-gradient(135deg, var(--hs-violet), var(--hs-pink))', color: '#fff', fontWeight: 700, fontSize: '0.8rem', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              Log Today <ArrowRight size={14} />
            </motion.button>
          </Link>
        </motion.div>
      </div>
    );
  }

  if (!plan) return null;

  // ─── Derived ──────────────────────────────────────────────────────────────

  const slots: TimeSlot[] = ['morning', 'afternoon', 'evening'];
  const total = plan.tasks.length;
  const done  = plan.tasks.filter(t => t.completed).length;
  const allComplete = done === total && total > 0;
  const { text: scoreText, color: scoreColor } = scoreLabel(animScore);
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (animScore / 100) * circumference;

  return (
    <div className={styles.page}>

      {/* ── Header ── */}
      <motion.div className={styles.header} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className={styles.headerRow}>
          <span className={styles.badge}>✨ AI Wellness Coach</span>
          <span style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', fontWeight: 600 }}>
            {format(new Date(), 'EEE, MMM d')}
          </span>
        </div>
        <h1 className={styles.title}>Daily Wellness Journey</h1>
        <p className={styles.subtitle}>Personalized plan for {plan.wellnessMode.toUpperCase()} mode · {done}/{total} complete</p>
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
                  <div className={styles.progressFill} style={{ width: `${(done / Math.max(total, 1)) * 100}%` }} />
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', fontWeight: 600 }}>
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

          {/* Streak Row */}
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <div className={styles.streakRow}>
              {[
                { icon: '🔥', val: streak?.currentStreak ?? 0, lbl: 'Streak', unit: 'd' },
                { icon: '🏆', val: streak?.longestStreak ?? 0, lbl: 'Best', unit: 'd' },
                { icon: '📅', val: `${done}/${total}`, lbl: "Today", unit: '' },
                { icon: '📊', val: `${streak?.weeklyConsistency ?? 0}%`, lbl: 'Weekly', unit: '' },
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
                const achieved = (streak?.longestStreak ?? 0) >= m.days;
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

          {/* Category Filter Pills */}
          <div className={styles.filterRow}>
            <button
              className={`${styles.filterPill} ${activeFilter === 'all' ? styles.active : ''}`}
              onClick={() => setActiveFilter('all')}
            >
              All
            </button>
            {activeCategories.map(cat => {
              const cfg = CATEGORY_CONFIG[cat];
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

          {/* Time-Slotted Tasks */}
          {slots.map((slot, slotIdx) => {
            const slotTasks = filteredTasksBySlot(slot);
            const slotDone = slotTasks.filter(t => t.completed).length;
            const cfg = SLOT_CONFIG[slot];
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
                <div className={`${styles.sectionHeader} ${styles[cfg.cssClass as keyof typeof styles]}`}>
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
                    <CheckCircle2 size={16} className="text-emerald-400" />
                    {cfg.label} Tasks Completed! {slotIdx < 2 ? `${SLOT_CONFIG[slots[slotIdx + 1] as TimeSlot]?.label} check-in is next.` : '🎉'}
                  </motion.div>
                )}

                {/* Locked overlay */}
                {!unlocked ? (
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '0.75rem', padding: '1.25rem', textAlign: 'center', opacity: 0.7 }}>
                    <Lock size={20} style={{ color: 'rgba(255,255,255,0.4)', margin: '0 auto 0.5rem' }} />
                    <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
                      Complete the corresponding Daily Check-in to unlock this plan.
                    </p>
                    <Link href="/check-in" style={{ display: 'inline-block', marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--hs-violet)', fontWeight: 600 }}>
                      Go to Check-in →
                    </Link>
                  </div>
                ) : slotTasks.length === 0 ? (
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '0.75rem', padding: '1.25rem', textAlign: 'center', opacity: 0.5 }}>
                    <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
                      No tasks generated for {cfg.label}.
                    </p>
                  </div>
                ) : (
                  /* Tasks */
                  slotTasks.map((task, taskIdx) => {
                    const catCfg = CATEGORY_CONFIG[task.category] || CATEGORY_CONFIG.mindfulness;
                    const isLoading = toggling === task.id;
                    const priorityCls = task.completed ? styles.priorityOpt
                      : task.priority === 'high' ? styles.priorityHigh
                      : task.priority === 'recommended' ? styles.priorityRec : styles.priorityOpt;
                    const priorityLabel = task.completed ? '✓ Done'
                      : task.priority === 'high' ? '🔥 High'
                      : task.priority === 'recommended' ? '⭐ Rec' : 'Optional';

                    return (
                      <motion.div
                        key={task.id}
                        className={`${styles.taskCard} ${task.completed ? styles.completed : ''} ${styles[task.priority as keyof typeof styles] || ''}`}
                        onClick={() => handleToggle(task.id)}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.25 + slotIdx * 0.08 + taskIdx * 0.04 }}
                        whileTap={{ scale: 0.985 }}
                      >
                        {/* Check circle */}
                        <div className={`${styles.taskCheck} ${task.completed ? styles.done : ''} ${isLoading ? styles.loading : ''}`}>
                          <AnimatePresence mode="wait">
                            {isLoading ? (
                              <motion.div key="spin" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                <Loader2 size={12} style={{ color: 'var(--hs-violet)' }} className="animate-spin" />
                              </motion.div>
                            ) : task.completed ? (
                              <motion.div key="done" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.5 }}>
                                <CheckCircle2 size={13} color="#fff" fill="#fff" />
                              </motion.div>
                            ) : (
                              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                <Circle size={13} color="var(--muted-foreground)" />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Content */}
                        <div className={styles.taskBody}>
                          <div className={styles.taskMeta}>
                            <span className={`${styles.taskBadge} ${priorityCls}`}>{priorityLabel}</span>
                            <span className={`${styles.taskBadge}`} style={{ background: catCfg.color, color: 'var(--foreground)', border: 'none' }}>
                              {catCfg.emoji} {catCfg.label}
                            </span>
                          </div>
                          <p className={`${styles.taskText} ${task.completed ? styles.done : ''}`}>{task.text}</p>
                          {task.completedAt && (
                            <span className={styles.completedAt}>
                              ✓ Done at {format(new Date(task.completedAt), 'h:mm a')}
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
