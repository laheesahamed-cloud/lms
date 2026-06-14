import { useEffect, useRef } from 'react';
import { detectPlatform } from '../platform/detect.js';
import { ImpactStyle, nativeImpact } from '../utils/nativeHaptics.js';

// iOS UINavigationController easing — matches the native route pop curve.
const SNAP_EASING = 'cubic-bezier(0.32, 0.72, 0, 1)';
const SNAP_BACK_MS = 280;
// How far the touch must travel sideways (and stay mostly horizontal) before we
// claim the gesture from the page's own vertical scroll.
const INTENT_SLOP = 10;

/**
 * Interactive "swipe from the left edge to go back" gesture, native app only.
 *
 * The element referenced by `containerRef` follows the finger as the user drags
 * from the screen's left edge. Past `commitRatio` of the screen width it fires a
 * light haptic; on release past that point it clears its inline transform and
 * calls `onBack` in the same tick — handing the actual slide-off to the native
 * route transition (so `onBack` MUST trigger a history pop, e.g. navigate(-1),
 * not a forward push, or the page beneath flies in from the wrong side). Below
 * the threshold it snaps back. On web/PWA this is a no-op — browsers ship their
 * own edge-back gesture.
 *
 * Built as a reusable hook so other student pages with a back action can opt in
 * later by passing their own `containerRef` + `onBack`.
 */
export function useEdgeSwipeBack({
  containerRef,
  onBack,
  enabled = true,
  edgeWidth = 30,
  commitRatio = 0.35,
} = {}) {
  // Hold onBack in a ref so an unstable handler identity (a plain function
  // redefined each render) doesn't re-attach the listeners every render.
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;
    if (!detectPlatform().isNative) return undefined;

    const el = containerRef?.current;
    if (!el) return undefined;

    let tracking = false; // touch began at the left edge
    let active = false; // confirmed horizontal intent — we own the gesture
    let committed = false; // currently past the commit threshold (one-shot haptic)
    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let width = window.innerWidth || el.clientWidth || 1;

    const paint = (dx) => {
      const x = Math.max(0, dx);
      const progress = Math.min(1, x / width);
      el.style.transform = `translate3d(${x}px, 0, 0)`;
      el.style.boxShadow = x > 0
        ? `-${10 + progress * 18}px 0 ${22 + progress * 30}px rgba(0, 0, 0, ${0.18 * progress})`
        : '';
      el.style.filter = x > 0 ? `brightness(${1 - 0.1 * progress})` : '';
    };

    const clearStyles = () => {
      el.style.transition = '';
      el.style.transform = '';
      el.style.boxShadow = '';
      el.style.filter = '';
      el.style.willChange = '';
    };

    const snapBack = () => {
      el.style.transition = `transform ${SNAP_BACK_MS}ms ${SNAP_EASING}, box-shadow ${SNAP_BACK_MS}ms ease, filter ${SNAP_BACK_MS}ms ease`;
      el.style.transform = 'translate3d(0, 0, 0)';
      el.style.boxShadow = '';
      el.style.filter = '';
      const done = () => {
        el.removeEventListener('transitionend', done);
        clearStyles();
      };
      el.addEventListener('transitionend', done);
    };

    const commit = () => {
      // Clear our inline transform and pop in the SAME tick: the native route
      // transition then drives the page off to the right and eases the page
      // beneath in from the left — one coherent animation, no double-slide.
      clearStyles();
      onBackRef.current?.();
    };

    const resetState = () => {
      tracking = false;
      active = false;
      committed = false;
      pointerId = null;
    };

    const onPointerDown = (event) => {
      if (event.pointerType === 'mouse') return; // touch / pen only
      width = window.innerWidth || el.clientWidth || 1;
      if (event.clientX > edgeWidth) return; // left edge only
      tracking = true;
      active = false;
      committed = false;
      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
    };

    const onPointerMove = (event) => {
      if (!tracking || event.pointerId !== pointerId) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;

      if (!active) {
        if (Math.abs(dx) < INTENT_SLOP && Math.abs(dy) < INTENT_SLOP) return;
        // Vertical (scroll) intent or a leftward swipe → let the page have it.
        if (Math.abs(dy) > Math.abs(dx) || dx <= 0) {
          tracking = false;
          return;
        }
        active = true;
        el.style.transition = '';
        el.style.willChange = 'transform';
      }

      event.preventDefault(); // we own the horizontal drag now
      paint(dx);

      const passed = dx >= width * commitRatio;
      if (passed && !committed) {
        committed = true;
        nativeImpact(ImpactStyle.Light);
      } else if (!passed && committed) {
        committed = false;
      }
    };

    const onPointerUp = (event) => {
      if (!tracking || event.pointerId !== pointerId) return;
      const dx = event.clientX - startX;
      const wasActive = active;
      const shouldCommit = wasActive && dx >= width * commitRatio;
      resetState();
      if (!wasActive) return;
      if (shouldCommit) {
        commit();
      } else {
        snapBack();
      }
    };

    const onPointerCancel = (event) => {
      if (!tracking || event.pointerId !== pointerId) return;
      const wasActive = active;
      resetState();
      if (wasActive) snapBack();
    };

    el.addEventListener('pointerdown', onPointerDown, { passive: true });
    el.addEventListener('pointermove', onPointerMove, { passive: false });
    el.addEventListener('pointerup', onPointerUp, { passive: true });
    el.addEventListener('pointercancel', onPointerCancel, { passive: true });

    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerCancel);
      clearStyles();
    };
  }, [containerRef, enabled, edgeWidth, commitRatio]);
}
