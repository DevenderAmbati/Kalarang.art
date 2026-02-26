# Real-Time Updates Implementation Guide

## Overview

Your app now supports **real-time updates** across all users! When one user makes a change (likes, follows, updates profile, publishes artwork), all other users see it **instantly** without refreshing.

## How It Works (Like Instagram)

### Technology Stack:

- **Firebase Firestore** - Built-in WebSocket connections
- **onSnapshot()** - Real-time listeners that push updates
- **React Hooks** - Automatic UI updates when data changes

### Architecture:

```
User A makes change → Firestore updates → WebSocket broadcasts → All connected users receive update → UI auto-updates
```

---

## Usage Options

### **Option 1: Simple Hooks (Recommended)**

Use the pre-built hooks for common use cases:

```tsx
import { useRealtimeDocument } from "../hooks/useRealtimeDocument";
import { useRealtimeQuery } from "../hooks/useRealtimeQuery";

function ArtworkDetail({ artworkId }) {
  // Automatically updates when artwork changes
  const {
    data: artwork,
    loading,
    error,
  } = useRealtimeDocument("artworks", artworkId);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h1>{artwork.title}</h1>
      <p>Likes: {artwork.likes}</p> {/* Updates in real-time! */}
    </div>
  );
}
```

### **Option 2: Service Functions (Advanced)**

More control with manual subscription management:

```tsx
import { subscribeToArtwork } from "../services/artworkService";
import { useEffect, useState } from "react";

function ArtworkDetail({ artworkId }) {
  const [artwork, setArtwork] = useState(null);

  useEffect(() => {
    // Subscribe to real-time updates
    const unsubscribe = subscribeToArtwork(
      artworkId,
      (updatedArtwork) => {
        setArtwork(updatedArtwork);
        console.log("Artwork updated in real-time!");
      },
      (error) => console.error("Subscription error:", error),
    );

    // CRITICAL: Cleanup subscription when component unmounts
    return () => unsubscribe();
  }, [artworkId]);

  return <div>{artwork?.title}</div>;
}
```

---

## Available Real-Time Functions

### **Artwork Service** (`artworkService.ts`)

#### `subscribeToArtwork(artworkId, onUpdate, onError?)`

Listen to changes on a single artwork.

```tsx
const unsubscribe = subscribeToArtwork(artworkId, (artwork) => {
  console.log("Artwork updated:", artwork.likes);
});
```

#### `subscribeToArtistArtworks(userId, publishedOnly, onUpdate, onError?)`

Listen to all artworks by an artist.

```tsx
const unsubscribe = subscribeToArtistArtworks(artistId, true, (artworks) => {
  console.log("Artist artworks updated:", artworks.length);
});
```

#### `subscribeToPublishedArtworks(limit, onUpdate, onError?)`

Listen to published artworks feed.

```tsx
const unsubscribe = subscribeToPublishedArtworks(20, (artworks) => {
  console.log("Feed updated:", artworks.length);
});
```

#### `subscribeToFollowingArtworks(followingIds, limit, onUpdate, onError?)`

Listen to artworks from followed artists only.

```tsx
const unsubscribe = subscribeToFollowingArtworks(
  followingIds,
  20,
  (artworks) => {
    console.log("Following feed updated:", artworks.length);
  },
);
```

---

### **User Service** (`userService.ts`)

#### `subscribeToUserProfile(userId, onUpdate, onError?)`

Listen to user profile changes.

```tsx
const unsubscribe = subscribeToUserProfile(userId, (profile) => {
  console.log("Profile updated:", profile.avatar);
});
```

#### `subscribeToUserStats(userId, onUpdate, onError?)`

Listen to user statistics (followers, following, artworks count).

```tsx
const unsubscribe = subscribeToUserStats(userId, (stats) => {
  console.log("Stats updated:", stats.followers);
});
```

#### `subscribeToFollowers(userId, onUpdate, onError?)`

Listen to followers list.

