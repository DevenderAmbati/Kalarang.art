import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Scrolls to top on route change.
 * Prevents scroll position from persisting when navigating between pages.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();
  const prevPathnameRef = useRef<string | null>(null);

  useEffect(() => {
    const prev = prevPathnameRef.current;
    prevPathnameRef.current = pathname;

    // The app uses independent inner scroll containers for feed + artwork.
    // Don't force window scroll reset when transitioning between those routes,
    // otherwise back-navigation feels like it jumps to the top.
    const isHomeFeed = (p: string | null) => p === '/home' || p === '/discover' || p === '/favourites';
    const isCard = (p: string | null) => !!p && p.startsWith('/card/');

    if (!prev) return;
    if (isCard(pathname) || isCard(prev) || (isHomeFeed(pathname) && isHomeFeed(prev))) {
      return;
    }

    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
