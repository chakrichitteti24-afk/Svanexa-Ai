'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Sparkles, 
  Loader2, 
  Flame, 
  Trophy, 
  CheckCircle2, 
  Circle,
  Calendar,
  Lock,
  ArrowRight,
  Heart,
  Droplet,
  Moon,
  Smile,
  Activity,
  ShieldAlert,
  Sparkle,
  Dumbbell
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { apiFetch } from '@/utils/api-client';

interface Task {
  id: string;
  text: string;
  category: 'sleep' | 'stress' | 'mood' | 'cycle' | 'symptoms' | 'skin' | 'hydration' | 'exercise';
  completed: boolean;
  completedAt: string | null;
}

interface Streak {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
}

interface Plan {
  id: string;
  planDate: string;
  tasks: Task[];
}

export default function WellnessPlanPage() {
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [hasData, setHasData] = useState(false);
  const [logsCount, setLogsCount] = useState(0);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [streak, setStreak] = useState<Streak | null>(null);

  useEffect(() => {
    async function loadWellnessPlan() {
      try {
        const res = await apiFetch('/api/wellness-plan');
        if (res.ok) {
          const data = await res.json();
          setHasData(data.hasData);
          if (data.hasData) {
            setPlan(data.plan);
            setStreak(data.streak);
          } else {
            setLogsCount(data.logsCount || 0);
          }
        } else {
          toast.error('Failed to load wellness plan');
        }
      } catch (err) {
        console.error('Error fetching wellness plan:', err);
        toast.error('An error occurred while loading your plan.');
      } finally {
        setLoading(false);
      }
    }
    loadWellnessPlan();
  }, []);

  const handleToggleTask = async (taskId: string) => {
    if (!plan) return;
    setToggling(taskId);

    try {
      const res = await apiFetch('/api/wellness-plan', {
        method: 'POST',
        body: JSON.stringify({ planId: plan.id, taskId }),
      });

      if (res.ok) {
        const data = await res.json();
        
        // Optimistic toggle updates
        const updatedTasks = plan.tasks.map(t => {
          if (t.id === taskId) {
            const completed = !t.completed;
            return {
              ...t,
              completed,
              completedAt: completed ? new Date().toISOString() : null
            };
          }
          return t;
        });

        setPlan({ ...plan, tasks: updatedTasks });
        setStreak(data.streak);

        // Check if this action completed the final task
        const allCompletedBefore = plan.tasks.every(t => t.completed);
        const allCompletedAfter = updatedTasks.every(t => t.completed);

        if (allCompletedAfter && !allCompletedBefore) {
          toast.success('Congratulations! 🌟 Perfect day completed!', {
            description: 'Your wellness streak has been updated.'
          });
        } else {
          const toggledTask = plan.tasks.find(t => t.id === taskId);
          if (toggledTask && !toggledTask.completed) {
            toast.success('Task completed! Keep it up. 🌸');
          }
        }
      } else {
        toast.error('Failed to update task.');
      }
    } catch (err) {
      console.error('Error toggling task:', err);
      toast.error('Network error. Failed to save progress.');
    } finally {
      setToggling(null);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'sleep': return <Moon className="w-4 h-4 text-blue-400" />;
      case 'stress': return <Activity className="w-4 h-4 text-violet-400" />;
      case 'mood': return <Smile className="w-4 h-4 text-pink-400" />;
      case 'cycle': return <Heart className="w-4 h-4 text-rose-400" />;
      case 'symptoms': return <ShieldAlert className="w-4 h-4 text-amber-400" />;
      case 'skin': return <Sparkle className="w-4 h-4 text-cyan-400" />;
      case 'hydration': return <Droplet className="w-4 h-4 text-sky-400" />;
      case 'exercise': return <Dumbbell className="w-4 h-4 text-emerald-400" />;
      default: return <Sparkles className="w-4 h-4 text-violet-400" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'sleep': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'stress': return 'bg-violet-500/10 text-violet-400 border-violet-500/20';
      case 'mood': return 'bg-pink-500/10 text-pink-400 border-pink-500/20';
      case 'cycle': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'symptoms': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'skin': return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
      case 'hydration': return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
      case 'exercise': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      default: return 'bg-violet-500/10 text-violet-400 border-violet-500/20';
    }
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="max-w-md mx-auto py-12 px-4 space-y-8 animate-in fade-in duration-500">
        <div className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 bg-gradient-to-tr from-violet-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-500/20 mb-4 animate-pulse">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Premium Wellness Plan</h1>
          <p className="text-xs text-muted-foreground">Tailored daily routines calibrated directly to your metabolic trends.</p>
        </div>

        <Card className="border-violet-500/15 bg-card/60 backdrop-blur-xl shadow-xl overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/10 blur-2xl rounded-full" />
          <CardHeader className="pb-3 text-center">
            <CardTitle className="text-sm font-bold text-violet-400 uppercase tracking-wider">Not enough wellness data yet</CardTitle>
            <CardDescription className="text-xs pt-1">
              To unlock personalized, dynamic AI daily tasks, we need at least 3 daily check-in logs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-2">
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-muted-foreground">Unlocking Progress: {logsCount}/3 Logs</span>
                <span className="text-violet-400">{Math.round((logsCount / 3) * 100)}%</span>
              </div>
              <div className="w-full bg-secondary/35 h-2.5 rounded-full overflow-hidden border border-border/20">
                <div 
                  className="bg-gradient-to-r from-violet-500 to-pink-500 h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(100, (logsCount / 3) * 100)}%` }}
                />
              </div>
            </div>

            <div className="bg-secondary/20 rounded-2xl p-4 border border-border/30 text-xs leading-relaxed text-muted-foreground space-y-2">
              <span className="font-bold text-foreground block">Why do I need to log?</span>
              Our AI synthesizer reads Sleep, Stress, Mood, Hydration, Movement, and Cycle logs to create realistic daily challenges. Without historical logs, generating tasks would just be random guesses.
            </div>

            <Link href="/check-in" className="block w-full">
              <Button className="w-full h-12 rounded-full bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-medium text-xs shadow-md shadow-violet-500/15 transition-transform active:scale-95 flex items-center justify-center gap-1.5">
                {"Log Today's Habits"} <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tasks = plan?.tasks || [];
  const completedCount = tasks.filter(t => t.completed).length;
  const totalCount = tasks.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const isPerfectDay = completedCount === totalCount && totalCount > 0;

  return (
    <div className="max-w-md mx-auto space-y-6 pb-24 animate-in fade-in duration-500 px-1">
      
      {/* Premium Title Section */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="bg-gradient-to-r from-violet-500 to-pink-500 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">Premium</span>
          <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
            <Calendar className="w-3 h-3 text-pink-400" /> 
            {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground via-foreground to-violet-400">✨ AI Wellness Plan</h1>
        <p className="text-xs text-muted-foreground">Actionable daily targets dynamically generated from your wellness trends.</p>
      </div>

      {/* Progress & Streak Card */}
      <Card className={`relative overflow-hidden border-violet-500/20 bg-gradient-to-br from-card to-card transition-all duration-500 ${isPerfectDay ? 'ring-2 ring-amber-500/40 shadow-lg shadow-amber-500/5' : ''}`}>
        <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/10 blur-2xl rounded-full pointer-events-none" />
        <CardContent className="p-5 space-y-5 relative z-10">
          
          {/* Streaks Header */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3 bg-secondary/15 p-3 rounded-2xl border border-border/40">
              <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                <Flame className="w-5.5 h-5.5 text-amber-500 fill-amber-500/20 animate-pulse" />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">Streak</span>
                <span className="text-sm font-extrabold text-foreground">{streak?.currentStreak || 0} Day{streak?.currentStreak !== 1 ? 's' : ''}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-3 bg-secondary/15 p-3 rounded-2xl border border-border/40">
              <div className="h-10 w-10 rounded-full bg-violet-500/10 flex items-center justify-center border border-violet-500/20">
                <Trophy className="w-5.5 h-5.5 text-violet-400" />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">Record</span>
                <span className="text-sm font-extrabold text-foreground">{streak?.longestStreak || 0} Day{streak?.longestStreak !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>

          {/* Progress Circular representation or Bar */}
          <div className="space-y-2.5">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground font-medium">Daily Goals: {completedCount}/{totalCount} Completed</span>
              <span className="font-bold text-violet-400">{progressPct}%</span>
            </div>
            <div className="w-full bg-secondary/30 h-3 rounded-full overflow-hidden border border-border/30 p-[2px]">
              <div 
                className="bg-gradient-to-r from-violet-500 via-pink-500 to-amber-500 h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            {isPerfectDay ? (
              <p className="text-[10px] text-amber-500 font-semibold text-center mt-1 animate-bounce">
                🎉 Perfect Day complete! Streak preserved!
              </p>
            ) : (
              <p className="text-[10px] text-muted-foreground text-center mt-1">
                Complete all generated tasks to advance your wellness streak.
              </p>
            )}
          </div>

        </CardContent>
      </Card>

      {/* Task List Section */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">{"Today's Tasks"}</h3>
        <div className="space-y-2.5">
          {tasks.map((task) => {
            const isCompleted = task.completed;
            const isTogglingThis = toggling === task.id;

            return (
              <button
                key={task.id}
                onClick={() => !isTogglingThis && handleToggleTask(task.id)}
                disabled={isTogglingThis}
                className={`w-full text-left p-4 rounded-2xl border transition-all duration-300 flex items-start gap-3.5 group select-none active:scale-[0.99] ${
                  isCompleted 
                    ? 'bg-secondary/15 border-green-500/25 opacity-75' 
                    : 'bg-card/50 border-border/40 hover:border-violet-500/30 shadow-xs'
                }`}
              >
                {/* Checking State Button */}
                <div className="shrink-0 mt-0.5 transition-transform duration-200 group-hover:scale-110">
                  {isTogglingThis ? (
                    <Loader2 className="w-5.5 h-5.5 text-violet-500 animate-spin" />
                  ) : isCompleted ? (
                    <CheckCircle2 className="w-5.5 h-5.5 text-green-500 fill-green-500/10" />
                  ) : (
                    <Circle className="w-5.5 h-5.5 text-muted-foreground group-hover:text-violet-400" />
                  )}
                </div>

                <div className="space-y-1.5 flex-1">
                  {/* Category Badge */}
                  <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border ${getCategoryColor(task.category)}`}>
                    {getCategoryIcon(task.category)}
                    {task.category}
                  </span>
                  
                  {/* Task Text */}
                  <p className={`text-xs font-medium leading-relaxed transition-all ${
                    isCompleted 
                      ? 'line-through text-muted-foreground font-normal' 
                      : 'text-foreground'
                  }`}>
                    {task.text}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
}
