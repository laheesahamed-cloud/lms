import { createContext } from 'react';

// Marks a subtree as the OUTGOING / parked page during a native route
// transition. AppHeader reads this to skip portaling its fixed bar to <body>
// so that only the current page's header bar is ever present (no double-bar
// flicker while two pages are briefly mounted together).
export const RouteTransitionLayerContext = createContext({ outgoing: false });

export const OUTGOING_LAYER = { outgoing: true };

// Wraps the CURRENT (top) layer's page. Structurally it mirrors OUTGOING_LAYER's
// Provider so the two layers have an identical element tree at the same position.
// On a pop hand-off the previous layer (Provider OUTGOING > page) becomes the
// current layer (Provider CURRENT > page): because both sides are the SAME
// Provider type, React reconciles through it and REUSES the page subtree instead
// of unmounting a Provider and mounting a bare page — which would remount the
// destination (blank flash + scroll reset + header re-portal) on every swipe.
export const CURRENT_LAYER = { outgoing: false };

// Set true by NativeRouteTransition immediately before a swipe-back navigate(-1).
// The interactive drag has ALREADY produced the full visual transition, so the
// destination route must render WITHOUT re-running RouteReveal's panel fade —
// otherwise the freshly-mounted page fades in on top of the dragging layers
// tearing down, which reads as a flicker of "different pages" at commit.
// RouteReveal reads and clears it on its next render (one-shot).
let _suppressNextRouteReveal = false;
export function markGestureCommitPop() {
  _suppressNextRouteReveal = true;
}
// Peek during render (decides the fade class); clear once in an effect so a
// StrictMode/double render doesn't lose the signal between the two renders.
export function peekGestureCommitPop() {
  return _suppressNextRouteReveal;
}
export function clearGestureCommitPop() {
  _suppressNextRouteReveal = false;
}