```tsx
const unsubscribe = subscribeToFollowers(userId, (followers) => {
  console.log("Followers updated:", followers.length);
});
```

#### `subscribeToFollowing(userId, onUpdate, onError?)`

Listen to following list.

```tsx
const unsubscribe = subscribeToFollowing(userId, (following) => {
  console.log("Following updated:", following.length);
});
```

---

### **Interaction Service** (`interactionService.ts`)

#### `subscribeToLikeStatus(userId, artworkId, onUpdate, onError?)`

Listen to like status changes.

```tsx
const unsubscribe = subscribeToLikeStatus(userId, artworkId, (isLiked) => {
  console.log("Like status:", isLiked);
});
```

#### `subscribeToFavoriteStatus(userId, artworkId, onUpdate, onError?)`

Listen to favorite status changes.

```tsx
const unsubscribe = subscribeToFavoriteStatus(
  userId,
  artworkId,
  (isFavorite) => {
    console.log("Favorite status:", isFavorite);
  },
);
```

#### `subscribeToFollowStatus(followerId, artistId, onUpdate, onError?)`

Listen to follow status changes.

```tsx
const unsubscribe = subscribeToFollowStatus(userId, artistId, (isFollowing) => {
  console.log("Follow status:", isFollowing);
});
```

#### `subscribeToArtworkLikes(artworkId, onUpdate, onError?)`

Listen to like count changes.

```tsx
const unsubscribe = subscribeToArtworkLikes(artworkId, (likeCount) => {
  console.log("Like count:", likeCount);
});
```

---

### **Story Service** (`storyService.ts`)

#### `subscribeToActiveStories(onUpdate, onError?)`

Listen to all active stories (not expired).

```tsx
const unsubscribe = subscribeToActiveStories((stories) => {
  console.log("Active stories updated:", stories.length);
});
```

#### `subscribeToFollowingStories(followingIds, currentUserId, onUpdate, onError?)`

Listen to stories from followed artists only.

```tsx
const unsubscribe = subscribeToFollowingStories(
  followingIds,
  userId,
  (stories) => {
    console.log("Following stories updated:", stories.length);
  },
);
```

#### `subscribeToUserStories(artistId, onUpdate, onError?)`

Listen to a specific user's stories.

```tsx
const unsubscribe = subscribeToUserStories(artistId, (stories) => {
  console.log("User stories updated:", stories.length);
});
```

---

## Complete Component Examples

### Example 1: Real-Time Artwork Card

```tsx
import React, { useEffect, useState } from "react";
import { subscribeToArtwork } from "../../services/artworkService";
import {
  subscribeToLikeStatus,
  likeArtwork,
  unlikeArtwork,
} from "../../services/interactionService";
import { useAuth } from "../../context/AuthContext";

function RealtimeArtworkCard({ artworkId }) {
  const { appUser } = useAuth();
  const [artwork, setArtwork] = useState(null);
  const [isLiked, setIsLiked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!artworkId || !appUser) return;

    setLoading(true);

    // Subscribe to artwork updates
    const unsubArtwork = subscribeToArtwork(artworkId, (updated) => {
      setArtwork(updated);
      setLoading(false);
    });

    // Subscribe to like status
    const unsubLike = subscribeToLikeStatus(appUser.uid, artworkId, (liked) =>
      setIsLiked(liked),
    );

    // Cleanup subscriptions
    return () => {
      unsubArtwork();
      unsubLike();
    };
  }, [artworkId, appUser]);

  const handleLike = async () => {
    if (!appUser) return;

    if (isLiked) {
      await unlikeArtwork(appUser.uid, artworkId);
    } else {
      await likeArtwork(appUser.uid, artworkId);
    }
    // UI updates automatically via subscription!
  };

  if (loading) return <div>Loading...</div>;
  if (!artwork) return null;

  return (
    <div className="artwork-card">
      <img src={artwork.images[0]} alt={artwork.title} />
      <h3>{artwork.title}</h3>
      <p>{artwork.likes} likes</p> {/* Updates in real-time! */}
      <button onClick={handleLike} className={isLiked ? "liked" : ""}>
        {isLiked ? "❤️" : "🤍"} {/* Updates instantly! */}
      </button>
    </div>
  );
}

export default RealtimeArtworkCard;
```

