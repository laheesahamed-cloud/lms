import { create } from 'zustand';
import { clearAllTimedApiCaches } from '../api/cache.js';
import { setUnauthorizedHandler } from '../api/client.js';
import { fetchCurrentUser, login, loginWithGoogle, logout, register } from '../api/auth.api.js';
import { detectPlatform } from '../platform/detect.js';
import { clearStoredAuth, getAuthToken, getBootstrapAuth, setAuthToken, setStoredAuthUser } from './authToken.js';
import { getCurrentForwardPath } from '../utils/routeForwarding.js';

let hydratePromise = null;
let authMutationVersion = 0;
const PUBLIC_AUTH_PATHS = new Set([
  '/login',
  '/register',
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
]);

function getNormalizedPublicPathname() {
  if (typeof window === 'undefined') {
    return '/';
  }

  return (window.location.pathname || '/')
    .replace(/^\/lms(?:\/frontend\/dist)?(?=\/|$)/, '')
    .replace(/\/+$/, '') || '/';
}

function isPublicAuthRoute() {
  if (typeof window === 'undefined') {
    return false;
  }

  return PUBLIC_AUTH_PATHS.has(getNormalizedPublicPathname());
}

function finishSignedOut(set) {
  clearAllTimedApiCaches();
  setAuthToken('');
  setStoredAuthUser(null);
  set({
    token: '',
    user: null,
    isAuthenticated: false,
    isHydrating: false,
    isSigningOut: false,
    sessionExpiredLock: null,
  });
}

function createSessionExpiredNotice() {
  return {
    type: 'warning',
    message: 'Your session expired. Please sign in again to continue.',
  };
}

function isTemporarySessionLookupFailure(error) {
  const status = Number(error?.response?.status || 0);
  const data = error?.response?.data;
  return error?.code === 'ECONNABORTED' ||
    error?.code === 'ERR_NETWORK' ||
    error?.message === 'Network Error' ||
    !error?.response ||
    status >= 500 ||
    data?.code === 'DATABASE_UNAVAILABLE' ||
    data?.checks?.database?.ok === false;
}

function preserveAuthDuringTemporaryHydrateFailure(set, get, error) {
  if (!isTemporarySessionLookupFailure(error) || isPublicAuthRoute()) {
    return false;
  }

  const current = get();
  const token = current.token || getAuthToken();
  const user = current.user || null;
  const hasLocalAuthSnapshot = Boolean(current.isAuthenticated || user || token);

  set({
    token,
    user,
    isAuthenticated: hasLocalAuthSnapshot,
    isHydrating: !hasLocalAuthSnapshot,
    isSigningOut: false,
  });
  return true;
}

function syncNativePushAfterAuth() {
  if (!detectPlatform().isNative) return;
  import('../platform/native/NotificationDelivery.js')
    .then((module) => module.syncNativePushToken?.())
    .catch(() => {});
}

const bootstrapAuth = getBootstrapAuth();

