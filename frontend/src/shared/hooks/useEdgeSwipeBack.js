import { useEffect, useRef } from 'react';
import { detectPlatform } from '../platform/detect.js';
import { ImpactStyle, nativeImpact } from '../utils/nativeHaptics.js';

// iOS UINavigationController easing — matches the native route pop curve.
const SNAP_EASING = 'cubic-bezier(0.32, 0.72, 0, 1)';
const SNAP_BACK_MS = 280;
// How far the touch must travel before we lock the gesture's axis. A bit of
// travel lets the browser's own pan-y axis-lock settle first, so a soft touch
// doesn't engage mid-scroll (the cause of the scroll-vs-swipe flicker).
const INTENT_SLOP = 14;
// Direction cone: only claim the swipe as "back" when it's CLEARLY horizontal
// (|dy| <= dx * this). 0.6 ≈ 31°. Anything more diagonal is released to scroll —
// this is what stops the fight: we never slide horizontally while the browser is
// also scrolling vertically. A deliberate (even light) sideways swipe is well
// within this cone, so light touches still trigger.
const MAX_VERTICAL_RATIO = 0.6;
// A quick rightward flick commits even if it never reached the distance
// threshold — so a short, fast swipe goes back instead of snapping back.
const FLICK_VELOCITY = 0.45; // px/ms (≈ 450 px/s)
const FLICK_MIN_DX = 24; // but require at least this much horizontal travel

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
  commitRatio = 0.3,
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

    // Let the browser natively own vertical scrolling on this element. With
    // pan-y the browser locks the gesture axis from the first move: a mostly-
    // vertical touch scrolls (and we get a pointercancel), a horizontal one is
    // delivered to us — so scroll and swipe can no longer fight each other.
    const prevTouchAction = el.style.touchAction;
    el.style.touchAction = 'pan-y';

    let tracking = false; // touch began at the left edge
    let active = false; // confirmed horizontal intent — we own the gesture
    let committed = false; // currently past the commit threshold (one-shot haptic)
    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let width = window.innerWidth || el.clientWidth || 1;
    // Rolling horizontal velocity (px/ms) from the last two moves, for flick
    // detection on release.
    let lastX = 0;
    let lastT = 0;
    let velX = 0;
    // The drag only ever writes `transform` (GPU-composited), batched to one
    // write per frame via rAF — no per-frame box-shadow/filter repaint, which is
    // what made it stutter. The shadow is painted ONCE when the drag starts and
    // then just rides along on the same composited layer.
    let rafId = 0;
    let pendingX = 0;

    const flush = () => {
      rafId = 0;
      el.style.transform = `translate3d(${pendingX}px, 0, 0)`;
    };

    const paint = (dx) => {
      pendingX = Math.max(0, dx);
      if (!rafId) rafId = window.requestAnimationFrame(flush);
    };

    const cancelRaf = () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
    };

    const clearStyles = () => {
      cancelRaf();
      el.style.transition = '';
      el.style.transform = '';
      el.style.boxShadow = '';
      el.style.willChange = '';
    };

    const snapBack = () => {
      cancelRaf();
      el.style.transition = `transform ${SNAP_BACK_MS}ms ${SNAP_EASING}, box-shadow ${SNAP_BACK_MS}ms ease`;
      el.style.transform = 'translate3d(0, 0, 0)';
      el.style.boxShadow = '';
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
      lastX = event.clientX;
      lastT = event.timeStamp;
      velX = 0;
    };

    const onPointerMove = (event) => {
      if (!tracking || event.pointerId !== pointerId) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;

      if (!active) {
        const adx = Math.abs(dx);
        const ady = Math.abs(dy);
        if (adx < INTENT_SLOP && ady < INTENT_SLOP) return; // wait for a clear intent
        // Lock the axis once. Claim only a rightward, mostly-horizontal swipe
        // (within the cone, ties favour back). A leftward or more-vertical swipe
        // is released so the browser's pan-y scroll keeps it.
        if (dx <= 0 || ady > adx * MAX_VERTICAL_RATIO) {
          tracking = false;
          return;
        }
        active = true;
        el.style.willChange = 'transform';
        // Ease the edge shadow in once (transform stays untransitioned so it
        // still tracks the finger). Avoids the hard shadow "pop" on engage.
        el.style.transition = 'box-shadow 140ms ease';
        el.style.boxShadow = '-8px 0 28px rgba(0, 0, 0, 0.22)';
      }

      event.preventDefault(); // we own the horizontal drag now
      paint(dx);

      const dt = event.timeStamp - lastT;
      if (dt > 0) velX = (event.clientX - lastX) / dt;
      lastX = event.clientX;
      lastT = event.timeStamp;

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
      // Commit on enough distance OR a quick rightward flick.
      const flicked = velX >= FLICK_VELOCITY && dx >= FLICK_MIN_DX;
      const shouldCommit = wasActive && (dx >= width * commitRatio || flicked);
      // A flick can commit before the distance threshold ever fired the haptic.
      if (shouldCommit && !committed) nativeImpact(ImpactStyle.Light);
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
      el.style.touchAction = prevTouchAction;
      clearStyles();
    };
  }, [containerRef, enabled, edgeWidth, commitRatio]);
}
