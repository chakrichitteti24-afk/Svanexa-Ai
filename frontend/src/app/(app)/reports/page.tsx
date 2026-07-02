'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { FileText, CalendarHeart, Droplets, Activity, Brain, Loader2 } from 'lucide-react';
import { differenceInDays } from 'date-fns';

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [dailyLogs, setDailyLogs] = useState<any[]>([]);
  const [cycleLogs, setCycleLogs] = useState<any[]>([]);
  const [skinLogs, setSkinLogs] = useState<any[]>([]);

  useEffect(() => {
    function loadReportsData() {
      try {
        // Fetch daily logs
        const checkInsRaw = localStorage.getItem('hersync_checkins') || '{}';
        const checkIns = JSON.parse(checkInsRaw);
        const mappedDaily = Object.entries(checkIns).map(([date, data]: [string, any]) => ({
          log_date: date,
          ...data
        })).sort((a, b) => a.log_date.localeCompare(b.log_date));
        setDailyLogs(mappedDaily);

        // Fetch cycle logs
        const cyclesRaw = localStorage.getItem('hersync_cycles') || '[]';
        const cycles = JSON.parse(cyclesRaw);
        const mappedCycles = cycles.map((c: any) => ({
          start_date: c.startDate,
          end_date: c.endDate,
          notes: c.notes || ''
        })).sort((a: any, b: any) => b.start_date.localeCompare(a.start_date));
        setCycleLogs(mappedCycles);

        // Fetch skin logs
        const skinRaw = localStorage.getItem('hersync_skin') || '[]';
        const skin = JSON.parse(skinRaw);
        const mappedSkin = skin.map((s: any) => ({
          log_date: s.date,
          acne: s.acne,
          oiliness: s.oiliness
        })).sort((a: any, b: any) => b.log_date.localeCompare(a.log_date));
        setSkinLogs(mappedSkin);
      } catch (err) {
        console.error('Failed to load reports data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadReportsData();
  }, []);

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

  return (
    <div className="max-w-md mx-auto space-y-6 pb-24 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-1">Health Reports</h1>
        <p className="text-xs text-muted-foreground">Comprehensive logs analysis and historical patterns.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-gradient-to-br from-pink-500/10 to-transparent border-pink-500/20">
          <CardContent className="p-6 flex flex-col items-center text-center">
            <FileText className="w-8 h-8 text-pink-500 mb-3" />
            <p className="text-sm text-muted-foreground">Total Logs</p>
            <p className="text-3xl font-bold">{totalEntries}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-violet-500/10 to-transparent border-violet-500/20">
          <CardContent className="p-6 flex flex-col items-center text-center">
            <CalendarHeart className="w-8 h-8 text-violet-500 mb-3" />
            <p className="text-sm text-muted-foreground">Avg Cycle</p>
            <p className="text-3xl font-bold">{avgCycleLength === 'N/A' ? 'N/A' : `${avgCycleLength}d`}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500/10 to-transparent border-blue-500/20">
          <CardContent className="p-6 flex flex-col items-center text-center">
            <Droplets className="w-8 h-8 text-blue-500 mb-3" />
            <p className="text-sm text-muted-foreground">Avg Water</p>
            <p className="text-3xl font-bold">{avgWater}L</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-indigo-500/10 to-transparent border-indigo-500/20">
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
          <Card>
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
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', borderRadius: '8px' }} />
                  <Area type="monotone" dataKey="mood" stroke="#ec4899" fillOpacity={1} fill="url(#colorMoodRep)" />
                  <Area type="monotone" dataKey="stress" stroke="#8b5cf6" fillOpacity={0.3} fill="#8b5cf6" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Sleep & Exercise Chart */}
          <Card>
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
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', borderRadius: '8px' }} />
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
        <Card>
          <CardHeader>
            <CardTitle>Skin Health Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Total Logs: <span className="font-bold text-foreground">{skinLogs.length}</span></p>
              {skinLogs.length > 0 && (
                <div className="text-sm">
                  <p>Latest Acne Severity: <span className="font-bold text-pink-500">{skinLogs[0].acne}/10</span></p>
                  <p>Latest Oiliness: <span className="font-bold text-blue-500">{skinLogs[0].oiliness}/10</span></p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cycle Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Logged Cycles: <span className="font-bold text-foreground">{cycleLogs.length}</span></p>
              {cycleLogs.length > 0 && (
                <div className="text-sm">
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
