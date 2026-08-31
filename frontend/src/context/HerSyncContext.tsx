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
import { offlineMutationQueue } from '@/utils/offline-sync';
import { format } from 'date-fns';

// ============================================================
// TYPES & BROADCAST SYNC EVENTS
// ============================================================

export type BroadcastSyncMessage =
  | { type: 'CHECKIN_UPDATED'; slot: 'morning' | 'afternoon' | 'evening'; completed: boolean; partialLog?: Partial<TodayLog> }
  | { type: 'TODAY_LOG_UPDATED'; partialLog: Partial<TodayLog> }
  | { type: 'TASK_TOGGLED'; taskId: string; completed: boolean; status: string; coinsEarned?: number; newBalance?: number }
  | { type: 'COIN_UPDATED'; newBalance: number; earnedAmount?: number }
  | { type: 'CUSTOMIZATION_ACTIVATED'; itemType: string; itemId: string }
  | { type: 'LANGUAGE_CHANGED'; language: string }
  | { type: 'REFRESH_ALL'; skipCycleHistory?: boolean };

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
  /** Instant local optimistic sync methods */
  updateTodayLogLocally: (partialLog: Partial<TodayLog>) => void;
  updateCheckinSlotLocally: (slot: 'morning' | 'afternoon' | 'evening', completed: boolean) => void;
  /** Language preference management */
  updateLanguage: (newLang: string) => Promise<void>;
  /** Derived helpers */
  wellnessMode: 'general' | 'pcos' | 'pregnancy';
  userName: string;
  aiName: string;
  language: string;
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

  const [state, setState] = useState<HealthState>(() => {
    const initialState: HealthState = {
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
    };

    if (typeof window !== 'undefined') {
      try {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const cached = localStorage.getItem('svanexa_app_cache_v1');
        if (cached) {
          const parsed = JSON.parse(cached);
          const isSameDate = parsed?.cacheDate === todayStr;

          return {
            ...initialState,
            profile: parsed?.profile || null,
            preferences: parsed?.preferences || null,
            activeTheme: parsed?.activeTheme || 'default',
            activeDashboardStyle: parsed?.activeDashboardStyle || 'minimal',
            activeCompanionStyle: parsed?.activeCompanionStyle || 'friendly',
            coinBalance: typeof parsed?.coinBalance === 'number' ? parsed.coinBalance : 0,
            unlockedItems: Array.isArray(parsed?.unlockedItems) ? parsed.unlockedItems : [],
            currentStreak: typeof parsed?.currentStreak === 'number' ? parsed.currentStreak : 0,
            totalCheckIns: typeof parsed?.totalCheckIns === 'number' ? parsed.totalCheckIns : 0,
            hasCheckedInToday: isSameDate ? (parsed?.hasCheckedInToday ?? false) : false,
            checkinSlots: isSameDate && parsed?.checkinSlots ? parsed.checkinSlots : {
              morning: { completed: false, completedAt: null },
              afternoon: { completed: false, completedAt: null },
              evening: { completed: false, completedAt: null },
            },
            todayLog: isSameDate && parsed?.todayLog ? parsed.todayLog : { sleep: null, water: null, mood: null, stress: null, exercise: null },
            wellnessTasks: isSameDate && Array.isArray(parsed?.wellnessTasks) ? parsed.wellnessTasks : [],
            isLoading: false,
          };
        }
      } catch (err) {
        console.warn('Cache restore warning:', err);
      }
    }

    return initialState;
  });

  const broadcastRef = useRef<BroadcastChannel | null>(null);

  const postSyncBroadcast = useCallback((msg: BroadcastSyncMessage) => {
    if (typeof window !== 'undefined' && broadcastRef.current) {
      try {
        broadcastRef.current.postMessage(msg);
      } catch (err) {
        console.warn('[HerSyncContext] BroadcastChannel post error:', err);
      }
    }
  }, []);

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

  const updateCoinBalanceLocally = useCallback((newBalance: number, earnedAmount?: number, broadcast = true) => {
    if (typeof newBalance !== 'number' || isNaN(newBalance)) return;

    setState(prev => {
      // Synchronize localStorage cache as well
      try {
        const cached = localStorage.getItem('svanexa_app_cache_v1');
        if (cached) {
          const parsed = JSON.parse(cached);
          parsed.coinBalance = newBalance;
          localStorage.setItem('svanexa_app_cache_v1', JSON.stringify(parsed));
        }
      } catch {}

      return {
        ...prev,
        coinBalance: newBalance,
      };
    });

    if (earnedAmount && earnedAmount > 0) {
      triggerCoinAnimation(earnedAmount);
    }

    if (broadcast) {
      postSyncBroadcast({
        type: 'COIN_UPDATED',
        newBalance,
        earnedAmount,
      });
    }
  }, [triggerCoinAnimation, postSyncBroadcast]);

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

  const updateTodayLogLocally = useCallback((partialLog: Partial<TodayLog>, broadcast = true) => {
    setState(prev => {
      const updatedLog = { ...prev.todayLog, ...partialLog };
      try {
        const cached = localStorage.getItem('svanexa_app_cache_v1');
        if (cached) {
          const parsed = JSON.parse(cached);
          parsed.todayLog = updatedLog;
          parsed.hasCheckedInToday = true;
          localStorage.setItem('svanexa_app_cache_v1', JSON.stringify(parsed));
        }
      } catch {}
      return {
        ...prev,
        todayLog: updatedLog,
        hasCheckedInToday: true,
      };
    });

    if (broadcast) {
      postSyncBroadcast({
        type: 'TODAY_LOG_UPDATED',
        partialLog,
      });
    }
  }, [postSyncBroadcast]);

  const updateCheckinSlotLocally = useCallback((slot: 'morning' | 'afternoon' | 'evening', completed: boolean, broadcast = true) => {
    setState(prev => {
      const updatedSlots = {
        ...prev.checkinSlots,
        [slot]: { completed, completedAt: completed ? new Date().toISOString() : null },
      };
      const allComplete = Object.values(updatedSlots).every(s => s.completed);
      try {
        const cached = localStorage.getItem('svanexa_app_cache_v1');
        if (cached) {
          const parsed = JSON.parse(cached);
          parsed.checkinSlots = updatedSlots;
          parsed.allSlotsComplete = allComplete;
          parsed.hasCheckedInToday = true;
          localStorage.setItem('svanexa_app_cache_v1', JSON.stringify(parsed));
        }
      } catch {}
      return {
        ...prev,
        checkinSlots: updatedSlots,
        allSlotsComplete: allComplete,
        hasCheckedInToday: true,
      };
    });

    if (broadcast) {
      postSyncBroadcast({
        type: 'CHECKIN_UPDATED',
        slot,
        completed,
      });
    }
  }, [postSyncBroadcast]);

  const fetchAll = useCallback(async (options: { skipCycleHistory?: boolean } = {}) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }
      const userId = session.user.id;
      const todayStr = format(new Date(), 'yyyy-MM-dd');

      // Execute ALL health, coin, skin, and cycle requests safely in parallel
      const [healthRes, coinsRes, skinRes, cycleRes] = await Promise.all([
        apiFetch(`/api/health/summary?date=${todayStr}`).catch(err => {
          console.warn('Health summary fetch error:', err);
          return new Response(JSON.stringify({ success: false }), { status: 500 });
        }),
        apiFetch('/api/coins/balance').catch(err => {
          console.warn('Coins balance fetch error:', err);
          return new Response(JSON.stringify({ success: false }), { status: 500 });
        }),
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
        try {
          const { data } = await healthRes.json();
          if (data) {
            profile = data.profile || null;
            preferences = data.preferences || null;
            hasCheckedInToday = !!data.has_checked_in_today;
            checkinSlots = data.checkin_slots || checkinSlots;
            allSlotsComplete = !!data.all_slots_complete;
            totalCheckIns = typeof data.total_logs_count === 'number' ? data.total_logs_count : 0;
            currentStreak = typeof data.current_streak === 'number' ? data.current_streak : 0;
            cycleStatus = typeof data.cycle_status === 'string' ? data.cycle_status : 'insufficient_data';
            pregnancyDueDate = data.pregnancy?.due_date || null;
            todayLog = data.today_log || todayLog;
            wellnessTasks = Array.isArray(data.wellness_tasks) ? data.wellness_tasks : [];
          }
        } catch (jsonErr) {
          console.warn('Health summary json parse warning:', jsonErr);
        }
      }

      let coinBalance = 0;
      let unlockedItems: UnlockedItem[] = [];
      let activeTheme = 'default';
      let activeDashboardStyle = 'minimal';
      let activeCompanionStyle = 'friendly';

      if (coinsRes.ok) {
        try {
          const { data: coinData } = await coinsRes.json();
          if (coinData) {
            coinBalance = typeof coinData.balance === 'number' ? coinData.balance : 0;
            unlockedItems = Array.isArray(coinData.unlockedItems)
              ? coinData.unlockedItems.map((u: any) => ({
                  type: u.item_type,
                  itemId: u.item_id,
                }))
              : [];
            activeTheme = coinData.activeTheme || 'default';
            activeDashboardStyle = coinData.activeDashboardStyle || 'minimal';
            activeCompanionStyle = coinData.activeCompanionStyle || 'friendly';
          }
        } catch (coinJsonErr) {
          console.warn('Coin json parse warning:', coinJsonErr);
        }
      }

      const cycleData = Array.isArray(cycleRes.data) ? (cycleRes.data as CycleLog[]) : undefined;

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
        skinLogs: Array.isArray(skinRes.data) ? (skinRes.data as SkinLog[]) : [],
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

    postSyncBroadcast({
      type: 'TASK_TOGGLED',
      taskId,
      completed: nextCompleted,
      status: nextStatus,
    });

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
      } else {
        // Enqueue for offline background retry
        offlineMutationQueue.enqueueMutation(
          '/api/wellness-plan/toggle',
          'POST',
          { taskId, status: nextStatus, date: todayStr },
          `task_toggle_${taskId}`
        );
      }
    } catch (err) {
      console.warn('[HerSyncContext] Task toggle network error, enqueued offline mutation:', err);
      offlineMutationQueue.enqueueMutation(
        '/api/wellness-plan/toggle',
        'POST',
        { taskId, status: nextStatus, date: todayStr },
        `task_toggle_${taskId}`
      );
    }
  }, [state.wellnessTasks, updateCoinBalanceLocally, postSyncBroadcast]);

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

        // Instantaneous DOM attribute application
        if (typeof document !== 'undefined') {
          if (itemType === 'theme') {
            document.documentElement.setAttribute('data-theme', itemId);
            document.body.setAttribute('data-theme', itemId);
          } else if (itemType === 'dashboard_style') {
            document.documentElement.setAttribute('data-dashboard-style', itemId);
            document.body.setAttribute('data-dashboard-style', itemId);
          }
        }

        // Cache update
        try {
          const cached = localStorage.getItem('svanexa_app_cache_v1');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (itemType === 'theme') parsed.activeTheme = itemId;
            if (itemType === 'dashboard_style') parsed.activeDashboardStyle = itemId;
            if (itemType === 'companion_style') parsed.activeCompanionStyle = itemId;
            if (typeof data.newBalance === 'number') parsed.coinBalance = data.newBalance;
            localStorage.setItem('svanexa_app_cache_v1', JSON.stringify(parsed));
          }
        } catch {}

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

        // Synchronize active customization to ensure database persistence
        try {
          await apiFetch('/api/coins/active', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemType, itemId }),
          });
        } catch (activeErr) {
          console.warn('Auto-activate sync notice:', activeErr);
        }

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

    // Instantaneous DOM attribute application
    if (typeof document !== 'undefined') {
      if (itemType === 'theme') {
        document.documentElement.setAttribute('data-theme', itemId);
        document.body.setAttribute('data-theme', itemId);
      } else if (itemType === 'dashboard_style') {
        document.documentElement.setAttribute('data-dashboard-style', itemId);
        document.body.setAttribute('data-dashboard-style', itemId);
      }
    }

    // Cache update
    try {
      const cached = localStorage.getItem('svanexa_app_cache_v1');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (itemType === 'theme') parsed.activeTheme = itemId;
        if (itemType === 'dashboard_style') parsed.activeDashboardStyle = itemId;
        if (itemType === 'companion_style') parsed.activeCompanionStyle = itemId;
        localStorage.setItem('svanexa_app_cache_v1', JSON.stringify(parsed));
      }
    } catch {}

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

    postSyncBroadcast({
      type: 'CUSTOMIZATION_ACTIVATED',
      itemType,
      itemId,
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
      if (typeof document !== 'undefined') {
        if (itemType === 'theme') {
          document.documentElement.setAttribute('data-theme', previousStyle.activeTheme);
          document.body.setAttribute('data-theme', previousStyle.activeTheme);
        } else if (itemType === 'dashboard_style') {
          document.documentElement.setAttribute('data-dashboard-style', previousStyle.activeDashboardStyle);
          document.body.setAttribute('data-dashboard-style', previousStyle.activeDashboardStyle);
        }
      }
      setState(prev => ({
        ...prev,
        ...previousStyle,
      }));
      throw err;
    }
  }, [postSyncBroadcast]);

  // ── 1. Initial Load & Error Handling ─────────────────────────────────────
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

  // ── 2. Zero-Latency Cross-Tab BroadcastChannel & Storage Event Sync ───────
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let channel: BroadcastChannel | null = null;
    try {
      if ('BroadcastChannel' in window) {
        channel = new BroadcastChannel('svanexa_health_sync');
        broadcastRef.current = channel;

        channel.onmessage = (event: MessageEvent<BroadcastSyncMessage>) => {
          const msg = event.data;
          if (!msg || typeof msg !== 'object') return;

          switch (msg.type) {
            case 'CHECKIN_UPDATED':
              updateCheckinSlotLocally(msg.slot, msg.completed, false);
              if (msg.partialLog) {
                updateTodayLogLocally(msg.partialLog, false);
              }
              break;
            case 'TODAY_LOG_UPDATED':
              updateTodayLogLocally(msg.partialLog, false);
              break;
            case 'TASK_TOGGLED':
              setState(prev => ({
                ...prev,
                wellnessTasks: prev.wellnessTasks.map(t =>
                  t.id === msg.taskId
                    ? {
                        ...t,
                        completed: msg.completed,
                        status: msg.status as any,
                        completedAt: msg.completed ? new Date().toISOString() : null,
                      }
                    : t
                ),
              }));
              if (typeof msg.newBalance === 'number') {
                updateCoinBalanceLocally(msg.newBalance, msg.coinsEarned, false);
              }
              break;
            case 'COIN_UPDATED':
              updateCoinBalanceLocally(msg.newBalance, msg.earnedAmount, false);
              break;
            case 'CUSTOMIZATION_ACTIVATED':
              if (typeof document !== 'undefined') {
                if (msg.itemType === 'theme') {
                  document.documentElement.setAttribute('data-theme', msg.itemId);
                  document.body.setAttribute('data-theme', msg.itemId);
                } else if (msg.itemType === 'dashboard_style') {
                  document.documentElement.setAttribute('data-dashboard-style', msg.itemId);
                  document.body.setAttribute('data-dashboard-style', msg.itemId);
                }
              }
              setState(prev => ({
                ...prev,
                activeTheme: msg.itemType === 'theme' ? msg.itemId : prev.activeTheme,
                activeDashboardStyle: msg.itemType === 'dashboard_style' ? msg.itemId : prev.activeDashboardStyle,
                activeCompanionStyle: msg.itemType === 'companion_style' ? msg.itemId : prev.activeCompanionStyle,
              }));
              break;
            case 'LANGUAGE_CHANGED':
              setState(prev => ({
                ...prev,
                preferences: prev.preferences ? { ...prev.preferences, language: msg.language } : prev.preferences,
              }));
              break;
            case 'REFRESH_ALL':
              fetchAll({ skipCycleHistory: msg.skipCycleHistory });
              break;
          }
        };
      }
    } catch (bcErr) {
      console.warn('[HerSyncContext] BroadcastChannel setup fallback:', bcErr);
    }

    // Storage event listener fallback for cross-tab cache sync
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'svanexa_app_cache_v1' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          const todayStr = format(new Date(), 'yyyy-MM-dd');
          if (parsed.cacheDate === todayStr) {
            setState(prev => ({
              ...prev,
              coinBalance: typeof parsed.coinBalance === 'number' ? parsed.coinBalance : prev.coinBalance,
              hasCheckedInToday: parsed.hasCheckedInToday ?? prev.hasCheckedInToday,
              checkinSlots: parsed.checkinSlots || prev.checkinSlots,
              todayLog: parsed.todayLog || prev.todayLog,
              wellnessTasks: Array.isArray(parsed.wellnessTasks) ? parsed.wellnessTasks : prev.wellnessTasks,
            }));
          }
        } catch {}
      }
    };

    window.addEventListener('storage', handleStorage);

    return () => {
      if (channel) {
        channel.close();
        broadcastRef.current = null;
      }
      window.removeEventListener('storage', handleStorage);
    };
  }, [fetchAll, updateCheckinSlotLocally, updateCoinBalanceLocally, updateTodayLogLocally]);

  // ── 3. Supabase Realtime CDC (Multi-Device Live Sync) ─────────────────────
  useEffect(() => {
    let realtimeChannel: any = null;

    const setupRealtime = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) return;
        const userId = session.user.id;

        realtimeChannel = supabase
          .channel(`hersync-realtime-${userId}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'daily_checkins', filter: `user_id=eq.${userId}` },
            (payload: any) => {
              if (payload.new && payload.new.summary) {
                try {
                  const meta = JSON.parse(payload.new.summary);
                  const morningDone = !!meta.morning?.completed;
                  const afternoonDone = !!meta.afternoon?.completed;
                  const eveningDone = !!meta.evening?.completed;
                  const allDone = morningDone && afternoonDone && eveningDone;
                  setState(prev => ({
                    ...prev,
                    hasCheckedInToday: true,
                    checkinSlots: {
                      morning: { completed: morningDone, completedAt: meta.morning?.completedAt || null },
                      afternoon: { completed: afternoonDone, completedAt: meta.afternoon?.completedAt || null },
                      evening: { completed: eveningDone, completedAt: meta.evening?.completedAt || null },
                    },
                    allSlotsComplete: allDone,
                  }));
                } catch {}
              }
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'coin_balances', filter: `user_id=eq.${userId}` },
            (payload: any) => {
              if (payload.new && typeof payload.new.balance === 'number') {
                updateCoinBalanceLocally(payload.new.balance, undefined, true);
              }
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'user_preferences', filter: `user_id=eq.${userId}` },
            (payload: any) => {
              if (payload.new) {
                setState(prev => ({
                  ...prev,
                  preferences: {
                    ...(prev.preferences || ({} as any)),
                    ...payload.new,
                  },
                }));
              }
            }
          )
          .subscribe();
      } catch (rtErr) {
        console.warn('[HerSyncContext] Realtime setup notice:', rtErr);
      }
    };

    setupRealtime();

    return () => {
      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
      }
    };
  }, [supabase, updateCoinBalanceLocally]);

  // ── 4. Offline Mutation Queue & Auto-Replay on Reconnect ───────────────────
  useEffect(() => {
    const unsubscribeOnline = offlineMutationQueue.initOnlineSyncListener(
      apiFetch,
      ({ successCount }) => {
        if (successCount > 0) {
          console.log(`[OfflineSync] Flushed ${successCount} pending offline health mutations.`);
          fetchAll();
        }
      }
    );
    return () => {
      unsubscribeOnline();
    };
  }, [fetchAll]);

  // ── 5. Smart Background Syncing on Window Focus ───────────────────────────
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

  const updateLanguage = useCallback(async (newLang: string) => {
    if (!newLang) return;
    setState(prev => ({
      ...prev,
      preferences: prev.preferences
        ? { ...prev.preferences, language: newLang }
        : {
            user_id: prev.profile?.id || '',
            theme: (prev.profile?.active_theme as any) || 'general',
            tracking_goals: null,
            language: newLang,
            communication_style: 'friendly',
            emoji_preference: true,
            response_length: 'concise',
            notifications_enabled: true,
          },
    }));

    postSyncBroadcast({
      type: 'LANGUAGE_CHANGED',
      language: newLang,
    });

    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('hersync_companion_language', newLang);
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        await supabase.from('user_preferences').upsert(
          {
            user_id: session.user.id,
            language: newLang,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
      }
    } catch (err) {
      console.warn('Language preference sync warning:', err);
    }
  }, [supabase, postSyncBroadcast]);

  const wellnessMode: 'general' | 'pcos' | 'pregnancy' =
    (state.preferences?.theme && ['general', 'pcos', 'pregnancy'].includes(state.preferences.theme)
      ? (state.preferences.theme as 'general' | 'pcos' | 'pregnancy')
      : state.profile?.active_theme && ['general', 'pcos', 'pregnancy'].includes(state.profile.active_theme)
      ? (state.profile.active_theme as 'general' | 'pcos' | 'pregnancy')
      : 'general');
  const userName = state.profile?.first_name || 'there';
  const aiName = state.profile?.ai_name || 'Luna';
  const language = state.preferences?.language || (typeof window !== 'undefined' ? localStorage.getItem('hersync_companion_language') : null) || 'English';

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
      updateTodayLogLocally,
      updateCheckinSlotLocally,
      updateLanguage,
      wellnessMode,
      userName,
      aiName,
      language,
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
      updateTodayLogLocally,
      updateCheckinSlotLocally,
      updateLanguage,
      wellnessMode,
      userName,
      aiName,
      language,
    ]
  );

  return <HerSyncContext.Provider value={value}>{children}</HerSyncContext.Provider>;
}

// ============================================================
// HOOK
// ============================================================

const defaultContextValue: HerSyncContextValue = {
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
  isLoading: false,
  lastRefreshed: 0,
  refreshAll: async () => {},
  refreshCycleHistory: async () => {},
  refreshSkinLogs: async () => {},
  toggleTask: async () => {},
  setWellnessTasks: () => {},
  setCycleHistory: () => {},
  purchaseItem: async () => false,
  setActiveCustomization: async () => {},
  refreshCoins: async () => {},
  triggerCoinAnimation: () => {},
  updateCoinBalanceLocally: () => {},
  updateTodayLogLocally: () => {},
  updateCheckinSlotLocally: () => {},
  updateLanguage: async () => {},
  wellnessMode: 'general',
  userName: 'there',
  aiName: 'Luna',
  language: 'English',
};

export function useHerSync(): HerSyncContextValue {
  const ctx = useContext(HerSyncContext);
  if (!ctx) {
    return defaultContextValue;
  }
  return ctx;
}

