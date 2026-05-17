const LEGACY_AUTH_TOKEN_KEY = 'lms_session_token';
const NATIVE_AUTH_TOKEN_KEY = 'lms_native_session_token';
const NATIVE_AUTH_USER_KEY = 'lms_native_user';

let volatileToken = '';

function isNativeRuntime() {
  if (typeof window === 'undefined') return false;
  return window.location?.protocol === 'capacitor:' ||
    window.location?.protocol === 'ionic:' ||
    window.Capacitor?.isNativePlatform?.() === true ||
    import.meta.env.VITE_LMS_BUILD_TARGET === 'native' ||
    import.meta.env.MODE === 'capacitor';
}

function getStoredNativeToken() {
  if (typeof window === 'undefined' || !isNativeRuntime()) return '';

  try {
    return window.localStorage.getItem(NATIVE_AUTH_TOKEN_KEY) ||
      window.localStorage.getItem(LEGACY_AUTH_TOKEN_KEY) ||
      '';
  } catch {
    return '';
  }
}

function getStoredNativeUser() {
  if (typeof window === 'undefined' || !isNativeRuntime()) return null;

  try {
    const rawUser = window.localStorage.getItem(NATIVE_AUTH_USER_KEY);
    return rawUser ? JSON.parse(rawUser) : null;
  } catch {
    return null;
  }
}

export function getBootstrapAuth() {
  if (typeof window === 'undefined') {
    return {
      token: '',
      user: null,
    };
  }

  try {
    if (!isNativeRuntime()) {
      window.localStorage.removeItem(NATIVE_AUTH_TOKEN_KEY);
      window.localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
    }
  } catch {
    // Legacy token cleanup is best-effort.
  }

  return {
    token: volatileToken || getStoredNativeToken(),
    user: getStoredNativeUser(),
  };
}

export function getAuthToken() {
  return volatileToken || getBootstrapAuth().token || '';
}

export function setAuthToken(token) {
  volatileToken = token || '';
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (isNativeRuntime() && token) {
      window.localStorage.setItem(NATIVE_AUTH_TOKEN_KEY, token);
      window.localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
    } else {
      window.localStorage.removeItem(NATIVE_AUTH_TOKEN_KEY);
      window.localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
    }
  } catch {
    // Legacy token cleanup is best-effort.
  }
}

export function setStoredAuthUser(user) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (isNativeRuntime() && user) {
      window.localStorage.setItem(NATIVE_AUTH_USER_KEY, JSON.stringify(user));
    } else {
      window.localStorage.removeItem(NATIVE_AUTH_USER_KEY);
    }
  } catch {
    // Cached user data is only a startup optimization.
  }
}

export function clearStoredAuth() {
  setAuthToken('');
  setStoredAuthUser(null);
}
