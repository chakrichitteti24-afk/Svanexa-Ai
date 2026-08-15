'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Loader2,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  HeartPulse,
  Info,
  BatteryCharging,
  Smile,
  Activity,
  Droplets,
  Moon,
} from 'lucide-react';
import { format } from 'date-fns';
import { useHerSync } from '@/context/HerSyncContext';
import { apiFetch } from '@/utils/api-client';
import {
  getCheckinQuestions,
  calculateCheckinIndicators,
  type CheckinSlot,
  type WellnessMode,
  type CheckinIndicators,
} from '@/lib/questions/checkin-questions';
import { CheckinRewardBar } from '@/components/checkin/CheckinRewardBar';

function getCurrentSlot(): CheckinSlot {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 18) return 'afternoon';
  return 'evening';
}

function useNextSlotCountdown(activeSlot: CheckinSlot, isCompleted: boolean) {
  const [countdown, setCountdown] = useState('');
  const [nextSlotName, setNextSlotName] = useState('');

  useEffect(() => {
    if (!isCompleted) return;

    const updateTimer = () => {
      const now = new Date();
      const currentHour = now.getHours();

      let nextSlotHour = 0;
      let slotName = '';

      if (activeSlot === 'morning') {
        nextSlotHour = 12;
        slotName = 'Afternoon';
      } else if (activeSlot === 'afternoon') {
        nextSlotHour = 18;
        slotName = 'Evening';
      } else {
        nextSlotHour = 5;
        slotName = 'Morning';
      }

      const nextTarget = new Date(now);
      nextTarget.setHours(nextSlotHour, 0, 0, 0);

      if (activeSlot === 'evening' && currentHour >= 18) {
        nextTarget.setDate(nextTarget.getDate() + 1);
      }

      const diffMs = nextTarget.getTime() - now.getTime();
      if (diffMs <= 0) {
        setCountdown('Unlocking now...');
        window.location.reload();
        return;
      }

      const h = Math.floor(diffMs / (1000 * 60 * 60));
      const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diffMs % (1000 * 60)) / 1000);

      setNextSlotName(slotName);
      setCountdown(`${h}h ${m}m ${s}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeSlot, isCompleted]);

  return { countdown, nextSlotName };
}

export default function CheckInPage() {
  const router = useRouter();
  const { wellnessMode, refreshAll } = useHerSync();
  const activeSlot = getCurrentSlot();
  const mode = (wellnessMode as WellnessMode) || 'general';

  // 10 MCQs dynamic question set
  const questions = useMemo(() => getCheckinQuestions(activeSlot, mode), [activeSlot, mode]);
  const totalQuestions = questions.length; // Exactly 10

  const [loading, setLoading] = useState(true);
  const [completedSlots, setCompletedSlots] = useState<Record<CheckinSlot, { completed: boolean; completedAt: string | null; data: any }>>(
    {
      morning:   { completed: false, completedAt: null, data: null },
      afternoon: { completed: false, completedAt: null, data: null },
      evening:   { completed: false, completedAt: null, data: null },
    }
  );

  // Claim status — sourced from server (authoritative)
  const [claimedSlots, setClaimedSlots] = useState<Partial<Record<CheckinSlot, boolean>>>({});
  const [bonusClaimed, setBonusClaimed] = useState(false);

  const [currentStep, setCurrentStep] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const isSavingRef = useRef(false);

  const isCurrentSlotCompleted = completedSlots[activeSlot]?.completed;
  const { countdown, nextSlotName } = useNextSlotCountdown(activeSlot, isCurrentSlotCompleted);

  const fetchStatus = useCallback(async () => {
    try {
      const [statusRes, claimStatusRes] = await Promise.all([
        apiFetch('/api/health/checkin-status'),
        apiFetch('/api/health/checkin/claim-status'),
      ]);

      if (statusRes.ok) {
        const { data } = await statusRes.json();
        setCompletedSlots(data.slots);
        if (data.slots[activeSlot]?.data) {
          // Preload previous answers if available
          setAnswers(data.slots[activeSlot].data.answers || data.slots[activeSlot].data);
        }
      }

      if (claimStatusRes.ok) {
        const { data } = await claimStatusRes.json();
        setClaimedSlots({
          morning:   data.claimed.morning,
          afternoon: data.claimed.afternoon,
          evening:   data.claimed.evening,
        });
        setBonusClaimed(data.claimed.bonus);
      }
    } catch (err) {
      console.error('Error fetching checkin status', err);
    } finally {
      setLoading(false);
    }
  }, [activeSlot]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleSelectOption = (questionId: string, score: number) => {
    setAnswers(prev => ({ ...prev, [questionId]: score }));
    // Auto-advance if not on the last question
    if (currentStep < totalQuestions - 1) {
      setTimeout(() => {
        setCurrentStep(prev => Math.min(totalQuestions - 1, prev + 1));
      }, 160);
    }
  };

  // Compute live 10-dimension indicators
  const indicators: CheckinIndicators = useMemo(
    () => calculateCheckinIndicators(answers, questions),
    [answers, questions]
  );

  // Count answered questions
  const answeredCount = questions.filter(q => answers[q.id] !== undefined).length;
  const canSubmit = answeredCount === totalQuestions;

  const submitCheckin = async () => {
    if (!canSubmit) {
      toast.error(`Please complete all 10 questions (${answeredCount}/${totalQuestions} answered).`);
      return;
    }
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setSaving(true);

    try {
      const payload = {
        slot: activeSlot,
        data: {
          answers,
          indicators,
          // Legacy direct fields for backward compatibility
          averageScore: indicators.stress.score,
          stressIndicator: indicators.stress.level,
          stressLabel: indicators.stress.label,
          moodState: indicators.mood.state,
          energyLevel: indicators.energy.level,
          wellnessScore: indicators.wellnessScore,
          sleepRating: indicators.sleepRating,
          hydrationRating: indicators.hydrationRating,
          supportChoice: indicators.supportChoice,
          questionMeta: questions.map(q => ({
            id: q.id,
            category: q.category,
            title: q.title,
            question: q.question,
            selectedScore: answers[q.id] ?? null,
          })),
        },
      };

      const res = await apiFetch('/api/health/checkin', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (!res.ok) {
        toast.error('Failed to save check-in', {
          description: result.error || result.message || 'Unknown error occurred. Please try again.',
        });
        return;
      }

      const now = new Date().toISOString();
      setCompletedSlots(prev => ({
        ...prev,
        [activeSlot]: { completed: true, completedAt: now, data: payload.data },
      }));
      setIsEditing(false);

      toast.success(
        `${activeSlot.charAt(0).toUpperCase() + activeSlot.slice(1)} check-in saved! Tap "Claim" below to collect your reward. 🌸`
      );

      // Trigger AI wellness plan generation in background — non-blocking.
      apiFetch('/api/wellness-plan', { method: 'POST' }).catch(() => {
        console.warn('Wellness plan generation failed in background. Check-in remains safely saved.');
      });

      // Sync dashboard and global context state
      await refreshAll();
    } catch (err: any) {
      toast.error('Network Error', {
        description: err.message || 'Could not connect to server. Please try again.',
      });
    } finally {
      setSaving(false);
      isSavingRef.current = false;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // COMPLETION VIEW (Summary + Reward Claim)
  // ─────────────────────────────────────────────────────────────────────────────
  if (isCurrentSlotCompleted && !isEditing) {
    const slotTitle = activeSlot.charAt(0).toUpperCase() + activeSlot.slice(1);
    const timeStr = completedSlots[activeSlot].completedAt
      ? format(new Date(completedSlots[activeSlot].completedAt!), 'hh:mm a')
      : '';
    const savedData = completedSlots[activeSlot].data;
    const savedIndicators: CheckinIndicators = savedData?.indicators || indicators;

    return (
      <div className="max-w-2xl mx-auto w-full pt-6 md:pt-8 px-4 pb-24 animate-in fade-in duration-300">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-start text-center p-6 md:p-8 bg-card/80 backdrop-blur-md border border-border/40 rounded-3xl shadow-xl shadow-emerald-500/5"
        >
          {/* Top Badge */}
          <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 animate-pulse" />
            <CheckCircle2 className="w-8 h-8 md:w-10 md:h-10 text-emerald-500 relative z-10" />
          </div>

          <h2 className="text-2xl md:text-3xl font-extrabold text-foreground mb-1">
            ✓ {slotTitle} Check-In Complete
          </h2>
          {timeStr && (
            <p className="text-xs font-semibold text-muted-foreground mb-6">
              Completed at {timeStr}
            </p>
          )}

          {/* 🌟 10-Dimension Wellness Assessment Summary Card */}
          <div className="w-full max-w-md space-y-3 mb-6 text-left">
            {/* Overall Daily Wellness Balance */}
            <div className="p-4 rounded-2xl border border-violet-500/20 bg-gradient-to-r from-violet-500/10 to-pink-500/5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-violet-400" /> Daily Wellness Balance
                </span>
                <span className="text-xs font-black px-2.5 py-0.5 rounded-full border border-violet-500/30 text-violet-400 bg-violet-500/10">
                  {savedIndicators.wellnessScore} / 100
                </span>
              </div>
              <div className="w-full h-2 bg-secondary rounded-full overflow-hidden mt-2">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-pink-500 via-violet-500 to-indigo-500"
                  style={{ width: `${savedIndicators.wellnessScore}%` }}
                />
              </div>
            </div>

            {/* Inferred Non-Diagnostic Stress Indicator */}
            <div className={`p-4 rounded-2xl border bg-gradient-to-r ${savedIndicators.stress.bgStyle}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <HeartPulse className="w-3.5 h-3.5 text-pink-500" /> Stress Signal Indicator
                </span>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${savedIndicators.stress.badgeColor}`}>
                  {savedIndicators.stress.level}
                </span>
              </div>
              <p className="text-xs text-foreground/90 font-medium mt-1.5 leading-relaxed">
                {savedIndicators.stress.label}
              </p>
            </div>

            {/* Quick Indicators Grid: Mood & Energy */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl border border-border/40 bg-secondary/30">
                <div className="flex items-center gap-1.5 mb-1 text-xs font-semibold text-muted-foreground">
                  <Smile className="w-3.5 h-3.5 text-pink-400" /> Mood Tone
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-md border inline-block ${savedIndicators.mood.color}`}>
                  {savedIndicators.mood.state}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl border border-border/40 bg-secondary/30">
                <div className="flex items-center gap-1.5 mb-1 text-xs font-semibold text-muted-foreground">
                  <BatteryCharging className="w-3.5 h-3.5 text-amber-400" /> Energy
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-md border inline-block ${savedIndicators.energy.color}`}>
                  {savedIndicators.energy.level}
                </span>
              </div>
            </div>

            {/* Support choice note if present */}
            {savedIndicators.supportChoice && (
              <div className="px-4 py-2.5 rounded-xl bg-secondary/40 border border-border/30 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground/80">Support focus: </span>
                {savedIndicators.supportChoice}
              </div>
            )}

            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-1">
              <Info className="w-3.5 h-3.5 flex-shrink-0 text-violet-400" />
              <span>Non-diagnostic wellness indicator — used to personalize your daily AI plan.</span>
            </div>
          </div>

          {/* 🪙 Reward Claim Section */}
          <div className="w-full max-w-md mb-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5 text-left">
              🪙 Collect Your Rewards
            </p>
            <CheckinRewardBar
              completedSlots={{
                morning:   completedSlots.morning.completed,
                afternoon: completedSlots.afternoon.completed,
                evening:   completedSlots.evening.completed,
              }}
              initialClaimedSlots={claimedSlots}
              initialBonusClaimed={bonusClaimed}
              activeSlot={activeSlot}
            />
          </div>

          {/* Countdown to Next Check-In */}
          <div className="w-full max-w-md bg-secondary/50 rounded-2xl p-5 border border-border/50 mb-6 flex flex-col items-center justify-center gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {nextSlotName} Check-In unlocks in
            </span>
            <div className="text-3xl font-black tabular-nums tracking-tight text-foreground font-mono">
              {countdown || '...'}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
            <button
              onClick={() => setIsEditing(true)}
              className="flex-1 px-6 py-3 rounded-full border border-violet-500/30 hover:bg-violet-500/10 text-violet-400 font-semibold transition-all text-sm min-h-[44px]"
            >
              Edit Check-In
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="flex-1 px-8 py-3 rounded-full bg-foreground hover:bg-foreground/90 text-background font-semibold shadow-lg transition-all text-sm min-h-[44px]"
            >
              Return to Dashboard
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 10-QUESTION MCQ QUESTIONNAIRE VIEW
  // ─────────────────────────────────────────────────────────────────────────────
  const activeQuestion = questions[currentStep];
  const progressPct = Math.round(((currentStep + 1) / totalQuestions) * 100);
  const slotLabel =
    activeSlot === 'morning'
      ? 'Morning 🌅'
      : activeSlot === 'afternoon'
      ? 'Afternoon ☀️'
      : 'Evening 🌙';

  const categoryIcons: Record<string, any> = {
    sleep: Moon,
    energy: BatteryCharging,
    mood: Smile,
    stress: HeartPulse,
    focus: Sparkles,
    physical_comfort: Activity,
    hydration: Droplets,
    activity: Activity,
    general_wellness: Sparkles,
    support: HeartPulse,
  };

  const CatIcon = categoryIcons[activeQuestion.category] || Sparkles;

  return (
    <div className="max-w-2xl mx-auto w-full pt-4 md:pt-8 px-4 pb-36">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mb-1 capitalize bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-violet-500">
            {slotLabel} Check-In
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground flex items-center gap-1.5 font-medium">
            <Sparkles className="w-4 h-4 text-violet-400 flex-shrink-0" />
            10-Question Daily Wellness Assessment
          </p>
        </div>
      </div>

      {/* Progress Stepper Bar */}
      <div className="mb-6 bg-card/60 backdrop-blur-md border border-border/50 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between text-xs font-bold mb-2">
          <span className="text-foreground">
            Question {currentStep + 1} of {totalQuestions}
          </span>
          <span className="text-pink-500">{progressPct}% Complete</span>
        </div>

        <div className="w-full h-2.5 bg-secondary rounded-full overflow-hidden p-0.5 border border-border/30">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-pink-500 via-violet-500 to-indigo-500"
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          />
        </div>

        {/* 10-Dot Step Navigation */}
        <div className="flex items-center justify-center gap-1.5 md:gap-2 mt-3 flex-wrap">
          {questions.map((q, idx) => {
            const isAnswered = answers[q.id] !== undefined;
            const isCurrent = idx === currentStep;
            return (
              <button
                key={q.id}
                onClick={() => setCurrentStep(idx)}
                aria-label={`Jump to Question ${idx + 1}: ${q.title}`}
                className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all min-h-[28px] ${
                  isCurrent
                    ? 'bg-pink-500 text-white scale-110 shadow-md shadow-pink-500/20'
                    : isAnswered
                    ? 'bg-violet-500/20 text-violet-400 border border-violet-500/40'
                    : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                }`}
              >
                {isAnswered ? '✓' : idx + 1}
              </button>
            );
          })}
        </div>
      </div>

      {/* Question Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeQuestion.id + currentStep}
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -18 }}
          transition={{ duration: 0.2 }}
          className="bg-card/70 backdrop-blur-md border border-border/50 rounded-3xl p-6 shadow-md mb-6"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full text-violet-400 bg-violet-500/10 flex items-center gap-1.5">
              <CatIcon className="w-3.5 h-3.5" />
              {activeQuestion.title}
            </span>
            <span className="text-[11px] font-semibold text-muted-foreground">
              {currentStep + 1} / {totalQuestions}
            </span>
          </div>

          <h2 className="text-xl md:text-2xl font-bold mb-6 text-foreground leading-snug">
            {activeQuestion.question}
          </h2>

          <div className="flex flex-col gap-3">
            {activeQuestion.options.map(opt => {
              const isSelected = answers[activeQuestion.id] === opt.score;
              return (
                <button
                  key={`${opt.score}-${opt.label}`}
                  onClick={() => handleSelectOption(activeQuestion.id, opt.score)}
                  className={`flex items-center justify-between w-full px-5 py-4 rounded-2xl border-2 font-semibold transition-all duration-200 min-h-[56px] text-left ${
                    isSelected
                      ? 'border-pink-500 bg-pink-500/10 text-pink-600 shadow-md shadow-pink-500/10 scale-[1.01]'
                      : 'border-border/50 bg-secondary/40 text-foreground/80 hover:bg-secondary hover:border-pink-500/30'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <span className="text-2xl drop-shadow-sm flex-shrink-0">{opt.emoji}</span>
                    <span className="text-sm md:text-base leading-snug">{opt.label}</span>
                  </div>
                  {isSelected && (
                    <CheckCircle2 className="w-5 h-5 text-pink-500 flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between gap-3 mb-24">
        <button
          onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
          disabled={currentStep === 0}
          className="flex items-center gap-1.5 px-5 py-3 rounded-full border border-border/50 text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-secondary transition-all min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" /> Previous
        </button>

        {currentStep < totalQuestions - 1 ? (
          <button
            onClick={() => setCurrentStep(prev => Math.min(totalQuestions - 1, prev + 1))}
            className="flex items-center gap-1.5 px-6 py-3 rounded-full bg-secondary hover:bg-secondary/80 text-foreground text-sm font-semibold transition-all min-h-[44px]"
          >
            Next <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <span className="text-xs font-semibold text-emerald-500 flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" /> All 10 Questions Answered
          </span>
        )}
      </div>

      {/* Sticky Bottom Save Bar */}
      <div className="fixed bottom-[72px] md:bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-xl border-t border-border/50 flex justify-center z-50">
        <div className="w-full max-w-2xl flex items-center justify-between gap-4">
          <div className="text-xs font-medium text-muted-foreground hidden sm:block">
            {canSubmit ? (
              <span className="text-emerald-500 flex items-center gap-1 font-semibold">
                <CheckCircle2 className="w-4 h-4" /> All 10 answered — Ready to save!
              </span>
            ) : (
              <span>
                {answeredCount} of {totalQuestions} answered
              </span>
            )}
          </div>
          <button
            onClick={submitCheckin}
            disabled={saving || !canSubmit}
            className="flex-1 sm:flex-none w-full sm:w-auto px-8 py-3.5 rounded-full bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-600 hover:to-violet-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold shadow-lg shadow-pink-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 text-base md:text-lg min-h-[50px]"
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Saving your reflection...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 text-amber-300" />
                <span>Save My Reflection 🌸</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
