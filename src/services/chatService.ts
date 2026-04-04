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
import { markArtworkAsSold } from './artworkService';

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
  /** Firebase Storage download URL (full quality for display + download) */
  imageUrl?: string;
  messageType?: 'reachout_offer' | 'address_card';
  offerFinalPrice?: string;
  offerDeliveryDate?: string;
  offerStatus?: 'pending' | 'accepted';
  addressName?: string;
  addressLine1?: string;
  addressLine2?: string;
  addressCity?: string;
  addressPincode?: string;
  addressPhone?: string;
}

export interface AcceptedOffer {
  artworkId: string;
  artworkTitle: string;
  artworkImage?: string;
  finalPrice?: string;
  orderedAt?: Timestamp;
  artistId?: string;
  orderId?: string;
}

function generateOrderId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `KLR-${ts}-${rand}`;
}

export interface Chat {
  id: string;
  participants: [string, string];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastMessage: string;
  contextType?: 'commission' | 'artwork';
  contextId?: string;
  contextTitle?: string;
  contextImage?: string;
  /** Unread count per participant uid (e.g. unreadFor['uid'] === 3). */
  unreadFor?: Record<string, number>;
  /** artworkIds for which shipment has been confirmed by the artist. */
  shippedArtworkIds?: string[];
  /** Structured list of accepted offers (one per artwork). */
  acceptedOffers?: AcceptedOffer[];
  /** artworkId → tracking ID, written when artist confirms shipment. */
  trackingIds?: Record<string, string>;
  /** artworkId → shipped timestamp. */
  shippedAt?: Record<string, Timestamp>;
  /** True once any offer payment has been confirmed on this chat. */
  offerPaymentDone?: boolean;
  /** artworkIds for which payment has been confirmed (Buy Now or accepted offer). */
  paidArtworkIds?: string[];
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
  artistId: string,
  context?: {
    type?: 'commission' | 'artwork';
    id?: string;
    title?: string;
    image?: string;
  }
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
    } else if (context?.type === 'commission' && context.id) {
      // Preserve existing pair-chat behavior but attach commission context
      // so commission pages can discover relevant threads.
      await setDoc(
        chatRef,
        {
          contextType: 'commission',
          contextId: context.id,
          contextTitle: context.title || '',
          contextImage: context.image || '',
        },
        { merge: true }
      );
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
  artworkMetadata?: { artworkId?: string; artworkTitle?: string; artworkImage?: string; artworkPrice?: number },
  imageUrl?: string,
): Promise<void> {
  const messagesRef = collection(db, 'chats', chatId, 'messages');
  const trimmed = text.trim();
  if (!trimmed && !imageUrl) {
    throw new Error('Message must include text or an image.');
  }

  try {
    const messageData: any = {
      senderId,
      text: trimmed,
      createdAt: serverTimestamp(),
    };

    if (imageUrl) {
      messageData.imageUrl = imageUrl;
    }
    
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

/** Artist sends a price offer inside a regular (reach-out) chat. */
export async function sendReachOutOfferMessage(
  chatId: string,
  senderId: string,
  artworkId: string,
  artworkTitle: string | undefined,
  artworkImage: string | undefined,
  finalPrice: string,
  deliveryDate?: string,
): Promise<void> {
  const fp = finalPrice.trim();
  if (!fp) throw new Error('Please enter a final price.');

  const messagesRef = collection(db, 'chats', chatId, 'messages');
  const messageData: any = {
    senderId,
    text: `Offer: ₹${fp}`,
    messageType: 'reachout_offer',
    offerFinalPrice: fp,
    artworkId,
    artworkTitle: artworkTitle || '',
    artworkImage: artworkImage || '',
    seenBy: [senderId],
    createdAt: serverTimestamp(),
  };
  if (deliveryDate?.trim()) {
    messageData.offerDeliveryDate = deliveryDate.trim();
  }
  await addDoc(messagesRef, messageData);

  const chatRef = doc(db, 'chats', chatId);
  const chatSnap = await getDoc(chatRef);
  const participants = chatSnap.exists() ? (chatSnap.data().participants as string[]) : [];
  const otherUserId = participants.find((p) => p !== senderId);
  const updateData: Record<string, unknown> = {
    lastMessage: `Offer: ₹${fp}`,
    updatedAt: serverTimestamp(),
    [`unreadFor.${senderId}`]: 0,
  };
  if (otherUserId) updateData[`unreadFor.${otherUserId}`] = increment(1);
  await updateDoc(chatRef, updateData as any);
}

/** Buyer accepts an artist's reach-out offer — marks the message accepted and saves payment info on the chat. */
export async function acceptReachOutOffer(
  chatId: string,
  messageId: string,
  paymentAmount: string,
  artworkMetadata?: { artworkId: string; artworkTitle: string; artworkImage?: string; artistId?: string },
): Promise<void> {
  const msgRef = doc(db, 'chats', chatId, 'messages', messageId);
  await updateDoc(msgRef, { offerStatus: 'accepted' } as any);
  const chatRef = doc(db, 'chats', chatId);
  const updateData: Record<string, unknown> = {
    offerAccepted: true,
    offerPaymentAmount: paymentAmount,
    offerPaymentDone: true,
    updatedAt: serverTimestamp(),
  };
  if (artworkMetadata) {
    updateData[`acceptedOffers`] = arrayUnion({
      artworkId: artworkMetadata.artworkId,
      artworkTitle: artworkMetadata.artworkTitle,
      artworkImage: artworkMetadata.artworkImage ?? '',
      finalPrice: paymentAmount,
      orderedAt: Timestamp.now(),
      artistId: artworkMetadata.artistId ?? '',
      orderId: generateOrderId(),
    });
    updateData['paidArtworkIds'] = arrayUnion(artworkMetadata.artworkId);
    // Mark artwork as sold (non-blocking)
    markArtworkAsSold(artworkMetadata.artworkId).catch(() => {});
  }
  await updateDoc(chatRef, updateData as any);
}

/** Sends a structured address card message in a regular chat. */
export async function sendAddressCard(
  chatId: string,
  senderId: string,
  address: { name: string; line1: string; line2: string; city: string; pincode: string; phone: string },
  otherUserId?: string,
): Promise<void> {
  const messagesRef = collection(db, 'chats', chatId, 'messages');
  await addDoc(messagesRef, {
    senderId,
    text: 'Delivery address',
    messageType: 'address_card',
    addressName: address.name,
    addressLine1: address.line1,
    addressLine2: address.line2,
    addressCity: address.city,
    addressPincode: address.pincode,
    addressPhone: address.phone,
    seenBy: [senderId],
    createdAt: serverTimestamp(),
  });
  const chatRef = doc(db, 'chats', chatId);
  const resolvedOther = otherUserId ?? (() => {
    // otherUserId may be known at call-site; skip getDoc for perf
    return undefined;
  })();
  const updateData: Record<string, unknown> = {
    lastMessage: 'Delivery address',
    updatedAt: serverTimestamp(),
    [`unreadFor.${senderId}`]: 0,
  };
  if (resolvedOther) updateData[`unreadFor.${resolvedOther}`] = increment(1);
  await updateDoc(chatRef, updateData as any);
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
    imageUrl: d.data().imageUrl,
    messageType: d.data().messageType,
    offerFinalPrice: d.data().offerFinalPrice,
    offerDeliveryDate: d.data().offerDeliveryDate,
    offerStatus: d.data().offerStatus,
    addressName: d.data().addressName,
    addressLine1: d.data().addressLine1,
    addressLine2: d.data().addressLine2,
    addressCity: d.data().addressCity,
    addressPincode: d.data().addressPincode,
    addressPhone: d.data().addressPhone,
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
        contextType: data.contextType,
        contextId: data.contextId,
        contextTitle: data.contextTitle,
        contextImage: data.contextImage,
        unreadFor: data.unreadFor ?? {},
        shippedArtworkIds: data.shippedArtworkIds ?? [],
        acceptedOffers: data.acceptedOffers ?? [],
        trackingIds: data.trackingIds ?? {},
        offerPaymentDone: data.offerPaymentDone ?? false,
        paidArtworkIds: data.paidArtworkIds ?? [],
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

/**
 * Marks an artwork as shipped on the chat doc so the artist's card is
 * hidden persistently (survives page refresh). Buyer side is unaffected.
 */
export async function markArtworkShipped(chatId: string, artworkId: string, trackingId: string): Promise<void> {
  const chatRef = doc(db, 'chats', chatId);
  await updateDoc(chatRef, {
    shippedArtworkIds: arrayUnion(artworkId),
    [`trackingIds.${artworkId}`]: trackingId,
    [`shippedAt.${artworkId}`]: serverTimestamp(),
  } as any);
}

export interface BuyerOrder {
  chatId: string;
  artistId?: string;
  artworkId: string;
  artworkTitle: string;
  artworkImage?: string;
  finalPrice?: string;
  status: 'in_progress' | 'completed';
  trackingId?: string;
  orderedAt?: Timestamp;
  shippedAt?: Timestamp;
  orderId?: string;
}

/**
 * Returns all readymade artwork orders for a buyer, derived from chats
 * that have at least one accepted reach-out offer.
 */
/**
 * Direct "Buy Now" flow — creates/gets the chat, records payment, sends
 * automated message + address card. Returns the chatId.
 */
export async function processBuyNow(
  buyerId: string,
  artistId: string,
  artworkId: string,
  artworkTitle: string,
  artworkImage: string | undefined,
  price: string,
  address: { name: string; line1: string; line2: string; city: string; pincode: string; phone: string },
): Promise<string> {
  const chatId = await createOrGetChat(buyerId, artistId);
  const chatRef = doc(db, 'chats', chatId);
  const orderId = generateOrderId();
  await updateDoc(chatRef, {
    offerPaymentDone: true,
    offerPaymentAmount: price,
    paidArtworkIds: arrayUnion(artworkId),
    updatedAt: serverTimestamp(),
    acceptedOffers: arrayUnion({
      artworkId,
      artworkTitle,
      artworkImage: artworkImage ?? '',
      finalPrice: price,
      orderedAt: Timestamp.now(),
      artistId,
      orderId,
    }),
  } as any);

  // Automated chat message — includes artwork metadata so the context card appears in chat
  await sendMessage(
    chatId,
    buyerId,
    `I have paid ₹${price} for the painting "${artworkTitle}". Please ship it to the below address.`,
    artistId,
    { artworkId, artworkTitle, artworkImage, artworkPrice: Number(price) },
  );

  // Address card message
  await sendAddressCard(chatId, buyerId, address, artistId);

  // Mark artwork as sold (non-blocking — don't fail the purchase if this errors)
  markArtworkAsSold(artworkId).catch(() => {});

  return chatId;
}

export async function getBuyerOrders(userId: string): Promise<BuyerOrder[]> {
  const chatsRef = collection(db, 'chats');
  const q = query(
    chatsRef,
    where('participants', 'array-contains', userId),
    orderBy('updatedAt', 'desc'),
  );
  const snapshot = await getDocs(q);
  const orders: BuyerOrder[] = [];
  for (const d of snapshot.docs) {
    const data = d.data();
    const accepted: AcceptedOffer[] = data.acceptedOffers ?? [];
    if (accepted.length === 0) continue;
    const shipped: string[] = data.shippedArtworkIds ?? [];
    const trackingIds: Record<string, string> = data.trackingIds ?? {};
    const shippedAtMap: Record<string, Timestamp> = data.shippedAt ?? {};
    for (const offer of accepted) {
      orders.push({
        chatId: d.id,
        artistId: offer.artistId,
        artworkId: offer.artworkId,
        artworkTitle: offer.artworkTitle,
        artworkImage: offer.artworkImage,
        finalPrice: offer.finalPrice,
        orderId: offer.orderId,
        status: shipped.includes(offer.artworkId) ? 'completed' : 'in_progress',
        trackingId: trackingIds[offer.artworkId],
        orderedAt: offer.orderedAt,
        shippedAt: shippedAtMap[offer.artworkId],
      });
    }
  }
  return orders;
}
