'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  BrainCircuit, Loader2, Droplets, Dumbbell,
  Check, CheckSquare, Moon, Smile, Activity, Flame, Heart,
  Calendar, BarChart2, Sun, Sunset, Sparkles,
  ArrowRight, RotateCcw, Wind, RefreshCw
} from 'lucide-react';
import { useHerSync } from '@/context/HerSyncContext';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { apiFetch } from '@/utils/api-client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import styles from './dashboard.module.css';
import { DashboardMascot } from '@/components/chat/DashboardMascot';
import { DashboardSkeleton } from '@/components/ui/skeleton';
import { HormoneFoodSolver } from '@/components/nutrition/HormoneFoodSolver';
import { WeatherWidget } from '@/components/weather/WeatherWidget';
import { triggerHaptic } from '@/utils/haptics';
import { DashboardNotificationPrompt } from '@/components/dashboard/DashboardNotificationPrompt';
import { useTranslation } from '@/i18n/useTranslation';
import { BreathingExerciseModal } from '@/components/wellness/BreathingExerciseModal';

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const { t } = useTranslation();
  const {
    profile,
    preferences,
    todayLog: l,
    checkinSlots,
    allSlotsComplete,
    totalCheckIns,
    currentStreak,
    cycleStatus,
    wellnessTasks,
    pregnancyDueDate,
    wellnessMode,
    userName,
    aiName,
    coinBalance,
    isLoading,
    refreshAll,
    toggleTask,
    swapTask,
    setWellnessTasks,
    updateTodayLogLocally,
    updateCheckinSlotLocally,
  } = useHerSync();
  const [togglingTask, setTogglingTask] = useState<string | null>(null);
  const [swappingTaskId, setSwappingTaskId] = useState<string | null>(null);
  const [breathingTask, setBreathingTask] = useState<any | null>(null);
  const [lunaReaction, setLunaReaction] = useState<string | null>(null);
  const [showSparkles, setShowSparkles] = useState<string | null>(null);
  const [isRefreshingPlan, setIsRefreshingPlan] = useState(false);
  const [activeDashboardTab, setActiveDashboardTab] = useState<'focus' | 'nutrition' | 'insights'>('focus');
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'synced'>('idle');
  const autoPlanTriggeredRef = useRef<string | null>(null);

  const handleManualSync = useCallback(async () => {
    setSyncState('syncing');
    try {
      await refreshAll();
      setSyncState('synced');
      setTimeout(() => setSyncState('idle'), 2500);
    } catch {
      setSyncState('idle');
    }
  }, [refreshAll]);

  const handleSwapTask = async (taskId: string) => {
    if (swappingTaskId) return;
    setSwappingTaskId(taskId);
    triggerHaptic('selection');
    try {
      const ok = await swapTask(taskId);
      if (ok) {
        toast.success('Task swapped with an alternative 🔄');
      } else {
        toast.error('Could not swap task at this time.');
      }
    } catch {
      toast.error('Could not swap task at this time.');
    } finally {
      setSwappingTaskId(null);
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  const LUNA_REACTIONS = [
    "Great job! Keep going. 🌸",
    "You're building healthy habits. ✨",
    "One step closer to today's goal. 💜",
    "I'm proud of your consistency. 😊",
    "Nice work! Let's continue. 🎉",
    "Every small step makes a big difference! 🌟",
    "You're glowing today! Keep it up. ✨"
  ];


  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return t('dashboard.goodMorning');
    if (hour >= 12 && hour < 18) return t('dashboard.goodAfternoon');
    return t('dashboard.goodEvening');
  };

  const greeting = getGreeting();
  const currentHour = new Date().getHours();
  const isMorning = currentHour >= 6 && currentHour < 12;
  const isEvening = currentHour >= 18;

  const hasDataToday = !!l && (l.sleep !== null || l.water !== null || l.mood !== null || l.stress !== null || l.exercise !== null);

  const observation = useMemo(() => {
    if (!hasDataToday || !l) {
      return "Complete your daily check-ins so I can provide personalized wellness insights just for you today.";
    }
    let obs = '';
    if (l.sleep) {
      if (Number(l.sleep) < 6.5) obs += `Your sleep was a bit short last night (${l.sleep}h). Try to get to bed a little earlier tonight. `;
      else obs += `Your sleep looks great today (${l.sleep}h)! `;
    }
    if (l.water) {
      if (Number(l.water) < 2.0) obs += `Hydration is at ${l.water}L — a bit below target. Try to finish another glass before your next meal. `;
      else obs += `Excellent hydration today (${l.water}L)! `;
    }
    if (l.mood && typeof l.mood === 'string') {
      if (['anxious', 'sad', 'angry'].includes(l.mood)) obs += `It looks like your mood is a bit low today. Take it slow and be gentle with yourself. `;
      else obs += `It's wonderful to see you're feeling ${l.mood} today. `;
    }
    if (wellnessMode === 'pregnancy') {
      obs += "Staying hydrated and well-rested is especially important for you and your baby right now.";
    } else if (wellnessMode === 'pcos' && l.stress && Number(l.stress) > 6) {
      obs += "Keeping stress in check can really help with cycle regularity — a short walk or breathing exercise could help.";
    }
    return obs.trim() || "Your vitals are logged for today. Keep up the healthy habits!";
  }, [hasDataToday, l, wellnessMode]);

  const pregDetails = useMemo(() => {
    if (!pregnancyDueDate) return null;
    try {
      const due = new Date(pregnancyDueDate);
      if (isNaN(due.getTime())) return null;
      const start = new Date(due);
      start.setDate(due.getDate() - 280);
      const today = new Date();
      const diffDays = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      const week = Math.floor(diffDays / 7) + 1;
      if (week < 1 || week > 42) return null;
      const trimester = week <= 12 ? '1st Trimester' : week <= 27 ? '2nd Trimester' : '3rd Trimester';
      return { week, trimester, dueDateStr: due.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) };
    } catch {
      return null;
    }
  }, [pregnancyDueDate]);

  const tasksList = Array.isArray(wellnessTasks) ? wellnessTasks : [];

  const waterTarget = wellnessMode === 'pcos' ? 2.5 : wellnessMode === 'pregnancy' ? 3.0 : 2.0;
  const waterLogged = l?.water ? Number(l.water) : 0;
  const waterPct = Math.min(100, (waterLogged / waterTarget) * 100);

  const exerciseTarget = 30;
  const exerciseLogged = l?.exercise ? Number(l.exercise) : 0;
  const exercisePct = Math.min(100, (exerciseLogged / exerciseTarget) * 100);

  const completedTasks = tasksList.filter(t => t.completed || t.status === 'completed').length;
  const totalTasks = tasksList.length;

  const getActiveTimeSlot = (): 'morning' | 'afternoon' | 'evening' => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    return 'evening';
  };
  const activeSlot = getActiveTimeSlot();
  const activeSlotTitle = activeSlot === 'morning' ? 'Morning 🌅' : activeSlot === 'afternoon' ? 'Afternoon ☀️' : 'Evening 🌙';
  const isCheckinCompleted = checkinSlots?.[activeSlot]?.completed;
  
  const slotTasks = tasksList.filter(t => t.timeSlot === activeSlot);
  const areTasksCompleted = slotTasks.length > 0 && slotTasks.every(t => t.completed || t.status === 'completed');

  const handleToggleTask = async (taskId: string, planId?: string) => {
    if (togglingTask) return;
    setTogglingTask(taskId);

    const targetTask = tasksList.find(t => t.id === taskId);

    const isCompleting = !targetTask?.completed && targetTask?.status !== 'completed';

    if (isCompleting) {
      triggerHaptic('success');
      const randomMsg = LUNA_REACTIONS[Math.floor(Math.random() * LUNA_REACTIONS.length)];
      setLunaReaction(randomMsg);
      setShowSparkles(taskId);
      setTimeout(() => setLunaReaction(null), 3000);
      setTimeout(() => setShowSparkles(null), 1200);
    } else {
      triggerHaptic('light');
    }

    try {
      await toggleTask(taskId);
    } catch {
      toast.error('Failed to update task');
    } finally {
      setTogglingTask(null);
    }
  };

  const handleFetchOrGeneratePlan = useCallback(async () => {
    setIsRefreshingPlan(true);
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    try {
      const res = await apiFetch('/api/wellness-plan', {
        method: 'POST',
        body: JSON.stringify({ slot: activeSlot, date: todayStr, mode: wellnessMode }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.plan?.tasks) {
          setWellnessTasks(data.plan.tasks);
        }
      }
      await refreshAll();
    } catch {
      toast.error('Could not refresh wellness plan.');
    } finally {
      setIsRefreshingPlan(false);
    }
  }, [activeSlot, wellnessMode, setWellnessTasks, refreshAll]);

  // Auto-generate or auto-fetch tasks when current slot is completed but has no tasks yet
  useEffect(() => {
    if (
      mounted &&
      isCheckinCompleted &&
      slotTasks.length === 0 &&
      !isRefreshingPlan &&
      autoPlanTriggeredRef.current !== activeSlot
    ) {
      autoPlanTriggeredRef.current = activeSlot;
      handleFetchOrGeneratePlan();
    }
  }, [mounted, isCheckinCompleted, slotTasks.length, isRefreshingPlan, activeSlot, handleFetchOrGeneratePlan]);

  const handleQuickLogWater = (amountLiters: number) => {
    try {
      triggerHaptic('light');
      const currentWater = l?.water ? Number(l.water) : 0;
      const newWater = Number((currentWater + amountLiters).toFixed(2));
      const todayStr = format(new Date(), 'yyyy-MM-dd');

      updateTodayLogLocally({ water: newWater });
      toast.success(`+${Math.round(amountLiters * 1000)}ml water logged 💧`);

      apiFetch('/api/health/checkin', {
        method: 'POST',
        body: JSON.stringify({
          slot: activeSlot,
          date: todayStr,
          isMicroLog: true,
          data: {
            water: newWater,
            note: `Quick hydration log (+${Math.round(amountLiters * 1000)}ml)`,
          },
        }),
      }).catch(err => {
        if (process.env.NODE_ENV === 'development') {
          console.debug('Background water sync notice:', err);
        }
      });
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.debug('Quick water log notice:', err);
      }
    }
  };

  const handleQuickLogMood = (moodText: string, emoji: string) => {
    try {
      triggerHaptic('selection');
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const stressScore = moodText === 'Energized' || moodText === 'Calm' ? 1.5 : moodText === 'Tired' ? 3.0 : 4.0;

      updateTodayLogLocally({
        mood: moodText.toLowerCase(),
        stress: stressScore,
      });
      toast.success(`${emoji} Mood recorded as "${moodText}"`);

      apiFetch('/api/health/checkin', {
        method: 'POST',
        body: JSON.stringify({
          slot: activeSlot,
          date: todayStr,
          isMicroLog: true,
          data: {
            mood: moodText.toLowerCase(),
            stress: stressScore,
            note: `Quick 1-tap mood log: ${emoji} ${moodText}`,
          },
        }),
      }).catch(err => {
        if (process.env.NODE_ENV === 'development') {
          console.debug('Background mood sync notice:', err);
        }
      });
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.debug('Quick mood log notice:', err);
      }
    }
  };

  const handleQuickCatchUpSlot = (slotToFill: 'morning' | 'afternoon' | 'evening') => {
    try {
      triggerHaptic('medium');
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const slotLabel = slotToFill === 'morning' ? 'Morning' : slotToFill === 'afternoon' ? 'Afternoon' : 'Evening';

      updateCheckinSlotLocally(slotToFill, true);
      toast.success(`✨ ${slotLabel} check-in caught up!`);

      const defaultData: Record<string, any> = {
        morning: { sleep: 7.5, mood: 'calm', stress: 2.0 },
        afternoon: { water: 1.5, mood: 'energized', stress: 2.5 },
        evening: { mood: 'relaxed', stress: 2.0 },
      };

      apiFetch('/api/health/checkin', {
        method: 'POST',
        body: JSON.stringify({
          slot: slotToFill,
          date: todayStr,
          isCatchUp: true,
          data: defaultData[slotToFill],
        }),
      }).then(() => {
        if (slotToFill === activeSlot && slotTasks.length === 0) {
          handleFetchOrGeneratePlan();
        }
      }).catch(err => {
        if (process.env.NODE_ENV === 'development') {
          console.debug('Catch-up background sync notice:', err);
        }
      });
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.debug('Catch-up error notice:', err);
      }
      toast.error('Could not complete catch-up log.');
    }
  };

  const pendingSlots = useMemo(() => {
    return (['morning', 'afternoon', 'evening'] as const).filter(
      s => !checkinSlots?.[s]?.completed
    );
  }, [checkinSlots]);

  const topPriorityTask = useMemo(() => {
    const slotPending = tasksList.filter(t => t.timeSlot === activeSlot && !t.completed && t.status !== 'completed');
    if (slotPending.length > 0) return slotPending[0];
    const anyPending = tasksList.filter(t => !t.completed && t.status !== 'completed');
    return anyPending.length > 0 ? anyPending[0] : null;
  }, [tasksList, activeSlot]);

  if (!mounted || (isLoading && !profile)) {
    return <DashboardSkeleton />;
  }

  return (
    <div className={styles.dashboardContainer}>

      {/* Polite Permission Prompt (only if not granted and not dismissed) */}
      <DashboardNotificationPrompt />

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className={styles.pageHeader}
      >
        <div>
          <h1 className={styles.pageTitle}>{greeting}, {userName}</h1>
          <p className={styles.pageSubtitle}>{t('dashboard.summarySubtitle')}</p>
        </div>
        <Link
          href="/check-in"
          prefetch={true}
          className={`flex items-center justify-center gap-1.5 text-xs font-semibold px-5 py-2.5 min-h-[44px] rounded-full transition-all active:scale-[0.98] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.22),0_2px_8px_rgba(0,0,0,0.24)] text-white w-full sm:w-auto shrink-0 ${
            allSlotsComplete ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-primary hover:opacity-95'
          }`}
        >
          {allSlotsComplete ? (
            <>{t('dashboard.allSlotsComplete')} <CheckSquare className="w-3.5 h-3.5" /></>
          ) : (
            <>{t('dashboard.completeCheckin')} <ArrowRight className="w-3.5 h-3.5" /></>
          )}
        </Link>
      </motion.header>

      {/* 🪙 Svanexa Coins & Rewards Banner */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="w-full p-4 sm:p-5 rounded-3xl bg-white/[0.04] border border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm backdrop-blur-2xl"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-xl shrink-0">
            🪙
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg sm:text-xl font-black tracking-tight text-foreground font-mono">
                {new Intl.NumberFormat('en-IN').format(coinBalance || 0)}
              </span>
              <span className="text-xs font-bold text-amber-400">Svanexa Coins</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              10,000 Coins = ₹100 • Invite friends & earn 500 Coins
            </p>
          </div>
        </div>

        <Link
          href="/rewards"
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-bold text-xs transition-all active:scale-95 self-start sm:self-center shrink-0 cursor-pointer"
        >
          <span>Rewards</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </motion.div>

      {/* 🧭 EFFORTLESS TAB NAVIGATION (PROGRESSIVE DISCLOSURE) */}
      <div className="flex items-center gap-1 p-1 rounded-full bg-white/[0.05] border border-white/[0.08] shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)] backdrop-blur-2xl self-start max-w-full overflow-x-auto scrollbar-thin">
        {[
          { id: 'focus' as const, label: "Today's Focus", icon: '🎯' },
          { id: 'nutrition' as const, label: 'Hormone Foods', icon: '🍵' },
          { id: 'insights' as const, label: 'Biometrics & AI', icon: '📊' },
        ].map(tab => {
          const isActive = activeDashboardTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                setActiveDashboardTab(tab.id);
              }}
              className={`relative px-4 py-2 rounded-full text-xs transition-colors duration-150 flex items-center gap-1.5 shrink-0 cursor-pointer apple-tactile ${
                isActive
                  ? 'text-white font-semibold'
                  : 'text-muted-foreground hover:text-foreground font-medium'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeDashboardTabPill"
                  className="absolute inset-0 rounded-full bg-white/[0.14] border border-white/[0.16] shadow-[0_2px_8px_rgba(0,0,0,0.3)] -z-10"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                />
              )}
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 🎯 TAB 1: TODAY'S FOCUS (HERO RING + MICRO-LOGGERS + PLAN) */}
      {activeDashboardTab === 'focus' && (
        <div className="flex flex-col gap-6">
          {/* 🌟 APPLE HEALTH-INSPIRED DYNAMIC "NOW CARD" HERO 🌟 */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="w-full p-4 sm:p-5 rounded-3xl bg-card/75 border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.36)] relative overflow-hidden backdrop-blur-2xl"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white/[0.08] border border-white/[0.08] text-foreground/90">
                    {isMorning ? '🌅 Morning Focus' : isEvening ? '🌙 Evening Wind-Down' : '☀️ Midday Vitality'}
                  </span>
                  {!isCheckinCompleted && (
                    <span className="text-[10px] font-semibold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                      🪙 +10 Coins
                    </span>
                  )}
                </div>

                {!isCheckinCompleted ? (
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-foreground truncate">
                      Your {activeSlotTitle} Check-In is Ready
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Log your vitals & sleep to personalize today&apos;s AI recommendations. (~2 min)
                    </p>
                  </div>
                ) : topPriorityTask ? (
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-1.5 truncate">
                      <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                      Focus: {topPriorityTask.text}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {completedTasks}/{totalTasks} daily goals completed • Keep your streak growing!
                    </p>
                  </div>
                ) : (
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-emerald-400 flex items-center gap-1.5">
                      <Check className="w-4 h-4" /> All Check-Ins & Goals Complete!
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Outstanding consistency today! Active streak: {currentStreak} days 🔥
                    </p>
                  </div>
                )}
              </div>

              {/* Action Area */}
              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                {!isCheckinCompleted ? (
                  <Link
                    href="/check-in"
                    prefetch={true}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-full bg-primary hover:opacity-90 text-white font-semibold text-xs shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] min-h-[40px]"
                  >
                    <span>Start Check-In</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                ) : (
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    {topPriorityTask && (
                      <button
                        type="button"
                        onClick={() => handleToggleTask(topPriorityTask.id)}
                        className="flex-1 sm:flex-initial px-3.5 py-2 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] min-h-[38px]"
                      >
                        <Check className="w-3.5 h-3.5" /> Done
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleQuickLogWater(0.25)}
                      className="flex-1 sm:flex-initial px-3.5 py-2 rounded-full bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-200 font-semibold text-xs flex items-center justify-center gap-1 transition-all active:scale-[0.98] min-h-[38px]"
                    >
                      <Droplets className="w-3.5 h-3.5" /> +250ml
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* ☀️ LIVE WEATHER & WELLNESS INTELLIGENCE ☀️ */}
          <WeatherWidget />

          {/* ⚡ 1-TAP QUICK MICRO-LOGGERS (EFFORTLESS WELLNESS BAR) ⚡ */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="w-full p-4 rounded-3xl bg-card/75 border border-white/[0.08] backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-white/[0.08] text-foreground text-xs">⚡</span>
                <h3 className="text-xs font-semibold text-foreground">1-Tap Quick Loggers</h3>
                <span className="text-[10px] text-muted-foreground hidden sm:inline">• Save in 1 second without opening forms</span>
              </div>
              <button
                type="button"
                onClick={handleManualSync}
                disabled={syncState === 'syncing'}
                className="text-[10px] font-semibold text-foreground/80 hover:text-foreground transition-colors flex items-center gap-1 cursor-pointer bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.08] px-2.5 py-1 rounded-full apple-tactile"
                title="Tap to synchronize data with server"
              >
                {syncState === 'syncing' ? (
                  <>
                    <RefreshCw className="w-2.5 h-2.5 animate-spin text-foreground/70" />
                    <span>Syncing...</span>
                  </>
                ) : syncState === 'synced' ? (
                  <>
                    <Check className="w-2.5 h-2.5 text-emerald-400" />
                    <span className="text-emerald-400">Synced ✓</span>
                  </>
                ) : (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Instant Sync ✨</span>
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Quick Water Bar */}
              <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.06] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Droplets className="w-3.5 h-3.5 text-cyan-400" /> Hydration
                  </span>
                  <span className="font-mono text-cyan-300 text-[11px] font-semibold">
                    {waterLogged.toFixed(1)} / {waterTarget}L
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleQuickLogWater(0.25)}
                    className="flex-1 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-foreground font-semibold text-[11px] transition-all active:scale-[0.98] flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span>+250ml</span>
                    <span className="text-[9px] text-muted-foreground font-normal">Cup</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickLogWater(0.50)}
                    className="flex-1 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.1] text-foreground font-semibold text-[11px] transition-all active:scale-[0.98] flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span>+500ml</span>
                    <span className="text-[9px] text-muted-foreground font-normal">Bottle</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickLogWater(0.75)}
                    className="flex-1 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-foreground font-semibold text-[11px] transition-all active:scale-[0.98] flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span>+750ml</span>
                  </button>
                </div>
              </div>

              {/* Quick Mood Bar */}
              <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.06] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Smile className="w-3.5 h-3.5 text-primary" /> How are you feeling right now?
                  </span>
                  <span className="text-[10px] text-muted-foreground capitalize">
                    {l?.mood ? `Current: ${l.mood}` : 'Tap to log'}
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {[
                    { label: 'Energized', emoji: '😊' },
                    { label: 'Calm', emoji: '😌' },
                    { label: 'Tired', emoji: '😴' },
                    { label: 'Crampy', emoji: '😣' },
                    { label: 'Stressed', emoji: '🤯' },
                  ].map(m => (
                    <button
                      key={m.label}
                      type="button"
                      onClick={() => handleQuickLogMood(m.label, m.emoji)}
                      className={`py-1.5 rounded-xl text-center transition-all active:scale-[0.98] cursor-pointer ${
                        l?.mood === m.label.toLowerCase()
                          ? 'bg-primary/20 border border-primary/35 text-white font-semibold'
                          : 'bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-muted-foreground'
                      }`}
                    >
                      <div className="text-sm">{m.emoji}</div>
                      <div className="text-[9px] truncate font-medium">{m.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 🌙 ZERO-GUILT EVENING CATCH-UP */}
            {pendingSlots.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                <div className="space-y-0.5 min-w-0">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <span>🌙</span> Busy day? 20-Second Quick Catch-Up
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Preserve your <span className="text-amber-300 font-semibold">{currentStreak}-day streak 🔥</span> by catching up on pending check-ins:
                  </p>
                </div>
                <div className="flex items-center gap-1.5 w-full sm:w-auto shrink-0">
                  {pendingSlots.map(slot => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => handleQuickCatchUpSlot(slot)}
                      className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.1] text-foreground font-semibold text-[11px] flex items-center justify-center gap-1 transition-all active:scale-[0.98] cursor-pointer"
                    >
                      <span>+</span>
                      <span className="capitalize">{slot}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>

          {/* ACTIVE WELLNESS PLAN */}
          <motion.section
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="relative"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className={styles.sectionTitle}>Today&apos;s Active Wellness Plan</h2>
              <Link href="/wellness-plan" className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
                View All Slots →
              </Link>
            </div>
            
            {/* The Roaming AI Mascot */}
            <DashboardMascot />
            
            <div className={styles.premiumCard} style={{ padding: '1.25rem', position: 'relative', zIndex: 10 }}>
              {!isCheckinCompleted ? (
                <div className="flex flex-col items-center text-center py-6">
                   <Sun className="w-10 h-10 text-primary mb-3 opacity-60" />
                   <h3 className="font-semibold text-foreground mb-1 text-lg">Your {activeSlotTitle} plan is waiting!</h3>
                   <p className="text-sm text-muted-foreground mb-4 max-w-[280px]">
                     Complete your {activeSlot} check-in to generate your personalized tasks based on how you feel right now.
                   </p>
                   <Link href="/check-in" className="px-5 py-2.5 bg-primary hover:opacity-90 text-white font-semibold text-sm rounded-full transition-all shadow-sm">
                     Log Today&apos;s Reflection 🌸
                   </Link>
                </div>
              ) : areTasksCompleted ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center text-center py-6 px-4 bg-white/[0.04] rounded-2xl border border-white/[0.08] shadow-sm backdrop-blur-xl"
                >
                  <div className="relative mb-3">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center">
                      <Check className="w-8 h-8 text-emerald-400" />
                    </div>
                    <Sparkles className="w-5 h-5 text-amber-300 absolute -top-1 -right-1 animate-bounce" />
                  </div>
                  
                  <h3 className="font-semibold text-foreground mb-1 text-lg">
                    {activeSlot === 'evening' 
                      ? "🎉 Today's Wellness Journey Completed" 
                      : activeSlot === 'morning' 
                        ? "✓ Morning Tasks Completed" 
                        : "✓ Afternoon Tasks Completed"}
                  </h3>
                  
                  <p className="text-xs text-muted-foreground font-medium max-w-xs mb-4">
                    {activeSlot === 'evening' 
                      ? "Amazing work today! Keep this consistency going." 
                      : activeSlot === 'morning' 
                        ? "Morning tasks finished! Stand by for Afternoon check-in." 
                        : "Afternoon tasks finished! Stand by for Evening check-in."}
                  </p>

                  <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                    <span>Luna AI:</span> <span>&quot;I&apos;m so proud of your dedication today! 💜&quot;</span>
                  </div>

                  <Link
                    href="/check-in"
                    className="mt-3 px-5 py-2.5 rounded-full border border-violet-500/30 hover:bg-violet-500/10 text-violet-400 font-semibold text-xs transition-all flex items-center gap-1.5"
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    View Today&apos;s Check-in Summary
                  </Link>
                </motion.div>
              ) : slotTasks.length === 0 ? (
                <div className="flex flex-col items-center text-center py-6">
                  <Loader2 className="w-8 h-8 text-pink-500 animate-spin mb-3" />
                  <h3 className="font-semibold text-foreground mb-1 text-base">Preparing your {activeSlotTitle} tasks...</h3>
                  <p className="text-xs text-muted-foreground mb-4 max-w-[260px]">
                    Personalizing recommendations based on your check-in.
                  </p>
                  <button
                    onClick={handleFetchOrGeneratePlan}
                    disabled={isRefreshingPlan}
                    className="px-4 py-2 bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-xs rounded-full border border-border/50 transition-all flex items-center gap-1.5"
                  >
                    {isRefreshingPlan ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                    Refresh Tasks 🌸
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 mb-2">
                     <Sparkles className="w-4 h-4 text-pink-500" />
                     <span className="font-semibold text-foreground">{activeSlotTitle} Tasks</span>
                     <span className="ml-auto text-xs text-muted-foreground font-medium">
                       {slotTasks.filter(t => t.completed || t.status === 'completed').length}/{slotTasks.length} done
                     </span>
                  </div>
                  
                  {slotTasks.map(task => (
                    <div 
                      key={task.id} 
                      onClick={() => {
                        if (togglingTask !== task.id) {
                          handleToggleTask(task.id);
                        }
                      }}
                      className={`relative flex items-center gap-3.5 p-3.5 rounded-xl border transition-all cursor-pointer select-none min-h-[48px] ${
                        togglingTask === task.id ? 'pointer-events-none opacity-80' : ''
                      } ${task.completed || task.status === 'completed' ? 'bg-secondary/40 border-border/30 opacity-70' : 'bg-card border-violet-500/20 hover:border-violet-500/50 shadow-sm hover:scale-[1.005]'}`}
                    >
                      {showSparkles === task.id && (
                        <motion.div 
                          initial={{ scale: 0, opacity: 1 }}
                          animate={{ scale: 1.5, opacity: 0 }}
                          transition={{ duration: 0.8 }}
                          className="absolute left-4 top-4 text-amber-300 pointer-events-none"
                        >
                          ✨
                        </motion.div>
                      )}
                      <button 
                        type="button"
                        disabled={togglingTask === task.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (togglingTask !== task.id) {
                            handleToggleTask(task.id);
                          }
                        }}
                        aria-label={`Mark task ${task.text} as ${task.completed ? 'incomplete' : 'complete'}`}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all min-h-[24px] min-w-[24px] ${
                          task.completed || task.status === 'completed' ? 'bg-emerald-500 border-emerald-500 text-white scale-105' : 'border-violet-400 text-transparent hover:border-violet-500'
                        }`}
                      >
                        {togglingTask === task.id ? <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-500" /> : <Check className="w-3.5 h-3.5" />}
                      </button>
                      <div className="flex-1 flex flex-col justify-center gap-0.5 min-w-0">
                        <p className={`text-sm font-medium transition-all break-words ${task.completed || task.status === 'completed' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                          {task.text}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-semibold text-violet-400 uppercase tracking-wider bg-violet-500/10 px-2 py-0.5 rounded-full inline-block w-fit">
                            {task.category}
                          </span>
                          {task.estimatedTime && (
                            <span className="text-[10px] text-muted-foreground font-medium">
                              ⏱️ {task.estimatedTime}
                            </span>
                          )}
                          {(!task.completed && task.status !== 'completed' && (task.text.toLowerCase().includes('breath') || task.category === 'stress')) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setBreathingTask(task);
                              }}
                              className="px-2 py-0.5 rounded-full bg-pink-500/15 hover:bg-pink-500/25 text-pink-400 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                            >
                              <Wind className="w-2.5 h-2.5" />
                              <span>Guide</span>
                            </button>
                          )}
                        </div>
                      </div>
                      {(!task.completed && task.status !== 'completed') && (
                        <button
                          type="button"
                          disabled={swappingTaskId === task.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSwapTask(task.id);
                          }}
                          title="Swap with an alternative task"
                          aria-label={`Swap task ${task.text}`}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-pink-400 hover:bg-pink-500/10 transition-colors cursor-pointer shrink-0"
                        >
                          {swappingTaskId === task.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-pink-400" />
                          ) : (
                            <RotateCcw className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.section>

          {/* Interactive Breathwork Guide Modal */}
          <BreathingExerciseModal
            isOpen={!!breathingTask}
            onClose={() => setBreathingTask(null)}
            onComplete={() => {
              if (breathingTask) {
                handleToggleTask(breathingTask.id);
              }
            }}
            technique={breathingTask?.text.toLowerCase().includes('box') ? 'box' : '4-7-8'}
          />
        </div>
      )}

      {/* 🍵 TAB 2: HORMONE FOODS & CRAVINGS */}
      {activeDashboardTab === 'nutrition' && (
        <motion.section
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full"
        >
          <HormoneFoodSolver currentPhase={cycleStatus} />
        </motion.section>
      )}

      {/* 📊 TAB 3: BIOMETRICS & AI INSIGHTS */}
      {activeDashboardTab === 'insights' && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className={styles.dashboardGrid}
        >
          <div className="flex flex-col gap-8">
            {/* AI WELLNESS SNAPSHOT */}
            <section>
              <h2 className={styles.sectionTitle}>AI Wellness Snapshot</h2>
              <div className={styles.premiumCard}>
                {!hasDataToday ? (
                  <div className={styles.emptyStateContainer}>
                    <Sparkles className="w-8 h-8 mb-3 opacity-50" style={{ color: 'var(--hs-pink)' }} />
                    <p className={styles.emptyStateText}>
                      Complete today&apos;s check-ins to see your personalized wellness snapshot.
                    </p>
                    <Link href="/check-in" className="mt-3 text-xs font-semibold transition-colors hover:opacity-80" style={{ color: 'var(--hs-pink)' }}>
                      Log Now →
                    </Link>
                  </div>
                ) : (
                  <div className={styles.snapshotGrid}>
                    {l.mood && (
                      <div className={styles.snapshotItem}>
                        <div className={styles.snapshotIcon}><Smile className="w-4 h-4" style={{ color: 'var(--hs-pink)' }} /></div>
                        <div className={styles.snapshotData}>
                          <span className={styles.snapshotLabel}>Mood</span>
                          <span className={styles.snapshotValue} style={{ textTransform: 'capitalize' }}>{l.mood}</span>
                        </div>
                      </div>
                    )}
                    {l.sleep && (
                      <div className={styles.snapshotItem}>
                        <div className={styles.snapshotIcon}><Moon className="w-4 h-4" style={{ color: 'var(--hs-violet)' }} /></div>
                        <div className={styles.snapshotData}>
                          <span className={styles.snapshotLabel}>Sleep</span>
                          <span className={styles.snapshotValue}>{l.sleep}h</span>
                        </div>
                      </div>
                    )}
                    {l.water && (
                      <div className={styles.snapshotItem}>
                        <div className={styles.snapshotIcon}><Droplets className="w-4 h-4 text-blue-400" /></div>
                        <div className={styles.snapshotData}>
                          <span className={styles.snapshotLabel}>Hydration</span>
                          <span className={styles.snapshotValue}>{l.water}L</span>
                        </div>
                      </div>
                    )}
                    {l.stress && (
                      <div className={styles.snapshotItem}>
                        <div className={styles.snapshotIcon}><Activity className="w-4 h-4 text-emerald-400" /></div>
                        <div className={styles.snapshotData}>
                          <span className={styles.snapshotLabel}>Stress Indicator</span>
                          <span className={styles.snapshotValue}>
                            {Number(l.stress) <= 5 ? `${l.stress}/5.0` : `${l.stress}/10`}
                          </span>
                        </div>
                      </div>
                    )}
                    {cycleStatus && typeof cycleStatus === 'string' && wellnessMode !== 'pregnancy' && (
                      <div className={styles.snapshotItem}>
                        <div className={styles.snapshotIcon}><Calendar className="w-4 h-4 text-rose-400" /></div>
                        <div className={styles.snapshotData}>
                          <span className={styles.snapshotLabel}>Cycle</span>
                          <span className={styles.snapshotValue} style={{ textTransform: 'capitalize' }}>
                            {cycleStatus.replace(/_/g, ' ').replace('phase', '').trim() || 'Unknown'}
                          </span>
                        </div>
                      </div>
                    )}

                    {wellnessMode === 'pregnancy' && pregDetails && (
                      <div className={styles.snapshotItem}>
                        <div className={styles.snapshotIcon}><Heart className="w-4 h-4 text-pink-400" /></div>
                        <div className={styles.snapshotData}>
                          <span className={styles.snapshotLabel}>Pregnancy</span>
                          <span className={styles.snapshotValue}>Wk {pregDetails.week} ({pregDetails.trimester})</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* AI COMPANION INSIGHT */}
            <section>
              <h2 className={styles.sectionTitle}>{aiName}&apos;s Insight</h2>
              <div className={`${styles.premiumCard} ${styles.observationCard}`}>
                <div className={styles.observationHeader}>
                  <div className={styles.observationAvatar}>
                    <BrainCircuit className="w-5 h-5 text-white" />
                  </div>
                </div>
                <p className={styles.observationText}>{observation}</p>
              </div>
            </section>
          </div>

          <div className="flex flex-col gap-8">
            {/* TODAY'S WELLNESS GOALS */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className={styles.sectionTitle} style={{ marginBottom: 0 }}>Daily Goals</h2>
                <Link href="/wellness-plan" className="text-xs font-semibold transition-colors hover:opacity-80" style={{ color: 'var(--hs-violet)' }}>
                  View Plan →
                </Link>
              </div>
              <div className={styles.goalsContainer}>
                {/* Water Goal */}
                <div className={styles.goalCard}>
                  <div className={styles.goalHeader}>
                    <div className={styles.goalTitleRow}>
                      <Droplets className="w-5 h-5 text-blue-400" />
                      <span className={styles.goalName}>Water</span>
                    </div>
                    <span className={styles.goalMetric}>{waterLogged.toFixed(1)} / {waterTarget}L</span>
                  </div>
                  <div className={styles.progressBarBg}>
                    <motion.div
                      className={styles.progressBarFill}
                      initial={{ width: 0 }}
                      animate={{ width: `${waterPct}%` }}
                      transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
                      style={{ background: 'linear-gradient(90deg, #3B82F6, #60A5FA)' }}
                    />
                  </div>
                </div>

                {/* Exercise Goal */}
                <div className={styles.goalCard}>
                  <div className={styles.goalHeader}>
                    <div className={styles.goalTitleRow}>
                      <Dumbbell className="w-5 h-5 text-emerald-400" />
                      <span className={styles.goalName}>Exercise</span>
                    </div>
                    <span className={styles.goalMetric}>{exerciseLogged} / {exerciseTarget} mins</span>
                  </div>
                  <div className={styles.progressBarBg}>
                    <motion.div
                      className={styles.progressBarFill}
                      initial={{ width: 0 }}
                      animate={{ width: `${exercisePct}%` }}
                      transition={{ duration: 1, delay: 0.4, ease: "easeOut" }}
                      style={{ background: 'linear-gradient(90deg, #10B981, #34D399)' }}
                    />
                  </div>
                </div>

                {/* Sleep Tracking */}
                <div className={styles.goalCard}>
                  <div className={styles.goalHeader}>
                    <div className={styles.goalTitleRow}>
                      <Moon className="w-5 h-5" style={{ color: 'var(--hs-violet)' }} />
                      <span className={styles.goalName}>Sleep Tracking</span>
                    </div>
                    {l?.sleep ? (
                      <div className={styles.goalCompletedBadge}>
                        <Check className="w-3 h-3" /> Logged
                      </div>
                    ) : (
                      <span className={styles.goalMetric}>Pending</span>
                    )}
                  </div>
                </div>

                {/* Wellness Plan Tasks Progress */}
                {totalTasks > 0 && (
                  <div className={styles.goalCard}>
                    <div className={styles.goalHeader}>
                      <div className={styles.goalTitleRow}>
                        <Sparkles className="w-5 h-5" style={{ color: 'var(--hs-violet)' }} />
                        <span className={styles.goalName}>Wellness Tasks</span>
                      </div>
                      <span className={styles.goalMetric}>{completedTasks}/{totalTasks}</span>
                    </div>
                    <div className={styles.progressBarBg}>
                      <motion.div
                        className={styles.progressBarFill}
                        initial={{ width: 0 }}
                        animate={{ width: `${totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0}%` }}
                        transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
                        style={{ background: 'linear-gradient(90deg, var(--hs-violet), var(--hs-pink))' }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* PROGRESS STATS */}
            <section>
              <h2 className={styles.sectionTitle}>Your Progress</h2>
              <div className={styles.statsGrid}>
                <motion.div className={styles.statCard} whileHover={{ y: -2 }}>
                  <Flame className="w-5 h-5 text-[#FFB347] mb-2" />
                  <span className={styles.statValue}>{currentStreak}</span>
                  <span className={styles.statLabel}>Day Streak</span>
                </motion.div>
                <motion.div className={styles.statCard} whileHover={{ y: -2 }}>
                  <Calendar className="w-5 h-5 mb-2" style={{ color: 'var(--hs-violet)' }} />
                  <span className={styles.statValue}>{totalCheckIns}</span>
                  <span className={styles.statLabel}>Check-ins</span>
                </motion.div>
                <motion.div className={styles.statCard} whileHover={{ y: -2 }}>
                  <Droplets className="w-5 h-5 text-[#3B82F6] mb-2" />
                  <span className={styles.statValue}>{waterLogged >= waterTarget ? '✓' : `${Math.round(waterPct)}%`}</span>
                  <span className={styles.statLabel}>Water Goal</span>
                </motion.div>
              </div>
            </section>
          </div>
        </motion.div>
      )}

      {/* FLOATING LUNA AI REACTION BUBBLE */}
      <AnimatePresence>
        {lunaReaction && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.9 }}
            transition={{ type: 'spring', bounce: 0.4 }}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-3 p-3.5 pr-5 rounded-2xl bg-card/85 backdrop-blur-2xl border border-white/[0.12] shadow-[0_12px_36px_rgba(0,0,0,0.5)] pointer-events-none"
          >
            <div className="w-10 h-10 rounded-full bg-white/[0.1] border border-white/[0.12] p-0.5 shadow-sm flex-shrink-0">
              <div className="w-full h-full rounded-full bg-card flex items-center justify-center overflow-hidden relative">
                <Image src="/mascot-cute.jpg" alt="Luna AI" fill className="object-cover" />
              </div>
            </div>
            <div>
              <div className="text-[10px] font-semibold text-primary uppercase tracking-wider">Luna AI Companion</div>
              <div className="text-xs font-semibold text-foreground">{lunaReaction}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
