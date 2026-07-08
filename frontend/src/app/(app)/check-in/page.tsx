'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Smile, Moon, Droplet, Dumbbell, Activity, ShieldAlert, Sparkles, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { useHerSync } from '@/context/HerSyncContext';

const checkInSchema = z.object({
  mood: z.string().min(1, 'Mood is required'),
  sleep: z.number().min(0).max(24),
  water: z.number().min(0).max(10),
  exercise: z.number().min(0).max(360),
  stress: z.number().min(1).max(10),
  acne: z.number().min(1).max(10),
  hairFall: z.string(),
  bloating: z.string(),
  fatigue: z.string(),
  cramps: z.string(),
  notes: z.string().optional(),
});

type CheckInFormValues = z.infer<typeof checkInSchema>;

const MOODS = [
  { value: 'happy', emoji: '😊', label: 'Happy' },
  { value: 'calm', emoji: '😌', label: 'Calm' },
  { value: 'anxious', emoji: '😰', label: 'Anxious' },
  { value: 'sad', emoji: '😢', label: 'Sad' },
  { value: 'angry', emoji: '😠', label: 'Angry' },
  { value: 'mood_swings', emoji: '🎢', label: 'Swings' },
];

const SYMPTOM_SEVERITIES = ['none', 'mild', 'moderate', 'severe'];

