# Capacitor "heavy on every click" — Navigation Audit

**Date:** 2026-06-14 · **Scope:** native (iOS/Android Capacitor) student app · **Build dir:** `frontend/dist-capacitor`

## TL;DR

It *is* a real SPA — routes are lazy-loaded and navigation is client-side (`history.pushState`, no full page reload). The "loading so much on each click" feeling is **not** the SPA re-bootstrapping. It comes from three things stacked on top of each other:

1. **Network data refetch on almost every navigation** — the single biggest cause. There is no durable client cache, only 15–30s in-memory TTL caches. On native, every refetch is a real round-trip to a remote API, so each page mount shows a spinner and waits on the network.
2. **First-visit chunk load per route** — one-time per session, but real on a cold app.
3. **Per-route synchronous effect work** — scroll restoration, native status-bar/chrome resync, route-reveal fade — small individually, additive on a slow phone.

The boot batch (`GET /student/boot`) already fixed the *cold start*. The problem is everything *after* boot.

---

## 1. The dominant cost: refetch-on-navigate with a 15–30s cache

Pages fetch in `useEffect` on mount. There is no react-query/SWR — caching is a hand-rolled TTL map:

- `frontend/src/shared/api/cache.js:15` — `createTimedApiCache({ ttlMs })`
- Dashboard TTL **15s** — `frontend/src/shared/api/dashboard.api.js:10`
- Quiz attempts TTL **30s** — `frontend/src/shared/api/quizAttempts.api.js:6`
- Bookmarks TTL **30s** — `frontend/src/shared/api/studyBookmarks.api.js:5`
- Notifications / agenda TTL **15s** — `frontend/src/shared/api/workspace.api.js:12,27`

Each page seeds state from a cache *peek*, then **unconditionally calls `fetchX()` on mount** (e.g. `StudentDashboardPage.jsx:1061`, `StudyPlannerPage.jsx:630`). If the cache entry is older than 15–30s, that's a fresh network call. Real browsing easily exceeds 15s per screen, so in practice **most clicks refetch**.

Why it hurts on native specifically:
- `frontend/src/shared/api/client.js:10` — native API base is a remote HTTP server; **every call is a true network round-trip** (no localhost, no SW fallback).
- The TTL cache is **in-memory only** — killed on every cold app launch. No `localStorage`/SQLite persistence, so the first visit to each screen after reopening the app always hits the network.
- No request **dedup** beyond the boot channel — concurrent mounts of the same data can double-fire.

Dashboard additionally fetches in a **waterfall** (`StudentDashboardPage.jsx:1069` → awaits → quizzes+agenda → awaits → notes+bookmarks), so its mount stalls across 2–3 sequential network stages.

## 2. First-visit chunk load per route (one-time)

`router.jsx` lazy-loads every page (`lazyNamed`, lines 20–80). On native these chunks are local files (`file://` / `capacitor://`) so the *download* is cheap, but the **parse + evaluate** still costs on a slow chip the first time each route is opened.

Mitigation already present: `AppShell.jsx:255–304` warms likely-next routes — but **only once per route per session** (guarded by `warmedRouteKeysRef`, line 268) and deferred to `requestIdleCallback`/post-boot. So this is **not** a growing per-click tax; it's a one-time-per-route cost. (An earlier read overstated this as "120ms per click" — it isn't; it's idle-time, de-duped.)

## 3. Per-route synchronous effects (small, additive)

Run on essentially every `location.pathname` change:

- **Native chrome resync** — `AppFrame.jsx:1046,1077`: `syncNativeChromeSurface()` does `getComputedStyle` reads + CSS-color→hex parsing and calls the StatusBar plugin, fired **twice** per route (immediate + 140ms). Confirmed per-route.
- **Scroll restoration** — `RouteScrollRestoration.jsx`: schedules scroll-to-top up to 3× (sync + rAF + timeout) per push.
- **Route-reveal fade** — `router.jsx:177` adds `animate-panelRouteFade` (full-viewport opacity animation) on every navigation after the first.
- **Semantic annotator** — `AppFrame.jsx:570` runs on native too (gate at line 512); it does an initial DOM walk per subscribe (no MutationObserver on native, so lighter than on web).

Note: `NativeRouteTransition.jsx` is **not** a per-click tax for tab taps — the slide (and its 700ms *fallback* timer at line 89) only engages on chevron push/pop into detail routes (`isChevronRoute`), and normally finishes on `animationend`, not the timeout.

---

## Where the weight actually is (ranked)

| Rank | Cause | Evidence | Per-click? | Fix leverage |
|------|-------|----------|-----------|--------------|
| 1 | Refetch over network when 15–30s TTL expires; in-memory-only cache | `cache.js:15`, `dashboard.api.js:10`, `client.js:10` | **Yes, most clicks** | **High** |
| 2 | Dashboard waterfall fetch (3 sequential stages) | `StudentDashboardPage.jsx:1069` | On dashboard | High |
| 3 | First-visit chunk parse/eval per route | `router.jsx:20`, warmup `AppShell.jsx:255` | One-time/route | Medium |
| 4 | Native chrome resync ×2/route (getComputedStyle + color parse) | `AppFrame.jsx:1046` | Yes | Medium |
| 5 | Scroll restore ×3 + route-reveal fade | `RouteScrollRestoration.jsx`, `router.jsx:177` | Yes | Low |

## Recommended fixes (highest ROI first)

1. **Make the cache durable + stale-while-revalidate.** Persist API responses (localStorage/Capacitor Preferences/SQLite) and *render cached data instantly while refetching in the background* — no spinner on revisit. This alone removes the "loading on every click" feeling.
2. **Raise TTLs for native** to 60–300s, and key invalidation off mutations (after a quiz attempt, planner edit, etc.) instead of a short timer.
3. **Extend the boot-batch pattern** — the `/student/boot` slice cache (`boot.api.js`, `bootChannel.js`) is the right model; serve navigations from it and revalidate in the background rather than re-fetching per page.
4. **Collapse the dashboard waterfall** into one batch/parallel call.
5. **Trim per-route effects on native:** run `syncNativeChromeSurface()` once (drop the +140ms repeat unless the theme actually changed), and collapse scroll-to-top to a single scheduled call.

The architecture is sound — this is a caching/data-freshness problem, not an SPA-vs-MPA problem. Fix #1 (persistent stale-while-revalidate) will give the biggest perceived speedup.
