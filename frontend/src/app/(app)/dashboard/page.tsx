'use client';

import { useEffect, useState } from 'react';
import {
  BrainCircuit, Loader2, Droplets, Dumbbell,
  Check, Moon, Smile, Activity, Flame, Heart,
  Calendar, BarChart2, Sun, Sunset, Sparkles,
  ArrowRight
} from 'lucide-react';
import { useHerSync } from '@/context/HerSyncContext';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { apiFetch } from '@/utils/api-client';
import { toast } from 'sonner';
import styles from './dashboard.module.css';
import { DashboardMascot } from '@/components/chat/DashboardMascot';

export default function DashboardPage() {
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
    isLoading,
    refreshAll,
  } = useHerSync();
  const [showWelcome, setShowWelcome] = useState(false);
  const [togglingTask, setTogglingTask] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    const todayKey = `hersync_greeted_${new Date().toISOString().slice(0, 10)}`;
    if (!localStorage.getItem(todayKey)) {
      // First visit today — show the welcome animation once
      setShowWelcome(true);
      localStorage.setItem(todayKey, '1');
      // Clean up yesterday's key to avoid localStorage bloat
      const yesterdayKey = `hersync_greeted_${new Date(Date.now() - 86400000).toISOString().slice(0, 10)}`;
      localStorage.removeItem(yesterdayKey);
      const timer = setTimeout(() => setShowWelcome(false), 2800);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  const getGreetingTime = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Morning';
    if (hour < 18) return 'Afternoon';
    return 'Evening';
  };

  const greeting = `Good ${getGreetingTime()}`;
  const isMorning = getGreetingTime() === 'Morning';
  const isEvening = getGreetingTime() === 'Evening';

  const hasDataToday = !!l && (l.sleep !== null || l.water !== null || l.mood !== null || l.stress !== null || l.exercise !== null);

  const generateObservation = () => {
    if (!hasDataToday) {
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
    if (l.mood) {
      if (['anxious', 'sad', 'angry'].includes(l.mood)) obs += `It looks like your mood is a bit low today. Take it slow and be gentle with yourself. `;
      else obs += `It's wonderful to see you're feeling ${l.mood} today. `;
    }
    if (wellnessMode === 'pregnancy') {
      obs += "Staying hydrated and well-rested is especially important for you and your baby right now.";
    } else if (wellnessMode === 'pcos' && l.stress && Number(l.stress) > 6) {
      obs += "Keeping stress in check can really help with cycle regularity — a short walk or breathing exercise could help.";
    }
    return obs.trim() || "Your vitals are logged for today. Keep up the healthy habits!";
  };

  const getPregnancyWeek = () => {
    if (!pregnancyDueDate) return null;
    const due = new Date(pregnancyDueDate);
    const start = new Date(due);
    start.setDate(due.getDate() - 280);
    const today = new Date();
    const week = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7));
    return week > 0 && week <= 42 ? week : null;
  };

  const pregWeek = getPregnancyWeek();

  const waterTarget = wellnessMode === 'pcos' ? 2.5 : wellnessMode === 'pregnancy' ? 3.0 : 2.0;
  const waterLogged = l?.water ? Number(l.water) : 0;
  const waterPct = Math.min(100, (waterLogged / waterTarget) * 100);

  const exerciseTarget = 30;
  const exerciseLogged = l?.exercise ? Number(l.exercise) : 0;
  const exercisePct = Math.min(100, (exerciseLogged / exerciseTarget) * 100);

  const completedTasks = wellnessTasks.filter(t => t.completed).length;
  const totalTasks = wellnessTasks.length;

  const getActiveTimeSlot = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    return 'evening';
  };
  const activeSlot = getActiveTimeSlot();
  const activeSlotTitle = activeSlot === 'morning' ? 'Morning 🌅' : activeSlot === 'afternoon' ? 'Afternoon ☀️' : 'Evening 🌙';
  const isCheckinCompleted = checkinSlots?.[activeSlot]?.completed;
  
  const slotTasks = wellnessTasks.filter(t => t.timeSlot === activeSlot);
  const areTasksCompleted = slotTasks.length > 0 && slotTasks.every(t => t.completed);

  const handleToggleTask = async (taskId: string, planId: string) => {
    if (togglingTask) return;
    setTogglingTask(taskId);
    try {
      const res = await apiFetch('/api/v1/wellness-plan/toggle', {
        method: 'POST',
        body: JSON.stringify({ taskId, planId }),
      });
      if (res.ok) {
        await refreshAll();
      }
    } catch (error) {
      toast.error('Failed to update task');
    } finally {
      setTogglingTask(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--hs-pink)' }} />
      </div>
    );
  }

  return (
    <div className={styles.dashboardContainer}>
      <AnimatePresence>
        {showWelcome && (
          <motion.div
            className={styles.welcomeContainer}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.7, type: "spring", bounce: 0.4 }}
              className={styles.welcomeAvatar}
            >
              <BrainCircuit className="w-10 h-10 text-white" />
            </motion.div>
            <motion.h1
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className={styles.welcomeGreeting}
            >
              {greeting}, {userName} {isMorning ? '☀️' : isEvening ? '🌙' : '☀️'}
            </motion.h1>
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.6 }}
              className={styles.welcomeMessage}
            >
              Small healthy habits create lasting results.
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.header
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5 }}
        className={styles.pageHeader}
      >
        <div>
          <h1 className={styles.pageTitle}>{greeting}, {userName}</h1>
          <p className={styles.pageSubtitle}>Here is your wellness overview for today.</p>
        </div>
        {!allSlotsComplete && (
          <Link
            href="/check-in"
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all"
            style={{ 
              color: 'var(--hs-pink)', 
              backgroundColor: 'var(--hs-glow-pink)', 
              border: '1px solid var(--hs-glass-border)'
            }}
          >
            Complete Check-in <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </motion.header>
      
      <div className={styles.dashboardGrid}>
        <div className="flex flex-col gap-8">
          {/* AI WELLNESS SNAPSHOT */}
      <motion.section
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
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
                    <span className={styles.snapshotLabel}>Stress</span>
                    <span className={styles.snapshotValue}>{l.stress}/10</span>
                  </div>
                </div>
              )}
              {cycleStatus && wellnessMode !== 'pregnancy' && (
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
              {wellnessMode === 'pregnancy' && pregWeek && (
                <div className={styles.snapshotItem}>
                  <div className={styles.snapshotIcon}><Heart className="w-4 h-4 text-blue-400" /></div>
                  <div className={styles.snapshotData}>
                    <span className={styles.snapshotLabel}>Pregnancy</span>
                    <span className={styles.snapshotValue}>Week {pregWeek}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.section>

      {/* AI COMPANION INSIGHT */}
      <motion.section
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        <h2 className={styles.sectionTitle}>{aiName}&apos;s Insight</h2>
        <div className={`${styles.premiumCard} ${styles.observationCard}`}>
          <div className={styles.observationHeader}>
            <div className={styles.observationAvatar}>
              <BrainCircuit className="w-5 h-5 text-white" />
            </div>
          </div>
          <p className={styles.observationText}>{generateObservation()}</p>
        </div>
      </motion.section>

      {/* ACTIVE WELLNESS PLAN */}
      <motion.section
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="relative"
      >
        <div className="flex items-center justify-between">
          <h2 className={styles.sectionTitle}>Today&apos;s Active Wellness Plan</h2>
        </div>
        
        {/* The Roaming AI Mascot */}
        <DashboardMascot />
        
        <div className={styles.premiumCard} style={{ padding: '1.25rem', position: 'relative', zIndex: 10 }}>
          
          {!isCheckinCompleted ? (
            <div className="flex flex-col items-center text-center py-6">
               <Sun className="w-10 h-10 text-violet-400 mb-3 opacity-60" />
               <h3 className="font-semibold text-foreground mb-1 text-lg">Your {activeSlotTitle} plan is waiting!</h3>
               <p className="text-sm text-muted-foreground mb-4 max-w-[280px]">
                 Complete your {activeSlot} check-in to generate your personalized tasks based on how you feel right now.
               </p>
               <Link href="/check-in" className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-medium text-sm rounded-full transition-colors">
                 Start Check-in
               </Link>
            </div>
          ) : areTasksCompleted ? (
            <div className="flex flex-col items-center text-center py-6">
              <Check className="w-12 h-12 text-emerald-500 mb-3 p-2 bg-emerald-500/10 rounded-full" />
              <h3 className="font-semibold text-emerald-500 mb-2 text-lg">
                {activeSlot === 'evening' ? "🎉 Today's Wellness Journey Completed!" : `✓ ${activeSlotTitle} Tasks Completed`}
              </h3>
              <p className="text-sm text-muted-foreground">
                {activeSlot === 'evening' 
                  ? "Great job today! See you tomorrow." 
                  : `Incredible work. Check back in the ${activeSlot === 'morning' ? 'afternoon' : 'evening'} for your next plan.`}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 mb-2">
                 <Sparkles className="w-4 h-4 text-pink-500" />
                 <span className="font-semibold text-foreground">{activeSlotTitle} Tasks</span>
              </div>
              
              {slotTasks.map(task => (
                <div 
                  key={task.id} 
                  onClick={() => handleToggleTask(task.id, wellnessTasks[0]?.id || '')} // planId is same for all tasks today
                  className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${task.completed ? 'bg-secondary/40 border-border/30 opacity-60' : 'bg-card border-violet-500/20 hover:border-violet-500/50 shadow-sm'}`}
                >
                  <button className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${task.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-violet-400 text-transparent'}`}>
                    {togglingTask === task.id ? <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-500" /> : <Check className="w-3.5 h-3.5" />}
                  </button>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${task.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                      {task.text}
                    </p>
                    <span className="text-[10px] font-semibold text-violet-400 mt-1 uppercase tracking-wider bg-violet-500/10 px-2 py-0.5 rounded-full inline-block">
                      {task.category}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.section>
      </div>
      <div className="flex flex-col gap-8">

      {/* TODAY'S WELLNESS GOALS */}
      <motion.section
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
      >
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
                transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
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
                transition={{ duration: 1, delay: 0.6, ease: "easeOut" }}
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
                  transition={{ duration: 1, delay: 0.7, ease: "easeOut" }}
                  style={{ background: 'linear-gradient(90deg, var(--hs-violet), var(--hs-pink))' }}
                />
              </div>
            </div>
          )}
        </div>
      </motion.section>

      {/* PROGRESS STATS */}
      <motion.section
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
      >
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
      </motion.section>
      </div>
    </div>
    </div>
  );
}
