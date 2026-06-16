# quiz-exam.css — Deletion-Only Cleanup Plan

Target file: `frontend/src/shared/styles/04-pages/quiz-exam.css`
Current size: **2438 lines**
Rule: **delete only** (no new CSS, no rewrites). Delete top-down in phases, rebuild + visually diff between phases.

---

## 0. The exam "summary below the question" fix (already done by deletion)

Cause: the mobile reorder rules in the `@media (max-width:700px), (orientation:portrait) and (max-width:900px)` + `.quiz-focus-mode` block that set `order:1` on the question card and `order:3` on the sidebar.

Status: **already deleted** from source (block now only keeps the sidebar `position:static` reset). With those gone the grid uses natural DOM order → sidebar (summary/progress/navigator) renders **above** the question, for both exam and practice.

Action required: **reinstall / re-run the native app** after `npm run cap:sync`. If it still shows below, the device is running a stale bundle — not a code issue.

---

## Why the file is bloated

The same mobile layout is re-expressed across **5 selector "generations"** of escalating specificity, all inside repeated `max-width:700px` / `380px` media blocks:

| Gen | Selector prefix | Specificity |
|-----|-----------------|-------------|
| A | `.student-app-shell :where(.lms-exam-page, .practice-review-page, .lms-review-page)` | (0,1,0) |
| B | `.student-app-shell .lms-exam-page, …` (comma list) | (0,2,0) |
| C | `body .student-app-shell.student-app-shell .lms-quiz-taking-page.lms-quiz-taking-page :where(…)` | (0,5,1) |
| D | `.student-app-shell .lms-quiz-taking-page :where(…)` | (0,2,0) |
| E | `body .student-app-shell.student-app-shell :where(.lms-exam-page, …)` | (0,4,0) |

The **newest blocks win**: Gen E (`@1781–2060`) has the widest coverage and (0,4,0); Gen C is (0,5,1). They come *last* in source order, so every earlier low-specificity generation (A/B/D) and the duplicated C/E repeats are fully overridden and dead weight. No empty rules, no commented-out blocks, and every referenced class exists (nothing dead by non-existence).

---

## Phase 1 — HIGH confidence (safe, fully overridden / exact repeats)

Delete these ranges. Each is overridden on every shared property by a later, higher-or-equal-specificity block (Gen C @1481+ and Gen E @1781+ survive after them).

| # | Lines | ~Count | What | Reason |
|---|-------|--------|------|--------|
| 1 | 193–333 | 141 | Gen A full layout (#1) | (0,1,0), re-set by C/E |
| 2 | 335–348 | 14 | Gen A 380 (#1) | superseded |
| 3 | 350–493 | 144 | Gen B layout (#2) | (0,2,0), overridden by C/E |
| 4 | 495–514 | 20 | Gen B 380 (#2) | superseded |
| 5 | 567–667 | 101 | Gen A layout (#4) | repeat of #5/Gen E |
| 6 | 669–680 | 12 | Gen A 380 (#4) | superseded |
| 7 | 682–829 | 148 | Gen A layout (#5) | overridden by C/E |
| 8 | 831–843 | 13 | Gen A 380 (#5) | superseded |
| 9 | 845–955 | 111 | Gen C layout (#6) | identical to C #7/#8/#11 |
| 10 | 957–968 | 12 | Gen C 380 (#6) | dup |
| 11 | 970–1091 | 122 | Gen C layout (#7) | line-for-line dup of #8 |
| 12 | 1093–1104 | 12 | Gen C 380 (#7) | dup |
| 13 | 1243–1366 | 124 | Gen D layout (#9) | (0,2,0), overridden by C/E |
| 14 | 1368–1379 | 12 | Gen D 380 (#9) | superseded |
| 15 | 1381–1469 | 89 | Gen B layout (#10) | (0,2,0), overridden by C/E |
| 16 | 1471–1478 | 8 | Gen B 380 (#10) | superseded |

**Phase 1 total: ≈ 1,083 lines.**

> Delete bottom-to-top within this list so earlier line numbers don't shift. Keep one Gen C triplet member (see Phase 2) intact until verified.

---

## Phase 2 — MEDIUM confidence (very likely redundant; verify after Phase 1)

| # | Lines | ~Count | What | Reason |
|---|-------|--------|------|--------|
| 17 | 1106–1228 | 123 | Gen C layout (#8) | near-identical to #6/#7; keep exactly one C block |
| 18 | 1230–1241 | 12 | Gen C 380 (#8) | keep one C-380 |
| 19 | 1481–1580 | 100 | Gen C layout (#11) | redundant if a C block kept |
| 20 | 516–552 | 37 | Gen A padding-only (#3) | values overridden by Gen E full-bleed model |
| 21 | 554–565 | 12 | Gen A padding 380 (#3) | overridden by Gen E 360/380 |

**Phase 2 total: ≈ 284 lines.**

> Among the Gen C triplet (#6 @845, #7 @970, #8 @1106, #11 @1481) keep **one** — the last in source order wins and Gen E @1781 comes after all of them anyway, so any single survivor is fine. Phase 1 already deletes #6 and #7; Phase 2 deletes #8 and #11, leaving Gen E as the effective layout. Verify before committing.

---

## MUST KEEP (unique behavior — do NOT delete)

- `7–148` — focus-mode base + assessment button base.
- `1582–1630`, `1639–1714` — Gen C sidebar-**reveal** (shows summary/nav on mobile; opposite of the layout blocks).
- `1716–1779` — Gen E sidebar reveal.
- `1781–2075` — **Gen E definitive mobile layout** (full-bleed card model, nav state colors, dark-theme `is-current`/`is-idle`).
- `2077–2164` — desktop/tablet widths + nav column counts.
- `2166–2239` — focus-mode sticky sidebar + the (now order-free) mobile block.
- `2241–2338` — final button / nav-bubble sizing overrides (last word at top level).
- `2340–2438` — quiz topbar + spacer + `.lms-quiz-take` padding-zero.

---

## Totals

| Set | Lines removed | File after |
|-----|---------------|-----------|
| Phase 1 (high) | **≈ 1,083** | ≈ 1,355 |
| Phase 1 + 2 (high+medium) | **≈ 1,367** (~56%) | ≈ 1,071 |

---

## Verification checklist (between phases)

1. `npm run cap:sync` (rebuild) after each phase.
2. Check **exam**, **practice-take**, and **results-review** screens at widths **700px** and **380px**.
3. Special eye on the **results ReviewPage** — it has `lms-review-page` but **not** `lms-quiz-taking-page`, so it relies on Gen E (`@1781`, includes `.lms-review-page`) for its mobile layout after Gens A/B/D are gone. Confirm it still lays out.
4. Confirm summary/progress/navigator sits **above** the question on mobile (the requested behavior) on both exam and practice.
