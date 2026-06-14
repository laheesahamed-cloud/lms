# LMS Performance Audit & Optimization — Prompt (App + Admin only)

> Paste everything in the fenced block below into a fresh Claude Code session
> opened at `/Applications/XAMPP/xamppfiles/htdocs/lms`.
>
> SCOPE: optimize the **student app** (`surfaces/app`) and **admin panel**
> (`surfaces/admin`) only. **Priority = the student app.** Do **NOT** touch or
> optimize the landing/marketing site (`surfaces/website`) — it is isolated and
> out of scope.

```
ROLE
You are a senior web-performance engineer. Audit and optimize the runtime/load
performance of the LOGGED-IN LMS (React 19 + Vite 8 frontend, NestJS 11 backend)
WITHOUT changing features, visual design, or behavior. Measure first, fix in
priority order, re-measure, and write a before/after report.

SCOPE — READ CAREFULLY
- IN SCOPE:  frontend/src/surfaces/app      (student LMS)  ← HIGHEST PRIORITY
             frontend/src/surfaces/admin    (admin panel)  ← second
             frontend/src/shared/**         (only the parts used by app/admin)
             backend/**                     (endpoints serving app/admin)
- OUT OF SCOPE — DO NOT MODIFY OR OPTIMIZE:
             frontend/src/surfaces/website  (landing/marketing page)
             Anything GSAP / cinematic hero / landing imagery.
- The landing is a separate lazy route tree; it never loads inside app/admin, so
  ignore it entirely. The ONLY caveat: if you edit a file in frontend/src/shared
  that the website also imports, make sure your change does not alter the
  website's appearance — but still do not spend effort optimizing the website.

CONTEXT
- Project root: /Applications/XAMPP/xamppfiles/htdocs/lms  (git branch: v3)
- Frontend: frontend/ (Vite 8.0.8, React 19.2.5; built to frontend/dist)
- Backend:  backend/  (NestJS 11.1.19, API on http://localhost:3000/api)
- PRODUCTION app is served by Apache at http://localhost/lms/ (NOT the Vite dev
  server). Apache already gzips. Build with: npm run build --prefix frontend
- Three isolated surfaces, each lazy-loaded: website (out of scope), app, admin.

MEASURED BASELINE (production build, cold cache, headless Chrome, median of 3):
  #/login route:  FCP 1004 ms | 434 KB transferred | 44 requests | 4.2 MB JS heap
  (A lighter sibling app feels ~5x snappier at ~266 KB / 7 requests / 3.8 MB heap.
   It is NOT a target to copy — use only as a "make the app feel light" reference.)
  You must capture fresh baselines for the dashboard and key admin pages yourself.

KNOWN IN-APP ROOT CAUSES (confirm each with data before acting):
  1. Glassmorphism `backdrop-filter: blur()` used app-wide via frontend/src/shared/
     styles (~11 style files) + surfaces/app + surfaces/admin. Heavy GPU paint/
     composite cost; main cause of scroll/interaction lag inside the LMS.
  2. Large shared CSS (~1 MB raw / ~136 KB gz) loaded on app + admin pages.
  3. High request fan-out on app routes (~44 requests on #/login) from code-split
     waterfalls.
  4. html2canvas (~195 KB) — confirm it only loads on pages that export/print.
  NOTE: GSAP and the ~412 KB landing images are website-only — IGNORE them.

HARD CONSTRAINTS
- Performance only. Do NOT change any visible UI, layout, copy, colors, spacing,
  or feature behavior in app/admin. If a change has ANY visual risk, flag it and
  ask before applying.
- Do NOT remove features or routes. Do NOT adopt a single-bundle approach.
- Work on branch v3. Commit nothing unless asked.
- After EVERY change: rebuild, reload via Apache, re-measure the affected route.
  Revert any change that doesn't measurably help or that alters rendering.

MEASUREMENT METHOD (use this exact harness so numbers are comparable)
- playwright-core is installed at frontend/node_modules/playwright-core.
  System Chrome: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome".
- For each route, run 3x with a fresh context (cold cache); report the MEDIAN of:
  First Contentful Paint, load event, total transferSize, request count,
  usedJSHeapSize. Harness shape:

    import pkg from './frontend/node_modules/playwright-core/index.js';
    const { chromium } = pkg;
    const b = await chromium.launch({ executablePath:
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true });
    // newContext() per run; page.goto(url,{waitUntil:'load'}); waitForTimeout(1200);
    // read performance navigation/paint/resource entries + performance.memory.

- Routes to measure BEFORE and AFTER (logged-in pages need auth — log in via the
  UI form or by seeding the auth token/cookie, then navigate):
    APP   (priority):  #/login, #/dashboard, #/courses, a lesson page, a quiz page
    ADMIN:             #/admin (dashboard), admin questions, admin quizzes
- Also record API latency for the slowest endpoints these pages call
  (curl -s -o /dev/null -w "%{time_total}").

FULL SCAN — record findings for app + admin (skip website):
  FRONTEND
   - Bundle: per-chunk raw+gzip sizes; what loads on each app/admin route's
     critical path; modulepreload/waterfall depth; the ~44-request fan-out.
   - CSS: total size, duplication, unused rules on app/admin; map every
     `backdrop-filter` use in shared/ + app + admin — flag ones that are
     off-screen, stacked, large-area, or animate on scroll (worst offenders).
   - Images/icons used inside the app (not landing): format/size/lazy-loading.
   - Fonts: count, formats, preload, subsetting.
   - Runtime: unnecessary re-renders, expensive effects, long lists without
     virtualization, layout thrash on scroll, html2canvas load scope.
   - Service worker / caching headers (sw.js), long-term asset caching.
  BACKEND
   - Slowest app/admin endpoints; N+1 / unindexed queries; payload sizes;
     gzip on API responses; any sync work blocking the event loop.

PRIORITY ORDER (app first; highest-impact, lowest-risk first):
  1. APP: reduce `backdrop-filter` blur layers on student pages to a few hero
     surfaces (kill the scroll/interaction lag) — biggest perceived win.
  2. APP: trim/split shared CSS so app routes don't pull the full ~1 MB.
  3. APP: cut the request fan-out / ensure html2canvas + heavy chunks are
     lazy-loaded only where used.
  4. APP: image/icon + font optimization for in-app assets.
  5. ADMIN: repeat 1-4 for the admin panel.
  6. BACKEND: index/optimize the slowest app/admin queries; ensure API gzip.

DELIVERABLE — write to PERF_REPORT.md in the project root:
  1. Executive summary: before vs after table per route (FCP, transfer, requests,
     heap) + headline % wins, app section first then admin.
  2. Findings: each issue with evidence (numbers), severity, fix applied.
  3. Per-change before/after measurements (prove each win).
  4. Deferred items / anything needing my decision (with the visual-risk reason).
  5. Prioritized "remaining opportunities" list (effort vs impact).

Start by reproducing/extending the baseline for the app routes, then proceed.
Do the student app first; only move to admin once the app is done. Show me the report.
```
