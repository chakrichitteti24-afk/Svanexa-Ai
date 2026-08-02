'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { BrainCircuit, CheckCircle2, ChevronRight, Loader2, Sparkles, Send } from 'lucide-react';
import { format } from 'date-fns';
import { useHerSync } from '@/context/HerSyncContext';
import { apiFetch } from '@/utils/api-client';
import Image from 'next/image';

type SlotType = 'morning' | 'afternoon' | 'evening';

// ── Conversational Wizard Types ──
type QuestionType = 'choice' | 'slider' | 'text' | 'number';

interface Question {
  id: string;
  text: string;
  type: QuestionType;
  options?: { value: string | number; label: string; emoji?: string }[];
  min?: number;
  max?: number;
  placeholder?: string;
  condition?: (answers: any, mode: string) => boolean; // Only show if condition met
}

const MORNING_QUESTIONS: Question[] = [
  { id: 'sleep', text: 'Good morning! How many hours did you sleep last night?', type: 'number', min: 0, max: 24, placeholder: 'e.g. 7.5' },
  { id: 'mood', text: 'How do you feel after waking up?', type: 'choice', options: [
      { value: 'happy', label: 'Happy', emoji: '😊' },
      { value: 'calm', label: 'Calm', emoji: '😌' },
      { value: 'tired', label: 'Tired', emoji: '🥱' },
      { value: 'anxious', label: 'Anxious', emoji: '😰' },
      { value: 'sad', label: 'Sad', emoji: '😢' },
  ]},
  { id: 'energy', text: 'What is your energy level right now?', type: 'choice', options: [
      { value: 'Very Low', label: 'Very Low', emoji: '🪫' },
      { value: 'Medium', label: 'Medium', emoji: '🔋' },
      { value: 'Excellent', label: 'Excellent', emoji: '⚡' },
  ]},
  { id: 'water', text: 'Did you drink water after waking up?', type: 'choice', options: [
      { value: 'yes', label: 'Yes', emoji: '💧' },
      { value: 'no', label: 'Not yet', emoji: '🏜️' },
  ]},
  { id: 'breakfast', text: 'Did you have breakfast?', type: 'choice', options: [
      { value: 'yes', label: 'Yes', emoji: '🍳' },
      { value: 'no', label: 'Skipped it', emoji: '❌' },
  ]},
  { id: 'pcos_symptoms', text: 'Are you experiencing any PCOS symptoms today (bloating, cramps, acne)?', type: 'choice', condition: (a, mode) => mode === 'pcos', options: [
      { value: 'none', label: 'None', emoji: '✨' },
      { value: 'mild', label: 'Mild', emoji: '🤏' },
      { value: 'severe', label: 'Severe', emoji: '😣' },
  ]},
  { id: 'pregnancy_nausea', text: 'Experiencing any morning sickness or nausea?', type: 'choice', condition: (a, mode) => mode === 'pregnancy', options: [
      { value: 'none', label: 'No', emoji: '😌' },
      { value: 'mild', label: 'A little', emoji: '🤢' },
      { value: 'severe', label: 'Yes, a lot', emoji: '🤮' },
  ]},
  { id: 'notes', text: 'Anything else you\'d like to tell me before we start the day?', type: 'text', placeholder: 'Journal your thoughts...' },
];

const AFTERNOON_QUESTIONS: Question[] = [
  { id: 'water_so_far', text: 'Good afternoon! How many liters of water have you had so far today?', type: 'number', min: 0, max: 10, placeholder: 'e.g. 1.5' },
  { id: 'lunch', text: 'Have you had lunch?', type: 'choice', options: [
      { value: 'yes', label: 'Yes, healthy', emoji: '🥗' },
      { value: 'yes_heavy', label: 'Yes, heavy', emoji: '🍔' },
      { value: 'no', label: 'Not yet', emoji: '🕒' },
  ]},
  { id: 'exercise', text: 'Did you exercise or take a walk?', type: 'choice', options: [
      { value: 'yes', label: 'Yes', emoji: '🏃‍♀️' },
      { value: 'no', label: 'Not yet', emoji: '🛋️' },
  ]},
  { id: 'stress', text: 'How is your stress level right now?', type: 'slider', min: 1, max: 10 },
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
  { id: 'notes', text: 'Any afternoon notes?', type: 'text', placeholder: 'How is the day going?' },
];

