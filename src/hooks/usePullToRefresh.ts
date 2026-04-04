import { useEffect, useRef, useCallback, useState } from 'react';

interface PullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  isRealtimeActive?: boolean;
  pullThreshold?: number;
  debounceDuration?: number;
  maxPullDistance?: number;
  containerReady?: boolean;
}

export interface PullToRefreshState {
  pullDistance: number;
  isTriggered: boolean;
  isRefreshing: boolean;
  isEnabled: boolean;
  isResetting: boolean;
}

/**
 * Custom hook for pull-to-refresh on mobile devices
 */
export function usePullToRefresh(
  containerRef: React.RefObject<HTMLElement | null>,
  options: PullToRefreshOptions
): PullToRefreshState {
  const {
    onRefresh,
    isRealtimeActive = false,
    pullThreshold = 80,
    debounceDuration = 300,
    maxPullDistance = 120,
    containerReady = true,
  } = options;

  const [pullDistance, setPullDistance] = useState(0);
  const [isTriggered, setIsTriggered] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Use refs for tracking to avoid re-renders during touch
  const touchStartY = useRef<number>(-1);
  const lastRefreshTime = useRef<number>(0);
  const isTouchDevice = useRef<boolean>(false);
  const isPulling = useRef<boolean>(false);
  const currentPullDistance = useRef<number>(0);

  // Check if device supports touch
  useEffect(() => {
    isTouchDevice.current = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }, []);

  const isEnabled = isTouchDevice.current && !isRealtimeActive && !isRefreshing;

  const resetPull = useCallback(() => {
    setIsResetting(true);
    setPullDistance(0);
    setIsTriggered(false);
    isPulling.current = false;
    currentPullDistance.current = 0;
    setTimeout(() => setIsResetting(false), 500);
  }, []);

  const performRefresh = useCallback(async () => {
    const now = Date.now();
    if (now - lastRefreshTime.current < debounceDuration) {
      resetPull();
      return;
    }

    lastRefreshTime.current = now;
    setIsRefreshing(true);

    try {
      await onRefresh();
    } catch {
      // onRefresh failed; ignore
    } finally {
      setIsRefreshing(false);
      resetPull();
    }
  }, [debounceDuration, onRefresh, resetPull]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !containerReady || !isEnabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Only activate when at the very top
      if (container.scrollTop <= 0) {
        touchStartY.current = e.touches[0].clientY;
        isPulling.current = false;
      } else {
        touchStartY.current = -1;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      // Skip if not at top or refreshing
      if (touchStartY.current < 0 || isRefreshing) return;
      
      // If scrolled away from top, cancel immediately
      if (container.scrollTop > 0) {
        touchStartY.current = -1;
        if (isPulling.current) {
          isPulling.current = false;
          currentPullDistance.current = 0;
          setPullDistance(0);
          setIsTriggered(false);
        }
        return;
      }

      const currentY = e.touches[0].clientY;
      const pullDelta = currentY - touchStartY.current;

      // Handle pull-down gesture
      if (pullDelta > 0) {
        // Only prevent default and start tracking after 15px threshold
        if (pullDelta > 15) {
          e.preventDefault();
          isPulling.current = true;
          
          const resistance = 0.5;
          const resistedDistance = Math.min(pullDelta * resistance, maxPullDistance);
          currentPullDistance.current = resistedDistance;
          
          setPullDistance(resistedDistance);
          setIsTriggered(resistedDistance >= pullThreshold);
        }
      } else if (pullDelta < -5) {
        // User swiping up, cancel pull-to-refresh
        touchStartY.current = -1;
        if (isPulling.current) {
          isPulling.current = false;
          currentPullDistance.current = 0;
          setPullDistance(0);
          setIsTriggered(false);
        }
      }
    };

    const handleTouchEnd = () => {
      if (touchStartY.current < 0 || !isPulling.current) {
        touchStartY.current = -1;
        return;
      }

      if (currentPullDistance.current >= pullThreshold && !isRefreshing) {
        performRefresh();
      } else {
        resetPull();
      }

      touchStartY.current = -1;
    };

    // Use passive: true for touchstart and touchend for better scroll performance
    // touchmove needs passive: false to allow preventDefault when pulling
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    container.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [containerRef, containerReady, isEnabled, isRefreshing, pullThreshold, maxPullDistance, performRefresh, resetPull]);

  return {
    pullDistance,
    isTriggered,
    isRefreshing,
    isEnabled,
    isResetting,
  };
}
