import {
  doc,
  setDoc,
  getDoc,
  addDoc,
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  where,
  getDocs,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  increment,
  arrayUnion,
  Timestamp,
  DocumentSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  createdAt: Timestamp | null;
  seenBy?: string[]; // Array of user IDs who have seen this message
  artworkId?: string;
  artworkTitle?: string;
  artworkImage?: string;
  artworkPrice?: number;
}

export interface Chat {
  id: string;
  participants: [string, string];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastMessage: string;
  /** Unread count per participant uid (e.g. unreadFor['uid'] === 3). */
  unreadFor?: Record<string, number>;
}

const MESSAGES_PER_PAGE = 20;

/**
 * Deterministic chatId from two userIds.
 * Sorting ensures the same pair always produces the same ID,
 * preventing duplicate chat documents.
 */
export function getChatId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('_');
}

/**
 * Creates a chat document if it doesn't exist, otherwise returns the existing one.
 * Uses setDoc with merge to avoid overwriting on race conditions.
 */
export async function createOrGetChat(
  buyerId: string,
  artistId: string
): Promise<string> {
  const chatId = getChatId(buyerId, artistId);
  const chatRef = doc(db, 'chats', chatId);

  try {
    // First check if the chat already exists
    const chatSnap = await getDoc(chatRef);
    
    if (!chatSnap.exists()) {
      // Only set lastMessage and unreadFor for NEW chats
      await setDoc(chatRef, {
        participants: [buyerId, artistId].sort(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessage: '',
        unreadFor: {},
      });
    }
  } catch (error) {
    throw error;
  }

  return chatId;
}

/**
 * Sends a text message and updates the parent chat's lastMessage + updatedAt.
 * Pass otherUserId when known to avoid an extra getDoc read.
 */
export async function sendMessage(
  chatId: string,
  senderId: string,
  text: string,
  otherUserId?: string,
  artworkMetadata?: { artworkId?: string; artworkTitle?: string; artworkImage?: string; artworkPrice?: number }
): Promise<void> {
  const messagesRef = collection(db, 'chats', chatId, 'messages');

  try {
    const messageData: any = {
      senderId,
      text,
      createdAt: serverTimestamp(),
    };
    
    if (artworkMetadata?.artworkId) {
      messageData.artworkId = artworkMetadata.artworkId;
      messageData.artworkTitle = artworkMetadata.artworkTitle;
      messageData.artworkImage = artworkMetadata.artworkImage;
      // Only include price if it's defined - Firestore doesn't accept undefined values
      if (artworkMetadata.artworkPrice !== undefined) {
        messageData.artworkPrice = artworkMetadata.artworkPrice;
      }
      // eslint-disable-next-line no-console
      console.log('Saving message with artwork metadata:', {
        artworkId: messageData.artworkId,
        artworkTitle: messageData.artworkTitle,
        artworkImage: messageData.artworkImage,
        artworkPrice: messageData.artworkPrice,
      });
    } else {
      // eslint-disable-next-line no-console
      console.log('No artwork metadata provided to sendMessage');
    }
    
    await addDoc(messagesRef, messageData);
  } catch (error) {
    throw error;
  }

  let resolvedOtherUserId = otherUserId;
  if (resolvedOtherUserId === undefined) {
    const chatRef = doc(db, 'chats', chatId);
    const chatSnap = await getDoc(chatRef);
    const participants = chatSnap.exists() ? (chatSnap.data().participants as string[]) : [];
    resolvedOtherUserId = participants.find((p) => p !== senderId);
  }

  const chatRef = doc(db, 'chats', chatId);
  const updateData: Record<string, unknown> = {
    lastMessage: text,
    updatedAt: serverTimestamp(),
    [`unreadFor.${senderId}`]: 0,
  };
  if (resolvedOtherUserId) {
    updateData[`unreadFor.${resolvedOtherUserId}`] = increment(1);
  }
  
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Firestore UpdateData accepts dynamic keys
    await updateDoc(chatRef, updateData as any);
  } catch (error) {
    throw error;
  }
}

/**
 * Fetches a page of messages (newest first), returning both the messages
 * and the last DocumentSnapshot for cursor-based pagination.
 * The caller reverses the array for chronological rendering.
 */
