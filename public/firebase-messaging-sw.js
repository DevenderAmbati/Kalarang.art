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

// Chrome shows "This site has been updated in the background" if we receive a push
// but never display a visible notification. Always show a notification and catch errors.
function showSafeNotification(title, body, iconUrl, tag, url) {
  const options = {
    body: String(body || "You have a new notification"),
    tag: tag || "default",
    renotify: true,
    data: { url: url || "/" },
  };
  if (iconUrl) options.icon = iconUrl;
  return self.registration.showNotification(String(title || "Kalarang"), options);
}

messaging.onBackgroundMessage((payload) => {
  try {
    const data = (payload && payload.data) || {};
    const title = data.title || "Kalarang";
    const body = data.body || "You have a new notification";
    const iconUrl = self.location.origin + "/square%20logo.png";
    const tag = data.chatId ? "chat_" + data.chatId : (data.type || "default");
    const url = data.url || "/";

    return showSafeNotification(title, body, iconUrl, tag, url).catch(() => {
      return showSafeNotification(title, body, null, tag, url);
    });
  } catch (e) {
    return showSafeNotification("Kalarang", "You have a new notification", null, "default", "/");
  }
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
