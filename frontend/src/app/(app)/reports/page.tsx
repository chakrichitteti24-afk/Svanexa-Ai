'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { FileText, CalendarHeart, Droplets, Activity, Brain, Loader2 } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [dailyLogs, setDailyLogs] = useState<any[]>([]);
  const [cycleLogs, setCycleLogs] = useState<any[]>([]);
  const [skinLogs, setSkinLogs] = useState<any[]>([]);
  
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    async function loadReportsData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      
      try {
        const [
          { data: sleep },
          { data: water },
          { data: exercise },
          { data: mood },
          { data: checkin },
          { data: skin },
          { data: cycle }
        ] = await Promise.all([
          supabase.from('sleep_logs').select('*').eq('user_id', user.id).order('date', { ascending: true }),
          supabase.from('water_logs').select('*').eq('user_id', user.id).order('date', { ascending: true }),
          supabase.from('exercise_logs').select('*').eq('user_id', user.id).order('date', { ascending: true }),
          supabase.from('mood_logs').select('*').eq('user_id', user.id).order('date', { ascending: true }),
          supabase.from('daily_checkins').select('*').eq('user_id', user.id).order('date', { ascending: true }),
          supabase.from('skin_logs').select('*').eq('user_id', user.id).order('date', { ascending: false }),
          supabase.from('cycle_logs').select('*').eq('user_id', user.id).order('start_date', { ascending: false })
        ]);

        // Aggregate by date
        const allDates = new Set([
          ...(sleep?.map(d => d.date) || []),
          ...(water?.map(d => d.date) || []),
          ...(exercise?.map(d => d.date) || []),
          ...(mood?.map(d => d.date) || []),
          ...(checkin?.map(d => d.date) || [])
        ]);

        const aggregatedDaily = Array.from(allDates).map(date => {
          const s = sleep?.find(x => x.date === date);
          const w = water?.find(x => x.date === date);
          const e = exercise?.find(x => x.date === date);
          const m = mood?.find(x => x.date === date);
          const c = checkin?.find(x => x.date === date);
          return {
            log_date: date,
            sleep: s?.duration_hours || 0,
            water: w ? (w.amount_ml / 1000) : 0,
            exercise: e?.duration_minutes || 0,
            mood: m?.mood || 'calm',
            stress: m?.intensity || 5,
            summary: c?.summary || ''
          };
        }).sort((a, b) => a.log_date.localeCompare(b.log_date));

        setDailyLogs(aggregatedDaily);
        setSkinLogs(skin || []);
        setCycleLogs(cycle || []);
      } catch (err) {
        console.error("Error loading reports", err);
      } finally {
        setLoading(false);
      }
    }
    loadReportsData();
  }, [supabase, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
      </div>
    );
  }

  // Map data for charts
  const chartData = dailyLogs.map(log => {
    let moodVal = 3;
    if (log.mood === 'happy') moodVal = 5;
    if (log.mood === 'calm') moodVal = 4;
    if (log.mood === 'anxious') moodVal = 2;
    if (log.mood === 'sad' || log.mood === 'angry') moodVal = 1;

    return {
      date: new Date(log.log_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      mood: moodVal,
      sleep: Number(log.sleep),
      water: Number(log.water),
      stress: Number(log.stress),
      exercise: Number(log.exercise),
    };
  });

  const totalEntries = dailyLogs.length;
  const avgSleep = totalEntries > 0 ? (dailyLogs.reduce((acc, curr) => acc + Number(curr.sleep), 0) / totalEntries).toFixed(1) : 0;
  const avgWater = totalEntries > 0 ? (dailyLogs.reduce((acc, curr) => acc + Number(curr.water), 0) / totalEntries).toFixed(1) : 0;
  
  const avgCycleLength = cycleLogs.length > 1 
    ? Math.round(cycleLogs.slice(0, -1).reduce((acc, curr, idx) => acc + differenceInDays(new Date(curr.start_date), new Date(cycleLogs[idx+1].start_date)), 0) / (cycleLogs.length - 1))
    : 'N/A';

  const parseSkinLog = (skinEntry: any) => {
    try {
      if (skinEntry.notes && skinEntry.notes.startsWith('{')) {
        return JSON.parse(skinEntry.notes);
      }
    } catch (e) {}
    return { oiliness: 'N/A' };
  };

  return (
    <div className="max-w-md mx-auto space-y-6 pb-24 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-1">Health Reports</h1>
        <p className="text-xs text-muted-foreground">Comprehensive logs analysis and historical patterns.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-gradient-to-br from-pink-500/10 to-transparent border-pink-500/20 shadow-sm">
          <CardContent className="p-6 flex flex-col items-center text-center">
            <FileText className="w-8 h-8 text-pink-500 mb-3" />
            <p className="text-sm text-muted-foreground">Total Logs</p>
            <p className="text-3xl font-bold">{totalEntries}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-violet-500/10 to-transparent border-violet-500/20 shadow-sm">
          <CardContent className="p-6 flex flex-col items-center text-center">
            <CalendarHeart className="w-8 h-8 text-violet-500 mb-3" />
            <p className="text-sm text-muted-foreground">Avg Cycle</p>
            <p className="text-3xl font-bold">{avgCycleLength === 'N/A' ? 'N/A' : `${avgCycleLength}d`}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500/10 to-transparent border-blue-500/20 shadow-sm">
          <CardContent className="p-6 flex flex-col items-center text-center">
            <Droplets className="w-8 h-8 text-blue-500 mb-3" />
            <p className="text-sm text-muted-foreground">Avg Water</p>
            <p className="text-3xl font-bold">{avgWater}L</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-indigo-500/10 to-transparent border-indigo-500/20 shadow-sm">
          <CardContent className="p-6 flex flex-col items-center text-center">
            <Activity className="w-8 h-8 text-indigo-500 mb-3" />
            <p className="text-sm text-muted-foreground">Avg Sleep</p>
            <p className="text-3xl font-bold">{avgSleep}h</p>
          </CardContent>
        </Card>
      </div>

      {chartData.length >= 3 ? (
        <div className="space-y-6">
          {/* Stress & Mood Chart */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Mood & Stress Relationship</CardTitle>
              <CardDescription>How your stress levels impact your overall mood.</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%" minHeight={300} minWidth={100}>
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorMoodRep" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ec4899" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" />
                  <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', borderRadius: '8px', border: 'none' }} />
                  <Area type="monotone" dataKey="mood" stroke="#ec4899" fillOpacity={1} fill="url(#colorMoodRep)" />
                  <Area type="monotone" dataKey="stress" stroke="#8b5cf6" fillOpacity={0.3} fill="#8b5cf6" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Sleep & Exercise Chart */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Activity & Rest</CardTitle>
              <CardDescription>Daily exercise minutes vs sleep hours.</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%" minHeight={300} minWidth={100}>
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" />
                  <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', borderRadius: '8px', border: 'none' }} />
                  <Bar dataKey="exercise" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="bg-secondary/20 border-dashed">
          <CardContent className="py-12 flex flex-col items-center justify-center text-center">
            <Brain className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-xl font-bold mb-2">Not Enough Data Yet</h3>
            <p className="text-muted-foreground max-w-sm">
              Log your daily check-ins for a few days to unlock comprehensive health reports and charts.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Skin & Cycle text summary */}
      <div className="space-y-6">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Skin Health Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Total Logs: <span className="font-bold text-foreground">{skinLogs.length}</span></p>
              {skinLogs.length > 0 && (
                <div className="text-sm space-y-1">
                  <p>Latest Acne Severity: <span className="font-bold text-pink-500">{skinLogs[0].condition}/10</span></p>
                  <p>Latest Oiliness: <span className="font-bold text-blue-500">{parseSkinLog(skinLogs[0]).oiliness}/10</span></p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Cycle Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Logged Cycles: <span className="font-bold text-foreground">{cycleLogs.length}</span></p>
              {cycleLogs.length > 0 && (
                <div className="text-sm space-y-1">
                  <p>Last Period: <span className="font-bold text-violet-500">{new Date(cycleLogs[0].start_date).toLocaleDateString()}</span></p>
                  {cycleLogs.length > 1 && (
                     <p>Cycle Regularity: <span className="font-bold text-green-500">
                       {Math.abs(differenceInDays(new Date(cycleLogs[0].start_date), new Date(cycleLogs[1].start_date)) - (avgCycleLength as number)) <= 3 ? 'Regular' : 'Irregular'}
                     </span></p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
