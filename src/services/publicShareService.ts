import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

export interface PublicShare {
  id: string;
  buyerId: string;
  buyerName: string;
  buyerAvatar?: string;
  artistId: string;
  artistName: string;
  commissionId: string;
  commissionTitle: string;
  imageUrl: string;
  description: string;
  createdAt: any;
}

const COLLECTION = 'publicShares';
const PAGE_SIZE = 20;

export async function savePublicShare(data: Omit<PublicShare, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getPublicShares(
  lastVisible?: QueryDocumentSnapshot<DocumentData> | null,
): Promise<{ shares: PublicShare[]; lastVisible: QueryDocumentSnapshot<DocumentData> | null; hasMore: boolean }> {
  const constraints: any[] = [orderBy('createdAt', 'desc'), limit(PAGE_SIZE + 1)];
  if (lastVisible) constraints.push(startAfter(lastVisible));

  const snap = await getDocs(query(collection(db, COLLECTION), ...constraints));
  const hasMore = snap.docs.length > PAGE_SIZE;
  const docs = hasMore ? snap.docs.slice(0, PAGE_SIZE) : snap.docs;
  const shares: PublicShare[] = docs.map((d) => ({ id: d.id, ...d.data() } as PublicShare));
  const newLastVisible = docs.length > 0 ? docs[docs.length - 1] : null;
  return { shares, lastVisible: newLastVisible, hasMore };
}
