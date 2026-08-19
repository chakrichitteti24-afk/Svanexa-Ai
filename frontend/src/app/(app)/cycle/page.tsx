'use client';

import React, { useState, useEffect, useMemo, memo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addDays,
  isWithinInterval,
  differenceInDays,
  startOfDay,
  subDays,
} from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  Droplets,
  X,
  Sparkles,
  FileText,
  CalendarCheck,
  Baby,
  ArrowLeft,
  CalendarHeart,
  Edit3,
  Eye,
  Trash2,
  CheckCircle2,
  Activity,
  Apple,
  Dumbbell,
  Pill,
  Heart,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  Info,
  Flame,
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useHerSync } from '@/context/HerSyncContext';
import { toast } from 'sonner';
import { safeFormat } from '@/utils/date-utils';
import {
  CycleIntelligenceEngine,
  PhaseDetails,
  FertileWindowResult,
  LatePeriodAnalysis,
  CycleAnalytics,
} from '@/lib/services/cycle-intelligence';

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
const CalendarDay = memo(
  ({ day, currentDate, isSel, range, hasNote, hasEvent, hasSymptoms, handleDateTap }: any) => {
    const isCurrentMonth = isSameMonth(day, currentDate);
    const today = isToday(day);

    let rangeStyle = 'w-10 rounded-full mx-auto';
    let textStyle = !isCurrentMonth ? 'text-muted-foreground/30' : 'text-muted-foreground font-medium';

    if (range.inRange) {
      if (range.type === 'period') {
        textStyle = 'text-white font-bold';
        if (range.isStart && range.isEnd) {
          rangeStyle =
            'w-10 h-10 rounded-full bg-gradient-to-tr from-pink-600 to-rose-500 text-white font-bold shadow-md shadow-pink-500/30 mx-auto flex items-center justify-center';
        } else if (range.isStart) {
          rangeStyle =
            'w-full h-10 rounded-l-full rounded-r-none bg-pink-500 text-white font-bold flex items-center justify-center';
        } else if (range.isEnd) {
          rangeStyle =
            'w-full h-10 rounded-r-full rounded-l-none bg-pink-500 text-white font-bold flex items-center justify-center';
        } else {
          rangeStyle =
            'w-full h-10 rounded-none bg-pink-500 text-white font-bold flex items-center justify-center';
        }
      } else if (range.type === 'pregnancy') {
        textStyle = 'text-white font-bold';
        if (range.isStart && range.isEnd) {
          rangeStyle =
            'w-9 h-9 rounded-full bg-amber-500 text-white font-bold shadow-md mx-auto flex items-center justify-center';
        } else if (range.isStart) {
          rangeStyle =
            'w-full h-9 rounded-l-full rounded-r-none bg-amber-500 text-white font-bold flex items-center justify-center';
        } else if (range.isEnd) {
          rangeStyle =
            'w-full h-9 rounded-r-full rounded-l-none bg-amber-500 text-white font-bold flex items-center justify-center';
        } else {
          rangeStyle =
            'w-full h-9 rounded-none bg-amber-500/70 text-white font-bold flex items-center justify-center';
        }
      } else if (range.type === 'predicted_period') {
        textStyle = 'text-pink-400 font-bold';
        if (range.isStart && range.isEnd) {
          rangeStyle =
            'w-9 h-9 rounded-full border-2 border-dashed border-pink-400/80 bg-pink-500/15 mx-auto flex items-center justify-center';
        } else if (range.isStart) {
          rangeStyle =
            'w-full h-9 rounded-l-full rounded-r-none border-y-2 border-l-2 border-dashed border-pink-400/80 bg-pink-500/15 flex items-center justify-center';
        } else if (range.isEnd) {
          rangeStyle =
            'w-full h-9 rounded-r-full rounded-l-none border-y-2 border-r-2 border-dashed border-pink-400/80 bg-pink-500/15 flex items-center justify-center';
        } else {
          rangeStyle =
            'w-full h-9 rounded-none border-y-2 border-dashed border-pink-400/80 bg-pink-500/15 flex items-center justify-center';
        }
      } else if (range.type === 'fertile_window') {
        textStyle = 'text-purple-300 font-bold';
        if (range.isOvulation) {
          rangeStyle =
            'w-9 h-9 rounded-full bg-violet-600/50 border-2 border-violet-400 text-white font-extrabold shadow-sm shadow-violet-500/30 mx-auto flex items-center justify-center';
        } else if (range.isStart && range.isEnd) {
          rangeStyle =
            'w-9 h-9 rounded-full bg-violet-500/20 border border-violet-500/40 mx-auto flex items-center justify-center';
        } else if (range.isStart) {
          rangeStyle =
            'w-full h-9 rounded-l-full rounded-r-none bg-violet-500/20 border-y border-l border-violet-500/40 flex items-center justify-center';
        } else if (range.isEnd) {
          rangeStyle =
            'w-full h-9 rounded-r-full rounded-l-none bg-violet-500/20 border-y border-r border-violet-500/40 flex items-center justify-center';
        } else {
          rangeStyle =
            'w-full h-9 rounded-none bg-violet-500/20 border-y border-violet-500/40 flex items-center justify-center';
        }
      }
    } else if (today && !isSel) {
      rangeStyle =
        'w-9 h-9 border-2 border-pink-500 rounded-full text-pink-400 font-bold mx-auto flex items-center justify-center';
    }

    const isPeriod = range.inRange && range.type === 'period';

    return (
      <div className="flex flex-col items-center justify-center h-11 min-h-[44px] relative w-full">
        <button
          onClick={() => handleDateTap(day)}
          aria-label={`Select date ${format(day, 'MMMM d, yyyy')}`}
          className={`relative h-10 min-h-[40px] w-full flex items-center justify-center text-sm transition-all active:scale-95 touch-manipulation select-none ${rangeStyle} ${textStyle}`}
        >
          {isSel ? (
            <span
              className={`w-9 h-9 rounded-full ${
                isPeriod
                  ? 'bg-pink-600 ring-2 ring-white text-white'
                  : 'bg-pink-500/25 text-pink-300 font-bold border-2 border-pink-400'
              } font-bold flex items-center justify-center shadow-lg transform scale-105 transition-transform`}
            >
              {format(day, 'd')}
            </span>
          ) : (
            <span className="flex items-center justify-center">
              {format(day, 'd')}
              {range.isOvulation && (
                <span className="absolute -top-1 right-1 text-[9px]" title="Predicted Ovulation Day">
                  ✨
                </span>
              )}
            </span>
          )}

          {/* Indicators for Notes, Custom Events & Symptoms */}
          {!isSel && (hasEvent || hasNote || hasSymptoms) && (
            <div className="absolute bottom-0.5 flex items-center justify-center gap-0.5">
              {hasSymptoms && (
                <span className="w-1.5 h-1.5 bg-pink-400 rounded-full" title="Logged Symptoms" />
              )}
              {hasEvent && (
                <span className="w-1.5 h-1.5 bg-violet-400 rounded-full" title="Custom Event" />
              )}
              {hasNote && (
                <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full" title="Note" />
              )}
            </div>
          )}
        </button>
      </div>
    );
  }
);

