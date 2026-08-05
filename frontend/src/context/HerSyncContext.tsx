'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
  useMemo,
} from 'react';
import { createClient } from '@/utils/supabase/client';
import { apiFetch } from '@/utils/api-client';

// ============================================================
// TYPES
// ============================================================

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  ai_name: string;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
}

export interface UserPreferences {
  user_id: string;
  theme: 'general' | 'pcos' | 'pregnancy';
  tracking_goals: string[] | null;
  language: string;
  communication_style: string;
  emoji_preference: boolean;
  response_length: string;
  notifications_enabled: boolean;
}

export interface TodayLog {
  sleep: number | null;
  water: number | null;
  mood: string | null;
  stress: number | null;
  exercise: number | null;
}

export interface CycleLog {
  id: string;
  start_date: string;
  end_date: string | null;
  flow_intensity: string | null;
  symptoms: string[] | null;
}

export interface SkinLog {
  id: string;
  date: string;
  condition: string;
  notes: string | null;
  breakouts: boolean | null;
}

export interface WellnessTask {
  id: string;
  text: string;
  category: string;
  timeSlot: 'morning' | 'afternoon' | 'evening';
  completed: boolean;
  completedAt: string | null;
}

export interface HealthState {
  profile: UserProfile | null;
  preferences: UserPreferences | null;
  todayLog: TodayLog;
  checkinSlots: {
    morning: { completed: boolean; completedAt: string | null };
    afternoon: { completed: boolean; completedAt: string | null };
    evening: { completed: boolean; completedAt: string | null };
  };
  allSlotsComplete: boolean;
  hasCheckedInToday: boolean;
  totalCheckIns: number;
  currentStreak: number;
  cycleStatus: string;
  cycleHistory: CycleLog[];
  skinLogs: SkinLog[];
  wellnessTasks: WellnessTask[];
  pregnancyDueDate: string | null;
  isLoading: boolean;
  lastRefreshed: number;
}

interface HerSyncContextValue extends HealthState {
  /** Call after any daily check-in save to broadcast changes to all modules */
  refreshAll: (options?: { skipCycleHistory?: boolean }) => Promise<void>;
  /** Call after cycle log changes */
  refreshCycleHistory: () => Promise<void>;
  /** Call after skin log changes */
  refreshSkinLogs: () => Promise<void>;
  /** Toggle wellness task completion */
  toggleTask: (taskId: string) => void;
  /** Set wellness tasks from the wellness plan page */
  setWellnessTasks: (tasks: WellnessTask[]) => void;
  /** Set cycle history optimistically */
  setCycleHistory: (history: CycleLog[]) => void;
  /** Derived helpers */
  wellnessMode: 'general' | 'pcos' | 'pregnancy';
  userName: string;
  aiName: string;
}

// ============================================================
// CONTEXT
// ============================================================

const HerSyncContext = createContext<HerSyncContextValue | null>(null);

// ============================================================
// PROVIDER
// ============================================================

