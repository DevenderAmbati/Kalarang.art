import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import './PwaUpdatePrompt.css';

const SW_WAITING_EVENT = 'sw-waiting';

/** Only our app SW handles SKIP_WAITING. Must match exactly to ignore firebase-messaging-sw.js. */
function isAppWaitingWorker(worker: ServiceWorker | null): boolean {
  if (!worker?.scriptURL) return false;
  return worker.scriptURL.endsWith('service-worker.js');
}

/**
 * Reusable PWA update banner. Shows when a new service worker is waiting.
 * User must click "Update" to apply; no auto-refresh.
 * Banner is shown on every navigation to /home until updated, and can be dismissed with X on other pages.
 */
const PwaUpdatePrompt: React.FC = () => {
  const location = useLocation();
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const applyUpdate = useCallback(() => {
    if (!waitingWorker) return;
    const fallbackReload = setTimeout(() => window.location.reload(), 2500);
    const onControllerChange = () => {
      clearTimeout(fallbackReload);
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    setIsUpdating(true);
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  }, [waitingWorker]);

  const setWaitingWorkerIfApp = useCallback((worker: ServiceWorker | null) => {
    if (!worker || !isAppWaitingWorker(worker)) return;
    setWaitingWorker((prev) => (prev === worker ? prev : worker));
  }, []);

  // Detect waiting worker only from our app's SW (service-worker.js). Ignore firebase-messaging-sw.js.
  useEffect(() => {
    const handleWaiting = (e: Event) => {
      const detail = (e as CustomEvent<{ waitingWorker: ServiceWorker }>).detail;
      if (detail?.waitingWorker && isAppWaitingWorker(detail.waitingWorker)) {
        setWaitingWorkerIfApp(detail.waitingWorker);
      }
    };

    window.addEventListener(SW_WAITING_EVENT, handleWaiting);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const reg of registrations) {
          if (reg.waiting && isAppWaitingWorker(reg.waiting)) {
            setWaitingWorkerIfApp(reg.waiting);
            break;
          }
        }
      });
    }

    return () => window.removeEventListener(SW_WAITING_EVENT, handleWaiting);
  }, [setWaitingWorkerIfApp]);

  // When user navigates to home, show banner again (reset dismissed)
  useEffect(() => {
    if (location.pathname === '/home') {
      setDismissed(false);
    }
  }, [location.pathname]);

  // When controller changes (e.g. update applied in another tab or after reload), clear so banner doesn't reappear
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onControllerChange = () => setWaitingWorker((prev) => (prev ? null : prev));
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
  }, []);

  // Show when there's a waiting update and user hasn't dismissed. Re-show when they navigate to /home.
  const showBanner = Boolean(waitingWorker && !dismissed);

  if (!showBanner) return null;

  return (
    <div className="pwa-update-banner" role="status" aria-live="polite">
      <span className="pwa-update-banner__text">New update available</span>
      <div className="pwa-update-banner__actions">
        <button
          type="button"
          className="pwa-update-banner__btn"
          onClick={applyUpdate}
          disabled={isUpdating}
        >
          {isUpdating ? 'Installing...' : 'Install'}
        </button>
        <button
          type="button"
          className="pwa-update-banner__close"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default PwaUpdatePrompt;
