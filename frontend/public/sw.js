// Svanexa AI — Service Worker
// Handles background push notifications from server AND local scheduling
const CACHE_NAME = 'svanexa-sw-v4';

// ─── Install & Activate ───────────────────────────────────────────────────────
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// ─── Background Push Event ────────────────────────────────────────────────────
// Fires when phone receives push from server (even if app is closed / phone locked)
self.addEventListener('push', (event) => {
  let title = '🌸 Svanexa AI Wellness Reminder';
  let body = 'Time for your daily health and wellness check-in!';
  let targetUrl = '/check-in';
  let tag = 'svanexa-reminder-' + Date.now();

  if (event.data) {
    try {
      const json = event.data.json();
      if (json.title) title = json.title;
      if (json.message || json.body) body = json.message || json.body;
      if (json.url || json.actionUrl) targetUrl = json.url || json.actionUrl;
      if (json.tag) tag = json.tag;
    } catch {
      try {
        const text = event.data.text();
        if (text) body = text;
      } catch {}
    }
  }

  const notificationOptions = {
    body,
    icon: '/logo.jpg',
    badge: '/logo.jpg',
    tag,
    renotify: true,
    vibrate: [300, 100, 300],
    data: { url: targetUrl },
    actions: [
      { action: 'open', title: 'Open Svanexa 🌸' }
    ]
  };

  event.waitUntil(
    self.registration
      .showNotification(title, notificationOptions)
      .catch(() => {
        // Fallback with minimal options if actions/icons fail on device
        return self.registration.showNotification(title, {
          body,
          data: { url: targetUrl },
        });
      })
  );
});

// ─── Notification Click ───────────────────────────────────────────────────────
// When the user taps the notification → open the app at /check-in
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : '/check-in';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // If app window is already open, focus it and navigate
        for (const client of windowClients) {
          try {
            client.postMessage({
              type: 'NOTIFICATION_ACTION_CLICK',
              url: targetUrl,
              tag: event.notification.tag,
            });
          } catch {}
          if ('focus' in client) {
            client.focus();
            if ('navigate' in client) {
              return client.navigate(targetUrl);
            }
            return;
          }
        }
        // App is not open — open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

// ─── Notification Close / Dismiss ────────────────────────────────────────────
self.addEventListener('notificationclose', () => {
  // User dismissed — nothing required
});

// ─── Periodic Background Sync ─────────────────────────────────────────────────
// Runs when the browser gives a sync opportunity in background (Chromium only)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'svanexa-checkin-check') {
    event.waitUntil(checkAndNotifyIfMissed());
  }
});

// ─── Background Message from Client ──────────────────────────────────────────
// Frontend can post messages to the service worker to schedule local reminders
let recurring5MinIntervalId = null;

self.addEventListener('message', (event) => {
  if (!event.data) return;

  // Start 5-minute recurring reminder loop until check-in is finished
  if (event.data.type === 'START_5MIN_RECURRING_REMINDER') {
    const { userName, streakCount, intervalMs } = event.data;
    const ms = intervalMs || 5 * 60 * 1000; // 5 minutes default

    if (recurring5MinIntervalId) {
      clearInterval(recurring5MinIntervalId);
    }

    recurring5MinIntervalId = setInterval(() => {
      fireLocalCheckinReminder('streak', userName, streakCount);
    }, ms);
  }

  // Stop 5-minute recurring reminder loop when check-in is logged
  if (
    event.data.type === 'STOP_RECURRING_REMINDERS' ||
    event.data.type === 'CHECKIN_COMPLETED_STOP_REMINDERS' ||
    event.data.type === 'CANCEL_REMINDERS'
  ) {
    if (recurring5MinIntervalId) {
      clearInterval(recurring5MinIntervalId);
      recurring5MinIntervalId = null;
    }
    if (event.source) {
      event.source.postMessage({ type: 'REMINDERS_CANCELLED' });
    }
  }

  if (event.data.type === 'SCHEDULE_CHECKIN_REMINDER') {
    const { slot, userName, streakCount, delayMs } = event.data;
    const delay = delayMs || 0;

    if (delay > 0) {
      setTimeout(() => {
        fireLocalCheckinReminder(slot, userName, streakCount);
      }, delay);
    } else {
      fireLocalCheckinReminder(slot, userName, streakCount);
    }
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getSlotPayload(slot, userName, streakCount) {
  const name = (userName && userName.trim()) ? userName.trim() : 'there';
  const streak = streakCount || 0;

  switch (slot) {
    case 'morning':
      return {
        title: `🌅 Good morning, ${name}`,
        body: `Whenever you have a calm moment, take 60 seconds to check in with how your body is feeling today. No rush — wishing you a lovely day ahead! 🌸`,
        tag: 'checkin-morning',
      };
    case 'afternoon':
      return {
        title: `☀️ Midday wellness pause, ${name}`,
        body: `Just a gentle check-in to see how you're feeling this afternoon. Remember to pause, take a deep breath, and care for yourself. 🌿`,
        tag: 'checkin-afternoon',
      };
    case 'evening':
      return {
        title: `🌙 Evening reflection, ${name}`,
        body: `Before winding down tonight, take a quiet minute to log your daily wellness notes. Wishing you restful sleep and recovery. ✨`,
        tag: 'checkin-evening',
      };
    case 'streak':
      return {
        title: streak > 0 ? `✨ A gentle evening reminder, ${name}` : `🌸 Daily wellness check-in, ${name}`,
        body: streak > 0
          ? `You've taken wonderful care of your health for ${streak} days! If you have a free minute before sleep, your daily reflection is waiting for you.`
          : `Whenever you're ready, take 60 seconds to log today's check-in. Every small step matters for your health.`,
        tag: 'checkin-streak',
      };
    default:
      return {
        title: `🌸 Gentle health check-in, ${name}`,
        body: `Take 60 seconds to check in with your wellness today whenever it's most convenient for you.`,
        tag: 'checkin-default',
      };
  }
}

function fireLocalCheckinReminder(slot, userName, streakCount) {
  const payload = getSlotPayload(slot, userName, streakCount);

  try {
    self.registration
      .showNotification(payload.title, {
        body: payload.body,
        icon: '/logo.jpg',
        badge: '/logo.jpg',
        tag: payload.tag || 'checkin-reminder',
        renotify: true,
        vibrate: [200, 100, 200],
        requireInteraction: false,
        data: { url: '/check-in' },
      })
      .catch(() => {
        return self.registration.showNotification(payload.title, {
          body: payload.body,
          data: { url: '/check-in' },
        });
      });
  } catch (e) {
    try {
      self.registration.showNotification(payload.title, {
        body: payload.body,
        data: { url: '/check-in' },
      });
    } catch {}
  }
}

async function checkAndNotifyIfMissed() {
  // Periodic sync background check — minimal version
  try {
    const clients = await self.clients.matchAll({ type: 'window' });
    if (clients.length > 0) {
      // App is open — don't show notification
      return;
    }
    // App is closed — fire a gentle reminder
    await self.registration.showNotification('🌸 Svanexa Wellness Reminder', {
      body: "Don't forget your daily wellness check-in!",
      icon: '/logo.jpg',
      badge: '/logo.jpg',
      tag: 'periodic-sync-reminder',
      vibrate: [200, 100, 200],
      data: { url: '/check-in' },
      actions: [
        { action: 'open', title: 'Open Check-In ✅' },
        { action: 'dismiss', title: 'Later' },
      ],
    });
  } catch (_err) {}
}
