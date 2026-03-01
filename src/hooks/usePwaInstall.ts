import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const PERMANENT_DISMISS_KEY = 'kalarang-pwa-install-never';

let deferredPromptGlobal: BeforeInstallPromptEvent | null = null;
let listeners: Array<() => void> = [];

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPromptGlobal = e as BeforeInstallPromptEvent;
    notifyListeners();
  });

  window.addEventListener('appinstalled', () => {
    deferredPromptGlobal = null;
    notifyListeners();
  });
}

export function isPermanentlyDismissed(): boolean {
  return localStorage.getItem(PERMANENT_DISMISS_KEY) === 'true';
}

export function isAppInstalled(): boolean {
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  if ((window.navigator as any).standalone === true) return true;
  return false;
}

export function usePwaInstall() {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const listener = () => forceUpdate((n) => n + 1);
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((fn) => fn !== listener);
    };
  }, []);

  const canInstall = deferredPromptGlobal !== null && !isAppInstalled();

  const triggerInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPromptGlobal) return false;

    await deferredPromptGlobal.prompt();
    const { outcome } = await deferredPromptGlobal.userChoice;

    deferredPromptGlobal = null;
    notifyListeners();
    return outcome === 'accepted';
  }, []);

  const dismissPermanently = useCallback(() => {
    localStorage.setItem(PERMANENT_DISMISS_KEY, 'true');
    notifyListeners();
  }, []);

  const shouldShowPrompt = canInstall && !isPermanentlyDismissed() && !isAppInstalled();

  return {
    canInstall,
    shouldShowPrompt,
    triggerInstall,
    dismissPermanently,
    isInstalled: isAppInstalled(),
  };
}
