# Real-Time Updates - Quick Reference

## 🚀 Quick Start

### Option 1: Use Hooks (Simplest)

```tsx
import { useRealtimeDocument } from "../hooks/useRealtimeDocument";

const { data, loading, error } = useRealtimeDocument("artworks", artworkId);
```

### Option 2: Service Functions

```tsx
import { subscribeToArtwork } from "../services/artworkService";

useEffect(() => {
  const unsubscribe = subscribeToArtwork(artworkId, setArtwork);
  return () => unsubscribe(); // MUST cleanup!
}, [artworkId]);
```

---

## 📚 Available Hooks

| Hook                    | Purpose           | Usage                                        |
| ----------------------- | ----------------- | -------------------------------------------- |
| `useRealtimeDocument`   | Single document   | `useRealtimeDocument('users', userId)`       |
| `useRealtimeCollection` | Entire collection | `useRealtimeCollection('artworks')`          |
| `useRealtimeQuery`      | With filters      | `useRealtimeQuery('artworks', [where(...)])` |

---

## 🎨 Artwork Functions

| Function                                                 | Updates When                         |
| -------------------------------------------------------- | ------------------------------------ |
| `subscribeToArtwork(id, onUpdate)`                       | Artwork changes (likes, title, etc.) |
| `subscribeToArtistArtworks(userId, published, onUpdate)` | Artist adds/removes artworks         |
| `subscribeToPublishedArtworks(limit, onUpdate)`          | New artworks published               |
| `subscribeToFollowingArtworks(ids, limit, onUpdate)`     | Followed artists publish             |

---

## 👤 User Functions

| Function                                   | Updates When                               |
| ------------------------------------------ | ------------------------------------------ |
| `subscribeToUserProfile(userId, onUpdate)` | Profile changes (avatar, bio, etc.)        |
| `subscribeToUserStats(userId, onUpdate)`   | Followers/following/artworks count changes |
| `subscribeToFollowers(userId, onUpdate)`   | New follower added/removed                 |
| `subscribeToFollowing(userId, onUpdate)`   | User follows/unfollows someone             |

---

## ❤️ Interaction Functions

| Function                                                 | Updates When               |
| -------------------------------------------------------- | -------------------------- |
| `subscribeToLikeStatus(userId, artworkId, onUpdate)`     | User likes/unlikes         |
| `subscribeToFavoriteStatus(userId, artworkId, onUpdate)` | User favorites/unfavorites |
| `subscribeToFollowStatus(userId, artistId, onUpdate)`    | User follows/unfollows     |
| `subscribeToArtworkLikes(artworkId, onUpdate)`           | Anyone likes artwork       |

---

## ✅ Checklist for Every Component

```tsx
function MyComponent() {
  // 1. State for data
  const [data, setData] = useState(null);

  // 2. Subscribe in useEffect
  useEffect(() => {
    const unsubscribe = subscribeToArtwork(id, setData);

    // 3. ALWAYS cleanup!
    return () => unsubscribe();
  }, [id]); // 4. Depend on ID only

  // 5. Handle loading
  if (!data) return <div>Loading...</div>;

  return <div>{data.title}</div>;
}
```

---

## ⚠️ Common Mistakes

### ❌ Forgetting Cleanup

```tsx
useEffect(() => {
  subscribeToArtwork(id, setArtwork); // Memory leak!
}, [id]);
```

### ✅ Correct

```tsx
useEffect(() => {
  const unsub = subscribeToArtwork(id, setArtwork);
  return () => unsub(); // Cleanup!
}, [id]);
```

### ❌ Wrong Dependencies

```tsx
useEffect(() => {
  const unsub = subscribeToArtwork(artwork.id, setArtwork);
  return () => unsub();
}, [artwork]); // Re-subscribes on every change!
```

### ✅ Correct

```tsx
useEffect(() => {
  const unsub = subscribeToArtwork(artworkId, setArtwork);
  return () => unsub();
}, [artworkId]); // Only when ID changes
```

---

## 💰 Cost Tips

- Firestore charges **1 read per update**
- Use `limit()` to reduce reads
- Only subscribe when component visible
- Share subscriptions via Context

---

## 🧪 Test It

1. Open two browsers
2. Different users
3. One user likes → Other sees instantly! ✨

---

## 📖 Full Documentation

See [REALTIME_UPDATES_GUIDE.md](./REALTIME_UPDATES_GUIDE.md) for complete examples and best practices.
