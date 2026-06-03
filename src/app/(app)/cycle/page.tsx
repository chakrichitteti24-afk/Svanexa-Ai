'use client';

import { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { addDays, format, differenceInDays } from 'date-fns';

type CycleEntry = {
  startDate: string;
  endDate: string;
  notes: string;
};

export default function CycleTrackerPage() {
  const [cycles, setCycles] = useLocalStorage<CycleEntry[]>('hersync_cycles', []);
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});

  const handleSaveCycle = () => {
    if (!dateRange.from || !dateRange.to) {
      toast.error('Please select both start and end dates');
      return;
    }

    const newCycle: CycleEntry = {
      startDate: dateRange.from.toISOString(),
      endDate: dateRange.to.toISOString(),
      notes: '',
    };

    setCycles([...cycles, newCycle].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()));
    setDateRange({});
    toast.success('Cycle logged successfully!');
  };

  const getPrediction = () => {
    if (cycles.length === 0) return null;
    const lastCycle = cycles[0];
    
    // Simple mock prediction: average 28 days or from user data
    let avgLength = 28;
    if (cycles.length > 1) {
      let totalLength = 0;
      for (let i = 0; i < cycles.length - 1; i++) {
        totalLength += differenceInDays(new Date(cycles[i].startDate), new Date(cycles[i+1].startDate));
      }
      avgLength = Math.round(totalLength / (cycles.length - 1));
    }

    const nextPredictedStart = addDays(new Date(lastCycle.startDate), avgLength);
    return { nextStart: nextPredictedStart, avgLength };
  };

  const prediction = getPrediction();

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Cycle Tracker</h1>
        <p className="text-muted-foreground">Monitor your period and get predictions based on your unique cycle.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Log New Period</CardTitle>
              <CardDescription>Select the start and end dates of your period.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <Calendar
                mode="range"
                selected={{
                  from: dateRange.from,
                  to: dateRange.to,
                }}
                onSelect={(range) => {
                  setDateRange({ from: range?.from, to: range?.to });
                }}
                className="rounded-md border mb-6"
              />
              <div className="flex gap-4 w-full max-w-sm">
                <Button 
                  onClick={handleSaveCycle} 
                  className="w-full bg-gradient-to-r from-pink-600 to-violet-600 hover:from-pink-500 hover:to-violet-500 text-white"
                >
                  Save Period Dates
                </Button>
                <Button variant="outline" onClick={() => setDateRange({})} className="w-full">
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Next Cycle Prediction</CardTitle>
            </CardHeader>
            <CardContent>
              {prediction ? (
                <div className="flex items-center justify-between p-6 bg-secondary/30 rounded-2xl border border-pink-500/20">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Predicted Start Date</p>
                    <p className="text-2xl font-bold text-pink-500">{format(prediction.nextStart, 'MMMM d, yyyy')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground mb-1">Average Cycle Length</p>
                    <p className="text-2xl font-bold">{prediction.avgLength} Days</p>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-muted-foreground bg-secondary/30 rounded-2xl">
                  Log your first period to see predictions.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Cycle History</CardTitle>
              <CardDescription>Your recently logged periods.</CardDescription>
            </CardHeader>
            <CardContent>
              {cycles.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No cycles logged yet.</p>
              ) : (
                <div className="space-y-4">
                  {cycles.map((cycle, i) => (
                    <div key={i} className="flex justify-between items-center p-4 border rounded-xl hover:border-pink-500/30 transition-colors">
                      <div>
                        <p className="font-medium text-sm">
                          {format(new Date(cycle.startDate), 'MMM d')} - {format(new Date(cycle.endDate), 'MMM d, yyyy')}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {differenceInDays(new Date(cycle.endDate), new Date(cycle.startDate)) + 1} Days Flow
                        </p>
                      </div>
                      {i < cycles.length - 1 && (
                        <div className="text-xs bg-secondary px-2 py-1 rounded-full">
                          {differenceInDays(new Date(cycle.startDate), new Date(cycles[i+1].startDate))} Day Cycle
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
