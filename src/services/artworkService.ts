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
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { Artwork, ArtworkUpload } from "../types/artwork";

/**
 * Upload images to Firebase Storage
 */
export async function uploadArtworkImages(
  userId: string,
  files: File[]
): Promise<string[]> {
  const uploadPromises = files.map(async (file, index) => {
    const timestamp = Date.now();
    const filename = `${timestamp}_${index}_${file.name}`;
    const storageRef = ref(storage, `artworks/${userId}/${filename}`);

    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  });

  return Promise.all(uploadPromises);
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
 * Get all published artworks for feed
 */
export async function getPublishedArtworks(limitCount: number = 20): Promise<Artwork[]> {
  const q = query(
    collection(db, "artworks"),
    where("published", "==", true),
    orderBy("createdAt", "desc"),
    limit(limitCount)
  );

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

/**
 * Get paginated published artworks for feed with cursor
 */
export async function getPublishedArtworksPaginated(
  limitCount: number = 20,
  lastVisible?: QueryDocumentSnapshot<DocumentData> | null
): Promise<{ artworks: Artwork[], lastVisible: QueryDocumentSnapshot<DocumentData> | null, hasMore: boolean }> {
  let q;
  
  if (lastVisible) {
    q = query(
      collection(db, "artworks"),
      where("published", "==", true),
      orderBy("createdAt", "desc"),
      startAfter(lastVisible),
      limit(limitCount)
    );
  } else {
    q = query(
      collection(db, "artworks"),
      where("published", "==", true),
      orderBy("createdAt", "desc"),
      limit(limitCount)
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
      console.error('Error fetching artworks batch:', error);
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
      console.error("Error deleting image:", error);
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


