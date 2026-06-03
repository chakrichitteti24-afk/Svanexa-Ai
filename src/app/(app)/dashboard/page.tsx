'use client';

import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Activity, Droplets, Moon, Smile, HeartPulse, BrainCircuit, Target, AlertCircle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CycleIntelligenceEngine, CycleEntry, CheckInEntry } from '@/lib/cycle-intelligence';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

import { seedLocalStorage } from '@/lib/seed-data';
import { Button } from '@/components/ui/button';
import { Database } from 'lucide-react';

export default function DashboardPage() {
  const [hasPCOS, setHasPCOS] = useLocalStorage('hersync_has_pcos', false);
  const [cycles] = useLocalStorage<CycleEntry[]>('hersync_cycles', []);
  const [checkIns] = useLocalStorage<Record<string, CheckInEntry>>('hersync_checkins', {});

  const engine = new CycleIntelligenceEngine(cycles, checkIns, hasPCOS);
  const analytics = engine.analyzeCycles();
  const prediction = engine.predictNextPeriod();
  const healthScore = engine.calculateHealthScore();

  // Prepare chart data based on checkins
  const sortedDates = Object.keys(checkIns).sort().slice(-7);
  const chartData = sortedDates.map(date => {
    const entry = checkIns[date];
    let moodVal = 3;
    if (entry.mood === 'happy') moodVal = 5;
    if (entry.mood === 'calm') moodVal = 4;
    if (entry.mood === 'anxious') moodVal = 2;
    if (entry.mood === 'sad' || entry.mood === 'angry') moodVal = 1;
    
    return {
      day: new Date(date).toLocaleDateString(undefined, { weekday: 'short' }),
      mood: moodVal,
      sleep: entry.sleep,
      stress: entry.stress,
    };
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Welcome back, Warrior ✨</h1>
          <p className="text-muted-foreground">Your AI-powered cycle intelligence dashboard.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Button variant="outline" size="sm" onClick={seedLocalStorage} className="flex items-center gap-2">
            <Database className="w-4 h-4" /> Load Test Data
          </Button>
          <div className="flex items-center space-x-2 bg-secondary/30 p-3 rounded-xl border border-border/50">
            <Switch id="pcos-mode" checked={hasPCOS} onCheckedChange={setHasPCOS} />
            <Label htmlFor="pcos-mode" className="font-medium">PCOS / PCOD Mode</Label>
          </div>
        </div>
      </div>

      {hasPCOS && (
        <div className="bg-pink-500/10 border border-pink-500/20 text-pink-600 dark:text-pink-400 p-4 rounded-xl flex items-start gap-3 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p>PCOS Mode enabled. Cycle predictions may be less precise due to cycle irregularity. Symptom-based weighting is now active.</p>
        </div>
      )}

      {/* Advanced Widgets Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Next Period Card */}
        <Card className="bg-gradient-to-br from-pink-500/10 to-transparent border-pink-500/20 lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="w-4 h-4 text-pink-500" /> Expected Period Window
            </CardTitle>
          </CardHeader>
          <CardContent>
            {prediction ? (
              <>
                <div className="text-2xl font-bold text-foreground mt-1">
                  {prediction.earliestDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - {prediction.latestDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </div>
                <div className="text-xs text-muted-foreground mt-2 font-medium">
                  Most Likely: <span className="text-pink-500">{prediction.likelyDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                </div>
              </>
            ) : (
              <div className="text-muted-foreground text-sm">Not enough data to predict. Please log a cycle.</div>
            )}
          </CardContent>
        </Card>

        {/* Prediction Confidence Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-violet-500" /> Prediction Confidence
            </CardTitle>
          </CardHeader>
          <CardContent>
            {prediction ? (
              <div className="flex items-end gap-3">
                <div className="text-3xl font-bold">{prediction.confidenceScore}%</div>
                <div className="text-sm text-muted-foreground mb-1 font-medium">{prediction.confidenceLabel}</div>
              </div>
            ) : (
              <div className="text-muted-foreground text-sm">Waiting for data...</div>
            )}
            <div className="w-full bg-secondary h-2 mt-3 rounded-full overflow-hidden">
              <div 
                className="bg-violet-500 h-full rounded-full transition-all duration-1000" 
                style={{ width: `${prediction?.confidenceScore || 0}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Cycle Health Score Card */}
        <Card className="bg-gradient-to-br from-green-500/10 to-transparent border-green-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <HeartPulse className="w-4 h-4 text-green-500" /> Cycle Health Score
            </CardTitle>
          </CardHeader>
          <CardContent>
             <div className="flex items-end gap-3">
                <div className="text-3xl font-bold">{healthScore.score}/100</div>
                <div className={`text-sm mb-1 font-bold ${
                  healthScore.category === 'Excellent' ? 'text-green-500' :
                  healthScore.category === 'Good' ? 'text-blue-500' :
                  healthScore.category === 'Moderate' ? 'text-yellow-500' : 'text-red-500'
                }`}>
                  {healthScore.category}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2 line-clamp-1">{healthScore.insights[0]}</p>
          </CardContent>
        </Card>

        {/* Averages */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Cycle Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Avg Length</div>
                <div className="text-xl font-bold">{analytics.avgCycleLength}d</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Avg Period</div>
                <div className="text-xl font-bold">{analytics.avgPeriodDuration}d</div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border/50">
              Regularity: <span className="font-semibold text-foreground">{analytics.regularityStatus}</span>
            </div>
          </CardContent>
        </Card>

        {/* AI Insight Card */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-indigo-500" /> AI Cycle Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {healthScore.insights.slice(0, 2).map((insight, idx) => (
              <div key={idx} className="flex gap-3 items-start bg-secondary/30 p-3 rounded-lg border border-border/50">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 shrink-0" />
                <p className="text-sm">{insight}</p>
              </div>
            ))}
            {prediction && (
              <div className="flex gap-3 items-start bg-secondary/30 p-3 rounded-lg border border-border/50">
                <div className="w-1.5 h-1.5 rounded-full bg-pink-500 mt-2 shrink-0" />
                <p className="text-sm">{prediction.message}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Mood & Stress Trends</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minHeight={300} minWidth={100}>
                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorMood" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorStress" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                  <XAxis dataKey="day" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '8px' }} itemStyle={{ color: '#fff' }} />
                  <Area type="monotone" dataKey="mood" stroke="#ec4899" fillOpacity={1} fill="url(#colorMood)" strokeWidth={2} />
                  <Area type="monotone" dataKey="stress" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorStress)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No recent data available.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sleep Duration</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minHeight={300} minWidth={100}>
                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSleep" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                  <XAxis dataKey="day" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '8px' }} itemStyle={{ color: '#fff' }} />
                  <Area type="monotone" dataKey="sleep" stroke="#3b82f6" fillOpacity={1} fill="url(#colorSleep)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
               <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No recent data available.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="text-center text-xs text-muted-foreground opacity-60 max-w-2xl mx-auto pt-8">
        Predictions are estimates and should not replace professional medical advice. For severe or persistent symptoms, please consult a qualified healthcare professional.
      </div>
    </div>
  );
}
