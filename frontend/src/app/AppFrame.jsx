import { useLayoutEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { cx, ui } from '../styles/tailwindClasses.js';

function setStyleIfChanged(element, property, value) {
  if (element.style[property] !== value) {
    element.style[property] = value;
  }
}

export function AppFrame() {
  // Tell the boot overlay that React has mounted and the first route is rendered.
  // The boot script in index.html waits for this signal before dissolving the
  // overlay, which prevents the blank-page gap on slow/low-end machines where
  // JS parsing takes longer than the fixed boot animation timer.
  useLayoutEffect(() => {
    if (typeof document === 'undefined') return;
    window.__lmsReactReady = true;
    document.dispatchEvent(new Event('lms:react-ready'));
  }, []);

  const location = useLocation();
  const isAuthRoute =
    location.pathname.startsWith('/auth/') ||
    location.pathname === '/login' ||
    location.pathname === '/register';

  useLayoutEffect(() => {
    if (typeof document === 'undefined') return;
    if (typeof window.__lmsUnlockScroll === 'function') {
      window.__lmsUnlockScroll();
    }

    const root = document.getElementById('root');
    const scrollRoots = [document.documentElement, document.body, root].filter(Boolean);

    scrollRoots.forEach((element) => {
      setStyleIfChanged(element, 'height', 'auto');
      setStyleIfChanged(element, 'minHeight', '100%');
      setStyleIfChanged(element, 'overflowX', 'hidden');
      setStyleIfChanged(element, 'overflowY', 'auto');
    });

    document.querySelectorAll('.portal-shell, .portal-content, .portal-content__frame').forEach((element) => {
      setStyleIfChanged(element, 'height', 'auto');
      setStyleIfChanged(element, 'minHeight', '100dvh');
      setStyleIfChanged(element, 'maxHeight', 'none');
      setStyleIfChanged(element, 'overflowX', 'hidden');
      setStyleIfChanged(element, 'overflowY', 'visible');
    });
  }, [location.pathname, location.search]);

  return (
    <div className={cx(ui.routeScene, isAuthRoute && ui.authRouteScene)}>
      <div className="main-glow" aria-hidden="true" />
      <Outlet />
    </div>
  );
}
