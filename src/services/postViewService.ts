import { db } from "../firebase";
import {
  collection,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  doc,
} from "firebase/firestore";

const POST_VIEWS_COLLECTION = "post_views";
const SEEN_WRITE_DEBOUNCE_MS = 400;

const seenCacheByUser = new Map<string, Set<string>>();
const pendingQueueByUser = new Map<string, Set<string>>();
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const inFlightByUser = new Map<string, Promise<void>>();

function getUserSeenSet(userId: string): Set<string> {
  let current = seenCacheByUser.get(userId);
  if (!current) {
    current = new Set<string>();
    seenCacheByUser.set(userId, current);
  }
  return current;
}

function toPostViewDocId(userId: string, postId: string): string {
  // Firestore doc IDs cannot contain "/".
  const safeUserId = userId.replace(/\//g, "_");
  const safePostId = postId.replace(/\//g, "_");
  return `${safeUserId}__${safePostId}`;
}

async function flushUserQueue(userId: string): Promise<void> {
  const queued = pendingQueueByUser.get(userId);
  if (!queued || queued.size === 0) return;

  const postIds = Array.from(queued);
  pendingQueueByUser.set(userId, new Set());

  await Promise.all(
    postIds.map((postId) =>
      setDoc(
        doc(db, POST_VIEWS_COLLECTION, toPostViewDocId(userId, postId)),
        {
          userId,
          postId,
          seenAt: serverTimestamp(),
        },
        { merge: true }
      )
    )
  );
}

function queueSeenWrite(userId: string, postId: string, immediate: boolean): Promise<void> {
  const queue = pendingQueueByUser.get(userId) ?? new Set<string>();
  queue.add(postId);
  pendingQueueByUser.set(userId, queue);

  if (immediate) {
    const existing = debounceTimers.get(userId);
    if (existing) {
      clearTimeout(existing);
      debounceTimers.delete(userId);
    }

    const currentInFlight = inFlightByUser.get(userId) ?? Promise.resolve();
    const next = currentInFlight
      .catch(() => undefined)
      .then(() => flushUserQueue(userId));
    inFlightByUser.set(userId, next);
    return next;
  }

  const existingTimer = debounceTimers.get(userId);
  if (existingTimer) clearTimeout(existingTimer);

  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      debounceTimers.delete(userId);
      const currentInFlight = inFlightByUser.get(userId) ?? Promise.resolve();
      const next = currentInFlight
        .catch(() => undefined)
        .then(() => flushUserQueue(userId));
      inFlightByUser.set(userId, next);
      next.then(resolve).catch(reject);
    }, SEEN_WRITE_DEBOUNCE_MS);

    debounceTimers.set(userId, timer);
  });
}

export async function getSeenPostIds(userId: string): Promise<Set<string>> {
  const q = query(
    collection(db, POST_VIEWS_COLLECTION),
    where("userId", "==", userId)
  );
  const snapshot = await getDocs(q);
  const seenIds = new Set<string>();
  snapshot.forEach((docSnap) => {
    const data = docSnap.data() as { postId?: string };
    if (data.postId) {
      seenIds.add(String(data.postId));
    }
  });
  seenCacheByUser.set(userId, seenIds);
  return seenIds;
}

export function isPostSeenLocally(userId: string, postId: string): boolean {
  return getUserSeenSet(userId).has(postId);
}

export function seedSeenPostIds(userId: string, postIds: Iterable<string>): void {
  const seenSet = getUserSeenSet(userId);
  for (const postId of postIds) {
    seenSet.add(postId);
  }
}

export async function markPostSeen(
  userId: string,
  postId: string,
  options?: { immediate?: boolean }
): Promise<void> {
  const normalizedPostId = String(postId);
  const seenSet = getUserSeenSet(userId);
  if (seenSet.has(normalizedPostId)) return;

  seenSet.add(normalizedPostId);
  await queueSeenWrite(userId, normalizedPostId, Boolean(options?.immediate));
}
