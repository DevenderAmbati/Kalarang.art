# Firebase Cost Optimization Guide - Kalarang.art

> **Last Updated:** March 2026  
> **Target Users:** 10,000 Monthly Active Users  
> **Currency:** Indian Rupees (₹) | Exchange Rate: ₹83/USD

---

## 📊 Current Cost Estimate (10K Users)

| Service | Monthly Cost (USD) | Monthly Cost (₹) |
|---------|-------------------|------------------|
| **Firestore Database** | $22 | ₹1,826 |
| **Firebase Storage** | $60 | ₹4,980 |
| **Authentication** | $0 | ₹0 |
| **Cloud Functions** | $0 | ₹0 |
| **Cloud Messaging (FCM)** | $0 | ₹0 |
| **Hosting** | $6 | ₹498 |
| **TOTAL** | **$88** | **₹7,304** |

---

## 📈 Cost Scaling Projection

| Monthly Active Users | Est. Monthly Cost (USD) | Est. Monthly Cost (₹) |
|---------------------|-------------------------|----------------------|
| 1,000 | $15 | ₹1,245 |
| 5,000 | $50 | ₹4,150 |
| **10,000** | **$88** | **₹7,304** |
| 25,000 | $180 | ₹14,940 |
| 50,000 | $350 | ₹29,050 |
| 100,000 | $700 | ₹58,100 |

---

## 🎯 Cost Optimization Recommendations

### Priority 1: Image Compression (High Impact)

**Current Issue:** Raw images uploaded without compression  
**Potential Savings:** 50-70% on Storage bandwidth costs (~₹2,500/month)

#### Implementation

```typescript
// src/utils/imageCompression.ts
import imageCompression from 'browser-image-compression';

export const compressImage = async (file: File): Promise<File> => {
  const options = {
    maxSizeMB: 1,           // Max 1MB
    maxWidthOrHeight: 1920, // Max dimension
    useWebWorker: true,
    fileType: 'image/webp', // WebP = 30% smaller than JPEG
  };
  
  return await imageCompression(file, options);
};
```

**Install dependency:**
```bash
npm install browser-image-compression
```

**Usage in artwork upload:**
```typescript
// Before uploading to Firebase Storage
const compressedFile = await compressImage(originalFile);
const uploadTask = uploadBytes(storageRef, compressedFile);
```

---

### Priority 2: Aggressive Caching (High Impact)

**Current Issue:** Cache TTL may be too short  
**Potential Savings:** 40-60% on Firestore reads (~₹730/month)

#### Recommended Cache Configuration

```typescript
// src/utils/cache.ts - Update TTL values

export const CACHE_TTL = {
  // Stable data - longer cache
  artworkDetails: 30 * 60 * 1000,    // 30 minutes
  userProfile: 30 * 60 * 1000,        // 30 minutes
  artistPortfolio: 15 * 60 * 1000,    // 15 minutes
  
  // Semi-dynamic data - moderate cache
  homeFeed: 5 * 60 * 1000,            // 5 minutes
  explorePage: 5 * 60 * 1000,         // 5 minutes
  
  // Dynamic data - short cache
  stories: 2 * 60 * 1000,             // 2 minutes
  notifications: 1 * 60 * 1000,       // 1 minute
  chatMessages: 30 * 1000,            // 30 seconds
};
```

#### Implement Stale-While-Revalidate Pattern

```typescript
export const useCachedData = <T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number
) => {
  const [data, setData] = useState<T | null>(null);
  
  useEffect(() => {
    const cached = getFromCache(key);
    const isStale = isCacheStale(key, ttl);
    
    // Show cached data immediately
    if (cached) {
      setData(cached);
    }
    
    // Revalidate in background if stale
    if (!cached || isStale) {
      fetcher().then(freshData => {
        setData(freshData);
        saveToCache(key, freshData);
      });
    }
  }, [key]);
  
  return data;
};
```

---

### Priority 3: Batch View Count Updates (Medium Impact)

**Current Issue:** Every artwork view = 1 Firestore write  
**Potential Savings:** 80% on view count writes (~₹900/month)

#### Implementation: Batch Updates Every 30 Seconds

```typescript
// src/utils/viewTracker.ts

class ViewTracker {
  private pendingViews: Map<string, number> = new Map();
  private flushInterval: NodeJS.Timer | null = null;

  constructor() {
    this.startFlushInterval();
  }

  trackView(artworkId: string) {
    const current = this.pendingViews.get(artworkId) || 0;
    this.pendingViews.set(artworkId, current + 1);
  }

  private startFlushInterval() {
    this.flushInterval = setInterval(() => {
      this.flushViews();
    }, 30000); // Every 30 seconds
  }

  private async flushViews() {
    if (this.pendingViews.size === 0) return;

    const batch = writeBatch(db);
    
    this.pendingViews.forEach((count, artworkId) => {
      const ref = doc(db, 'artworks', artworkId);
      batch.update(ref, {
        views: increment(count)
      });
    });

    await batch.commit();
    this.pendingViews.clear();
  }
}

export const viewTracker = new ViewTracker();
```

---

### Priority 4: Lazy Load Real-time Listeners (Medium Impact)

**Current Issue:** Chat listeners active even when not viewing chats  
**Potential Savings:** 20-30% on Firestore reads (~₹365/month)

#### Implementation

