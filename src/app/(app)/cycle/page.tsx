'use client';

import { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { addDays, format, differenceInDays } from 'date-fns';
import { CalendarHeart, Sparkles, Trash2, CalendarDays, Plus } from 'lucide-react';

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

    // Verify start is before end
    if (dateRange.from > dateRange.to) {
      toast.error('Start date must be before the end date');
      return;
    }

    const newCycle: CycleEntry = {
      startDate: dateRange.from.toISOString(),
      endDate: dateRange.to.toISOString(),
      notes: '',
    };

    const updated = [...cycles, newCycle].sort(
      (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    );
    setCycles(updated);
    setDateRange({});
    toast.success('Period dates saved successfully!');
  };

  const handleDeleteCycle = (index: number) => {
    const updated = cycles.filter((_, idx) => idx !== index);
    setCycles(updated);
    toast.success('Cycle entry deleted.');
  };

  const getPrediction = () => {
    if (cycles.length === 0) return null;
    const lastCycle = cycles[0];
    
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
    <div className="max-w-md mx-auto space-y-6 pb-24 animate-in fade-in duration-500">
      
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-1">Cycle Calendar</h1>
        <p className="text-xs text-muted-foreground">Log period flows and predict upcoming fertility windows.</p>
      </div>

      {/* Log Period Card */}
      <Card className="border-border/40 bg-card/60 backdrop-blur-xs">
        <CardHeader className="pb-3 text-center">
          <CardTitle className="text-sm font-semibold flex items-center justify-center gap-1.5">
            <CalendarHeart className="w-4.5 h-4.5 text-pink-500" /> Log Cycle Dates
          </CardTitle>
          <CardDescription className="text-[10px]">Tap first day and last day of period flow</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center">
          <div className="w-full flex justify-center scale-95 origin-center overflow-x-auto bg-background/50 rounded-2xl p-2 border border-border/20">
            <Calendar
              mode="range"
              selected={{
                from: dateRange.from,
                to: dateRange.to,
              }}
              onSelect={(range) => {
                setDateRange({ from: range?.from, to: range?.to });
              }}
              className="rounded-md"
            />
          </div>
          
          <div className="flex gap-2.5 w-full mt-4">
            <Button 
              onClick={handleSaveCycle} 
              className="flex-1 h-11 text-xs rounded-full bg-pink-600 hover:bg-pink-500 text-white font-medium"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Log Period
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setDateRange({})} 
              className="h-11 px-4 text-xs rounded-full"
            >
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cycle Prediction Card */}
      <Card className="border-pink-500/15 bg-gradient-to-br from-pink-500/5 to-transparent">
        <CardContent className="p-4">
          {prediction ? (
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[9px] text-muted-foreground uppercase font-semibold tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-pink-500 animate-pulse" /> Predicted Start
                </span>
                <p className="text-base font-bold text-pink-500 mt-1">
                  {format(prediction.nextStart, 'MMMM d, yyyy')}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[9px] text-muted-foreground uppercase font-semibold tracking-wider">
                  Avg Cycle Length
                </span>
                <p className="text-sm font-bold mt-1">{prediction.avgLength} Days</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-xs text-muted-foreground">
              Please log at least one period to enable cycle predictions.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cycle History Timeline */}
      <Card className="border-border/40 bg-card/60 backdrop-blur-xs">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4 text-pink-500" /> Logged Flow History
          </CardTitle>
          <CardDescription className="text-[10px]">Your historical period flow records</CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          {cycles.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6 italic">No logs on record yet.</p>
          ) : (
            <div className="relative border-l border-pink-500/20 ml-2.5 pl-4 space-y-4">
              {cycles.map((cycle, i) => {
                const flowDays = differenceInDays(new Date(cycle.endDate), new Date(cycle.startDate)) + 1;
                return (
                  <div key={i} className="relative group">
                    {/* Circle timeline bullet */}
                    <div className="absolute -left-[22.5px] top-1.5 w-3 h-3 rounded-full bg-pink-500 border-2 border-background" />
                    
                    <div className="flex justify-between items-center p-3 rounded-xl bg-background/40 border border-border/30 hover:border-pink-500/20 transition-all">
                      <div>
                        <p className="font-semibold text-xs text-foreground">
                          {format(new Date(cycle.startDate), 'MMM d')} - {format(new Date(cycle.endDate), 'MMM d, yyyy')}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {flowDays} {flowDays === 1 ? 'day' : 'days'} flow period
                        </p>
                        {i < cycles.length - 1 && (
                          <div className="inline-block text-[9px] bg-secondary/40 text-muted-foreground px-2 py-0.5 rounded-full mt-1.5">
                            Cycle length: {differenceInDays(new Date(cycle.startDate), new Date(cycles[i+1].startDate))} days
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteCycle(i)}
                        className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-full"
                        aria-label="Delete entry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      
    </div>
  );
}
