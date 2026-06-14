/**
 * Platform-aware scroll behavior (NAT-006).
 *
 * Native iOS/Android phones should move instantly: a long animated
 * `behavior: 'smooth'` glide fights the user's finger and reads as web-like.
 * Web/desktop keep smooth scrolling unless the user prefers reduced motion.
 *
 * The native phone signal is read from the documentElement dataset, which
 * `applyPlatformAttributes()` keeps in sync — no React/platform import needed,
 * so this is safe to call from anywhere including module scope.
 */
export function isNativePhone() {
  if (typeof document === 'undefined') return false;
  const root = document.documentElement;
  return root?.dataset?.lmsRuntime === 'native' && root?.dataset?.lmsFormFactor === 'phone';
}

export function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Returns the ScrollBehavior to use for programmatic scrolling:
 * - 'auto' on native phone (instant, native-feeling)
 * - 'auto' when the user prefers reduced motion
 * - 'smooth' otherwise (web/desktop)
 */
export function getPreferredScrollBehavior() {
  if (typeof window === 'undefined') return 'auto';
  if (isNativePhone()) return 'auto';
  return prefersReducedMotion() ? 'auto' : 'smooth';
}
