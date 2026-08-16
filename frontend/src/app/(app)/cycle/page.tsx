'use client';

import { useState, useEffect, useMemo, memo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, 
  isSameDay, isToday, addDays, isWithinInterval, differenceInDays,
  startOfDay, isBefore, subDays
} from 'date-fns';
import { 
  ChevronLeft, ChevronRight, Droplets, X, 
  Sparkles, FileText, CalendarCheck, Baby,
  ArrowLeft, CalendarHeart, Edit3, Eye, Trash2, CheckCircle2
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useHerSync } from '@/context/HerSyncContext';
import { toast } from 'sonner';
import { safeFormat } from '@/utils/date-utils';

// Helper to parse daily checkin json
const parseSummary = (str: string | null) => {
  if (!str) return {};
  try {
    const obj = JSON.parse(str);
    if (typeof obj === 'object' && obj !== null) return obj;
  } catch {}
  return { note: str };
};

// Helper to normalize any Date or string into a 00:00:00 local timestamp
const getNormalizedTimestamp = (dateInput: Date | string | null): number | null => {
  if (!dateInput) return null;
  let y: number, m: number, d: number;
  if (typeof dateInput === 'string') {
    const clean = dateInput.slice(0, 10);
    const parts = clean.split('-');
    if (parts.length === 3) {
      y = Number(parts[0]);
      m = Number(parts[1]) - 1;
      d = Number(parts[2]);
    } else {
      const dateObj = new Date(dateInput);
      y = dateObj.getFullYear();
      m = dateObj.getMonth();
      d = dateObj.getDate();
    }
  } else {
    y = dateInput.getFullYear();
    m = dateInput.getMonth();
    d = dateInput.getDate();
  }
  return new Date(y, m, d, 0, 0, 0, 0).getTime();
};

// Calendar Day Component supporting continuous connected background ranges
const CalendarDay = memo(({ 
  day, 
  currentDate, 
  isSel, 
  range, 
  hasNote, 
  hasEvent, 
  handleDateTap 
}: any) => {
  const isCurrentMonth = isSameMonth(day, currentDate);
  const today = isToday(day);

  let rangeStyle = 'w-10 rounded-full mx-auto';
  let textStyle = !isCurrentMonth ? 'text-muted-foreground/30' : 'text-muted-foreground font-medium';

  if (range.inRange) {
    if (range.type === 'period') {
      textStyle = 'text-white font-bold';
      if (range.isStart && range.isEnd) {
        rangeStyle = 'w-10 h-10 rounded-full bg-pink-500 text-white font-bold shadow-md shadow-pink-500/30 mx-auto flex items-center justify-center';
      } else if (range.isStart) {
        rangeStyle = 'w-full h-10 rounded-l-full rounded-r-none bg-pink-500 text-white font-bold flex items-center justify-center';
      } else if (range.isEnd) {
        rangeStyle = 'w-full h-10 rounded-r-full rounded-l-none bg-pink-500 text-white font-bold flex items-center justify-center';
      } else {
        rangeStyle = 'w-full h-10 rounded-none bg-pink-500 text-white font-bold flex items-center justify-center';
      }
    } else if (range.type === 'pregnancy') {
      textStyle = 'text-white font-bold';
      if (range.isStart && range.isEnd) {
        rangeStyle = 'w-9 h-9 rounded-full bg-amber-500 text-white font-bold shadow-md mx-auto flex items-center justify-center';
      } else if (range.isStart) {
        rangeStyle = 'w-full h-9 rounded-l-full rounded-r-none bg-amber-500 text-white font-bold flex items-center justify-center';
      } else if (range.isEnd) {
        rangeStyle = 'w-full h-9 rounded-r-full rounded-l-none bg-amber-500 text-white font-bold flex items-center justify-center';
      } else {
        rangeStyle = 'w-full h-9 rounded-none bg-amber-500/70 text-white font-bold flex items-center justify-center';
      }
    } else if (range.type === 'predicted_period') {
      textStyle = 'text-pink-600 dark:text-pink-300 font-bold';
      if (range.isStart && range.isEnd) {
        rangeStyle = 'w-9 h-9 rounded-full border-2 border-dashed border-pink-400 bg-pink-500/10 mx-auto flex items-center justify-center';
      } else if (range.isStart) {
        rangeStyle = 'w-full h-9 rounded-l-full rounded-r-none border-y-2 border-l-2 border-dashed border-pink-400 bg-pink-500/10 flex items-center justify-center';
      } else if (range.isEnd) {
        rangeStyle = 'w-full h-9 rounded-r-full rounded-l-none border-y-2 border-r-2 border-dashed border-pink-400 bg-pink-500/10 flex items-center justify-center';
      } else {
        rangeStyle = 'w-full h-9 rounded-none border-y-2 border-dashed border-pink-400 bg-pink-500/10 flex items-center justify-center';
      }
    }
  } else if (today && !isSel) {
    // Today's Date: Purple outline
    rangeStyle = 'w-9 h-9 border-2 border-purple-500 rounded-full text-purple-600 dark:text-purple-400 font-bold mx-auto flex items-center justify-center';
  }

  const isPeriod = range.inRange && range.type === 'period';

  return (
    <div className="flex flex-col items-center justify-center h-11 min-h-[44px] relative w-full">
      <button
        onClick={() => handleDateTap(day)}
        aria-label={`Select date ${format(day, 'MMMM d, yyyy')}`}
        className={`
          relative h-10 min-h-[40px] w-full flex items-center justify-center text-sm transition-all active:scale-95 touch-manipulation select-none
          ${rangeStyle}
          ${textStyle}
        `}
      >
        {isSel ? (
          <span className={`w-9 h-9 rounded-full ${isPeriod ? 'bg-pink-600 ring-2 ring-white text-white' : 'bg-pink-500/20 text-pink-600 dark:text-pink-400 font-bold border-2 border-pink-500'} font-bold flex items-center justify-center shadow-lg transform scale-105 transition-transform`}>
            {format(day, 'd')}
          </span>
        ) : (
          <span>{format(day, 'd')}</span>
        )}

        {/* Indicators for Notes & Custom Events */}
        {!isSel && (hasEvent || hasNote) && (
          <div className="absolute bottom-0.5 flex items-center justify-center gap-0.5">
            {hasEvent && (
              <span className="w-1.5 h-1.5 bg-purple-500 rounded-full" title="Custom Event" />
            )}
            {hasNote && (
              <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full" title="Note" />
            )}
          </div>
        )}
      </button>
    </div>
  );
});

