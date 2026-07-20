import { Capacitor } from '@capacitor/core';

/**
 * True when running inside the Capacitor native shell (Android/iOS app),
 * false in a normal browser / PWA. Safe to call on the web.
 */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * 'android' | 'ios' | 'web'
 */
export function getPlatform(): string {
  return Capacitor.getPlatform();
}
