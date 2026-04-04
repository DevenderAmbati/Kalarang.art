import {
  arrayUnion,
  addDoc,
  collection,
  doc,
  getDocs,
  getDoc,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  DocumentData,
} from 'firebase/firestore';
import { db } from '../firebase';

export interface CommissionChat {
  id: string;
  commissionId: string;
  participants: [string, string];
  updatedAt?: Timestamp;
  lastMessage?: string;
  unreadFor?: Record<string, number>;
  closed?: boolean;
  closedReason?: string;
}

/** Shown in chat list / stored on chat doc; neutral for buyer and artist previews. */
export const COMMISSION_HIRED_ELSEWHERE_MESSAGE =
  'Another artist was hired for this commission';

/** Artist-only encouragement in the closed-chat footer (Commissions modal). */
export const COMMISSION_HIRED_ELSEWHERE_MESSAGE_ARTIST =
  'Another artist was hired for this commission. Keep applying for other commission works.';

/** Buyer marked commission complete — chat list preview + footer for buyer and hired artist. */
export const COMMISSION_WORK_COMPLETED_MESSAGE =
  'Your commission work was successfully completed.';

export type CommissionOfferStatus = 'pending' | 'accepted';

export interface CommissionChatMessage {
  id: string;
  senderId: string;
  text: string;
  createdAt?: Timestamp | null;
  seenBy?: string[];
  commissionId: string;
  commissionTitle?: string;
  commissionImage?: string;
  /** Uploaded chat image (Storage URL) */
  imageUrl?: string;
  /** Artist-sent commission offer (structured card in chat) */
  messageType?: 'commission_offer' | 'address_card' | string;
  offerStatus?: CommissionOfferStatus;
  offerFinalPrice?: string;
  offerAdvanceAmount?: string;
  /** ISO date string (YYYY-MM-DD) */
  offerDeliveryDate?: string;
  acceptedAt?: Timestamp | null;
  /** Address card fields */
  addressName?: string;
  addressLine1?: string;
  addressLine2?: string;
  addressCity?: string;
  addressPincode?: string;
  addressPhone?: string;
}

export function getCommissionChatId(commissionId: string, uid1: string, uid2: string): string {
  const [a, b] = [uid1, uid2].sort();
  return `commission_${commissionId}_${a}_${b}`;
}

export async function createOrGetCommissionChat(
  commissionId: string,
  uid1: string,
  uid2: string,
  commissionTitle?: string,
  commissionImage?: string,
): Promise<string> {
  const chatId = getCommissionChatId(commissionId, uid1, uid2);
  const chatRef = doc(db, 'commissionChats', chatId);
  const snap = await getDoc(chatRef);
  if (!snap.exists()) {
    await setDoc(chatRef, {
      id: chatId,
      commissionId,
      participants: [uid1, uid2].sort(),
      commissionTitle: commissionTitle || '',
      commissionImage: commissionImage || '',
      lastMessage: '',
      unreadFor: {},
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  return chatId;
}

export function subscribeToUserCommissionChats(
  userId: string,
  callback: (chats: CommissionChat[]) => void,
): () => void {
  const q = query(
    collection(db, 'commissionChats'),
    where('participants', 'array-contains', userId),
    orderBy('updatedAt', 'desc'),
  );

  return onSnapshot(q, (snapshot) => {
    const chats: CommissionChat[] = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        commissionId: data.commissionId,
        participants: data.participants,
        updatedAt: data.updatedAt,
        lastMessage: data.lastMessage || '',
        unreadFor: data.unreadFor || {},
        closed: Boolean(data.closed),
        closedReason: data.closedReason as string | undefined,
      };
    });
    callback(chats);
  });
}

export function subscribeCommissionMessages(
  chatId: string,
  callback: (messages: CommissionChatMessage[]) => void,
): () => void {
  const q = query(
    collection(db, 'commissionChats', chatId, 'messages'),
    orderBy('createdAt', 'asc'),
  );
  return onSnapshot(q, (snapshot) => {
    const messages: CommissionChatMessage[] = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        senderId: data.senderId,
        text: data.text || '',
        createdAt: data.createdAt || null,
        seenBy: data.seenBy || [],
        commissionId: data.commissionId,
        commissionTitle: data.commissionTitle,
        commissionImage: data.commissionImage,
        imageUrl: data.imageUrl,
        messageType: data.messageType,
        offerStatus: data.offerStatus,
        offerFinalPrice: data.offerFinalPrice,
        offerAdvanceAmount: data.offerAdvanceAmount,
        offerDeliveryDate: data.offerDeliveryDate,
        acceptedAt: data.acceptedAt,
        addressName: data.addressName,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2,
        addressCity: data.addressCity,
        addressPincode: data.addressPincode,
        addressPhone: data.addressPhone,
      };
    });
    callback(messages);
  });
}

