// Web Sign in with Apple via Apple's official JS SDK (AppleID.auth), popup flow.
// Config comes from build-time env so it can be pasted into the web app's .env:
//   VITE_APPLE_SERVICES_ID   — the Services ID you create in the Apple portal
//   VITE_APPLE_REDIRECT_URI  — the HTTPS return URL registered on that Services ID
// The button stays hidden until VITE_APPLE_SERVICES_ID is set (same gating as
// the Google button). On success we hand the id_token to /auth/apple, which
// verifies it server-side.

const APPLE_SERVICES_ID = String(import.meta.env.VITE_APPLE_SERVICES_ID || '').trim();
const APPLE_REDIRECT_URI = String(import.meta.env.VITE_APPLE_REDIRECT_URI || '').trim();
const APPLE_SCRIPT_ID = 'apple-id-auth';
const APPLE_SCRIPT_SRC =
  'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';

/** True once a Services ID is configured — gate the Apple button on this. */
export function appleSignInConfigured() {
  return Boolean(APPLE_SERVICES_ID);
}

/** The user closed the Apple popup — treat as a silent cancel, not an error. */
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

/**
 * Runs the Apple popup sign-in. Returns { identityToken, fullName? } — fullName
 * is present only on the user's FIRST Apple sign-in (Apple never resends it).
 * Throws on failure; check isAppleCancellation() to ignore user cancels.
 */
export async function signInWithApplePopup() {
  if (!APPLE_SERVICES_ID) throw new Error('Apple sign-in is not configured.');
  await loadAppleScript();

  const redirectURI = APPLE_REDIRECT_URI ||
    (typeof window !== 'undefined' ? `${window.location.origin}/auth/login` : '');

  window.AppleID.auth.init({
    clientId: APPLE_SERVICES_ID,
    scope: 'name email',
    redirectURI,
    usePopup: true,
  });

  const res = await window.AppleID.auth.signIn();
  const idToken = res?.authorization?.id_token;
  if (!idToken) throw new Error('Apple sign-in did not return a token.');

  let fullName = '';
  if (res.user?.name) {
    fullName = [res.user.name.firstName, res.user.name.lastName].filter(Boolean).join(' ').trim();
  }
  return { identityToken: idToken, fullName: fullName || undefined };
}