const EVENING_QUESTIONS: Question[] = [
  { id: 'dinner', text: 'Good evening! Did you have dinner?', type: 'choice', options: [
      { value: 'light', label: 'Light dinner', emoji: '🥗' },
      { value: 'heavy', label: 'Heavy dinner', emoji: '🍝' },
      { value: 'no', label: 'Skipped', emoji: '❌' },
  ]},
  { id: 'activity', text: 'Did you complete any physical activity today?', type: 'choice', options: [
      { value: 'yes', label: 'Yes', emoji: '💪' },
      { value: 'no', label: 'Rest day', emoji: '🧘‍♀️' },
  ]},
  { id: 'skin', text: 'Did you complete your skincare routine?', type: 'choice', options: [
      { value: 'yes', label: 'Yes', emoji: '🧴' },
      { value: 'no', label: 'Skipped', emoji: '💤' },
  ]},
  { id: 'total_water', text: 'Total water intake today (Liters)?', type: 'number', min: 0, max: 10, placeholder: 'e.g. 2.5' },
  { id: 'overall_mood', text: 'Overall mood today?', type: 'choice', options: [
      { value: 'great', label: 'Great', emoji: '🌟' },
      { value: 'okay', label: 'Okay', emoji: '👍' },
      { value: 'tough', label: 'Tough day', emoji: '🌧️' },
  ]},
  { id: 'health_rating', text: 'Rate your overall health today (1-5 stars)', type: 'slider', min: 1, max: 5 },
  { id: 'reflection', text: 'Evening reflection: What went well today?', type: 'text', placeholder: 'Reflect on your day...' },
];

/** Returns which slot is active right now based on local time */
function getCurrentSlot(): SlotType {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return 'morning';
  if (h >= 12 && h < 18) return 'afternoon';
  return 'evening';
}

