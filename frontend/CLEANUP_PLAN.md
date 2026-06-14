# Code Cleanup Plan — ERPM LMS Frontend

> **Goal:** Remove only unwanted / junky / buggy / performance-harming code.
> **Hard constraint:** ZERO visual change. The UI must look and behave identically before and after every step.
> **No new code** unless a deletion would break the build and a tiny shim is the only fix — and even then, ask first.
> Work **one page at a time, top to bottom**. When in doubt about whether something is safe to delete, **PAUSE and ASK** before touching it.

---

## The Golden Rules (read before every session)

1. **Visual parity is sacred.** If a change could alter layout, color, spacing, animation, or behavior — it is NOT in scope. Skip it.
2. **Delete, don't add.** This pass removes code. New code is only allowed if removal breaks the build, and only after asking.
3. **Cross-file safety first.** ESLint here is clean (`no-unused-vars` is on but only sees one file at a time). The real junk is *cross-file*: orphaned modules never imported, exports nobody uses, duplicate helpers. Always verify with a repo-wide reference search before deleting.
4. **One concern, one commit.** Each deletion batch must be independently revertable.
5. **When unsure → STOP and ASK.** A single line of "is this safe to delete?" is cheaper than a regression.

---

## What counts as "junk" here (in priority order)

| # | Category | How to detect | Risk |
|---|----------|---------------|------|
| 1 | **Orphaned files** — modules never imported anywhere | grep the basename across `src/`; 0 hits = orphan | Low–Med |
| 2 | **Dead exports** — exported fn/const/component nobody imports | grep the export name across `src/` | Low–Med |
| 3 | **Unused vars / imports within a file** | `npm run lint` (warns) | Very low |
| 4 | **Dead / commented-out code blocks** | visual read of the file | Very low |
| 5 | **Leftover debug** — `console.*`, `debugger`, temp logging | `grep -rn 'console\.\|debugger'` | Very low |
| 6 | **Duplicate helpers** — same util reimplemented in 2+ places | manual, while reading each page | Med |
| 7 | **Dead CSS** — selectors/classes not present in any JSX | grep class name across `src/` | **High** (easy to break visuals) |
| 8 | **Performance** — needless re-renders, missing `useMemo`/`useCallback` only where it's a clear win and behavior-identical, inline object/array props causing churn, oversized effect deps | manual read | Med–High |

> ⚠️ Categories 7 and 8 are the dangerous ones for "no visual change." Treat dead-CSS removal and perf edits as **ask-first** unless the deadness is 100% provable (selector literally has 0 references anywhere).

---

## Per-page procedure (repeat for every page)

For each page in the checklist below:

1. **Map it.** List the page's own files (component, css, hooks, helpers).
2. **Baseline.** Note current behavior; if previewable, take one snapshot/screenshot to compare against later.
3. **Scan** for the 8 junk categories above, *scoped to this page's files*.
4. **Classify each finding:**
   - ✅ **Safe** (provably dead, no visual impact) → delete.
   - ❓ **Doubt** (could be referenced dynamically, could affect visuals) → **list it and ASK the user.**
5. **Delete the ✅ items** in one batch.
6. **Verify:** `npm run lint`, then `npm run build` must pass. If previewable, re-check the snapshot = visually identical.
7. **Record** what was removed in the "Log" section at the bottom of this file.
8. **Commit** (only when the user asks to commit) with a scoped message.
9. Move to the next page.

### Things that are NOT safe to assume dead (always ask)
- Strings used in dynamic imports, `React.lazy`, route tables, or `data-*` driven lookups.
- CSS classes referenced via template literals / conditional class builders (e.g. `clsx`, string concat).
- Anything referenced by the backend, build scripts, capacitor/PWA, or service worker.
- Exports consumed by `surfaces/admin`, `surfaces/website`, desktop, or ios-native code outside `src/`.

---

## Page-by-page checklist

Legend: `[ ]` not started · `[~]` in progress · `[?]` waiting on user · `[x]` done

