# Home Feed System

## Goal

Build an Instagram-like home feed that:

- Prioritizes unseen posts from followed artists
- Keeps feed fresh with discover content
- Tracks seen state reliably
- Avoids empty-feed situations

---

## 1) Feed Structure

### If user follows artists

1. Show **Top 12 unseen posts** from followed artists
2. Show **"You're all caught up"**
3. Show **Discover feed**
4. Mix remaining unseen posts gradually into discover

### If user follows no artists

1. Optional compact **Follow artists** button (no explanatory copy)
2. Show **Discover feed only**

---

## 2) Unseen Prioritization

A post is considered unseen when there is no entry in `post_views` for `(userId, postId)`.

### Ranking

Unseen followed posts are sorted by:

- `score DESC` (primary)
- `createdAt DESC` (tie-break)

Then limited to **12** for the top unseen section.

---

## 3) Seen Tracking Logic

A post is marked as seen when either condition is met:

### A) Viewport condition

- At least **60% visible**
- User stays for at least **1.5 seconds**

### B) Interaction condition (instant)

- Like
- Comment
- Open post/card
- Click artist profile
- Add to favorites

Duplicate seen writes are prevented per post.

---

## 4) Frontend Implementation

### Hook

`usePostSeen(postId, onSeen)`

- Uses `IntersectionObserver`
- `threshold: 0.6`
- Delayed mark with `1500ms`
- Guards against duplicate callbacks

### Seen service

`postViewService`:

- Keeps local seen cache
- Debounces network writes
- Supports immediate write for interactions
- Avoids re-marking already seen posts

---

## 5) Backend API

## POST `/post/view`

Request body:

```json
{
  "userId": "string",
  "postId": "string"
}
```

Write target:

- Collection: `post_views`
- Fields:
  - `userId`
  - `postId`
  - `seenAt`

Uniqueness:

- Unique `(userId, postId)` behavior is enforced using deterministic doc ID:
  - `{userId}__{postId}`

---

## 6) Feed Query Logic

1. Fetch unseen followed posts and rank
2. Take top 12 unseen
3. Fetch discover posts (featured/trending/recent source)
4. Keep remaining unseen posts for gradual injection

---

## 7) Feed Render Order

1. `[Top 12 unseen posts]` (no section headings in UI)
2. `[Discover + mixed remaining unseen posts]`

---

## 8) Mixing Logic

While rendering discover feed:

- After every **3-4 discover posts**, insert **1 remaining unseen post**

Current strategy alternates gap pattern: `3, 4, 3, 4, ...`

---

## 9) Edge Cases

- **Unseen < 12**: show all unseen + still show caught-up marker
- **Unseen = 0**: skip unseen block and show discover directly
- **No follows**: show follow suggestion + discover only

---

## 10) Performance Notes

- Debounced seen writes
- Immediate writes only for explicit interactions
- Local de-dupe to avoid duplicate API calls
- Discover pagination + infinite scroll
- Optional future: batch seen writes in a single request

---

## Files Added/Updated

- `src/services/homeFeedService.ts`
- `src/services/postViewService.ts`
- `src/hooks/usePostSeen.ts`
- `src/pages/feed/HomeFeed.tsx`
- `src/components/Artwork/ArtworkCard.tsx`
- `src/pages/feed/homeFeed.css`
- `functions/index.js`
- `firestore.rules`
- `firestore.indexes.json`

