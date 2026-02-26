import { db } from "../firebase";
import {
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  updateDoc,
  arrayUnion,
  onSnapshot,
  Unsubscribe,
} from "firebase/firestore";

export interface Story {
  id: string;
  artworkId: string;
  artistId: string;
  userName: string;
  userAvatar: string;
  artworkImage: string;
  artworkTitle: string;
  price: number;
  createdAt: Timestamp;
  expiresAt: Timestamp;
}

export interface GroupedStory {
  artistId: string;
  userName: string;
  userAvatar: string;
  stories: Story[];
  hasUnviewed: boolean;
}

/**
 * Create a new story from an artwork
 */
export async function createStory(
  artworkId: string,
  artistId: string,
  userName: string,
  userAvatar: string,
  artworkImage: string,
  artworkTitle: string,
  price: number
): Promise<string> {
  const storyId = `${artistId}_${Date.now()}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

  const storyData = {
    id: storyId,
    artworkId,
    artistId,
    userName,
    userAvatar,
    artworkImage,
    artworkTitle,
    price,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(expiresAt),
  };

  await setDoc(doc(db, "stories", storyId), storyData);
  return storyId;
}

/**
 * Get all active stories (not expired)
 */
export async function getActiveStories(): Promise<Story[]> {
  const now = Timestamp.now();
  const storiesRef = collection(db, "stories");
  
  try {
    // Try with full query (requires index)
    const q = query(
      storiesRef,
      where("expiresAt", ">", now),
      orderBy("expiresAt", "desc"),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    const querySnapshot = await getDocs(q);
    const stories: Story[] = [];

    querySnapshot.forEach((doc) => {
      stories.push(doc.data() as Story);
    });

    return stories;
  } catch (error: any) {
    // Fallback: if index is still building, use simpler query
    if (error?.code === 'failed-precondition' || error?.message?.includes('index')) {
      console.log('Using fallback query while index builds...');
      const fallbackQuery = query(
        storiesRef,
        where("expiresAt", ">", now),
        limit(50)
      );
      
      const querySnapshot = await getDocs(fallbackQuery);
      const stories: Story[] = [];

      querySnapshot.forEach((doc) => {
        stories.push(doc.data() as Story);
      });

      // Sort in memory
      return stories.sort((a, b) => {
        const aExpires = a.expiresAt instanceof Timestamp ? a.expiresAt.toMillis() : 0;
        const bExpires = b.expiresAt instanceof Timestamp ? b.expiresAt.toMillis() : 0;
        if (aExpires !== bExpires) return bExpires - aExpires;
        
        const aCreated = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : 0;
        const bCreated = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : 0;
        return bCreated - aCreated;
      });
    }
    throw error;
  }
}

/**
 * Get active stories from followed artists only (optionally including current user's stories)
 */
export async function getActiveStoriesFromFollowing(followingArtistIds: string[], currentUserId?: string): Promise<Story[]> {
  const now = Timestamp.now();
  const storiesRef = collection(db, "stories");
  const allStories: Story[] = [];
  
  // First, fetch current user's own stories if userId provided
  if (currentUserId) {
    try {
      const userStoriesQuery = query(
        storiesRef,
        where("artistId", "==", currentUserId),
        where("expiresAt", ">", now),
        limit(50)
      );
      
      const userSnapshot = await getDocs(userStoriesQuery);
      userSnapshot.forEach((doc) => {
        allStories.push(doc.data() as Story);
      });
    } catch (error) {
      console.error('Error fetching user own stories:', error);
    }
  }
  
  // If not following anyone, return only user's own stories
  if (!followingArtistIds || followingArtistIds.length === 0) {
    return allStories;
  }
  
  // Firestore has a limit of 30 items in 'in' queries, so we need to batch if following more
  const batchSize = 30;
  const batches: string[][] = [];
  
  for (let i = 0; i < followingArtistIds.length; i += batchSize) {
    batches.push(followingArtistIds.slice(i, i + batchSize));
  }
  
  for (const batch of batches) {
    try {
      const q = query(
        storiesRef,
        where("artistId", "in", batch),
        where("expiresAt", ">", now),
        limit(50)
      );
      
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach((doc) => {
        allStories.push(doc.data() as Story);
      });
    } catch (error: any) {
      console.error('Error fetching stories batch:', error);
      
      // Fallback: if index is not ready, fetch all stories for these artists and filter client-side
      if (error?.code === 'failed-precondition' || error?.message?.includes('index')) {
        console.log('Index not ready, using fallback query...');
        try {
          // Simple query without compound index
          const fallbackQuery = query(
            storiesRef,
            where("artistId", "in", batch),
            limit(50)
          );
          
          const querySnapshot = await getDocs(fallbackQuery);
          querySnapshot.forEach((doc) => {
            const story = doc.data() as Story;
            // Filter expired stories client-side
            if (story.expiresAt && story.expiresAt.toMillis() > now.toMillis()) {
              allStories.push(story);
            }
          });
        } catch (fallbackError) {
          console.error('Fallback query also failed:', fallbackError);
        }
      }
    }
  }
  
  // Remove duplicates (in case user is in their own following list)
  const uniqueStories = Array.from(
    new Map(allStories.map(story => [story.id, story])).values()
  );
  
  // Sort all stories by creation time
  return uniqueStories.sort((a, b) => {
    const aCreated = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : 0;
    const bCreated = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : 0;
    return bCreated - aCreated;
  });
}

/**
 * Get stories by user ID
 */
export async function getUserStories(artistId: string): Promise<Story[]> {
  const now = Timestamp.now();
  const storiesRef = collection(db, "stories");
  const q = query(
    storiesRef,
    where("artistId", "==", artistId),
    where("expiresAt", ">", now),
    orderBy("expiresAt", "desc")
  );

  const querySnapshot = await getDocs(q);
  const stories: Story[] = [];

  querySnapshot.forEach((doc) => {
    stories.push(doc.data() as Story);
  });

  return stories;
}

/**
 * Delete a story
 */
export async function deleteStory(storyId: string): Promise<void> {
  await deleteDoc(doc(db, "stories", storyId));
}

/**
 * Delete expired stories (cleanup function)
 */
export async function deleteExpiredStories(): Promise<void> {
  const now = Timestamp.now();
  const storiesRef = collection(db, "stories");
  const q = query(storiesRef, where("expiresAt", "<=", now));

  const querySnapshot = await getDocs(q);
  const deletePromises = querySnapshot.docs.map((doc) => deleteDoc(doc.ref));

  await Promise.all(deletePromises);
}

/**
 * Group stories by user (Instagram-style)
 * Returns stories grouped by user with current user first
 */
export function groupStoriesByUser(stories: Story[], currentArtistId?: string): GroupedStory[] {
  const userStoriesMap = new Map<string, Story[]>();

  // Group stories by artistId
  stories.forEach((story) => {
    const existing = userStoriesMap.get(story.artistId) || [];
    existing.push(story);
    userStoriesMap.set(story.artistId, existing);
  });

  // Convert to array and sort stories within each group
  const grouped: GroupedStory[] = Array.from(userStoriesMap.entries()).map(([artistId, userStories]) => {
    const sortedStories = userStories.sort((a, b) => {
      // Sort by creation time, newest first
      const aTime = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : 0;
      const bTime = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : 0;
      return bTime - aTime;
    });

    return {
      artistId,
      userName: sortedStories[0].userName,
      userAvatar: sortedStories[0].userAvatar,
      stories: sortedStories,
      hasUnviewed: true, // Will be updated based on viewed status in component
    };
  });

  // Sort: current user first, then others
  grouped.sort((a, b) => {
    if (currentArtistId) {
      if (a.artistId === currentArtistId) return -1;
      if (b.artistId === currentArtistId) return 1;
    }
    return 0;
  });

  return grouped;
}

/**
 * Mark stories as viewed by a user
 */
export async function markStoriesAsViewed(
  userId: string,
  storyIds: string[]
): Promise<void> {
  if (!userId || storyIds.length === 0) return;

  const userStoryViewsRef = doc(db, "storyViews", userId);
  
  try {
    await setDoc(
      userStoryViewsRef,
      {
        userId,
        viewedStories: arrayUnion(...storyIds),
        lastUpdated: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error('Error marking stories as viewed:', error);
  }
}

/**
 * Get viewed stories for a user
 */
export async function getViewedStories(userId: string): Promise<string[]> {
  if (!userId) return [];

  try {
    const userStoryViewsRef = doc(db, "storyViews", userId);
    const docSnap = await getDoc(userStoryViewsRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return data.viewedStories || [];
    }
    return [];
  } catch (error) {
    console.error('Error getting viewed stories:', error);
    return [];
  }
}

// ==================== REAL-TIME LISTENERS ====================

/**
 * Subscribe to real-time updates for all active stories
 * Returns unsubscribe function - MUST call it to cleanup
 */
export function subscribeToActiveStories(
  onUpdate: (stories: Story[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const now = Timestamp.now();
  const storiesRef = collection(db, "stories");
  
  const q = query(
    storiesRef,
    where("expiresAt", ">", now),
    limit(50)
  );
  
  return onSnapshot(
    q,
    (snapshot) => {
      const stories: Story[] = [];
      snapshot.forEach((doc) => {
        stories.push(doc.data() as Story);
      });
      
      // Sort in memory
      const sortedStories = stories.sort((a, b) => {
        const aExpires = a.expiresAt instanceof Timestamp ? a.expiresAt.toMillis() : 0;
        const bExpires = b.expiresAt instanceof Timestamp ? b.expiresAt.toMillis() : 0;
        if (aExpires !== bExpires) return bExpires - aExpires;
        
        const aCreated = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : 0;
        const bCreated = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : 0;
        return bCreated - aCreated;
      });
      
      onUpdate(sortedStories);
    },
    (error) => {
      console.error('Error in active stories subscription:', error);
      if (onError) onError(error as Error);
    }
  );
}

/**
 * Subscribe to real-time updates for stories from followed artists
 * Returns unsubscribe function - MUST call it to cleanup
 */
export function subscribeToFollowingStories(
  followingArtistIds: string[],
  currentUserId: string | undefined,
  onUpdate: (stories: Story[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const now = Timestamp.now();
  const storiesRef = collection(db, "stories");
  const unsubscribers: Unsubscribe[] = [];
  const allStories = new Map<string, Story>();
  
  const emitUpdate = () => {
    const stories = Array.from(allStories.values());
    const sortedStories = stories.sort((a, b) => {
      const aCreated = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : 0;
      const bCreated = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : 0;
      return bCreated - aCreated;
    });
    onUpdate(sortedStories);
  };
  
  // Subscribe to current user's own stories if provided
  if (currentUserId) {
    const userStoriesQuery = query(
      storiesRef,
      where("artistId", "==", currentUserId),
      where("expiresAt", ">", now),
      limit(50)
    );
    
    unsubscribers.push(
      onSnapshot(userStoriesQuery, (snapshot) => {
        snapshot.forEach((doc) => {
          allStories.set(doc.id, doc.data() as Story);
        });
        emitUpdate();
      }, onError)
    );
  }
  
  // Subscribe to followed artists' stories (batch if needed)
  if (followingArtistIds && followingArtistIds.length > 0) {
    const batchSize = 30;
    const batches: string[][] = [];
    
    for (let i = 0; i < followingArtistIds.length; i += batchSize) {
      batches.push(followingArtistIds.slice(i, i + batchSize));
    }
    
    batches.forEach((batch) => {
      const q = query(
        storiesRef,
        where("artistId", "in", batch),
        where("expiresAt", ">", now),
        limit(50)
      );
      
      unsubscribers.push(
        onSnapshot(
          q,
          (snapshot) => {
            snapshot.forEach((doc) => {
              allStories.set(doc.id, doc.data() as Story);
            });
            emitUpdate();
          },
          onError
        )
      );
    });
  }
  
  // Return combined unsubscribe function
  return () => {
    unsubscribers.forEach(unsub => unsub());
  };
}
