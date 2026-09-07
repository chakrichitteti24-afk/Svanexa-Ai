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
        title: `🌅 Good morning, ${cleanName}`,
        message: `Whenever you have a calm moment, take 60 seconds to check in with how your body is feeling today. No rush — wishing you a lovely day ahead! 🌸`,
        url: '/check-in',
        actionLabel: 'Check In When Ready 🌸',
        tag: 'checkin-morning',
        category: 'checkin',
      };
    case 'afternoon':
      return {
        title: `☀️ Midday wellness pause, ${cleanName}`,
        message: `Just a gentle check-in to see how you're feeling this afternoon. Remember to pause, take a deep breath, and care for yourself. 🌿`,
        url: '/check-in',
        actionLabel: 'Take a Moment 🌿',
        tag: 'checkin-afternoon',
        category: 'checkin',
      };
    case 'evening':
      return {
        title: `🌙 Evening reflection, ${cleanName}`,
        message: `Before winding down tonight, take a quiet minute to log your daily wellness notes. Wishing you restful sleep and recovery. ✨`,
        url: '/check-in',
        actionLabel: 'Evening Check-In ✨',
        tag: 'checkin-evening',
        category: 'checkin',
      };
    case 'streak':
      return {
        title: currentStreak > 0
          ? `✨ A gentle evening reminder, ${cleanName}`
          : `🌸 Daily wellness check-in, ${cleanName}`,
        message: currentStreak > 0
          ? `You've taken wonderful care of your health for ${currentStreak} days! If you have a free minute before sleep, your daily reflection is waiting for you.`
          : `Whenever you're ready, take 60 seconds to log today's check-in. Every small step matters for your health.`,
        url: '/check-in',
        actionLabel: currentStreak > 0 ? 'Log Reflection ✨' : 'Check In When Ready 🌸',
        tag: 'checkin-streak-preservation',
        category: 'checkin',
      };
    default:
      return {
        title: `🌸 Gentle health check-in, ${cleanName}`,
        message: `Take 60 seconds to check in with your wellness today whenever it's most convenient for you.`,
        url: '/check-in',
        actionLabel: 'Open Check-In 🌸',
        tag: 'checkin-default',
        category: 'checkin',
      };
  }
}
