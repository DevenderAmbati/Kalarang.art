import { useEffect, useRef, useState } from 'react';

export type UseScrollDirectionOptions = {
  /**
   * `ancestor` (default): walk up from `anchorRef` for a scrollport.
   * `layout`: use the visible Layout inner-scroll container — needed for
   * UI portaled to `document.body` (e.g. AI launcher).
   */
  root?: 'ancestor' | 'layout';
  /** Re-bind when this changes (e.g. route pathname for layout root). */
  resetKey?: string | number;
};

function findScrollParentFrom(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  let fallback: HTMLElement | null = null;
  while (node && node !== document.documentElement) {
    const style = window.getComputedStyle(node);
    const oy = style.overflowY;
    if (oy === 'auto' || oy === 'scroll' || oy === 'overlay') {
      if (node.scrollHeight > node.clientHeight + 1) return node;
      const ox = style.overflowX;
      // Fake scrollport: overflow-x:hidden|clip makes overflow-y compute
      // to "auto" on a height:auto box that never actually scrolls.
      if (ox !== 'hidden' && ox !== 'clip' && !fallback) {
        fallback = node;
      }
    }
    node = node.parentElement;
  }
  return fallback;
}

/** Visible Layout feed/page scroll container (skips display:none tab panes). */
function findActiveLayoutScroller(): HTMLElement | null {
  const selectors = [
    '.layout-inner-scroll--with-bottom-nav',
    '.standard-scroll-container',
    '.layout-scroll-pad-guest',
  ];
  for (const sel of selectors) {
    const nodes = document.querySelectorAll<HTMLElement>(sel);
    for (const node of nodes) {
      const style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      if (style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflowY === 'overlay') {
        return node;
      }
    }
  }

  // Fallback: first visibly scrolling descendant of main content
  const main = document.querySelector<HTMLElement>('.layout-main-content');
  if (!main) return null;
  const all = main.querySelectorAll<HTMLElement>('*');
  for (const node of all) {
    const style = window.getComputedStyle(node);
    if (style.display === 'none') continue;
    if (
      (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
      node.scrollHeight > node.clientHeight + 1
    ) {
      return node;
    }
  }
  return null;
}

/**
 * Returns `true` when the user is scrolling down (chrome should hide)
 * and `false` when scrolling up (chrome should reappear).
 *
 * @param threshold Minimum scroll delta before toggling (prevents jitter)
 */
export function useScrollDirection(
  threshold = 8,
  options: UseScrollDirectionOptions = {},
): {
  hidden: boolean;
  anchorRef: React.RefObject<HTMLDivElement | null>;
} {
  const { root = 'ancestor', resetKey } = options;
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [hidden, setHidden] = useState(false);
  const lastScrollTop = useRef(0);
  const accumulated = useRef(0);

  useEffect(() => {
    let container: HTMLElement | null = null;
    let remove: (() => void) | undefined;
    let raf = 0;
    let tries = 0;

    const attach = () => {
      container =
        root === 'layout'
          ? findActiveLayoutScroller()
          : findScrollParentFrom(anchorRef.current) ?? findActiveLayoutScroller();

      if (!container) {
        // Content may still be loading (scrollHeight not tall yet) — retry briefly.
        if (tries++ < 40) {
          raf = window.requestAnimationFrame(attach);
        }
        return;
      }

      lastScrollTop.current = container.scrollTop;
      setHidden(false);
      accumulated.current = 0;

      const onScroll = () => {
        if (!container) return;
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
      remove = () => container?.removeEventListener('scroll', onScroll);
    };

    attach();

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      remove?.();
    };
  }, [threshold, root, resetKey]);

  return { hidden, anchorRef };
}
