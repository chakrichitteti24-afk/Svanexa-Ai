'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { useHerSync } from '@/context/HerSyncContext';
import { apiFetch } from '@/utils/api-client';

type SlotType = 'morning' | 'afternoon' | 'evening';
type QuestionType = 'choice' | 'slider' | 'text' | 'number';

interface Question {
  id: string;
  text: string;
  type: QuestionType;
  options?: { value: string | number; label: string; emoji?: string }[];
  min?: number;
  max?: number;
  placeholder?: string;
  condition?: (answers: any, mode: string) => boolean;
}

const MORNING_QUESTIONS: Question[] = [
  { id: 'sleep', text: 'How many hours did you sleep?', type: 'number', min: 0, max: 24, placeholder: 'e.g. 7.5' },
  { id: 'mood', text: 'How do you feel this morning?', type: 'choice', options: [
      { value: 'happy', label: 'Happy', emoji: '😊' },
      { value: 'calm', label: 'Calm', emoji: '😌' },
      { value: 'tired', label: 'Tired', emoji: '🥱' },
      { value: 'anxious', label: 'Anxious', emoji: '😰' },
      { value: 'sad', label: 'Sad', emoji: '😢' },
  ]},
  { id: 'energy', text: 'Energy level?', type: 'choice', options: [
      { value: 'Very Low', label: 'Very Low', emoji: '🪫' },
      { value: 'Medium', label: 'Medium', emoji: '🔋' },
      { value: 'Excellent', label: 'Excellent', emoji: '⚡' },
  ]},
  { id: 'water', text: 'Did you drink water yet?', type: 'choice', options: [
      { value: 'yes', label: 'Yes', emoji: '💧' },
      { value: 'no', label: 'Not yet', emoji: '🏜️' },
  ]},
  { id: 'breakfast', text: 'Did you have breakfast?', type: 'choice', options: [
      { value: 'yes', label: 'Yes', emoji: '🍳' },
      { value: 'no', label: 'Skipped', emoji: '❌' },
  ]},
  { id: 'pcos_symptoms', text: 'Any PCOS symptoms today?', type: 'choice', condition: (a, mode) => mode === 'pcos', options: [
      { value: 'none', label: 'None', emoji: '✨' },
      { value: 'mild', label: 'Mild', emoji: '🤏' },
      { value: 'severe', label: 'Severe', emoji: '😣' },
  ]},
  { id: 'pregnancy_nausea', text: 'Experiencing morning sickness?', type: 'choice', condition: (a, mode) => mode === 'pregnancy', options: [
      { value: 'none', label: 'No', emoji: '😌' },
      { value: 'mild', label: 'A little', emoji: '🤢' },
      { value: 'severe', label: 'Yes, a lot', emoji: '🤮' },
  ]},
  { id: 'notes', text: 'Morning Journal (Optional)', type: 'text', placeholder: 'Any thoughts before starting the day?' },
];

const AFTERNOON_QUESTIONS: Question[] = [
  { id: 'water_so_far', text: 'Water intake so far (Liters)?', type: 'number', min: 0, max: 10, placeholder: 'e.g. 1.5' },
  { id: 'lunch', text: 'Have you had lunch?', type: 'choice', options: [
      { value: 'yes', label: 'Healthy lunch', emoji: '🥗' },
      { value: 'yes_heavy', label: 'Heavy lunch', emoji: '🍔' },
      { value: 'no', label: 'Not yet', emoji: '🕒' },
  ]},
  { id: 'exercise', text: 'Did you exercise today?', type: 'choice', options: [
      { value: 'yes', label: 'Yes', emoji: '🏃‍♀️' },
      { value: 'no', label: 'No', emoji: '🛋️' },
  ]},
  { id: 'stress', text: 'Current stress level?', type: 'slider', min: 1, max: 10 },
  { id: 'mood', text: 'Current mood?', type: 'choice', options: [
      { value: 'happy', label: 'Happy', emoji: '😊' },
      { value: 'focused', label: 'Focused', emoji: '🧠' },
      { value: 'stressed', label: 'Stressed', emoji: '😰' },
      { value: 'tired', label: 'Tired', emoji: '🥱' },
  ]},
  { id: 'energy', text: 'Energy level?', type: 'choice', options: [
      { value: 'high', label: 'High', emoji: '⚡' },
      { value: 'medium', label: 'Medium', emoji: '🔋' },
      { value: 'low', label: 'Crashing', emoji: '🪫' },
  ]},
  { id: 'notes', text: 'Afternoon Notes (Optional)', type: 'text', placeholder: 'How is your day going?' },
];

