import { db, storage } from "../firebase";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
  QueryConstraint,
  increment,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  UploadMetadata,
} from "firebase/storage";
import { Artwork, ArtworkUpload } from "../types/artwork";
import { compressImage } from "../utils/imageCompression";

/** Firestore throws this when a composite index is missing (or still building). */
function isMissingFirestoreIndexError(err: unknown): boolean {
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as { code: string }).code;
    return code === "failed-precondition" || code === "unimplemented";
  }
  return false;
}

/** Sort for Explore / Discover: `featured` uses ranking score; `newest` is newest first. */
export type ArtworkFeedSortOption =
  | "featured"
  | "price-low"
  | "price-high"
  | "newest";

export interface ArtworkFeedQueryOptions {
  query?: string;
  artistIds?: string[];
  category?: string;
  mediums?: string[];
  priceRange?: { min: number; max: number };
  sizes?: string[];
  sortOption?: ArtworkFeedSortOption;
}

const SIZE_CATEGORIES = [
  { label: "Small", minWidth: 0, maxWidth: 8, minHeight: 0, maxHeight: 8 },
  { label: "Medium", minWidth: 8, maxWidth: 18, minHeight: 8, maxHeight: 18 },
  { label: "Large", minWidth: 18, maxWidth: 500, minHeight: 18, maxHeight: 500 },
];

const parseInches = (value?: string): number | null => {
  if (!value) return null;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
};

const matchesArtworkQuery = (
  artwork: Artwork,
  options?: ArtworkFeedQueryOptions
): boolean => {
  if (!options) return true;

  const q = options.query?.trim().toLowerCase();
  if (q) {
    const matchesText =
      artwork.title?.toLowerCase().includes(q) ||
      artwork.description?.toLowerCase().includes(q) ||
      artwork.artistName?.toLowerCase().includes(q) ||
      artwork.category?.toLowerCase().includes(q) ||
      artwork.medium?.toLowerCase().includes(q);
    const matchesArtist = !!options.artistIds?.includes(artwork.artistId);
    if (!matchesText && !matchesArtist) return false;
  }

  if (options.priceRange) {
    if (
      artwork.price < options.priceRange.min ||
      artwork.price > options.priceRange.max
    ) {
      return false;
    }
  }

  if (options.category && options.category !== "All") {
    if ((artwork.category || "").toLowerCase() !== options.category.toLowerCase()) {
      return false;
    }
  }

  if (options.mediums && options.mediums.length > 0) {
    const normalizedMedium = (artwork.medium || "").toLowerCase();
    const mediumMatches = options.mediums.some(
      (medium) => medium.toLowerCase() === normalizedMedium
    );
    if (!mediumMatches) return false;
  }

  if (options.sizes && options.sizes.length > 0) {
    const width = parseInches(artwork.width);
    const height = parseInches(artwork.height);
    if (width === null || height === null) return false;
    const matchesSize = options.sizes.some((selectedSize) => {
      const sizeCategory = SIZE_CATEGORIES.find((s) => s.label === selectedSize);
      if (!sizeCategory) return false;
      return (
        width >= sizeCategory.minWidth &&
        width <= sizeCategory.maxWidth &&
        height >= sizeCategory.minHeight &&
        height <= sizeCategory.maxHeight
      );
    });
    if (!matchesSize) return false;
  }

  return true;
};

/**
 * Upload images to Firebase Storage
 */
export async function uploadArtworkImages(
  userId: string,
  files: File[]
): Promise<string[]> {
  const uploadPromises = files.map(async (file, index) => {
    const timestamp = Date.now();
    // Compress image before upload (converts to WebP)
    const compressedFile = await compressImage(file);
    const filename = `${timestamp}_${index}_${compressedFile.name.replace(/\.[^/.]+$/, '')}.webp`;
    const storageRef = ref(storage, `artworks/${userId}/${filename}`);

    // Set cache headers for CDN optimization (1 year cache)
    const metadata: UploadMetadata = {
      contentType: 'image/webp',
      cacheControl: 'public, max-age=31536000',
    };

    await uploadBytes(storageRef, compressedFile, metadata);
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  });

  return Promise.all(uploadPromises);
}

