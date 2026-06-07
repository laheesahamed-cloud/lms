import { useEffect, useRef, useState } from 'react';

export function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/**
 * Animates a number from 0 → target once `active` is true (cubic ease-out, rAF).
 * Jumps straight to the target when the user prefers reduced motion.
 */
export function useCountUp(target, { duration = 1200, active = true, decimals = 0 } = {}) {
  const [value, setValue] = useState(0);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!active) return undefined;
    const end = Number(target) || 0;
    if (prefersReducedMotion()) {
      setValue(end);
      return undefined;
    }
    const factor = 10 ** decimals;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - p) ** 3;
      setValue(Math.round(end * eased * factor) / factor);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration, active, decimals]);

  return value;
}
