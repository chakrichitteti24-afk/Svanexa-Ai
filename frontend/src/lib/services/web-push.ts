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
        title: '🌅 Hey! Don\'t forget your check-in today',
        message: `Good morning ${cleanName}! 👋 You haven't completed your morning check-in yet. It only takes 60 seconds — your health matters! Open Svanexa now.`,
        url: '/check-in',
        actionLabel: 'Complete Check-In ✅',
        tag: 'checkin-morning',
        category: 'checkin',
      };
    case 'afternoon':
      return {
        title: `☀️ Hey ${cleanName}! Quick health check-in?`,
        message: `Hi ${cleanName}! 👋 You haven't logged your afternoon check-in yet. How are you feeling today? Take 60 seconds to track your wellness — your body will thank you!`,
        url: '/check-in',
        actionLabel: 'Log Now ✅',
        tag: 'checkin-afternoon',
        category: 'checkin',
      };
    case 'evening':
      return {
        title: '🌙 Hey! Complete your check-in before bed',
        message: `Hey ${cleanName}! 👋 Don't forget to complete your daily check-in before you sleep. Tracking your health every day helps Svanexa give you better care. It only takes a minute!`,
        url: '/check-in',
        actionLabel: 'Complete Now ✅',
        tag: 'checkin-evening',
        category: 'checkin',
      };
    case 'streak':
      return {
        title: currentStreak > 0
          ? `🔥 ${cleanName}, your ${currentStreak}-day streak is at risk!`
          : `👋 ${cleanName}, complete your check-in today!`,
        message: currentStreak > 0
          ? `Hey ${cleanName}! You haven't checked in yet today 😟 Your ${currentStreak}-day streak will be lost at midnight. Take 60 seconds to protect it — open Svanexa now!`
          : `Hey ${cleanName}! 👋 You haven't completed your daily health check-in yet today. Your wellness matters — it only takes 60 seconds. Don't forget!`,
        url: '/check-in',
        actionLabel: currentStreak > 0 ? `Protect Streak 🔥` : 'Check In Now ✅',
        tag: 'checkin-streak-preservation',
        category: 'checkin',
      };
    default:
      return {
        title: '👋 Hey! Complete your health check-in today',
        message: `Hi ${cleanName}! You haven't completed today's wellness check-in yet. Stay on top of your health — open Svanexa and take 60 seconds to log how you're feeling!`,
        url: '/check-in',
        actionLabel: 'Open Check-In ✅',
        tag: 'checkin-default',
        category: 'checkin',
      };
  }
}
