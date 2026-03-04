/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope;

clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);

const fileExtensionRegexp = new RegExp('/[^/?]+\\.[^/]+$');
registerRoute(
  ({ request, url }: { request: Request; url: URL }) => {
    if (request.mode !== 'navigate') {
      return false;
    }
    if (url.pathname.startsWith('/_')) {
      return false;
    }
    if (url.pathname.match(fileExtensionRegexp)) {
      return false;
    }
    return true;
  },
  createHandlerBoundToURL(process.env.PUBLIC_URL + '/index.html')
);

registerRoute(
  ({ url }) =>
    url.origin === self.location.origin && url.pathname.endsWith('.png'),
  new StaleWhileRevalidate({
    cacheName: 'images',
    plugins: [new ExpirationPlugin({ maxEntries: 50 })],
  })
);

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// If this SW is the controller and receives a push (e.g. FCM), we must show a notification
// or Chrome will show "This site has been updated in the background".
// For chat notifications when app is in foreground, let the app handle it (for active chat filtering).
self.addEventListener('push', (event: PushEvent) => {
  let title = 'Kalarang';
  let body = 'You have a new notification';
  let url = '/';
  let notificationType = '';
  let chatId = '';
  
  if (event.data) {
    try {
      const json = event.data.json() as { data?: Record<string, unknown>; title?: string; body?: string; url?: string; type?: string; chatId?: string };
      const d = json.data || json;
      if (d && typeof d === 'object') {
        if (typeof d.title === 'string') title = d.title;
        if (typeof d.body === 'string') body = d.body;
        if (typeof d.url === 'string') url = d.url;
        if (typeof d.type === 'string') notificationType = d.type;
        if (typeof d.chatId === 'string') chatId = d.chatId;
      }
    } catch {
      // use defaults
    }
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if any client window is currently visible/focused
      const hasVisibleClient = clientList.some((client) => 
        (client as WindowClient).visibilityState === 'visible'
      );

      // If app is in foreground and this is a chat notification, let the app handle it
      // (the app will decide whether to show it based on active chat)
      if (hasVisibleClient && notificationType === 'chat' && chatId) {
        return;
      }

      // For all other cases (background, or non-chat notifications), show the notification
      const icon = `${self.location.origin}/square%20logo.png`;
      return self.registration.showNotification(title, { body, icon, data: { url } }).catch(() => {
        return self.registration.showNotification(title, { body, data: { url } });
      });
    })
  );
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const path = event.notification.data?.url || '/';
  const fullUrl = path.startsWith('http') ? path : new URL(path, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          (client as WindowClient).navigate(fullUrl);
          return;
        }
      }
      return self.clients.openWindow(fullUrl);
    })
  );
});