```typescript
// Only subscribe to chat when ChatPage is mounted
const ChatPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  
  useEffect(() => {
    // Subscribe only when component mounts
    const unsubscribe = onSnapshot(
      query(collection(db, 'chats', chatId, 'messages'), 
            orderBy('createdAt', 'desc'),
            limit(50)),
      (snapshot) => {
        setMessages(snapshot.docs.map(d => d.data()));
      }
    );
    
    // Cleanup when component unmounts
    return () => unsubscribe();
  }, [chatId]);
  
  return <MessageList messages={messages} />;
};
```

---

### Priority 5: CDN Caching Headers (Low Effort, High Impact)

**Current Issue:** Images may not leverage browser caching  
**Potential Savings:** 30-40% on Storage bandwidth (~₹1,500/month)

#### Update Firebase Storage Rules

```javascript
// storage.rules - Add caching metadata

rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /artworks/{allPaths=**} {
      allow read: if true;
      // Set on upload: cacheControl: 'public, max-age=31536000'
    }
  }
}
```

#### Set Cache-Control on Upload

```typescript
// When uploading artwork images
const metadata: UploadMetadata = {
  contentType: 'image/webp',
  cacheControl: 'public, max-age=31536000', // 1 year cache
};

await uploadBytes(storageRef, compressedFile, metadata);
```

---

### Priority 6: Pagination & Virtual Scrolling (Medium Impact)

**Current Issue:** Loading too many artworks at once  
**Potential Savings:** 20% on Firestore reads (~₹365/month)

#### Implement Virtual Scrolling for Explore Page

```bash
npm install react-window
```

```typescript
import { FixedSizeGrid as Grid } from 'react-window';

const ExploreGrid: React.FC = () => {
  return (
    <Grid
      columnCount={3}
      rowCount={Math.ceil(artworks.length / 3)}
      columnWidth={300}
      rowHeight={300}
      height={window.innerHeight}
      width={window.innerWidth}
    >
      {({ columnIndex, rowIndex, style }) => (
        <div style={style}>
          <ArtworkCard artwork={artworks[rowIndex * 3 + columnIndex]} />
        </div>
      )}
    </Grid>
  );
};
```

---

### Priority 7: Optimize Firestore Queries (Low Impact)

**Potential Savings:** 10% on Firestore reads (~₹180/month)

#### Use Projection to Fetch Only Required Fields

```typescript
// Instead of fetching entire artwork document
const artwork = await getDoc(doc(db, 'artworks', id));

// Create summary collection with minimal fields
// artworks_summary: { id, title, thumbnailUrl, artistName, likes }
const summary = await getDoc(doc(db, 'artworks_summary', id));
```

#### Create Composite Indexes for Common Queries

```json
// firestore.indexes.json
{
  "indexes": [
    {
      "collectionGroup": "artworks",
      "fields": [
        { "fieldPath": "isPublic", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

---

## 💰 Estimated Savings Summary

| Optimization | Monthly Savings (₹) | Implementation Effort |
|--------------|--------------------|-----------------------|
| Image Compression | ₹2,500 | Medium (2-3 hours) |
| Aggressive Caching | ₹730 | Low (1 hour) |
| Batch View Updates | ₹900 | Medium (2 hours) |
| Lazy Load Listeners | ₹365 | Low (1 hour) |
| CDN Cache Headers | ₹1,500 | Low (30 min) |
| Pagination/Virtual Scroll | ₹365 | Medium (3 hours) |
| Query Optimization | ₹180 | High (4-5 hours) |
| **TOTAL POTENTIAL SAVINGS** | **₹6,540** | ~14 hours |

---

## 📉 Optimized Cost Projection

| Users | Before Optimization (₹) | After Optimization (₹) | Savings |
|-------|-------------------------|------------------------|---------|
| 10K | ₹7,304 | ₹2,075 | 72% |
| 50K | ₹29,050 | ₹8,300 | 71% |
| 100K | ₹58,100 | ₹16,600 | 71% |

---

## 🚀 Implementation Roadmap

### Week 1: Quick Wins
- [ ] Update cache TTL configuration
- [ ] Add CDN cache headers to storage uploads
- [ ] Install and configure image compression

### Week 2: Core Optimizations  
- [ ] Implement view count batching
- [ ] Add lazy loading for chat listeners
- [ ] Optimize existing Firestore queries

### Week 3: Advanced
- [ ] Implement virtual scrolling
- [ ] Create summary collections for list views
- [ ] Add composite indexes

---

## 📊 Monitoring & Alerts

### Set Up Firebase Budget Alerts

1. Go to Google Cloud Console → Billing → Budgets
2. Create budget: ₹10,000/month
3. Set alerts at: 50%, 75%, 90%, 100%

### Monitor Usage in Firebase Console

```
Firebase Console → Usage and billing → Usage
```

Key metrics to track:
- Firestore reads/writes per day
- Storage bandwidth (GB downloaded)
- Cloud Functions invocations

---

## ⚠️ Cost Risk Factors

| Risk | Mitigation |
|------|------------|
| Viral artwork causing read spikes | Implement rate limiting on popular content |
| Bot/spam attacks | Add reCAPTCHA and rate limiting |
| Unoptimized queries in new features | Code review checklist for Firestore usage |
| Large file uploads | Enforce max file size (5MB) + compression |

---

## 📞 Support Resources

- [Firebase Pricing Calculator](https://firebase.google.com/pricing)
- [Firestore Best Practices](https://firebase.google.com/docs/firestore/best-practices)
- [Storage Optimization Guide](https://firebase.google.com/docs/storage/web/start)

---

*Generated for Kalarang.art - Art Portfolio Platform*
