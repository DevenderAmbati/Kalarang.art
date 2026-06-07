import { useCallback, useEffect, useRef } from "react";

interface UsePostSeenParams {
  postId: string;
  onSeen: (postId: string) => void | Promise<void>;
  enabled?: boolean;
  isAlreadySeen?: boolean;
  threshold?: number;
  delayMs?: number;
}

export function usePostSeen({
  postId,
  onSeen,
  enabled = true,
  isAlreadySeen = false,
  threshold = 0.6,
  delayMs = 1500,
}: UsePostSeenParams) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasMarkedRef = useRef<boolean>(isAlreadySeen);

  useEffect(() => {
    hasMarkedRef.current = isAlreadySeen;
  }, [isAlreadySeen, postId]);

  const markSeen = useCallback(() => {
    if (!enabled || hasMarkedRef.current) return;
    hasMarkedRef.current = true;
    void onSeen(postId);
  }, [enabled, onSeen, postId]);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    const target = elementRef.current;
    if (!enabled || !target || hasMarkedRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry) return;

        if (entry.isIntersecting && entry.intersectionRatio >= threshold) {
          if (!timeoutRef.current && !hasMarkedRef.current) {
            timeoutRef.current = setTimeout(() => {
              markSeen();
              clearTimer();
            }, delayMs);
          }
          return;
        }

        clearTimer();
      },
      { threshold: [threshold] }
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
      clearTimer();
    };
  }, [clearTimer, delayMs, enabled, markSeen, postId, threshold]);

  return {
    containerRef: elementRef,
    markSeenFromInteraction: markSeen,
  };
}
