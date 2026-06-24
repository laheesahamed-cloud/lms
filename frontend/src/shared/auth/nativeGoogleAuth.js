/**
 * Native Google Sign-In for the Capacitor app.
 *
 * Google blocks its web OAuth flow (Google Identity Services popup) when it runs
 * inside an embedded WebView — that is the "Error 400: invalid_request / doesn't
 * comply with Google's OAuth 2.0 policy" page. The native build must use the
 * platform Google Sign-In SDK instead, which opens the system account picker
 * (Android bottom sheet / iOS in-app Safari sheet) and returns an `idToken`.
 *
 * That `idToken` is sent verbatim to the existing `POST /auth/google` endpoint,
 * which already verifies Google id_tokens — so the backend needs no changes.
 *
 * The web/PWA build keeps using the GIS popup (see LoginPage.jsx); this module is
 * only ever loaded on native.
 */
import { detectPlatform } from '../platform/detect.js';

// iOS needs its own OAuth client id (it cannot use the web client). It is baked
// in at build time because the matching reversed-client-id URL scheme also lives
// in the native Info.plist. The web client id (Android `serverClientId`) is
// resolved at runtime from public settings, with this env as a fallback.
const ENV_WEB_CLIENT_ID = String(import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
const ENV_IOS_CLIENT_ID = String(import.meta.env.VITE_GOOGLE_IOS_CLIENT_ID || '').trim();

let pluginPromise = null;
let initPromise = null;
let initializedKey = '';

function loadPlugin() {
  if (!pluginPromise) {
    pluginPromise = import('@capgo/capacitor-social-login').then((module) => module.SocialLogin);
  }
  return pluginPromise;
}

/**
 * Initialize the native Google provider. Safe to call repeatedly — it only runs
 * `SocialLogin.initialize` once per (webClientId, iosClientId) pair.
 *
 * @param {string} webClientIdFromSettings  Web OAuth client id from public settings.
 * @returns {Promise<boolean>}
 */
export async function ensureNativeGoogleAuth(webClientIdFromSettings) {
  const platform = detectPlatform();
  if (!platform.isNative) return false;

  const webClientId = String(webClientIdFromSettings || ENV_WEB_CLIENT_ID || '').trim();
  const iosClientId = ENV_IOS_CLIENT_ID;

  if (platform.isIos && !iosClientId) {
    throw new Error('Google sign-in is not configured for iOS yet.');
  }
  if (!platform.isIos && !webClientId) {
    throw new Error('Google sign-in is not configured on the server yet.');
  }

  const key = `${webClientId}|${iosClientId}`;
  if (initPromise && initializedKey === key) return initPromise;

  initializedKey = key;
  initPromise = (async () => {
    const SocialLogin = await loadPlugin();
    await SocialLogin.initialize({
      google: {
        webClientId: webClientId || undefined,
        iOSClientId: iosClientId || undefined,
        // Lets iOS verify against the same web client on the server side too.
        iOSServerClientId: webClientId || undefined,
        mode: 'online',
      },
    });
    return true;
  })().catch((err) => {
    // Allow a later retry if initialization failed.
    initPromise = null;
    initializedKey = '';
    throw err;
  });

  return initPromise;
}

/**
 * Open the native Google account picker and return the signed-in user's idToken.
 * @returns {Promise<string>} the Google id_token (a JWT) for backend verification.
 */
export async function signInWithNativeGoogle() {
  const SocialLogin = await loadPlugin();
  const platform = detectPlatform();

  const response = await SocialLogin.login({
    provider: 'google',
    options: {
      scopes: ['email', 'profile'],
      // Android: render the bottom-sheet account picker and show every account
      // (not just previously-authorized ones) so first-time sign-in works.
      ...(platform.isAndroid
        ? { style: 'bottom', filterByAuthorizedAccounts: false, autoSelectEnabled: false }
        : {}),
    },
  });

  const result = response?.result;
  const idToken = result && 'idToken' in result ? String(result.idToken || '').trim() : '';
  if (!idToken) {
    throw new Error('Google did not return a sign-in token. Please try again.');
  }
  return idToken;
}

/** True when the user dismissed the native Google picker (not a real error). */
export function isNativeGoogleCancellation(err) {
  if (!err) return false;
  if (err.code === 'USER_CANCELLED') return true;
  const text = `${err.code || ''} ${err.message || err}`.toLowerCase();
  return text.includes('cancel');
}
