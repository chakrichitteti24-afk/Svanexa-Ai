'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { useHerSync } from '@/context/HerSyncContext';
import {
  NotificationItem,
  NotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from '@/types/notifications';
import { playWellnessChime } from '@/utils/sound-effects';
import { CycleIntelligenceEngine } from '@/lib/services/cycle-intelligence';
import { differenceInDays, format } from 'date-fns';
import { toast } from 'sonner';

interface NotificationContextValue {
  notifications: NotificationItem[];
  unreadCount: number;
  preferences: NotificationPreferences;
  permissionStatus: NotificationPermission | 'unsupported';
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  dismissNotification: (id: string) => void;
  clearAll: () => void;
  updatePreferences: (newPrefs: Partial<NotificationPreferences>) => void;
  requestPushPermission: () => Promise<boolean>;
  sendTestNotification: () => void;
  addCustomNotification: (item: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

const STORAGE_KEY_PREFS = 'svanexa_notif_prefs_v1';
const STORAGE_KEY_READ = 'svanexa_notif_read_v1';
const STORAGE_KEY_DISMISSED = 'svanexa_notif_dismissed_v1';
const STORAGE_KEY_CUSTOM = 'svanexa_custom_notifs_v1';

export function NotificationProvider({ children }: { children: ReactNode }) {
  const {
    todayLog,
    checkinSlots,
    hasCheckedInToday,
    currentStreak,
    cycleHistory,
    wellnessMode,
    aiName,
    userName,
  } = useHerSync();

  // Preferences State
  const [preferences, setPreferences] = useState<NotificationPreferences>(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedPrefs = localStorage.getItem(STORAGE_KEY_PREFS);
        if (storedPrefs) {
          const parsed = JSON.parse(storedPrefs);
          return {
            ...DEFAULT_NOTIFICATION_PREFERENCES,
            ...parsed,
            reminderSchedule: {
              ...DEFAULT_NOTIFICATION_PREFERENCES.reminderSchedule,
              ...(parsed.reminderSchedule || {}),
            },
          };
        }
      } catch {}
    }
    return DEFAULT_NOTIFICATION_PREFERENCES;
  });

  const [readIds, setReadIds] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedRead = localStorage.getItem(STORAGE_KEY_READ);
        if (storedRead) return new Set(JSON.parse(storedRead));
      } catch {}
    }
    return new Set();
  });

  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedDismissed = localStorage.getItem(STORAGE_KEY_DISMISSED);
        if (storedDismissed) return new Set(JSON.parse(storedDismissed));
      } catch {}
    }
    return new Set();
  });

  const [customNotifications, setCustomNotifications] = useState<NotificationItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedCustom = localStorage.getItem(STORAGE_KEY_CUSTOM);
        if (storedCustom) return JSON.parse(storedCustom);
      } catch {}
    }
    return [];
  });

  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | 'unsupported'>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });

  const hasLoadedRef = useRef(true);
  const previousUnreadCountRef = useRef(0);

  // 2. Save preferences
  const updatePreferences = useCallback((newPrefs: Partial<NotificationPreferences>) => {
    setPreferences(prev => {
      const updated = {
        ...prev,
        ...newPrefs,
        reminderSchedule: {
          ...prev.reminderSchedule,
          ...(newPrefs.reminderSchedule || {}),
        },
      };
      try {
        localStorage.setItem(STORAGE_KEY_PREFS, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  // 3. Browser Push Permission Handler
  const requestPushPermission = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      toast.error('Browser push notifications are not supported on this browser.');
      setPermissionStatus('unsupported');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermissionStatus(result);
      if (result === 'granted') {
        updatePreferences({ browserPush: true });
        toast.success('Push notifications enabled successfully!');
        return true;
      } else if (result === 'denied') {
        updatePreferences({ browserPush: false });
        toast.error('Notifications were blocked. Please enable them in browser site settings.');
        return false;
      }
      return false;
    } catch (err) {
      console.error('Error requesting notification permission:', err);
      return false;
    }
  }, [updatePreferences]);

  // 4. Generate dynamic smart alerts based on health context
  const dynamicAlerts = useMemo(() => {
    if (!preferences.enabled) return [];

    const alerts: NotificationItem[] = [];
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentDecimal = currentHour + currentMinutes / 60;
    const todayStr = format(now, 'yyyy-MM-dd');

    // Parse custom user schedule
    const sched = preferences.reminderSchedule || DEFAULT_NOTIFICATION_PREFERENCES.reminderSchedule;
    const morningParts = (sched.morningTime || '08:30').split(':').map(Number);
    const afternoonParts = (sched.afternoonTime || '14:00').split(':').map(Number);
    const eveningParts = (sched.eveningTime || '21:30').split(':').map(Number);

    const morningDecimal = morningParts[0] + (morningParts[1] || 0) / 60;
    const afternoonDecimal = afternoonParts[0] + (afternoonParts[1] || 0) / 60;
    const eveningDecimal = eveningParts[0] + (eveningParts[1] || 0) / 60;

    // A. Daily Care Journal & Streak Alerts
    if (preferences.checkinAlerts) {
      // Morning Slot Check
      if (currentDecimal < afternoonDecimal && !checkinSlots.morning.completed) {
        alerts.push({
          id: `checkin-morning-${todayStr}`,
          title: '🌅 Morning Check-In Ready',
          message: 'Start your morning with a 60-second wellness check-in to balance your day.',
          category: 'checkin',
          priority: 'normal',
          timestamp: new Date(now.getFullYear(), now.getMonth(), now.getDate(), morningParts[0], morningParts[1] || 0).toISOString(),
          read: false,
          actionUrl: '/check-in',
          actionLabel: 'Log Morning Slot',
        });
      }

      // Afternoon Slot Check
      if (currentDecimal >= afternoonDecimal && currentDecimal < eveningDecimal && !checkinSlots.afternoon.completed) {
        alerts.push({
          id: `checkin-afternoon-${todayStr}`,
          title: '☀️ Afternoon Energy & Stress Check',
          message: 'How is your energy and mood feeling this afternoon? Take a moment to log.',
          category: 'checkin',
          priority: 'normal',
          timestamp: new Date(now.getFullYear(), now.getMonth(), now.getDate(), afternoonParts[0], afternoonParts[1] || 0).toISOString(),
          read: false,
          actionUrl: '/check-in',
          actionLabel: 'Log Afternoon Slot',
        });
      }

      // Evening Slot Check
      if (currentDecimal >= eveningDecimal && !checkinSlots.evening.completed) {
        alerts.push({
          id: `checkin-evening-${todayStr}`,
          title: '🌙 Evening Journal & Reflection',
          message: 'Complete your evening check-in to close out your day and record your daily habits.',
          category: 'checkin',
          priority: 'high',
          timestamp: new Date(now.getFullYear(), now.getMonth(), now.getDate(), eveningParts[0], eveningParts[1] || 0).toISOString(),
          read: false,
          actionUrl: '/check-in',
          actionLabel: 'Log Evening Slot',
        });
      }

      // Streak Preservation Alert
      if (currentStreak > 0 && !hasCheckedInToday && currentDecimal >= (eveningDecimal - 3)) {
        alerts.push({
          id: `streak-preservation-${todayStr}`,
          title: `🔥 Protect Your ${currentStreak}-Day Streak!`,
          message: `You're on a ${currentStreak}-day streak! Complete your daily journal before midnight to keep it going.`,
          category: 'checkin',
          priority: 'high',
          timestamp: now.toISOString(),
          read: false,
          actionUrl: '/check-in',
          actionLabel: 'Keep Streak Alive',
        });
      }
    }

    // B. Hydration Alerts
    if (preferences.hydrationAlerts) {
      if (currentHour >= 11 && (todayLog.water === null || todayLog.water === 0)) {
        alerts.push({
          id: `hydration-morning-${todayStr}`,
          title: '💧 Morning Hydration',
          message: 'Drink a glass of water to kickstart your metabolism and hormone flush.',
          category: 'hydration',
          priority: 'normal',
          timestamp: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 30).toISOString(),
          read: false,
          actionUrl: '/check-in',
          actionLabel: 'Log Water',
        });
      } else if (currentHour >= 14 && typeof todayLog.water === 'number' && todayLog.water < 1.5) {
        alerts.push({
          id: `hydration-afternoon-${todayStr}`,
          title: '💧 Hydration Progress Check',
          message: `You've logged ${todayLog.water}L today. Aim to reach your 2.0L - 2.5L daily goal to reduce bloating.`,
          category: 'hydration',
          priority: 'normal',
          timestamp: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 30).toISOString(),
          read: false,
          actionUrl: '/check-in',
          actionLabel: 'Add Water',
        });
      }
    }

    // C. Cycle & Period Prediction Alerts
    if (preferences.cycleAlerts && Array.isArray(cycleHistory) && cycleHistory.length > 0) {
      try {
        const engine = new CycleIntelligenceEngine(
          cycleHistory.map(c => ({
            startDate: c.start_date,
            endDate: c.end_date || c.start_date,
          })),
          {},
          wellnessMode === 'pcos'
        );
        const prediction = engine.predictNextPeriod();

        if (prediction) {
          const daysUntilEarliest = differenceInDays(prediction.earliestDate, now);
          const daysUntilLikely = differenceInDays(prediction.likelyDate, now);

          if (daysUntilEarliest <= 3 && daysUntilLikely >= -1) {
            const dayText =
              daysUntilLikely === 0
                ? 'today'
                : daysUntilLikely === 1
                ? 'tomorrow'
                : `in ~${daysUntilLikely} days`;

            alerts.push({
              id: `cycle-prediction-${prediction.expectedPeriod}`,
              title: '🌸 Upcoming Period Forecast',
              message: `Your period is predicted ${dayText} (${prediction.expectedPeriod}). Have your care essentials ready.`,
              category: 'cycle',
              priority: 'high',
              timestamp: now.toISOString(),
              read: false,
              actionUrl: '/cycle',
              actionLabel: 'View Cycle Calendar',
            });
          }
        }
      } catch (err) {
        console.warn('Cycle alert calculation warning:', err);
      }
    }

    // D. Supplements & Wellness Mode Care Alerts
    if (preferences.supplementAlerts) {
      if (wellnessMode === 'pcos') {
        alerts.push({
          id: `supplements-pcos-${todayStr}`,
          title: '💊 PCOS Routine & Supplements',
          message: 'Have you taken your Inositol, Vitamin D, or Omega-3 today? Consistency supports insulin balance.',
          category: 'supplements',
          priority: 'normal',
          timestamp: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0).toISOString(),
          read: false,
          actionUrl: '/wellness-plan',
          actionLabel: 'View Care Plan',
        });
      } else if (wellnessMode === 'pregnancy') {
        alerts.push({
          id: `supplements-preg-${todayStr}`,
          title: '🤰 Prenatal Care Reminder',
          message: 'Remember your prenatal vitamins & stay comfortably hydrated throughout the day.',
          category: 'supplements',
          priority: 'normal',
          timestamp: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0).toISOString(),
          read: false,
          actionUrl: '/wellness-plan',
          actionLabel: 'View Care Plan',
        });
      }
    }

    // E. Skin Care Routine Alerts
    if (preferences.skinAlerts && currentHour >= 19) {
      alerts.push({
        id: `skin-routine-${todayStr}`,
        title: '🧴 Evening Skincare Journal',
        message: 'Log today’s skin condition or flare-ups to correlate with your stress and sleep cycles.',
        category: 'skin',
        priority: 'low',
        timestamp: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 19, 30).toISOString(),
        read: false,
        actionUrl: '/skin',
        actionLabel: 'Log Skin',
      });
    }

    // F. AI Luna Insights
    if (preferences.lunaInsights) {
      if (todayLog.stress !== null && todayLog.stress >= 7) {
        alerts.push({
          id: `luna-stress-${todayStr}`,
          title: `🤖 ${aiName}'s Stress Relief Tip`,
          message: 'High stress was detected in your logs. Take 5 minutes for guided breathwork or gentle stretching.',
          category: 'luna',
          priority: 'normal',
          timestamp: now.toISOString(),
          read: false,
          actionUrl: '/wellness-plan',
          actionLabel: 'Relaxation Plan',
        });
      }
      if (todayLog.sleep !== null && todayLog.sleep < 6) {
        alerts.push({
          id: `luna-sleep-${todayStr}`,
          title: `🤖 ${aiName}'s Sleep Insight`,
          message: `You recorded ${todayLog.sleep}h of sleep. Restful sleep is essential for hormonal regulation.`,
          category: 'luna',
          priority: 'normal',
          timestamp: now.toISOString(),
          read: false,
          actionUrl: '/reports',
          actionLabel: 'View Health Trends',
        });
      }
    }

    return alerts;
  }, [
    preferences,
    todayLog,
    checkinSlots,
    hasCheckedInToday,
    currentStreak,
    cycleHistory,
    wellnessMode,
    aiName,
  ]);

  // Combine dynamic alerts and custom notifications, filtering out dismissed ones
  const allNotifications = useMemo(() => {
    const combined = [...customNotifications, ...dynamicAlerts];

    // Deduplicate by ID
    const uniqueMap = new Map<string, NotificationItem>();
    for (const item of combined) {
      if (!dismissedIds.has(item.id)) {
        uniqueMap.set(item.id, {
          ...item,
          read: readIds.has(item.id) || item.read,
        });
      }
    }

    // Sort by timestamp descending
    return Array.from(uniqueMap.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [customNotifications, dynamicAlerts, dismissedIds, readIds]);

  const unreadCount = useMemo(() => {
    return allNotifications.filter(n => !n.read).length;
  }, [allNotifications]);

  // Dispatch Browser Notification and Audio chime when new notifications arrive
  useEffect(() => {
    if (!hasLoadedRef.current) return;

    if (unreadCount > previousUnreadCountRef.current && previousUnreadCountRef.current > 0) {
      if (preferences.soundEnabled) {
        playWellnessChime();
      }
    }
    previousUnreadCountRef.current = unreadCount;
  }, [unreadCount, preferences.soundEnabled]);

  // Actions
  const markAsRead = useCallback((id: string) => {
    setReadIds(prev => {
      const next = new Set(prev).add(id);
      try {
        localStorage.setItem(STORAGE_KEY_READ, JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    setReadIds(prev => {
      const next = new Set(prev);
      allNotifications.forEach(n => next.add(n.id));
      try {
        localStorage.setItem(STORAGE_KEY_READ, JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
    toast.success('All notifications marked as read');
  }, [allNotifications]);

  const dismissNotification = useCallback((id: string) => {
    setDismissedIds(prev => {
      const next = new Set(prev).add(id);
      try {
        localStorage.setItem(STORAGE_KEY_DISMISSED, JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setDismissedIds(prev => {
      const next = new Set(prev);
      allNotifications.forEach(n => next.add(n.id));
      try {
        localStorage.setItem(STORAGE_KEY_DISMISSED, JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
    setCustomNotifications([]);
    try {
      localStorage.removeItem(STORAGE_KEY_CUSTOM);
    } catch {}
    toast.success('Cleared all notifications');
  }, [allNotifications]);

  const addCustomNotification = useCallback(
    (item: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => {
      const newItem: NotificationItem = {
        ...item,
        id: `custom-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
        read: false,
      };

      setCustomNotifications(prev => {
        const next = [newItem, ...prev].slice(0, 20);
        try {
          localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(next));
        } catch {}
        return next;
      });

      if (preferences.soundEnabled) {
        playWellnessChime();
      }

      // If browser push is active and granted, send native alert
      if (
        preferences.browserPush &&
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        try {
          new Notification(newItem.title, {
            body: newItem.message,
            icon: '/icon.jpg',
            badge: '/icon.jpg',
          });
        } catch (pushErr) {
          console.warn('Browser push error:', pushErr);
        }
      }
    },
    [preferences.soundEnabled, preferences.browserPush]
  );

  const sendTestNotification = useCallback(() => {
    if (preferences.soundEnabled) {
      playWellnessChime();
    }

    addCustomNotification({
      title: '✨ Svanexa AI Wellness Alert',
      message: `Hello ${userName}! Your smart alerts and notifications are working perfectly.`,
      category: 'system',
      priority: 'high',
      actionUrl: '/dashboard',
      actionLabel: 'Open Dashboard',
    });

    if (
      preferences.browserPush &&
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      try {
        new Notification('✨ Svanexa AI Wellness Alert', {
          body: `Hello ${userName}! Your browser push alerts are active and running.`,
          icon: '/icon.jpg',
        });
      } catch (e) {}
    }

    toast.success('Test notification sent!');
  }, [preferences.soundEnabled, preferences.browserPush, addCustomNotification, userName]);

  const value = useMemo(
    () => ({
      notifications: allNotifications,
      unreadCount,
      preferences,
      permissionStatus,
      markAsRead,
      markAllAsRead,
      dismissNotification,
      clearAll,
      updatePreferences,
      requestPushPermission,
      sendTestNotification,
      addCustomNotification,
    }),
    [
      allNotifications,
      unreadCount,
      preferences,
      permissionStatus,
      markAsRead,
      markAllAsRead,
      dismissNotification,
      clearAll,
      updatePreferences,
      requestPushPermission,
      sendTestNotification,
      addCustomNotification,
    ]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