/**
 * Upload a single image to Firebase Storage (for immediate upload flow)
 */
export async function uploadSingleArtworkImage(
  userId: string,
  file: File
): Promise<string> {
  const timestamp = Date.now();
  // Compress image before upload (converts to WebP)
  const compressedFile = await compressImage(file);
  const filename = `${timestamp}_${Math.random().toString(36).substring(7)}_${compressedFile.name.replace(/\.[^/.]+$/, '')}.webp`;
  const storageRef = ref(storage, `artworks/${userId}/${filename}`);

  // Set cache headers for CDN optimization (1 year cache)
  const metadata: UploadMetadata = {
    contentType: 'image/webp',
    cacheControl: 'public, max-age=31536000',
  };

  await uploadBytes(storageRef, compressedFile, metadata);
  const downloadURL = await getDownloadURL(storageRef);
  return downloadURL;
}

/**
 * Delete artwork images by URLs (for cleanup when user discards draft)
 */
export async function deleteArtworkImagesByUrls(imageUrls: string[]): Promise<void> {
  const deletePromises = imageUrls.map(async (imageUrl) => {
    try {
      const imageRef = ref(storage, imageUrl);
      await deleteObject(imageRef);
    } catch (error) {
      // Silently fail - image may already be deleted or URL invalid
    }
  });
  
  await Promise.all(deletePromises);
}

/**
 * Create new artwork
 */
export async function createArtwork(
  userId: string,
  userName: string,
  userAvatar: string | undefined,
  artworkData: ArtworkUpload,
  imageFiles: File[]
): Promise<string> {
  // Upload images first
  const imageUrls = await uploadArtworkImages(userId, imageFiles);

  // Create artwork document
  const artworkRef = doc(collection(db, "artworks"));
  const artworkId = artworkRef.id;

  const artwork = {
    artistId: userId,
    artistName: userName,
    artistAvatar: userAvatar || '',
    title: artworkData.title,
    description: artworkData.description,
    images: imageUrls,
    category: artworkData.category,
    medium: artworkData.medium,
    width: artworkData.width || '',
    height: artworkData.height || '',
    price: artworkData.price,
    isCommissioned: artworkData.isCommissioned,
    published: false, // Default to unpublished
    createdDate: artworkData.createdDate || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    views: 0,
    likes: 0,
    favorites: 0,
    comments: 0,
    reachOutClicks: 0,
  };

  await setDoc(artworkRef, artwork);

  return artworkId;
}

/**
 * Create new artwork with pre-uploaded image URLs (for immediate upload flow)
 */
export async function createArtworkWithUrls(
  userId: string,
  userName: string,
  userAvatar: string | undefined,
  artworkData: ArtworkUpload,
  imageUrls: string[]
): Promise<string> {
  // Create artwork document directly with the provided URLs
  const artworkRef = doc(collection(db, "artworks"));
  const artworkId = artworkRef.id;

  const artwork = {
    artistId: userId,
    artistName: userName,
    artistAvatar: userAvatar || '',
    title: artworkData.title,
    description: artworkData.description,
    images: imageUrls,
    category: artworkData.category,
    medium: artworkData.medium,
    width: artworkData.width || '',
    height: artworkData.height || '',
    price: artworkData.price,
    isCommissioned: artworkData.isCommissioned,
    published: false, // Default to unpublished
    createdDate: artworkData.createdDate || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    views: 0,
    likes: 0,
    favorites: 0,
    comments: 0,
    reachOutClicks: 0,
  };

  await setDoc(artworkRef, artwork);

  return artworkId;
}

/**
 * Get artwork by ID
 */
export async function getArtwork(artworkId: string): Promise<Artwork | null> {
  const artworkRef = doc(db, "artworks", artworkId);
  const artworkSnap = await getDoc(artworkRef);

  if (!artworkSnap.exists()) {
    return null;
  }

  const data = artworkSnap.data();
  const artwork = {
    id: artworkSnap.id,
    ...data,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
  } as Artwork;

  // Fetch current artist avatar from user profile
  const userDoc = await getDoc(doc(db, "users", artwork.artistId));
  if (userDoc.exists()) {
    const userData = userDoc.data();
    artwork.artistAvatar = userData.avatar || '/artist.png';
  }

  return artwork;
}

