import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigationType, useOutlet } from 'react-router-dom';
import { detectPlatform } from '../platform/detect.js';
import { getHistoryIndex } from './safeBack.js';
import { isChevronRoute } from './isChevronRoute.js';
import { cx } from '../styles/tailwindClasses.js';

// Simple iOS-style carousel page transition, NATIVE runtime only.
//
// On a chevron push the incoming page slides in from the right while the
// outgoing page parallaxes left; on a pop the outgoing page slides off to the
// right while the page beneath eases back in from the left. The outgoing page is
// kept mounted ONLY for the duration of the slide (1-deep, dropped on finish) —
// there is no swipe gesture, no keep-alive, no per-layer header replica and no
// custom scroll handling. Scroll restore is left to RouteScrollRestoration.
//
// Off-native this is a no-op: it returns the plain Outlet, so web/desktop keep
// their existing route fade untouched.

const IS_NATIVE = detectPlatform().isNative;

function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function NativeRouteTransition() {
  const outlet = useOutlet();
  if (!IS_NATIVE) return outlet;
  return <NativeStack outlet={outlet} />;
}

function NativeStack({ outlet }) {
  const location = useLocation();
  const navType = useNavigationType();

  // Element committed last render — at navigation-render time this still points
  // at the outgoing page's element, so we can keep it mounted for the slide.
  const lastElementRef = useRef(outlet);

  const [stack, setStack] = useState(() => ({
    curKey: location.key,
    curPath: location.pathname,
    previous: null, // { key, element } — mounted only while sliding
    direction: 'push',
    phase: 'idle', // 'idle' | 'enter'
    lastIdx: getHistoryIndex(),
  }));

  // Detect navigation during render (derive-state-from-props), keeping the
  // outgoing element referentially stable for the slide.
  if (stack.curKey !== location.key) {
    const fromPath = stack.curPath;
    const toPath = location.pathname;
    const idx = getHistoryIndex();
    const direction = navType === 'POP' || idx < stack.lastIdx ? 'pop' : 'push';
    // Slide when pushing INTO a chevron page or popping OUT of one; plain
    // tab-taps don't slide.
    const slide =
      !prefersReducedMotion() &&
      ((direction === 'push' && isChevronRoute(toPath)) ||
        (direction === 'pop' && isChevronRoute(fromPath)));
    setStack({
      curKey: location.key,
      curPath: toPath,
      previous: slide ? { key: stack.curKey, element: lastElementRef.current } : null,
      direction,
      phase: slide ? 'enter' : 'idle',
      lastIdx: idx,
    });
  }

  useLayoutEffect(() => {
    lastElementRef.current = outlet;
  });

  const finishEnter = useCallback(() => {
    setStack((prev) => (prev.phase !== 'enter' ? prev : { ...prev, phase: 'idle', previous: null }));
  }, []);

  // Lock the shared scroller and mark the slide. The lock toggles in this same
  // layout effect (pre-paint) so it releases in the same commit the layers flip
  // back to normal flow — no settle jump. The timeout is a fallback in case the
  // CSS animationend doesn't fire.
  useLayoutEffect(() => {
    if (typeof document === 'undefined') return undefined;
    document.body.classList.toggle('lms-route-animating', stack.phase === 'enter');
    if (stack.phase !== 'enter') return undefined;
    const timer = window.setTimeout(finishEnter, 700);
    return () => window.clearTimeout(timer);
  }, [stack.phase, finishEnter]);

  const animating = stack.phase === 'enter';

  // Only the layer's OWN slide animation finishes the transition (animationend
  // bubbles, so child animations must be ignored).
  const handleAnimationEnd = useCallback(
    (e) => {
      if (e.target === e.currentTarget) finishEnter();
    },
    [finishEnter],
  );

  return (
    <div className={cx('lms-route-stack', animating && 'is-animating')} data-direction={stack.direction}>
      {stack.previous ? (
        <div key={stack.previous.key} className="lms-route-layer is-previous" aria-hidden="true">
          <div className="lms-route-layer__frozen">{stack.previous.element}</div>
        </div>
      ) : null}
      <div
        key={location.key}
        className="lms-route-layer is-current"
        onAnimationEnd={animating ? handleAnimationEnd : undefined}
      >
        <div className="lms-route-layer__frozen">{outlet}</div>
      </div>
    </div>
  );
}