### Student app — `src/surfaces/app/student/`
- [x] dashboard
- [x] courses
- [x] study
- [x] quizzes
- [x] results
- [x] flashcards
- [x] notes
- [x] ai-notes
- [x] planner
- [x] library
- [x] bookmarks
- [x] notifications
- [x] billing
- [x] components (shared student components)

### Admin — `src/surfaces/admin/pages/`
- [x] dashboard
- [x] courses
- [x] structure
- [x] questions
- [x] quizzes
- [x] ai-notes
- [x] users
- [x] subscriptions
- [x] finance
- [x] announcements
- [x] reports
- [x] settings
- [x] setup

### Website — `src/surfaces/website/`
- [x] LandingPage
- [x] TermsPage / PrivacyPolicyPage / CookiePolicyPage / RefundPolicyPage
- [x] ai / auth / components / content

### Shared (do LAST — highest blast radius) — `src/shared/`
- [x] api · auth · stores · hooks · utils
- [x] components · ui · layout
- [x] styles (CSS — most dangerous, ask-first)
- [x] notifications · pwa · search · seo · security · platform · routing · popup · launch · brand · account · pages · assets

### App shell — `src/app/`
- [x] App / AppFrame / AppRuntime / router / providers / bootstraps

---

## Safety tooling (commands)

```bash
# is a file orphaned? (run from frontend/)
grep -rn "ThatFileBaseName" src --include='*.jsx' --include='*.js'

# is an export used anywhere?
grep -rn "exportedName" src

# is a CSS class referenced anywhere?
grep -rn "the-class-name" src

# leftover debug
grep -rn -E "console\.|debugger" src --include='*.jsx' --include='*.js'

# gates that must stay green after every batch
npm run lint
npm run build
```

---

## Decisions log (questions asked & answered)
<!-- Record each "ask the user" item and the resolution here -->
- **Scope (2026-06-10):** App is very clean. User chose *page-by-page as planned*.
- **10 dead exports in shared/ (2026-06-10):** verified unused project-wide. User chose *Delete all 10* (incl. the 3 API wrappers).

## Removal log (what was deleted, per page)
<!-- page | files/lines removed | why safe | build green? -->
- **quizzes / TakeQuizPage.jsx** — removed dead `const practiceQuizSideNavClass` (className string, 0 references app-wide). No render output → zero visual change. Lint 1→0 warnings, build GREEN.
- **student/library/** & **website/content/** — removed two empty, unreferenced directories.
- **shared/ — 10 dead exported functions removed** (all verified unused project-wide, none called → zero visual/behavioral change). Build GREEN, lint 0:
  - `PlatformSlot` (platform/PlatformProvider.jsx) + its now-unused `usePlatformComponent` import
  - `selectPlatformComponent` (platform/select.js)
  - `subscribeToNetworkActivity`, `getNetworkActivityCount` (stores/networkActivityStore.js)
  - `getVideoThumbnail` (utils/videoEmbed.js)
  - `fetchPushSettings` (api/pushNotifications.api.js)
  - `adminGetLessons`, `adminGetLessonCanvases` (api/aiNotes.api.js)
  - `stopAnnouncementLocalSync` (notifications/announcementLocalSync.js)
  - `isLocalNotificationsSupported` (platform/native/LocalNotifications.js)

### Status: cleanup pass COMPLETE — all 27 pages + shared/ + app/ scanned. No further safe deletions remain without refactoring (which is out of scope).

## Repo-wide scan results (baseline, 2026-06-10)
- ESLint: **1 warning total** (now fixed → 0). Codebase is essentially lint-clean.
- Orphan JS/JSX files (never imported): **0**
- Dead CSS files (never imported): **0**
- `console.*` / `debugger`: **0** in src
- `.bak` / `.old` / `.orig` / copy/backup files: **0**
- TODO/FIXME/HACK: 1
- **Conclusion:** the surface-level junk this plan targets is nearly absent. Remaining opportunities are deeper (dead exports within used files, duplicate helpers, perf) and carry higher visual-regression risk → handle ask-first, page by page.