/**
 * Get artist's artworks (both published and unpublished)
 */
export async function getArtistArtworks(
  userId: string,
  publishedOnly: boolean = false
): Promise<Artwork[]> {
  let q;
  
  if (publishedOnly) {
    q = query(
      collection(db, "artworks"),
      where("artistId", "==", userId),
      where("published", "==", true),
      orderBy("createdAt", "desc")
    );
  } else {
    q = query(
      collection(db, "artworks"),
      where("artistId", "==", userId),
      orderBy("createdAt", "desc")
    );
  }

  const querySnapshot = await getDocs(q);
  const artworks = querySnapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as Artwork;
  });

  // Fetch current artist avatar from user profile
  const userDoc = await getDoc(doc(db, "users", userId));
  const currentAvatar = userDoc.exists() ? (userDoc.data().avatar || '/artist.png') : '/artist.png';

  // Update all artworks with current avatar
  return artworks.map(artwork => ({
    ...artwork,
    artistAvatar: currentAvatar
  }));
}

/**
 * Get artworks by artist (alias for getArtistArtworks)
 */
export async function getArtworksByArtist(userId: string): Promise<Artwork[]> {
  return getArtistArtworks(userId, false);
}

/**
 * Get all published artworks for feed, ordered by ranking score.
 * Falls back to createdAt ordering if score field is not yet populated.
 */
export async function getPublishedArtworks(limitCount: number = 20): Promise<Artwork[]> {
  let querySnapshot;

  try {
    const q = query(
      collection(db, "artworks"),
      where("published", "==", true),
      orderBy("score", "desc"),
      limit(limitCount)
    );
    querySnapshot = await getDocs(q);
  } catch {
    querySnapshot = null;
  }

  if (!querySnapshot || querySnapshot.empty) {
    const fallback = query(
      collection(db, "artworks"),
      where("published", "==", true),
      orderBy("createdAt", "desc"),
      limit(limitCount)
    );
    querySnapshot = await getDocs(fallback);
  }

  const artworks = querySnapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as Artwork;
  });

  // Get unique artist IDs
  const artistIdsSet = new Set<string>();
  artworks.forEach(a => artistIdsSet.add(a.artistId));
  const artistIds: string[] = [];
  artistIdsSet.forEach(id => artistIds.push(id));
  
  // Fetch current artist avatars from user profiles
  const artistAvatars = new Map<string, string>();
  await Promise.all(
    artistIds.map(async (artistId) => {
      const userDoc = await getDoc(doc(db, "users", artistId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        artistAvatars.set(artistId, userData.avatar || '/artist.png');
      }
    })
  );

  // Update artworks with current artist avatars
  return artworks.map(artwork => ({
    ...artwork,
    artistAvatar: artistAvatars.get(artwork.artistId) || artwork.artistAvatar || '/artist.png'
  }));
}

export type FeedPaginationOrderMode = "featured" | "newest";

/**
 * Get paginated published artworks for feed with cursor.
 * - `featured`: order by ranking score (falls back to createdAt if score not populated).
 * - `newest`: order by createdAt only.
 */
