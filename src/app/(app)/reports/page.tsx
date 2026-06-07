'use client';

import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { FileText, CalendarHeart, Droplets, Activity, Brain } from 'lucide-react';
import { differenceInDays } from 'date-fns';

export default function ReportsPage() {
  const [checkIns] = useLocalStorage<Record<string, any>>('hersync_checkins', {});
  const [cycles] = useLocalStorage<any[]>('hersync_cycles', []);
  const [skinEntries] = useLocalStorage<any[]>('hersync_skin', []);

  // Prepare data for charts
  const sortedDates = Object.keys(checkIns).sort();
  const last14Days = sortedDates.slice(-14);
  
  const chartData = last14Days.map(date => ({
    date: new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    mood: checkIns[date].mood === 'happy' ? 5 : checkIns[date].mood === 'calm' ? 4 : checkIns[date].mood === 'mood_swings' ? 3 : checkIns[date].mood === 'anxious' ? 2 : 1,
    sleep: checkIns[date].sleep,
    water: checkIns[date].water,
    stress: checkIns[date].stress,
    exercise: checkIns[date].exercise,
  }));

  // Calculate summaries
  const totalEntries = Object.keys(checkIns).length;
  const avgSleep = totalEntries > 0 ? (Object.values(checkIns).reduce((acc: number, curr: any) => acc + curr.sleep, 0) / totalEntries).toFixed(1) : 0;
  const avgWater = totalEntries > 0 ? (Object.values(checkIns).reduce((acc: number, curr: any) => acc + curr.water, 0) / totalEntries).toFixed(1) : 0;
  
  const avgCycleLength = cycles.length > 1 
    ? Math.round(cycles.slice(0, -1).reduce((acc: number, curr: any, idx: number) => acc + differenceInDays(new Date(curr.startDate), new Date(cycles[idx+1].startDate)), 0) / (cycles.length - 1))
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
            <p className="text-3xl font-bold">{avgCycleLength}d</p>
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

      {chartData.length > 0 ? (
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
              <p className="text-sm text-muted-foreground">Total Logs: <span className="font-bold text-foreground">{skinEntries.length}</span></p>
              {skinEntries.length > 0 && (
                <div className="text-sm">
                  <p>Latest Acne Severity: <span className="font-bold text-pink-500">{skinEntries[0].acne}/10</span></p>
                  <p>Latest Oiliness: <span className="font-bold text-blue-500">{skinEntries[0].oiliness}/10</span></p>
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
              <p className="text-sm text-muted-foreground">Logged Cycles: <span className="font-bold text-foreground">{cycles.length}</span></p>
              {cycles.length > 0 && (
                <div className="text-sm">
                  <p>Last Period: <span className="font-bold text-violet-500">{new Date(cycles[0].startDate).toLocaleDateString()}</span></p>
                  {cycles.length > 1 && (
                     <p>Cycle Regularity: <span className="font-bold text-green-500">
                       {Math.abs(differenceInDays(new Date(cycles[0].startDate), new Date(cycles[1].startDate)) - (avgCycleLength as number)) <= 3 ? 'Regular' : 'Irregular'}
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
