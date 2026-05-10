import { useLayoutEffect } from 'react';
import { useThemeStore } from '../stores/themeStore.js';

export function ThemeBootstrap({ children }) {
  const hydrateTheme = useThemeStore((state) => state.hydrateTheme);

  useLayoutEffect(() => {
    hydrateTheme();
    if (typeof document === 'undefined') return undefined;

    const body   = document.body;
    const loader = document.getElementById('app-boot-loader');
    let dismissed = false;
    let fallbackTimer = 0;

    function dismiss() {
      if (dismissed) return;
      dismissed = true;
      if (fallbackTimer) window.clearTimeout(fallbackTimer);
      // Signal boot complete before touching classes so any lms:anim-done
      // listeners (e.g. LandingPage onLandingBootReady) fire while the event
      // is still catchable and before app-booting is removed.
      window.__lmsAnimDone = true;
      document.dispatchEvent(new Event('lms:anim-done'));
      body.classList.remove('app-booting');
      body.classList.add('app-ready');
      loader?.classList.add('abl-exiting');
      // Remove from DOM after CSS exit animation has fully played out
      window.setTimeout(function () { loader?.remove(); }, 400);
    }

    fallbackTimer = window.setTimeout(dismiss, 1600);

    // If the boot animation is still running, wait for its done signal
    // before dismissing so we don't tear the loader out mid-animation.
    if (window.__lmsAnimDone === false) {
      document.addEventListener('lms:anim-done', dismiss, { once: true });
      return function () {
        if (fallbackTimer) window.clearTimeout(fallbackTimer);
        document.removeEventListener('lms:anim-done', dismiss);
      };
    }

    // Animation already finished (fast machine) — dismiss on next frame
    window.requestAnimationFrame(dismiss);
    return function () {
      if (fallbackTimer) window.clearTimeout(fallbackTimer);
    };
  }, [hydrateTheme]);

  return children;
}