export const useAuthStore = create((set, get) => ({
  user: bootstrapAuth.user,
  token: bootstrapAuth.token,
  isHydrating: Boolean(bootstrapAuth.token && !bootstrapAuth.user),
  isAuthenticated: Boolean(bootstrapAuth.token && bootstrapAuth.user),
  isSigningOut: false,
  authNotice: null,
  sessionExpiredLock: null,

  hydrate: async () => {
    if (hydratePromise) {
      return hydratePromise;
    }

    const hydrateVersion = authMutationVersion;
    hydratePromise = (async () => {
      try {
        const data = await fetchCurrentUser({
          silent: isPublicAuthRoute(),
          timeout: isPublicAuthRoute() ? 2500 : 5000,
        });
        if (hydrateVersion !== authMutationVersion) {
          return;
        }
        set({
          token: getAuthToken(),
          user: data.user,
          isAuthenticated: true,
          isHydrating: false,
        });
        setStoredAuthUser(data.user);
      } catch (error) {
        if (hydrateVersion !== authMutationVersion) {
          return;
        }
        if (preserveAuthDuringTemporaryHydrateFailure(set, get, error)) {
          return;
        }
        finishSignedOut(set);
      }
    })();

    try {
      await hydratePromise;
    } finally {
      hydratePromise = null;
    }
  },

  signIn: async (payload) => {
    const data = await login(payload);
    if (detectPlatform().isNative && !data.sessionToken) {
      throw new Error('Native sign-in did not receive a session token. Restart the LMS API so it uses the latest auth build, then try again.');
    }
    authMutationVersion += 1;
    clearAllTimedApiCaches();
    setAuthToken(data.sessionToken || '');
    setStoredAuthUser(data.user);
    set({
      token: data.sessionToken || '',
      user: data.user,
      isAuthenticated: true,
      isHydrating: false,
      isSigningOut: false,
      authNotice: null,
      sessionExpiredLock: null,
    });
    syncNativePushAfterAuth();
    return data;
  },

  signUp: async (payload) => {
    const data = await register(payload);
    if (detectPlatform().isNative && !data.sessionToken) {
      throw new Error('Native registration did not receive a session token. Restart the LMS API so it uses the latest auth build, then try again.');
    }
    authMutationVersion += 1;
    clearAllTimedApiCaches();
    setAuthToken(data.sessionToken || '');
    setStoredAuthUser(data.user);
    set({
      token: data.sessionToken || '',
      user: data.user,
      isAuthenticated: true,
      isHydrating: false,
      isSigningOut: false,
      authNotice: null,
      sessionExpiredLock: null,
    });
    syncNativePushAfterAuth();
    return data;
  },

  signInWithGoogle: async (credential) => {
    const data = await loginWithGoogle({ credential });
    if (detectPlatform().isNative && !data.sessionToken) {
      throw new Error('Native Google sign-in did not receive a session token. Restart the LMS API so it uses the latest auth build, then try again.');
    }
    authMutationVersion += 1;
    clearAllTimedApiCaches();
    setAuthToken(data.sessionToken || '');
    setStoredAuthUser(data.user);
    set({
      token: data.sessionToken || '',
      user: data.user,
      isAuthenticated: true,
      isHydrating: false,
      isSigningOut: false,
      authNotice: null,
      sessionExpiredLock: null,
    });
    syncNativePushAfterAuth();
    return data;
  },

  signOut: async () => {
    authMutationVersion += 1;
    clearAllTimedApiCaches();
    set({ isSigningOut: true });

    await new Promise((resolve) => {
      window.setTimeout(resolve, 420);
    });

    try {
      await logout();
    } catch {
      // Clear client state even if the request fails.
    }

    setAuthToken('');
    setStoredAuthUser(null);
    set({
      token: '',
      user: null,
      isAuthenticated: false,
      isSigningOut: false,
      authNotice: null,
      sessionExpiredLock: null,
    });
  },

  forceSignOut: (options = {}) => {
    const current = get();
    const isPublicAuthPage = isPublicAuthRoute();
    const notice = createSessionExpiredNotice();
    const shouldLockCurrentPage =
      options?.reason === 'session-expired' &&
      !isPublicAuthPage &&
      Boolean(current.isAuthenticated || current.user || current.token);
    const shouldShowSessionNotice =
      options?.reason === 'session-expired' &&
      !isPublicAuthPage &&
      Boolean(current.isAuthenticated || current.user || current.token);
    authMutationVersion += 1;
    clearAllTimedApiCaches();
    clearStoredAuth();
    set({
      token: '',
      user: null,
      isAuthenticated: false,
      isHydrating: false,
      isSigningOut: false,
      authNotice: shouldShowSessionNotice ? notice : null,
      sessionExpiredLock: shouldLockCurrentPage
        ? {
            from: getCurrentForwardPath(),
            message: notice.message,
          }
        : null,
    });
    return shouldLockCurrentPage;
  },

  setUser: (user) => {
    set({ user });
  },

  consumeAuthNotice: () => {
    set({ authNotice: null });
  },

  clearSessionExpiredLock: () => {
    set({ authNotice: null, sessionExpiredLock: null });
  },
}));

setUnauthorizedHandler(() => {
  return useAuthStore.getState().forceSignOut({ reason: 'session-expired' });
});