CalendarDay.displayName = 'CalendarDay';

export default function CycleTrackerPage() {
  const supabase = createClient();
  const {
    cycleHistory,
    setCycleHistory,
    wellnessMode,
    refreshAll,
    refreshCycleHistory,
    pregnancyDueDate,
  } = useHerSync();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [sheetView, setSheetView] = useState<
    'menu' | 'note' | 'event' | 'symptoms' | 'flow' | 'mucus' | 'locked' | 'view_cycle'
  >('menu');
  const [monthData, setMonthData] = useState<Record<string, any>>({});
  const [inputValue, setInputValue] = useState<any>('');
  const [unlockedCycleId, setUnlockedCycleId] = useState<string | null>(null);

  // Active Phase Tabs
  const [activePhaseTab, setActivePhaseTab] = useState<'nutrition' | 'workout' | 'pcos' | 'fertility'>('nutrition');

  // Find active cycle (period started, but no end date logged yet or end_date === start_date)
  const activeCycle = useMemo(() => {
    return cycleHistory.find(c => !c.end_date || c.end_date === c.start_date);
  }, [cycleHistory]);

  // Fetch month logs (checkins, custom events, notes)
  const fetchMonth = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
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

  // Initialize Advanced Cycle Intelligence Engine
  const intelligenceEngine = useMemo(() => {
    const cycleEntries = (cycleHistory || []).map(c => ({
      id: c.id,
      startDate: c.start_date,
      endDate: c.end_date,
      flowIntensity: c.flow_intensity as any,
      symptoms: c.symptoms,
    }));

    const checkInEntries: Record<string, any> = {};
    Object.entries(monthData).forEach(([dateStr, val]) => {
      checkInEntries[dateStr] = {
        mood: val.checkin?.mood,
        sleep: val.checkin?.sleep,
        water: val.checkin?.water,
        exercise: val.checkin?.exercise,
        stress: val.checkin?.stress,
        cramps: val.meta?.symptoms?.includes('Cramps') ? 'moderate' : 'none',
        bloating: val.meta?.symptoms?.includes('Bloating') ? 'moderate' : 'none',
        cervicalMucus: val.meta?.cervicalMucus,
        notes: val.meta?.note,
      };
    });

    return new CycleIntelligenceEngine(cycleEntries, checkInEntries, wellnessMode === 'pcos');
  }, [cycleHistory, monthData, wellnessMode]);

  // Analytics & Forecasts
  const analytics: CycleAnalytics = useMemo(() => {
    return intelligenceEngine.analyzeCycles();
  }, [intelligenceEngine]);

  const predictions = useMemo(() => {
    return intelligenceEngine.predictNextPeriod();
  }, [intelligenceEngine]);

  const fertilityInfo: FertileWindowResult | null = useMemo(() => {
    return intelligenceEngine.predictOvulationAndFertility(new Date());
  }, [intelligenceEngine]);

  // Current Cycle Day and Phase details
  const cycleDay = useMemo(() => {
    if (!cycleHistory || cycleHistory.length === 0) return 1;
    const lastCycle = cycleHistory[0];
    const lastStartDate = new Date(lastCycle.start_date);
    const today = new Date();
    const diff = differenceInDays(today, lastStartDate) + 1;
    return Math.max(1, diff);
  }, [cycleHistory]);

  const phaseDetails: PhaseDetails = useMemo(() => {
    return intelligenceEngine.getCurrentPhaseDetails(cycleDay);
  }, [intelligenceEngine, cycleDay]);

  const lateAnalysis: LatePeriodAnalysis = useMemo(() => {
    return intelligenceEngine.getLatePeriodAnalysis(cycleDay);
  }, [intelligenceEngine, cycleDay]);

  const daysRemaining = useMemo(() => {
    if (!predictions) return 0;
    const today = new Date();
    return differenceInDays(predictions.likelyDate, today);
  }, [predictions]);

  // Centralized Date Range Engine with Fertile Window + Ovulation
  const getDayRangeStyle = (day: Date) => {
    const currentTs = getNormalizedTimestamp(day)!;

    // 1. Logged Period Cycle Ranges
    for (const c of cycleHistory) {
      if (!c.start_date) continue;
      const startTs = getNormalizedTimestamp(c.start_date)!;
      const endTs = c.end_date ? getNormalizedTimestamp(c.end_date) : null;
      const isLocked = endTs !== null && c.id !== unlockedCycleId;

      if (endTs === null || c.end_date === c.start_date) {
        // Active cycle (Period Start logged, Period End pending)
        if (currentTs === startTs) {
          return {
            type: 'period',
            inRange: true,
            isStart: true,
            isEnd: true,
            isLocked: false,
            cycle: c,
          };
        }
      } else {
        let sTs = startTs;
        let eTs = endTs;
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
            cycle: c,
          };
        }
      }
    }

    // 2. Predicted Future Period Range
    if (predictions?.earliestDate && predictions?.latestDate) {
      const predStartTs = getNormalizedTimestamp(predictions.earliestDate)!;
      const predEndTs = getNormalizedTimestamp(predictions.latestDate)!;

      if (currentTs >= predStartTs && currentTs <= predEndTs) {
        return {
          type: 'predicted_period',
          inRange: true,
          isStart: currentTs === predStartTs,
          isEnd: currentTs === predEndTs,
          isLocked: false,
          cycle: null,
        };
      }
    }

    // 3. Fertile Window & Predicted Ovulation
    if (fertilityInfo?.fertileWindowStart && fertilityInfo?.fertileWindowEnd) {
      const fertileStartTs = getNormalizedTimestamp(fertilityInfo.fertileWindowStart)!;
      const fertileEndTs = getNormalizedTimestamp(fertilityInfo.fertileWindowEnd)!;
      const ovulationTs = getNormalizedTimestamp(fertilityInfo.predictedOvulationDate)!;

      if (currentTs >= fertileStartTs && currentTs <= fertileEndTs) {
        return {
          type: 'fertile_window',
          inRange: true,
          isStart: currentTs === fertileStartTs,
          isEnd: currentTs === fertileEndTs,
          isOvulation: currentTs === ovulationTs,
          isLocked: false,
          cycle: null,
        };
      }
    }

    // 4. Pregnancy Range
    if (wellnessMode === 'pregnancy' && pregnancyDueDate) {
      const dueTs = getNormalizedTimestamp(pregnancyDueDate)!;
      const pregStartTs = dueTs - 280 * 86400000;
      const todayTs = getNormalizedTimestamp(new Date())!;
      const endBoundaryTs = todayTs < dueTs ? todayTs : dueTs;

      if (currentTs >= pregStartTs && currentTs <= endBoundaryTs) {
        return {
          type: 'pregnancy',
          inRange: true,
          isStart: currentTs === pregStartTs,
          isEnd: currentTs === endBoundaryTs,
          isLocked: false,
          cycle: null,
        };
      }
    }

    return { type: null, isStart: false, isEnd: false, inRange: false, isLocked: false, cycle: null };
  };

  const daysInMonth = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentDate)),
    end: endOfWeek(endOfMonth(currentDate)),
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
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const dateStr = format(selectedDate, 'yyyy-MM-dd');

      if (unlockedCycleId) {
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

        const optimisticHistory = cycleHistory.map(c =>
          c.id === unlockedCycleId ? { ...c, start_date: dateStr } : c
        );
        setCycleHistory(optimisticHistory);

        const { data: updatedData } = await supabase
          .from('cycle_logs')
          .update({ start_date: dateStr })
          .eq('id', unlockedCycleId)
          .select()
          .single();
        if (updatedData) {
          setCycleHistory(cycleHistory.map(c => (c.id === unlockedCycleId ? updatedData : c)));
        }
        toast.success('Period start updated.');
      } else {
        const { data: latestCycle } = await supabase
          .from('cycle_logs')
          .select('*')
          .eq('user_id', user.id)
          .order('start_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        const existingActive =
          latestCycle && (!latestCycle.end_date || latestCycle.end_date === latestCycle.start_date)
            ? latestCycle
            : null;

        if (existingActive) {
          const oldStartTs = getNormalizedTimestamp(existingActive.start_date)!;
          const newStartTs = getNormalizedTimestamp(selectedDate)!;
          const diffDays = Math.abs(differenceInDays(new Date(newStartTs), new Date(oldStartTs)));

          if (diffDays > 14) {
            const autoEndDate = format(addDays(new Date(existingActive.start_date), 4), 'yyyy-MM-dd');
            await supabase.from('cycle_logs').update({ end_date: autoEndDate }).eq('id', existingActive.id);

            const { data: insertedData, error } = await supabase
              .from('cycle_logs')
              .insert({ user_id: user.id, start_date: dateStr, end_date: dateStr })
              .select()
              .single();
            if (error || !insertedData) throw error;

            setCycleHistory([
              insertedData,
              ...cycleHistory.map(c => (c.id === existingActive.id ? { ...c, end_date: autoEndDate } : c)),
            ]);
            toast.success('Period start logged.');
          } else {
            const { data: updatedData, error } = await supabase
              .from('cycle_logs')
              .update({ start_date: dateStr, end_date: dateStr })
              .eq('id', existingActive.id)
              .select()
              .single();
            if (error || !updatedData) throw error;

            setCycleHistory(cycleHistory.map(c => (c.id === existingActive.id ? updatedData : c)));
            toast.success('Period start updated.');
          }
        } else {
          const tempId = `temp-${Date.now()}`;
          const newCycle = {
            id: tempId,
            start_date: dateStr,
            end_date: dateStr,
            flow_intensity: null,
            symptoms: null,
          };
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
          toast.success('Period start logged.');
        }
      }

      setUnlockedCycleId(null);
      setSelectedDate(null);
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
      const {
        data: { user },
      } = await supabase.auth.getUser();
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

      const optimisticHistory = cycleHistory
        .map(c => (c.id === targetCycle.id ? { ...c, end_date: dateStr } : c))
        .filter(c => c.id === targetCycle.id || c.end_date !== null);
      setCycleHistory(optimisticHistory);

      const { data: updatedData, error } = await supabase
        .from('cycle_logs')
        .update({ end_date: dateStr })
        .eq('id', targetCycle.id)
        .select()
        .single();
      if (error) {
        setCycleHistory(cycleHistory);
        throw error;
      }
      if (updatedData) {
        setCycleHistory(optimisticHistory.map(c => (c.id === targetCycle.id ? updatedData : c)));
      }

      const staleActives = cycleHistory.filter(
        c => (!c.end_date || c.end_date === c.start_date) && c.id !== targetCycle.id
      );
      for (const stale of staleActives) {
        if (!stale.id.startsWith('temp-')) {
          await supabase.from('cycle_logs').delete().eq('id', stale.id);
        }
      }

      toast.success('Period ended. Cycle completed & saved!');
      setUnlockedCycleId(null);
      setSelectedDate(null);
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

  // Save Note / Event / Symptoms / Flow / Cervical Mucus
  const saveCheckinMeta = async (updates: any) => {
    if (!selectedDate) return;
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const {
        data: { user },
      } = await supabase.auth.getUser();
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
        const { error: insertErr } = await supabase.from('daily_checkins').insert({
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
    <div className="min-h-screen bg-background pb-32 select-none max-w-4xl mx-auto w-full px-3 sm:px-6 pt-4 sm:pt-6 space-y-6">
      {/* ─────────────────────────────────────────────────────────────────
          TOP TITLE & WELLNESS MODE BADGE
          ───────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
              Cycle & Period Care
            </h1>
            <span
              className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                wellnessMode === 'pcos'
                  ? 'bg-pink-500/10 text-pink-400 border-pink-500/30'
                  : wellnessMode === 'pregnancy'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  : 'bg-purple-500/10 text-purple-400 border-purple-500/30'
              }`}
            >
              {wellnessMode === 'pcos'
                ? '✨ PCOS Adaptive Care'
                : wellnessMode === 'pregnancy'
                ? '🤰 Pregnancy Tracking'
                : '🌸 General Wellness'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Clinical cycle endocrinology, fertile window forecasts & hormonal phase sync
          </p>
        </div>

        {/* Quick Log Action */}
        <button
          type="button"
          onClick={() => {
            setSelectedDate(new Date());
            setSheetView('menu');
          }}
          className="px-4 py-2 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 hover:opacity-95 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-pink-500/20 active:scale-95 transition-all self-start sm:self-auto cursor-pointer"
        >
          <Droplets className="w-3.5 h-3.5" />
          <span>{activeCycle ? 'Complete Active Period' : 'Log Today’s Period'}</span>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          LATE / DELAYED PERIOD CLINICAL ASSISTANT BANNER
          ───────────────────────────────────────────────────────────────── */}
      {lateAnalysis.isDelayed && wellnessMode !== 'pregnancy' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 sm:p-5 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-foreground space-y-2.5 shadow-md shadow-amber-950/20"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Cycle Day {lateAnalysis.currentCycleDay} — Period {lateAnalysis.daysLate} Day{lateAnalysis.daysLate > 1 ? 's' : ''} Later Than Average</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {lateAnalysis.severity}
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {lateAnalysis.pcosExplanation}
          </p>
          <div className="pt-1.5 border-t border-amber-500/20 flex flex-wrap gap-2 text-[11px] text-amber-200">
            <span className="font-semibold text-amber-400">Recommended Steps:</span>
            {lateAnalysis.actionPlan.slice(0, 2).map((step, idx) => (
              <span key={idx} className="inline-flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-md">
                • {step}
              </span>
            ))}
          </div>
        </motion.div>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          1. CALENDAR VIEW WITH MONTH NAVIGATION
          ───────────────────────────────────────────────────────────────── */}
      <div className="bg-card/70 backdrop-blur-xl rounded-3xl border border-border/40 p-4 sm:p-5 shadow-sm space-y-4">
        {/* Header Month Nav */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-bold text-foreground tracking-tight">
            {format(currentDate, 'MMMM yyyy')}
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentDate(new Date())}
              className="text-xs font-bold text-purple-400 mr-2 px-3 py-1.5 rounded-full bg-purple-500/15 hover:bg-purple-500/25 active:scale-95 transition-all cursor-pointer"
            >
              Today
            </button>
            <button
              onClick={prevMonth}
              className="p-2 active:bg-secondary rounded-full text-foreground hover:bg-secondary/60 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={nextMonth}
              className="p-2 active:bg-secondary rounded-full text-foreground hover:bg-secondary/60 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Weekday Labels */}
        <div className="grid grid-cols-7">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div
              key={d}
              className="text-center text-[11px] font-extrabold text-muted-foreground uppercase tracking-widest py-1"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-y-1">
          {daysInMonth.map((day, i) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const isSel = selectedDate ? isSameDay(day, selectedDate) : false;
            const range = getDayRangeStyle(day);
            const dayMeta = monthData[dateStr]?.meta;
            const hasEvent = !!dayMeta?.event;
            const hasNote = !!dayMeta?.note;
            const hasSymptoms = Array.isArray(dayMeta?.symptoms) && dayMeta.symptoms.length > 0;

            return (
              <CalendarDay
                key={i}
                day={day}
                currentDate={currentDate}
                isSel={isSel}
                range={range}
                hasNote={hasNote}
                hasEvent={hasEvent}
                hasSymptoms={hasSymptoms}
                handleDateTap={handleDateTap}
              />
            );
          })}
        </div>

        {/* Calendar Legend */}
        <div className="pt-3 border-t border-border/30 flex items-center justify-center flex-wrap gap-4 text-[11px] text-muted-foreground font-medium">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-pink-500 shadow-sm" />
            <span>Period Flow</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full border-2 border-dashed border-pink-400 bg-pink-500/20" />
            <span>Predicted Window</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-violet-500/40 border border-violet-400" />
            <span>Fertile Window (✨ Ovulation)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full border-2 border-pink-500" />
            <span>Today</span>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          2. SUMMARY QUICK RADAR
          ───────────────────────────────────────────────────────────────── */}
      {wellnessMode !== 'pregnancy' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-3xl bg-card/60 border border-border/40 shadow-sm">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block mb-1">
              Current Cycle
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-extrabold text-foreground">Day {cycleDay}</span>
              <span className="text-xs text-muted-foreground font-medium">/ {analytics.avgCycleLength}d avg</span>
            </div>
          </div>

          <div className="p-4 rounded-3xl bg-card/60 border border-border/40 shadow-sm">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block mb-1">
              Biological Phase
            </span>
            <span className="text-xl font-extrabold text-pink-400 truncate block">
              {phaseDetails.title.replace(' Phase', '')}
            </span>
          </div>

          <div className="p-4 rounded-3xl bg-card/60 border border-border/40 shadow-sm">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block mb-1">
              Fertility Today
            </span>
            <div className="flex items-center gap-1.5">
              <span
                className={`text-xl font-extrabold ${
                  fertilityInfo?.pregnancyChanceToday === 'Peak'
                    ? 'text-violet-400'
                    : fertilityInfo?.pregnancyChanceToday === 'High'
                    ? 'text-pink-400'
                    : 'text-foreground'
                }`}
              >
                {fertilityInfo?.pregnancyChanceToday || 'Low'}
              </span>
              {fertilityInfo?.isOvulationToday && <span>🌟</span>}
            </div>
          </div>

          <div className="p-4 rounded-3xl bg-card/60 border border-border/40 shadow-sm">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block mb-1">
              {lateAnalysis.isDelayed ? 'Days Delayed' : 'Next Period'}
            </span>
            <span
              className={`text-xl font-extrabold ${
                lateAnalysis.isDelayed ? 'text-amber-400' : 'text-pink-500'
              }`}
            >
              {lateAnalysis.isDelayed
                ? `+${lateAnalysis.daysLate}d Late`
                : daysRemaining === 0
                ? 'Today'
                : daysRemaining > 0
                ? `in ~${daysRemaining}d`
                : 'Due now'}
            </span>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          3. DYNAMIC 4-PHASE HORMONAL BLUEPRINT
          ───────────────────────────────────────────────────────────────── */}
      {wellnessMode !== 'pregnancy' && (
        <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-card/80 via-card/50 to-purple-950/20 border border-purple-500/25 shadow-xl shadow-purple-950/15 space-y-5">
          {/* Phase Header with Progress */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/30 pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-pink-500/15 text-pink-400">
                  <Flame className="w-4 h-4" />
                </span>
                <h3 className="text-lg font-extrabold text-white">{phaseDetails.title}</h3>
                <span className="text-xs text-[#b4a9d9] font-medium">({phaseDetails.dayRangeText})</span>
              </div>
              <p className="text-xs text-[#9d91c4]">{phaseDetails.subTitle}</p>
            </div>

            {/* Hormone Gauges */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] px-2.5 py-1 rounded-full bg-secondary/40 text-[#b4a9d9] border border-border/30">
                Estrogen: <strong className="text-white">{phaseDetails.hormones.estrogen}</strong>
              </span>
              <span className="text-[10px] px-2.5 py-1 rounded-full bg-secondary/40 text-[#b4a9d9] border border-border/30">
                Progesterone: <strong className="text-white">{phaseDetails.hormones.progesterone}</strong>
              </span>
              <span className="text-[10px] px-2.5 py-1 rounded-full bg-secondary/40 text-[#b4a9d9] border border-border/30">
                LH / FSH: <strong className="text-white">{phaseDetails.hormones.fshLh}</strong>
              </span>
            </div>
          </div>

          {/* Body Feel Explanation */}
          <p className="text-xs text-foreground/90 leading-relaxed bg-secondary/20 p-3.5 rounded-2xl border border-border/20">
            {phaseDetails.bodyFeel}
          </p>

          {/* 4 Actionable Phase Guide Tabs */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b border-border/20 pb-2 overflow-x-auto scrollbar-none">
              {[
                { id: 'nutrition', label: '🥗 Nutrition & Foods', icon: Apple },
                { id: 'workout', label: '🏃‍♀️ Fitness & Movement', icon: Dumbbell },
                { id: 'pcos', label: '💊 PCOS & Hormones', icon: Pill },
                { id: 'fertility', label: '🌸 Fertility & Mucus', icon: Heart },
              ].map(tab => {
                const isActive = activePhaseTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActivePhaseTab(tab.id as any)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                      isActive
                        ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40 shadow-sm'
                        : 'bg-secondary/15 text-muted-foreground hover:text-white'
                    }`}
                  >
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Tab Content */}
            <div className="pt-1">
              {activePhaseTab === 'nutrition' && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-white">{phaseDetails.nutrition.highlight}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded-2xl bg-secondary/20 border border-border/20 space-y-1.5">
                      <p className="text-[11px] font-bold text-emerald-400">🌟 Recommended Focus Foods</p>
                      <ul className="text-xs text-[#b4a9d9] space-y-1">
                        {phaseDetails.nutrition.focusFoods.map((f, idx) => (
                          <li key={idx} className="flex items-center gap-1.5">
                            • {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="p-3 rounded-2xl bg-secondary/20 border border-border/20 space-y-1.5">
                      <p className="text-[11px] font-bold text-pink-400">✨ PCOS Blood Sugar Tip</p>
                      <p className="text-xs text-[#b4a9d9] leading-relaxed">
                        {phaseDetails.nutrition.pcosSpecific}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activePhaseTab === 'workout' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-white">Ideal Workout: {phaseDetails.workout.idealType}</p>
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
                      {phaseDetails.workout.intensity}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded-2xl bg-secondary/20 border border-border/20 space-y-1">
                      <p className="text-[11px] font-bold text-violet-400">Suggested Exercises</p>
                      <ul className="text-xs text-[#b4a9d9] space-y-1">
                        {phaseDetails.workout.suggestions.map((s, idx) => (
                          <li key={idx}>• {s}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="p-3 rounded-2xl bg-secondary/20 border border-border/20 space-y-1">
                      <p className="text-[11px] font-bold text-pink-400">Cortisol & Joint Guidance</p>
                      <p className="text-xs text-[#b4a9d9] leading-relaxed">
                        {phaseDetails.workout.pcosGuidance}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activePhaseTab === 'pcos' && (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-white">Phase Focus: {phaseDetails.pcosSupport.focus}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded-2xl bg-secondary/20 border border-border/20 space-y-1">
                      <p className="text-[11px] font-bold text-amber-400">Supportive Supplements</p>
                      <ul className="text-xs text-[#b4a9d9] space-y-1">
                        {phaseDetails.pcosSupport.supplements.map((s, idx) => (
                          <li key={idx}>• {s}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="p-3 rounded-2xl bg-secondary/20 border border-border/20 space-y-1">
                      <p className="text-[11px] font-bold text-purple-400">Hormonal Lifestyle Tips</p>
                      <ul className="text-xs text-[#b4a9d9] space-y-1">
                        {phaseDetails.pcosSupport.lifestyleTips.map((t, idx) => (
                          <li key={idx}>• {t}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {activePhaseTab === 'fertility' && (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-2xl bg-secondary/20 border border-border/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-violet-300">Conception Probability: {phaseDetails.fertility.conceptionChance}</p>
                      {fertilityInfo?.ovulationCountdownDays !== undefined && (
                        <span className="text-[10px] text-[#9d91c4]">
                          {fertilityInfo.ovulationCountdownDays > 0
                            ? `~${fertilityInfo.ovulationCountdownDays} days to ovulation`
                            : 'Ovulation window active'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#b4a9d9] leading-relaxed">
                      <strong>Cervical Fluid:</strong> {phaseDetails.fertility.cervicalMucusExpectation}
                    </p>
                    <p className="text-xs text-[#b4a9d9] leading-relaxed">
                      <strong>Conception Tip:</strong> {phaseDetails.fertility.tip}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          4. CYCLE HISTORY & REGULARITY ANALYTICS
          ───────────────────────────────────────────────────────────────── */}
      <div className="p-5 sm:p-6 rounded-3xl bg-card/60 backdrop-blur-md border border-border/40 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-border/30 pb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-pink-400" />
            <h3 className="text-sm font-bold text-foreground">Cycle Regularity & History Breakdown</h3>
          </div>
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-secondary/40 text-muted-foreground border border-border/30">
            {analytics.regularityStatus}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-2xl bg-secondary/20 border border-border/20">
            <span className="text-[10px] text-muted-foreground font-semibold block mb-0.5">Average Cycle</span>
            <span className="text-lg font-bold text-foreground">{analytics.avgCycleLength} Days</span>
            <span className="text-[9px] text-muted-foreground block">Clinical normal: 21–35d</span>
          </div>

          <div className="p-3 rounded-2xl bg-secondary/20 border border-border/20">
            <span className="text-[10px] text-muted-foreground font-semibold block mb-0.5">Average Period</span>
            <span className="text-lg font-bold text-foreground">{analytics.avgPeriodDuration} Days</span>
            <span className="text-[9px] text-muted-foreground block">Clinical normal: 3–7d</span>
          </div>

          <div className="p-3 rounded-2xl bg-secondary/20 border border-border/20">
            <span className="text-[10px] text-muted-foreground font-semibold block mb-0.5">Consistency Score</span>
            <span className="text-lg font-bold text-emerald-400">{analytics.consistencyScore}%</span>
            <span className="text-[9px] text-muted-foreground block">Std Dev: ±{analytics.stdDev}d</span>
          </div>

          <div className="p-3 rounded-2xl bg-secondary/20 border border-border/20">
            <span className="text-[10px] text-muted-foreground font-semibold block mb-0.5">Logged Cycles</span>
            <span className="text-lg font-bold text-foreground">{analytics.totalCyclesLogged}</span>
            <span className="text-[9px] text-muted-foreground block">Range: {analytics.shortestCycle}–{analytics.longestCycle}d</span>
          </div>
        </div>

        {/* Historical Cycles List */}
        {cycleHistory.length > 0 && (
          <div className="space-y-2 pt-2">
            <p className="text-xs font-semibold text-muted-foreground">Recent Cycle Durations</p>
            <div className="space-y-2">
              {cycleHistory.slice(0, 4).map((cycle, idx) => {
                const duration = cycle.end_date
                  ? differenceInDays(new Date(cycle.end_date), new Date(cycle.start_date)) + 1
                  : null;
                return (
                  <div
                    key={cycle.id || idx}
                    className="p-3 rounded-2xl bg-secondary/15 border border-border/20 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-pink-500" />
                      <span className="font-semibold text-foreground">
                        {safeFormat(cycle.start_date, 'MMM d, yyyy')}
                      </span>
                      {cycle.end_date && (
                        <span className="text-muted-foreground">→ {safeFormat(cycle.end_date, 'MMM d')}</span>
                      )}
                    </div>
                    <span className="font-bold text-pink-400">
                      {duration ? `${duration} days flow` : 'Active period'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          BOTTOM SHEET MODAL FOR DATE LOGGING
          ───────────────────────────────────────────────────────────────── */}
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
              className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-[36px] border-t border-border/40 shadow-2xl max-h-[88dvh] pb-[max(1.5rem,calc(1rem+env(safe-area-inset-bottom)))] flex flex-col max-w-xl mx-auto"
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
                    <p className="text-xs font-semibold text-muted-foreground">
                      {format(selectedDate, 'MMMM d, yyyy')}
                    </p>
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
                        {safeFormat(targetLockedCycle.start_date, 'MMM d, yyyy')} →{' '}
                        {safeFormat(targetLockedCycle.end_date, 'MMM d, yyyy')}
                      </p>
                      <p className="text-xs font-semibold text-pink-400 mt-2">
                        Duration:{' '}
                        {differenceInDays(
                          new Date(targetLockedCycle.end_date!),
                          new Date(targetLockedCycle.start_date)
                        ) + 1}{' '}
                        Days
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
                        <span className="font-bold">
                          {safeFormat(targetLockedCycle.start_date, 'MMMM d, yyyy')}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs py-1 border-b border-border/20">
                        <span className="text-muted-foreground">End Date:</span>
                        <span className="font-bold">
                          {safeFormat(targetLockedCycle.end_date, 'MMMM d, yyyy')}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs py-1">
                        <span className="text-muted-foreground">Cycle Duration:</span>
                        <span className="font-bold text-pink-500">
                          {differenceInDays(
                            new Date(targetLockedCycle.end_date!),
                            new Date(targetLockedCycle.start_date)
                          ) + 1}{' '}
                          Days
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
                    {unlockedCycleId && (
                      <div className="px-4 py-3 bg-purple-500/15 border border-purple-500/30 text-purple-300 rounded-2xl text-xs font-bold flex items-center justify-between mb-3">
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

                    {/* DYNAMIC LOG OPTIONS */}
                    {unlockedCycleId ? (
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
                              {selectedDate
                                ? `Period Began on ${format(selectedDate, 'MMM d')} 🌸`
                                : 'Period Began 🌸'}
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
                              {selectedDate
                                ? `Period Completed on ${format(selectedDate, 'MMM d')} 🌿`
                                : 'Period Completed 🌿'}
                            </span>
                            <span className="text-xs text-muted-foreground">Log end date for active period</span>
                          </div>
                        </button>
                      </>
                    )}

                    <div className="w-full h-px bg-border/40 my-3" />

                    {/* FLOW & CERVICAL FLUID LOGGERS */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        onClick={() => openView('flow')}
                        className="flex items-center gap-3 p-3.5 rounded-2xl bg-secondary/30 hover:bg-secondary/60 transition-colors text-left border border-border/20"
                      >
                        <div className="w-8 h-8 rounded-xl bg-pink-500/15 flex items-center justify-center shrink-0 text-pink-400">
                          <Droplets className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-foreground">Flow Intensity</p>
                          <p className="text-[10px] text-muted-foreground">Spotting / Light / Heavy</p>
                        </div>
                      </button>

                      <button
                        onClick={() => openView('mucus')}
                        className="flex items-center gap-3 p-3.5 rounded-2xl bg-secondary/30 hover:bg-secondary/60 transition-colors text-left border border-border/20"
                      >
                        <div className="w-8 h-8 rounded-xl bg-violet-500/15 flex items-center justify-center shrink-0 text-violet-400">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-foreground">Cervical Fluid</p>
                          <p className="text-[10px] text-muted-foreground">Egg-White / Creamy</p>
                        </div>
                      </button>
                    </div>

                    {/* SYMPTOMS & NOTES */}
                    <button
                      onClick={() => openView('symptoms')}
                      className="w-full flex items-center gap-4 p-3.5 rounded-2xl hover:bg-secondary/70 transition-colors text-left border border-border/20"
                    >
                      <div className="w-10 h-10 rounded-full bg-pink-500/15 flex items-center justify-center shrink-0 text-pink-400">
                        <Activity className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-foreground">Log Physical & Mood Symptoms</span>
                        <p className="text-[11px] text-muted-foreground">Cramps, bloating, acne, breast tenderness</p>
                      </div>
                    </button>

                    <button
                      onClick={() => openView('note')}
                      className="w-full flex items-center gap-4 p-3.5 rounded-2xl hover:bg-secondary/70 transition-colors text-left border border-border/20"
                    >
                      <div className="w-10 h-10 rounded-full bg-slate-500/15 flex items-center justify-center shrink-0 text-slate-400">
                        <FileText className="w-5 h-5" />
                      </div>
                      <span className="text-sm font-semibold text-foreground">Add Daily Journal Note</span>
                    </button>

                    <button
                      onClick={() => openView('event')}
                      className="w-full flex items-center gap-4 p-3.5 rounded-2xl hover:bg-secondary/70 transition-colors text-left border border-border/20"
                    >
                      <div className="w-10 h-10 rounded-full bg-purple-500/15 flex items-center justify-center shrink-0 text-purple-400">
                        <CalendarHeart className="w-5 h-5" />
                      </div>
                      <span className="text-sm font-semibold text-foreground">Add Custom Event / Doctor Visit</span>
                    </button>
                  </div>
                )}

                {/* FLOW INTENSITY VIEW */}
                {sheetView === 'flow' && (
                  <div className="space-y-4 pt-1">
                    <h4 className="font-bold text-sm text-foreground">Log Flow Intensity</h4>
                    <div className="grid grid-cols-2 gap-2.5">
                      {[
                        { id: 'spotting', label: '💧 Spotting', desc: 'A few drops / liner' },
                        { id: 'light', label: '💧💧 Light', desc: 'Low flow / regular pads' },
                        { id: 'medium', label: '💧💧💧 Medium', desc: 'Steady standard flow' },
                        { id: 'heavy', label: '💧💧💧💧 Heavy', desc: 'Heavy flow / frequent change' },
                      ].map(flow => {
                        const dateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
                        const currentFlow = monthData[dateStr]?.meta?.flow;
                        const isSel = currentFlow === flow.id;
                        return (
                          <button
                            key={flow.id}
                            onClick={() => saveCheckinMeta({ flow: flow.id })}
                            className={`p-3.5 rounded-2xl text-left border transition-all ${
                              isSel
                                ? 'bg-pink-500/20 border-pink-500/50 text-white shadow-sm'
                                : 'bg-secondary/30 border-border/30 hover:bg-secondary/60 text-foreground'
                            }`}
                          >
                            <p className="text-xs font-bold">{flow.label}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{flow.desc}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* CERVICAL FLUID VIEW */}
                {sheetView === 'mucus' && (
                  <div className="space-y-4 pt-1">
                    <h4 className="font-bold text-sm text-foreground">Log Cervical Fluid Quality</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {[
                        { id: 'egg_white', label: '🥚 Egg-White (EWCM)', desc: 'Clear, stretchy, lubricative — Peak Fertility' },
                        { id: 'watery', label: '💧 Watery', desc: 'Clear, thin, slippery — High Fertility' },
                        { id: 'creamy', label: '🥛 Creamy', desc: 'Lotion-like, white/pearl — Moderate Fertility' },
                        { id: 'sticky', label: '🧴 Sticky / Tacky', desc: 'Thick, non-stretchy — Low Fertility' },
                        { id: 'dry', label: '🌵 Dry', desc: 'No discernible fluid — Non-fertile' },
                      ].map(m => {
                        const dateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
                        const currentMucus = monthData[dateStr]?.meta?.cervicalMucus;
                        const isSel = currentMucus === m.id;
                        return (
                          <button
                            key={m.id}
                            onClick={() => saveCheckinMeta({ cervicalMucus: m.id })}
                            className={`p-3.5 rounded-2xl text-left border transition-all ${
                              isSel
                                ? 'bg-violet-500/20 border-violet-500/50 text-white shadow-sm'
                                : 'bg-secondary/30 border-border/30 hover:bg-secondary/60 text-foreground'
                            }`}
                          >
                            <p className="text-xs font-bold">{m.label}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{m.desc}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* SYMPTOMS VIEW */}
                {sheetView === 'symptoms' && (
                  <div className="space-y-4 pt-1">
                    <h4 className="font-bold text-sm text-foreground">Log Physical & Emotional Symptoms</h4>
                    <div className="flex flex-wrap gap-2">
                      {[
                        'Cramps',
                        'Bloating',
                        'Fatigue',
                        'Headache',
                        'Backache',
                        'Tender Breasts',
                        'Acne',
                        'Mood Swings',
                        'Nausea',
                        'Food Cravings',
                        'Insomnia',
                        'Hot Flashes',
                        'Low Energy',
                        'High Vitality',
                        'Heightened Libido',
                      ].map(sym => {
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
                            className={`px-3.5 py-2 rounded-full text-xs font-bold transition-all ${
                              isActive
                                ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-sm'
                                : 'bg-secondary/50 text-foreground hover:bg-secondary border border-border/30'
                            }`}
                          >
                            {sym}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ADD NOTE / EVENT VIEW */}
                {(sheetView === 'note' || sheetView === 'event') && (
                  <div className="space-y-4 pt-1">
                    <h4 className="font-bold text-sm text-foreground capitalize">
                      {sheetView === 'note' ? 'Add Journal Note' : 'Add Custom Event'}
                    </h4>
                    <textarea
                      value={inputValue}
                      onChange={e => setInputValue(e.target.value)}
                      placeholder={
                        sheetView === 'note'
                          ? 'Write your note here (e.g. Energy levels, emotional observations, food triggers)...'
                          : 'Event details (e.g. Doctor appointment, blood test, ultrasound, LH strip test)...'
                      }
                      className="w-full p-4 rounded-2xl bg-secondary/60 border border-border/40 resize-none min-h-[130px] text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                    />
                    <button
                      onClick={() =>
                        saveCheckinMeta(sheetView === 'note' ? { note: inputValue } : { event: inputValue })
                      }
                      className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-600 hover:opacity-95 text-white font-bold text-sm shadow-md active:scale-95 transition-all"
                    >
                      Save {sheetView === 'note' ? 'Note' : 'Event'}
                    </button>
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