const EVENING_QUESTIONS: Question[] = [
  { id: 'dinner', text: 'Did you have dinner?', type: 'choice', options: [
      { value: 'light', label: 'Light dinner', emoji: '🥗' },
      { value: 'heavy', label: 'Heavy dinner', emoji: '🍝' },
      { value: 'no', label: 'Skipped', emoji: '❌' },
  ]},
  { id: 'activity', text: 'Any physical activity today?', type: 'choice', options: [
      { value: 'yes', label: 'Yes', emoji: '💪' },
      { value: 'no', label: 'Rest day', emoji: '🧘‍♀️' },
  ]},
  { id: 'skin', text: 'Skincare routine done?', type: 'choice', options: [
      { value: 'yes', label: 'Yes', emoji: '🧴' },
      { value: 'no', label: 'Skipped', emoji: '💤' },
  ]},
  { id: 'total_water', text: 'Total water intake (Liters)?', type: 'number', min: 0, max: 10, placeholder: 'e.g. 2.5' },
  { id: 'overall_mood', text: 'Overall mood today?', type: 'choice', options: [
      { value: 'great', label: 'Great', emoji: '🌟' },
      { value: 'okay', label: 'Okay', emoji: '👍' },
      { value: 'tough', label: 'Tough day', emoji: '🌧️' },
  ]},
  { id: 'health_rating', text: 'Rate your overall health today', type: 'slider', min: 1, max: 5 },
  { id: 'reflection', text: 'Evening Reflection (Optional)', type: 'text', placeholder: 'What went well today?' },
];

function getCurrentSlot(): SlotType {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return 'morning';
  if (h >= 12 && h < 18) return 'afternoon';
  return 'evening';
}

