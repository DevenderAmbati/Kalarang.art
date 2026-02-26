import { db, storage } from "../firebase";
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  Unsubscribe,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { AppUser } from "../types/user";

export interface UserProfile extends AppUser {
  bio?: string;
  avatar?: string;
  bannerImage?: string;
  artStyle?: string[];
  philosophy?: string;
  achievements?: string[];
  exhibitions?: { year: string; title: string }[];
  education?: string[];
  commissionStatus?: "Open" | "Closed";
  commissionDescription?: string;
  commissionCtaText?: string;
  links?: { label: string; url: string; icon: string }[];
  stats?: {
    followers: number;
    artworks: number;
    following: number;
  };
}

/**
 * Convert blob URL to File object
 */
async function blobUrlToFile(blobUrl: string, filename: string): Promise<File> {
  const response = await fetch(blobUrl);
  const blob = await response.blob();
  return new File([blob], filename, { type: blob.type });
}

/**
 * Upload profile image (avatar or banner)
 */
export async function uploadProfileImage(
  userId: string,
  file: Blob | File | string,
  type: "avatar" | "banner"
): Promise<string> {
  const timestamp = Date.now();
  const filename = `${type}_${timestamp}.jpg`;
  const storageRef = ref(storage, `users/${userId}/${filename}`);

  // Handle blob URL (string) conversion
  let fileToUpload: Blob | File;
  if (typeof file === 'string') {
    fileToUpload = await blobUrlToFile(file, filename);
  } else {
    fileToUpload = file;
  }

  await uploadBytes(storageRef, fileToUpload);
  const downloadURL = await getDownloadURL(storageRef);
  return downloadURL;
}

/**
 * Get user profile with extended data
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    return null;
  }

  const data = userSnap.data();
  return {
    uid: userSnap.id,
    ...data,
    createdAt: data.createdAt?.toDate() || new Date(),
  } as UserProfile;
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  userId: string,
  updates: Partial<UserProfile>
): Promise<void> {
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Check if username is available
 */
export async function isUsernameAvailable(username: string): Promise<boolean> {
  const usersRef = collection(db, "users");
  const q = query(usersRef, where("username", "==", username));
  const querySnapshot = await getDocs(q);
  return querySnapshot.empty;
}

/**
 * Update username
 */
export async function updateUsername(userId: string, username: string): Promise<void> {
  const available = await isUsernameAvailable(username);
  if (!available) {
    throw new Error("Username already taken");
  }

  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, {
    username,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Update user banner
 */
export async function updateUserBanner(
  userId: string,
  bannerBlobUrl: string
): Promise<string> {
  // Upload banner to Firebase Storage
  const bannerUrl = await uploadProfileImage(userId, bannerBlobUrl, 'banner');
  
  // Update user document with new banner URL
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, {
    bannerImage: bannerUrl,
    updatedAt: serverTimestamp(),
  });
  
  return bannerUrl;
}

/**
 * Update user avatar
 */
export async function updateUserAvatar(
  userId: string,
  avatarBlobUrl: string
): Promise<string> {
  // Upload avatar to Firebase Storage
  const avatarUrl = await uploadProfileImage(userId, avatarBlobUrl, 'avatar');
  
  // Update user document with new avatar URL
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, {
    avatar: avatarUrl,
    updatedAt: serverTimestamp(),
  });
  
  return avatarUrl;
}

/**
 * Get user statistics (followers, following, artworks)
 */
export async function getUserStats(userId: string): Promise<{
  followers: number;
  following: number;
  artworks: number;
}> {
  // Count followers (excluding self)
  const followersRef = collection(db, "follows");
  const followersQuery = query(followersRef, where("artistId", "==", userId));
  const followersSnapshot = await getDocs(followersQuery);
  const followers = followersSnapshot.docs.filter(doc => doc.data().followerId !== userId).length;

  // Count following (excluding self)
  const followingQuery = query(followersRef, where("followerId", "==", userId));
  const followingSnapshot = await getDocs(followingQuery);
  const following = followingSnapshot.docs.filter(doc => doc.data().artistId !== userId).length;

  // Count artworks
  const artworksRef = collection(db, "artworks");
  const artworksQuery = query(artworksRef, where("artistId", "==", userId), where("published", "==", true));
  const artworksSnapshot = await getDocs(artworksQuery);
  const artworks = artworksSnapshot.size;

  return { followers, following, artworks };
}

/**
 * Get list of followers with user details
 */
