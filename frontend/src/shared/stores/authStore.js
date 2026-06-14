import { create } from 'zustand';
import { clearAllTimedApiCaches } from '../api/cache.js';
import { setUnauthorizedHandler } from '../api/client.js';
import { fetchCurrentUser, login, loginWithGoogle, loginWithGoogleCode, logout, register } from '../api/auth.api.js';
import { detectPlatform } from '../platform/detect.js';
import { clearStoredAuth, getAuthToken, getBootstrapAuth, setAuthToken, setStoredAuthUser } from './authToken.js';
import { getCurrentForwardPath } from '../utils/routeForwarding.js';
import { isPublicWebsiteRoute } from '../routing/publicRoutes.js';

let hydratePromise = null;
let authMutationVersion = 0;

function isPublicAuthRoute() {
  if (typeof window === 'undefined') {
    return false;
  }

  return isPublicWebsiteRoute(window.location.pathname || '/');
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
  if (!hasLocalAuthSnapshot) {
    return false;
  }

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

function normalizeAuthUser(user) {
  if (!user || typeof user !== 'object') return null;

  return {
    ...user,
    fullName: user.fullName || user.full_name || user.name || '',
    avatarKey: user.avatarKey || user.avatar_key || '',
  };
}

function getAuthPayloadUser(data) {
  return normalizeAuthUser(data?.user || data?.account || data?.student || data?.profile);
}

async function resolveAuthPayload(data, label) {
  const directUser = getAuthPayloadUser(data);
  if (directUser?.role) {
    return {
      ...data,
      user: directUser,
    };
  }

  const previousToken = getAuthToken();
  const responseToken = String(data?.sessionToken || '').trim();
  const temporarilyStoredToken = Boolean(responseToken && responseToken !== previousToken);

  try {
    if (temporarilyStoredToken) {
      setAuthToken(responseToken);
    }
    const current = await fetchCurrentUser({ silent: true, timeout: 5000 });
    const currentUser = normalizeAuthUser(current?.user);
    if (!currentUser?.role) {
      throw new Error('Current user response did not include account details.');
    }

    return {
      ...data,
      redirectPath: data?.redirectPath || current?.redirectPath,
      user: currentUser,
      sessionToken: responseToken || previousToken || '',
    };
  } catch (error) {
    if (temporarilyStoredToken) {
      setAuthToken(previousToken);
    }
    if (detectPlatform().isNative) {
      throw new Error(`Native ${label} could not load account details. Please try again.`);
    }
    throw error;
  }
}

const bootstrapAuth = getBootstrapAuth();
const PUBLIC_AUTH_HYDRATE_TIMEOUT_MS = 1500;

export const useAuthStore = create((set, get) => ({
  user: bootstrapAuth.user,
  token: bootstrapAuth.token,
  // On web the session token lives only in memory, so a refresh starts with no
  // token — but an httpOnly `lms_session` cookie may still authenticate us via
  // /auth/me. Start in the hydrating state (so route guards WAIT instead of
  // bouncing to /login) whenever we still need to probe for a session: no cached
  // user, and either a token is present or we're on a protected route.
  isHydrating:
    !bootstrapAuth.user &&
    (Boolean(bootstrapAuth.token) || !isPublicAuthRoute()),
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
        const current = get();
        const token = current.token || getAuthToken();
        const hasLocalAuthSnapshot = Boolean(current.isAuthenticated || current.user || token);
        if (!hasLocalAuthSnapshot && isPublicAuthRoute()) {
          finishSignedOut(set);
          return;
        }

        const data = await fetchCurrentUser({
          silent: isPublicAuthRoute(),
          timeout: isPublicAuthRoute() ? PUBLIC_AUTH_HYDRATE_TIMEOUT_MS : 5000,
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
    const data = await resolveAuthPayload(await login(payload), 'sign-in');
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
    const data = await resolveAuthPayload(await register(payload), 'registration');
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
    const data = await resolveAuthPayload(await loginWithGoogle({ credential }), 'Google sign-in');
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

  signInWithGoogleCode: async (payload) => {
    const data = await resolveAuthPayload(await loginWithGoogleCode(payload), 'Google sign-in');
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
    setStoredAuthUser(user);
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
