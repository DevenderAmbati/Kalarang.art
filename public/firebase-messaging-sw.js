/* eslint-disable no-restricted-globals */

importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyAv7RrDWmGLuefKpduSC3-GutFXxlUFlUQ",
  authDomain: "kalarang-eff3c.firebaseapp.com",
  projectId: "kalarang-eff3c",
  storageBucket: "kalarang-eff3c.firebasestorage.app",
  messagingSenderId: "88807694030",
  appId: "1:88807694030:web:c028be9e00bcf4687e3a9f",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  const title = data.title || "Kalarang";
  const body = data.body || "You have a new notification";
  const iconUrl = self.location.origin + "/square%20logo.png";
  const tag = data.chatId ? "chat_" + data.chatId : data.type || "default";

  return self.registration.showNotification(title, {
    body,
    icon: iconUrl,
    tag,
    renotify: true,
    data: { url: data.url || "/" },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      return clients.openWindow(url);
    })
  );
});
