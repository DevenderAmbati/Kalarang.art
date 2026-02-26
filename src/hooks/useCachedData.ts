import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { cache, cacheKeys, cacheTimes } from '../utils/cache';

interface UseCachedDataOptions<T> {
  cacheKey: string;
  fetchFn: () => Promise<T>;
  staleTime?: number;
  cacheTime?: number;
  enabled?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

interface UseCachedDataResult<T> {
  data: T | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  isStale: boolean;
  refetch: () => Promise<void>;
  invalidate: () => void;
  updateCache: (updater: (oldData: T | null) => T | null) => void;
}

export type { UseCachedDataResult };

/**
 * Custom hook for cached data fetching with stale-while-revalidate pattern
 */
export function useCachedData<T>({
  cacheKey,
  fetchFn,
  staleTime = 5 * 60 * 1000,
  cacheTime = 10 * 60 * 1000,
  enabled = true,
  onSuccess,
  onError,
}: UseCachedDataOptions<T>): UseCachedDataResult<T> {
  // Initialize with cache if it exists
  const initialCache = cache.get<T>(cacheKey);
  const [data, setData] = useState<T | null>(initialCache.exists ? initialCache.data : null);
  const [isLoading, setIsLoading] = useState(!initialCache.exists || initialCache.isStale);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isStale, setIsStale] = useState(initialCache.isStale);
  
  const isMountedRef = useRef(true);
  const fetchingRef = useRef(false);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const dataRef = useRef(data);
  const fetchFnRef = useRef(fetchFn);

  // Update refs when callbacks change
  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
    dataRef.current = data;
    fetchFnRef.current = fetchFn;
  }, [onSuccess, onError, data, fetchFn]);

  const fetchData = useCallback(async (skipCache = false) => {
    if (fetchingRef.current) return;
    
    fetchingRef.current = true;

    try {
      if (!skipCache) {
        // Try to get from cache first
        const cached = cache.get<T>(cacheKey);
        
        if (cached.exists && cached.data) {
          if (isMountedRef.current) {
            setData(cached.data);
            setIsStale(cached.isStale);
            setIsLoading(false);
            setIsError(false);
            setError(null);
          }

          // If data is NOT stale, don't fetch
          if (!cached.isStale) {
            fetchingRef.current = false;
            console.log('[Cache] Using cached data for:', cacheKey);
            return;
          }
          // If data IS stale, continue to fetch in background
          console.log('[Cache] Background refresh for stale data:', cacheKey);
        }
      }

      // Only show loading if we don't have any data yet
      if (!dataRef.current && isMountedRef.current) {
        setIsLoading(true);
      }

      console.log('[API] Fetching fresh data for:', cacheKey);
      // Fetch fresh data
      const freshData = await fetchFnRef.current();
      
      // Cache the fresh data
      cache.set(cacheKey, freshData, staleTime, cacheTime);

      if (isMountedRef.current) {
        setData(freshData);
        setIsStale(false);
        setIsLoading(false);
        setIsError(false);
        setError(null);
        
        if (onSuccessRef.current) {
          onSuccessRef.current(freshData);
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      
      if (isMountedRef.current) {
        setIsError(true);
        setError(error);
        setIsLoading(false);
        
        if (onErrorRef.current) {
          onErrorRef.current(error);
        }
      }
    } finally {
      fetchingRef.current = false;
    }
  }, [cacheKey, staleTime, cacheTime]);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    await fetchData(true);
  }, [fetchData]);

  const invalidate = useCallback(() => {
    cache.invalidate(cacheKey);
    setIsStale(true);
  }, [cacheKey]);

  const updateCache = useCallback((updater: (oldData: T | null) => T | null) => {
    const newData = updater(dataRef.current);
    setData(newData);
    dataRef.current = newData;
    // Also update the cache
    if (newData !== null) {
      cache.set(cacheKey, newData, staleTime, cacheTime);
    }
  }, [cacheKey, staleTime, cacheTime]);

  useEffect(() => {
    isMountedRef.current = true;
    
    if (!enabled) {
      return;
    }

    // Check if we already have fresh cache
    const cached = cache.get<T>(cacheKey);
    
    if (cached.exists && !cached.isStale) {
      // We have fresh cache, no need to fetch at all
      console.log('[Cache] HIT - Using fresh cache for:', cacheKey);
      return;
    }
    
    // Only fetch if no cache or stale cache
    console.log('[Cache] MISS or STALE - Fetching:', cacheKey);
    fetchData();

    return () => {
      isMountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, cacheKey]); // Only re-run when enabled or cacheKey changes

  return {
    data,
    isLoading,
    isError,
    error,
    isStale,
    refetch,
    invalidate,
    updateCache,
  };
}

/**
 * Hook for fetching artworks with caching
 */