### Example 2: Real-Time User Profile

```tsx
import React, { useEffect, useState } from "react";
import {
  subscribeToUserProfile,
  subscribeToUserStats,
} from "../../services/userService";
import {
  subscribeToFollowStatus,
  followArtist,
  unfollowArtist,
} from "../../services/interactionService";
import { useAuth } from "../../context/AuthContext";

function RealtimeUserProfile({ userId }) {
  const { appUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({
    followers: 0,
    following: 0,
    artworks: 0,
  });
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    if (!userId) return;

    // Subscribe to profile updates
    const unsubProfile = subscribeToUserProfile(userId, setProfile);

    // Subscribe to stats updates
    const unsubStats = subscribeToUserStats(userId, setStats);

    // Subscribe to follow status (if not own profile)
    let unsubFollow = () => {};
    if (appUser && appUser.uid !== userId) {
      unsubFollow = subscribeToFollowStatus(
        appUser.uid,
        userId,
        setIsFollowing,
      );
    }

    return () => {
      unsubProfile();
      unsubStats();
      unsubFollow();
    };
  }, [userId, appUser]);

  const handleFollow = async () => {
    if (!appUser) return;

    if (isFollowing) {
      await unfollowArtist(appUser.uid, userId);
    } else {
      await followArtist(appUser.uid, userId, appUser.name, appUser.avatar);
    }
    // UI updates automatically!
  };

  if (!profile) return <div>Loading...</div>;

  return (
    <div className="user-profile">
      <img src={profile.avatar} alt={profile.name} />
      <h1>{profile.name}</h1>
      <p>@{profile.username}</p>

      <div className="stats">
        <span>{stats.followers} followers</span> {/* Real-time! */}
        <span>{stats.following} following</span>
        <span>{stats.artworks} artworks</span>
      </div>

      {appUser?.uid !== userId && (
        <button onClick={handleFollow}>
          {isFollowing ? "Following" : "Follow"} {/* Real-time! */}
        </button>
      )}
    </div>
  );
}

export default RealtimeUserProfile;
```

### Example 3: Real-Time Feed with Hooks

```tsx
import React from "react";
import { useRealtimeQuery } from "../../hooks/useRealtimeQuery";
import { where, orderBy, limit } from "firebase/firestore";
import { Artwork } from "../../types/artwork";

function RealtimeFeed() {
  const {
    data: artworks,
    loading,
    error,
  } = useRealtimeQuery<Artwork>("artworks", [
    where("published", "==", true),
    orderBy("createdAt", "desc"),
    limit(20),
  ]);

  if (loading) return <div>Loading feed...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="feed">
      <h1>Latest Artworks ({artworks.length})</h1>
      {artworks.map((artwork) => (
        <div key={artwork.id}>
          <h3>{artwork.title}</h3>
          <p>{artwork.likes} likes</p> {/* Updates in real-time! */}
        </div>
      ))}
    </div>
  );
}

export default RealtimeFeed;
```

---

## Migration Guide: Converting Existing Components

### Before (Static Data):

```tsx
useEffect(() => {
  async function fetchArtwork() {
    const data = await getArtwork(artworkId); // One-time fetch
    setArtwork(data);
  }
  fetchArtwork();
}, [artworkId]);
```

### After (Real-Time):

```tsx
useEffect(() => {
  const unsubscribe = subscribeToArtwork(
    artworkId,
    (data) => setArtwork(data), // Auto-updates!
  );
  return () => unsubscribe(); // Cleanup
}, [artworkId]);
```

**OR use hooks:**

```tsx
const { data: artwork } = useRealtimeDocument("artworks", artworkId);
```

---

## Important Notes

