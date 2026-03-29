import { db } from "../firebase";
import {
  collection,
  addDoc,
  query,
  where,
  limit,
  onSnapshot,
  serverTimestamp,
  increment,
  updateDoc,
  doc,
  deleteDoc,
  getDoc,
  Unsubscribe,
  Timestamp,
} from "firebase/firestore";
import { createNotification } from "./notificationService";

export interface ArtworkComment {
  id: string;
  artworkId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  text: string;
  createdAt: Date | null;
  /** Set when this is an artist reply to another comment */
  parentCommentId?: string | null;
}

const MAX_COMMENT_LENGTH = 2000;
/** Max chars for comment and reply text in in-app / push notification previews */
const NOTIF_SNIPPET_MAX = 60;

function truncateForNotification(text: string, max: number): string {
  const t = text.trim();
  if (!t) return "";
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

export function subscribeToArtworkComments(
  artworkId: string,
  onUpdate: (comments: ArtworkComment[]) => void,
  onError?: (e: Error) => void
): Unsubscribe {
  // Single-field equality only (uses automatic index). Sort by time in memory so we
  // don't require a composite index + deploy — `where + orderBy(createdAt)` fails until indexed.
  const q = query(
    collection(db, "comments"),
    where("artworkId", "==", artworkId),
    limit(100)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: ArtworkComment[] = snap.docs.map((d) => {
        const data = d.data();
        const created = data.createdAt;
        const parentCommentId =
          typeof data.parentCommentId === "string" && data.parentCommentId
            ? data.parentCommentId
            : null;
        return {
          id: d.id,
          artworkId: data.artworkId,
          userId: data.userId,
          userName: typeof data.userName === "string" ? data.userName : "User",
          userAvatar:
            typeof data.userAvatar === "string" && data.userAvatar
              ? data.userAvatar
              : "/artist.png",
          text: typeof data.text === "string" ? data.text : "",
          createdAt: created instanceof Timestamp ? created.toDate() : null,
          parentCommentId,
        };
      });
      list.sort((a, b) => {
        const ta = a.createdAt?.getTime() ?? 0;
        const tb = b.createdAt?.getTime() ?? 0;
        return ta - tb;
      });
      onUpdate(list);
    },
    (err) => onError?.(err instanceof Error ? err : new Error(String(err)))
  );
}

export async function addArtworkComment(
  artworkId: string,
  userId: string,
  userName: string,
  userAvatar: string | undefined,
  text: string,
  parentCommentId?: string | null
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > MAX_COMMENT_LENGTH) {
    throw new Error("Invalid comment");
  }
  const payload: Record<string, unknown> = {
    artworkId,
    userId,
    userName,
    userAvatar: userAvatar || "",
    text: trimmed,
    createdAt: serverTimestamp(),
  };
  if (parentCommentId) {
    payload.parentCommentId = parentCommentId;
  }
  await addDoc(collection(db, "comments"), payload);
  await updateDoc(doc(db, "artworks", artworkId), {
    comments: increment(1),
  });

  try {
    const artworkSnap = await getDoc(doc(db, "artworks", artworkId));
    if (!artworkSnap.exists()) return;
    const artworkData = artworkSnap.data();
    const artistId = artworkData.artistId as string | undefined;
    const artTitle = typeof artworkData.title === "string" ? artworkData.title : "";
    const artImage = Array.isArray(artworkData.images) ? artworkData.images[0] : undefined;
    if (parentCommentId) {
      const parentSnap = await getDoc(doc(db, "comments", parentCommentId));
      if (!parentSnap.exists()) return;
      const parentData = parentSnap.data();
      const parentAuthorId = parentData.userId as string | undefined;
      if (!parentAuthorId || parentAuthorId === userId) return;
      await createNotification(
        parentAuthorId,
        "comment_reply",
        userId,
        userName,
        userAvatar,
        artworkId,
        artTitle,
        artImage,
        undefined,
        undefined,
        undefined,
        truncateForNotification(trimmed, NOTIF_SNIPPET_MAX),
      );
      return;
    }

    if (artistId && userId !== artistId) {
      await createNotification(
        artistId,
        "comment",
        userId,
        userName,
        userAvatar,
        artworkId,
        artTitle,
        artImage,
        undefined,
        undefined,
        undefined,
        truncateForNotification(trimmed, NOTIF_SNIPPET_MAX),
      );
    }
  } catch {
    // best-effort notifications
  }
}

export async function deleteArtworkComment(
  commentId: string,
  artworkId: string
): Promise<void> {
  await deleteDoc(doc(db, "comments", commentId));
  await updateDoc(doc(db, "artworks", artworkId), {
    comments: increment(-1),
  });
}