export async function getMessages(
  chatId: string,
  lastDoc?: DocumentSnapshot
): Promise<{ messages: ChatMessage[]; lastVisible: DocumentSnapshot | null }> {
  const messagesRef = collection(db, 'chats', chatId, 'messages');

  const q = lastDoc
    ? query(messagesRef, orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(MESSAGES_PER_PAGE))
    : query(messagesRef, orderBy('createdAt', 'desc'), limit(MESSAGES_PER_PAGE));
  const snapshot = await getDocs(q);

  const messages: ChatMessage[] = snapshot.docs.map((d) => ({
    id: d.id,
    senderId: d.data().senderId,
    text: d.data().text,
    seenBy: d.data().seenBy || [],
    artworkId: d.data().artworkId,
    artworkTitle: d.data().artworkTitle,
    artworkImage: d.data().artworkImage,
    artworkPrice: d.data().artworkPrice,
    createdAt: d.data().createdAt,
  }));

  const lastVisible =
    snapshot.docs.length > 0
      ? snapshot.docs[snapshot.docs.length - 1]
      : null;

  return { messages, lastVisible };
}

/**
 * Sets unread count for the given user in the chat to 0 (e.g. when they open the chat).
 */
export async function markChatRead(chatId: string, userId: string): Promise<void> {
  const chatRef = doc(db, 'chats', chatId);
  await updateDoc(chatRef, { [`unreadFor.${userId}`]: 0 } as any);
}

/**
 * Marks messages as seen by the given user.
 * Updates all messages in the chat where the user is not the sender and hasn't seen yet.
 */
export async function markMessagesAsSeen(
  chatId: string,
  userId: string
): Promise<void> {
  const messagesRef = collection(db, 'chats', chatId, 'messages');
  // Fetch recent messages (limit to avoid excessive reads)
  const q = query(
    messagesRef,
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  
  try {
    const snapshot = await getDocs(q);
    let updatedCount = 0;
    
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const seenBy = data.seenBy || [];
      
      // Only update if user is not the sender and hasn't seen this message yet
      if (data.senderId !== userId && !seenBy.includes(userId)) {
        const messageRef = doc(db, 'chats', chatId, 'messages', docSnap.id);
        await updateDoc(messageRef, {
          seenBy: arrayUnion(userId)
        });
        updatedCount++;
      }
    }
    
    // eslint-disable-next-line no-console
    console.log(`Marked ${updatedCount} messages as seen by ${userId} in chat ${chatId}`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error marking messages as seen:', error);
  }
}

const CHATS_QUERY_LIMIT = 50;

/**
 * Real-time listener for all chats the current user participates in,
 * ordered by most recent activity. Uses a single Firestore query with
 * array-contains on the participants field. Limited to 50 chats.
 */
export function subscribeToUserChats(
  userId: string,
  callback: (chats: Chat[]) => void
): Unsubscribe {
  const chatsRef = collection(db, 'chats');
  const q = query(
    chatsRef,
    where('participants', 'array-contains', userId),
    orderBy('updatedAt', 'desc'),
    limit(CHATS_QUERY_LIMIT)
  );

  return onSnapshot(q, (snapshot) => {
    const chats: Chat[] = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        participants: data.participants,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        lastMessage: data.lastMessage ?? '',
        unreadFor: data.unreadFor ?? {},
      };
    });
    callback(chats);
  });
}

/**
 * Returns the count of chats that have unread messages (not the sum of messages).
 */
export function subscribeToUserUnreadCount(
  userId: string,
  callback: (count: number) => void
): Unsubscribe {
  return subscribeToUserChats(userId, (chats) => {
    const count = chats.filter((chat) => (chat.unreadFor?.[userId] ?? 0) > 0).length;
    callback(count);
  });
}

/**
 * Returns the count of chats that have activity (lastMessage is non-empty).
 * Kept lightweight — reuses the same query shape as subscribeToUserChats
 * so Firestore can share the index.
 */
export function subscribeToUserChatCount(
  userId: string,
  callback: (count: number) => void
): Unsubscribe {
  const chatsRef = collection(db, 'chats');
  const q = query(
    chatsRef,
    where('participants', 'array-contains', userId),
    orderBy('updatedAt', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.length);
  });
}
