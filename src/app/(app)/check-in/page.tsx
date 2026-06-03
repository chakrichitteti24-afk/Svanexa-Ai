'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const checkInSchema = z.object({
  mood: z.string().min(1, 'Mood is required'),
  sleep: z.coerce.number().min(0).max(24),
  water: z.coerce.number().min(0),
  exercise: z.coerce.number().min(0),
  stress: z.number().min(1).max(10),
  acne: z.number().min(1).max(10),
  hairFall: z.string(),
  bloating: z.string(),
  fatigue: z.string(),
  cramps: z.string(),
  notes: z.string().optional(),
});

type CheckInFormValues = z.infer<typeof checkInSchema>;

export default function CheckInPage() {
  const [entries, setEntries] = useLocalStorage<Record<string, CheckInFormValues>>('hersync_checkins', {});
  const today = new Date().toISOString().split('T')[0];

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<any>({
    resolver: zodResolver(checkInSchema),
    defaultValues: entries[today] || {
      mood: '',
      sleep: 7,
      water: 2,
      exercise: 30,
      stress: 5,
      acne: 1,
      hairFall: 'none',
      bloating: 'none',
      fatigue: 'none',
      cramps: 'none',
      notes: '',
    },
  });

  const onSubmit = (data: CheckInFormValues) => {
    setEntries({ ...entries, [today]: data });
    toast.success('Check-in saved successfully!', {
      description: 'Your wellness data for today has been updated.'
    });
  };

  const stressVal = watch('stress') || 5;
  const acneVal = watch('acne') || 1;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Daily Check-In</h1>
        <p className="text-muted-foreground">Log your symptoms and lifestyle to find patterns.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Today's Entry ({today})</CardTitle>
          <CardDescription>All data is saved locally on your device.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Mood */}
              <div className="space-y-2">
                <Label htmlFor="mood">Mood</Label>
                <Select onValueChange={(val) => setValue('mood', val)} defaultValue={watch('mood')}>
                  <SelectTrigger>
                    <SelectValue placeholder="How are you feeling?" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="happy">Happy 😊</SelectItem>
                    <SelectItem value="calm">Calm 😌</SelectItem>
                    <SelectItem value="anxious">Anxious 😰</SelectItem>
                    <SelectItem value="sad">Sad 😢</SelectItem>
                    <SelectItem value="angry">Angry 😠</SelectItem>
                    <SelectItem value="mood_swings">Mood Swings 🎢</SelectItem>
                  </SelectContent>
                </Select>
                {errors.mood && <p className="text-red-500 text-sm">{errors.mood?.message as string}</p>}
              </div>

              {/* Sleep */}
              <div className="space-y-2">
                <Label htmlFor="sleep">Sleep (Hours)</Label>
                <Input id="sleep" type="number" step="0.5" {...register('sleep')} />
              </div>

              {/* Water */}
              <div className="space-y-2">
                <Label htmlFor="water">Water Intake (Liters)</Label>
                <Input id="water" type="number" step="0.1" {...register('water')} />
              </div>

              {/* Exercise */}
              <div className="space-y-2">
                <Label htmlFor="exercise">Exercise (Minutes)</Label>
                <Input id="exercise" type="number" {...register('exercise')} />
              </div>
            </div>

            <div className="space-y-6">
              {/* Stress Slider */}
              <div className="space-y-4">
                <div className="flex justify-between">
                  <Label>Stress Level: {stressVal}/10</Label>
                </div>
                <Slider 
                  min={1} max={10} step={1} 
                  value={[stressVal]} 
                  onValueChange={(val: any) => setValue('stress', val[0])} 
                />
              </div>

              {/* Acne Slider */}
              <div className="space-y-4">
                <div className="flex justify-between">
                  <Label>Acne Severity: {acneVal}/10</Label>
                </div>
                <Slider 
                  min={1} max={10} step={1} 
                  value={[acneVal]} 
                  onValueChange={(val: any) => setValue('acne', val[0])} 
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Hair Fall */}
              <div className="space-y-2">
                <Label>Hair Fall</Label>
                <Select onValueChange={(val) => setValue('hairFall', val)} defaultValue={watch('hairFall')}>
                  <SelectTrigger><SelectValue placeholder="Select severity" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="mild">Mild</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="severe">Severe</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Bloating */}
              <div className="space-y-2">
                <Label>Bloating</Label>
                <Select onValueChange={(val) => setValue('bloating', val)} defaultValue={watch('bloating')}>
                  <SelectTrigger><SelectValue placeholder="Select severity" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="mild">Mild</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="severe">Severe</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Fatigue */}
              <div className="space-y-2">
                <Label>Fatigue</Label>
                <Select onValueChange={(val) => setValue('fatigue', val)} defaultValue={watch('fatigue')}>
                  <SelectTrigger><SelectValue placeholder="Select severity" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="mild">Mild</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="severe">Severe</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Cramps */}
              <div className="space-y-2">
                <Label>Cramps</Label>
                <Select onValueChange={(val) => setValue('cramps', val)} defaultValue={watch('cramps')}>
                  <SelectTrigger><SelectValue placeholder="Select severity" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="mild">Mild</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="severe">Severe</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea id="notes" placeholder="Any specific symptoms or feelings today?" {...register('notes')} />
            </div>

            <Button type="submit" className="w-full bg-gradient-to-r from-pink-600 to-violet-600 hover:from-pink-500 hover:to-violet-500 text-white">
              Save Entry
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
