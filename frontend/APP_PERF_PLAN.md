# App Performance Plan — Capacitor (native) student app

**Status:** P0.1 + P0.2 applied & confirmed working on device (2026-06-15). Remaining:
P0.3, P1.x, P2.7 (frontend, optional) and P3 (backend — biggest remaining win).
**Scope:** Why the Capacitor app "feels sluggish" everywhere, and the ranked fixes.
**Date:** 2026-06-15

---

## TL;DR

The frontend is already well-optimized (SWR cache, parallel fetches, lazy routes,
service worker + a11y observer disabled on native, optimistic auth snapshot). The
dominant remaining cost is **backend/API latency** — a no-op `/api/health` returns in
**~1s server-side** (measured: ttfb 1.0–3.1s). No frontend change removes that; the
frontend can only **mask** it. The genuine frontend gaps are: two screens missing
stale-while-revalidate, no list virtualization, a heavy always-mounted header, and
per-navigation layout reflow.

**Ceiling:** first load of any *uncached* screen waits on the API. Optimize the backend
(P3) for the biggest cold-load win; optimize the frontend (P0–P2) to make warm
navigation feel instant.

---

## Evidence gathered (read-only)

| Area | Finding | Source |
|---|---|---|
| API latency | no-op health endpoint ttfb 1.0–3.1s | `curl https://xyndrome.lk/api/health` x3 |
| UI delivery | loads locally, not remote | `capacitor.config.ts` → `webDir: dist-capacitor`, no `server.url` |
| Animation libs | GSAP + framer-motion are **website-only**, lazy | imports only under `surfaces/website/` |
| html2canvas | lazy `await import`, admin-only | `AdminAiNotesEditorPage.jsx:802` |
| Caching | SWR (90s TTL / 5min stale) on native | `shared/api/cache.js` |
| SWR coverage | dashboard, quizzes, bookmarks, planner, aiNotes have `persistKey`; **courses + subscriptions do NOT** | `grep persistKey shared/api` |
| Dashboard fetch | 3 primary calls parallel + secondary idle-deferred (good) | `StudentDashboardPage.jsx:1067-1096` |
| Virtualization | **none** (`react-window`/`virtuoso`/`useVirtualizer` absent) | repo-wide grep |
| Always-mounted header | `AppHeader.jsx` = 1468 lines, on every screen | `wc -l shared/layout` |
| Per-request auth | `requireStudent/requireAdmin` hits DB on every `/api/student|admin` call | `backend/src/main.ts:634-637` |
| AppFrame | 1148 lines, per-nav scroll read/write reflow | `app/AppFrame.jsx:930+` |

---

## Plan (ranked)

### P0 — Make warm navigation feel instant (mask API latency)

- **P0.1 — Add `persistKey` (SWR) to `courses.api.js` and `subscriptions.api.js`. ✅ DONE (2026-06-15).**
  Added `persistKey: 'student.courses'`, `'student.course-detail'`, and
  `'student.subscription'` to the existing cache calls. These screens now paint
  instantly from cache on revisit and refresh in the background on native (matching
  the dashboard). *Impact: high · Effort: tiny.*
  Also removed the dead `.planner-agenda-tools` CSS (orphaned by the collapsible
  filter rebuild) — 3 blocks, 0 JSX refs, zero visual change.
- **P0.2 — Startup route-warming. ✅ DONE (2026-06-15).** Root cause of the
  "Loading Courses…" chunk-load spinner on every cold launch: AppShell's native warm
  branch waited for an `lms:boot-complete` event that is **never dispatched** (and
  `__lmsBootComplete` is never set), so `warm()` never ran on native → no tab was ever
  preloaded. Deleted the dead branch so native falls through to the existing
  `requestIdleCallback` path (already native-tuned). Now `/courses` + `/quizzes` warm
  shortly after launch, before the user taps. *Impact: high perceived · Effort: tiny
  (pure deletion of dead code).*
  **Second bug (same feature), fixed 2026-06-15:** the warm-list filter compared
  unprefixed paths (`/dashboard`) against the prefixed `location.pathname`
  (`/app/dashboard`), so the current page was never excluded — it wasted a warm slot.
  On iPhone the preload limit is small (often 1), so that one slot went to the
  already-loaded dashboard and Courses never warmed → spinner persisted. Fixed by
  normalizing `location.pathname` (strip `/app|/admin|/student`) before the compare, so
  the slot now goes to a real next destination (Courses).
  **Third change (warm all tabs), 2026-06-15:** native phones only got 1–2 warm slots,
  so only the first tab warmed. Since native loads chunks from local files (no network
  cost), raised `getRoutePreloadLimit()` for `runtime === 'native'` to 8 (phone) / 11
  (tablet) so the full set of main tabs warms after launch. Web/PWA limits unchanged.
- **P0.3 — Per-screen waterfall sweep.** Dashboard already parallelizes; audit other
  screens' effects for sequential `await`s and parallelize them. *Impact: medium ·
  Effort: medium.*
- **P0.4 — Make Courses pre-loaded like Lessons. ✅ DONE (2026-06-15).** Root cause of
  "Courses detail loads one more time": Lessons arrives fully in the `/student/boot`
  batch, but Courses isn't in the batch AND course detail is a separate per-course
  fetch (`student/courses/:id`) never pre-loaded. Fix (frontend-only): (1) dashboard
  idle block now warms the course-LIST cache at launch (`fetchStudentCourses`), so
  opening Courses is instant; (2) `StudentCoursesPage` pre-fetches each course's DETAIL
  at idle (capped at 8, staggered 500ms) via cache-backed `fetchStudentCourseDetail`,
  so opening a course is instant. *Impact: high perceived · Effort: low.*

### P1 — Real runtime cost

- **P1.4 — List virtualization** for long lists (question bank, flashcards, results,
  planner agenda). Currently every row is a live DOM node — biggest true runtime win
  and the likely "scrolling feels heavy." *Impact: high · Effort: medium-high.*
- **P1.5 — Slim the always-mounted header.** `AppHeader.jsx` (1468 lines) re-renders on
  every navigation; lazy-split the embedded `GlobalSearch` (369 lines) and memoize.
  *Impact: medium · Effort: medium.*
- **P1.6 — Batch AppFrame scroll reads/writes** to remove per-navigation layout
  reflow. *Impact: medium · Effort: low-medium.*

### P2 — Cold start

- **P2.7 — Trim eager `app-shared` (~300 KB).** Code-split heavy always-loaded pieces
  out of the startup chunk so the WebView parses less before first paint.
  *Impact: medium · Effort: medium.*

### P3 — The ceiling (backend; not a frontend change)

- **P3.8 — Backend response time.** ~1s on a no-op + a per-request DB auth lookup on
  every authenticated call. Returns more than all frontend work combined for *cold*
  loads. Investigate hosting (idle-suspend / CPU throttle on cPanel Node) and the
  per-request auth lookup. *Impact: highest for cold load.*

---

## Symptom → most likely fix

| Symptom | Primary fix |
|---|---|
| Every screen spinners on first open | P3 (API); mask via P0 |
| Revisiting screens still reloads | P0.1 |
| Scrolling/lists feel heavy | P1.4 |
| Tapping between screens lags | P0.2, P1.5, P1.6 |
| App launch slow (tap icon → usable) | P2.7 + WebView floor |

---

## Recommended order

1. **Profile on device** (see below) to confirm which symptom dominates.
2. P0.1 (tiny, immediate win) → P0.2 → P1.4.
3. Re-measure. Decide whether P3 (backend) is the real ceiling for your usage.