export function HerSyncProvider({ children }: { children: ReactNode }) {
  const supabase = createClient();
  const hasFetchedRef = useRef(false);

  const [state, setState] = useState<HealthState>({
    profile: null,
    preferences: null,
    todayLog: { sleep: null, water: null, mood: null, stress: null, exercise: null },
    checkinSlots: {
      morning: { completed: false, completedAt: null },
      afternoon: { completed: false, completedAt: null },
      evening: { completed: false, completedAt: null },
    },
    allSlotsComplete: false,
    hasCheckedInToday: false,
    totalCheckIns: 0,
    currentStreak: 0,
    cycleStatus: 'insufficient_data',
    cycleHistory: [],
    skinLogs: [],
    wellnessTasks: [],
    pregnancyDueDate: null,
    isLoading: true,
    lastRefreshed: 0,
  });

  const fetchAll = useCallback(async (options: { skipCycleHistory?: boolean } = {}) => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      // Fetch health summary from backend (handles auth, streak, cycle phase)
      const healthRes = await apiFetch('/api/health/summary');

      let profile: UserProfile | null = null;
      let preferences: UserPreferences | null = null;
      let todayLog: TodayLog = { sleep: null, water: null, mood: null, stress: null, exercise: null };
      let checkinSlots = {
        morning: { completed: false, completedAt: null },
        afternoon: { completed: false, completedAt: null },
        evening: { completed: false, completedAt: null },
      };
      let allSlotsComplete = false;
      let hasCheckedInToday = false;
      let totalCheckIns = 0;
      let currentStreak = 0;
      let cycleStatus = 'insufficient_data';
      let pregnancyDueDate: string | null = null;
      let wellnessTasks: WellnessTask[] = [];

      if (healthRes.ok) {
        const { data } = await healthRes.json();
        profile = data.profile;
        preferences = data.preferences;
        hasCheckedInToday = data.has_checked_in_today;
        checkinSlots = data.checkin_slots || checkinSlots;
        allSlotsComplete = data.all_slots_complete || false;
        totalCheckIns = data.total_logs_count;
        currentStreak = data.current_streak;
        cycleStatus = data.cycle_status;
        pregnancyDueDate = data.pregnancy?.due_date || null;
        todayLog = data.today_log || todayLog;
        wellnessTasks = data.wellness_tasks || [];
      }

      // Fetch cycle history and skin logs directly from Supabase client
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const skinRes = await supabase.from('skin_logs').select('*').eq('user_id', user.id).order('log_date', { ascending: false }).limit(10);
      
      let cycleData: CycleLog[] | undefined = undefined;
      if (!options.skipCycleHistory) {
        const cycleRes = await supabase.from('cycle_logs').select('*').eq('user_id', user.id).order('start_date', { ascending: false }).limit(12);
        if (cycleRes.data) cycleData = cycleRes.data as CycleLog[];
      }

      setState(prev => ({
        ...prev,
        profile,
        preferences,
        todayLog,
        checkinSlots,
        allSlotsComplete,
        hasCheckedInToday,
        totalCheckIns,
        currentStreak,
        cycleStatus,
        pregnancyDueDate,
        cycleHistory: cycleData !== undefined ? cycleData : prev.cycleHistory,
        skinLogs: (skinRes.data as SkinLog[]) || [],
        wellnessTasks,
        isLoading: false,
        lastRefreshed: Date.now(),
      }));
    } catch {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [supabase]);

  const refreshCycleHistory = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('cycle_logs').select('*').eq('user_id', user.id).order('start_date', { ascending: false }).limit(12);
    if (data) {
      setState(prev => ({ ...prev, cycleHistory: data as CycleLog[] }));
    }
  }, [supabase]);

  const refreshSkinLogs = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('skin_logs').select('*').eq('user_id', user.id).order('log_date', { ascending: false }).limit(10);
    if (data) {
      setState(prev => ({ ...prev, skinLogs: data as SkinLog[] }));
    }
  }, [supabase]);

  const setWellnessTasks = useCallback((tasks: WellnessTask[]) => {
    setState(prev => ({ ...prev, wellnessTasks: tasks }));
  }, []);

  const setCycleHistory = useCallback((history: CycleLog[]) => {
    setState(prev => ({ ...prev, cycleHistory: history }));
  }, []);

  const toggleTask = useCallback((taskId: string) => {
    setState(prev => ({
      ...prev,
      wellnessTasks: prev.wellnessTasks.map(t => {
        if (t.id !== taskId) return t;
        const isNowDone = !t.completed;
        return {
          ...t,
          completed: isNowDone,
          status: isNowDone ? 'completed' : 'pending',
          completedAt: isNowDone ? (t.completedAt || new Date().toISOString()) : null
        };
      }),
    }));
  }, []);

  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (
        event.reason &&
        (event.reason.message === 'Failed to fetch' || event.reason.name === 'TypeError')
      ) {
        event.preventDefault();
      }
    };
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchAll();
    }

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [fetchAll]);

  // Smart Background Syncing on Window Focus (Replaces heavy WebSockets)
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const handleFocus = () => {
      // Debounce the refresh to prevent spam if user switches tabs rapidly
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        // Only fetch if we haven't fetched in the last 15 seconds to avoid over-fetching
        if (Date.now() - state.lastRefreshed > 15000) {
          fetchAll();
        }
      }, 500);
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
      clearTimeout(timeoutId);
    };
  }, [fetchAll, state.lastRefreshed]);



  const wellnessMode: 'general' | 'pcos' | 'pregnancy' = (state.preferences?.theme as 'general' | 'pcos' | 'pregnancy') || 'general';
  const userName = state.profile?.first_name || 'there';
  const aiName = state.profile?.ai_name || 'Luna';

  const value: HerSyncContextValue = useMemo(() => ({
    ...state,
    refreshAll: fetchAll,
    refreshCycleHistory,
    refreshSkinLogs,
    toggleTask,
    setWellnessTasks,
    setCycleHistory,
    wellnessMode,
    userName,
    aiName,
  }), [
    state,
    fetchAll,
    refreshCycleHistory,
    refreshSkinLogs,
    toggleTask,
    setWellnessTasks,
    setCycleHistory,
    wellnessMode,
    userName,
    aiName
  ]);

  return (
    <HerSyncContext.Provider value={value}>
      {children}
    </HerSyncContext.Provider>
  );
}

// ============================================================
// HOOK
// ============================================================

export function useHerSync(): HerSyncContextValue {
  const ctx = useContext(HerSyncContext);
  if (!ctx) {
    throw new Error('useHerSync must be used inside a HerSyncProvider');
  }
  return ctx;
}
