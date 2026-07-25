import { isNativeApp } from './platform';

/**
 * Production web / installed Kalarang PWA only.
 * Native Capacitor builds keep the full BrushOwl app from the same bundle.
 * Local `npm start` stays on the full app for development.
 *
 * Preview locally: REACT_APP_FORCE_KALARANG_MIGRATION=true
 * Force full web in prod (rare): REACT_APP_WEB_FULL_APP=true
 */
export function shouldShowKalarangMigration(): boolean {
  if (isNativeApp()) return false;
  if (process.env.REACT_APP_FORCE_KALARANG_MIGRATION === 'true') return true;
  if (process.env.NODE_ENV !== 'production') return false;
  if (process.env.REACT_APP_WEB_FULL_APP === 'true') return false;
  return true;
}

/** Google Play listing for BrushOwl. Override via REACT_APP_PLAY_STORE_URL when live. */
export function getBrushOwlPlayStoreUrl(): string | null {
  const url = process.env.REACT_APP_PLAY_STORE_URL?.trim();
  return url || null;
}
