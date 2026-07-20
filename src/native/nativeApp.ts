import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { getPlatform } from '../utils/platform';

/**
 * One-time native setup for the Capacitor shell. Safe to call only when
 * running natively (guarded by the caller). Each step is defensive so a
 * missing capability never blocks app startup.
 */
export function initNativeApp(): void {
  setupStatusBar();
  setupBackButton();
  setupPushTapNavigation();
  hideSplash();
}

async function setupStatusBar(): Promise<void> {
  // iOS status bar cannot change its background color; only Android does.
  try {
    // Light content (white icons/text) over the dark brand background.
    await StatusBar.setStyle({ style: Style.Dark });
    if (getPlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color: '#0a132c' });
      await StatusBar.setOverlaysWebView({ overlay: false });
    }
  } catch {
    /* status bar not available on this platform */
  }
}

function setupBackButton(): void {
  try {
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack && window.history.length > 1) {
        window.history.back();
      } else {
        App.exitApp();
      }
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