export async function getPublishedArtworksPaginated(
  limitCount: number = 20,
  lastVisible?: QueryDocumentSnapshot<DocumentData> | null,
  orderMode: FeedPaginationOrderMode = "featured"
): Promise<{ artworks: Artwork[], lastVisible: QueryDocumentSnapshot<DocumentData> | null, hasMore: boolean }> {
  let querySnapshot;

  if (orderMode === "newest") {
    const q = lastVisible
      ? query(
          collection(db, "artworks"),
          where("published", "==", true),
          orderBy("createdAt", "desc"),
          startAfter(lastVisible),
          limit(limitCount)
        )
      : query(
          collection(db, "artworks"),
          where("published", "==", true),
          orderBy("createdAt", "desc"),
          limit(limitCount)
        );
    querySnapshot = await getDocs(q);
  } else {
    try {
      const q = lastVisible
        ? query(
            collection(db, "artworks"),
            where("published", "==", true),
            orderBy("score", "desc"),
            startAfter(lastVisible),
            limit(limitCount)
          )
        : query(
            collection(db, "artworks"),
            where("published", "==", true),
            orderBy("score", "desc"),
            limit(limitCount)
          );
      querySnapshot = await getDocs(q);
    } catch {
      querySnapshot = null;
    }

    if (!querySnapshot || querySnapshot.empty) {
      const fallbackQ = lastVisible
        ? query(
            collection(db, "artworks"),
            where("published", "==", true),
            orderBy("createdAt", "desc"),
            startAfter(lastVisible),
            limit(limitCount)
          )
        : query(
            collection(db, "artworks"),
            where("published", "==", true),
            orderBy("createdAt", "desc"),
            limit(limitCount)
          );
      querySnapshot = await getDocs(fallbackQ);
    }
  }

  const artworks = querySnapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as Artwork;
  });

  // Get unique artist IDs
  const artistIdsSet = new Set<string>();
  artworks.forEach(a => artistIdsSet.add(a.artistId));
  const artistIds: string[] = [];
  artistIdsSet.forEach(id => artistIds.push(id));
  
  // Fetch current artist avatars from user profiles
  const artistAvatars = new Map<string, string>();
  await Promise.all(
    artistIds.map(async (artistId) => {
      const userDoc = await getDoc(doc(db, "users", artistId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        artistAvatars.set(artistId, userData.avatar || '/artist.png');
      }
    })
  );

  // Update artworks with current artist avatars
  const updatedArtworks = artworks.map(artwork => ({
    ...artwork,
    artistAvatar: artistAvatars.get(artwork.artistId) || artwork.artistAvatar || '/artist.png'
  }));

  return {
    artworks: updatedArtworks,
    lastVisible: querySnapshot.docs[querySnapshot.docs.length - 1] || null,
    hasMore: querySnapshot.docs.length === limitCount
  };
}

/**
 * Get paginated published artworks with server-driven filtering.
 * Firestore applies category/medium/sort constraints, then the client applies
 * text/size/price matching while streaming additional batches from server.
 */