export default function CheckInPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const { refreshAll } = useHerSync();
  
  const today = format(new Date(), 'yyyy-MM-dd');
  const supabase = createClient();
  const router = useRouter();

  const { register, handleSubmit, setValue, watch, reset } = useForm<CheckInFormValues>({
    resolver: zodResolver(checkInSchema),
    defaultValues: {
      mood: 'calm',
      sleep: 7.0,
      water: 2.0,
      exercise: 30,
      stress: 5,
      acne: 3,
      hairFall: 'none',
      bloating: 'none',
      fatigue: 'none',
      cramps: 'none',
      notes: '',
    },
  });

  useEffect(() => {
    async function fetchTodayData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/login');
          return;
        }
        setUserId(user.id);

        const [
          { data: sleepData },
          { data: waterData },
          { data: exerciseData },
          { data: moodData },
          { data: checkinData },
          { data: skinData }
        ] = await Promise.all([
          supabase.from('sleep_logs').select('*').eq('user_id', user.id).eq('date', today).single(),
          supabase.from('water_logs').select('*').eq('user_id', user.id).eq('date', today).single(),
          supabase.from('exercise_logs').select('*').eq('user_id', user.id).eq('date', today).single(),
          supabase.from('mood_logs').select('*').eq('user_id', user.id).eq('date', today).single(),
          supabase.from('daily_checkins').select('*').eq('user_id', user.id).eq('date', today).single(),
          supabase.from('skin_logs').select('*').eq('user_id', user.id).eq('date', today).single()
        ]);

        const formValues: any = {
          sleep: sleepData ? sleepData.duration_hours : 7.0,
          water: waterData ? waterData.amount_ml / 1000 : 2.0,
          exercise: exerciseData ? exerciseData.duration_minutes : 30,
          mood: moodData ? moodData.mood : 'calm',
          stress: moodData ? moodData.intensity : 5,
          notes: checkinData ? checkinData.summary : '',
          acne: skinData && skinData.condition ? Number(skinData.condition) : 3,
          hairFall: 'none',
          bloating: 'none',
          fatigue: 'none',
          cramps: 'none'
        };

        reset(formValues);
      } catch (err) {
        console.error("No existing data for today or error fetching");
      } finally {
        setLoading(false);
      }
    }
    fetchTodayData();
  }, [supabase, today, router, reset]);

  const watchedMood = watch('mood');
  const watchedSleep = watch('sleep');
  const watchedWater = watch('water');
  const watchedExercise = watch('exercise');
  const watchedStress = watch('stress');
  const watchedAcne = watch('acne');
  const watchedHairFall = watch('hairFall');
  const watchedBloating = watch('bloating');
  const watchedFatigue = watch('fatigue');
  const watchedCramps = watch('cramps');

  const onSubmit = async (data: CheckInFormValues) => {
    if (!userId) return;
    setSaving(true);
    
    try {
      await Promise.all([
        supabase.from('daily_checkins').upsert({ user_id: userId, date: today, summary: data.notes }, { onConflict: 'user_id,date' }),
        supabase.from('mood_logs').upsert({ user_id: userId, date: today, mood: data.mood, intensity: data.stress }, { onConflict: 'id' }),
        supabase.from('sleep_logs').upsert({ user_id: userId, date: today, duration_hours: data.sleep }, { onConflict: 'id' }),
        supabase.from('water_logs').upsert({ user_id: userId, date: today, amount_ml: Math.round(data.water * 1000) }, { onConflict: 'id' }),
        supabase.from('exercise_logs').upsert({ user_id: userId, date: today, duration_minutes: data.exercise, type: 'General' }, { onConflict: 'id' }),
        supabase.from('skin_logs').upsert({ user_id: userId, date: today, condition: String(data.acne) }, { onConflict: 'id' })
      ]);

      toast.success('Habits logged successfully!', {
        description: 'Your wellness data is now synced across all modules.'
      });
      // Broadcast to all connected modules: Dashboard, Reports, Wellness Plan, AI Companion
      await refreshAll();
    } catch (err: any) {
      toast.error('Failed to save log', { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const adjustSleep = (amount: number) => {
    const nextVal = Math.max(0, Math.min(24, Math.round((watchedSleep + amount) * 2) / 2));
    setValue('sleep', nextVal);
  };

  const adjustWater = (amount: number) => {
    const nextVal = Math.max(0, Math.min(10, Math.round((watchedWater + amount) * 4) / 4));
    setValue('water', nextVal);
  };

  const adjustExercise = (amount: number) => {
    const nextVal = Math.max(0, Math.min(360, watchedExercise + amount));
    setValue('exercise', nextVal);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-6 pb-24 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-1">Daily Log</h1>
        <p className="text-xs text-muted-foreground">Log your status for: <span className="font-semibold" style={{ color: 'var(--hs-pink)' }}>{new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span></p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        
        {/* 1. Mood Selection */}
        <Card className="border-border/40 bg-card/60 backdrop-blur-xs shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <Smile className="w-4.5 h-4.5" style={{ color: 'var(--hs-pink)' }} /> {"How's your mood today?"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              {MOODS.map((m) => {
                const isActive = watchedMood === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setValue('mood', m.value)}
                    className={`h-16 flex flex-col items-center justify-center rounded-xl border text-center transition-all ${
                      isActive 
                        ? 'font-semibold scale-[1.03] shadow-xs' 
                        : 'border-border/40 hover:bg-secondary/40 text-muted-foreground'
                    }`}
                    style={isActive ? { background: 'var(--hs-glow-pink)', borderColor: 'var(--hs-pink)', color: 'var(--hs-pink)' } : {}}
                  >
                    <span className="text-xl mb-0.5">{m.emoji}</span>
                    <span className="text-[10px]">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* 2. Stepper Trackers (Sleep, Water, Exercise) */}
        <Card className="border-border/40 bg-card/60 backdrop-blur-xs shadow-sm">
          <CardContent className="pt-6 space-y-6">
            
            {/* Sleep Counter */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold flex items-center gap-1.5">
                  <Moon className="w-4 h-4 text-blue-400" /> Sleep Duration
                </span>
                <p className="text-[10px] text-muted-foreground">Hours of rest</p>
              </div>
              <div className="flex items-center gap-3 bg-secondary/20 p-1.5 rounded-full border border-border/30">
                <button
                  type="button"
                  onClick={() => adjustSleep(-0.5)}
                  className="w-10 h-10 rounded-full flex items-center justify-center bg-background border border-border/50 text-foreground active:scale-90 font-bold transition-transform text-sm"
                >
                  -
                </button>
                <span className="w-12 text-center text-sm font-bold">{watchedSleep.toFixed(1)}h</span>
                <button
                  type="button"
                  onClick={() => adjustSleep(0.5)}
                  className="w-10 h-10 rounded-full flex items-center justify-center bg-background border border-border/50 text-foreground active:scale-90 font-bold transition-transform text-sm"
                >
                  +
                </button>
              </div>
            </div>

            {/* Water Counter */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold flex items-center gap-1.5">
                  <Droplet className="w-4 h-4 text-cyan-400" /> Hydration
                </span>
                <p className="text-[10px] text-muted-foreground">Liters of water</p>
              </div>
              <div className="flex items-center gap-3 bg-secondary/20 p-1.5 rounded-full border border-border/30">
                <button
                  type="button"
                  onClick={() => adjustWater(-0.25)}
                  className="w-10 h-10 rounded-full flex items-center justify-center bg-background border border-border/50 text-foreground active:scale-90 font-bold transition-transform text-sm"
                >
                  -
                </button>
                <span className="w-12 text-center text-sm font-bold">{watchedWater.toFixed(2)}L</span>
                <button
                  type="button"
                  onClick={() => adjustWater(0.25)}
                  className="w-10 h-10 rounded-full flex items-center justify-center bg-background border border-border/50 text-foreground active:scale-90 font-bold transition-transform text-sm"
                >
                  +
                </button>
              </div>
            </div>

            {/* Exercise Counter */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold flex items-center gap-1.5">
                  <Dumbbell className="w-4 h-4 text-emerald-400" /> Movement
                </span>
                <p className="text-[10px] text-muted-foreground">Active minutes</p>
              </div>
              <div className="flex items-center gap-3 bg-secondary/20 p-1.5 rounded-full border border-border/30">
                <button
                  type="button"
                  onClick={() => adjustExercise(-5)}
                  className="w-10 h-10 rounded-full flex items-center justify-center bg-background border border-border/50 text-foreground active:scale-90 font-bold transition-transform text-sm"
                >
                  -
                </button>
                <span className="w-12 text-center text-sm font-bold">{watchedExercise}m</span>
                <button
                  type="button"
                  onClick={() => adjustExercise(5)}
                  className="w-10 h-10 rounded-full flex items-center justify-center bg-background border border-border/50 text-foreground active:scale-90 font-bold transition-transform text-sm"
                >
                  +
                </button>
              </div>
            </div>

          </CardContent>
        </Card>

        {/* 3. Sliders for Stress & Acne */}
        <Card className="border-border/40 bg-card/60 backdrop-blur-xs shadow-sm">
          <CardContent className="pt-6 space-y-6">
            {/* Stress Counter */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-violet-400" /> Stress Intensity
                </span>
                <p className="text-[10px] text-muted-foreground">Scale of 1-10</p>
              </div>
              <div className="flex items-center gap-3 bg-secondary/20 p-1.5 rounded-full border border-border/30">
                <button
                  type="button"
                  onClick={() => setValue('stress', Math.max(1, (watchedStress || 5) - 1))}
                  className="w-10 h-10 rounded-full flex items-center justify-center bg-background border border-border/50 text-foreground active:scale-90 font-bold transition-transform text-sm"
                >
                  -
                </button>
                <span className="w-8 text-center text-sm font-bold">{watchedStress || 5}</span>
                <button
                  type="button"
                  onClick={() => setValue('stress', Math.min(10, (watchedStress || 5) + 1))}
                  className="w-10 h-10 rounded-full flex items-center justify-center bg-background border border-border/50 text-foreground active:scale-90 font-bold transition-transform text-sm"
                >
                  +
                </button>
              </div>
            </div>

            {/* Acne Counter */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400" /> Acne Severity
                </span>
                <p className="text-[10px] text-muted-foreground">Scale of 1-10</p>
              </div>
              <div className="flex items-center gap-3 bg-secondary/20 p-1.5 rounded-full border border-border/30">
                <button
                  type="button"
                  onClick={() => setValue('acne', Math.max(1, (watchedAcne || 3) - 1))}
                  className="w-10 h-10 rounded-full flex items-center justify-center bg-background border border-border/50 text-foreground active:scale-90 font-bold transition-transform text-sm"
                >
                  -
                </button>
                <span className="w-8 text-center text-sm font-bold">{watchedAcne || 3}</span>
                <button
                  type="button"
                  onClick={() => setValue('acne', Math.min(10, (watchedAcne || 3) + 1))}
                  className="w-10 h-10 rounded-full flex items-center justify-center bg-background border border-border/50 text-foreground active:scale-90 font-bold transition-transform text-sm"
                >
                  +
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 4. Symptoms Segmented Pills */}
        <Card className="border-border/40 bg-card/60 backdrop-blur-xs shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <ShieldAlert className="w-4.5 h-4.5" style={{ color: 'var(--hs-pink)' }} /> Physical Symptoms
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            
            {/* Cramps */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Cramps</Label>
              <div className="grid grid-cols-4 gap-1 bg-secondary/25 p-1 rounded-lg">
                {SYMPTOM_SEVERITIES.map((sev) => {
                  const isActive = watchedCramps === sev;
                  return (
                    <button
                      key={sev}
                      type="button"
                      onClick={() => setValue('cramps', sev)}
                      className={`py-1.5 text-[10px] font-semibold rounded-md uppercase transition-all ${
                        isActive 
                          ? 'bg-pink-600 text-white shadow-xs' 
                          : 'text-muted-foreground hover:bg-secondary/40'
                      }`}
                    >
                      {sev}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bloating */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Bloating</Label>
              <div className="grid grid-cols-4 gap-1 bg-secondary/25 p-1 rounded-lg">
                {SYMPTOM_SEVERITIES.map((sev) => {
                  const isActive = watchedBloating === sev;
                  return (
                    <button
                      key={sev}
                      type="button"
                      onClick={() => setValue('bloating', sev)}
                      className={`py-1.5 text-[10px] font-semibold rounded-md uppercase transition-all ${
                        isActive 
                          ? 'text-white shadow-xs' 
                          : 'text-muted-foreground hover:bg-secondary/40'
                      }`}
                      style={isActive ? { background: 'var(--hs-pink)' } : {}}
                    >
                      {sev}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Fatigue */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Fatigue</Label>
              <div className="grid grid-cols-4 gap-1 bg-secondary/25 p-1 rounded-lg">
                {SYMPTOM_SEVERITIES.map((sev) => {
                  const isActive = watchedFatigue === sev;
                  return (
                    <button
                      key={sev}
                      type="button"
                      onClick={() => setValue('fatigue', sev)}
                      className={`py-1.5 text-[10px] font-semibold rounded-md uppercase transition-all ${
                        isActive 
                          ? 'text-white shadow-xs' 
                          : 'text-muted-foreground hover:bg-secondary/40'
                      }`}
                      style={isActive ? { background: 'var(--hs-pink)' } : {}}
                    >
                      {sev}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Hair Fall */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Hair Fall</Label>
              <div className="grid grid-cols-4 gap-1 bg-secondary/25 p-1 rounded-lg">
                {SYMPTOM_SEVERITIES.map((sev) => {
                  const isActive = watchedHairFall === sev;
                  return (
                    <button
                      key={sev}
                      type="button"
                      onClick={() => setValue('hairFall', sev)}
                      className={`py-1.5 text-[10px] font-semibold rounded-md uppercase transition-all ${
                        isActive 
                          ? 'text-white shadow-xs' 
                          : 'text-muted-foreground hover:bg-secondary/40'
                      }`}
                      style={isActive ? { background: 'var(--hs-pink)' } : {}}
                    >
                      {sev}
                    </button>
                  );
                })}
              </div>
            </div>

          </CardContent>
        </Card>

        {/* Notes */}
        <div className="space-y-1.5">
          <Label htmlFor="notes" className="text-xs font-semibold">Additional Notes</Label>
          <Textarea 
            id="notes" 
            placeholder="Any custom comments or observations..." 
            className="text-xs rounded-xl bg-card border-border/40 focus-visible:ring-pink-500 min-h-[70px]"
            {...register('notes')} 
          />
        </div>

        {/* Submit */}
        <Button 
          type="submit" 
          disabled={saving}
          className="w-full h-12 rounded-xl text-white font-medium text-sm flex items-center justify-center gap-1 transition-transform active:scale-98 shadow-md"
          style={{ background: 'linear-gradient(135deg, var(--hs-violet), var(--hs-pink))' }}
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Log'}
        </Button>
      </form>
    </div>
  );
}
