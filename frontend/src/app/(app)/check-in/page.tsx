'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CheckCircle2, Loader2, Sparkles, ArrowLeft, ArrowRight, HeartPulse, Info } from 'lucide-react';
import { format } from 'date-fns';
import { useHerSync } from '@/context/HerSyncContext';
import { apiFetch } from '@/utils/api-client';
import {
  getCheckinQuestions,
  calculateStressScore,
  getStressInterpretation,
  type CheckinSlot,
  type WellnessMode,
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
  const mode = wellnessMode as WellnessMode;

  // Dynamic question set from the engine
  const questions = getCheckinQuestions(activeSlot, mode);
  const stressQuestions = questions.filter(q => q.isStressDimension);
  const totalQuestions = questions.length;

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
      // Fetch both checkin status and claim status in parallel
      const [statusRes, claimStatusRes] = await Promise.all([
        apiFetch('/api/health/checkin-status'),
        apiFetch('/api/health/checkin/claim-status'),
      ]);

      if (statusRes.ok) {
        const { data } = await statusRes.json();
        setCompletedSlots(data.slots);
        if (data.slots[activeSlot]?.data) {
          setAnswers(data.slots[activeSlot].data);
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

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const handleSelectOption = (questionId: string, score: number) => {
    setAnswers(prev => ({ ...prev, [questionId]: score }));
    // Auto-advance if not on the last question
    if (currentStep < totalQuestions - 1) {
      setTimeout(() => {
        setCurrentStep(prev => Math.min(totalQuestions - 1, prev + 1));
      }, 180);
    }
  };

  // Compute stress score from 4 stress-dimension answers
  const stressAnswers: Record<string, number> = {
    q1_feeling: answers.q1_feeling ? Number(answers.q1_feeling) : 0,
    q2_focus:   answers.q2_focus   ? Number(answers.q2_focus)   : 0,
    q3_body:    answers.q3_body    ? Number(answers.q3_body)    : 0,
    q4_thoughts: answers.q4_thoughts ? Number(answers.q4_thoughts) : 0,
  };

  const allStressAnswered = stressQuestions.every(q => stressAnswers[q.id] > 0);
  const averageScore = calculateStressScore(allStressAnswered ? stressAnswers : {});
  const interpretation = getStressInterpretation(averageScore);

  // All stress questions must be answered before submitting (support question is optional)
  const canSubmit = allStressAnswered;

  const submitCheckin = async () => {
    if (!canSubmit) {
      toast.error('Please answer the 4 wellness questions to continue.');
      return;
    }
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setSaving(true);

    try {
      // Build payload — include question definitions so historical data stays meaningful
      const payload = {
        slot: activeSlot,
        data: {
          // Stress dimensions
          q1_feeling:   stressAnswers.q1_feeling,
          q2_focus:     stressAnswers.q2_focus,
          q3_body:      stressAnswers.q3_body,
          q4_thoughts:  stressAnswers.q4_thoughts,
          averageScore,
          stressIndicator: interpretation.level,
          stressLabel:     interpretation.label,
          // Optional support choice
          support: answers.support || null,
          // Sleep (morning only)
          sleep: answers.sleep || (activeSlot === 'morning' ? null : null),
          // Metadata: store question text so history is understandable
          questionMeta: questions.map(q => ({
            id: q.id,
            slot: activeSlot,
            mode,
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
        toast.error('Failed to save check-in', { description: result.error || result.message || 'Unknown error' });
        return;
      }

      const now = new Date().toISOString();
      setCompletedSlots(prev => ({
        ...prev,
        [activeSlot]: { completed: true, completedAt: now, data: payload.data },
      }));
      setIsEditing(false);

      // Show simple save success — coins are now claimed via the Claim button
      toast.success(`${activeSlot.charAt(0).toUpperCase() + activeSlot.slice(1)} check-in saved! Tap "Claim" to collect your reward. 🌸`);

      // Trigger AI wellness plan generation in background — non-blocking.
      // Check-in is already saved. If AI fails, the check-in persists regardless.
      apiFetch('/api/wellness-plan', { method: 'POST' }).catch(() => {
        console.warn('Wellness plan generation failed. Check-in remains saved.');
      });

      // Sync dashboard and global state
      await refreshAll();

    } catch (err: any) {
      toast.error('Network Error', { description: err.message || 'Could not connect to server' });
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

  if (isCurrentSlotCompleted && !isEditing) {
    const slotTitle = activeSlot.charAt(0).toUpperCase() + activeSlot.slice(1);
    const timeStr = completedSlots[activeSlot].completedAt
      ? format(new Date(completedSlots[activeSlot].completedAt!), 'hh:mm a')
      : '';
    const savedData = completedSlots[activeSlot].data;
    const savedScore = savedData?.averageScore ?? null;
    const savedInterpretation = getStressInterpretation(savedScore);

    return (
      <div className="max-w-2xl mx-auto w-full pt-8 px-4 pb-24">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-start text-center p-6 md:p-8 bg-card/80 backdrop-blur-md border border-border/40 rounded-3xl shadow-xl shadow-emerald-500/5"
        >
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-5 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 animate-pulse" />
            <CheckCircle2 className="w-10 h-10 text-emerald-500 relative z-10" />
          </div>

          <h2 className="text-2xl font-bold text-emerald-500 mb-1">
            ✓ {slotTitle} Check-in Completed
          </h2>
          {timeStr && (
            <p className="text-xs font-semibold text-foreground/80 mb-4">
              Completed at: {timeStr}
            </p>
          )}

          {savedScore !== null && (
            <div className={`w-full max-w-md p-4 rounded-2xl border mb-5 bg-gradient-to-r ${savedInterpretation.bgStyle}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <HeartPulse className="w-3.5 h-3.5 text-pink-500" /> Wellness Indicator
                </span>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${savedInterpretation.badgeColor}`}>
                  Score {savedScore} / 5.0
                </span>
              </div>
              <p className="text-sm font-semibold text-foreground text-left mt-2">
                {savedInterpretation.label}
              </p>
            </div>
          )}

          {/* ✨ Reward Claim Bar — appears only after successful save */}
          <div className="w-full max-w-md mb-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 text-left">
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

          <p className="text-muted-foreground mb-5 text-sm max-w-md">
            Your check-in responses have been saved. Your Svanexa AI Wellness Plan has been updated for this slot.
          </p>

          <div className="w-full bg-secondary/50 rounded-2xl p-5 border border-border/50 mb-6 flex flex-col items-center justify-center gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {nextSlotName} Check-in unlocks in
            </span>
            <div className="text-3xl font-black tabular-nums tracking-tight text-foreground/90 font-mono">
              {countdown || '...'}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <button
              onClick={() => setIsEditing(true)}
              className="px-6 py-3 rounded-full border border-violet-500/30 hover:bg-violet-500/10 text-violet-400 font-semibold transition-all text-sm min-h-[44px]"
            >
              Edit Check-in
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-8 py-3 rounded-full bg-foreground hover:bg-foreground/90 text-background font-semibold shadow-lg transition-all text-sm min-h-[44px]"
            >
              Return to Dashboard
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const activeQuestion = questions[currentStep];
  const answeredCount = questions.filter(q => answers[q.id] !== undefined).length;
  const progressPct = Math.round(((currentStep + 1) / totalQuestions) * 100);

  const slotLabel = activeSlot === 'morning' ? 'Morning 🌅' : activeSlot === 'afternoon' ? 'Afternoon ☀️' : 'Evening 🌙';

  return (
    <div className="max-w-2xl mx-auto w-full pt-4 md:pt-8 px-4 pb-36">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mb-1 capitalize bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-violet-500">
            {slotLabel} Check-in
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground flex items-center gap-1.5 font-medium">
            <Sparkles className="w-4 h-4 text-violet-400" />
            A quick moment for your daily wellness
          </p>
        </div>
      </div>

      {/* Progress Indicator */}
      <div className="mb-6 bg-card/60 backdrop-blur-md border border-border/50 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between text-xs font-bold mb-2">
          <span className="text-foreground/90">
            Question {currentStep + 1} of {totalQuestions}
          </span>
          <span className="text-pink-500">{progressPct}% Complete</span>
        </div>

        <div className="w-full h-2.5 bg-secondary rounded-full overflow-hidden p-0.5 border border-border/30">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-pink-500 via-violet-500 to-indigo-500"
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
        </div>

        {/* Step navigation dots */}
        <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
          {questions.map((q, idx) => {
            const isAnswered = answers[q.id] !== undefined;
            const isCurrent = idx === currentStep;
            const isStress = q.isStressDimension;
            return (
              <button
                key={q.id}
                onClick={() => setCurrentStep(idx)}
                aria-label={`Jump to Question ${idx + 1}: ${q.title}`}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all min-h-[32px] ${
                  isCurrent
                    ? 'bg-pink-500 text-white scale-110 shadow-md shadow-pink-500/20'
                    : isAnswered
                    ? isStress
                      ? 'bg-violet-500/20 text-violet-400 border border-violet-500/40'
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
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
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25 }}
          className="bg-card/70 backdrop-blur-md border border-border/50 rounded-3xl p-6 shadow-md mb-6"
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full ${
              activeQuestion.isStressDimension
                ? 'text-violet-400 bg-violet-500/10'
                : 'text-emerald-400 bg-emerald-500/10'
            }`}>
              {activeQuestion.title}
            </span>
            {!activeQuestion.isStressDimension && (
              <span className="text-[10px] font-semibold text-muted-foreground bg-secondary/60 px-2 py-0.5 rounded-full">
                Optional
              </span>
            )}
          </div>

          <h2 className="text-xl md:text-2xl font-bold mb-6 text-foreground/90">
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
                  <div className="flex items-center gap-3">
                    <span className="text-2xl drop-shadow-sm flex-shrink-0">{opt.emoji}</span>
                    <span className="text-base">{opt.label}</span>
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

      {/* Live Stress Wellness Indicator (shown once all 4 stress questions answered) */}
      {allStressAnswered && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-5 rounded-3xl border shadow-sm mb-6 bg-gradient-to-r ${interpretation.bgStyle}`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <HeartPulse className="w-5 h-5 text-pink-500" />
              <span className="text-sm font-bold text-foreground">Stress Wellness Indicator</span>
            </div>
            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${interpretation.badgeColor}`}>
              {interpretation.level}
            </span>
          </div>

          <p className="text-sm text-foreground/90 font-medium mt-1">
            {interpretation.label}
          </p>

          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-3 pt-3 border-t border-border/30">
            <Info className="w-3.5 h-3.5 flex-shrink-0 text-violet-400" />
            <span>Wellness indicator only — not a medical diagnosis.</span>
          </div>
        </motion.div>
      )}

      {/* Sleep selector — Morning only */}
      {activeSlot === 'morning' && (
        <div className="bg-card/40 border border-border/40 rounded-3xl p-5 mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Sleep Last Night (Optional)</span>
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground/80 block mb-2">Hours of Sleep</label>
            <div className="flex flex-wrap gap-2">
              {[4, 5, 6, 7, 7.5, 8, 9].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setAnswers(prev => ({ ...prev, sleep: val }))}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                    answers.sleep === val
                      ? 'border-violet-500 bg-violet-500/10 text-violet-400'
                      : 'border-border/50 bg-secondary/30 text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  {val} hrs
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
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
            <CheckCircle2 className="w-4 h-4" /> All done
          </span>
        )}
      </div>

      {/* Sticky Save Bar */}
      <div className="fixed bottom-[72px] md:bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-xl border-t border-border/50 flex justify-center z-50">
        <div className="w-full max-w-2xl flex items-center justify-between gap-4">
          <div className="text-xs font-medium text-muted-foreground hidden sm:block">
            {canSubmit ? (
              <span className="text-emerald-500 flex items-center gap-1 font-semibold">
                <CheckCircle2 className="w-4 h-4" /> Ready to save
              </span>
            ) : (
              `Answer the 4 wellness questions (${Object.keys(answers).filter(k => ['q1_feeling','q2_focus','q3_body','q4_thoughts'].includes(k) && answers[k] > 0).length}/4 done)`
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