export async function getPublishedArtworksFilteredPaginated(
  options: ArtworkFeedQueryOptions = {},
  limitCount: number = 20,
  lastVisible?: QueryDocumentSnapshot<DocumentData> | null
): Promise<{ artworks: Artwork[]; lastVisible: QueryDocumentSnapshot<DocumentData> | null; hasMore: boolean }> {
  const batchSize = Math.max(limitCount * 2, 40);
  const maxScannedDocs = 240;
  const collected: Artwork[] = [];
  const seenIds = new Set<string>();
  let scannedDocs = 0;
  let cursor = lastVisible || null;
  let hasMore = true;

  const sortKey: ArtworkFeedSortOption =
    options.sortOption ?? "featured";

  const isPriceSort =
    sortKey === "price-low" || sortKey === "price-high";

  /** If true, price index query failed — use createdAt stream + in-memory price sort (first page only). */
  let useCreatedAtPriceFallback = false;

  /** Featured: try score ordering; fall back to createdAt if index missing or no scored docs. */
  let useFeaturedScoreOrder = sortKey === "featured";

  while (collected.length < limitCount && hasMore && scannedDocs < maxScannedDocs) {
    // Featured: score (or createdAt fallback). Newest: createdAt. Price: price index or fallback.
    const constraints: QueryConstraint[] = [where("published", "==", true)];
    const usePriceOrder = isPriceSort && !useCreatedAtPriceFallback;
    if (usePriceOrder) {
      constraints.push(
        orderBy("price", sortKey === "price-low" ? "asc" : "desc")
      );
    } else if (sortKey === "featured" && useFeaturedScoreOrder) {
      constraints.push(orderBy("score", "desc"));
    } else {
      constraints.push(orderBy("createdAt", "desc"));
    }

    if (cursor) {
      constraints.push(startAfter(cursor));
    }
    constraints.push(limit(batchSize));

    const q = query(collection(db, "artworks"), ...constraints);
    let querySnapshot;
    try {
      querySnapshot = await getDocs(q);
    } catch (err) {
      if (
        sortKey === "featured" &&
        useFeaturedScoreOrder &&
        isMissingFirestoreIndexError(err)
      ) {
        useFeaturedScoreOrder = false;
        collected.length = 0;
        seenIds.clear();
        scannedDocs = 0;
        cursor = null;
        hasMore = true;
        continue;
      }
      if (
        isPriceSort &&
        !useCreatedAtPriceFallback &&
        !lastVisible &&
        isMissingFirestoreIndexError(err)
      ) {
        useCreatedAtPriceFallback = true;
        collected.length = 0;
        seenIds.clear();
        scannedDocs = 0;
        cursor = null;
        hasMore = true;
        continue;
      }
      throw err;
    }
    const docs = querySnapshot.docs;
    if (
      docs.length === 0 &&
      sortKey === "featured" &&
      useFeaturedScoreOrder &&
      cursor === null &&
      collected.length === 0
    ) {
      useFeaturedScoreOrder = false;
      continue;
    }
    scannedDocs += docs.length;
    cursor = docs[docs.length - 1] || cursor;
    hasMore = docs.length === batchSize;

    if (docs.length === 0) break;

    const rawArtworks = docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as Artwork;
    });

    const artistIdsSet = new Set<string>();
    rawArtworks.forEach((a) => artistIdsSet.add(a.artistId));
    const artistAvatars = new Map<string, string>();
    await Promise.all(
      Array.from(artistIdsSet).map(async (artistId) => {
        const userDoc = await getDoc(doc(db, "users", artistId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          artistAvatars.set(artistId, userData.avatar || "/artist.png");
        }
      })
    );

    rawArtworks.forEach((artwork) => {
      if (seenIds.has(artwork.id)) return;
      const hydratedArtwork = {
        ...artwork,
        artistAvatar:
          artistAvatars.get(artwork.artistId) || artwork.artistAvatar || "/artist.png",
      };
      if (matchesArtworkQuery(hydratedArtwork, options)) {
        collected.push(hydratedArtwork);
        seenIds.add(hydratedArtwork.id);
      }
    });
  }

  const sorted = collected
    .sort((a, b) => {
      if (sortKey === "price-low") return a.price - b.price;
      if (sortKey === "price-high") return b.price - a.price;
      if (sortKey === "featured") {
        const sa = a.score ?? 0;
        const sb = b.score ?? 0;
        if (sb !== sa) return sb - sa;
        return b.createdAt.getTime() - a.createdAt.getTime();
      }
      return b.createdAt.getTime() - a.createdAt.getTime();
    })
    .slice(0, limitCount);

  const paginationBrokenWithoutPriceIndex =
    isPriceSort && useCreatedAtPriceFallback;

  return {
    artworks: sorted,
    lastVisible: cursor,
    hasMore: paginationBrokenWithoutPriceIndex ? false : hasMore,
  };
}

/**
 * Get paginated published artworks from followed artists only
 */
