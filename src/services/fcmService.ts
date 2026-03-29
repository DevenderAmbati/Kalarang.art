import { getMessaging, getToken, onMessage, isSupported, Messaging } from "firebase/messaging";
import { doc, setDoc, deleteDoc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { getApp } from "firebase/app";

let messagingInstance: Messaging | null = null;
let fcmSupported: boolean | null = null;

async function checkSupported(): Promise<boolean> {
  if (fcmSupported !== null) return fcmSupported;
  try {
    fcmSupported = await isSupported();
  } catch {
    fcmSupported = false;
  }
  return fcmSupported;
}

async function getMessagingInstance(): Promise<Messaging | null> {
  if (messagingInstance) return messagingInstance;
  const supported = await checkSupported();
  if (!supported) return null;

  try {
    const app = getApp();
    messagingInstance = getMessaging(app);
    return messagingInstance;
  } catch (error) {
    return null;
  }
}

function getVapidKey(): string {
  const key = process.env.REACT_APP_FIREBASE_VAPID_KEY;
  if (!key) {
    throw new Error("[FCM] REACT_APP_FIREBASE_VAPID_KEY is not set in environment variables");
  }
  return key;
}

/**
 * Request notification permission and retrieve an FCM token.
 * Does NOT auto-request — only call this on explicit user action.
 */
export async function enableNotifications(userId: string): Promise<{ success: boolean; token?: string; error?: string }> {
  const supported = await checkSupported();
  if (!supported) {
    return { success: false, error: "Push notifications are not supported on this browser/device." };
  }

  if (Notification.permission === "denied") {
    return {
      success: false,
      error: "Notifications are blocked. Please allow notifications in your browser settings (click the lock icon in the address bar) and try again.",
    };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { success: false, error: "Notification permission was denied." };
  }

  try {
    const messaging = await getMessagingInstance();
    if (!messaging) {
      return { success: false, error: "Failed to initialize messaging." };
    }

    let swRegistration: ServiceWorkerRegistration | undefined;
    if ("serviceWorker" in navigator) {
      swRegistration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
      await navigator.serviceWorker.ready;
    }

    const token = await getToken(messaging, {
      vapidKey: getVapidKey(),
      serviceWorkerRegistration: swRegistration,
    });

    if (!token) {
      return { success: false, error: "Could not retrieve FCM token." };
    }

    await saveToken(userId, token);

    return { success: true, token };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to enable notifications." };
  }
}

/**
 * Disable notifications: remove the token from Firestore for this device.
 */
export async function disableNotifications(userId: string): Promise<void> {
  const deviceId = getDeviceId();
  const tokenDocRef = doc(db, "userTokens", `${userId}_${deviceId}`);
  await deleteDoc(tokenDocRef);
}

/**
 * Check if the current user has notifications enabled on this device.
 */
export async function isNotificationsEnabled(userId: string): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission !== "granted") return false;

  const deviceId = getDeviceId();
  const tokenDocRef = doc(db, "userTokens", `${userId}_${deviceId}`);
  const snap = await getDoc(tokenDocRef);
  return snap.exists();
}

/**
 * Save FCM token under Firestore "userTokens" collection.
 * Document ID: {userId}_{deviceId} for multi-device support.
 */
async function saveToken(userId: string, token: string): Promise<void> {
  const deviceId = getDeviceId();
  const tokenDocRef = doc(db, "userTokens", `${userId}_${deviceId}`);
  await setDoc(tokenDocRef, {
    userId,
    token,
    deviceId,
    platform: getPlatform(),
    userAgent: navigator.userAgent,
    createdAt: new Date(),
    updatedAt: new Date(),
  }, { merge: true });
}

/**
 * Listen for foreground messages. Returns an unsubscribe function.
 * When a message arrives while the app is in the foreground, the callback fires.
 */
export async function onForegroundMessage(
  callback: (payload: any) => void
): Promise<(() => void) | null> {
  const messaging = await getMessagingInstance();
  if (!messaging) return null;
  return onMessage(messaging, callback);
}

function getDeviceId(): string {
  const KEY = "kalarang_device_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem(KEY, id);
  }
  return id;
}

function getPlatform(): string {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  if (/Mac/.test(ua)) return "macos";
  if (/Win/.test(ua)) return "windows";
  if (/Linux/.test(ua)) return "linux";
  return "unknown";
}

/**
 * Tell service workers the chat thread currently visible so FCM can suppress
 * duplicate notifications for that thread (pair chats + commission chats).
 */
export function notifyServiceWorkerActiveChatId(chatId: string | null): void {
  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: "SET_ACTIVE_CHAT",
      chatId,
    });
  }
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      if (registration.active) {
        registration.active.postMessage({
          type: "SET_ACTIVE_CHAT",
          chatId,
        });
      }
    });
  });
}
