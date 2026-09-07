import { NotificationCategory, NotificationPriority, NotificationPreferences, DEFAULT_NOTIFICATION_PREFERENCES } from '@/types/notifications';
import { sendWebPush, PushNotificationPayload } from './web-push';
import { getCronSupabaseClient, getUserPreferencesMap } from './cron-utils';

export interface SendNotificationOptions {
  userId: string;
  title: string;
  message: string;
  category: NotificationCategory;
  priority?: NotificationPriority;
  actionUrl?: string;
  actionLabel?: string;
  tag?: string;
  icon?: string;
  badge?: string;
  metadata?: Record<string, any>;
  checkPreferences?: boolean;
  slot?: 'morning' | 'afternoon' | 'evening' | 'streak';
  userPreference?: NotificationPreferences;
}

export interface NotificationDispatchResult {
  userId: string;
  delivered: boolean;
  persistedToInbox: boolean;
  pushSentCount: number;
  suppressed: boolean;
  reason?: string;
}

export interface UserLocalTime {
  hour: number;
  minute: number;
  dateStr: string;
  formatted: string;
}

/**
 * Accurately gets user's local hour, minute, and dateStr in their configured timezone.
 * Falls back safely to 'Asia/Kolkata' if invalid or not specified.
 */
export function getUserLocalTime(timezone: string = 'Asia/Kolkata', date: Date = new Date()): UserLocalTime {
  const safeTimezone = timezone && typeof timezone === 'string' && timezone.trim() ? timezone.trim() : 'Asia/Kolkata';

  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: safeTimezone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    const parts = formatter.formatToParts(date);
    const partMap: Record<string, string> = {};
    for (const p of parts) {
      partMap[p.type] = p.value;
    }

    const year = partMap.year || String(date.getFullYear());
    const month = partMap.month || String(date.getMonth() + 1).padStart(2, '0');
    const day = partMap.day || String(date.getDate()).padStart(2, '0');
    const hour = parseInt(partMap.hour || '0', 10);
    const minute = parseInt(partMap.minute || '0', 10);
    const dateStr = `${year}-${month}-${day}`;

    return {
      hour,
      minute,
      dateStr,
      formatted: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    };
  } catch (err) {
    // If timezone string was invalid
    console.warn(`[NotificationEngine] Invalid timezone "${timezone}", falling back to UTC:`, err);
    return {
      hour: date.getUTCHours(),
      minute: date.getUTCMinutes(),
      dateStr: date.toISOString().slice(0, 10),
      formatted: `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`,
    };
  }
}

/**
 * Checks whether user has enabled notifications for a specific category and slot.
 * Strictly respects the master switch (enabled: false) and individual category switches.
 */
export function isNotificationAllowed(
  prefs: NotificationPreferences | undefined,
  category: NotificationCategory,
  slot?: 'morning' | 'afternoon' | 'evening' | 'streak'
): boolean {
  if (!prefs) return true;

  // Master switch overrides all
  if (prefs.enabled === false) return false;

  switch (category) {
    case 'checkin':
      if (slot === 'morning') return prefs.morningCheckin ?? prefs.checkinAlerts ?? true;
      if (slot === 'afternoon') return prefs.afternoonCheckin ?? prefs.checkinAlerts ?? true;
      if (slot === 'evening' || slot === 'streak') return prefs.eveningCheckin ?? prefs.checkinAlerts ?? true;
      return prefs.checkinAlerts ?? true;

    case 'cycle':
      return prefs.cycleTracker ?? prefs.cycleAlerts ?? true;

    case 'hydration':
      return prefs.hydrationAlerts ?? true;

    case 'supplements':
      return prefs.supplementAlerts ?? prefs.wellnessPlan ?? true;

    case 'skin':
      return prefs.skinAlerts ?? true;

    case 'luna':
      return prefs.aiCompanion ?? prefs.lunaInsights ?? true;

    case 'rewards':
      return prefs.coinsRewards ?? true;

    case 'reports':
      return prefs.wellnessPlan ?? true;

    case 'system':
    default:
      return true;
  }
}

/**
 * Determines appropriate checkin slot based on user's local hour and custom reminder schedule.
 */