export async function getPublishedArtworksFromFollowingPaginated(
  followingArtistIds: string[],
  limitCount: number = 20,
  lastVisible?: QueryDocumentSnapshot<DocumentData> | null
): Promise<{ artworks: Artwork[], lastVisible: QueryDocumentSnapshot<DocumentData> | null, hasMore: boolean }> {
  // If not following anyone, return empty result
  if (!followingArtistIds || followingArtistIds.length === 0) {
    return {
      artworks: [],
      lastVisible: null,
      hasMore: false
    };
  }

  // Firestore has a limit of 30 items in 'in' queries
  // For pagination with 'in' queries, we need a different approach
  // We'll fetch from all followed artists and merge results
  const batchSize = 30;
  const batches: string[][] = [];
  
  for (let i = 0; i < followingArtistIds.length; i += batchSize) {
    batches.push(followingArtistIds.slice(i, i + batchSize));
  }
  
  const allArtworks: Artwork[] = [];
  const allDocs: QueryDocumentSnapshot<DocumentData>[] = [];
  
  for (const batch of batches) {
    let q;
    
    if (lastVisible) {
      q = query(
        collection(db, "artworks"),
        where("published", "==", true),
        where("artistId", "in", batch),
        orderBy("createdAt", "desc"),
        startAfter(lastVisible),
        limit(limitCount)
      );
    } else {
      q = query(
        collection(db, "artworks"),
        where("published", "==", true),
        where("artistId", "in", batch),
        orderBy("createdAt", "desc"),
        limit(limitCount)
      );
    }
    
    try {
      const querySnapshot = await getDocs(q);
      querySnapshot.docs.forEach((doc) => {
        const data = doc.data();
        allArtworks.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as Artwork);
        allDocs.push(doc);
      });
    } catch (error) {
    }
  }
  
  // Sort all artworks by creation time
  const sortedArtworks = allArtworks.sort((a, b) => {
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
  
  // Take only the requested limit
  const paginatedArtworks = sortedArtworks.slice(0, limitCount);
  
  // Get unique artist IDs
  const artistIdsSet = new Set<string>();
  paginatedArtworks.forEach(a => artistIdsSet.add(a.artistId));
  const artistIds: string[] = [];
  artistIdsSet.forEach(id => artistIds.push(id));
  
  // Fetch current artist avatars from user profiles
  const artistAvatars = new Map<string, string>();
  await Promise.all(
    artistIds.map(async (artistId) => {
      const userDoc = await getDoc(doc(db, "users", artistId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        artistAvatars.set(artistId, userData.avatar || '/artist.png');
      }
    })
  );
  
  // Update artworks with current artist avatars
  const updatedArtworks = paginatedArtworks.map(artwork => ({
    ...artwork,
    artistAvatar: artistAvatars.get(artwork.artistId) || artwork.artistAvatar || '/artist.png'
  }));
  
  // Find the last document for pagination
  const lastDoc = allDocs.length > 0 ? allDocs[allDocs.length - 1] : null;
  
  return {
    artworks: updatedArtworks,
    lastVisible: lastDoc,
    hasMore: sortedArtworks.length > limitCount
  };
}

/**
 * Publish/unpublish artwork
 */
export async function toggleArtworkPublish(
  artworkId: string,
  published: boolean
): Promise<void> {
  const artworkRef = doc(db, "artworks", artworkId);
  await updateDoc(artworkRef, {
    published,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Update artwork details
 */
export async function updateArtwork(
  artworkId: string,
  updates: Partial<ArtworkUpload>
): Promise<void> {
  const artworkRef = doc(db, "artworks", artworkId);
  await updateDoc(artworkRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete artwork and its images
 */
export async function deleteArtwork(artworkId: string): Promise<void> {
  // Get artwork to find image URLs
  const artwork = await getArtwork(artworkId);
  if (!artwork) return;

  // Delete images from storage
  const deletePromises = artwork.images.map(async (imageUrl) => {
    try {
      const imageRef = ref(storage, imageUrl);
      await deleteObject(imageRef);
    } catch (error) {
    }
  });

  await Promise.all(deletePromises);

  // Delete artwork document
  const artworkRef = doc(db, "artworks", artworkId);
  await deleteDoc(artworkRef);
}

/**
 * Increment view count
 */
export async function incrementArtworkViews(artworkId: string): Promise<void> {
  const artworkRef = doc(db, "artworks", artworkId);
  const artwork = await getDoc(artworkRef);
  
  if (artwork.exists()) {
    const currentViews = artwork.data().views || 0;
    await updateDoc(artworkRef, {
      views: currentViews + 1,
    });
  }
}

/**
 * Increment reach-out click count for an artwork
 */
export async function incrementArtworkReachOutClicks(artworkId: string): Promise<void> {
  const artworkRef = doc(db, "artworks", artworkId);
  await updateDoc(artworkRef, {
    reachOutClicks: increment(1),
  });
}


