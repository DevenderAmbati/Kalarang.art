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

// Track the currently active chat ID (sent from the app)
let activeChatId: string | null = null;

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'SET_ACTIVE_CHAT') {
    activeChatId = event.data.chatId;
  }
});

// If this SW is the controller and receives a push (e.g. FCM), we must show a notification
// or Chrome will show "This site has been updated in the background".
// Suppress notifications for the currently active chat.
self.addEventListener('push', (event: PushEvent) => {
  let title = 'BrushOwl';
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

  // If this is a chat notification for the currently active chat, suppress it
  if (notificationType === 'chat' && chatId && activeChatId === chatId) {
    event.waitUntil(Promise.resolve());
    return;
  }

  // Show notification for all other cases
  const icon = `${self.location.origin}/icon.png`;
  
  // Create tag for grouping notifications by type
  // For chat messages, group by chatId; for others, group by type
  const tag = notificationType === 'chat' && chatId 
    ? `chat-${chatId}` 
    : notificationType || 'default';
  
  event.waitUntil(
    (async () => {
      // Get existing notifications with the same tag to accumulate messages
      const existingNotifications = await self.registration.getNotifications({ tag });
      let messages: string[] = [];
      let notificationTitle = title;
      
      // If there are existing notifications, get their messages
      if (existingNotifications.length > 0) {
        const existingData = existingNotifications[0].data;
        if (existingData && Array.isArray(existingData.messages)) {
          messages = existingData.messages;
        }
        // Close existing notifications since we'll replace them
        existingNotifications.forEach(n => n.close());
      }
      
      // Add the new message to the list
      messages.push(body);
      
      // Limit to last 5 messages to avoid overly long notifications
      if (messages.length > 5) {
        messages = messages.slice(-5);
      }
      
      // Format the notification body
      let displayBody = body;
      if (messages.length > 1) {
        // Show all messages on separate lines
        displayBody = messages.join('\n');
      }
      
      try {
        await self.registration.showNotification(notificationTitle, { 
          body: displayBody, 
          icon,
          badge: icon,
          tag,
          data: { url, messages },
          silent: false,
          requireInteraction: false
        });
      } catch {
        await self.registration.showNotification(notificationTitle, { 
          body: displayBody, 
          badge: icon,
          tag,
          data: { url, messages },
          silent: false,
          requireInteraction: false
        });
      }
    })()
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
