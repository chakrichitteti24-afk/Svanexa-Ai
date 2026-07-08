'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
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
  completed: boolean;
  completedAt: string | null;
}

export interface HealthState {
  profile: UserProfile | null;
  preferences: UserPreferences | null;
  todayLog: TodayLog;
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
  refreshAll: () => Promise<void>;
  /** Call after cycle log changes */
  refreshCycleHistory: () => Promise<void>;
  /** Call after skin log changes */
  refreshSkinLogs: () => Promise<void>;
  /** Toggle wellness task completion */
  toggleTask: (taskId: string) => void;
  /** Set wellness tasks from the wellness plan page */
  setWellnessTasks: (tasks: WellnessTask[]) => void;
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

  const fetchAll = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      // Fetch health summary from backend (handles auth, streak, cycle phase)
      const healthRes = await apiFetch('/api/health/summary');

      let profile: UserProfile | null = null;
      let preferences: UserPreferences | null = null;
      let todayLog: TodayLog = { sleep: null, water: null, mood: null, stress: null, exercise: null };
      let hasCheckedInToday = false;
      let totalCheckIns = 0;
      let currentStreak = 0;
      let cycleStatus = 'insufficient_data';
      let pregnancyDueDate: string | null = null;

      if (healthRes.ok) {
        const { data } = await healthRes.json();
        profile = data.profile;
        preferences = data.preferences;
        hasCheckedInToday = data.has_checked_in_today;
        totalCheckIns = data.total_logs_count;
        currentStreak = data.current_streak;
        cycleStatus = data.cycle_status;
        pregnancyDueDate = data.pregnancy?.due_date || null;
        todayLog = data.today_log || todayLog;
      }

      // Fetch cycle history and skin logs directly from Supabase client
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [cycleRes, skinRes] = await Promise.all([
        supabase.from('cycle_logs').select('*').eq('user_id', user.id).order('start_date', { ascending: false }).limit(12),
        supabase.from('skin_logs').select('*').eq('user_id', user.id).order('date', { ascending: false }).limit(10),
      ]);

      setState(prev => ({
        ...prev,
        profile,
        preferences,
        todayLog,
        hasCheckedInToday,
        totalCheckIns,
        currentStreak,
        cycleStatus,
        pregnancyDueDate,
        cycleHistory: (cycleRes.data as CycleLog[]) || [],
        skinLogs: (skinRes.data as SkinLog[]) || [],
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
    const { data } = await supabase.from('skin_logs').select('*').eq('user_id', user.id).order('date', { ascending: false }).limit(10);
    if (data) {
      setState(prev => ({ ...prev, skinLogs: data as SkinLog[] }));
    }
  }, [supabase]);

  const setWellnessTasks = useCallback((tasks: WellnessTask[]) => {
    setState(prev => ({ ...prev, wellnessTasks: tasks }));
  }, []);

  const toggleTask = useCallback((taskId: string) => {
    setState(prev => ({
      ...prev,
      wellnessTasks: prev.wellnessTasks.map(t =>
        t.id === taskId
          ? { ...t, completed: !t.completed, completedAt: !t.completed ? new Date().toISOString() : null }
          : t
      ),
    }));
  }, []);

  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchAll();
    }
  }, [fetchAll]);

  // Subscribe to realtime checkin changes
  useEffect(() => {
    const channel = supabase
      .channel('hersync_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_checkins' }, () => {
        fetchAll();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mood_logs' }, () => {
        fetchAll();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cycle_logs' }, () => {
        refreshCycleHistory();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, fetchAll, refreshCycleHistory]);

  const wellnessMode: 'general' | 'pcos' | 'pregnancy' = (state.preferences?.theme as 'general' | 'pcos' | 'pregnancy') || 'general';
  const userName = state.profile?.first_name || 'there';
  const aiName = state.profile?.ai_name || 'Luna';

  const value: HerSyncContextValue = {
    ...state,
    refreshAll: fetchAll,
    refreshCycleHistory,
    refreshSkinLogs,
    toggleTask,
    setWellnessTasks,
    wellnessMode,
    userName,
    aiName,
  };

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
