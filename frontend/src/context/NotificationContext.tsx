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
import { apiFetch } from '@/utils/api-client';
import { differenceInDays, format } from 'date-fns';
import { toast } from 'sonner';

interface NotificationContextValue {
  notifications: NotificationItem[];
  unreadCount: number;
  preferences: NotificationPreferences;
  permissionStatus: NotificationPermission | 'unsupported';
  isPushSubscribed: boolean;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  dismissNotification: (id: string) => void;
  clearAll: () => void;
  updatePreferences: (newPrefs: Partial<NotificationPreferences>) => void;
  requestPushPermission: () => Promise<boolean>;
  sendTestNotification: () => void;
  sendDeviceTestPush: () => Promise<void>;
  scheduleReminderPush: (delaySeconds?: number) => Promise<void>;
  simulateMissedCheckinAlert: (slot?: 'morning' | 'afternoon' | 'evening' | 'streak') => Promise<void>;
  addCustomNotification: (item: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => void;
  refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

const STORAGE_KEY_PREFS = 'svanexa_notif_prefs_v1';
const STORAGE_KEY_READ = 'svanexa_notif_read_v1';
const STORAGE_KEY_DISMISSED = 'svanexa_notif_dismissed_v1';
const STORAGE_KEY_CUSTOM = 'svanexa_custom_notifs_v1';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const {
    todayLog,
    checkinSlots,
    allSlotsComplete,
    hasCheckedInToday,
    currentStreak,
    cycleHistory,
    preferences: herSyncPrefs,
    aiName,
    userName,
  } = useHerSync();

  const wellnessMode = herSyncPrefs?.theme || 'general';

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

  // Load preferences from Supabase as source of truth on mount
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const res = await apiFetch('/api/notifications/preferences');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.preferences && isMounted) {
            setPreferences((prev) => ({
              ...prev,
              ...data.preferences,
            }));
            try {
              localStorage.setItem(STORAGE_KEY_PREFS, JSON.stringify(data.preferences));
            } catch {}
          }
        }
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.debug('[NotificationContext] Could not load notification preferences from Supabase:', err);
        }
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

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

  const [persistedNotifications, setPersistedNotifications] = useState<NotificationItem[]>([]);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | 'unsupported'>('default');
  const [isPushSubscribed, setIsPushSubscribed] = useState<boolean>(false);

  const hasLoadedRef = useRef(true);
  const previousUnreadCountRef = useRef(0);

  // Sync client-side permission status on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermissionStatus(Notification.permission);
    }
  }, []);

  // Fetch persisted in-app notifications from backend inbox
  const fetchPersistedNotifications = useCallback(async () => {
    try {
      const res = await apiFetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.notifications)) {
          setPersistedNotifications(data.notifications);

          // Sync read status from server
          const serverRead = data.notifications.filter((n: any) => n.read).map((n: any) => n.id);
          if (serverRead.length > 0) {
            setReadIds(prev => {
              const next = new Set(prev);
              serverRead.forEach((id: string) => next.add(id));
              return next;
            });
          }
        }
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.debug('[NotificationContext] Could not fetch persisted notifications:', err);
      }
    }
  }, []);

  useEffect(() => {
    fetchPersistedNotifications();
  }, [fetchPersistedNotifications]);

  // 2. Save preferences to Supabase
  const updatePreferences = useCallback((newPrefs: Partial<NotificationPreferences>) => {
    setPreferences(prev => {
      const updated: NotificationPreferences = {
        ...prev,
        ...newPrefs,
        reminderSchedule: {
          ...prev.reminderSchedule,
          ...(newPrefs.reminderSchedule || {}),
        },
      };

      // Optimistic cache
      try {
        localStorage.setItem(STORAGE_KEY_PREFS, JSON.stringify(updated));
      } catch {}

      // Persist directly to Supabase as source of truth
      apiFetch('/api/notifications/preferences', {
        method: 'POST',
        body: JSON.stringify({ preferences: updated }),
      }).catch((err) => {
        if (process.env.NODE_ENV === 'development') {
          console.debug('[NotificationContext] Failed to sync notification preferences to Supabase:', err);
        }
      });

      return updated;
    });
  }, []);

  // Register Web Push subscription to Service Worker & Supabase
  const registerPushSubscription = useCallback(async (): Promise<boolean> => {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window)
    ) {
      return false;
    }

    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // Get public VAPID key from API
      let vapidKey = '';
      try {
        const res = await apiFetch('/api/notifications/vapid-key');
        const data = await res.json();
        if (data.success && data.publicKey) {
          vapidKey = data.publicKey;
        }
      } catch (e) {
        if (process.env.NODE_ENV === 'development') {
          console.debug('[NotificationContext] Could not fetch vapid key from API:', e);
        }
      }

      if (!vapidKey) {
        vapidKey =
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
          'BPGf2eVzhz5vAW3RJXzhvJc3iEw8a-klLa7XON_YZra7y3bu8t4G1x3qfeCrYRW-f0VH59y1QQdD08KFu8xpvOw';
      }

      const applicationServerKey = urlBase64ToUint8Array(vapidKey);

      // Reuse the existing subscription if one already exists — avoids churn
      let subscription = await reg.pushManager.getSubscription();
      if (!subscription) {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      }

      if (subscription) {
        const subJson = subscription.toJSON();
        if (subJson.keys?.p256dh && subJson.keys?.auth) {
          const res = await apiFetch('/api/notifications/subscribe', {
            method: 'POST',
            body: JSON.stringify({
              endpoint: subscription.endpoint,
              keys: subJson.keys,
              userAgent: navigator.userAgent,
            }),
          });
          const resJson = await res.json().catch(() => ({}));
          if (res.ok && resJson.success) {
            setIsPushSubscribed(true);
            return true;
          } else {
            if (process.env.NODE_ENV === 'development') {
              console.debug('Failed to save push subscription to backend:', resJson);
            }
            if (res.status === 401) {
              toast.error('Please log in first to enable push notifications on this device.');
            } else {
              toast.error(resJson.error || 'Failed to register push device with server.');
            }
            return false;
          }
        }
      }
      return false;
    } catch (err: any) {
      if (process.env.NODE_ENV === 'development') {
        console.debug('Error registering push subscription:', err);
      }
      toast.error(`Push subscription error: ${err.message || 'Unknown error'}`);
      return false;
    }
  }, []);

  // On mount: ensure Service Worker is registered & re-hydrate isPushSubscribed.
  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator)
    ) return;

    (async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;

        if ('PushManager' in window && 'Notification' in window && Notification.permission === 'granted') {
          const existingSub = await reg.pushManager.getSubscription();
          if (existingSub) {
            setIsPushSubscribed(true);
          } else {
            await registerPushSubscription();
          }
        }
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.debug('[NotificationContext] Service worker registration or push re-hydration note:', err);
        }
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount only

  // Schedule local SW reminders for today's uncompleted slots
  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      !('Notification' in window) ||
      Notification.permission !== 'granted' ||
      !preferences.enabled ||
      !preferences.checkinAlerts
    ) return;

    const sched = preferences.reminderSchedule;
    const morningTime = (sched?.morningTime || '08:30').split(':').map(Number);
    const afternoonTime = (sched?.afternoonTime || '14:00').split(':').map(Number);
    const eveningTime = (sched?.eveningTime || '21:30').split(':').map(Number);

    const now = new Date();

    function msUntil(h: number, m: number): number {
      const target = new Date();
      target.setHours(h, m, 0, 0);
      const diff = target.getTime() - now.getTime();
      return diff > 0 ? diff : -1; // -1 means time already passed today
    }

    const slots: Array<{ slot: string; ms: number; completed: boolean }> = [
      { slot: 'morning', ms: msUntil(morningTime[0], morningTime[1] || 0), completed: checkinSlots.morning.completed },
      { slot: 'afternoon', ms: msUntil(afternoonTime[0], afternoonTime[1] || 0), completed: checkinSlots.afternoon.completed },
      { slot: 'evening', ms: msUntil(eveningTime[0], eveningTime[1] || 0), completed: checkinSlots.evening.completed },
    ];

    const timers: ReturnType<typeof setTimeout>[] = [];

    slots.forEach(({ slot, ms, completed }) => {
      if (completed || ms < 0) return; // Already done or already past

      const timer = setTimeout(async () => {
        // Re-check if slot still not completed before firing
        const swReg = await navigator.serviceWorker.ready;
        swReg.active?.postMessage({
          type: 'SCHEDULE_CHECKIN_REMINDER',
          slot,
          userName: userName || 'there',
          streakCount: currentStreak,
          delayMs: 0,
        });
      }, ms);

      timers.push(timer);
    });

    // Also try to register Periodic Background Sync (Chromium/Android)
    (async () => {
      try {
        const swReg = await navigator.serviceWorker.ready;
        if ('periodicSync' in swReg) {
          const status = await navigator.permissions.query({
            name: 'periodic-background-sync' as PermissionName,
          });
          if (status.state === 'granted') {
            await (swReg as any).periodicSync.register('svanexa-checkin-check', {
              minInterval: 6 * 60 * 60 * 1000, // Every 6 hours
            });
          }
        }
      } catch {}
    })();

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [
    preferences.enabled,
    preferences.checkinAlerts,
    preferences.reminderSchedule,
    checkinSlots,
    currentStreak,
    userName,
  ]);

  // ─── 5-Minute Continuous Reminder Lifecycle (Default Core Feature) ───────────
  // When check-in is pending, arm the 5-minute repeating reminder.
  // When check-in is completed, immediately disarm and stop repeating reminders.
  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      !preferences.enabled ||
      !preferences.checkinAlerts ||
      !preferences.repeatUntilCheckinComplete
    ) {
      return;
    }

    const intervalMinutes = preferences.recurringIntervalMinutes || 5;
    const intervalMs = intervalMinutes * 60 * 1000;

    if (allSlotsComplete || hasCheckedInToday) {
      // Check-in complete: stop repeating reminders in Service Worker
      navigator.serviceWorker.ready
        .then((swReg) => {
          swReg.active?.postMessage({
            type: 'CHECKIN_COMPLETED_STOP_REMINDERS',
          });
        })
        .catch(() => {});
      return;
    }

    // Check-in NOT done: arm 5-minute recurring reminder in Service Worker
    navigator.serviceWorker.ready
      .then((swReg) => {
        swReg.active?.postMessage({
          type: 'START_5MIN_RECURRING_REMINDER',
          userName: userName || 'there',
          streakCount: currentStreak,
          intervalMs,
        });
      })
      .catch(() => {});

    // Active in-app interval loop
    const recurringTimer = setInterval(async () => {
      if (allSlotsComplete || hasCheckedInToday) return;

      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          const swReg = await navigator.serviceWorker.ready;
          swReg.active?.postMessage({
            type: 'SCHEDULE_CHECKIN_REMINDER',
            slot: 'streak',
            userName: userName || 'there',
            streakCount: currentStreak,
            delayMs: 0,
          });
        } catch {}
      }
    }, intervalMs);

    return () => {
      clearInterval(recurringTimer);
    };
  }, [
    preferences.enabled,
    preferences.checkinAlerts,
    preferences.repeatUntilCheckinComplete,
    preferences.recurringIntervalMinutes,
    allSlotsComplete,
    hasCheckedInToday,
    userName,
    currentStreak,
  ]);

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
        const registered = await registerPushSubscription();
        if (registered) {
          toast.success('Push alerts enabled! Device registered for background check-in reminders.');
          return true;
        }
        return false;
      } else if (result === 'denied') {
        updatePreferences({ browserPush: false });
        setIsPushSubscribed(false);
        toast.error('Notifications were blocked. Please enable them in browser site settings.');
        return false;
      }
      return false;
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.debug('Notification permission request note:', err);
      }
      return false;
    }
  }, [updatePreferences, registerPushSubscription]);

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

    const afternoonDecimal = afternoonParts[0] + (afternoonParts[1] || 0) / 60;
    const eveningDecimal = eveningParts[0] + (eveningParts[1] || 0) / 60;

    // 1. Morning Check-In Alert
    if (preferences.morningCheckin ?? preferences.checkinAlerts ?? true) {
      if (currentDecimal < afternoonDecimal && !checkinSlots.morning.completed) {
        alerts.push({
          id: `checkin-morning-${todayStr}`,
          title: userName ? `🌅 Good morning, ${userName}` : '🌅 Good morning',
          message: 'Whenever you have a calm moment, take 60 seconds to check in with how your body is feeling today. No rush — wishing you a lovely day ahead! 🌸',
          category: 'checkin',
          priority: 'normal',
          timestamp: new Date(now.getFullYear(), now.getMonth(), now.getDate(), morningParts[0], morningParts[1] || 0).toISOString(),
          read: false,
          actionUrl: '/check-in',
          actionLabel: 'Check In When Ready 🌸',
        });
      }
    }

    // 2. Afternoon Check-In Alert
    if (preferences.afternoonCheckin ?? preferences.checkinAlerts ?? true) {
      if (currentDecimal >= afternoonDecimal && currentDecimal < eveningDecimal && !checkinSlots.afternoon.completed) {
        alerts.push({
          id: `checkin-afternoon-${todayStr}`,
          title: userName ? `☀️ Midday wellness pause, ${userName}` : '☀️ Midday wellness pause',
          message: "Just a gentle check-in to see how you're feeling this afternoon. Remember to pause, take a deep breath, and care for yourself. 🌿",
          category: 'checkin',
          priority: 'normal',
          timestamp: new Date(now.getFullYear(), now.getMonth(), now.getDate(), afternoonParts[0], afternoonParts[1] || 0).toISOString(),
          read: false,
          actionUrl: '/check-in',
          actionLabel: 'Take a Moment 🌿',
        });
      }
    }

    // 3. Evening Check-In Alert
    if (preferences.eveningCheckin ?? preferences.checkinAlerts ?? true) {
      if (currentDecimal >= eveningDecimal && !checkinSlots.evening.completed) {
        alerts.push({
          id: `checkin-evening-${todayStr}`,
          title: userName ? `🌙 Evening reflection, ${userName}` : '🌙 Evening reflection',
          message: 'Before winding down tonight, take a quiet minute to log your daily wellness notes. Wishing you restful sleep and recovery. ✨',
          category: 'checkin',
          priority: 'normal',
          timestamp: new Date(now.getFullYear(), now.getMonth(), now.getDate(), eveningParts[0], eveningParts[1] || 0).toISOString(),
          read: false,
          actionUrl: '/check-in',
          actionLabel: 'Evening Check-In ✨',
        });
      }

      // Streak Preservation Alert (Before midnight if not checked in yet)
      if (currentStreak > 0 && !hasCheckedInToday && currentDecimal >= (eveningDecimal - 2)) {
        alerts.push({
          id: `streak-preservation-${todayStr}`,
          title: userName ? `✨ A gentle reminder, ${userName}` : '✨ Gentle evening check-in',
          message: `You've taken wonderful care of your health for ${currentStreak} days! If you have a free minute before sleep, your daily reflection is waiting for you.`,
          category: 'checkin',
          priority: 'high',
          timestamp: now.toISOString(),
          read: false,
          actionUrl: '/check-in',
          actionLabel: 'Log Reflection ✨',
        });
      }
    }

    // 4. Pending Wellness Tasks Alert
    if (preferences.wellnessTasks ?? true) {
      if (!allSlotsComplete && currentHour >= 12) {
        alerts.push({
          id: `wellness-tasks-${todayStr}`,
          title: '✨ Gentle Wellness Tasks',
          message: 'You have a wellness task waiting for you today whenever you are ready. Take it one step at a time! 🌸',
          category: 'checkin',
          priority: 'normal',
          timestamp: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0).toISOString(),
          read: false,
          actionUrl: '/dashboard',
          actionLabel: 'View When Ready 🌸',
        });
      }
    }

    // 5. Today's Wellness Plan Ready Alert
    if (preferences.wellnessPlan ?? true) {
      alerts.push({
        id: `wellness-plan-ready-${todayStr}`,
        title: '📋 Your Daily Care Plan',
        message: 'Your personalized wellness care plan for today is ready whenever you would like to view it.',
        category: 'system',
        priority: 'normal',
        timestamp: new Date(now.getFullYear(), now.getMonth(), now.getDate(), morningParts[0], (morningParts[1] || 0) + 15).toISOString(),
        read: false,
        actionUrl: '/wellness-plan',
        actionLabel: 'View Plan',
      });
    }

    // 6. Coins & Rewards Alert
    if (preferences.coinsRewards ?? true) {
      if (hasCheckedInToday) {
        alerts.push({
          id: `coins-reward-${todayStr}`,
          title: '🪙 Svanexa Rewards',
          message: 'You earned Svanexa Coins for your check-in today.',
          category: 'system',
          priority: 'low',
          timestamp: now.toISOString(),
          read: false,
          actionUrl: '/store',
          actionLabel: 'View Rewards',
        });
      }
    }

    // 7. Relevant Cycle Tracker Alert
    if ((preferences.cycleTracker ?? preferences.cycleAlerts ?? true) && Array.isArray(cycleHistory) && cycleHistory.length > 0) {
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
            alerts.push({
              id: `cycle-prediction-${prediction.expectedPeriod}`,
              title: '🌸 Cycle Tracker Update',
              message: 'Your daily wellness cycle update is ready.',
              category: 'cycle',
              priority: 'high',
              timestamp: now.toISOString(),
              read: false,
              actionUrl: '/cycle',
              actionLabel: 'View Calendar',
            });
          }
        }
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.debug('[NotificationContext] Cycle alert calculation note:', err);
        }
      }
    }

    // 8. Important AI Companion Notification
    if (preferences.aiCompanion ?? preferences.lunaInsights ?? true) {
      alerts.push({
        id: `ai-companion-note-${todayStr}`,
        title: `🤖 ${aiName || 'Luna'} AI`,
        message: `${aiName || 'Luna'} has a gentle wellness thought for you.`,
        category: 'luna',
        priority: 'normal',
        timestamp: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0).toISOString(),
        read: false,
        actionUrl: '/dashboard',
        actionLabel: 'Open Dashboard',
      });
    }

    return alerts;
  }, [
    preferences,
    todayLog,
    checkinSlots,
    allSlotsComplete,
    hasCheckedInToday,
    currentStreak,
    cycleHistory,
    wellnessMode,
    aiName,
  ]);

  // Combine persisted server notifications, dynamic alerts, and custom notifications
  const allNotifications = useMemo(() => {
    const combined = [...persistedNotifications, ...customNotifications, ...dynamicAlerts];

    // Deduplicate by ID and date-category signature
    const uniqueMap = new Map<string, NotificationItem>();
    for (const item of combined) {
      if (!dismissedIds.has(item.id) && !item.dismissed) {
        // Tag-like deduplication key to avoid showing identical reminders twice
        const dedupeKey = `${item.category}:${item.title}:${(item.timestamp || '').slice(0, 10)}`;
        if (!uniqueMap.has(item.id) && !uniqueMap.has(dedupeKey)) {
          uniqueMap.set(item.id, {
            ...item,
            read: readIds.has(item.id) || item.read,
          });
        }
      }
    }

    // Sort by timestamp descending
    return Array.from(uniqueMap.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [persistedNotifications, customNotifications, dynamicAlerts, dismissedIds, readIds]);

  const unreadCount = useMemo(() => {
    return allNotifications.filter(n => !n.read).length;
  }, [allNotifications]);

  // Dispatch Audio chime when new notifications arrive
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

    setPersistedNotifications(prev =>
      prev.map(item => item.id === id ? { ...item, read: true } : item)
    );

    // Sync to backend
    apiFetch('/api/notifications', {
      method: 'PATCH',
      body: JSON.stringify({ id, read: true }),
    }).catch(() => {});
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

    setPersistedNotifications(prev =>
      prev.map(item => ({ ...item, read: true }))
    );

    // Sync to backend
    apiFetch('/api/notifications', {
      method: 'PATCH',
      body: JSON.stringify({ all: true, action: 'markRead' }),
    }).catch(() => {});

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

    setPersistedNotifications(prev =>
      prev.filter(item => item.id !== id)
    );

    // Sync to backend
    apiFetch('/api/notifications', {
      method: 'PATCH',
      body: JSON.stringify({ id, dismissed: true, action: 'dismiss' }),
    }).catch(() => {});
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
    setPersistedNotifications([]);
    try {
      localStorage.removeItem(STORAGE_KEY_CUSTOM);
    } catch {}

    // Sync to backend
    apiFetch('/api/notifications', {
      method: 'DELETE',
    }).catch(() => {});

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
            icon: '/logo.jpg',
            badge: '/logo.jpg',
          });
        } catch (pushErr) {
          if (process.env.NODE_ENV === 'development') {
            console.debug('Browser push notice:', pushErr);
          }
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

    toast.success('In-app test notification sent!');
  }, [preferences.soundEnabled, addCustomNotification, userName]);

  // Send real background push notification to phone device
  const sendDeviceTestPush = useCallback(async () => {
    // First ensure this device is registered
    if (permissionStatus !== 'granted' || !isPushSubscribed) {
      const toastId = toast.loading('Registering this device first...');
      const granted = await requestPushPermission();
      if (!granted) {
        toast.error(
          '❌ Could not register device. Please allow notifications in your browser settings.',
          { id: toastId, duration: 6000 }
        );
        return;
      }
      toast.success('✅ Device registered! Sending test push now...', { id: toastId });
      // Small delay to let registration save to Supabase
      await new Promise((r) => setTimeout(r, 1500));
    }

    // 1. Direct device notification trigger for immediate on-screen appearance
    if ('serviceWorker' in navigator && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const swReg = await navigator.serviceWorker.ready;
        swReg.showNotification(`🌅 Good morning, ${userName || 'there'}`, {
          body: 'Whenever you have a calm moment, take 60 seconds to check in with how your body is feeling today. No rush — wishing you a lovely day ahead! 🌸',
          icon: '/logo.jpg',
          badge: '/logo.jpg',
          tag: 'checkin-test-direct',
          data: { url: '/check-in' },
        }).catch(() => {});
      } catch (swErr) {
        if (process.env.NODE_ENV === 'development') {
          console.debug('[NotificationContext] Direct SW notification fallback note:', swErr);
        }
      }
    }

    const toastId = toast.loading('Sending test push to your phone...');
    try {
      const res = await apiFetch('/api/notifications/test-push', {
        method: 'POST',
        body: JSON.stringify({
          delaySeconds: 0,
          type: 'checkin',
          slot: 'morning',
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(
          data.message || '✅ Push sent! Lock your phone and check the notification tray.',
          { id: toastId, duration: 6000 }
        );
      } else if (data.error === 'NO_DEVICE_REGISTERED') {
        toast.error(
          '❌ Phone not registered yet.\n\nTap the purple "Register This Phone" button above, allow notifications, then try again.',
          { id: toastId, duration: 8000 }
        );
      } else {
        toast.error(data.error || 'Failed to dispatch test push.', { id: toastId, duration: 6000 });
      }
    } catch (err: any) {
      toast.error('Network error. Is the app server running?', { id: toastId });
    }
  }, [permissionStatus, isPushSubscribed, requestPushPermission, userName]);

  // Schedule a real phone push reminder in N seconds (e.g. 5 minutes = 300s, 1 minute = 60s)
  const scheduleReminderPush = useCallback(
    async (delaySeconds: number = 300) => {
      // First ensure this device is registered
      if (permissionStatus !== 'granted' || !isPushSubscribed) {
        const toastId = toast.loading('Registering this device first...');
        const granted = await requestPushPermission();
        if (!granted) {
          toast.error(
            '❌ Could not register device. Please allow notifications in your browser settings.',
            { id: toastId, duration: 6000 }
          );
          return;
        }
        toast.success('✅ Device registered! Scheduling reminder...', { id: toastId });
        await new Promise((r) => setTimeout(r, 1200));
      }

      const label = delaySeconds >= 60 ? `${Math.round(delaySeconds / 60)} minute(s)` : `${delaySeconds} seconds`;
      const toastId = toast.loading(`Scheduling ${label} health reminder...`);

      try {
        // 1. Post to Service Worker local scheduler
        try {
          if ('serviceWorker' in navigator) {
            const swReg = await navigator.serviceWorker.ready;
            swReg.active?.postMessage({
              type: 'SCHEDULE_CHECKIN_REMINDER',
              slot: 'morning',
              userName: userName || 'there',
              streakCount: currentStreak,
              delayMs: delaySeconds * 1000,
            });
          }
        } catch (swErr) {
          if (process.env.NODE_ENV === 'development') {
            console.debug('[NotificationContext] SW message scheduler note:', swErr);
          }
        }

        // 2. Server-side scheduled Web Push
        const res = await apiFetch('/api/notifications/test-push', {
          method: 'POST',
          body: JSON.stringify({
            delaySeconds,
            type: 'checkin',
            slot: 'morning',
          }),
        });

        const data = await res.json();
        if (data.success) {
          toast.success(
            `⏱️ ${label} Reminder Scheduled!\n\nLock your phone and close the app now. In ${label}, Svanexa will ring/vibrate with your gentle check-in reminder!`,
            { id: toastId, duration: 8000 }
          );
        } else {
          toast.error(data.error || 'Failed to schedule reminder', { id: toastId, duration: 6000 });
        }
      } catch (err: any) {
        toast.error('Network error scheduling reminder.', { id: toastId });
      }
    },
    [permissionStatus, isPushSubscribed, requestPushPermission, userName, currentStreak]
  );

  // Trigger check-in missed simulation
  const simulateMissedCheckinAlert = useCallback(async (slot: 'morning' | 'afternoon' | 'evening' | 'streak' = 'morning') => {
    const toastId = toast.loading(`Checking incomplete check-ins for ${slot}...`);
    try {
      const res = await apiFetch(`/api/cron/checkin-reminder?slot=${slot}`);
      const data = await res.json();
      if (data.success) {
        toast.success(
          `Missed check-in check completed: ${data.incompleteUsers} user(s) pending, ${data.remindersSent} alert(s) sent!`,
          { id: toastId }
        );
      } else {
        toast.error(data.error || 'Check-in reminder simulation failed', { id: toastId });
      }
    } catch (err: any) {
      toast.error('Network error during check-in reminder check.', { id: toastId });
    }
  }, []);

  const value = useMemo(
    () => ({
      notifications: allNotifications,
      unreadCount,
      preferences,
      permissionStatus,
      isPushSubscribed,
      markAsRead,
      markAllAsRead,
      dismissNotification,
      clearAll,
      updatePreferences,
      requestPushPermission,
      sendTestNotification,
      sendDeviceTestPush,
      scheduleReminderPush,
      simulateMissedCheckinAlert,
      addCustomNotification,
      refreshNotifications: fetchPersistedNotifications,
    }),
    [
      allNotifications,
      unreadCount,
      preferences,
      permissionStatus,
      isPushSubscribed,
      markAsRead,
      markAllAsRead,
      dismissNotification,
      clearAll,
      updatePreferences,
      requestPushPermission,
      sendTestNotification,
      sendDeviceTestPush,
      scheduleReminderPush,
      simulateMissedCheckinAlert,
      addCustomNotification,
      fetchPersistedNotifications,
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