export function useArtworks(limit: number = 20) {
  const fetchFn = useCallback(async () => {
    const { getPublishedArtworks } = await import('../services/artworkService');
    return getPublishedArtworks(limit);
  }, [limit]);

  return useCachedData({
    cacheKey: cacheKeys.artworks(limit),
    fetchFn,
    staleTime: cacheTimes.artworks.staleTime,
    cacheTime: cacheTimes.artworks.cacheTime,
  });
}

/**
 * Hook for fetching a single artwork with caching
 */
export function useArtwork(id: string, enabled = true) {
  const fetchFn = useCallback(async () => {
    const { getArtwork } = await import('../services/artworkService');
    return getArtwork(id);
  }, [id]);

  return useCachedData({
    cacheKey: cacheKeys.artwork(id),
    fetchFn,
    enabled,
    staleTime: cacheTimes.artwork.staleTime,
    cacheTime: cacheTimes.artwork.cacheTime,
  });
}

/**
 * Hook for fetching user favorites with caching
 */
export function useFavorites(userId: string | undefined, enabled = true) {
  const fetchFn = useCallback(async () => {
    if (!userId) return [];
    const { getUserFavoriteArtworkIds } = await import('../services/interactionService');
    return getUserFavoriteArtworkIds(userId);
  }, [userId]);

  return useCachedData({
    cacheKey: userId ? cacheKeys.favorites(userId) : 'favorites-none',
    fetchFn,
    enabled: enabled && !!userId,
    staleTime: cacheTimes.favorites.staleTime,
    cacheTime: cacheTimes.favorites.cacheTime,
  });
}

/**
 * Hook for fetching favorite artworks with full data
 */
export function useFavoriteArtworks(userId: string | undefined, enabled = true) {
  const fetchFn = useCallback(async () => {
    if (!userId) return [];
    
    const { getUserFavoriteArtworkIds } = await import('../services/interactionService');
    const { getArtwork } = await import('../services/artworkService');
    const { db } = await import('../firebase');
    const { doc, getDoc } = await import('firebase/firestore');
    
    const favoriteIds = await getUserFavoriteArtworkIds(userId);
    
    if (favoriteIds.length === 0) return [];

    // Fetch all favorite artworks
    const artworksPromises = favoriteIds.map(id => getArtwork(id));
    const artworks = await Promise.all(artworksPromises);
    
    // Filter out any null results
    const validArtworks = artworks.filter(artwork => artwork !== null);
    
    // Get unique artist IDs
    const artistIdsSet = new Set<string>();
    validArtworks.forEach(a => artistIdsSet.add(a!.artistId));
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
    
    // Map to favorite artwork format with current artist avatars
    return validArtworks.map(artwork => ({
        id: artwork!.id,
        title: artwork!.title,
        artworkImage: artwork!.images[0],
        artistName: artwork!.artistName,
        artistAvatar: artistAvatars.get(artwork!.artistId) || artwork!.artistAvatar || '/artist.png',
        artistId: artwork!.artistId,
        price: artwork!.price,
        sold: artwork!.sold,
      }));
  }, [userId]);

  return useCachedData({
    cacheKey: userId ? cacheKeys.favoriteArtworks(userId) : 'favorite-artworks-none',
    fetchFn,
    enabled: enabled && !!userId,
    staleTime: cacheTimes.favorites.staleTime,
    cacheTime: cacheTimes.favorites.cacheTime,
  });
}

/**
 * Hook for fetching published artworks of an artist
 */
export function usePublishedWorks(userId: string | undefined, enabled = true) {
  const fetchFn = useCallback(async () => {
    if (!userId) return [];
    const { getArtistArtworks } = await import('../services/artworkService');
    return getArtistArtworks(userId, true); // Only published
  }, [userId]);

  return useCachedData({
    cacheKey: userId ? cacheKeys.publishedWorks(userId) : 'published-works-none',
    fetchFn,
    enabled: enabled && !!userId,
    staleTime: cacheTimes.portfolio.staleTime,
    cacheTime: cacheTimes.portfolio.cacheTime,
  });
}

/**
 * Hook for fetching all artworks (gallery) of an artist
 */
export function useGalleryWorks(userId: string | undefined, enabled = true) {
  const fetchFn = useCallback(async () => {
    if (!userId) return [];
    const { getArtistArtworks } = await import('../services/artworkService');
    return getArtistArtworks(userId, false); // All artworks
  }, [userId]);

  return useCachedData({
    cacheKey: userId ? cacheKeys.galleryWorks(userId) : 'gallery-works-none',
    fetchFn,
    enabled: enabled && !!userId,
    staleTime: cacheTimes.portfolio.staleTime,
    cacheTime: cacheTimes.portfolio.cacheTime,
  });
}
