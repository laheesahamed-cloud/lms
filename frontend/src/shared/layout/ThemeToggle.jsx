import { useCallback, useEffect, useRef } from 'react';
import { useThemeStore } from '../stores/themeStore.js';
import { cx, ui } from '../styles/tailwindClasses.js';

const SOFT_THEME_TRANSITION_MS = 160;

function SunIcon({ className = '' } = {}) {
  return (
    <svg className={cx('block size-[18px] overflow-visible', className)} width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="3.25" fill="currentColor" />
      <path d="M9 1.9v2M9 14.1v2M16.1 9h-2M3.9 9h-2M14.05 3.95l-1.42 1.42M5.37 12.63l-1.42 1.42M14.05 14.05l-1.42-1.42M5.37 5.37 3.95 3.95" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon({ className = '', animated = false } = {}) {
  return (
    <svg className={cx('block size-[18px] overflow-visible', className)} width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path className={cx(animated && 'motion-safe:animate-themeMoonFloat')} d="M14.78 11.18A6.1 6.1 0 0 1 6.8 3.22 6.35 6.35 0 1 0 14.78 11.18Z" fill="currentColor" />
      <path d="M13.35 2.15v2.3M14.5 3.3h-2.3M15.55 6.65v1.5M16.3 7.4h-1.5" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
    </svg>
  );
}

const toggleButtonClass =
  'relative isolate inline-flex size-11 min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border p-0 transition-[transform,background-color,border-color,box-shadow,color] duration-150 ease-[var(--ease-out)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-primary/18 active:translate-y-0 active:scale-[0.97]';
const toggleLightClass =
  'border-line-soft bg-[var(--btn-secondary-bg)] text-brand-primary shadow-none backdrop-blur-sm hover:-translate-y-px hover:border-brand-primary/24 hover:bg-brand-primary/10 hover:text-brand-primary';
const toggleDarkClass =
  'border-line-soft bg-[var(--btn-secondary-bg)] text-amber-300 shadow-none backdrop-blur-sm hover:-translate-y-px hover:border-brand-primary/24 hover:bg-brand-primary/10 hover:text-amber-200';
const toggleGlowClass =
  'absolute inset-0 z-0 opacity-0 transition-[opacity,background] duration-150 ease-[var(--ease-out)] group-hover:opacity-100';
const toggleGlowLightClass =
  'bg-[radial-gradient(circle_at_50%_50%,rgba(37,99,235,0.10),transparent_68%)]';
const toggleGlowDarkClass =
  'bg-[radial-gradient(circle_at_50%_50%,rgba(251,191,36,0.12),transparent_68%)]';
const toggleIconWrapClass =
  'relative z-[2] grid size-[18px] place-items-center text-current transition-transform duration-150 ease-[var(--ease-out)] group-hover:scale-105';

export function ThemeToggle() {
  const theme = useThemeStore((state) => state.theme);
  const setThemeInstant = useThemeStore((state) => state.setThemeInstant);
  const isDark = theme === 'dark';
  const transitionTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) {
        window.clearTimeout(transitionTimerRef.current);
      }
    };
  }, []);

  const handleToggle = useCallback(() => {
    const nextTheme = isDark ? 'light' : 'dark';
    const root = typeof document !== 'undefined' ? document.documentElement : null;

    if (root && typeof window !== 'undefined') {
      root.classList.add('theme-soft-transition');
      window.clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = window.setTimeout(() => {
        root.classList.remove('theme-soft-transition');
      }, SOFT_THEME_TRANSITION_MS);
    }

    setThemeInstant(nextTheme);
  }, [isDark, setThemeInstant]);

  return (
    <button className={cx(toggleButtonClass, 'group', isDark ? toggleDarkClass : toggleLightClass)}
      type="button"
     
      onClick={handleToggle}
      role="switch"
      aria-checked={isDark}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      <span className={cx(toggleGlowClass, isDark ? toggleGlowDarkClass : toggleGlowLightClass)} aria-hidden="true" />
      <span className={toggleIconWrapClass} aria-hidden="true">
        {isDark ? <SunIcon /> : <MoonIcon animated />}
      </span>
      <span className="sr-only absolute size-px overflow-hidden whitespace-nowrap border-0 p-0 [clip:rect(0,0,0,0)] [-webkit-clip-path:inset(50%)] [clip-path:inset(50%)]">Toggle theme</span>
    </button>
  );
}