export function determineUserSlot(
  localHour: number,
  schedule = DEFAULT_NOTIFICATION_PREFERENCES.reminderSchedule
): 'morning' | 'afternoon' | 'evening' {
  const morningH = parseInt((schedule.morningTime || '08:30').split(':')[0], 10);
  const afternoonH = parseInt((schedule.afternoonTime || '14:00').split(':')[0], 10);
  const eveningH = parseInt((schedule.eveningTime || '21:30').split(':')[0], 10);

  if (localHour < (afternoonH || 12)) {
    return 'morning';
  } else if (localHour < (eveningH || 18)) {
    return 'afternoon';
  } else {
    return 'evening';
  }
}

/**
 * Persists a notification to the public.notifications table.
 * Gracefully ignores table absence if schema migration hasn't been run yet.
 */
export async function persistNotificationToDatabase(
  supabase: any,
  options: {
    userId: string;
    title: string;
    message: string;
    category: NotificationCategory;
    priority?: NotificationPriority;
    actionUrl?: string;
    actionLabel?: string;
    metadata?: Record<string, any>;
  }
): Promise<boolean> {
  try {
    const { error } = await supabase.from('notifications').insert({
      user_id: options.userId,
      title: options.title,
      message: options.message,
      category: options.category,
      priority: options.priority || 'normal',
      action_url: options.actionUrl || null,
      action_label: options.actionLabel || null,
      metadata: options.metadata || {},
      read: false,
      dismissed: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (error) {
      // If table doesn't exist yet (PGRST205 or similar), log softly
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('[NotificationEngine] notifications table not yet migrated.');
      } else {
        console.warn('[NotificationEngine] Failed to persist notification:', error.message);
      }
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[NotificationEngine] Exception in persistNotificationToDatabase:', err);
    return false;
  }
}

/**
 * High-level method to send a notification to a specific user.
 * 1. Verifies user preferences.
 * 2. Persists to in-app notification inbox.
 * 3. Dispatches Web Push to all active registered devices.
 * 4. Cleans up any expired subscriptions.
 */
export async function sendNotificationToUser(
  supabase: any,
  options: SendNotificationOptions
): Promise<NotificationDispatchResult> {
  const {
    userId,
    title,
    message,
    category,
    priority = 'normal',
    actionUrl,
    actionLabel,
    tag,
    icon = '/logo.jpg',
    badge = '/logo.jpg',
    metadata = {},
    checkPreferences = true,
    slot,
  } = options;

  let prefs = options.userPreference;
  if (!prefs && checkPreferences) {
    const prefMap = await getUserPreferencesMap(supabase, [userId]);
    prefs = prefMap.get(userId);
  }

  // Check preferences
  if (checkPreferences && !isNotificationAllowed(prefs, category, slot)) {
    return {
      userId,
      delivered: false,
      persistedToInbox: false,
      pushSentCount: 0,
      suppressed: true,
      reason: 'Preferences disabled for category or slot',
    };
  }

  // 1. Persist to database inbox
  const persisted = await persistNotificationToDatabase(supabase, {
    userId,
    title,
    message,
    category,
    priority,
    actionUrl,
    actionLabel,
    metadata,
  });

  // 2. If browserPush is turned OFF in preferences, don't send push
  if (prefs && prefs.browserPush === false) {
    return {
      userId,
      delivered: true,
      persistedToInbox: persisted,
      pushSentCount: 0,
      suppressed: false,
      reason: 'browserPush disabled in preferences, inbox only',
    };
  }

  // 3. Query active push subscriptions
  const { data: subscriptions, error: subsErr } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId);

  if (subsErr || !subscriptions || subscriptions.length === 0) {
    return {
      userId,
      delivered: true,
      persistedToInbox: persisted,
      pushSentCount: 0,
      suppressed: false,
      reason: 'No push devices registered, inbox only',
    };
  }

  const payload: PushNotificationPayload = {
    title,
    message,
    url: actionUrl || '/check-in',
    actionUrl: actionUrl || '/check-in',
    actionLabel: actionLabel || 'Open App',
    tag: tag || `svanexa-${category}-${Date.now()}`,
    icon,
    badge,
    category: category === 'rewards' || category === 'reports' ? 'system' : category,
  };

  const deadSubIds: string[] = [];
  let pushSentCount = 0;

  for (const sub of subscriptions) {
    const res = await sendWebPush(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      payload
    );

    if (res.success) {
      pushSentCount++;
    }
    if (res.shouldDeleteSubscription) {
      deadSubIds.push(sub.id);
    }
  }

  if (deadSubIds.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', deadSubIds);
  }

  return {
    userId,
    delivered: true,
    persistedToInbox: persisted,
    pushSentCount,
    suppressed: false,
  };
}

/**
 * Standardized batch notification runner for cron jobs.
 * Handles:
 * - Querying subscriptions
 * - Fetching user profiles and preferences
 * - Evaluating custom user-level filter
 * - Dispatching via sendNotificationToUser
 * - Cleaning up dead subscriptions
 */
export async function dispatchBatchNotifications(options: {
  supabase?: any;
  category: NotificationCategory;
  priority?: NotificationPriority;
  generatePayload: (user: {
    userId: string;
    profile: any;
    preference: NotificationPreferences;
    localTime: UserLocalTime;
  }) => {
    shouldSend: boolean;
    title: string;
    message: string;
    actionUrl?: string;
    actionLabel?: string;
    tag?: string;
    metadata?: Record<string, any>;
    slot?: 'morning' | 'afternoon' | 'evening' | 'streak';
  } | null | Promise<{
    shouldSend: boolean;
    title: string;
    message: string;
    actionUrl?: string;
    actionLabel?: string;
    tag?: string;
    metadata?: Record<string, any>;
    slot?: 'morning' | 'afternoon' | 'evening' | 'streak';
  } | null>;
  targetUserId?: string | null;
}) {
  const supabase = options.supabase || getCronSupabaseClient();

  // 1. Fetch subscriptions
  let query = supabase.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth');
  if (options.targetUserId) {
    query = query.eq('user_id', options.targetUserId);
  }

  const { data: subscriptions, error: subsErr } = await query;
  if (subsErr || !subscriptions?.length) {
    return {
      success: true,
      totalUsers: 0,
      sentCount: 0,
      suppressedCount: 0,
      message: 'No push subscriptions found to process',
    };
  }

  // 2. Group by user
  const userIds = [...new Set(subscriptions.map((s: any) => s.user_id))] as string[];

  // 3. Fetch profiles and preferences in parallel
  const [profilesRes, prefMap] = await Promise.all([
    supabase.from('profiles').select('id, username, first_name, last_name').in('id', userIds),
    getUserPreferencesMap(supabase, userIds),
  ]);

  const profileMap = new Map<string, any>();
  if (profilesRes.data) {
    for (const p of profilesRes.data) profileMap.set(p.id, p);
  }

  const userSubMap = new Map<string, any[]>();
  for (const s of subscriptions) {
    const list = userSubMap.get(s.user_id) || [];
    list.push(s);
    userSubMap.set(s.user_id, list);
  }

  let sentCount = 0;
  let suppressedCount = 0;
  const deadIds: string[] = [];

  for (const userId of userIds) {
    const profile = profileMap.get(userId) || {};
    const preference = prefMap.get(userId) || DEFAULT_NOTIFICATION_PREFERENCES;
    const localTime = getUserLocalTime(preference.timezone);

    // Run user-provided payload generator
    const payloadDecision = await options.generatePayload({
      userId,
      profile,
      preference,
      localTime,
    });

    if (!payloadDecision || !payloadDecision.shouldSend) {
      continue;
    }

    // Check preferences
    if (!isNotificationAllowed(preference, options.category, payloadDecision.slot)) {
      suppressedCount++;
      continue;
    }

    // Persist to inbox
    await persistNotificationToDatabase(supabase, {
      userId,
      title: payloadDecision.title,
      message: payloadDecision.message,
      category: options.category,
      priority: options.priority || 'normal',
      actionUrl: payloadDecision.actionUrl,
      actionLabel: payloadDecision.actionLabel,
      metadata: payloadDecision.metadata,
    });

    // If browser push is enabled, send push
    if (preference.browserPush !== false) {
      const userSubs = userSubMap.get(userId) || [];
      const pushPayload: PushNotificationPayload = {
        title: payloadDecision.title,
        message: payloadDecision.message,
        url: payloadDecision.actionUrl || '/check-in',
        actionUrl: payloadDecision.actionUrl || '/check-in',
        actionLabel: payloadDecision.actionLabel || 'Open Svanexa',
        tag: payloadDecision.tag || `svanexa-${options.category}-${localTime.dateStr}`,
        category: options.category === 'rewards' || options.category === 'reports' ? 'system' : options.category,
      };

      for (const sub of userSubs) {
        const res = await sendWebPush(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          pushPayload
        );
        if (res.success) sentCount++;
        if (res.shouldDeleteSubscription) deadIds.push(sub.id);
      }
    }
  }

  if (deadIds.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', deadIds);
  }

  return {
    success: true,
    totalUsers: userIds.length,
    sentCount,
    suppressedCount,
    cleanedUpSubscriptions: deadIds.length,
  };
}
