// Svanexa AI — Service Worker for Background Push Notifications & Offline Caching
const CACHE_NAME = 'svanexa-v1';

// Install Event
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Background Push Event (Wakes up phone even when app is closed / phone locked)
self.addEventListener('push', (event) => {
  if (!event.data) return;

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
  } catch (err) {
    payload.message = event.data.text() || payload.message;
  }

  const notificationOptions = {
    body: payload.message || payload.body,
    icon: payload.icon || '/logo.jpg',
    badge: payload.badge || '/logo.jpg',
    tag: payload.tag || 'svanexa-notification',
    renotify: true,
    vibrate: [200, 100, 200],
    data: {
      url: payload.url || payload.actionUrl || '/check-in',
      timestamp: Date.now(),
    },
    actions: [
      {
        action: 'open',
        title: payload.actionLabel || 'Complete Check-In',
      },
      {
        action: 'close',
        title: 'Later',
      },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, notificationOptions)
  );
});

// Notification Click Handler (Directs user to /check-in or target URL)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url) || '/check-in';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a window is already open, focus it and navigate
      for (const client of windowClients) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client && client.url !== targetUrl) {
            return client.navigate(targetUrl);
          }
          return;
        }
      }
      // If no window is open, open a new one
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
