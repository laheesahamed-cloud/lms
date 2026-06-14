import { create } from 'zustand';
import { applyCapacitorStatusBarTheme } from '../utils/capacitorStatusBar.js';

const THEME_KEY = 'lms_theme_mode';
const ACCENT_THEME_KEY = 'lms_accent_theme';
const ACCENT_THEMES = new Set(['erpm', 'codeforge']);
const CHROME_THEME_COLORS = {
  light: '#dce6f4',
  dark: '#060d22',
};
let themeTransitionTimer = null;

function canUseMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function commitTheme(theme, options = {}) {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return;
  }

  const shouldAnimate = options.animate !== false;

  if (shouldAnimate) {
    document.documentElement.classList.add('theme-transition');
  }

  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document.documentElement.style.backgroundColor = CHROME_THEME_COLORS[theme];
  document.body.style.backgroundColor = CHROME_THEME_COLORS[theme];
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.body.classList.toggle('dark', theme === 'dark');
  document.body.classList.toggle('dark-bg', theme === 'dark');

  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', CHROME_THEME_COLORS[theme]);
  }

  applyCapacitorStatusBarTheme(theme, CHROME_THEME_COLORS[theme]);

  window.clearTimeout(themeTransitionTimer);
  if (shouldAnimate) {
    themeTransitionTimer = window.setTimeout(() => {
      document.documentElement.classList.remove('theme-transition');
    }, 320);
  } else {
    document.documentElement.classList.remove('theme-transition');
  }
}

function commitAccentTheme(accentTheme) {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.dataset.accentTheme = accentTheme;
}

function applyTheme(theme) {
  if (typeof document === 'undefined') {
    return;
  }

  const supportsViewTransition =
    typeof document.startViewTransition === 'function' &&
    canUseMotion();

  if (!supportsViewTransition) {
    commitTheme(theme);
    return;
  }

  document.startViewTransition(() => {
    commitTheme(theme);
  });
}

function getPreferredTheme() {
  if (typeof window === 'undefined') {
    return 'light';
  }

  try {
    const requestedTheme = new URLSearchParams(window.location.search).get('theme');
    if (requestedTheme === 'light' || requestedTheme === 'dark') {
      return requestedTheme;
    }

    const storedTheme = window.localStorage.getItem(THEME_KEY);
    if (storedTheme === 'light' || storedTheme === 'dark') {
      return storedTheme;
    }
  } catch {
    return typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  }

  // No saved/requested theme: honor the boot script's choice (data-theme),
  // which defaults native to dark — avoids overriding back to light on first launch.
  return typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function getPreferredAccentTheme() {
  if (typeof window === 'undefined') {
    return 'codeforge';
  }

  try {
    const storedTheme = window.localStorage.getItem(ACCENT_THEME_KEY);
    return ACCENT_THEMES.has(storedTheme) ? storedTheme : 'codeforge';
  } catch {
    return typeof document !== 'undefined' ? document.documentElement.dataset.accentTheme || 'codeforge' : 'codeforge';
  }
}

function getBootstrapTheme() {
  if (typeof document === 'undefined') {
    return 'light';
  }

  const theme = document.documentElement.dataset.theme;
  return theme === 'dark' || theme === 'light' ? theme : 'light';
}

function getBootstrapAccentTheme() {
  if (typeof document === 'undefined') {
    return 'codeforge';
  }

  const accentTheme = document.documentElement.dataset.accentTheme;
  return ACCENT_THEMES.has(accentTheme) ? accentTheme : 'codeforge';
}

export const useThemeStore = create((set, get) => ({
  theme: getBootstrapTheme(),
  accentTheme: getBootstrapAccentTheme(),
  hydrated: false,

  hydrateTheme: () => {
    const theme = getPreferredTheme();
    const accentTheme = getPreferredAccentTheme();

    if (typeof document !== 'undefined' && document.body.classList.contains('app-booting')) {
      commitTheme(theme, { animate: false });
    } else {
      applyTheme(theme);
    }

    commitAccentTheme(accentTheme);
    set({ theme, accentTheme, hydrated: true });
  },

  setTheme: (theme) => {
    if (theme !== 'light' && theme !== 'dark') {
      return;
    }

    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(THEME_KEY, theme);
      } catch {
        // Ignore storage failures; the in-memory theme still applies.
      }
    }

    applyTheme(theme);
    set({ theme, hydrated: true });
  },

  setThemeInstant: (theme) => {
    if (theme !== 'light' && theme !== 'dark') {
      return;
    }

    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(THEME_KEY, theme);
      } catch {
        // Ignore storage failures; the in-memory theme still applies.
      }
    }

    commitTheme(theme, { animate: false });
    set({ theme, hydrated: true });
  },

  setAccentTheme: (accentTheme) => {
    if (!ACCENT_THEMES.has(accentTheme)) {
      return;
    }

    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(ACCENT_THEME_KEY, accentTheme);
      } catch {
        // Ignore storage failures; the in-memory accent still applies.
      }
    }

    commitAccentTheme(accentTheme);
    set({ accentTheme, hydrated: true });
  },

  toggleTheme: () => {
    const nextTheme = get().theme === 'dark' ? 'light' : 'dark';
    get().setTheme(nextTheme);
  },
}));
