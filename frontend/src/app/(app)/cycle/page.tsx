'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, 
  isSameDay, isToday, differenceInDays, addDays, isWithinInterval,
  subDays, isBefore
} from 'date-fns';
import { 
  ChevronLeft, ChevronRight, Droplets, X, Activity,
  Moon, Smile, Dumbbell, Sparkles, FileText, CalendarCheck, Baby,
  ArrowLeft, CalendarHeart
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useHerSync } from '@/context/HerSyncContext';
import { toast } from 'sonner';

// JSON Parse Helper for Checkins
const parseSummary = (str: string | null) => {
  if (!str) return {};
  try {
    const obj = JSON.parse(str);
    if (typeof obj === 'object' && obj !== null) return obj;
  } catch {}
  return { note: str }; // Fallback to raw string
};

export default function NativeCycleTracker() {
  const supabase = createClient();
  const { cycleHistory, wellnessMode, refreshAll, pregnancyDueDate } = useHerSync();
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Selection & Bottom Sheet State
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [sheetView, setSheetView] = useState<'menu' | 'mood' | 'water' | 'sleep' | 'exercise' | 'note' | 'event' | 'symptoms'>('menu');
  
  // Data for the current month view
  const [monthData, setMonthData] = useState<Record<string, any>>({});
  
  // Input States
  const [inputValue, setInputValue] = useState<any>('');

  const fetchMonth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const start = format(startOfWeek(startOfMonth(currentDate)), 'yyyy-MM-dd');
      const end = format(endOfWeek(endOfMonth(currentDate)), 'yyyy-MM-dd');

      const [checkins, moods, waters, sleeps, exercises, skins] = await Promise.all([
        supabase.from('daily_checkins').select('*').eq('user_id', user.id).gte('date', start).lte('date', end),
        supabase.from('mood_logs').select('*').eq('user_id', user.id).gte('date', start).lte('date', end),
        supabase.from('water_logs').select('*').eq('user_id', user.id).gte('date', start).lte('date', end),
        supabase.from('sleep_logs').select('*').eq('user_id', user.id).gte('date', start).lte('date', end),
        supabase.from('exercise_logs').select('*').eq('user_id', user.id).gte('date', start).lte('date', end),
        supabase.from('skin_logs').select('*').eq('user_id', user.id).gte('date', start).lte('date', end)
      ]);

      const aggregated: Record<string, any> = {};
      const process = (arr: any[] | null, key: string, mapFn: (item: any) => any) => {
        if (!arr) return;
        arr.forEach(item => {
          if (!aggregated[item.date]) aggregated[item.date] = {};
          aggregated[item.date][key] = mapFn(item);
        });
      };

      process(checkins.data, 'checkin', i => ({ ...i, meta: parseSummary(i.summary) }));
      process(moods.data, 'mood', i => i);
      process(waters.data, 'water', i => i.amount_ml);
      process(sleeps.data, 'sleep', i => i.duration_hours);
      process(exercises.data, 'exercise', i => i.duration_minutes);
      process(skins.data, 'skin', i => i.condition);

      setMonthData(aggregated);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchMonth();
  }, [currentDate, supabase, cycleHistory]); // Re-fetch if cycleHistory triggers (via refreshAll)

  // Derived Cycle Predictions
  const predictions = useMemo(() => {
    if (!cycleHistory || cycleHistory.length === 0) return null;
    let totalCycleLength = 0;
    let totalPeriodLength = 0;
    let validCycles = 0;
    let validPeriods = 0;

    for (let i = 0; i < cycleHistory.length; i++) {
      const c = cycleHistory[i];
      if (c.start_date && c.end_date) {
        totalPeriodLength += differenceInDays(new Date(c.end_date), new Date(c.start_date)) + 1;
        validPeriods++;
      }
      if (i < cycleHistory.length - 1) {
        totalCycleLength += differenceInDays(new Date(c.start_date), new Date(cycleHistory[i+1].start_date));
        validCycles++;
      }
    }

    const avgCycle = validCycles > 0 ? Math.round(totalCycleLength / validCycles) : 28;
    const avgPeriod = validPeriods > 0 ? Math.round(totalPeriodLength / validPeriods) : 5;
    const lastCycle = cycleHistory[0];
    const lastStartDate = new Date(lastCycle.start_date);
    
    const nextPeriodStart = addDays(lastStartDate, avgCycle);
    const predictedOvulation = subDays(nextPeriodStart, 14);
    const fertileStart = subDays(predictedOvulation, 3);
    const fertileEnd = addDays(predictedOvulation, 1);

    return { avgPeriod, nextPeriodStart, predictedOvulation, fertileStart, fertileEnd };
  }, [cycleHistory]);

  const isPeriodDay = (day: Date) => {
    return cycleHistory.some(c => {
      const s = new Date(c.start_date);
      const e = c.end_date ? new Date(c.end_date) : s;
      return isSameDay(day, s) || isSameDay(day, e) || isWithinInterval(day, { start: s, end: e });
    });
  };

  const isFertileDay = (day: Date) => {
    if (!predictions || isBefore(day, new Date(new Date().setHours(0,0,0,0)))) return false;
    return isWithinInterval(day, { start: predictions.fertileStart, end: predictions.fertileEnd });
  };

  const isOvulationDay = (day: Date) => {
    if (!predictions || isBefore(day, new Date(new Date().setHours(0,0,0,0)))) return false;
    return isSameDay(day, predictions.predictedOvulation);
  };

  const daysInMonth = eachDayOfInterval({ 
    start: startOfWeek(startOfMonth(currentDate)), 
    end: endOfWeek(endOfMonth(currentDate)) 
  });

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  // ─── ACTIONS ───

  const logPeriodStart = async () => {
    if (!selectedDate) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('cycle_logs').insert({ 
        user_id: user.id, 
        start_date: format(selectedDate, 'yyyy-MM-dd'),
        end_date: null
      });
      toast.success('Period started.');
      refreshAll();
      setSelectedDate(null);
    } catch (e) { toast.error('Failed to log period.'); }
  };

  const logPeriodEnd = async () => {
    if (!selectedDate) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cycleHistory.length === 0) return;
      const activeCycle = cycleHistory.find(c => isSameDay(selectedDate, new Date(c.start_date)) || !c.end_date) || cycleHistory[0];
      await supabase.from('cycle_logs').update({ 
        end_date: format(selectedDate, 'yyyy-MM-dd')
      }).eq('id', activeCycle.id);
      toast.success('Period ended.');
      refreshAll();
      setSelectedDate(null);
    } catch (e) { toast.error('Failed to update period.'); }
  };

  const logPregnancyStart = async () => {
    if (!selectedDate) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const dueDate = addDays(selectedDate, 280).toISOString();
      await supabase.from('pregnancy_logs').insert({ user_id: user.id, due_date: dueDate });
      await supabase.from('user_preferences').update({ theme: 'pregnancy' }).eq('user_id', user.id);
      toast.success('Pregnancy journey started! 🎉');
      refreshAll();
      setSelectedDate(null);
    } catch (e) { toast.error('Failed to start pregnancy tracking.'); }
  };

  const logPregnancyEnd = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      // In a robust app, we'd mark the pregnancy log as completed. Here we simply switch theme back to general.
      await supabase.from('user_preferences').update({ theme: 'general' }).eq('user_id', user.id);
      toast.success('Pregnancy tracking ended.');
      refreshAll();
      setSelectedDate(null);
    } catch (e) { toast.error('Failed to update preferences.'); }
  };

  const saveCheckinMeta = async (updates: any) => {
    if (!selectedDate) return;
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const existing = monthData[dateStr]?.checkin?.meta || {};
      const newMeta = { ...existing, ...updates };
      await supabase.from('daily_checkins').upsert({ user_id: user.id, date: dateStr, summary: JSON.stringify(newMeta) }, { onConflict: 'user_id,date' });
      toast.success('Saved successfully.');
      fetchMonth(); // Refresh local data instantly without full app refresh
      setSheetView('menu');
    } catch (e) { toast.error('Failed to save.'); }
  };

  const saveVital = async (table: string, payload: any) => {
    if (!selectedDate) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from(table).upsert({ user_id: user.id, date: format(selectedDate, 'yyyy-MM-dd'), ...payload }, { onConflict: 'id' });
      toast.success('Logged successfully.');
      fetchMonth();
      setSheetView('menu');
    } catch (e) { toast.error('Failed to save.'); }
  };

  const deleteEntry = async () => {
    if (!selectedDate) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      await Promise.all([
        supabase.from('daily_checkins').delete().eq('user_id', user.id).eq('date', dateStr),
        supabase.from('mood_logs').delete().eq('user_id', user.id).eq('date', dateStr),
        supabase.from('water_logs').delete().eq('user_id', user.id).eq('date', dateStr),
        supabase.from('sleep_logs').delete().eq('user_id', user.id).eq('date', dateStr),
        supabase.from('exercise_logs').delete().eq('user_id', user.id).eq('date', dateStr),
        supabase.from('skin_logs').delete().eq('user_id', user.id).eq('date', dateStr)
      ]);
      toast.success('Entry deleted.');
      fetchMonth();
      setSelectedDate(null);
    } catch (e) { toast.error('Failed to delete logs.'); }
  };

  // State initialization when opening a view
  const openView = (view: typeof sheetView) => {
    const d = selectedDate ? monthData[format(selectedDate, 'yyyy-MM-dd')] : null;
    if (view === 'note') setInputValue(d?.checkin?.meta?.note || '');
    if (view === 'event') setInputValue(d?.checkin?.meta?.event || '');
    if (view === 'water') setInputValue(d?.water || 2);
    if (view === 'sleep') setInputValue(d?.sleep || 8);
    if (view === 'exercise') setInputValue(d?.exercise || 30);
    setSheetView(view);
  };

  const selectedData = selectedDate ? monthData[format(selectedDate, 'yyyy-MM-dd')] : null;
  const isPeriod = selectedDate ? isPeriodDay(selectedDate) : false;

  return (
    <div className="min-h-screen bg-background pb-20 select-none max-w-6xl mx-auto w-full">
      
      {/* ─── NATIVE HEADER ─── */}
      <div className="pt-12 pb-6 px-6 flex items-center justify-between bg-background z-10 sticky top-0">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {format(currentDate, 'MMMM yyyy')}
        </h1>
        <div className="flex items-center gap-4">
          <button onClick={prevMonth} className="p-1 text-muted-foreground hover:text-foreground active:scale-90 transition-transform">
            <ChevronLeft className="w-7 h-7" />
          </button>
          <button onClick={nextMonth} className="p-1 text-muted-foreground hover:text-foreground active:scale-90 transition-transform">
            <ChevronRight className="w-7 h-7" />
          </button>
        </div>
      </div>

      {/* ─── CALENDAR GRID ─── */}
      <div className="px-5">
        <div className="grid grid-cols-7 mb-4">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <div key={i} className="text-center text-xs font-semibold text-muted-foreground uppercase">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-5 gap-x-1">
          {daysInMonth.map((day, i) => {
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isSel = selectedDate && isSameDay(day, selectedDate);
            const today = isToday(day);
            
            const period = isPeriodDay(day);
            const fertile = isFertileDay(day);
            const ovulation = isOvulationDay(day);
            const hasData = monthData[format(day, 'yyyy-MM-dd')];
            
            const hasEvent = hasData?.checkin?.meta?.event;
            const hasNotes = hasData?.skin || hasData?.checkin?.meta?.note || hasData?.checkin?.meta?.symptoms;
            const hasVitals = hasData?.sleep || hasData?.water || hasData?.exercise || hasData?.mood;

            return (
              <div key={i} className="flex flex-col items-center justify-start h-[3.5rem]">
                <button
                  onClick={() => { setSelectedDate(day); setSheetView('menu'); }}
                  className={`
                    relative w-10 h-10 flex items-center justify-center rounded-full text-base font-medium transition-transform active:scale-95
                    ${!isCurrentMonth ? 'text-muted-foreground/30' : 'text-foreground'}
                    ${today && !isSel ? 'border border-foreground' : ''}
                  `}
                  style={{
                    backgroundColor: isSel ? 'var(--hs-glass-bg)' : 'transparent',
                    color: isSel ? 'var(--hs-violet)' : undefined,
                    fontWeight: isSel ? '700' : undefined
                  }}
                >
                  {format(day, 'd')}
                  {hasEvent && !isSel && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-background" />
                  )}
                </button>
                
                {/* Minimal Dots */}
                <div className="flex gap-1 mt-1 justify-center h-1.5">
                  {period && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--hs-pink)' }} />}
                  {ovulation && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--hs-violet)' }} />}
                  {fertile && !ovulation && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#34D399' }} />}
                  {hasNotes && !period && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#FBBF24' }} />}
                  {hasVitals && !hasNotes && !period && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#60A5FA' }} />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── NATIVE BOTTOM SHEET ─── */}
      <AnimatePresence>
        {selectedDate && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedDate(null)}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={0.2}
              onDragEnd={(e, info) => {
                if (info.offset.y > 100 || info.velocity.y > 500) {
                  setSelectedDate(null);
                }
              }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-[32px] shadow-[0_-10px_40px_rgba(0,0,0,0.15)] max-h-[85vh] flex flex-col"
            >
              <div className="w-12 h-1.5 rounded-full bg-border mx-auto mt-4 mb-2 shrink-0" />

              <div className="px-6 pb-4 pt-2 flex items-center justify-between shrink-0">
                {sheetView !== 'menu' ? (
                  <button onClick={() => setSheetView('menu')} className="p-2 -ml-2 rounded-full active:bg-secondary text-foreground">
                    <ArrowLeft size={20} />
                  </button>
                ) : (
                  <div>
                    <h3 className="text-xl font-bold text-foreground">{format(selectedDate, 'EEEE')}</h3>
                    <p className="text-sm" style={{ color: 'var(--hs-pink)' }}>{format(selectedDate, 'MMMM d, yyyy')}</p>
                  </div>
                )}
                
                {sheetView === 'menu' && (
                  <button onClick={() => setSelectedDate(null)} className="p-2 bg-secondary rounded-full active:scale-95 text-muted-foreground hover:text-foreground">
                    <X size={18} />
                  </button>
                )}
                {sheetView !== 'menu' && (
                  <span className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">{sheetView}</span>
                )}
              </div>

              {/* Data Summary (Only shown on menu view) */}
              {sheetView === 'menu' && selectedData && (
                <div className="px-6 mb-4 flex gap-2 overflow-x-auto no-scrollbar shrink-0">
                  {selectedData.checkin?.meta?.event && (
                    <div className="px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap">
                      <CalendarCheck className="w-3.5 h-3.5" /> {selectedData.checkin.meta.event}
                    </div>
                  )}
                  {selectedData.mood && (
                    <div className="px-3 py-1.5 rounded-full bg-secondary border border-border text-xs font-medium flex items-center gap-1.5 whitespace-nowrap">
                      <Smile className="w-3.5 h-3.5" /> <span className="capitalize">{selectedData.mood.mood || selectedData.mood}</span>
                    </div>
                  )}
                  {selectedData.sleep && (
                    <div className="px-3 py-1.5 rounded-full bg-secondary border border-border text-xs font-medium flex items-center gap-1.5 whitespace-nowrap">
                      <Moon className="w-3.5 h-3.5" /> {selectedData.sleep}h
                    </div>
                  )}
                </div>
              )}

              {/* ─── SCROLLABLE CONTENT AREA ─── */}
              <div className="px-6 pb-8 overflow-y-auto flex-1">
                
                {/* MENU VIEW */}
                {sheetView === 'menu' && (
                  <div className="space-y-1 pb-4">
                    {!isPeriod ? (
                      <button onClick={logPeriodStart} className="w-full flex items-center gap-4 p-3 rounded-2xl hover:bg-secondary active:bg-secondary transition-colors text-left">
                        <div className="w-10 h-10 rounded-full bg-pink-500/10 flex items-center justify-center">
                          <Droplets className="w-5 h-5 text-pink-500" />
                        </div>
                        <span className="text-base font-medium">Period Started</span>
                      </button>
                    ) : (
                      <button onClick={logPeriodEnd} className="w-full flex items-center gap-4 p-3 rounded-2xl hover:bg-secondary active:bg-secondary transition-colors text-left">
                        <div className="w-10 h-10 rounded-full bg-pink-500/10 flex items-center justify-center">
                          <CalendarCheck className="w-5 h-5 text-pink-500" />
                        </div>
                        <span className="text-base font-medium">Period Ended</span>
                      </button>
                    )}

                    {wellnessMode !== 'pregnancy' ? (
                      <button onClick={logPregnancyStart} className="w-full flex items-center gap-4 p-3 rounded-2xl hover:bg-secondary active:bg-secondary transition-colors text-left">
                        <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                          <Baby className="w-5 h-5 text-orange-500" />
                        </div>
                        <span className="text-base font-medium">Pregnancy Started</span>
                      </button>
                    ) : (
                      <button onClick={logPregnancyEnd} className="w-full flex items-center gap-4 p-3 rounded-2xl hover:bg-secondary active:bg-secondary transition-colors text-left">
                        <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                          <CalendarCheck className="w-5 h-5 text-orange-500" />
                        </div>
                        <span className="text-base font-medium">Pregnancy Ended</span>
                      </button>
                    )}

                    <div className="w-full h-px bg-border my-2" />

                    <button onClick={() => openView('event')} className="w-full flex items-center gap-4 p-3 rounded-2xl hover:bg-secondary active:bg-secondary transition-colors text-left">
                      <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                        <CalendarHeart className="w-5 h-5 text-blue-500" />
                      </div>
                      <span className="text-base font-medium">Add Custom Event</span>
                    </button>

                    <button onClick={() => openView('note')} className="w-full flex items-center gap-4 p-3 rounded-2xl hover:bg-secondary active:bg-secondary transition-colors text-left">
                      <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-yellow-500" />
                      </div>
                      <span className="text-base font-medium">Add Note</span>
                    </button>

                    <button onClick={() => openView('symptoms')} className="w-full flex items-center gap-4 p-3 rounded-2xl hover:bg-secondary active:bg-secondary transition-colors text-left">
                      <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-purple-500" />
                      </div>
                      <span className="text-base font-medium">Log Symptoms</span>
                    </button>

                    <button onClick={() => openView('mood')} className="w-full flex items-center gap-4 p-3 rounded-2xl hover:bg-secondary active:bg-secondary transition-colors text-left">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                        <Smile className="w-5 h-5 text-emerald-500" />
                      </div>
                      <span className="text-base font-medium">Log Mood</span>
                    </button>

                    <div className="grid grid-cols-3 gap-2 mt-2 px-1">
                      <button onClick={() => openView('water')} className="p-3 rounded-2xl bg-secondary hover:bg-secondary/80 flex flex-col items-center gap-2">
                        <Droplets className="w-5 h-5 text-blue-400" />
                        <span className="text-xs font-semibold">Water</span>
                      </button>
                      <button onClick={() => openView('sleep')} className="p-3 rounded-2xl bg-secondary hover:bg-secondary/80 flex flex-col items-center gap-2">
                        <Moon className="w-5 h-5 text-indigo-400" />
                        <span className="text-xs font-semibold">Sleep</span>
                      </button>
                      <button onClick={() => openView('exercise')} className="p-3 rounded-2xl bg-secondary hover:bg-secondary/80 flex flex-col items-center gap-2">
                        <Dumbbell className="w-5 h-5 text-emerald-400" />
                        <span className="text-xs font-semibold">Exercise</span>
                      </button>
                    </div>

                    {selectedData && (
                      <>
                        <div className="w-full h-px bg-border my-4" />
                        <button onClick={deleteEntry} className="w-full p-4 rounded-2xl bg-red-500/10 text-red-500 font-bold text-center active:scale-95 transition-transform">
                          Delete Entry
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* NOTE & EVENT VIEWS */}
                {(sheetView === 'note' || sheetView === 'event') && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">{sheetView === 'note' ? 'Write a journal entry or observations for this date.' : 'E.g., Doctor Appointment, Scan, Travel'}</p>
                    <textarea 
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder={sheetView === 'note' ? "Felt energetic today..." : "Doctor Appointment"}
                      className="w-full p-4 rounded-2xl bg-secondary border-none resize-none min-h-[120px] focus:ring-2 focus:ring-[var(--hs-pink)]"
                    />
                    <button 
                      onClick={() => saveCheckinMeta(sheetView === 'note' ? { note: inputValue } : { event: inputValue })}
                      className="w-full py-4 rounded-2xl text-white font-bold shadow-lg active:scale-95 transition-transform"
                      style={{ background: 'var(--hs-pink)' }}
                    >
                      Save {sheetView === 'note' ? 'Note' : 'Event'}
                    </button>
                  </div>
                )}

                {/* MOOD VIEW */}
                {sheetView === 'mood' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { v: 'happy', e: '😊', l: 'Happy' }, { v: 'calm', e: '😌', l: 'Calm' },
                        { v: 'anxious', e: '😰', l: 'Anxious' }, { v: 'sad', e: '😢', l: 'Sad' },
                        { v: 'angry', e: '😠', l: 'Angry' }, { v: 'mood_swings', e: '🎢', l: 'Swings' }
                      ].map(m => (
                        <button 
                          key={m.v} 
                          onClick={() => saveVital('mood_logs', { mood: m.v, intensity: 5 })}
                          className="h-20 flex flex-col items-center justify-center gap-2 rounded-2xl bg-secondary hover:bg-secondary/80 active:scale-95 transition-transform"
                        >
                          <span className="text-3xl">{m.e}</span>
                          <span className="text-xs font-semibold">{m.l}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* SYMPTOMS VIEW */}
                {sheetView === 'symptoms' && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground mb-2">Select symptoms experienced on this day.</p>
                    <div className="flex flex-wrap gap-2">
                      {['Cramps', 'Bloating', 'Fatigue', 'Headache', 'Nausea', 'Backache', 'Tender Breasts', 'Acne'].map(sym => {
                        const currentSymptoms = selectedData?.checkin?.meta?.symptoms || [];
                        const isActive = currentSymptoms.includes(sym);
                        return (
                          <button 
                            key={sym}
                            onClick={() => {
                              const next = isActive ? currentSymptoms.filter((s: string) => s !== sym) : [...currentSymptoms, sym];
                              setInputValue(next);
                              saveCheckinMeta({ symptoms: next });
                            }}
                            className={`px-4 py-2.5 rounded-full text-sm font-semibold transition-colors ${isActive ? 'text-white' : 'bg-secondary text-foreground'}`}
                            style={isActive ? { background: 'var(--hs-pink)' } : {}}
                          >
                            {sym}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* VITALS (WATER, SLEEP, EXERCISE) VIEW */}
                {(sheetView === 'water' || sheetView === 'sleep' || sheetView === 'exercise') && (
                  <div className="flex flex-col items-center justify-center py-8 space-y-8">
                    <div className="flex items-center gap-6">
                      <button onClick={() => setInputValue(Math.max(0, inputValue - (sheetView === 'water' ? 0.5 : sheetView === 'sleep' ? 1 : 10)))} className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center text-2xl font-bold active:scale-90 transition-transform">-</button>
                      <div className="text-5xl font-bold text-foreground w-32 text-center flex flex-col items-center">
                        {inputValue}
                        <span className="text-sm font-medium text-muted-foreground mt-1 uppercase tracking-widest">
                          {sheetView === 'water' ? 'Liters' : sheetView === 'sleep' ? 'Hours' : 'Minutes'}
                        </span>
                      </div>
                      <button onClick={() => setInputValue(inputValue + (sheetView === 'water' ? 0.5 : sheetView === 'sleep' ? 1 : 10))} className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center text-2xl font-bold active:scale-90 transition-transform">+</button>
                    </div>
                    <button 
                      onClick={() => saveVital(`${sheetView}_logs`, sheetView === 'water' ? { amount_ml: inputValue * 1000 } : sheetView === 'sleep' ? { duration_hours: inputValue } : { duration_minutes: inputValue, type: 'General' })}
                      className="w-full py-4 rounded-2xl text-white font-bold shadow-lg active:scale-95 transition-transform"
                      style={{ background: 'var(--hs-pink)' }}
                    >
                      Save {sheetView}
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
