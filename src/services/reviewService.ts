import { db } from "../firebase";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

export interface CommissionReview {
  id: string;
  commissionId: string;
  artistId: string;
  buyerId: string;
  buyerName: string;
  buyerAvatar?: string;
  commissionTitle: string;
  reviewText: string;
  rating: number; // 1–5
  createdAt?: Timestamp;
  artistReply?: string;
  artistReplyAt?: Timestamp;
}

export async function getReviewsForBuyer(buyerId: string): Promise<CommissionReview[]> {
  const q = query(collection(db, "reviews"), where("buyerId", "==", buyerId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as CommissionReview));
}

export async function getReviewsForArtist(artistId: string): Promise<CommissionReview[]> {
  const q = query(collection(db, "reviews"), where("artistId", "==", artistId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as CommissionReview));
}

export async function submitReview(
  payload: Omit<CommissionReview, "id" | "createdAt" | "artistReply" | "artistReplyAt">,
): Promise<string> {
  const ref = await addDoc(collection(db, "reviews"), {
    commissionId: payload.commissionId,
    artistId: payload.artistId,
    buyerId: payload.buyerId,
    buyerName: payload.buyerName,
    buyerAvatar: payload.buyerAvatar ?? null,
    commissionTitle: payload.commissionTitle,
    reviewText: payload.reviewText,
    rating: payload.rating,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function submitArtistReply(reviewId: string, replyText: string): Promise<void> {
  const ref = doc(db, "reviews", reviewId);
  await updateDoc(ref, {
    artistReply: replyText,
    artistReplyAt: serverTimestamp(),
  });
}
