# Artwork Ranking System

## Overview

Artworks in the Explore and Discover feeds are ranked by a computed `score` field
stored on each artwork document in Firestore. The score blends **recency**,
**engagement**, a **new-artist boost**, and a small **random factor** so that
fresh, popular work surfaces while giving new artists a fair chance.

Diversity (avoiding consecutive artworks by the same artist) is **not** part of
the score — it is handled on the frontend after fetching.

---

## Score Formula

```
score = 0.4 × recencyScore
      + 0.2 × engagementScore
      + 0.1 × newArtistBoost
      + 0.1 × randomBoost
```

### Components

| Component | Formula | Range | Weight |
|---|---|---|---|
| **Recency** | `exp(−hours / 24)` where `hours = (now − createdAt) / 3 600 000` | 0 → 1 (1 = just uploaded) | 0.4 |
| **Engagement** | `min(log(1 + rawEngagement), 3)` | 0 → 3 | 0.2 |
| **New Artist Boost** | `1` if artist has < 5 published artworks, else `0` | 0 or 1 | 0.1 |
| **Random Boost** | `Math.random()` | 0 → 1 | 0.1 |

**Raw Engagement** is a weighted sum of interactions:

```
rawEngagement = 1 × views + 5 × favorites + 10 × reachOutClicks
```

### Null Safety

- `views`, `favorites`, `reachOutClicks` default to `0` when missing.
- `createdAt` is assumed to always be a valid Firestore timestamp; the code
  gracefully handles `Timestamp`, `Date`, and raw millisecond numbers.

---

## Architecture

### Files

| File | Purpose |
|---|---|
| `src/utils/score.ts` | Client-side `calculateScore()` utility (shared types, same formula) |
| `functions/index.js` | Cloud Functions that write the `score` field to Firestore |
| `src/services/artworkService.ts` | Firestore queries updated to `orderBy("score", "desc")` |
| `src/types/artwork.ts` | `score` field added to the `Artwork` interface |
| `firestore.indexes.json` | Composite index: `published` ASC + `score` DESC |

### Cloud Functions

#### `onArtworkWritten`

- **Trigger:** `onDocumentWritten("artworks/{artworkId}")`
- Fires on every create/update of an artwork document.
- Watches fields: `views`, `favorites`, `reachOutClicks`, `published`, `createdAt`.
- Queries the artist's total published artworks (for the new-artist boost).
- Writes the computed `score` back to the document.
- Skips re-computation if only the `score` field changed (avoids infinite loops).

#### `recomputeArtworkScores`

- **Trigger:** Scheduled every **6 hours** via Cloud Scheduler.
- Iterates over all published artworks in batches of 500.
- Recomputes scores to reflect recency decay on artworks that haven't had
  recent engagement changes.

### Query Changes

The default (unfiltered) feed queries now use:

```ts
orderBy("score", "desc")
```

instead of `orderBy("createdAt", "desc")`.

When the user explicitly sorts by "Latest First" or by price, the query falls
back to `createdAt` / `price` ordering as before.

---

## Firestore Index

A composite index is required for the score-ordered query:

```json
{
  "collectionGroup": "artworks",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "published", "order": "ASCENDING" },
    { "fieldPath": "score",     "order": "DESCENDING" }
  ]
}
```

This is already added to `firestore.indexes.json`. Deploy indexes with:

```bash
firebase deploy --only firestore:indexes
```

---

## Deployment Checklist

1. **Deploy Firestore indexes** so the `published + score` composite index is
   created before the new queries run:
   ```bash
   firebase deploy --only firestore:indexes
   ```

2. **Deploy Cloud Functions** to start computing scores:
   ```bash
   cd functions && npm install && cd ..
   firebase deploy --only functions
   ```

3. **Backfill scores** — The scheduled function runs every 6 hours and will
   populate scores on all published artworks. To trigger it immediately, you
   can run it from the Firebase console or use:
   ```bash
   firebase functions:call recomputeArtworkScores --region us-central1
   ```

4. **Deploy the frontend** — the updated queries will order by `score` instead
   of `createdAt` for the default Explore / Discover feeds.

---

## Explore / Discover sort options

In the UI, **Featured** is the default sort. It uses `orderBy("score", "desc")`
(with a `createdAt` fallback when scores are missing). **Latest First** uses
`createdAt` only. Price sorts use the filtered query with price ordering.

---

## Tuning

To adjust the ranking behavior, modify the weights in `calculateScore`:

- Increase the **recency weight** (0.4) to favor newer artworks more.
- Increase the **engagement weight** (0.2) to favor popular artworks more.
- Change the decay constant (`24` in `exp(−hours / 24)`) — a smaller value
  makes recency decay faster.
- Adjust the **new-artist threshold** (currently < 5 published artworks).
