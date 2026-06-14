import { create } from 'zustand';

// Holds the CURRENT student page's header descriptor so the persistent app-shell
// header bar (rendered once in AppShell, like MobileBottomNav) can show the right
// title/back/mode without each page mounting its own fixed bar. Pages publish
// their descriptor on mount via AppHeader (surface="page") and clear it on
// unmount; the shell bar (surface="shell") reads it, falling back to the
// per-route default so the bar is correct instantly on a hard refresh.
//
// Only serialisable primitives live here (title/subtitle/compact/back/backTo +
// breadcrumb flags) — no React nodes — so comparisons stay cheap and there are
// no re-render loops.
export const useHeaderStore = create((set) => ({
  override: null,
  setOverride: (override) => set({ override }),
  clearOverride: () => set((state) => (state.override === null ? state : { override: null })),
}));
