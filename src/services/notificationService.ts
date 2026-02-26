import { db } from "../firebase";
import {
  collection,
  doc,
  setDoc,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  updateDoc,
  serverTimestamp,
  Timestamp,
  writeBatch,
  onSnapshot,
  Unsubscribe,
} from "firebase/firestore";

export interface Notification {
  id: string;
  type: 'follow' | 'reachout' | 'favourite';
  recipientId: string; // Artist who receives the notification
  actorId: string; // User who performed the action
  actorName: string;
  actorAvatar?: string;
  artworkId?: string; // For favourite and reachout notifications
  artworkTitle?: string;
  artworkImage?: string;
  contactMethod?: 'whatsapp' | 'email'; // For reachout notifications
  timestamp: Date;
  isRead: boolean;
}

/**
 * Create a notification
 */
export async function createNotification(
  recipientId: string,
  type: 'follow' | 'reachout' | 'favourite',
  actorId: string,
  actorName: string,
  actorAvatar?: string,
  artworkId?: string,
  artworkTitle?: string,
  artworkImage?: string,
  contactMethod?: 'whatsapp' | 'email'
): Promise<void> {
  const notificationRef = doc(collection(db, "notifications"));
  await setDoc(notificationRef, {
    type,
    recipientId,
    actorId,
    actorName,
    actorAvatar: actorAvatar || null,
    artworkId: artworkId || null,
    artworkTitle: artworkTitle || null,
    artworkImage: artworkImage || null,
    contactMethod: contactMethod || null,
    timestamp: serverTimestamp(),
    isRead: false,
  });
}

/**
 * Get notifications for a user
 */
export async function getUserNotifications(
  userId: string,
  limitCount: number = 50
): Promise<Notification[]> {
  const notificationsRef = collection(db, "notifications");
  const q = query(
    notificationsRef,
    where("recipientId", "==", userId),
    orderBy("timestamp", "desc"),
    limit(limitCount)
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      type: data.type,
      recipientId: data.recipientId,
      actorId: data.actorId,
      actorName: data.actorName,
      actorAvatar: data.actorAvatar,
      artworkId: data.artworkId,
      artworkTitle: data.artworkTitle,
      artworkImage: data.artworkImage,
      contactMethod: data.contactMethod,
      timestamp: (data.timestamp as Timestamp)?.toDate() || new Date(),
      isRead: data.isRead,
    } as Notification;
  });
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  const notificationRef = doc(db, "notifications", notificationId);
  await updateDoc(notificationRef, {
    isRead: true,
  });
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  const notificationsRef = collection(db, "notifications");
  const q = query(
    notificationsRef,
    where("recipientId", "==", userId),
    where("isRead", "==", false)
  );

  const querySnapshot = await getDocs(q);
  const batch = writeBatch(db);

  querySnapshot.docs.forEach((doc) => {
    batch.update(doc.ref, { isRead: true });
  });

  await batch.commit();
}

/**
 * Get unread notification count
 */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const notificationsRef = collection(db, "notifications");
  const q = query(
    notificationsRef,
    where("recipientId", "==", userId),
    where("isRead", "==", false)
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.size;
}

/**
 * Subscribe to real-time notifications updates
 */
export function subscribeToNotifications(
  userId: string,
  onUpdate: (notifications: Notification[]) => void,
  limitCount: number = 50
): Unsubscribe {
  const notificationsRef = collection(db, "notifications");
  const q = query(
    notificationsRef,
    where("recipientId", "==", userId),
    orderBy("timestamp", "desc"),
    limit(limitCount)
  );

  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        type: data.type,
        recipientId: data.recipientId,
        actorId: data.actorId,
        actorName: data.actorName,
        actorAvatar: data.actorAvatar,
        artworkId: data.artworkId,
        artworkTitle: data.artworkTitle,
        artworkImage: data.artworkImage,
        contactMethod: data.contactMethod,
        timestamp: (data.timestamp as Timestamp)?.toDate() || new Date(),
        isRead: data.isRead,
      } as Notification;
    });
    onUpdate(notifications);
  });
}

/**
 * Subscribe to real-time unread count updates
 */
export function subscribeToUnreadCount(
  userId: string,
  onUpdate: (count: number) => void
): Unsubscribe {
  const notificationsRef = collection(db, "notifications");
  const q = query(
    notificationsRef,
    where("recipientId", "==", userId),
    where("isRead", "==", false)
  );

  return onSnapshot(q, (snapshot) => {
    onUpdate(snapshot.size);
  });
}

/**
 * Delete read notifications older than 30 days
 */
export async function deleteOldReadNotifications(userId: string): Promise<void> {
  const notificationsRef = collection(db, "notifications");
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const q = query(
    notificationsRef,
    where("recipientId", "==", userId),
    where("isRead", "==", true),
    where("timestamp", "<", Timestamp.fromDate(thirtyDaysAgo))
  );

  const querySnapshot = await getDocs(q);
  const batch = writeBatch(db);

  querySnapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  if (querySnapshot.size > 0) {
    await batch.commit();
    console.log(`Deleted ${querySnapshot.size} old read notifications`);
  }
}
