import React from 'react';
import ReactDOM from 'react-dom/client';
import './colorpalette.css';
import './index.css';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';
import { isNativeApp } from './utils/platform';
import { initNativeApp } from './native/nativeApp';
import { shouldShowKalarangMigration } from './utils/webMigration';
import KalarangMigration from './pages/landing/KalarangMigration';

// iOS Safari/PWA overscroll bounce prevention
const isIOSDevice = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// Class-gated CSS scroll lock (must not use @supports -webkit-touch-callout —
// that also matches some Android WebViews and chips the right UI edge).
if (isIOSDevice()) {
  document.documentElement.classList.add('ios-scroll-lock');
}

const preventIOSBounce = () => {
  // Only apply for iOS devices
  if (!isIOSDevice()) return;

  let startY = 0;
  
  document.addEventListener('touchstart', (e) => {
    startY = e.touches[0].pageY;
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    const rootEl = document.getElementById('root');
    if (!rootEl) return;
    
    // Find the nearest scrollable ancestor
    let target = e.target as HTMLElement | null;
    let scrollableParent: HTMLElement | null = null;
    
    while (target && target !== document.body) {
      const style = window.getComputedStyle(target);
      const overflowY = style.overflowY;
      const isScrollable = (overflowY === 'auto' || overflowY === 'scroll') && target.scrollHeight > target.clientHeight;
      
      if (isScrollable) {
        scrollableParent = target;
        break;
      }
      target = target.parentElement;
    }
    
    // If no scrollable parent, prevent default
    if (!scrollableParent) {
      // Allow if it's within #root and root is scrollable
      if (rootEl.scrollHeight > rootEl.clientHeight) {
        scrollableParent = rootEl;
      } else {
        e.preventDefault();
        return;
      }
    }
    
    const currentY = e.touches[0].pageY;
    const deltaY = currentY - startY;
    const { scrollTop, scrollHeight, clientHeight } = scrollableParent;
    
    // At the top and trying to scroll up
    if (scrollTop <= 0 && deltaY > 0) {
      e.preventDefault();
    }
    
    // At the bottom and trying to scroll down
    if (scrollTop + clientHeight >= scrollHeight && deltaY < 0) {
      e.preventDefault();
    }
  }, { passive: false });
};

// Initialize iOS bounce prevention
preventIOSBounce();

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

const showKalarangMigration = shouldShowKalarangMigration();

root.render(
  <React.StrictMode>
    {showKalarangMigration ? (
      <KalarangMigration />
    ) : (
      <AuthProvider>
        <App />
      </AuthProvider>
    )}
  </React.StrictMode>
);

if (isNativeApp()) {
  // Native (Capacitor) shell: no PWA service worker; wire up native UX instead.
  initNativeApp();
} else if (showKalarangMigration) {
  // Final Kalarang PWA update: keep SW so installed users receive this screen,
  // then leave the PWA alone — no further product updates on this channel.
  serviceWorkerRegistration.register();
} else {
  serviceWorkerRegistration.register({
    onUpdate(registration) {
      if (registration.waiting) {
        window.dispatchEvent(
          new CustomEvent('sw-waiting', { detail: { waitingWorker: registration.waiting } })
        );
      }
    },
  });
}
