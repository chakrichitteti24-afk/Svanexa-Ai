'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Wind, Sparkles } from 'lucide-react';

interface BreathingExerciseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  technique?: '4-7-8' | 'box';
  taskTitle?: string;
}

type BreathPhase = 'inhale' | 'hold' | 'exhale' | 'hold-empty';

export function BreathingExerciseModal({
  isOpen,
  onClose,
  onComplete,
  technique = '4-7-8',
  taskTitle,
}: BreathingExerciseModalProps) {
  const [phase, setPhase] = useState<BreathPhase>('inhale');
  const [countdown, setCountdown] = useState(4);
  const [cycle, setCycle] = useState(1);
  const totalCycles = 3;
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setPhase('inhale');
      setCountdown(4);
      setCycle(1);
      setIsFinished(false);
      return;
    }

    if (isFinished) return;

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev > 1) return prev - 1;

        // Transition to next phase
        if (technique === '4-7-8') {
          if (phase === 'inhale') {
            setPhase('hold');
            return 7;
          } else if (phase === 'hold') {
            setPhase('exhale');
            return 8;
          } else {
            // After exhale
            if (cycle >= totalCycles) {
              setIsFinished(true);
              return 0;
            }
            setCycle(c => c + 1);
            setPhase('inhale');
            return 4;
          }
        } else {
          // Box breathing: 4s in, 4s hold, 4s out, 4s hold
          if (phase === 'inhale') {
            setPhase('hold');
            return 4;
          } else if (phase === 'hold') {
            setPhase('exhale');
            return 4;
          } else if (phase === 'exhale') {
            setPhase('hold-empty');
            return 4;
          } else {
            if (cycle >= totalCycles) {
              setIsFinished(true);
              return 0;
            }
            setCycle(c => c + 1);
            setPhase('inhale');
            return 4;
          }
        }
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, phase, cycle, technique, isFinished]);

  if (!isOpen) return null;

  const phaseInstruction = {
    inhale: 'Breathe in gently through your nose...',
    hold: 'Hold gently and comfortably...',
    exhale: 'Slow, soft exhale through your mouth...',
    'hold-empty': 'Rest comfortably in the pause...',
  }[phase];

  const circleScale = phase === 'inhale' ? 1.35 : phase === 'hold' ? 1.35 : 0.85;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-sm p-6 rounded-3xl bg-card border border-border/60 shadow-2xl text-center overflow-hidden"
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-primary mb-1">
            <Wind className="w-3.5 h-3.5" />
            <span>{technique === '4-7-8' ? '4-7-8 Relaxing Breath' : 'Box Breathing Reset'}</span>
          </div>

          <h3 className="text-base font-bold text-foreground mb-1">
            {isFinished ? 'Nervous System Grounded ✨' : `Cycle ${cycle} of ${totalCycles}`}
          </h3>
          {taskTitle && (
            <p className="text-xs text-muted-foreground line-clamp-2 px-2 mb-4">
              {taskTitle}
            </p>
          )}
          {!taskTitle && <div className="mb-4" />}

          {!isFinished ? (
            <div className="py-6 flex flex-col items-center justify-center">
              {/* Apple Mindfulness Organic Breathing Circle */}
              <div className="relative w-44 h-44 flex items-center justify-center mb-6">
                <motion.div
                  animate={{
                    scale: circleScale,
                    opacity: phase === 'inhale' ? 0.35 : phase === 'hold' ? 0.45 : 0.15,
                  }}
                  transition={{ duration: countdown, ease: [0.32, 0.72, 0, 1] }}
                  className="absolute inset-0 rounded-full bg-primary/20 blur-2xl"
                />
                <motion.div
                  animate={{ scale: circleScale }}
                  transition={{ duration: countdown, ease: [0.32, 0.72, 0, 1] }}
                  className="w-32 h-32 rounded-full border border-white/20 bg-white/[0.08] backdrop-blur-xl flex flex-col items-center justify-center shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2),0_4px_16px_rgba(0,0,0,0.2)]"
                >
                  <span className="text-3xl font-semibold text-foreground tracking-tight">{countdown}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                    {phase === 'hold-empty' ? 'Rest' : phase}
                  </span>
                </motion.div>
              </div>

              <p className="text-sm font-medium text-muted-foreground min-h-[40px] flex items-center justify-center px-4">
                {phaseInstruction}
              </p>
            </div>
          ) : (
            <div className="py-6 flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-sm">
                <Check className="w-8 h-8" />
              </div>
              <p className="text-xs text-muted-foreground max-w-xs">
                Wonderful job honoring your body. Your vagus nerve is activated and your mind is calmer.
              </p>
              <button
                type="button"
                onClick={() => {
                  onComplete();
                  onClose();
                }}
                className="w-full h-11 rounded-full bg-primary text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.22),0_2px_8px_rgba(0,0,0,0.24)] hover:opacity-95 transition-all cursor-pointer active:scale-[0.98]"
              >
                <Sparkles className="w-4 h-4" />
                Mark Task as Done
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