CalendarDay.displayName = 'CalendarDay';

export default function CycleTrackerPage() {
  const supabase = createClient();
  const { cycleHistory, setCycleHistory, wellnessMode, refreshAll, refreshCycleHistory, pregnancyDueDate } = useHerSync();
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [sheetView, setSheetView] = useState<'menu' | 'note' | 'event' | 'symptoms' | 'locked' | 'view_cycle'>('menu');
  const [monthData, setMonthData] = useState<Record<string, any>>({});
  const [inputValue, setInputValue] = useState<any>('');
  const [unlockedCycleId, setUnlockedCycleId] = useState<string | null>(null);

  // Find active cycle (period started, but no end date logged yet or end_date === start_date)
  const activeCycle = useMemo(() => {
    return cycleHistory.find(c => !c.end_date || c.end_date === c.start_date);
  }, [cycleHistory]);

  // Fetch month logs (checkins, custom events, notes)
  const fetchMonth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const start = format(startOfWeek(startOfMonth(currentDate)), 'yyyy-MM-dd');
      const end = format(endOfWeek(endOfMonth(currentDate)), 'yyyy-MM-dd');

      const { data: checkins } = await supabase
        .from('daily_checkins')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', start)
        .lte('date', end);

      const aggregated: Record<string, any> = {};
      if (checkins) {
        checkins.forEach(item => {
          aggregated[item.date] = {
            checkin: item,
            meta: parseSummary(item.summary),
          };
        });
      }
      setMonthData(aggregated);
    } catch (e) {
      console.error('Error fetching month data:', e);
    }
  };

  useEffect(() => {
    fetchMonth();
  }, [currentDate, supabase, cycleHistory]);

  // Calculate Predictions (supporting PCOD irregular cycles)
  const predictions = useMemo(() => {
    if (!cycleHistory || cycleHistory.length === 0) return null;
    let totalCycleLength = 0;
    let validCycles = 0;

    for (let i = 0; i < cycleHistory.length - 1; i++) {
      const currentStart = new Date(cycleHistory[i].start_date);
      const prevStart = new Date(cycleHistory[i + 1].start_date);
      const diff = differenceInDays(currentStart, prevStart);
      if (diff > 15 && diff < 90) {
        totalCycleLength += diff;
        validCycles++;
      }
    }

    const isPcos = wellnessMode === 'pcos';
    const defaultAvgCycle = isPcos ? 35 : 28;
    const avgCycle = validCycles > 0 ? Math.round(totalCycleLength / validCycles) : defaultAvgCycle;
    
    const lastCycle = cycleHistory[0];
    const lastStartDate = new Date(lastCycle.start_date);
    const today = new Date();
    const currentCycleDay = differenceInDays(today, lastStartDate) + 1;

    const nextPeriodStart = addDays(lastStartDate, avgCycle);
    const nextPeriodEnd = addDays(nextPeriodStart, 4); // Assume 5 day duration
    const daysRemaining = Math.max(0, differenceInDays(nextPeriodStart, today));

    let currentPhase = 'Follicular';
    if (currentCycleDay <= 5) {
      currentPhase = 'Menstrual';
    } else if (currentCycleDay >= (avgCycle - 16) && currentCycleDay <= (avgCycle - 12)) {
      currentPhase = 'Ovulation';
    } else if (currentCycleDay > (avgCycle - 12)) {
      currentPhase = 'Luteal';
    }

    return {
      avgCycle,
      currentCycleDay,
      currentPhase,
      daysRemaining,
      isPcos,
      nextPeriodStart,
      nextPeriodEnd
    };
  }, [cycleHistory, wellnessMode]);

