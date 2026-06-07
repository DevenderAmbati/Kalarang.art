import { db, functions } from "../firebase";
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  limit,
  orderBy,
  startAfter,
  Timestamp,
  QueryDocumentSnapshot,
  QueryConstraint,
  DocumentData,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { uploadArtworkImages } from "./artworkService";
import { cache, cacheKeys, cacheTimes } from "../utils/cache";

export type CommissionDeliveryType = "" | "Digital file" | "Physical artwork";

export interface CommissionRequest {
  id: string;
  buyerId: string;
  buyerName: string;
  buyerAvatar?: string;
  title: string;
  description: string;
  referenceImages: string[];
  budget: string;
  deadline: string;
  size?: string;
  customHeight?: string;
  customWidth?: string;
  type: string;
  style: string[];
  subject: string[];
  deliveryType: CommissionDeliveryType;
  cityOrPincode?: string;
  status: "open" | "closed" | "inprogress" | "completed";
  hiredArtistId?: string;
  /** Set when buyer accepts an artist's chat offer */
  agreedFinalPrice?: string;
  agreedAdvanceAmount?: string;
  agreedDeliveryDate?: string;
  /** Buyer's delivery address, saved when accepting an offer */
  buyerAddress?: string;
  /** Advance amount confirmed as paid by buyer when accepting offer */
  advancePaid?: boolean;
  advanceAmount?: string;
  /** Image uploaded by artist when artwork is ready to ship */
  readyToShipImageUrl?: string;
  /** Set when buyer confirms full payment done */
  fullPaymentDone?: boolean;
  /** Total amount paid by buyer (advance + remaining) */
  totalAmountPaid?: string;
  /** Tracking ID provided by artist when marking shipment */
  trackingId?: string;
  /** Set when buyer shares this completed commission to the public feed */
  sharedToPublic?: boolean;
  /** Generated when buyer accepts the offer and advance is marked paid. */
  orderId?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

function generateCommissionOrderId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `KLR-${ts}-${rand}`;
}

export interface CreateCommissionPayload {
  title: string;
  description: string;
  budget: string;
  deadline: string;
  size?: string;
  customHeight?: string;
  customWidth?: string;
  type: string;
  style: string[];
  subject: string[];
  deliveryType: CommissionDeliveryType;
  cityOrPincode?: string;
}

