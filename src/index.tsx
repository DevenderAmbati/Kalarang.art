import React from 'react';
import ReactDOM from 'react-dom/client';
import './colorpalette.css';
import './index.css';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';
import { isNativeApp } from './utils/platform';
import { initNativeApp } from './native/nativeApp';

// iOS Safari/PWA overscroll bounce prevention
const preventIOSBounce = () => {
  // Only apply for iOS devices
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  
  if (!isIOS) return;

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
root.render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);

if (isNativeApp()) {
  // Native (Capacitor) shell: no PWA service worker; wire up native UX instead.
  initNativeApp();
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
