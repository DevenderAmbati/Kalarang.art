import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

/**
 * One-time native setup for the Capacitor shell. Safe to call only when
 * running natively (guarded by the caller). Each step is defensive so a
 * missing capability never blocks app startup.
 */
export function initNativeApp(): void {
  document.title = 'BrushOwl';
  // Match the transparent status-bar region to the header (Android 15+/16
  // ignores StatusBar.setBackgroundColor; the strip shows the page/window bg).
  document.documentElement.style.backgroundColor = '#E8F4F5';
  document.body.style.backgroundColor = '#E8F4F5';
  // Keep the document box tied to the layout width (not 100vw) so fixed
  // chrome cannot chip past the visible right edge on some Android WebViews.
  document.documentElement.style.width = '100%';
  document.documentElement.style.maxWidth = '100%';
  document.documentElement.style.overflowX = 'hidden';
  document.body.style.width = '100%';
  document.body.style.maxWidth = '100%';
  document.body.style.overflowX = 'hidden';
  setupStatusBar();
  setupBackButton();
  setupPushTapNavigation();
  hideSplash();
}

async function setupStatusBar(): Promise<void> {
  try {
    // Dark icons/text over the light header. On Android 15+/16 (targetSdk 36),
    // setBackgroundColor / setOverlaysWebView are no-ops — color comes from the
    // native window background in MainActivity / styles.xml instead.
    await StatusBar.setStyle({ style: Style.Light });
  } catch {
    /* status bar not available on this platform */
  }
}

function setupBackButton(): void {
  try {
    App.addListener('backButton', ({ canGoBack }) => {
      // Capacitor's canGoBack can be false even after history.pushState() for
      // drawers/sheets — always prefer SPA history when we have entries.
      const hasOverlayState =
        Boolean(window.history.state?.drawer) ||
        Boolean(window.history.state?.sheet) ||
        Boolean(window.history.state?.modal);
      if (hasOverlayState || canGoBack || window.history.length > 1) {
        window.history.back();
        return;
      }
      App.exitApp();
    });
  } catch {
    /* app plugin not available */
  }
}

/**
 * When the user taps a native push notification, route the SPA to the URL the
 * Cloud Functions payload carries in `data.url` (e.g. /card/:id, /commissions).
 * Uses history + popstate so React Router navigates client-side without a
 * full reload.
 */
async function setupPushTapNavigation(): Promise<void> {
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const url = action?.notification?.data?.url;
      if (typeof url === 'string' && url.startsWith('/')) {
        window.history.pushState({}, '', url);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    });
  } catch {
    /* push notifications not available */
  }
}

async function hideSplash(): Promise<void> {
  try {
    // The web layer renders its own splash video (#splash-screen), so hand off
    // from the native splash quickly to avoid a double/blank flash.
    await SplashScreen.hide();
  } catch {
    /* splash screen not available */
  }
}