export default function CheckInPage() {
  const router = useRouter();
  const { wellnessMode, refreshAll } = useHerSync();
  const activeSlot = getCurrentSlot();

  const [loading, setLoading] = useState(true);
  const [completedSlots, setCompletedSlots] = useState<Record<SlotType, { completed: boolean; completedAt: string | null; data: any }>>({
    morning:   { completed: false, completedAt: null, data: null },
    afternoon: { completed: false, completedAt: null, data: null },
    evening:   { completed: false, completedAt: null, data: null },
  });

  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await apiFetch('/api/v1/health/checkin-status');
      if (res.ok) {
        const { data } = await res.json();
        setCompletedSlots(data.slots);
      }
    } catch (err) {
      console.error('Error fetching checkin status', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  useEffect(() => {
    if (loading) return;
    
    let qList = activeSlot === 'morning' ? MORNING_QUESTIONS : activeSlot === 'afternoon' ? AFTERNOON_QUESTIONS : EVENING_QUESTIONS;
    qList = qList.filter(q => !q.condition || q.condition(answers, wellnessMode));
    
    // Initialize default values for sliders if not set
    const initialAnswers = { ...answers };
    let changed = false;
    qList.forEach(q => {
      if (q.type === 'slider' && initialAnswers[q.id] === undefined) {
        initialAnswers[q.id] = Math.floor((q.min! + q.max!) / 2);
        changed = true;
      }
    });
    
    if (changed) setAnswers(initialAnswers);
    setQuestions(qList);
    
  }, [loading, activeSlot, wellnessMode, answers]);

  const handleAnswerChange = (questionId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const isFormComplete = questions.every(q => {
    if (q.type === 'text') return true; // text fields are optional
    return answers[q.id] !== undefined && answers[q.id] !== '';
  });

  const submitCheckin = async () => {
    if (!isFormComplete) {
      toast.error('Please answer all required questions.');
      return;
    }
    
    setSaving(true);
    try {
      const res = await apiFetch('/api/v1/health/checkin', { 
        method: 'POST', 
        body: JSON.stringify({ slot: activeSlot, data: answers }) 
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error('Failed to save check-in', { description: result.message });
        setSaving(false);
        return;
      }
      
      const now = new Date().toISOString();
      setCompletedSlots(prev => ({ ...prev, [activeSlot]: { completed: true, completedAt: now, data: answers } }));
      toast.success(`${activeSlot} check-in completed!`);
      await refreshAll();
    } catch (err: any) {
      toast.error('Network Error', { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
      </div>
    );
  }

  const isCurrentSlotCompleted = completedSlots[activeSlot].completed;

  if (isCurrentSlotCompleted) {
    return (
      <div className="max-w-2xl mx-auto w-full pt-8 px-4 pb-24">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center text-center p-10 bg-card/80 backdrop-blur-md border border-border/40 rounded-3xl shadow-xl shadow-emerald-500/5"
        >
          <div className="w-24 h-24 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6">
            <CheckCircle2 className="w-12 h-12 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold text-emerald-500 mb-2 capitalize">{activeSlot} Check-in Complete!</h2>
          <p className="text-muted-foreground mb-8 text-lg">
            Completed at {format(new Date(completedSlots[activeSlot].completedAt!), 'h:mm a')}.<br/>
            Your wellness plan has been updated.
          </p>
          <button 
            onClick={() => router.push('/dashboard')} 
            className="px-8 py-3.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold shadow-lg shadow-emerald-500/20 transition-all hover:scale-105"
          >
            Return to Dashboard
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto w-full pt-4 md:pt-8 px-4 pb-32">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-2 capitalize bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-violet-500">
            {activeSlot} Check-in
          </h1>
          <p className="text-muted-foreground flex items-center gap-2 font-medium">
            <Sparkles className="w-4 h-4 text-violet-400" />
            Taking a moment for yourself
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <AnimatePresence>
          {questions.map((q, idx) => (
            <motion.div 
              key={q.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-card/60 backdrop-blur-md border border-border/50 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <h3 className="text-lg font-semibold mb-4 text-foreground/90">{q.text}</h3>
              
              {q.type === 'choice' && (
                <div className="flex flex-wrap gap-3">
                  {q.options?.map(opt => {
                    const isSelected = answers[q.id] === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => handleAnswerChange(q.id, opt.value)}
                        className={`flex items-center gap-2 px-5 py-3 rounded-2xl border-2 font-medium transition-all duration-200 ${
                          isSelected 
                            ? 'border-pink-500 bg-pink-500/10 text-pink-600 shadow-md shadow-pink-500/10 scale-[1.02]' 
                            : 'border-border/50 bg-secondary/50 text-muted-foreground hover:bg-secondary hover:border-pink-500/30'
                        }`}
                      >
                        {opt.emoji && <span className="text-xl drop-shadow-sm">{opt.emoji}</span>}
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              )}

              {q.type === 'slider' && (
                <div className="px-2 pt-2 pb-4 space-y-6">
                  <input 
                    type="range" min={q.min} max={q.max} 
                    value={answers[q.id] || q.min} 
                    onChange={e => handleAnswerChange(q.id, parseInt(e.target.value))}
                    className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-violet-500"
                  />
                  <div className="flex justify-between items-center text-sm font-semibold">
                    <span className="text-muted-foreground">Low ({q.min})</span>
                    <span className="text-3xl font-black text-violet-500 drop-shadow-sm">{answers[q.id] || q.min}</span>
                    <span className="text-muted-foreground">High ({q.max})</span>
                  </div>
                </div>
              )}

              {q.type === 'number' && (
                <div className="flex items-center gap-3">
                  <input 
                    type="number" min={q.min} max={q.max} step="0.5"
                    placeholder={q.placeholder}
                    value={answers[q.id] || ''} 
                    onChange={e => handleAnswerChange(q.id, parseFloat(e.target.value) || '')}
                    className="w-full max-w-[200px] bg-secondary/30 border-2 border-border/50 rounded-2xl px-5 py-3 text-lg font-semibold outline-none focus:border-pink-500 focus:bg-background transition-all"
                  />
                </div>
              )}

              {q.type === 'text' && (
                <div>
                  <textarea 
                    placeholder={q.placeholder}
                    value={answers[q.id] || ''} 
                    onChange={e => handleAnswerChange(q.id, e.target.value)}
                    rows={3}
                    className="w-full bg-secondary/30 border-2 border-border/50 rounded-2xl px-5 py-3 text-base outline-none focus:border-pink-500 focus:bg-background transition-all resize-none"
                  />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-[80px] md:bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-xl border-t border-border/50 flex justify-center z-50">
        <div className="w-full max-w-2xl flex items-center justify-between gap-4">
          <div className="text-sm font-medium text-muted-foreground hidden sm:block">
            {isFormComplete ? <span className="text-emerald-500 flex items-center gap-1"><CheckCircle2 className="w-4 h-4"/> Ready to save</span> : 'Complete all fields'}
          </div>
          <button 
            onClick={submitCheckin}
            disabled={saving || !isFormComplete}
            className="flex-1 sm:flex-none w-full sm:w-auto px-8 py-3.5 rounded-full bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-600 hover:to-violet-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold shadow-lg shadow-pink-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 text-lg"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            {saving ? 'Saving...' : 'Save Check-in'}
          </button>
        </div>
      </div>
    </div>
  );
}
