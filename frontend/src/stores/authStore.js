import { create } from 'zustand';
import { fetchCurrentUser, login, logout, register } from '../api/auth.api.js';

const AUTH_TOKEN_KEY = 'lms_session_token';

let hydratePromise = null;
let volatileToken = '';

function getBootstrapAuth() {
  if (typeof window === 'undefined') {
    return {
      token: '',
      user: null,
    };
  }

  let token = '';
  try {
    token = window.localStorage.getItem(AUTH_TOKEN_KEY) || '';
  } catch {
    token = '';
  }

  return {
    token,
    user: null,
  };
}

export function getAuthToken() {
  return volatileToken || getBootstrapAuth().token || '';
}

function setAuthToken(token) {
  volatileToken = token || '';
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (volatileToken) {
      window.localStorage.setItem(AUTH_TOKEN_KEY, volatileToken);
    } else {
      window.localStorage.removeItem(AUTH_TOKEN_KEY);
    }
  } catch {
    // Keep the in-memory token even if browser storage is unavailable.
  }
}

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

export function clearStoredAuth() {
  setAuthToken('');
}

export const useAuthStore = create((set, get) => ({
  user: null,
  token: getAuthToken(),
  isHydrating: true,
  isAuthenticated: false,
  isSigningOut: false,

  hydrate: async () => {
    if (hydratePromise) {
      return hydratePromise;
    }

    hydratePromise = (async () => {
      const bootstrapAuth = getBootstrapAuth();
      const token = get().token || getAuthToken();

      if (!token) {
        setAuthToken(bootstrapAuth.token || '');
      }

      const isQuietPublicCheck = isPublicAuthRoute() && !token;

      if (isQuietPublicCheck) {
        set({ isHydrating: false });
      }

      try {
        const data = await fetchCurrentUser({
          silent: isQuietPublicCheck,
          timeout: isQuietPublicCheck ? 2500 : 5000,
        });
        set({
          token: getAuthToken(),
          user: data.user,
          isAuthenticated: true,
          isHydrating: false,
        });
      } catch {
        setAuthToken('');
        set({
          token: '',
          user: null,
          isAuthenticated: false,
          isHydrating: false,
          isSigningOut: false,
        });
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
    setAuthToken(data.sessionToken || '');
    set({
      token: data.sessionToken || '',
      user: data.user,
      isAuthenticated: true,
      isSigningOut: false,
    });
    return data;
  },

  signUp: async (payload) => {
    const data = await register(payload);
    setAuthToken(data.sessionToken || '');
    set({
      token: data.sessionToken || '',
      user: data.user,
      isAuthenticated: true,
      isSigningOut: false,
    });
    return data;
  },

  signOut: async () => {
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
    set({
      token: '',
      user: null,
      isAuthenticated: false,
      isSigningOut: false,
    });
  },

  forceSignOut: () => {
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
