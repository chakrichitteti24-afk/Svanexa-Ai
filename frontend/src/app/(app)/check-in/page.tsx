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
  AlertCircle,
  RotateCcw,
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
  const { wellnessMode, refreshAll, setWellnessTasks } = useHerSync();
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
  const [planGenerating, setPlanGenerating] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const isSavingRef = useRef(false);

  const isCurrentSlotCompleted = completedSlots[activeSlot]?.completed;
  const { countdown, nextSlotName } = useNextSlotCountdown(activeSlot, isCurrentSlotCompleted);

  const fetchStatus = useCallback(async () => {
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const [statusRes, claimStatusRes] = await Promise.all([
        apiFetch(`/api/health/checkin-status?date=${todayStr}`),
        apiFetch(`/api/health/checkin/claim-status?date=${todayStr}`),
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

  const retryGeneratePlan = async () => {
    setPlanGenerating(true);
    setPlanError(null);
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    try {
      const planRes = await apiFetch('/api/wellness-plan', {
        method: 'POST',
        body: JSON.stringify({ slot: activeSlot, date: todayStr, mode, forceRegenerate: true }),
      });
      if (planRes.ok) {
        const planBody = await planRes.json();
        if (planBody.plan?.tasks) {
          setWellnessTasks(planBody.plan.tasks);
        }
        toast.success("Today's wellness plan generated! 🌸");
        await refreshAll();
      } else {
        setPlanError("Your check-in was saved, but your wellness plan couldn't be generated.");
      }
    } catch {
      setPlanError("Your check-in was saved, but your wellness plan couldn't be generated.");
    } finally {
      setPlanGenerating(false);
    }
  };

  const submitCheckin = async () => {
    if (!canSubmit) {
      toast.error(`Please complete all 10 questions (${answeredCount}/${totalQuestions} answered).`);
      return;
    }
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setSaving(true);
    setPlanError(null);

    const todayStr = format(new Date(), 'yyyy-MM-dd');

    try {
      const payload = {
        slot: activeSlot,
        date: todayStr,
        data: {
          answers,
          indicators,
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

      // Trigger AI wellness plan generation and update Dashboard immediately
      setPlanGenerating(true);
      try {
        const planRes = await apiFetch('/api/wellness-plan', {
          method: 'POST',
          body: JSON.stringify({ slot: activeSlot, date: todayStr, mode }),
        });

        if (planRes.ok) {
          const planBody = await planRes.json();
          if (planBody.plan?.tasks) {
            setWellnessTasks(planBody.plan.tasks);
          }
        } else {
          setPlanError("Your check-in was saved, but your wellness plan couldn't be generated.");
        }
      } catch (planErr) {
        console.warn('Wellness plan generation failed:', planErr);
        setPlanError("Your check-in was saved, but your wellness plan couldn't be generated.");
      } finally {
        setPlanGenerating(false);
      }

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
  // COMPLETION VIEW (Summary + Reward Claim + Plan Sync)
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
            <p className="text-xs font-semibold text-muted-foreground mb-4">
              Completed at {timeStr}
            </p>
          )}

          {/* AI Plan Generation State */}
          {planGenerating && (
            <div className="w-full max-w-md mb-6 p-4 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center gap-3 text-xs font-semibold text-violet-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Creating your personalized wellness plan...</span>
            </div>
          )}

          {planError && (
            <div className="w-full max-w-md mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col gap-2.5 text-left">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{planError}</span>
              </div>
              <button
                onClick={retryGeneratePlan}
                disabled={planGenerating}
                className="self-start px-3 py-1.5 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Retry Generating Plan
              </button>
            </div>
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

          {/* Check-in Slot Tracker */}
          <div className="w-full max-w-md mb-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5 text-left">
              📋 Today&apos;s Check-in Progress
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(['morning', 'afternoon', 'evening'] as const).map((slot) => {
                const slotData = completedSlots[slot];
                const isCurrent = slot === activeSlot;
                const slotLabels = { morning: '🌅 Morning', afternoon: '☀️ Afternoon', evening: '🌙 Evening' };
                return (
                  <div
                    key={slot}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      slotData.completed
                        ? 'bg-emerald-500/10 border-emerald-500/30'
                        : isCurrent
                        ? 'bg-violet-500/10 border-violet-500/30'
                        : 'bg-secondary/30 border-border/30 opacity-50'
                    }`}
                  >
                    <p className="text-[11px] font-bold mb-0.5">{slotLabels[slot]}</p>
                    {slotData.completed ? (
                      <p className="text-[10px] text-emerald-400 font-semibold">
                        ✓ {slotData.completedAt ? format(new Date(slotData.completedAt), 'h:mm a') : 'Done'}
                      </p>
                    ) : (
                      <p className="text-[10px] text-muted-foreground font-medium">
                        {isCurrent ? 'Current' : 'Pending'}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Countdown to Next Check-In or All Complete */}
          {completedSlots.morning.completed && completedSlots.afternoon.completed && completedSlots.evening.completed ? (
            <div className="w-full max-w-md bg-gradient-to-r from-emerald-500/10 to-teal-500/10 rounded-2xl p-5 border border-emerald-500/30 mb-6 flex flex-col items-center justify-center gap-1.5">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 mb-1" />
              <span className="text-sm font-bold text-emerald-400">
                All Daily Check-ins Complete! 🎉
              </span>
              <span className="text-xs text-muted-foreground font-medium text-center max-w-[260px]">
                Great job today. Tomorrow&apos;s Morning check-in will unlock at 5:00 AM.
              </span>
            </div>
          ) : (
            <div className="w-full max-w-md bg-secondary/50 rounded-2xl p-5 border border-border/50 mb-6 flex flex-col items-center justify-center gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {nextSlotName} Check-In unlocks in
              </span>
              <div className="text-3xl font-black tabular-nums tracking-tight text-foreground font-mono">
                {countdown || '...'}
              </div>
            </div>
          )}

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
          <p className="text-xs md:text-sm text-muted-foreground font-medium">
            10 quick taps for your daily personalized wellness plan
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-secondary text-foreground">
            {currentStep + 1} / {totalQuestions}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2 bg-secondary/80 rounded-full overflow-hidden mb-6">
        <motion.div
          className="h-full bg-gradient-to-r from-pink-500 via-violet-500 to-indigo-500"
          initial={{ width: 0 }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>

      {/* Question Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeQuestion.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="bg-card/80 backdrop-blur-md border border-border/50 rounded-3xl p-5 md:p-7 shadow-xl shadow-pink-500/5 mb-6"
        >
          {/* Category Tag */}
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-violet-500/10 text-violet-400 border border-violet-500/20">
              <CatIcon className="w-3.5 h-3.5" />
              {activeQuestion.title}
            </span>
          </div>

          {/* Question Text */}
          <h2 className="text-lg md:text-xl font-bold text-foreground mb-6 leading-snug">
            {activeQuestion.question}
          </h2>

          {/* MCQ Options */}
          <div className="space-y-3">
            {activeQuestion.options.map((option, idx) => {
              const isSelected = answers[activeQuestion.id] === option.score;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectOption(activeQuestion.id, option.score)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between group min-h-[52px] ${
                    isSelected
                      ? 'bg-gradient-to-r from-pink-500/15 to-violet-500/15 border-pink-500/50 shadow-md shadow-pink-500/10 scale-[1.01]'
                      : 'bg-secondary/30 hover:bg-secondary/60 border-border/40 hover:border-border'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <span className="text-xl flex-shrink-0">{option.emoji}</span>
                    <span
                      className={`text-sm font-medium transition-colors ${
                        isSelected ? 'text-foreground font-bold' : 'text-foreground/90'
                      }`}
                    >
                      {option.label}
                    </span>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-all ${
                      isSelected
                        ? 'border-pink-500 bg-pink-500 text-white'
                        : 'border-muted-foreground/30 group-hover:border-muted-foreground/60'
                    }`}
                  >
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </div>
                </button>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation Footer */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/85 backdrop-blur-xl border-t border-border/40 z-30">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={currentStep === 0 || saving}
            onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
            className="px-4 py-3 rounded-full border border-border/60 hover:bg-secondary disabled:opacity-40 disabled:pointer-events-none text-xs font-semibold text-foreground flex items-center gap-1.5 transition-all min-h-[44px]"
          >
            <ArrowLeft className="w-4 h-4" /> Previous
          </button>

          {currentStep < totalQuestions - 1 ? (
            <button
              type="button"
              disabled={answers[activeQuestion.id] === undefined}
              onClick={() => setCurrentStep(prev => Math.min(totalQuestions - 1, prev + 1))}
              className="px-6 py-3 rounded-full bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-600 hover:to-violet-600 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-pink-500/20 transition-all min-h-[44px]"
            >
              Next <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={!canSubmit || saving}
              onClick={submitCheckin}
              className="px-7 py-3 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-extrabold flex items-center gap-2 shadow-lg shadow-emerald-500/25 transition-all active:scale-95 min-h-[44px]"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" /> Complete & Generate Plan
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