export default function ConversationalCheckInPage() {
  const router = useRouter();
  const { wellnessMode, aiName, refreshAll, allSlotsComplete } = useHerSync();
  const activeSlot = getCurrentSlot();

  const [loading, setLoading] = useState(true);
  const [completedSlots, setCompletedSlots] = useState<Record<SlotType, { completed: boolean; completedAt: string | null; data: any }>>({
    morning:   { completed: false, completedAt: null, data: null },
    afternoon: { completed: false, completedAt: null, data: null },
    evening:   { completed: false, completedAt: null, data: null },
  });

  // Conversation State
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [chatHistory, setChatHistory] = useState<{ role: 'ai' | 'user'; text: string; emoji?: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Temporary input state
  const [textInput, setTextInput] = useState('');
  const [numInput, setNumInput] = useState<number | ''>('');
  const [sliderInput, setSliderInput] = useState<number>(5);

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
    
    // Pick question list based on current active slot
    let qList = activeSlot === 'morning' ? MORNING_QUESTIONS : activeSlot === 'afternoon' ? AFTERNOON_QUESTIONS : EVENING_QUESTIONS;
    
    // Filter by conditions
    qList = qList.filter(q => !q.condition || q.condition(answers, wellnessMode));
    
    setQuestions(qList);
    
    if (qList.length > 0 && chatHistory.length === 0) {
      setChatHistory([{ role: 'ai', text: qList[0].text }]);
      if (qList[0].type === 'slider') setSliderInput(Math.floor((qList[0].min! + qList[0].max!) / 2));
    }
  }, [loading, activeSlot, wellnessMode, answers, chatHistory.length]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [chatHistory, currentQIdx]);

  const handleAnswer = (val: any, displayLabel: string, emoji?: string) => {
    if (currentQIdx >= questions.length) return;
    const currentQ = questions[currentQIdx];

    const newAnswers = { ...answers, [currentQ.id]: val };
    setAnswers(newAnswers);

    const newUserMsg = { role: 'user' as const, text: displayLabel, emoji };
    
    // Determine next question
    let nextIdx = currentQIdx + 1;
    let nextQList = (activeSlot === 'morning' ? MORNING_QUESTIONS : activeSlot === 'afternoon' ? AFTERNOON_QUESTIONS : EVENING_QUESTIONS)
      .filter(q => !q.condition || q.condition(newAnswers, wellnessMode));
    
    if (nextIdx < nextQList.length) {
      const nextQ = nextQList[nextIdx];
      setChatHistory(prev => [...prev, newUserMsg, { role: 'ai', text: nextQ.text }]);
      setCurrentQIdx(nextIdx);
      setTextInput('');
      setNumInput('');
      if (nextQ.type === 'slider') setSliderInput(Math.floor((nextQ.min! + nextQ.max!) / 2));
    } else {
      // Done
      setChatHistory(prev => [...prev, newUserMsg, { role: 'ai', text: "Thank you! Saving your check-in..." }]);
      submitCheckin(newAnswers);
    }
  };

  const submitCheckin = async (finalAnswers: any) => {
    setSaving(true);
    try {
      const res = await apiFetch('/api/v1/health/checkin', { method: 'POST', body: JSON.stringify({ slot: activeSlot, data: finalAnswers }) });
      const result = await res.json();
      if (!res.ok) {
        toast.error('Failed to save check-in', { description: result.message });
        setSaving(false);
        return;
      }
      
      const now = new Date().toISOString();
      setCompletedSlots(prev => ({ ...prev, [activeSlot]: { completed: true, completedAt: now, data: finalAnswers } }));
      toast.success(`${activeSlot} check-in completed!`);
      await refreshAll();
      
      setChatHistory(prev => [...prev, { role: 'ai', text: `All done! I've generated your ${activeSlot} wellness plan. Head back to the dashboard to see it!` }]);
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
  const avatarSrc = allSlotsComplete ? '/ai-companion-happy.jpg' : '/ai-companion-neutral.jpg';

  return (
    <div className="max-w-2xl mx-auto w-full h-[calc(100vh-8rem)] flex flex-col pt-4 md:pt-8">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight mb-1 capitalize">{activeSlot} Check-in</h1>
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-violet-400" />
          Guided by {aiName}
        </p>
      </div>

      {isCurrentSlotCompleted ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-card border border-border/40 rounded-2xl shadow-sm"
        >
          <div className="w-24 h-24 rounded-full overflow-hidden mb-6 border-4 border-emerald-500/20 shadow-lg relative">
            <Image src="/ai-companion-happy.jpg" alt={aiName} fill className="object-cover" />
          </div>
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-4" />
          <h2 className="text-xl font-bold text-emerald-500 mb-2">{activeSlot} Check-in Complete!</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Completed at {format(new Date(completedSlots[activeSlot].completedAt!), 'h:mm a')}.<br/>
            Your wellness plan has been updated.
          </p>
          <div className="flex gap-4">
             <button onClick={() => router.push('/dashboard')} className="px-6 py-2.5 rounded-full bg-violet-600 hover:bg-violet-700 text-white font-semibold text-sm transition-colors">
               Go to Dashboard
             </button>
          </div>
        </motion.div>
      ) : (
        <div className="flex-1 flex flex-col bg-card/60 backdrop-blur-sm border border-border/40 rounded-2xl shadow-sm overflow-hidden">
          {/* Chat Window */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6" ref={scrollRef}>
            <AnimatePresence initial={false}>
              {chatHistory.map((msg, i) => {
                const isUser = msg.role === 'user';
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex gap-3 max-w-[85%] ${isUser ? 'ml-auto flex-row-reverse' : ''}`}
                  >
                    {!isUser && (
                      <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 shadow-sm border border-violet-500/30">
                        <Image src={avatarSrc} alt={aiName} width={32} height={32} className="object-cover" />
                      </div>
                    )}
                    <div className={`p-3.5 rounded-2xl text-sm ${isUser ? 'bg-gradient-to-br from-violet-500 to-pink-500 text-white rounded-tr-sm' : 'bg-secondary/40 text-foreground rounded-tl-sm border border-border/30'}`}>
                      {msg.emoji && <span className="mr-2 text-lg">{msg.emoji}</span>}
                      {msg.text}
                    </div>
                  </motion.div>
                );
              })}
              {saving && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3 max-w-[85%]">
                  <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 shadow-sm border border-violet-500/30">
                    <Image src={avatarSrc} alt={aiName} width={32} height={32} className="object-cover" />
                  </div>
                  <div className="p-3.5 rounded-2xl text-sm bg-secondary/40 rounded-tl-sm border border-border/30 flex items-center gap-2 text-violet-400">
                    <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Input Area */}
          {!saving && questions[currentQIdx] && (
            <div className="p-4 bg-background/50 border-t border-border/40">
              {(() => {
                const q = questions[currentQIdx];
                if (q.type === 'choice') {
                  return (
                    <div className="flex flex-wrap gap-2">
                      {q.options?.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => handleAnswer(opt.value, opt.label, opt.emoji)}
                          className="px-4 py-2.5 rounded-full bg-secondary/50 hover:bg-violet-500/20 border border-border/50 hover:border-violet-500/50 text-sm font-medium transition-all flex items-center gap-2"
                        >
                          {opt.emoji && <span className="text-base">{opt.emoji}</span>}
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  );
                }
                
                if (q.type === 'slider') {
                  return (
                    <div className="space-y-4 px-2 pb-2">
                      <div className="flex justify-between text-xs text-muted-foreground font-semibold">
                        <span>Low ({q.min})</span>
                        <span className="text-lg text-violet-400 font-bold">{sliderInput}</span>
                        <span>High ({q.max})</span>
                      </div>
                      <input 
                        type="range" min={q.min} max={q.max} value={sliderInput} 
                        onChange={e => setSliderInput(parseInt(e.target.value))}
                        className="w-full accent-violet-500"
                      />
                      <button onClick={() => handleAnswer(sliderInput, sliderInput.toString())} className="w-full py-2.5 rounded-full bg-violet-600 hover:bg-violet-700 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2">
                        Continue <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  );
                }

                if (q.type === 'number') {
                  return (
                    <div className="flex gap-2">
                      <input 
                        type="number" min={q.min} max={q.max} step="0.5"
                        placeholder={q.placeholder}
                        value={numInput} onChange={e => setNumInput(parseFloat(e.target.value) || '')}
                        className="flex-1 bg-secondary/40 border border-border/50 rounded-full px-4 py-2.5 text-sm outline-none focus:border-violet-500"
                        onKeyDown={e => { if(e.key === 'Enter' && numInput !== '') handleAnswer(numInput, numInput.toString()) }}
                      />
                      <button 
                        onClick={() => handleAnswer(numInput, numInput.toString())} disabled={numInput === ''}
                        className="w-11 h-11 rounded-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white flex items-center justify-center flex-shrink-0 transition-colors"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  );
                }

                if (q.type === 'text') {
                  return (
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        placeholder={q.placeholder}
                        value={textInput} onChange={e => setTextInput(e.target.value)}
                        className="flex-1 bg-secondary/40 border border-border/50 rounded-full px-4 py-2.5 text-sm outline-none focus:border-violet-500"
                        onKeyDown={e => { if(e.key === 'Enter' && textInput.trim()) handleAnswer(textInput.trim(), textInput.trim()) }}
                      />
                      <button 
                        onClick={() => handleAnswer(textInput.trim(), textInput.trim())} disabled={!textInput.trim()}
                        className="w-11 h-11 rounded-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white flex items-center justify-center flex-shrink-0 transition-colors"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  );
                }
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
