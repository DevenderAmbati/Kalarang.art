import {
  collection,
  DocumentData,
  getDocs,
  limit,
  orderBy,
  query,
  QueryDocumentSnapshot,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { Artwork } from "../types/artwork";
import { getFollowingArtistIds } from "./userService";
import { getPublishedArtworksPaginated } from "./artworkService";
import { getSeenPostIds } from "./postViewService";

const IN_QUERY_BATCH = 30;

export interface HomeFeedSnapshot {
  topUnseen: Artwork[];
  remainingUnseen: Artwork[];
  /** Unseen non-followed artworks, sorted by score. Phase 2 mix. */
  discover: Artwork[];
  /** Already-seen posts from followed artists, sorted by score. Phase 3 (merged with seenDiscover). */
  seenFollowed: Artwork[];
  /** Already-seen non-followed artworks, sorted by score. Phase 3 (merged with seenFollowed). */
  seenDiscover: Artwork[];
  seenPostIds: Set<string>;
  followingArtistIds: string[];
  discoverLastVisible: QueryDocumentSnapshot<DocumentData> | null;
  hasMoreDiscover: boolean;
}

function dedupeArtworks(artworks: Artwork[]): Artwork[] {
  const seen = new Set<string>();
  const deduped: Artwork[] = [];
  artworks.forEach((artwork) => {
    if (!seen.has(artwork.id)) {
      deduped.push(artwork);
      seen.add(artwork.id);
    }
  });
  return deduped;
}

function byScoreDescThenRecent(a: Artwork, b: Artwork): number {
  const scoreDiff = (b.score ?? 0) - (a.score ?? 0);
  if (scoreDiff !== 0) return scoreDiff;
  return b.createdAt.getTime() - a.createdAt.getTime();
}

/** Following feed should not surface the viewer's own published works. */
function excludeViewerOwnArtworks(
  artworks: Artwork[],
  viewerId: string | undefined
): Artwork[] {
  if (!viewerId) return artworks;
  return artworks.filter((a) => a.artistId !== viewerId);
}

async function safeDiscoverPage(limitCount: number): Promise<{
  artworks: Artwork[];
  lastVisible: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}> {
  try {
    return await getPublishedArtworksPaginated(limitCount);
  } catch {
    return { artworks: [], lastVisible: null, hasMore: false };
  }
}

async function getFollowedArtworksCandidates(
  followingArtistIds: string[],
  cap: number
): Promise<Artwork[]> {
  if (!followingArtistIds.length) return [];

  const batches: string[][] = [];
  for (let i = 0; i < followingArtistIds.length; i += IN_QUERY_BATCH) {
    batches.push(followingArtistIds.slice(i, i + IN_QUERY_BATCH));
  }

  const perBatchLimit = Math.max(20, Math.ceil(cap / batches.length) + 8);
  const fetched: Artwork[] = [];

  for (const batch of batches) {
    try {
      const q = query(
        collection(db, "artworks"),
        where("published", "==", true),
        where("artistId", "in", batch),
        orderBy("createdAt", "desc"),
        limit(perBatchLimit)
      );
      const snapshot = await getDocs(q);
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        fetched.push({
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as Artwork);
      });
    } catch {
      // Skip failed batches (index/rules/network) so feed can still load.
    }
  }

  return dedupeArtworks(fetched).sort(byScoreDescThenRecent).slice(0, cap);
}

function selectDiscoverSlice(
  artworks: Artwork[],
  excludedIds: Set<string>,
  excludedArtistIds: Set<string>,
  take: number,
  seenPostIds?: Set<string>
): { unseen: Artwork[]; seen: Artwork[] } {
  const unseen: Artwork[] = [];
  const seen: Artwork[] = [];
  for (const artwork of artworks) {
    if (unseen.length >= take) break;
    if (excludedIds.has(artwork.id)) continue;
    if (excludedArtistIds.has(artwork.artistId)) continue;
    excludedIds.add(artwork.id);
    if (seenPostIds && seenPostIds.has(artwork.id)) {
      seen.push(artwork);
    } else {
      unseen.push(artwork);
    }
  }
  return { unseen, seen };
}

