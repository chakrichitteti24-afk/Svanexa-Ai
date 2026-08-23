import webpush from 'web-push';

export interface PushNotificationPayload {
  title: string;
  message: string;
  url?: string;
  actionUrl?: string;
  actionLabel?: string;
  tag?: string;
  icon?: string;
  badge?: string;
  category?: 'checkin' | 'cycle' | 'hydration' | 'supplements' | 'skin' | 'luna' | 'system';
}

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

// VAPID keys — generated matched pair (override with env vars in production)
const DEFAULT_VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BPGf2eVzhz5vAW3RJXzhvJc3iEw8a-klLa7XON_YZra7y3bu8t4G1x3qfeCrYRW-f0VH59y1QQdD08KFu8xpvOw';

const DEFAULT_VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY ||
  'wxU3YnFS7BjEDWU9_do00YMrNjERv2gs4LG0IOgs28g';

const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT || 'mailto:support@svanexa.ai';

let vapidConfigured = false;

function ensureVapidConfig() {
  if (!vapidConfigured) {
    try {
      webpush.setVapidDetails(
        VAPID_SUBJECT,
        DEFAULT_VAPID_PUBLIC_KEY,
        DEFAULT_VAPID_PRIVATE_KEY
      );
      vapidConfigured = true;
    } catch (err) {
      console.error('Failed to configure web-push VAPID details:', err);
    }
  }
}

export function getVapidPublicKey(): string {
  return DEFAULT_VAPID_PUBLIC_KEY;
}

export async function sendWebPush(
  subscription: PushSubscriptionData,
  payload: PushNotificationPayload
): Promise<{ success: boolean; statusCode?: number; error?: string; shouldDeleteSubscription?: boolean }> {
  ensureVapidConfig();

  try {
    const pushPayload = JSON.stringify({
      title: payload.title,
      message: payload.message,
      body: payload.message,
      url: payload.url || payload.actionUrl || '/check-in',
      actionUrl: payload.actionUrl || payload.url || '/check-in',
      actionLabel: payload.actionLabel || 'Complete Check-In',
      tag: payload.tag || 'svanexa-reminder',
      icon: payload.icon || '/logo.jpg',
      badge: payload.badge || '/logo.jpg',
      category: payload.category || 'checkin',
      timestamp: Date.now(),
    });

    const response = await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
      },
      pushPayload
    );

    return {
      success: true,
      statusCode: response.statusCode,
    };
  } catch (err: any) {
    const statusCode = err.statusCode || err.status;
    const errorMessage = err.message || 'Unknown web-push error';

    // Status code 404 or 410 indicates subscription has expired or unsubscribed
    const isExpired = statusCode === 404 || statusCode === 410;

    return {
      success: false,
      statusCode,
      error: errorMessage,
      shouldDeleteSubscription: isExpired,
    };
  }
}

export function generateCheckinReminderPayload(
  userName: string = 'there',
  slot: 'morning' | 'afternoon' | 'evening' | 'streak',
  currentStreak: number = 0
): PushNotificationPayload {
  const cleanName = userName && userName.trim() ? userName.trim() : 'there';

  switch (slot) {
    case 'morning':
      return {
        title: '🌅 Morning Wellness Check-In Ready',
        message: `Good morning ${cleanName}! Take 60 seconds to log your morning wellness & kickstart your day.`,
        url: '/check-in',
        actionLabel: 'Log Morning Slot',
        tag: 'checkin-morning',
        category: 'checkin',
      };
    case 'afternoon':
      return {
        title: '☀️ Afternoon Energy & Mood Check',
        message: `Hey ${cleanName}, how are your energy and stress levels feeling today? Take a moment to log.`,
        url: '/check-in',
        actionLabel: 'Log Afternoon Slot',
        tag: 'checkin-afternoon',
        category: 'checkin',
      };
    case 'evening':
      return {
        title: '🌙 Evening Journal & Daily Close-Out',
        message: `Hey ${cleanName}, close out your day with your evening journal and habits reflection.`,
        url: '/check-in',
        actionLabel: 'Log Evening Slot',
        tag: 'checkin-evening',
        category: 'checkin',
      };
    case 'streak':
      return {
        title: `🔥 Protect Your ${currentStreak}-Day Streak!`,
        message: `You haven't logged today's check-in yet, ${cleanName}! Complete it before midnight to keep your ${currentStreak}-day streak alive.`,
        url: '/check-in',
        actionLabel: 'Keep Streak Alive',
        tag: 'checkin-streak-preservation',
        category: 'checkin',
      };
    default:
      return {
        title: '🌸 Svanexa AI: Daily Check-In Reminder',
        message: `Hey ${cleanName}, your daily wellness check-in is waiting for you!`,
        url: '/check-in',
        actionLabel: 'Open Check-In',
        tag: 'checkin-default',
        category: 'checkin',
      };
  }
}