// Helper to parse date string into local timezone date (00:00:00) without UTC shifts
const parseLocalDate = (dateStr: string | null) => {
  if (!dateStr) return null;
  const clean = dateStr.slice(0, 10);
  const parts = clean.split('-');
  if (parts.length === 3) {
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 0, 0, 0, 0);
  }
  return startOfDay(new Date(dateStr));
};

  // Centralized Date Range Engine using normalized local timestamps
  const getDayRangeStyle = (day: Date) => {
    const currentTs = getNormalizedTimestamp(day)!;

    // 1. Period Cycle Ranges
    for (const c of cycleHistory) {
      if (!c.start_date) continue;
      const startTs = getNormalizedTimestamp(c.start_date)!;
      const endTs = c.end_date ? getNormalizedTimestamp(c.end_date) : null;
      const isLocked = endTs !== null && c.id !== unlockedCycleId;

      if (endTs === null || c.end_date === c.start_date) {
        // Active cycle (Period Start logged, Period End pending)
        // Highlight ONLY the Period Start date!
        if (currentTs === startTs) {
          return {
            type: 'period',
            inRange: true,
            isStart: true,
            isEnd: true,
            isLocked: false,
            cycle: c
          };
        }
      } else {
        // Completed cycle (both Period Start and Period End exist, endTs is non-null)
        let sTs = startTs;
        let eTs = endTs;
        // Self-heal corrupted DB records where end < start
        if (sTs > eTs) {
          sTs = endTs;
          eTs = startTs;
        }

        if (currentTs >= sTs && currentTs <= eTs) {
          return {
            type: 'period',
            inRange: true,
            isStart: currentTs === sTs,
            isEnd: currentTs === eTs,
            isLocked,
            cycle: c
          };
        }
      }
    }

    // 2. Predicted Future Period Range
    if (predictions?.nextPeriodStart && predictions?.nextPeriodEnd) {
      const predStartTs = getNormalizedTimestamp(predictions.nextPeriodStart)!;
      const predEndTs = getNormalizedTimestamp(predictions.nextPeriodEnd)!;
      
      if (currentTs >= predStartTs && currentTs <= predEndTs) {
        return {
          type: 'predicted_period',
          inRange: true,
          isStart: currentTs === predStartTs,
          isEnd: currentTs === predEndTs,
          isLocked: false,
          cycle: null
        };
      }
    }

    // 3. Pregnancy Range
    if (wellnessMode === 'pregnancy' && pregnancyDueDate) {
      const dueTs = getNormalizedTimestamp(pregnancyDueDate)!;
      const pregStartTs = dueTs - (280 * 86400000);
      const todayTs = getNormalizedTimestamp(new Date())!;
      const endBoundaryTs = todayTs < dueTs ? todayTs : dueTs;

      if (currentTs >= pregStartTs && currentTs <= endBoundaryTs) {
        return {
          type: 'pregnancy',
          inRange: true,
          isStart: currentTs === pregStartTs,
          isEnd: currentTs === endBoundaryTs,
          isLocked: false,
          cycle: null
        };
      }
    }

    return { type: null, isStart: false, isEnd: false, inRange: false, isLocked: false, cycle: null };
  };

  const daysInMonth = eachDayOfInterval({ 
    start: startOfWeek(startOfMonth(currentDate)), 
    end: endOfWeek(endOfMonth(currentDate)) 
  });

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const handleDateTap = (day: Date) => {
    setSelectedDate(day);
    const range = getDayRangeStyle(day);
    if (range.isLocked) {
      setSheetView('locked');
    } else {
      setSheetView('menu');
    }
  };

  // Log Period Started
  const logPeriodStart = async () => {
    if (!selectedDate || isSaving || isSavingRef.current) return;
    isSavingRef.current = true;
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      
      if (unlockedCycleId) {
        // Editing existing cycle
        const target = cycleHistory.find(c => c.id === unlockedCycleId);
        if (target?.end_date) {
          const endTs = getNormalizedTimestamp(target.end_date)!;
          const selTs = getNormalizedTimestamp(selectedDate)!;
          if (selTs > endTs) {
            toast.error('Period start date cannot be after period end date.');
            isSavingRef.current = false;
            setIsSaving(false);
            return;
          }
        }
        
        // Optimistic Update
        const optimisticHistory = cycleHistory.map(c => 
          c.id === unlockedCycleId ? { ...c, start_date: dateStr } : c
        );
        setCycleHistory(optimisticHistory);

        const { data: updatedData } = await supabase.from('cycle_logs').update({ start_date: dateStr }).eq('id', unlockedCycleId).select().single();
        if (updatedData) {
           setCycleHistory(cycleHistory.map(c => c.id === unlockedCycleId ? updatedData : c));
        }
        toast.success('Period start updated.');
      } else {
        // Check if an active cycle already exists in DB
        const { data: latestCycle } = await supabase
          .from('cycle_logs')
          .select('*')
          .eq('user_id', user.id)
          .order('start_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        const existingActive = latestCycle && (!latestCycle.end_date || latestCycle.end_date === latestCycle.start_date) ? latestCycle : null;

        if (existingActive) {
          const oldStartTs = getNormalizedTimestamp(existingActive.start_date)!;
          const newStartTs = getNormalizedTimestamp(selectedDate)!;
          const diffDays = Math.abs(differenceInDays(new Date(newStartTs), new Date(oldStartTs)));

          if (diffDays > 14) {
            // Auto-close stale active cycle from past month
            const autoEndDate = format(addDays(new Date(existingActive.start_date), 4), 'yyyy-MM-dd');
            await supabase.from('cycle_logs').update({ end_date: autoEndDate }).eq('id', existingActive.id);
            
            // Insert new active cycle (end_date = dateStr to avoid NOT NULL constraint)
            const { data: insertedData, error } = await supabase
              .from('cycle_logs')
              .insert({ user_id: user.id, start_date: dateStr, end_date: dateStr })
              .select()
              .single();
            if (error || !insertedData) throw error;

            setCycleHistory([insertedData, ...cycleHistory.map(c => c.id === existingActive.id ? { ...c, end_date: autoEndDate } : c)]);
            toast.success('Period started logged.');
          } else {
            // Update existing active cycle start date
            const { data: updatedData, error } = await supabase
              .from('cycle_logs')
              .update({ start_date: dateStr, end_date: dateStr })
              .eq('id', existingActive.id)
              .select()
              .single();
            if (error || !updatedData) throw error;

            setCycleHistory(cycleHistory.map(c => c.id === existingActive.id ? updatedData : c));
            toast.success('Period start updated.');
          }
        } else {
          // Create new active cycle (end_date = dateStr to avoid NOT NULL constraint)
          const tempId = `temp-${Date.now()}`;
          const newCycle = { id: tempId, start_date: dateStr, end_date: dateStr, flow_intensity: null, symptoms: null };
          setCycleHistory([newCycle, ...cycleHistory]);

          const { data: insertedData, error } = await supabase
            .from('cycle_logs')
            .insert({ user_id: user.id, start_date: dateStr, end_date: dateStr })
            .select()
            .single();

          if (error || !insertedData) {
            setCycleHistory(cycleHistory);
            throw error;
          }
          
          setCycleHistory([insertedData, ...cycleHistory.filter(c => c.id !== tempId)]);
          toast.success('Period started logged.');
        }
      }
      
      setUnlockedCycleId(null);
      setSelectedDate(null);
      // Fire refreshAll for dashboard, but skip cycle history to prevent stale reads
      refreshAll({ skipCycleHistory: true });
    } catch (e: any) {
      console.error('Error logging period start:', e);
      refreshCycleHistory();
      toast.error(e?.message || 'Failed to log period start.');
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  // Log Period Ended
  const logPeriodEnd = async () => {
    if (!selectedDate || isSaving || isSavingRef.current) return;
    isSavingRef.current = true;
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const targetCycle = unlockedCycleId 
        ? cycleHistory.find(c => c.id === unlockedCycleId) 
        : activeCycle;

      if (!targetCycle) {
        toast.error('No active period found to end.');
        isSavingRef.current = false;
        setIsSaving(false);
        return;
      }

      const startTs = getNormalizedTimestamp(targetCycle.start_date)!;
      const selTs = getNormalizedTimestamp(selectedDate)!;

      if (selTs < startTs) {
        toast.error('Period end date cannot be before period start date.');
        isSavingRef.current = false;
        setIsSaving(false);
        return;
      }

      // Optimistic Update (and remove stale temp actives if any)
      const optimisticHistory = cycleHistory.map(c => 
        c.id === targetCycle.id ? { ...c, end_date: dateStr } : c
      ).filter(c => c.id === targetCycle.id || c.end_date !== null);
      setCycleHistory(optimisticHistory);

      // Update active cycle with end date and get it back
      const { data: updatedData, error } = await supabase.from('cycle_logs').update({ end_date: dateStr }).eq('id', targetCycle.id).select().single();
      if (error) {
        setCycleHistory(cycleHistory); // revert
        throw error;
      }
      if (updatedData) {
         setCycleHistory(optimisticHistory.map(c => c.id === targetCycle.id ? updatedData : c));
      }
      
      // Clean up any stale/duplicate active cycles in database if they exist
      const staleActives = cycleHistory.filter(c => (!c.end_date || c.end_date === c.start_date) && c.id !== targetCycle.id);
      for (const stale of staleActives) {
        if (!stale.id.startsWith('temp-')) {
          await supabase.from('cycle_logs').delete().eq('id', stale.id);
        }
      }

      toast.success('Period ended. Cycle completed & saved!');
      
      setUnlockedCycleId(null);
      setSelectedDate(null);
      // Fire refreshAll for dashboard, but skip cycle history to prevent stale reads
      refreshAll({ skipCycleHistory: true });
    } catch (e: any) {
      console.error('Error logging period end:', e);
      refreshCycleHistory();
      toast.error(e?.message || 'Failed to log period end.');
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  // Log Pregnancy Started
  const logPregnancyStart = async () => {
    if (!selectedDate) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const dueDate = addDays(selectedDate, 280).toISOString().slice(0, 10);
      await supabase.from('pregnancy_logs').insert({ 
        user_id: user.id, 
        due_date: dueDate,
        created_at: selectedDate.toISOString()
      });
      await supabase.from('profiles').update({ active_theme: 'pregnancy' }).eq('id', user.id);
      toast.success('Pregnancy tracking started!');
      await refreshAll();
      setSelectedDate(null);
    } catch (e) {
      toast.error('Failed to start pregnancy tracking.');
    }
  };

  // Log Pregnancy Ended
  const logPregnancyEnd = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('profiles').update({ active_theme: 'general' }).eq('id', user.id);
      toast.success('Pregnancy tracking completed.');
      await refreshAll();
      setSelectedDate(null);
    } catch (e) {
      toast.error('Failed to update preferences.');
    }
  };

  // Save Note / Event / Symptoms
  const saveCheckinMeta = async (updates: any) => {
    if (!selectedDate) return;
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const existing = monthData[dateStr]?.meta || {};
      const existingId = monthData[dateStr]?.checkin?.id;
      const newSummary = JSON.stringify({ ...existing, ...updates });

      if (existingId) {
        await supabase
          .from('daily_checkins')
          .update({ summary: newSummary, updated_at: new Date().toISOString() })
          .eq('id', existingId);
      } else {
        const { error: insertErr } = await supabase
          .from('daily_checkins')
          .insert({ 
            user_id: user.id, 
            date: dateStr, 
            summary: newSummary,
            updated_at: new Date().toISOString(),
          });

        if (insertErr) {
          await supabase
            .from('daily_checkins')
            .update({ summary: newSummary, updated_at: new Date().toISOString() })
            .eq('user_id', user.id)
            .eq('date', dateStr);
        }
      }
      
      toast.success('Saved successfully.');
      await fetchMonth();
      setSheetView('menu');
    } catch (e) {
      toast.error('Failed to save.');
    }
  };

  // Delete Cycle Entry
  const deleteCycle = async (cycleId: string) => {
    try {
      await supabase.from('cycle_logs').delete().eq('id', cycleId);
      toast.success('Cycle deleted.');
      setUnlockedCycleId(null);
      await refreshAll();
      setSelectedDate(null);
    } catch (e) {
      toast.error('Failed to delete cycle.');
    }
  };

  const openView = (view: typeof sheetView) => {
    const dateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
    const d = monthData[dateStr]?.meta;
    if (view === 'note') setInputValue(d?.note || '');
    if (view === 'event') setInputValue(d?.event || '');
    setSheetView(view);
  };

  const selectedRange = selectedDate ? getDayRangeStyle(selectedDate) : null;
  const targetLockedCycle = selectedRange?.cycle;

  return (
    <div className="min-h-screen bg-background pb-24 select-none max-w-4xl mx-auto w-full px-4 md:px-6 pt-6">
      
      {/* NATIVE CALENDAR HEADER */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          {format(currentDate, 'MMMM yyyy')}
        </h1>
        <div className="flex items-center gap-1">
          <button 
            onClick={() => setCurrentDate(new Date())} 
            className="text-xs font-bold text-purple-600 dark:text-purple-400 mr-2 px-3 py-1.5 rounded-full bg-purple-500/10 hover:bg-purple-500/20 active:scale-95 transition-all"
          >
            Today
          </button>
          <button 
            onClick={prevMonth} 
            className="p-2 active:bg-secondary rounded-full text-foreground hover:bg-secondary/60 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button 
            onClick={nextMonth} 
            className="p-2 active:bg-secondary rounded-full text-foreground hover:bg-secondary/60 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* CALENDAR GRID */}
      <div className="bg-card rounded-3xl border border-border/40 p-4 shadow-sm mb-6">
        <div className="grid grid-cols-7 mb-3">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="text-center text-[11px] font-extrabold text-muted-foreground uppercase tracking-widest py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-1">
          {daysInMonth.map((day, i) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const isSel = selectedDate ? isSameDay(day, selectedDate) : false;
            const range = getDayRangeStyle(day);
            const dayMeta = monthData[dateStr]?.meta;
            const hasEvent = !!dayMeta?.event;
            const hasNote = !!dayMeta?.note;

            return (
              <CalendarDay
                key={i}
                day={day}
                currentDate={currentDate}
                isSel={isSel}
                range={range}
                hasNote={hasNote}
                hasEvent={hasEvent}
                handleDateTap={handleDateTap}
              />
            );
          })}
        </div>
      </div>

      {/* SUMMARY CARD */}
      {predictions && wellnessMode !== 'pregnancy' && (
        <div className="bg-card rounded-3xl border border-border/40 p-5 shadow-sm flex items-center justify-between gap-2">
          <div className="flex flex-col flex-1 border-r border-border/40 pr-3">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">Cycle Day</span>
            <span className="text-2xl font-extrabold text-foreground">{predictions.currentCycleDay}</span>
          </div>
          <div className="flex flex-col flex-1 text-center border-r border-border/40 px-3">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">Phase</span>
            <span className="text-xl font-extrabold text-foreground">{predictions.currentPhase}</span>
          </div>
          <div className="flex flex-col flex-1 text-right pl-3">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">
              {predictions.isPcos ? 'PCOD Window' : 'Next Period'}
            </span>
            <span className="text-xl font-extrabold text-pink-500">
              {predictions.daysRemaining === 0 ? 'Today' : `${predictions.daysRemaining}d`}
            </span>
          </div>
        </div>
      )}

      {/* BOTTOM SHEET MENU */}
      <AnimatePresence>
        {selectedDate && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDate(null)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: '100%' }} 
              animate={{ y: 0 }} 
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-[36px] border-t border-border/40 shadow-2xl max-h-[85dvh] pb-[max(1.5rem,calc(1rem+env(safe-area-inset-bottom)))] flex flex-col max-w-xl mx-auto"
            >

              <div className="w-12 h-1.5 rounded-full bg-border/60 mx-auto mt-4 mb-2 shrink-0" />
              
              {/* SHEET HEADER */}
              <div className="px-6 pb-3 pt-2 flex items-center justify-between shrink-0 border-b border-border/20">
                {sheetView !== 'menu' && sheetView !== 'locked' ? (
                  <button 
                    onClick={() => setSheetView(targetLockedCycle && !unlockedCycleId ? 'locked' : 'menu')} 
                    className="p-2 -ml-2 rounded-full active:bg-secondary text-foreground hover:bg-secondary/60"
                  >
                    <ArrowLeft size={20} />
                  </button>
                ) : (
                  <div>
                    <h3 className="text-xl font-bold text-foreground">{format(selectedDate, 'EEEE')}</h3>
                    <p className="text-xs font-semibold text-muted-foreground">{format(selectedDate, 'MMMM d, yyyy')}</p>
                  </div>
                )}
                
                <button 
                  onClick={() => setSelectedDate(null)} 
                  className="p-2 bg-secondary/80 rounded-full active:scale-95 text-muted-foreground hover:text-foreground transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              {/* SHEET CONTENT BODY */}
              <div className="px-6 py-6 overflow-y-auto flex-1 space-y-3">
                
                {/* LOCKED CYCLE VIEW */}
                {sheetView === 'locked' && targetLockedCycle && (
                  <div className="space-y-4">
                    <div className="flex flex-col items-center text-center p-6 bg-pink-500/10 rounded-3xl border border-pink-500/20">
                      <div className="w-14 h-14 rounded-full bg-pink-500/20 flex items-center justify-center mb-3 text-pink-500">
                        <CheckCircle2 className="w-8 h-8" />
                      </div>
                      <h4 className="text-lg font-bold text-foreground">Completed Cycle</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {safeFormat(targetLockedCycle.start_date, 'MMM d, yyyy')} → {safeFormat(targetLockedCycle.end_date, 'MMM d, yyyy')}
                      </p>
                      <p className="text-xs font-semibold text-pink-600 dark:text-pink-400 mt-2">
                        Duration: {differenceInDays(new Date(targetLockedCycle.end_date!), new Date(targetLockedCycle.start_date)) + 1} Days
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <button 
                        onClick={() => setSheetView('view_cycle')} 
                        className="flex items-center justify-center gap-2 p-4 rounded-2xl bg-secondary hover:bg-secondary/80 transition-colors text-foreground font-bold active:scale-95 border border-border/40 text-sm"
                      >
                        <Eye className="w-4 h-4 text-purple-500" />
                        View Cycle
                      </button>
                      
                      <button 
                        onClick={() => {
                          setUnlockedCycleId(targetLockedCycle.id);
                          setSheetView('menu');
                        }} 
                        className="flex items-center justify-center gap-2 p-4 rounded-2xl bg-purple-600 hover:bg-purple-700 transition-colors text-white font-bold active:scale-95 shadow-md text-sm"
                      >
                        <Edit3 className="w-4 h-4" />
                        Edit Cycle
                      </button>
                    </div>
                  </div>
                )}

                {/* VIEW CYCLE DETAILS VIEW */}
                {sheetView === 'view_cycle' && targetLockedCycle && (
                  <div className="space-y-4">
                    <div className="p-4 bg-secondary/40 rounded-2xl space-y-2 border border-border/30">
                      <h4 className="font-bold text-sm text-foreground mb-2">Cycle Log Details</h4>
                      <div className="flex justify-between text-xs py-1 border-b border-border/20">
                        <span className="text-muted-foreground">Start Date:</span>
                        <span className="font-bold">{safeFormat(targetLockedCycle.start_date, 'MMMM d, yyyy')}</span>
                      </div>
                      <div className="flex justify-between text-xs py-1 border-b border-border/20">
                        <span className="text-muted-foreground">End Date:</span>
                        <span className="font-bold">{safeFormat(targetLockedCycle.end_date, 'MMMM d, yyyy')}</span>
                      </div>
                      <div className="flex justify-between text-xs py-1">
                        <span className="text-muted-foreground">Cycle Duration:</span>
                        <span className="font-bold text-pink-500">
                          {differenceInDays(new Date(targetLockedCycle.end_date!), new Date(targetLockedCycle.start_date)) + 1} Days
                        </span>
                      </div>
                    </div>

                    <button 
                      onClick={() => setSheetView('locked')} 
                      className="w-full py-3 rounded-2xl bg-secondary text-foreground font-bold text-sm"
                    >
                      Back
                    </button>
                  </div>
                )}

                {/* STANDARD MENU VIEW */}
                {sheetView === 'menu' && (
                  <div className="space-y-2.5">
                    
                    {/* UNLOCKED EDITING BANNER */}
                    {unlockedCycleId && (
                      <div className="px-4 py-3 bg-purple-500/15 border border-purple-500/30 text-purple-600 dark:text-purple-300 rounded-2xl text-xs font-bold flex items-center justify-between mb-3">
                        <span>Editing Completed Cycle</span>
                        <button 
                          onClick={() => {
                            setUnlockedCycleId(null);
                            setSelectedDate(null);
                            toast.success('Cycle changes saved & locked.');
                          }} 
                          className="px-3 py-1 bg-purple-600 text-white rounded-full text-xs hover:bg-purple-700 shadow-sm"
                        >
                          Save & Lock
                        </button>
                      </div>
                    )}

                    {/* DYNAMIC LOG OPTIONS BASED ON CYCLE STATE */}
                    {wellnessMode === 'pregnancy' ? (
                      <button 
                        onClick={logPregnancyEnd} 
                        className="w-full flex items-center gap-4 p-4 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 transition-colors text-left border border-amber-500/30 active:scale-98"
                      >
                        <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                          <Baby className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-base font-bold text-foreground">Pregnancy Ended</span>
                          <span className="text-xs text-muted-foreground">Complete pregnancy tracking</span>
                        </div>
                      </button>
                    ) : unlockedCycleId ? (
                      <>
                        <button 
                          onClick={logPeriodStart} 
                          className="w-full flex items-center gap-4 p-4 rounded-2xl bg-pink-500/10 hover:bg-pink-500/20 transition-colors text-left border border-pink-500/30 active:scale-98"
                        >
                          <div className="w-10 h-10 rounded-full bg-pink-500/20 flex items-center justify-center shrink-0">
                            <Droplets className="w-5 h-5 text-pink-500" />
                          </div>
                          <span className="text-base font-bold text-foreground">Update Period Start</span>
                        </button>

                        <button 
                          onClick={logPeriodEnd} 
                          className="w-full flex items-center gap-4 p-4 rounded-2xl bg-pink-500/10 hover:bg-pink-500/20 transition-colors text-left border border-pink-500/30 active:scale-98"
                        >
                          <div className="w-10 h-10 rounded-full bg-pink-500/20 flex items-center justify-center shrink-0">
                            <CalendarCheck className="w-5 h-5 text-pink-500" />
                          </div>
                          <span className="text-base font-bold text-foreground">Update Period End</span>
                        </button>

                        <button 
                          onClick={() => deleteCycle(unlockedCycleId)} 
                          className="w-full flex items-center gap-4 p-4 rounded-2xl bg-red-500/10 hover:bg-red-500/20 transition-colors text-left border border-red-500/30 text-red-500 active:scale-98"
                        >
                          <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                            <Trash2 className="w-5 h-5 text-red-500" />
                          </div>
                          <span className="text-base font-bold">Delete Cycle</span>
                        </button>
                      </>
                    ) : activeCycle ? (
                      // ACTIVE CYCLE OPEN (Show ONLY Period Ended)
                      <button 
                        onClick={logPeriodEnd} 
                        className="w-full flex items-center gap-4 p-4 rounded-2xl bg-pink-500/10 hover:bg-pink-500/20 transition-colors text-left border border-pink-500/30 active:scale-98"
                      >
                        <div className="w-10 h-10 rounded-full bg-pink-500/20 flex items-center justify-center shrink-0">
                          <CalendarCheck className="w-5 h-5 text-pink-500" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-base font-bold text-foreground">
                            {selectedDate ? `Period Ended on ${format(selectedDate, 'MMM d')}` : 'Period Ended'}
                          </span>
                          <span className="text-xs text-muted-foreground">Complete active period range</span>
                        </div>
                      </button>
                    ) : (
                      // NO ACTIVE CYCLE (Show Period Started & Period Ended & Pregnancy Started)
                      <>
                        <button 
                          onClick={logPeriodStart} 
                          className="w-full flex items-center gap-4 p-4 rounded-2xl bg-pink-500/10 hover:bg-pink-500/20 transition-colors text-left border border-pink-500/30 active:scale-98"
                        >
                          <div className="w-10 h-10 rounded-full bg-pink-500/20 flex items-center justify-center shrink-0">
                            <Droplets className="w-5 h-5 text-pink-500" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-base font-bold text-foreground">
                              {selectedDate ? `Period Began on ${format(selectedDate, 'MMM d')} 🌸` : 'Period Began 🌸'}
                            </span>
                            <span className="text-xs text-muted-foreground">Log start of new cycle</span>
                          </div>
                        </button>

                        <button 
                          onClick={logPeriodEnd} 
                          className="w-full flex items-center gap-4 p-4 rounded-2xl bg-pink-500/10 hover:bg-pink-500/20 transition-colors text-left border border-pink-500/30 active:scale-98"
                        >
                          <div className="w-10 h-10 rounded-full bg-pink-500/20 flex items-center justify-center shrink-0">
                            <CalendarCheck className="w-5 h-5 text-pink-500" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-base font-bold text-foreground">
                              {selectedDate ? `Period Completed on ${format(selectedDate, 'MMM d')} 🌿` : 'Period Completed 🌿'}
                            </span>
                            <span className="text-xs text-muted-foreground">Log end date for active period</span>
                          </div>
                        </button>

                        <button 
                          onClick={logPregnancyStart} 
                          className="w-full flex items-center gap-4 p-4 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 transition-colors text-left border border-amber-500/30 active:scale-98"
                        >
                          <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                            <Baby className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-base font-bold text-foreground">Pregnancy Journey Began 👶</span>
                            <span className="text-xs text-muted-foreground">Begin your pregnancy & motherhood care</span>
                          </div>
                        </button>
                      </>
                    )}

                    <div className="w-full h-px bg-border/40 my-3" />

                    {/* CUSTOM EVENT & NOTE BUTTONS */}
                    <button 
                      onClick={() => openView('event')} 
                      className="w-full flex items-center gap-4 p-3.5 rounded-2xl hover:bg-secondary/70 transition-colors text-left border border-border/20"
                    >
                      <div className="w-10 h-10 rounded-full bg-purple-500/15 flex items-center justify-center shrink-0">
                        <CalendarHeart className="w-5 h-5 text-purple-500" />
                      </div>
                      <span className="text-sm font-semibold text-foreground">Add Custom Event</span>
                    </button>

                    <button 
                      onClick={() => openView('note')} 
                      className="w-full flex items-center gap-4 p-3.5 rounded-2xl hover:bg-secondary/70 transition-colors text-left border border-border/20"
                    >
                      <div className="w-10 h-10 rounded-full bg-slate-500/15 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                      </div>
                      <span className="text-sm font-semibold text-foreground">Add Note</span>
                    </button>

                    <button 
                      onClick={() => openView('symptoms')} 
                      className="w-full flex items-center gap-4 p-3.5 rounded-2xl hover:bg-secondary/70 transition-colors text-left border border-border/20"
                    >
                      <div className="w-10 h-10 rounded-full bg-pink-500/15 flex items-center justify-center shrink-0">
                        <Sparkles className="w-5 h-5 text-pink-500" />
                      </div>
                      <span className="text-sm font-semibold text-foreground">Log Symptoms</span>
                    </button>

                  </div>
                )}

                {/* ADD NOTE / EVENT VIEW */}
                {(sheetView === 'note' || sheetView === 'event') && (
                  <div className="space-y-4 pt-1">
                    <h4 className="font-bold text-sm text-foreground capitalize">
                      {sheetView === 'note' ? 'Add Note' : 'Add Custom Event'}
                    </h4>
                    <textarea 
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder={sheetView === 'note' ? 'Write your note here...' : 'Event details (e.g. Doctor appointment, ovulation test)'}
                      className="w-full p-4 rounded-2xl bg-secondary/60 border border-border/40 resize-none min-h-[130px] text-foreground text-sm focus:outline-none focus:border-purple-500"
                    />
                    <button 
                      onClick={() => saveCheckinMeta(sheetView === 'note' ? { note: inputValue } : { event: inputValue })}
                      className="w-full py-3.5 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm shadow-md active:scale-95 transition-all"
                    >
                      Save {sheetView === 'note' ? 'Note' : 'Event'}
                    </button>
                  </div>
                )}

                {/* SYMPTOMS VIEW */}
                {sheetView === 'symptoms' && (
                  <div className="space-y-4 pt-1">
                    <h4 className="font-bold text-sm text-foreground">Log Daily Symptoms</h4>
                    <div className="flex flex-wrap gap-2">
                      {['Cramps', 'Bloating', 'Fatigue', 'Headache', 'Nausea', 'Backache', 'Tender Breasts', 'Acne', 'Mood Swings'].map(sym => {
                        const dateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
                        const currentSymptoms = monthData[dateStr]?.meta?.symptoms || [];
                        const isActive = currentSymptoms.includes(sym);
                        return (
                          <button 
                            key={sym}
                            onClick={() => {
                              const next = isActive 
                                ? currentSymptoms.filter((s: string) => s !== sym) 
                                : [...currentSymptoms, sym];
                              saveCheckinMeta({ symptoms: next });
                            }}
                            className={`px-4 py-2.5 rounded-full text-xs font-bold transition-all ${
                              isActive 
                                ? 'bg-pink-600 text-white shadow-sm' 
                                : 'bg-secondary text-foreground hover:bg-secondary/80'
                            }`}
                          >
                            {sym}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