export async function getInitialHomeFeedSnapshot(
  userId: string | undefined,
  options?: {
    unseenLimit?: number;
    discoverLimit?: number;
    followedCandidateCap?: number;
  }
): Promise<HomeFeedSnapshot> {
  const unseenLimit = options?.unseenLimit ?? 12;
  const discoverLimit = options?.discoverLimit ?? 24;
  const followedCandidateCap = options?.followedCandidateCap ?? 120;

  if (!userId) {
    const discoverPage = await safeDiscoverPage(discoverLimit);
    return {
      topUnseen: [],
      remainingUnseen: [],
      discover: discoverPage.artworks,
      seenFollowed: [],
      seenDiscover: [],
      seenPostIds: new Set<string>(),
      followingArtistIds: [],
      discoverLastVisible: discoverPage.lastVisible,
      hasMoreDiscover: discoverPage.hasMore,
    };
  }

  const [followingResult, seenResult] = await Promise.allSettled([
    getFollowingArtistIds(userId),
    getSeenPostIds(userId),
  ]);
  const followingArtistIds =
    followingResult.status === "fulfilled" ? followingResult.value : [];
  const seenPostIds =
    seenResult.status === "fulfilled" ? seenResult.value : new Set<string>();

  if (!followingArtistIds.length) {
    const discoverPage = await safeDiscoverPage(discoverLimit * 2);
    const viewerExclude = new Set<string>();
    if (userId) viewerExclude.add(userId);
    const { unseen, seen } = selectDiscoverSlice(
      discoverPage.artworks,
      new Set<string>(),
      viewerExclude,
      discoverLimit,
      seenPostIds
    );
    return {
      topUnseen: [],
      remainingUnseen: [],
      discover: unseen,
      seenFollowed: [],
      seenDiscover: seen,
      seenPostIds,
      followingArtistIds,
      discoverLastVisible: discoverPage.lastVisible,
      hasMoreDiscover: discoverPage.hasMore,
    };
  }

  const followedCandidates = excludeViewerOwnArtworks(
    await getFollowedArtworksCandidates(followingArtistIds, followedCandidateCap),
    userId
  );
  const unseenFollowed = followedCandidates.filter(
    (artwork) => !seenPostIds.has(artwork.id)
  );
  const seenFollowed = followedCandidates.filter(
    (artwork) => seenPostIds.has(artwork.id)
  );

  const topUnseen = unseenFollowed.slice(0, unseenLimit);
  const remainingUnseen = unseenFollowed.slice(unseenLimit);
  const excludedIds = new Set<string>([
    ...topUnseen.map((a) => a.id),
    ...remainingUnseen.map((a) => a.id),
  ]);

  const excludedArtistIds = new Set<string>(followingArtistIds);
  if (userId) excludedArtistIds.add(userId);

  const discoverPage = await safeDiscoverPage(discoverLimit * 2);
  const { unseen: discover, seen: seenDiscover } = selectDiscoverSlice(
    discoverPage.artworks,
    excludedIds,
    excludedArtistIds,
    discoverLimit,
    seenPostIds
  );

  return {
    topUnseen,
    remainingUnseen,
    discover,
    seenFollowed,
    seenDiscover,
    seenPostIds,
    followingArtistIds,
    discoverLastVisible: discoverPage.lastVisible,
    hasMoreDiscover: discoverPage.hasMore,
  };
}

export async function getNextDiscoverPage(
  viewerId: string | undefined,
  lastVisible: QueryDocumentSnapshot<DocumentData> | null,
  excludedIds: Set<string>,
  limitCount: number = 20,
  followingArtistIds: string[] = [],
  seenPostIds?: Set<string>
): Promise<{
  discover: Artwork[];
  seenDiscover: Artwork[];
  lastVisible: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}> {
  const excludedArtistIds = new Set<string>(followingArtistIds);
  if (viewerId) excludedArtistIds.add(viewerId);

  const page = await getPublishedArtworksPaginated(limitCount * 2, lastVisible);
  const { unseen, seen } = selectDiscoverSlice(
    page.artworks,
    excludedIds,
    excludedArtistIds,
    limitCount,
    seenPostIds
  );
  return {
    discover: unseen,
    seenDiscover: seen,
    lastVisible: page.lastVisible,
    hasMore: page.hasMore,
  };
}