export async function createCommissionRequest(
  buyerId: string,
  buyerName: string,
  buyerAvatar: string | undefined,
  payload: CreateCommissionPayload,
  referenceImageFiles: File[],
): Promise<string> {
  const referenceImages =
    referenceImageFiles.length > 0
      ? await uploadArtworkImages(buyerId, referenceImageFiles)
      : [];

  const commissionRef = doc(collection(db, "commissions"));
  const commissionData = {
    id: commissionRef.id,
    buyerId,
    buyerName,
    buyerAvatar: buyerAvatar || "",
    title: payload.title,
    description: payload.description,
    referenceImages,
    budget: payload.budget,
    deadline: payload.deadline,
    size: payload.size || "",
    customHeight: payload.customHeight || "",
    customWidth: payload.customWidth || "",
    type: payload.type,
    style: payload.style,
    subject: payload.subject,
    deliveryType: payload.deliveryType,
    cityOrPincode: payload.cityOrPincode || "",
    status: "open" as const,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(commissionRef, commissionData);
  return commissionRef.id;
}

export async function getBuyerCommissionRequests(
  buyerId: string,
): Promise<CommissionRequest[]> {
  const q = query(
    collection(db, "commissions"),
    where("buyerId", "==", buyerId),
    limit(100),
  );
  const snapshot = await getDocs(q);

  const requests = snapshot.docs.map((item) => {
    const data = item.data() as Omit<CommissionRequest, "id">;
    return {
      id: item.id,
      ...data,
    } as CommissionRequest;
  });

  return requests.sort((a, b) => {
    const aTime = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : 0;
    const bTime = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : 0;
    return bTime - aTime;
  });
}

/** Lets an artist read this commission later (Firestore rules). Call when applying or backfilling from an existing chat. */
export async function registerArtistApplication(
  commissionId: string,
  artistId: string,
): Promise<void> {
  const ref = doc(db, "commissions", commissionId, "applications", artistId);
  const existing = await getDoc(ref);
  if (existing.exists()) return;
  try {
    await setDoc(ref, {
      artistId,
      appliedAt: serverTimestamp(),
    });
  } catch (err) {
    const again = await getDoc(ref);
    if (again.exists()) return;
    throw err;
  }
}

/** Firestore bookmark so the artist can still read the commission after it leaves open (shortlist without apply). */
export async function setCommissionShortlistBookmark(
  commissionId: string,
  artistId: string,
): Promise<void> {
  await setDoc(doc(db, "users", artistId, "commissionShortlists", commissionId), {
    commissionId,
    updatedAt: serverTimestamp(),
  });
}

export async function removeCommissionShortlistBookmark(
  commissionId: string,
  artistId: string,
): Promise<void> {
  try {
    await deleteDoc(doc(db, "users", artistId, "commissionShortlists", commissionId));
  } catch {
    // missing doc is fine
  }
}

/** Commissions this artist applied to (including after status is no longer open). */
export async function getCommissionsForArtistApplications(
  artistId: string,
): Promise<CommissionRequest[]> {
  const q = query(
    collectionGroup(db, "applications"),
    where("artistId", "==", artistId),
    limit(200),
  );
  const snapshot = await getDocs(q);
  const out: CommissionRequest[] = [];
  for (const appDoc of snapshot.docs) {
    const parentRef = appDoc.ref.parent.parent;
    if (!parentRef) continue;
    try {
      const cSnap = await getDoc(parentRef);
      if (!cSnap.exists()) continue;
      const data = cSnap.data() as Omit<CommissionRequest, "id">;
      out.push({ id: cSnap.id, ...data } as CommissionRequest);
    } catch {
      // Skip commissions we can no longer read (rules / deleted doc).
    }
  }
  return out.sort((a, b) => {
    const aTime = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : 0;
    const bTime = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : 0;
    return bTime - aTime;
  });
}

export async function hireArtistForCommission(
  commissionId: string,
  buyerId: string,
  hiredArtistId: string,
  agreed?: {
    finalPrice: string;
    advanceAmount: string;
    deliveryDate: string;
  },
): Promise<void> {
  const ref = doc(db, "commissions", commissionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Commission not found");
  const data = snap.data();
  if (data.buyerId !== buyerId) throw new Error("Not allowed");
  const patch: Record<string, unknown> = {
    status: "inprogress",
    hiredArtistId,
    updatedAt: serverTimestamp(),
  };
  if (agreed) {
    patch.agreedFinalPrice = agreed.finalPrice;
    patch.agreedAdvanceAmount = agreed.advanceAmount;
    patch.agreedDeliveryDate = agreed.deliveryDate;
  }
  await updateDoc(ref, patch as any);
}

/** Buyer accepts an artist's offer from commission chat (server updates commission, message, other chats). */
export async function acceptCommissionOfferFromChat(
  chatId: string,
  messageId: string,
): Promise<void> {
  const fn = httpsCallable(functions, "acceptCommissionOffer");
  await fn({ chatId, messageId });
}

export async function markFullPaymentDone(commissionId: string, totalAmountPaid: string, paymentScreenshotUrl?: string): Promise<void> {
  const ref = doc(db, "commissions", commissionId);
  const patch: Record<string, unknown> = { fullPaymentDone: true, totalAmountPaid, updatedAt: serverTimestamp() };
  if (paymentScreenshotUrl) patch.fullPaymentScreenshotUrl = paymentScreenshotUrl;
  await updateDoc(ref, patch as any);
}

export async function saveReadyToShipImage(commissionId: string, imageUrl: string): Promise<void> {
  const ref = doc(db, "commissions", commissionId);
  await updateDoc(ref, { readyToShipImageUrl: imageUrl, updatedAt: serverTimestamp() });
}

export async function markCommissionSharedToPublic(commissionId: string): Promise<void> {
  const ref = doc(db, "commissions", commissionId);
  await updateDoc(ref, { sharedToPublic: true, updatedAt: serverTimestamp() });
}

export async function markAdvancePaid(
  commissionId: string,
  amount: string,
  buyerAddress?: string,
  paymentScreenshotUrl?: string,
): Promise<void> {
  const ref = doc(db, "commissions", commissionId);
  const patch: Record<string, unknown> = { advancePaid: true, advanceAmount: amount, updatedAt: serverTimestamp() };
  if (buyerAddress) patch.buyerAddress = buyerAddress;
  if (paymentScreenshotUrl) patch.advancePaymentScreenshotUrl = paymentScreenshotUrl;
  // Assign orderId once on first advance-paid; never reassign on retries.
  try {
    const snap = await getDoc(ref);
    if (snap.exists() && !snap.data().orderId) {
      patch.orderId = generateCommissionOrderId();
    }
  } catch {
    // If read fails (e.g. transient), still proceed — orderId will be filled on a later flow.
  }
  await updateDoc(ref, patch as any);
}

export async function markCommissionCompletedByBuyer(
  commissionId: string,
  buyerId: string,
): Promise<void> {
  const ref = doc(db, "commissions", commissionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Commission not found");
  const data = snap.data();
  if (data.buyerId !== buyerId) throw new Error("Not allowed");
  const st = String(data.status || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
  if (st !== "inprogress") throw new Error("Commission is not in progress");
  await updateDoc(ref, {
    status: "completed",
    updatedAt: serverTimestamp(),
  });
}

/** Artist marks artwork as shipped — sets status to completed and saves tracking ID. */
export async function markShipped(
  commissionId: string,
  artistId: string,
  trackingId: string,
): Promise<void> {
  const ref = doc(db, "commissions", commissionId);
  await updateDoc(ref, {
    status: "completed",
    isShipped: true,
    trackingId,
    updatedAt: serverTimestamp(),
  });
}

/** Jobs where this artist was hired (in progress, completed, etc.). Keeps hired work visible after the listing leaves "open". */
export async function getCommissionsForHiredArtist(
  artistId: string,
): Promise<CommissionRequest[]> {
  const q = query(
    collection(db, "commissions"),
    where("hiredArtistId", "==", artistId),
    limit(100),
  );
  const snapshot = await getDocs(q);
  const requests = snapshot.docs.map((item) => {
    const data = item.data() as Omit<CommissionRequest, "id">;
    return {
      id: item.id,
      ...data,
    } as CommissionRequest;
  });
  return requests.sort((a, b) => {
    const aTime = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : 0;
    const bTime = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : 0;
    return bTime - aTime;
  });
}

/** Direct reads by id — works when collection queries fail rules/indexes but the artist can still read the doc (e.g. via applications subdoc). */
export async function getCommissionDocumentsByIds(
  ids: string[],
): Promise<CommissionRequest[]> {
  const unique = [...new Set(ids)].filter(Boolean);
  const out: CommissionRequest[] = [];
  for (const id of unique) {
    try {
      const snap = await getDoc(doc(db, "commissions", id));
      if (!snap.exists()) continue;
      const data = snap.data() as Omit<CommissionRequest, "id">;
      out.push({ id: snap.id, ...data } as CommissionRequest);
    } catch {
      // permission denied or network
    }
  }
  return out;
}

export async function getOpenCommissionRequests(): Promise<CommissionRequest[]> {
  const q = query(
    collection(db, "commissions"),
    where("status", "==", "open"),
    limit(100),
  );
  const snapshot = await getDocs(q);

  const requests = snapshot.docs.map((item) => {
    const data = item.data() as Omit<CommissionRequest, "id">;
    return {
      id: item.id,
      ...data,
    } as CommissionRequest;
  });

  return requests.sort((a, b) => {
    const aTime = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : 0;
    const bTime = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : 0;
    return bTime - aTime;
  });
}

/**
 * All commissions (any status) via client Firestore. Requires rules that allow
 * authenticated reads on commission docs (see firestore.rules).
 */
export async function getAllCommissionRequestsClient(): Promise<CommissionRequest[]> {
  const q = query(collection(db, "commissions"), limit(500));
  const snapshot = await getDocs(q);
  const requests = snapshot.docs.map((item) => {
    const data = item.data() as Omit<CommissionRequest, "id">;
    return { id: item.id, ...data } as CommissionRequest;
  });
  return requests.sort((a, b) => {
    const aTime = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : 0;
    const bTime = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : 0;
    return bTime - aTime;
  });
}

type CallableCommissionTimestamp = { seconds: number; nanoseconds?: number } | null | undefined;

type CallableCommissionRow = {
  id: string;
  buyerId?: string;
  buyerName?: string;
  buyerAvatar?: string;
  title?: string;
  description?: string;
  referenceImages?: string[];
  budget?: string;
  deadline?: string;
  size?: string;
  customHeight?: string;
  customWidth?: string;
  type?: string;
  style?: string[];
  subject?: string[];
  deliveryType?: string;
  cityOrPincode?: string;
  status?: CommissionRequest["status"];
  hiredArtistId?: string;
  agreedFinalPrice?: string;
  agreedAdvanceAmount?: string;
  agreedDeliveryDate?: string;
  createdAt?: CallableCommissionTimestamp;
  updatedAt?: CallableCommissionTimestamp;
};

function callableTimestampToFirestore(ts: CallableCommissionTimestamp): Timestamp | undefined {
  if (!ts || typeof ts.seconds !== "number") return undefined;
  return new Timestamp(ts.seconds, ts.nanoseconds ?? 0);
}

function callableRowToCommission(row: CallableCommissionRow): CommissionRequest {
  return {
    id: row.id,
    buyerId: row.buyerId || "",
    buyerName: row.buyerName || "",
    buyerAvatar: row.buyerAvatar,
    title: row.title || "",
    description: row.description || "",
    referenceImages: Array.isArray(row.referenceImages) ? row.referenceImages : [],
    budget: row.budget || "",
    deadline: row.deadline || "",
    size: row.size || "",
    customHeight: row.customHeight || "",
    customWidth: row.customWidth || "",
    type: row.type || "",
    style: Array.isArray(row.style) ? row.style : [],
    subject: Array.isArray(row.subject) ? row.subject : [],
    deliveryType: (row.deliveryType || "") as CommissionDeliveryType,
    cityOrPincode: row.cityOrPincode,
    status: row.status || "open",
    hiredArtistId: row.hiredArtistId,
    agreedFinalPrice: row.agreedFinalPrice,
    agreedAdvanceAmount: row.agreedAdvanceAmount,
    agreedDeliveryDate: row.agreedDeliveryDate,
    createdAt: callableTimestampToFirestore(row.createdAt),
    updatedAt: callableTimestampToFirestore(row.updatedAt),
  };
}

/** Commission search via Cloud Function (all statuses; server-side load + text filter). */
export async function searchOpenCommissionsServer(query: string): Promise<CommissionRequest[]> {
  const fn = httpsCallable(functions, "searchOpenCommissions");
  const result = await fn({ query: query.trim() });
  const data = result.data as { commissions?: CallableCommissionRow[] };
  const rows = data.commissions || [];
  return rows.map(callableRowToCommission);
}

/**
 * Browse list: `searchOpenCommissions` (empty query = all commissions), then client Firestore
 * (all statuses, cap 500), then open-only query as last resort.
 */
export async function getBrowseCommissionRequestsWithFallback(): Promise<CommissionRequest[]> {
  try {
    return await searchOpenCommissionsServer("");
  } catch {
    try {
      return await getAllCommissionRequestsClient();
    } catch {
      return getOpenCommissionRequests();
    }
  }
}

const { staleTime: commissionsStale, cacheTime: commissionsCacheTtl } =
  cacheTimes.commissionsBoard;

/** Coalesce parallel callers (e.g. list load + artist chat sync) into one network request. */
const pendingCommissionListFetches = new Map<string, Promise<CommissionRequest[]>>();

function dedupeCommissionListFetch(
  dedupeKey: string,
  cacheKey: string,
  fetcher: () => Promise<CommissionRequest[]>,
): Promise<CommissionRequest[]> {
  const c = cache.get<CommissionRequest[]>(cacheKey);
  if (c.exists && !c.isStale && c.data) return Promise.resolve(c.data);

  const existing = pendingCommissionListFetches.get(dedupeKey);
  if (existing) return existing;

  const p = fetcher()
    .then((data) => {
      cache.set(cacheKey, data, commissionsStale, commissionsCacheTtl);
      return data;
    })
    .finally(() => pendingCommissionListFetches.delete(dedupeKey));

  pendingCommissionListFetches.set(dedupeKey, p);
  return p;
}

/** Browse/open list with in-memory TTL — avoids refetching on every visit to the commissions tab. */
export async function getBrowseCommissionRequestsCached(): Promise<CommissionRequest[]> {
  const key = cacheKeys.commissionsBrowse();
  return dedupeCommissionListFetch(`browse:${key}`, key, () =>
    getBrowseCommissionRequestsWithFallback(),
  );
}

export async function getBuyerCommissionRequestsCached(
  buyerId: string,
): Promise<CommissionRequest[]> {
  const key = cacheKeys.commissionsBuyer(buyerId);
  return dedupeCommissionListFetch(`buyer:${buyerId}`, key, () =>
    getBuyerCommissionRequests(buyerId),
  );
}

export async function getCommissionsForArtistApplicationsCached(
  artistId: string,
): Promise<CommissionRequest[]> {
  const key = cacheKeys.commissionsArtistApps(artistId);
  return dedupeCommissionListFetch(`artistApps:${artistId}`, key, () =>
    getCommissionsForArtistApplications(artistId),
  );
}

export async function getCommissionsForHiredArtistCached(
  artistId: string,
): Promise<CommissionRequest[]> {
  const key = cacheKeys.commissionsArtistHired(artistId);
  return dedupeCommissionListFetch(`artistHired:${artistId}`, key, () =>
    getCommissionsForHiredArtist(artistId),
  );
}

export interface PaginatedCommissionResult {
  commissions: CommissionRequest[];
  lastVisible: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

/**
 * Paginated browse query ordered by createdAt desc.
 * Uses Firestore cursor pagination to load commissions in chunks.
 */
export async function getCommissionsPaginated(
  pageSize: number = 15,
  cursor?: QueryDocumentSnapshot<DocumentData> | null,
  statusFilter?: string,
): Promise<PaginatedCommissionResult> {
  const constraints: QueryConstraint[] = [];

  if (statusFilter) {
    constraints.push(where("status", "==", statusFilter));
  }
  constraints.push(orderBy("createdAt", "desc"));
  if (cursor) {
    constraints.push(startAfter(cursor));
  }
  constraints.push(limit(pageSize));

  const q = query(collection(db, "commissions"), ...constraints);
  const snapshot = await getDocs(q);

  const commissions: CommissionRequest[] = snapshot.docs.map((item) => {
    const data = item.data() as Omit<CommissionRequest, "id">;
    return { id: item.id, ...data } as CommissionRequest;
  });

  const lastDoc = snapshot.docs.length > 0
    ? snapshot.docs[snapshot.docs.length - 1]
    : null;

  return {
    commissions,
    lastVisible: lastDoc,
    hasMore: snapshot.docs.length >= pageSize,
  };
}

export function invalidateCommissionsBrowseCache(): void {
  cache.invalidate(cacheKeys.commissionsBrowse());
}

/** Invalidates buyer + artist application/hired list caches for one user. */
export function invalidateCommissionsUserCaches(uid: string): void {
  cache.invalidate(cacheKeys.commissionsBuyer(uid));
  cache.invalidate(cacheKeys.commissionsArtistApps(uid));
  cache.invalidate(cacheKeys.commissionsArtistHired(uid));
}
