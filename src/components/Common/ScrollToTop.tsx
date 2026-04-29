import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

function resetAllScrollContainers() {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;

  const selectors = [
    '.landing-content',
    '.home-main-content',
    '.about-main-content',
    '.legal-container',
    '.home-container',
    '.about-container',
    '.login-left-section',
  ];
  selectors.forEach((s) => {
    document.querySelectorAll<HTMLElement>(s).forEach((el) => {
      el.scrollTop = 0;
    });
  });
}

/**
 * Scrolls to top on route change.
 * Prevents scroll position from persisting when navigating between pages.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();
  const prevPathnameRef = useRef<string | null>(null);

  useEffect(() => {
    const forceTopRoutes = new Set(['/', '/about', '/privacy', '/terms']);

    if (forceTopRoutes.has(pathname)) {
      resetAllScrollContainers();
      setTimeout(resetAllScrollContainers, 50);
    }

    const prev = prevPathnameRef.current;
    prevPathnameRef.current = pathname;

    const isShellTab = (p: string | null) =>
      p === '/home' ||
      p === '/discover' ||
      p === '/favourites' ||
      p === '/commissions' ||
      p === '/post';
    const isCard = (p: string | null) => !!p && p.startsWith('/card/');

    if (!prev) return;
    if (isCard(pathname) || isCard(prev) || (isShellTab(pathname) && isShellTab(prev))) {
      return;
    }

    resetAllScrollContainers();
  }, [pathname]);

  return null;
}
