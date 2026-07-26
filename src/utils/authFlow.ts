/**
 * Session flags that coordinate Google Sign-In "no account" confirmation
 * with AuthContext onboarding redirects.
 *
 * Without these, authenticateWithGoogle briefly sets isOnboarding=true,
 * App redirects /login → /select-role, then signOut kicks the user to
 * /signup — unmounting Login before the confirmation dialog can appear.
 */

const AUTH_FLOW_KEY = 'brushowl_auth_flow';
const PENDING_NO_ACCOUNT_KEY = 'brushowl_pending_google_no_account';
/** Holds home/app redirects while Google auth is still being verified (e.g. password conflict). */
const AUTH_HOLD_KEY = 'brushowl_auth_hold';

export type AuthFlow = 'signin' | 'signup' | 'onboarding';

export function setAuthFlow(flow: AuthFlow): void {
  try {
    sessionStorage.setItem(AUTH_FLOW_KEY, flow);
  } catch {
    // ignore
  }
}

export function getAuthFlow(): AuthFlow | null {
  try {
    const v = sessionStorage.getItem(AUTH_FLOW_KEY);
    if (v === 'signin' || v === 'signup' || v === 'onboarding') return v;
    return null;
  } catch {
    return null;
  }
}

export function clearAuthFlow(): void {
  try {
    sessionStorage.removeItem(AUTH_FLOW_KEY);
  } catch {
    // ignore
  }
}

export function setAuthHold(): void {
  try {
    sessionStorage.setItem(AUTH_HOLD_KEY, '1');
  } catch {
    // ignore
  }
}

export function clearAuthHold(): void {
  try {
    sessionStorage.removeItem(AUTH_HOLD_KEY);
  } catch {
    // ignore
  }
}

/** True while Google credential is verified and must not enter the app yet. */
export function isAuthHold(): boolean {
  try {
    return sessionStorage.getItem(AUTH_HOLD_KEY) === '1';
  } catch {
    return false;
  }
}

export function setPendingGoogleNoAccount(email: string, displayName = ''): void {
  try {
    sessionStorage.setItem(
      PENDING_NO_ACCOUNT_KEY,
      JSON.stringify({ email, displayName })
    );
  } catch {
    // ignore
  }
}

export function peekPendingGoogleNoAccount(): { email: string; displayName: string } | null {
  try {
    const raw = sessionStorage.getItem(PENDING_NO_ACCOUNT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      email: typeof parsed?.email === 'string' ? parsed.email : '',
      displayName: typeof parsed?.displayName === 'string' ? parsed.displayName : '',
    };
  } catch {
    return null;
  }
}

export function clearPendingGoogleNoAccount(): void {
  try {
    sessionStorage.removeItem(PENDING_NO_ACCOUNT_KEY);
  } catch {
    // ignore
  }
}

/** True while Sign In is checking Google and must not jump into onboarding routes. */
export function shouldSuppressOnboardingRedirect(): boolean {
  return getAuthFlow() === 'signin' || peekPendingGoogleNoAccount() !== null || isAuthHold();
}

/**
 * True while Google auth is mid-flight — do not treat a brief Firebase session
 * as a successful login (prevents /home race before password-conflict sign-out).
 */
export function shouldSuppressAuthHomeRedirect(): boolean {
  return isAuthHold() || getAuthFlow() === 'signin';
}
