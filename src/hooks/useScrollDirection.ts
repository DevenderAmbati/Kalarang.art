import { useEffect, useRef, useState } from 'react';

/**
 * Returns `true` when the user is scrolling down (tabs should hide)
 * and `false` when scrolling up (tabs should reappear).
 *
 * Attaches to the closest ancestor with `overflow-y: auto|scroll`
 * (the Layout inner-scroll container) by walking up from `anchorRef`.
 *
 * @param threshold Minimum scroll delta before toggling (prevents jitter)
 */
export function useScrollDirection(threshold = 8): {
  hidden: boolean;
  anchorRef: React.RefObject<HTMLDivElement | null>;
} {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [hidden, setHidden] = useState(false);
  const lastScrollTop = useRef(0);
  const accumulated = useRef(0);

  useEffect(() => {
    const findScrollParent = (el: HTMLElement | null): HTMLElement | null => {
      let node = el?.parentElement ?? null;
      while (node) {
        const style = window.getComputedStyle(node);
        if (
          style.overflowY === 'auto' ||
          style.overflowY === 'scroll'
        ) {
          return node;
        }
        node = node.parentElement;
      }
      return null;
    };

    const container = findScrollParent(anchorRef.current);
    if (!container) return;

    lastScrollTop.current = container.scrollTop;

    const onScroll = () => {
      const current = container.scrollTop;
      const delta = current - lastScrollTop.current;
      lastScrollTop.current = current;

      if (current <= 10) {
        setHidden(false);
        accumulated.current = 0;
        return;
      }

      if ((delta > 0 && accumulated.current < 0) || (delta < 0 && accumulated.current > 0)) {
        accumulated.current = 0;
      }
      accumulated.current += delta;

      if (accumulated.current > threshold) {
        setHidden(true);
        accumulated.current = 0;
      } else if (accumulated.current < -threshold) {
        setHidden(false);
        accumulated.current = 0;
      }
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, [threshold]);

  return { hidden, anchorRef };
}
