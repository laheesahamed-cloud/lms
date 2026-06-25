// Web Sign in with Apple via Apple's official JS SDK (AppleID.auth), using the
// REDIRECT flow (same page, like Google) — NOT a popup. Apple form-POSTs the
// result to the backend callback (VITE_APPLE_REDIRECT_URI), which sets the
// session and redirects to the dashboard. Config comes from build-time env so
// it can be pasted into the web app's .env:
//   VITE_APPLE_SERVICES_ID   — the Services ID created in the Apple portal
//   VITE_APPLE_REDIRECT_URI  — the backend callback, e.g.
//                              https://xyndrome.lk/api/auth/apple/callback
// The button stays hidden until VITE_APPLE_SERVICES_ID is set.

const APPLE_SERVICES_ID = String(import.meta.env.VITE_APPLE_SERVICES_ID || '').trim();
const APPLE_REDIRECT_URI = String(import.meta.env.VITE_APPLE_REDIRECT_URI || '').trim();
const APPLE_SCRIPT_ID = 'apple-id-auth';
const APPLE_SCRIPT_SRC =
  'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';

/** True once a Services ID is configured — gate the Apple button on this. */
export function appleSignInConfigured() {
  return Boolean(APPLE_SERVICES_ID);
}

/** The user cancelled at Apple — treat as a silent cancel, not an error. */
export function isAppleCancellation(err) {
  const code = String(err?.error || err?.code || '').toLowerCase();
  return code === 'popup_closed_by_user' || code === 'user_cancelled_authorize' || code === 'user_trigger_new_signin_flow';
}

function loadAppleScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Apple sign-in is not available here'));
  if (window.AppleID?.auth) return Promise.resolve(window.AppleID);

  return new Promise((resolve, reject) => {
    const existing = document.getElementById(APPLE_SCRIPT_ID);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.AppleID), { once: true });
      existing.addEventListener('error', () => reject(new Error('Apple sign-in could not load')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.id = APPLE_SCRIPT_ID;
    script.src = APPLE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.AppleID);
    script.onerror = () => reject(new Error('Apple sign-in could not load'));
    document.head.appendChild(script);
  });
}

function randomState() {
  return (window.crypto?.randomUUID?.() || `${Date.now()}.${Math.random().toString(36).slice(2)}`);
}

/**
 * Starts the Apple redirect sign-in (same-page, like Google). Sets a short-lived
 * CSRF state cookie that the backend callback validates, then navigates the whole
 * page to Apple. Does not resolve normally — the browser leaves this page.
 */
export async function startAppleRedirect() {
  if (!APPLE_SERVICES_ID) throw new Error('Apple sign-in is not configured.');
  await loadAppleScript();

  // SameSite=None so the cookie survives Apple's cross-site POST back to us.
  const state = randomState();
  document.cookie = `xy_apple_state=${state}; path=/; max-age=600; SameSite=None; Secure`;

  window.AppleID.auth.init({
    clientId: APPLE_SERVICES_ID,
    scope: 'name email',
    redirectURI: APPLE_REDIRECT_URI,
    usePopup: false,
    state,
  });

  // With usePopup:false this performs a full-page redirect to Apple; the promise
  // typically never resolves because we navigate away.
  await window.AppleID.auth.signIn();
}