export async function sendCommissionMessage(
  chatId: string,
  senderId: string,
  text: string,
  commissionId: string,
  commissionTitle?: string,
  commissionImage?: string,
  imageUrl?: string,
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed && !imageUrl) {
    throw new Error('Message must include text or an image.');
  }
  const chatRef = doc(db, 'commissionChats', chatId);
  const snap = await getDoc(chatRef);
  if (snap.exists() && Boolean(snap.data().closed)) {
    throw new Error('This chat is closed.');
  }
  const participants = snap.exists() ? ((snap.data().participants as string[]) || []) : [];
  const otherUserId = participants.find((uid) => uid !== senderId);

  const payload: Record<string, unknown> = {
    senderId,
    text: trimmed,
    seenBy: [senderId],
    commissionId,
    commissionTitle: commissionTitle || '',
    commissionImage: commissionImage || '',
    createdAt: serverTimestamp(),
  };
  if (imageUrl) {
    payload.imageUrl = imageUrl;
  }

  await addDoc(collection(db, 'commissionChats', chatId, 'messages'), payload as DocumentData);

  const preview = trimmed || (imageUrl ? '📷 Photo' : '');
  const updateData: Record<string, unknown> = {
    lastMessage: preview,
    updatedAt: serverTimestamp(),
    [`unreadFor.${senderId}`]: 0,
  };
  if (otherUserId) {
    updateData[`unreadFor.${otherUserId}`] = increment(1);
  }
  await updateDoc(chatRef, updateData as any);
}

const COMMISSION_OFFER_LAST_PREVIEW = 'Commission offer';

/** Artist sends a structured offer (date, final price, advance) visible as a card to the buyer. */
export async function sendCommissionOfferMessage(
  chatId: string,
  senderId: string,
  commissionId: string,
  commissionTitle: string | undefined,
  commissionImage: string | undefined,
  offer: { finalPrice: string; advanceAmount: string; deliveryDate: string },
): Promise<void> {
  const fp = offer.finalPrice.trim();
  const adv = offer.advanceAmount.trim();
  const dd = offer.deliveryDate.trim();
  if (!fp || !adv || !dd) {
    throw new Error('Please fill in delivery date, final price, and advance amount.');
  }
  const chatRef = doc(db, 'commissionChats', chatId);
  const snap = await getDoc(chatRef);
  if (snap.exists() && Boolean(snap.data().closed)) {
    throw new Error('This chat is closed.');
  }
  const participants = snap.exists() ? ((snap.data().participants as string[]) || []) : [];
  const otherUserId = participants.find((uid) => uid !== senderId);

  const text =
    `Commission offer: ${fp} total, ${adv} advance, delivery ${dd}`;

  await addDoc(collection(db, 'commissionChats', chatId, 'messages'), {
    senderId,
    text,
    seenBy: [senderId],
    commissionId,
    commissionTitle: commissionTitle || '',
    commissionImage: commissionImage || '',
    messageType: 'commission_offer',
    offerStatus: 'pending',
    offerFinalPrice: fp,
    offerAdvanceAmount: adv,
    offerDeliveryDate: dd,
    createdAt: serverTimestamp(),
  } as DocumentData);

  const updateData: Record<string, unknown> = {
    lastMessage: COMMISSION_OFFER_LAST_PREVIEW,
    updatedAt: serverTimestamp(),
    [`unreadFor.${senderId}`]: 0,
  };
  if (otherUserId) {
    updateData[`unreadFor.${otherUserId}`] = increment(1);
  }
  await updateDoc(chatRef, updateData as any);
}

export async function markCommissionChatRead(chatId: string, userId: string): Promise<void> {
  await updateDoc(doc(db, 'commissionChats', chatId), {
    [`unreadFor.${userId}`]: 0,
  } as any);
}