### ✅ **Best Practices**

1. **Always cleanup subscriptions:**

   ```tsx
   useEffect(() => {
     const unsubscribe = subscribeToArtwork(...);
     return () => unsubscribe(); // CRITICAL!
   }, []);
   ```

2. **Handle loading states:**

   ```tsx
   const { data, loading, error } = useRealtimeDocument(...);
   if (loading) return <Spinner />;
   ```

3. **Prevent memory leaks:**
   - Subscriptions automatically cleanup on unmount
   - Don't forget the `return` statement in `useEffect`

4. **Optimize re-renders:**
   ```tsx
   // Only subscribe when needed
   useEffect(() => {
     if (!userId) return;
     const unsub = subscribeToUserProfile(userId, setProfile);
     return unsub;
   }, [userId]);
   ```

### ⚠️ **Common Pitfalls**

1. **Forgetting to unsubscribe:**

   ```tsx
   // ❌ BAD - Memory leak!
   useEffect(() => {
     subscribeToArtwork(id, setArtwork);
   }, [id]);

   // ✅ GOOD
   useEffect(() => {
     const unsub = subscribeToArtwork(id, setArtwork);
     return () => unsub();
   }, [id]);
   ```

2. **Multiple subscriptions to same data:**
   - Firestore charges per document read
   - Use context or shared state for global data

3. **Infinite loops:**

   ```tsx
   // ❌ BAD - Dependencies cause re-subscription
   useEffect(() => {
     const unsub = subscribeToArtwork(artwork.id, setArtwork);
     return unsub;
   }, [artwork]); // artwork changes → re-subscribe → infinite loop

   // ✅ GOOD - Only subscribe when ID changes
   useEffect(() => {
     const unsub = subscribeToArtwork(artworkId, setArtwork);
     return unsub;
   }, [artworkId]);
   ```

---

## Cost Optimization

### Firestore Charges:

- **Initial subscription:** 1 read per document
- **Each update:** 1 read per changed document
- **No charges** when offline or no changes

### Optimization Tips:

1. **Use limits:** Don't subscribe to thousands of documents
2. **Conditional subscriptions:** Only subscribe when visible
3. **Shared subscriptions:** Use Context for global data
4. **Paginate:** Load more on scroll, not all at once

---

## How Big Apps Like Instagram Do It

### Instagram/Facebook/Twitter Architecture:

1. **WebSockets** - Persistent bidirectional connection
2. **GraphQL Subscriptions** - Real-time query subscriptions
3. **Optimistic UI** - Show changes immediately, sync later
4. **Edge Caching** - CDN for global low-latency
5. **Push Notifications** - Wake app for critical updates

### Your Implementation (Firebase):

1. ✅ **WebSockets** - Built into Firestore (`onSnapshot`)
2. ✅ **Real-time Queries** - Query subscriptions with filters
3. ✅ **Auto-sync** - Firebase handles offline/online sync
4. ✅ **Global CDN** - Firebase's infrastructure
5. ✅ **Scalable** - Handles millions of concurrent connections

**You're using the same core technology as big apps!** Firebase is built by Google and powers apps with billions of users.

---

## Testing Real-Time Updates

### Test Scenario:

1. Open app in two browser windows
2. Log in as different users
3. User A likes an artwork
4. User B sees the like count increase **instantly**
5. User A follows User B
6. User B sees follower count increase **instantly**

### Debug Logging:

```tsx
const unsubscribe = subscribeToArtwork(artworkId, (artwork) => {
  console.log("🔄 Real-time update received:", artwork);
});
```

---

## Summary

- ✅ All database updates now reflect instantly across all users
- ✅ No manual refresh needed
- ✅ Same technology as Instagram, Facebook, Twitter
- ✅ Built on Firebase's production-grade infrastructure
- ✅ Handles millions of concurrent users
- ✅ Automatic offline support and sync
- ✅ Simple hooks and service functions available

**Your app now has enterprise-level real-time capabilities!** 🚀