export async function getFollowersList(userId: string): Promise<Array<{
  uid: string;
  name: string;
  username?: string;
  avatar?: string;
}>> {
  const followersRef = collection(db, "follows");
  const followersQuery = query(followersRef, where("artistId", "==", userId));
  const followersSnapshot = await getDocs(followersQuery);
  
  // Filter out self-follows
  const followerIds = followersSnapshot.docs
    .map(doc => doc.data().followerId)
    .filter(followerId => followerId !== userId);
  
  // Fetch user details for each follower
  const followers = await Promise.all(
    followerIds.map(async (followerId) => {
      const userDoc = await getDoc(doc(db, "users", followerId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        return {
          uid: followerId,
          name: userData.name || 'Unknown User',
          username: userData.username,
          avatar: userData.avatar,
        };
      }
      return null;
    })
  );
  
  return followers.filter(f => f !== null) as Array<{
    uid: string;
    name: string;
    username?: string;
    avatar?: string;
  }>;
}

/**
 * Get list of users being followed with user details
 */
export async function getFollowingList(userId: string): Promise<Array<{
  uid: string;
  name: string;
  username?: string;
  avatar?: string;
}>> {
  const followsRef = collection(db, "follows");
  const followingQuery = query(followsRef, where("followerId", "==", userId));
  const followingSnapshot = await getDocs(followingQuery);
  
  // Filter out self-follows
  const followingIds = followingSnapshot.docs
    .map(doc => doc.data().artistId)
    .filter(artistId => artistId !== userId);
  
  // Fetch user details for each followed user
  const following = await Promise.all(
    followingIds.map(async (artistId) => {
      const userDoc = await getDoc(doc(db, "users", artistId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        return {
          uid: artistId,
          name: userData.name || 'Unknown User',
          username: userData.username,
          avatar: userData.avatar,
        };
      }
      return null;
    })
  );
  
  return following.filter(f => f !== null) as Array<{
    uid: string;
    name: string;
    username?: string;
    avatar?: string;
  }>;
}

/**
 * Get artist IDs that a user is following (lightweight version)
 */
export async function getFollowingArtistIds(userId: string): Promise<string[]> {
  const followsRef = collection(db, "follows");
  const followingQuery = query(followsRef, where("followerId", "==", userId));
  const followingSnapshot = await getDocs(followingQuery);
  
  // Filter out self-follows and return only IDs
  return followingSnapshot.docs
    .map(doc => doc.data().artistId)
    .filter(artistId => artistId !== userId);
}

/**
 * Search users by name or username (artists only)
 */
export async function searchUsers(searchQuery: string): Promise<Array<{
  uid: string;
  name: string;
  username?: string;
  avatar?: string;
}>> {
  if (!searchQuery.trim()) {
    return [];
  }

  const usersRef = collection(db, "users");
  const usersSnapshot = await getDocs(usersRef);
  
  // Remove @ prefix if present for username search
  const query = searchQuery.toLowerCase().trim();
  const queryWithoutAt = query.startsWith('@') ? query.substring(1) : query;
  
  const matchingUsers: Array<{
    uid: string;
    name: string;
    username?: string;
    avatar?: string;
  }> = [];

  usersSnapshot.docs.forEach(doc => {
    const userData = doc.data();
    const name = userData.name?.toLowerCase() || '';
    const username = userData.username?.toLowerCase() || '';
    const role = userData.role;

    // Only include artists, not buyers
    if (role !== 'artist') {
      return;
    }

    // Match by name or username (with or without @ prefix)
    if (name.includes(query) || username.includes(queryWithoutAt)) {
      matchingUsers.push({
        uid: doc.id,
        name: userData.name || 'Unknown User',
        username: userData.username,
        avatar: userData.avatar,
      });
    }
  });

  return matchingUsers;
}

// ==================== REAL-TIME LISTENERS ====================

/**
 * Subscribe to real-time user stats (followers, following, artworks)
 * Returns unsubscribe function - MUST call it to cleanup
 */
export function subscribeToUserStats(
  userId: string,
  onUpdate: (stats: { followers: number; following: number; artworks: number }) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const unsubscribers: Unsubscribe[] = [];
  let currentStats = { followers: 0, following: 0, artworks: 0 };
  
  // Subscribe to followers
  const followersQuery = query(
    collection(db, "follows"),
    where("artistId", "==", userId)
  );
  unsubscribers.push(
    onSnapshot(followersQuery, (snapshot) => {
      currentStats.followers = snapshot.docs.filter(doc => doc.data().followerId !== userId).length;
      onUpdate({ ...currentStats });
    }, onError)
  );
  
  // Subscribe to following
  const followingQuery = query(
    collection(db, "follows"),
    where("followerId", "==", userId)
  );
  unsubscribers.push(
    onSnapshot(followingQuery, (snapshot) => {
      currentStats.following = snapshot.docs.filter(doc => doc.data().artistId !== userId).length;
      onUpdate({ ...currentStats });
    }, onError)
  );
  
  // Subscribe to artworks
  const artworksQuery = query(
    collection(db, "artworks"),
    where("artistId", "==", userId),
    where("published", "==", true)
  );
  unsubscribers.push(
    onSnapshot(artworksQuery, (snapshot) => {
      currentStats.artworks = snapshot.size;
      onUpdate({ ...currentStats });
    }, onError)
  );
  
  // Return combined unsubscribe function
  return () => {
    unsubscribers.forEach(unsub => unsub());
  };
}
