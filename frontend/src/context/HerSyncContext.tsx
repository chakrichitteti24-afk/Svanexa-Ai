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
import { format } from 'date-fns';

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
  active_theme?: string;
  active_dashboard_style?: string;
  active_companion_style?: string;
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
  log_date: string;
  image?: string | null;
  acne?: number;
  oiliness?: number;
  dryness?: number;
  condition?: string;
  notes?: string | null;
  breakouts?: boolean | null;
}

export interface WellnessTask {
  id: string;
  userId?: string;
  planId?: string;
  planDate?: string;
  text: string;
  category: string;
  timeSlot: 'morning' | 'afternoon' | 'evening';
  priority?: 'high' | 'recommended' | 'optional';
  status?: 'pending' | 'completed' | 'skipped';
  estimatedTime?: string;
  rationale?: string;
  completed: boolean;
  completedAt: string | null;
}

export interface UnlockedItem {
  type: string;
  itemId: string;
}

export interface CoinAnimationState {
  id: string;
  amount: number;
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
  // Svanexa Rewards State
  coinBalance: number;
  unlockedItems: UnlockedItem[];
  activeTheme: string;
  activeDashboardStyle: string;
  activeCompanionStyle: string;
  coinAnimation: CoinAnimationState | null;
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
  toggleTask: (taskId: string) => Promise<void>;
  /** Set wellness tasks from the wellness plan page */
  setWellnessTasks: (tasks: WellnessTask[]) => void;
  /** Set cycle history optimistically */
  setCycleHistory: (history: CycleLog[]) => void;
  /** Svanexa Store actions */
  purchaseItem: (itemType: string, itemId: string, cost: number, itemName: string) => Promise<boolean>;
  setActiveCustomization: (itemType: string, itemId: string) => Promise<void>;
  refreshCoins: () => Promise<void>;
  triggerCoinAnimation: (amount: number) => void;
  updateCoinBalanceLocally: (newBalance: number, earnedAmount?: number) => void;
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
    coinBalance: 0,
    unlockedItems: [],
    activeTheme: 'default',
    activeDashboardStyle: 'minimal',
    activeCompanionStyle: 'friendly',
    coinAnimation: null,
    isLoading: true,
    lastRefreshed: 0,
  });

  const triggerCoinAnimation = useCallback((amount: number) => {
    if (amount <= 0) return;
    const animId = Date.now().toString();
    setState(prev => ({
      ...prev,
      coinAnimation: { id: animId, amount },
    }));
    setTimeout(() => {
      setState(prev => (prev.coinAnimation?.id === animId ? { ...prev, coinAnimation: null } : prev));
    }, 1200);
  }, []);

  const updateCoinBalanceLocally = useCallback((newBalance: number, earnedAmount?: number) => {
    setState(prev => ({
      ...prev,
      coinBalance: newBalance,
    }));
    if (earnedAmount && earnedAmount > 0) {
      triggerCoinAnimation(earnedAmount);
    }
  }, [triggerCoinAnimation]);

  const refreshCoins = useCallback(async () => {
    try {
      const res = await apiFetch('/api/coins/balance');
      if (res.ok) {
        const { data } = await res.json();
        setState(prev => ({
          ...prev,
          coinBalance: data.balance ?? 0,
          unlockedItems: (data.unlockedItems || []).map((u: any) => ({
            type: u.item_type,
            itemId: u.item_id,
          })),
          activeTheme: data.activeTheme || 'default',
          activeDashboardStyle: data.activeDashboardStyle || 'minimal',
          activeCompanionStyle: data.activeCompanionStyle || 'friendly',
        }));
      }
    } catch (err) {
      console.error('Error fetching coins balance', err);
    }
  }, []);

  // Restore cache on mount with date validation to prevent yesterday's data from flashing
  useEffect(() => {
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const cached = localStorage.getItem('svanexa_app_cache_v1');
      if (cached) {
        const parsed = JSON.parse(cached);
        const isSameDate = parsed.cacheDate === todayStr;

        setState(prev => ({
          ...prev,
          profile: parsed.profile || prev.profile,
          preferences: parsed.preferences || prev.preferences,
          activeTheme: parsed.activeTheme || prev.activeTheme,
          activeDashboardStyle: parsed.activeDashboardStyle || prev.activeDashboardStyle,
          activeCompanionStyle: parsed.activeCompanionStyle || prev.activeCompanionStyle,
          coinBalance: parsed.coinBalance ?? prev.coinBalance,
          unlockedItems: parsed.unlockedItems || prev.unlockedItems,
          currentStreak: parsed.currentStreak ?? prev.currentStreak,
          totalCheckIns: parsed.totalCheckIns ?? prev.totalCheckIns,
          hasCheckedInToday: isSameDate ? (parsed.hasCheckedInToday ?? false) : false,
          checkinSlots: isSameDate ? (parsed.checkinSlots || prev.checkinSlots) : {
            morning: { completed: false, completedAt: null },
            afternoon: { completed: false, completedAt: null },
            evening: { completed: false, completedAt: null },
          },
          todayLog: isSameDate ? (parsed.todayLog || prev.todayLog) : { sleep: null, water: null, mood: null, stress: null, exercise: null },
          wellnessTasks: isSameDate ? (parsed.wellnessTasks || []) : [],
          isLoading: false,
        }));
      }
    } catch (err) {
      console.error('Cache restore error', err);
    }
  }, []);

  const fetchAll = useCallback(async (options: { skipCycleHistory?: boolean } = {}) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }
      const userId = session.user.id;
      const todayStr = format(new Date(), 'yyyy-MM-dd');

      // Execute ALL health, coin, skin, and cycle requests in parallel with todayStr
      const [healthRes, coinsRes, skinRes, cycleRes] = await Promise.all([
        apiFetch(`/api/health/summary?date=${todayStr}`),
        apiFetch('/api/coins/balance'),
        supabase
          .from('skin_logs')
          .select('*')
          .eq('user_id', userId)
          .order('log_date', { ascending: false })
          .limit(10),
        options.skipCycleHistory
          ? Promise.resolve({ data: null })
          : supabase
              .from('cycle_logs')
              .select('*')
              .eq('user_id', userId)
              .order('start_date', { ascending: false })
              .limit(12),
      ]);

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

      let coinBalance = 0;
      let unlockedItems: UnlockedItem[] = [];
      let activeTheme = 'default';
      let activeDashboardStyle = 'minimal';
      let activeCompanionStyle = 'friendly';

      if (coinsRes.ok) {
        const { data: coinData } = await coinsRes.json();
        coinBalance = coinData.balance ?? 0;
        unlockedItems = (coinData.unlockedItems || []).map((u: any) => ({
          type: u.item_type,
          itemId: u.item_id,
        }));
        activeTheme = coinData.activeTheme || 'default';
        activeDashboardStyle = coinData.activeDashboardStyle || 'minimal';
        activeCompanionStyle = coinData.activeCompanionStyle || 'friendly';
      }

      const cycleData = cycleRes.data ? (cycleRes.data as CycleLog[]) : undefined;

      const newStatePartial = {
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
        skinLogs: (skinRes.data as SkinLog[]) || [],
        wellnessTasks,
        coinBalance,
        unlockedItems,
        activeTheme,
        activeDashboardStyle,
        activeCompanionStyle,
        isLoading: false,
        lastRefreshed: Date.now(),
      };

      setState(prev => ({
        ...prev,
        ...newStatePartial,
        cycleHistory: cycleData !== undefined ? cycleData : prev.cycleHistory,
      }));

      // Cache snapshot tagged with today's local date
      try {
        localStorage.setItem(
          'svanexa_app_cache_v1',
          JSON.stringify({
            cacheDate: todayStr,
            profile,
            preferences,
            activeTheme,
            activeDashboardStyle,
            activeCompanionStyle,
            coinBalance,
            unlockedItems,
            hasCheckedInToday,
            currentStreak,
            totalCheckIns,
            checkinSlots,
            todayLog,
            wellnessTasks,
          })
        );
      } catch {}
    } catch (err) {
      console.error('fetchAll error', err);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [supabase]);

  const refreshCycleHistory = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('cycle_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('start_date', { ascending: false })
      .limit(12);
    if (data) {
      setState(prev => ({ ...prev, cycleHistory: data as CycleLog[] }));
    }
  }, [supabase]);

  const refreshSkinLogs = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('skin_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('log_date', { ascending: false })
      .limit(10);
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

  const toggleTask = useCallback(async (taskId: string) => {
    const targetTask = state.wellnessTasks.find(t => t.id === taskId);
    if (!targetTask) return;
    const nextCompleted = !targetTask.completed;
    const nextStatus = nextCompleted ? 'completed' : 'pending';
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    // Optimistic UI update
    setState(prev => ({
      ...prev,
      wellnessTasks: prev.wellnessTasks.map(t => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          completed: nextCompleted,
          status: nextStatus,
          completedAt: nextCompleted ? (t.completedAt || new Date().toISOString()) : null,
        };
      }),
    }));

    try {
      const res = await apiFetch('/api/wellness-plan/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, status: nextStatus, date: todayStr }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.coinsEarned && data.coinsEarned > 0) {
          updateCoinBalanceLocally(data.newBalance, data.coinsEarned);
        }
        if (data.tasks) {
          setState(prev => ({ ...prev, wellnessTasks: data.tasks }));
        }
      }
    } catch (err) {
      console.error('Task toggle error', err);
    }
  }, [state.wellnessTasks, updateCoinBalanceLocally]);

  const purchaseItem = useCallback(
    async (itemType: string, itemId: string, cost: number, itemName: string): Promise<boolean> => {
      try {
        const res = await apiFetch('/api/coins/purchase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemType, itemId, cost, itemName }),
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || data.message || 'Purchase failed');
        }

        setState(prev => ({
          ...prev,
          coinBalance: data.newBalance ?? prev.coinBalance,
          unlockedItems: prev.unlockedItems.some(i => i.type === itemType && i.itemId === itemId)
            ? prev.unlockedItems
            : [...prev.unlockedItems, { type: itemType, itemId }],
          activeTheme: itemType === 'theme' ? itemId : prev.activeTheme,
          activeDashboardStyle: itemType === 'dashboard_style' ? itemId : prev.activeDashboardStyle,
          activeCompanionStyle: itemType === 'companion_style' ? itemId : prev.activeCompanionStyle,
        }));

        return true;
      } catch (err) {
        throw err;
      }
    },
    []
  );

  const setActiveCustomization = useCallback(async (itemType: string, itemId: string) => {
    let previousStyle = {
      activeTheme: 'default',
      activeDashboardStyle: 'minimal',
      activeCompanionStyle: 'friendly',
    };

    // Optimistic UI update
    setState(prev => {
      previousStyle = {
        activeTheme: prev.activeTheme,
        activeDashboardStyle: prev.activeDashboardStyle,
        activeCompanionStyle: prev.activeCompanionStyle,
      };
      return {
        ...prev,
        activeTheme: itemType === 'theme' ? itemId : prev.activeTheme,
        activeDashboardStyle: itemType === 'dashboard_style' ? itemId : prev.activeDashboardStyle,
        activeCompanionStyle: itemType === 'companion_style' ? itemId : prev.activeCompanionStyle,
      };
    });

    try {
      const res = await apiFetch('/api/coins/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemType, itemId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to update customization');
      }
    } catch (err) {
      console.error('Error updating active customization', err);
      // Revert on error
      setState(prev => ({
        ...prev,
        ...previousStyle,
      }));
      throw err;
    }
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

  // Smart Background Syncing on Window Focus
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const handleFocus = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
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

  const wellnessMode: 'general' | 'pcos' | 'pregnancy' =
    (state.preferences?.theme as 'general' | 'pcos' | 'pregnancy') ||
    (state.profile?.active_theme as 'general' | 'pcos' | 'pregnancy') ||
    'general';
  const userName = state.profile?.first_name || 'there';
  const aiName = state.profile?.ai_name || 'Luna';

  const value: HerSyncContextValue = useMemo(
    () => ({
      ...state,
      refreshAll: fetchAll,
      refreshCycleHistory,
      refreshSkinLogs,
      toggleTask,
      setWellnessTasks,
      setCycleHistory,
      purchaseItem,
      setActiveCustomization,
      refreshCoins,
      triggerCoinAnimation,
      updateCoinBalanceLocally,
      wellnessMode,
      userName,
      aiName,
    }),
    [
      state,
      fetchAll,
      refreshCycleHistory,
      refreshSkinLogs,
      toggleTask,
      setWellnessTasks,
      setCycleHistory,
      purchaseItem,
      setActiveCustomization,
      refreshCoins,
      triggerCoinAnimation,
      updateCoinBalanceLocally,
      wellnessMode,
      userName,
      aiName,
    ]
  );

  return <HerSyncContext.Provider value={value}>{children}</HerSyncContext.Provider>;
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