export async function markCommissionMessagesSeen(chatId: string, userId: string): Promise<void> {
  const messagesQ = query(
    collection(db, 'commissionChats', chatId, 'messages'),
    orderBy('createdAt', 'desc'),
    limit(50),
  );
  const snapshot = await getDocs(messagesQ);
  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const seenBy = (data.seenBy as string[] | undefined) || [];
    if (data.senderId !== userId && !seenBy.includes(userId)) {
      await updateDoc(doc(db, 'commissionChats', chatId, 'messages', docSnap.id), {
        seenBy: arrayUnion(userId),
      });
    }
  }
}

/**
 * Buyer closes other artists' chats (hired artist unchanged). Notice is on the chat doc (`lastMessage`), not a message row.
 * Pass `buyerChatsForCommission` from the buyer's commissionChats subscription (same commissionId).
 */
export async function closeOtherCommissionChatsAsBuyer(
  commissionId: string,
  buyerId: string,
  hiredArtistId: string,
  buyerChatsForCommission: CommissionChat[],
): Promise<void> {
  for (const chat of buyerChatsForCommission) {
    if (chat.commissionId !== commissionId) continue;
    if (chat.closed) continue;
    const participants = chat.participants || [];
    if (!participants.includes(buyerId)) continue;
    const otherUid = participants.find((uid) => uid !== buyerId);
    if (!otherUid || otherUid === hiredArtistId) continue;
    const chatId = chat.id;
    const chatRef = doc(db, 'commissionChats', chatId);
    const patch: Record<string, unknown> = {
      closed: true,
      closedReason: 'other_hired',
      lastMessage: COMMISSION_HIRED_ELSEWHERE_MESSAGE,
      updatedAt: serverTimestamp(),
      [`unreadFor.${buyerId}`]: 0,
    };
    patch[`unreadFor.${otherUid}`] = increment(1);
    await updateDoc(chatRef, patch as any);
  }
}

/** After buyer marks the commission completed, close the buyer ↔ hired artist thread (same pattern as other_hired). */
export async function closeHiredArtistChatWhenCommissionCompleted(
  commissionId: string,
  buyerId: string,
  hiredArtistId: string,
): Promise<void> {
  if (!hiredArtistId) return;
  const chatId = getCommissionChatId(commissionId, buyerId, hiredArtistId);
  const chatRef = doc(db, 'commissionChats', chatId);
  const snap = await getDoc(chatRef);
  if (!snap.exists()) return;
  if (Boolean(snap.data().closed)) return;
  const patch: Record<string, unknown> = {
    closed: true,
    closedReason: 'commission_completed',
    lastMessage: COMMISSION_WORK_COMPLETED_MESSAGE,
    updatedAt: serverTimestamp(),
    [`unreadFor.${buyerId}`]: 0,
  };
  patch[`unreadFor.${hiredArtistId}`] = increment(1);
  await updateDoc(chatRef, patch as any);
}

/** Sends a structured address card message in a commission chat. */
export async function sendCommissionAddressCard(
  chatId: string,
  senderId: string,
  commissionId: string,
  address: { name: string; line1: string; line2: string; city: string; pincode: string; phone: string },
  commissionTitle?: string,
  commissionImage?: string,
): Promise<void> {
  const chatRef = doc(db, 'commissionChats', chatId);
  const snap = await getDoc(chatRef);
  if (snap.exists() && Boolean(snap.data().closed)) {
    throw new Error('This chat is closed.');
  }
  const participants = snap.exists() ? ((snap.data().participants as string[]) || []) : [];
  const otherUserId = participants.find((uid) => uid !== senderId);

  await addDoc(collection(db, 'commissionChats', chatId, 'messages'), {
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
    commissionId,
    commissionTitle: commissionTitle || '',
    commissionImage: commissionImage || '',
    createdAt: serverTimestamp(),
  } as DocumentData);

  const updateData: Record<string, unknown> = {
    lastMessage: 'Delivery address',
    updatedAt: serverTimestamp(),
    [`unreadFor.${senderId}`]: 0,
  };
  if (otherUserId) {
    updateData[`unreadFor.${otherUserId}`] = increment(1);
  }
  await updateDoc(chatRef, updateData as any);
}
