import { create } from 'zustand';
import { setUnauthorizedHandler } from '../api/client.js';
import { fetchCurrentUser, login, logout, register } from '../api/auth.api.js';
import { detectPlatform } from '../platform/detect.js';
import { clearStoredAuth, getAuthToken, getBootstrapAuth, setAuthToken, setStoredAuthUser } from './authToken.js';

let hydratePromise = null;
let authMutationVersion = 0;

function isPublicAuthRoute() {
  if (typeof window === 'undefined') {
    return false;
  }

  const pathname = window.location.pathname || '';
  return pathname.endsWith('/login') ||
    pathname.endsWith('/register') ||
    pathname.endsWith('/auth/login') ||
    pathname.endsWith('/auth/register') ||
    pathname.endsWith('/auth/forgot-password') ||
    pathname.endsWith('/auth/reset-password');
}

function finishSignedOut(set) {
  setAuthToken('');
  setStoredAuthUser(null);
  set({
    token: '',
    user: null,
    isAuthenticated: false,
    isHydrating: false,
    isSigningOut: false,
  });
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
      } catch {
        if (hydrateVersion !== authMutationVersion) {
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
    setAuthToken(data.sessionToken || '');
    setStoredAuthUser(data.user);
    set({
      token: data.sessionToken || '',
      user: data.user,
      isAuthenticated: true,
      isHydrating: false,
      isSigningOut: false,
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
    setAuthToken(data.sessionToken || '');
    setStoredAuthUser(data.user);
    set({
      token: data.sessionToken || '',
      user: data.user,
      isAuthenticated: true,
      isHydrating: false,
      isSigningOut: false,
    });
    syncNativePushAfterAuth();
    return data;
  },

  signOut: async () => {
    authMutationVersion += 1;
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
    });
  },

  forceSignOut: () => {
    authMutationVersion += 1;
    clearStoredAuth();
    set({
      token: '',
      user: null,
      isAuthenticated: false,
      isHydrating: false,
      isSigningOut: false,
    });
  },

  setUser: (user) => {
    set({ user });
  },
}));

setUnauthorizedHandler(() => {
  useAuthStore.getState().forceSignOut();
});
