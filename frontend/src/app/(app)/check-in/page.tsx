'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { createClient } from '@/utils/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { Smile, Moon, Droplet, Dumbbell, Activity, ShieldAlert, Sparkles } from 'lucide-react';
import { format } from 'date-fns';

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
  const [entries, setEntries] = useLocalStorage<Record<string, CheckInFormValues>>('hersync_checkins', {});
  const today = format(new Date(), 'yyyy-MM-dd');

  const currentValues = entries[today] || {
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
  };

  const { register, handleSubmit, setValue, watch, reset } = useForm<CheckInFormValues>({
    resolver: zodResolver(checkInSchema),
    defaultValues: currentValues,
  });

  // Sync loaded entries into the form when localStorage resolves
  useEffect(() => {
    if (entries[today]) {
      reset(entries[today]);
    }
  }, [entries, today, reset]);

  // Keep fields watched for state displays
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
    setEntries({ ...entries, [today]: data });
    
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase
          .from('daily_logs')
          .upsert({
            user_id: user.id,
            log_date: today,
            mood: data.mood,
            sleep: data.sleep,
            water: data.water,
            exercise: data.exercise,
            stress: data.stress,
            acne: data.acne,
            hair_fall: data.hairFall,
            bloating: data.bloating,
            fatigue: data.fatigue,
            cramps: data.cramps,
            notes: data.notes || null
          }, {
            onConflict: 'user_id, log_date'
          });

        if (error) throw error;
      }
      toast.success('Habits logged successfully!', {
        description: 'Your wellness factors are saved for today.'
      });
    } catch (err) {
      console.error('Failed to sync check-in to Supabase:', err);
      toast.success('Habits logged locally! Sync to database pending.');
    }
  };

  // Stepper utility functions
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

  return (
    <div className="max-w-md mx-auto space-y-6 pb-24 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-1">Daily Log</h1>
        <p className="text-xs text-muted-foreground">Log your status for: <span className="font-semibold text-pink-500">{new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span></p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        
        {/* 1. Mood Selection */}
        <Card className="border-border/40 bg-card/60 backdrop-blur-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <Smile className="w-4.5 h-4.5 text-pink-500" /> {"How's your mood today?"}
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
                        ? 'bg-pink-500/10 border-pink-500 text-pink-500 font-semibold scale-[1.03] shadow-xs' 
                        : 'border-border/40 hover:bg-secondary/40 text-muted-foreground'
                    }`}
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
        <Card className="border-border/40 bg-card/60 backdrop-blur-xs">
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
        <Card className="border-border/40 bg-card/60 backdrop-blur-xs">
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
        <Card className="border-border/40 bg-card/60 backdrop-blur-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <ShieldAlert className="w-4.5 h-4.5 text-pink-500" /> Physical Symptoms
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
          className="w-full h-12 rounded-full bg-gradient-to-r from-pink-600 to-violet-600 hover:from-pink-500 hover:to-violet-500 text-white font-medium text-sm flex items-center justify-center gap-1 transition-transform active:scale-98"
        >
          Save Log
        </Button>
      </form>
    </div>
  );
}
