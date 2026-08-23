// Svanexa AI — Service Worker
// Handles background push notifications from server AND local scheduling
const CACHE_NAME = 'svanexa-sw-v2';

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
  if (!event.data) {
    // Fallback: no data - show generic reminder
    event.waitUntil(
      self.registration.showNotification('🌸 Svanexa AI Wellness Reminder', {
        body: "Time for your daily health and wellness check-in!",
        icon: '/logo.jpg',
        badge: '/logo.jpg',
        tag: 'svanexa-generic',
        data: { url: '/check-in' },
        vibrate: [200, 100, 200],
      })
    );
    return;
  }

  let payload = {
    title: '🌸 Svanexa AI Wellness Reminder',
    message: 'Time for your daily health and wellness check-in!',
    url: '/check-in',
    tag: 'svanexa-checkin-reminder',
    icon: '/logo.jpg',
    badge: '/logo.jpg',
  };

  try {
    const json = event.data.json();
    payload = { ...payload, ...json };
  } catch {
    try {
      payload.message = event.data.text() || payload.message;
    } catch {}
  }

  const notificationOptions = {
    body: payload.message || payload.body || payload.title,
    icon: payload.icon || '/logo.jpg',
    badge: payload.badge || '/logo.jpg',
    tag: payload.tag || 'svanexa-notification',
    renotify: true,
    vibrate: [200, 100, 200],
    requireInteraction: false,
    silent: false,
    data: {
      url: payload.url || payload.actionUrl || '/check-in',
    },
    actions: [
      {
        action: 'open',
        title: payload.actionLabel || 'Complete Check-In ✅',
      },
      {
        action: 'dismiss',
        title: 'Remind Later',
      },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, notificationOptions)
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
self.addEventListener('message', (event) => {
  if (!event.data) return;

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

  if (event.data.type === 'CANCEL_REMINDERS') {
    // Nothing to cancel since we use push notifications, but ack
    if (event.source) {
      event.source.postMessage({ type: 'REMINDERS_CANCELLED' });
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
        title: '🌅 Morning Wellness Check-In',
        body: `Good morning ${name}! Take 60 seconds to log your morning wellness check-in.`,
        tag: 'checkin-morning',
      };
    case 'afternoon':
      return {
        title: '☀️ Afternoon Check-In Reminder',
        body: `Hey ${name}, how are your energy and stress levels? Log your midday wellness.`,
        tag: 'checkin-afternoon',
      };
    case 'evening':
      return {
        title: '🌙 Evening Journal Reminder',
        body: `Hey ${name}, close out your day with your evening wellness journal.`,
        tag: 'checkin-evening',
      };
    case 'streak':
      return {
        title: streak > 0 ? `🔥 Protect Your ${streak}-Day Streak!` : '🔥 Complete Your Check-In!',
        body: streak > 0
          ? `You haven't logged today yet, ${name}! Complete it before midnight to protect your ${streak}-day streak.`
          : `Don't forget your wellness check-in today, ${name}!`,
        tag: 'checkin-streak',
      };
    default:
      return {
        title: '🌸 Svanexa: Daily Check-In Ready',
        body: `Hey ${name}, your daily wellness check-in is ready!`,
        tag: 'checkin-default',
      };
  }
}

function fireLocalCheckinReminder(slot, userName, streakCount) {
  const payload = getSlotPayload(slot, userName, streakCount);

  self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: '/logo.jpg',
    badge: '/logo.jpg',
    tag: payload.tag,
    renotify: true,
    vibrate: [200, 100, 200],
    requireInteraction: false,
    data: { url: '/check-in' },
    actions: [
      { action: 'open', title: 'Complete Check-In ✅' },
      { action: 'dismiss', title: 'Remind Later' },
    ],
  });
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
  } catch (err) {
    console.warn('[SW] Periodic sync notification failed:', err);
  }
}
