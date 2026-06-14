# UI/UX Consistency Audit — ERPM LMS (Capacitor iOS Student App)

**Date:** 2026-06-11
**Scope:** 48 device screenshots across 6 flows (courses, course detail, header dropdowns, Q-Bank, quiz-taking, results, study hub, study, AI notes, flashcards, planner).
**Screenshot root:** `/Users/laheez/Desktop/screenshot app/`
**Device:** iPhone with Dynamic Island, dark mode.

> **How to use this file:** Every issue references the app route URL, the page component, and the absolute path of the screenshot(s) proving it. Read the screenshot with the Read tool before fixing — paths contain spaces and colons, pass them exactly as written.

## Route ↔ Screenshot map

| Route (native app) | Page component | Screenshot source(s) |
|---|---|---|
| `/app/courses` | `src/surfaces/app/student/courses/StudentCoursesPage.jsx` | `/Users/laheez/Desktop/screenshot app/courses/course 1.png`, `/Users/laheez/Desktop/screenshot app/courses/course 2.png` |
| `/app/courses/:courseId` | `src/surfaces/app/student/courses/CourseDetailPage.jsx` | `/Users/laheez/Desktop/screenshot app/courses/course:obstetrics and gynacology/IMG_6640.png` … `IMG_6644.png` |
| (header, all routes) | `src/shared/layout/AppHeader.jsx` | `/Users/laheez/Desktop/screenshot app/header drop down/USER AVATHAR dropdown.png`, `/Users/laheez/Desktop/screenshot app/header drop down/notification drop down.png`, `/Users/laheez/Desktop/screenshot app/header drop down/search drop down.png` |
| `/app/quizzes` | `src/surfaces/app/student/quizzes/StudentQuizzesPage.jsx` | `/Users/laheez/Desktop/screenshot app/quiz/quiz 1.png`, `/Users/laheez/Desktop/screenshot app/quiz/quiz 2.png`, `/Users/laheez/Desktop/screenshot app/quiz/quiz:medicine.png`, `/Users/laheez/Desktop/screenshot app/quiz/quiz:medicine:lesson -wise.png`, `/Users/laheez/Desktop/screenshot app/quiz/quiz:medicine:topic wise.png` |
| `/app/quizzes/:quizId` | `src/surfaces/app/student/quizzes/TakeQuizPage.jsx` | `/Users/laheez/Desktop/screenshot app/quiz/quiz taking page loading.png`, `/Users/laheez/Desktop/screenshot app/quiz/quiz taking page1.png` … `page5.png` |
| `/app/results` | `src/surfaces/app/student/results/ResultsListPage.jsx` | `/Users/laheez/Desktop/screenshot app/results /results 1.png`, `results 2.png`, `results 3.png` (note: folder name has a trailing space) |
| `/app/dashboard` (Study Hub) | `src/surfaces/app/student/dashboard/StudentDashboardPage.jsx` | `/Users/laheez/Desktop/screenshot app/study hub/study hub 1.png` … `study hub 4.png`, `/Users/laheez/Desktop/screenshot app/study hub/Istudy hub 5.png` |
| `/app/study` | `src/surfaces/app/student/study/StudentStudyPage.jsx` | `/Users/laheez/Desktop/screenshot app/study/study 1.png`, `study 2.png` |
| `/app/ai-notes` (Lessons list) | `src/surfaces/app/student/ai-notes/AiNotesListPage.jsx` | `/Users/laheez/Desktop/screenshot app/study/study:ai notes/study->ai notes 1.PNG`, `study->ai notes 2.PNG`, `/Users/laheez/Desktop/screenshot app/study/study:ai notes/ainotes:medicine/IMG_6645.png` … `IMG_6647.png` |
| `/app/ai-notes/:id` (Note canvas) | `src/surfaces/app/student/ai-notes/AiNotesPage.jsx` | `/Users/laheez/Desktop/screenshot app/study/study:ai notes/ainotes:medicine/ai notes startup/1.jpeg`, `2.jpeg`, `3.jpeg`, `/Users/laheez/Desktop/screenshot app/study/study:ai notes/ainotes:medicine/ai notes with personilized button enables.png` |
| `/app/flashcards` | `src/surfaces/app/student/flashcards/StudentFlashcardsPage.jsx` | `/Users/laheez/Desktop/screenshot app/study/study:flash cards/study->flashcard 1.PNG`, `study->flashcard 2.PNG`, `study->flashcard extended.PNG` |
| `/app/planner` | `src/surfaces/app/student/planner/StudyPlannerPage.jsx` | `/Users/laheez/Desktop/screenshot app/study/study:planner/study->planer 1.png` … `study->planer 4.png` |

---

# TASK LIST (fix in this order)

## P0 — broken / unreadable, fix first

- [x] **T1. Quiz content collides with the iOS status bar once scrolled** — ✅ FIXED 2026-06-11 (extended): sticky safe-area header now applied to `TakeQuizPage.jsx` **and both review pages** (`ReviewPage.jsx`, `PracticeReviewPage.jsx`) — `max-[900px]:sticky top-0`, opaque `--surface-0`, flat top, top padding/min-height via `var(--lms-safe-top, env(safe-area-inset-top))` (web + Capacitor iOS/Android). **Header flicker on scroll fixed**: dropped `backdrop-blur` on mobile (header is opaque there anyway) and added `translateZ(0)` GPU-layer promotion — `backdrop-filter` on a sticky element was the iOS WKWebView repaint trigger. Loader centers in the viewport. Scope kept to quiz + review (not global) per request.
  - **Route:** `/app/quizzes/:quizId` — `TakeQuizPage.jsx`
  - **Evidence:** `/Users/laheez/Desktop/screenshot app/quiz/quiz taking page2.png` ("Progress 0% complete" overlaps the 2:51 clock), `quiz taking page3.png`, `quiz taking page4.png` ("QUESTION 1 OF…" under the clock), `quiz taking page5.png` (option text interleaved with status bar).
  - **Why:** the in-quiz header scrolls away and the scroll container has no `env(safe-area-inset-top)` protection — the single most "broken app" signal in the set. HIG: content must never collide with system UI.
  - **Fix:** pin a compact quiz header (title + Finish) with opaque/blurred background filling the top safe area; give the scroll view `padding-top: calc(env(safe-area-inset-top) + 56px)`.

- [x] **T2. Header popovers (avatar + notification + search) unified** — ✅ DONE 2026-06-11 (per user: "plain & clean", search "fully identical"). First attempt's broad `.lms-floating-panel` rule was reverted (it changed sidebar tooltips/flyouts). Final state — all three share ONE surface + animation:
  - **Notification**: removed its `bg-surface-card`/`rounded-sm`/`shadow-none` overrides → inherits the base `dropdown` (surface-card-elevated, radius-lg, floating shadow, `dropdownIn`).
  - **Avatar**: had a bespoke layered popover (blue/cyan gradient tint + `lmsProfilePopoverIn`/`lmsProfileMenuSoftIn` + staggered "cascade from below" items) defined across `theme.css` + `student-app.css`. Added an `html`/`html:root[data-theme=dark]`-prefixed override (specificity 0,2,2 / 0,4,2 — beats every competing `!important` rule regardless of bundle order) forcing it to `surface-card-elevated` + `--line-soft` + `--ds-floating-shadow` + `dropdownIn`, and neutralised the per-item stagger. Floating-avatar trigger mechanics untouched (JS uses refs + the `body.lms-profile-menu-open` class, never the panel class).
  - **Search** (`GlobalSearch.jsx`): glass + `scaleInFast` → `surface-card-elevated` + `border-line-soft` + `--ds-floating-shadow` + `dropdownIn` (kept the `bg-black/45` backdrop scrim; still centered).
  - Result: identical surface colour, opacity (~98%), border, shadow, and drop-in animation across all three. Verified in built CSS/JS.
  - **Route:** all routes (header) — `AppHeader.jsx`
  - **Evidence:** `/Users/laheez/Desktop/screenshot app/header drop down/USER AVATHAR dropdown.png` ("Profile" overlaps the AI Notes description, "Log out" overlaps Flashcards), `/Users/laheez/Desktop/screenshot app/header drop down/search drop down.png` (page rows bleed through the panel). The notification panel (`notification drop down.png`) is opaque — proving this is a missing-background bug, not a style.
  - **Fix:** give all popovers an opaque overlay surface (`#232733`, or 88% + `backdrop-filter: blur(24px)`) plus a `rgba(0,0,0,0.45)` scrim behind. Long-term: convert to sheets/anchored popovers.

- [x] **T3. Back navigation: wrong chevron direction + three inconsistent patterns + missing on course detail** — ✅ FIXED 2026-06-11: added `IcoChevronLeft` in `StudentQuizzesPage.jsx` and pointed all three "Back" buttons left (row drill-in chevrons stay right). `CourseDetailPage.jsx` now renders a top-left `.csum-back` button (left chevron + "Courses") at the start of the summary header, styled in `courses.css`, matching AiNotes' existing left-chevron `BackIcon`. Q-Bank/AiNotes/CourseDetail now share the same left-chevron back direction.
  - **Routes/Evidence:**
    - `/app/quizzes` drill-downs: "**> Back**" chevron points RIGHT (forward affordance) — `/Users/laheez/Desktop/screenshot app/quiz/quiz:medicine.png`, `quiz:medicine:lesson -wise.png`, `quiz:medicine:topic wise.png`.
    - `/app/ai-notes`: correct "**< Back**" / "**< Lessons**" — `/Users/laheez/Desktop/screenshot app/study/study:ai notes/ainotes:medicine/IMG_6645.png`, `ai notes startup/3.jpeg` — different component from the quiz one.
    - `/app/courses/:courseId`: **no back control in the header at all**; only a "Back to courses" button buried mid-content — `/Users/laheez/Desktop/screenshot app/courses/course:obstetrics and gynacology/IMG_6640.png`.
  - **Fix:** one shared back component: left chevron + parent label, top-left in the header, 44pt target, on every pushed screen. Flip the Q-Bank chevron immediately even if nothing else ships.

- [x] **T4. Content bleeds through / hides behind the translucent tab bar app-wide** — ✅ FIXED 2026-06-11: the bottom nav is portaled to `<body>`; in dark its `--surface-card-elevated` resolved to `rgba(11,18,27,0.98)` (2% see-through) so mid-scroll content ghosted behind it. Set the dark `.lms-mobile-bottom-nav__inner` background to the fully opaque `rgb(11,18,27)` in `bottom-nav.css`. Content now disappears cleanly behind the bar. Existing content bottom inset (`--lms-mobile-content-bottom` = nav height + 12px, safe-area aware) already clears the bar at rest on web + Capacitor.
  - **Routes:** virtually all tab pages.
  - **Evidence:** `/Users/laheez/Desktop/screenshot app/courses/course:obstetrics and gynacology/IMG_6641.png` ("No quiz or exam data…" readable through tab bar), `/Users/laheez/Desktop/screenshot app/results /results 1.png` ("Cardiology … 20%" through it), `/Users/laheez/Desktop/screenshot app/study/study:planner/study->planer 1.png` (Overdue/Done tiles half-occluded), `/Users/laheez/Desktop/screenshot app/study/study:ai notes/ainotes:medicine/IMG_6645.png` (ghost text "oxicolo" behind tabs), `/Users/laheez/Desktop/screenshot app/study hub/study hub 3.png`, `study hub 4.png`.
  - **Fix:** tab bar = blurred material `rgba(10,10,15,0.78)` + `backdrop-filter: blur(28px)` + 1px top hairline; every scroll container gets `padding-bottom: calc(env(safe-area-inset-bottom) + 64px + 16px)`.

## P1 — visible quality bugs

- [x] **T5. Remove debug/test artifacts and fix copy errors** — ✅ PARTIALLY FIXED 2026-06-11 (code items done; data items flagged below):
  - Debug "Server date … · timezone" line in `StudentDashboardPage.jsx` now gated behind `import.meta.env.DEV` (hidden in production web + Capacitor, kept for devs — no deletion).
  - "Show notification" mislabeled link in `AppHeader.jsx` → "View all notifications" (it navigates to `/notifications`).
  - Pluralization: course tile in `StudentQuizzesPage.jsx` now "1 set/8 sets" (was "1 SETS"); lesson tile in `AiNotesListPage.jsx` now "1 lesson/8 lessons" (was "1 LESSONS"). Other tiles already pluralized correctly.
  - "Autosaved locally" status pill in `AiNotesPage.jsx` shortened to "Autosaved" so it no longer truncates to "Autosaved loca…" on narrow phones.
  - ⚠️ **NOT code — admin/DB content (cannot fix in frontend):** test entries `jnkjbkj`, `dcscscscd`, `sdcsdvsdv` and misspellings `Gynacology`→Gynaecology, `Peadiatrics`→Paediatrics, `Mital stenosis`→Mitral are course/lesson/question records entered via the admin panel. Fix them in the database / admin CMS, not here.
  - **Evidence:**
    - "Server date 2026-06-11 · Asia/Colombo" debug line — `/Users/laheez/Desktop/screenshot app/study hub/study hub 2.png` (`/app/dashboard`).
    - "Show notification" test button in notifications panel — `/Users/laheez/Desktop/screenshot app/header drop down/notification drop down.png`.
    - Pluralization: "**1 SETS**" (`/Users/laheez/Desktop/screenshot app/quiz/quiz 1.png`), "**1 LESSONS**" (`/Users/laheez/Desktop/screenshot app/study/study:ai notes/study->ai notes 1.PNG`) — while `quiz:medicine.png` correctly says "1 Practice Set" (two implementations; add a shared `pluralize()`).
    - Test data visible: "jnkjbkj" (`IMG_6640.png`, `study->flashcard extended.PNG`), "dcscscscd" (`Istudy hub 5.png`), "sdcsdvsdv" (`study->flashcard extended.PNG`).
    - Spelling in seed/content data: "Gynacology" → Gynaecology, "Peadiatrics" → Paediatrics, "Mital stenosis" → Mitral (repeats on `course 1.png`, `quiz taking page1.png`, `study hub 3.png`, results rows).
    - "Autosaved loca…" truncation — `ai notes with personilized button enables.png`.

- [x] **T6. Fixed-width elements break words mid-label** — ✅ FIXED+VERIFIED 2026-06-12: added `whitespace-nowrap` to the flashcards table `headerClass` (`StudentFlashcardsPage.jsx`) — header now reads "DECK / NEW / LEARN / DUE" on one line (was "LEAR N"), verified in the live preview. Dashboard "Results" pill and lesson-row titles were already correct in source (`white-space:nowrap` at `dashboard-page.css:710`; 2-line clamp on `.student-lessons-lesson-row__title-text`) — the audit's "Result s"/"Mital sten…" came from the stale build.
  - **Evidence:**
    - Flashcards table header renders "**LEAR N**" — `/Users/laheez/Desktop/screenshot app/study/study:flash cards/study->flashcard 1.PNG`, `2.PNG`, `extended.PNG` (`/app/flashcards`).
    - "Results" button wraps to "**Result s**" — `/Users/laheez/Desktop/screenshot app/study hub/study hub 4.png` (`/app/dashboard`).
    - "HEMATOLOGIC AL…" mid-word wrap — `IMG_6645.png` (`/app/ai-notes`).
    - "Mital sten…" truncated to ~10 chars beside two buttons — `quiz:medicine:lesson -wise.png` (`/app/quizzes`).
  - **Fix:** `white-space: nowrap` on buttons/table headers; row titles get `flex: 1` priority; lesson names in sentence case (caps + truncation is what breaks them).

- [x] **T7. Define one primary-button system (currently 5 CTA styles)**
  - **Evidence:** gradient pill "Resume practice" (`study hub 1.png` — only gradient in app) · flat blue filled rect "Start Next Lesson" (`IMG_6640.png`) · outlined pill "Start practice" (`quiz:medicine:lesson -wise.png`) · outlined rect "Save reminders" / "Answer question" (`study->planer 1.png`, `Istudy hub 5.png`) · text-button "Open" (`IMG_6643.png`). Adjacent buttons disagree: pill "Start practice" (r≈24) next to rect "Save" (r≈14) in the same row (`quiz:medicine:lesson -wise.png`).
  - **Fix:** Primary filled / Secondary tonal / Tertiary outline / Quiet text (see token set at bottom). One radius (`radius/control = 12`). Either kill the gradient or make it THE primary style everywhere.

- [ ] **T8. Unify the three "pick from a list" page designs**
  - **Evidence:** `/app/courses` (`course 1.png`: eyebrow + caps H1 + count pill right, flat r≈16 cards, no mascot) vs `/app/quizzes` (`quiz 1.png`: mascot + caps H1 + sentence subtitle, r≈28 cards with big-numeral "8 SETS" tiles) vs `/app/ai-notes` (`study->ai notes 1.PNG`: same as Q-Bank but count pill dropped to its own row below the header — third placement).
  - **Fix:** one `ListPickerHeader` (eyebrow + title + count) and one `EntityCard` (icon tile, title, meta, trailing count tile) shared by all three routes.

- [x] **T9. Fix loading states: light-mode skeleton flash, double-exposed transition, broken quiz loader** — ✅ FIXED 2026-06-13:
  - `AiNotesPage.jsx` `pageBg` fallback changed from `#eff1fb` (light lavender) to `var(--surface-0, #0a0a0f)` — skeleton background now dark.
  - `native.css` root/body/`#root` background fallback also fixed from `#eff1fb`/`#dce6f4` to `#0a0a0f`.
  - `TakeQuizPage.jsx` loading state: removed the bordered card (`quizLoadingState`) that was pinned near Dynamic Island; replaced with bare `flex column items-center justify-center min-h-dvh` — spinner and label now centred in the full viewport.
  - `NoteCanvas.jsx` `MasonryItem`: initial `rowSpan` state changed from `1` to `null`; items render with `opacity: 0` until `ResizeObserver` fires the first measurement, then fade in at `opacity: 1` — eliminates the simultaneous-overlap flash where all cards stacked at row 1 before layout was calculated.

- [x] **T10. Quiz-taking screen structure (native quiz feel)** — ✅ FIXED 2026-06-13:
  - ✅ `text-align: left; hyphens: none` — fixed in `responsive.css` for `.lms-reading-question` / `.lms-reading-answer` / `.lms-review-main` etc., and `results.css` for `.lms-exam-page .lms-reading-incorrect`.
  - ✅ Theme toggle removed — `showThemeToggle={false}` on both `<ExamModeHeader>` call sites (practice mode line ~2111, exam mode line ~2455).
  - ✅ Progress collapse: "Progress" stat tile removed from both practice and exam sidebars; progress bar merged into Question navigator header.
  - ✅ Unanswered chip neutral — amber `is-idle` chips changed to neutral grey (`rgba(148,163,184,0.30)` border, `rgba(148,163,184,0.08)` bg) in both light and dark mode rules in `quiz-exam.css`.
  - ✅ Legend dots enlarged — `examNavLegendDotClass` changed from `size-2.5` (10px) to `size-3` (12px) in `TakeQuizPage.jsx:431` — 5-state dots now visually distinguishable.
  - **Route:** `/app/quizzes/:quizId` — `TakeQuizPage.jsx`

- [x] **T11. Replace web dropdowns/controls with native-feeling patterns** — ✅ FIXED 2026-06-13:
  - ✅ Scrollbar tracks hidden — `html[data-lms-runtime="native"] ::-webkit-scrollbar { display: none }` + `scrollbar-width: none` added to `native.css`.
  - ✅ Keyboard hints hidden — `lms-search-kbd-hints` class added to `GlobalSearch.jsx` footer; `native.css` hides it for native runtime + `@media (pointer: coarse)` hides it on all touch devices.
  - ✅ Planner switches: plain `<input type="checkbox">` replaced with CSS `<Toggle>` component (iOS-style pill, 51×31px, spring-animated thumb) in `StudyReminderSettingsCard.jsx`.
  - ✅ Lead time stepper: `<input type="number">` replaced with `<HourStepper>` (−/value/+ inline row, 44×38px buttons) — eliminates native iOS floating spin buttons.
  - ✅ Avatar menu: already had `justify-start` + icons (`ProfileIcon`, `SettingsIcon`, `LogoutIcon`) — correctly leading-aligned.

- [x] **T12. Flashcards: desktop data-table → mobile disclosure list** — ✅ FIXED 2026-06-13:
  - `<thead>` gets `max-[640px]:hidden` — column header row hidden on mobile.
  - All three count `<td>` cells (NEW/LEARN/DUE) get `max-[640px]:hidden` — columns removed on mobile.
  - Added `fc-deck-mobile-counts` inline badge group inside `fc-deck-status-slot`, visible only below 640px — shows three `CountCell` badges inline in the row.
  - `flashcards-anim.css` `@media (max-width: 640px)`: `grid-template-columns` changed from fixed `3rem` to `auto` to accommodate variable-width badge group.
  - **Route:** `/app/flashcards` — `StudentFlashcardsPage.jsx`

## P2 — polish / systemic consistency

- [x] **T13. Semantic color tokens: one progress color, green only for success** — ✅ FIXED 2026-06-13:
  - ✅ Course card list progress bar (`courses.css:99`): gradient `(var(--course-accent), var(--course-accent-2))` → solid `var(--sa-primary)` — no more teal/purple/amber gradient bars.
  - ✅ Study hub course ring (`dashboard-page.css:2271`): `#22c55e` (green) → `var(--sa-primary, #2563eb)` — ring is now blue like all progress.
  - ✅ Study hub course row mini-bar (`dashboard-page.css:2386`): green→cyan gradient → solid `var(--sa-primary)`.
  - ✅ Study hub course row % text (`dashboard-page.css:2367`): `#86efac` (green) → `var(--sa-primary-soft, #93c5fd)` (blue-tinted).
  - ✅ REVIEWED chip (`results.css:627`): green tint → neutral grey (`rgba(148,163,184)` border/bg, `--ink-soft` text).
  - ℹ️ `csum-bar` (course detail breakdown) keeps green/blue/orange segments — they are semantically distinct (done/active/remaining), not general progress.
  - ℹ️ "PERFORMANCE" eyebrow in results was already `#38bdf8` (sky-blue) in dark mode — not purple in current code.

- [x] **T14. Contrast pass (WCAG AA, dark mode)** — ✅ FIXED 2026-06-13:
  - ✅ `--ink-muted` lifted from `#6E7D94` (4.35:1) to `#8294AE` (5.84:1) in all four dark-mode sections of `theme.css` — fixes every element using this token at any size.
  - ✅ "No cards" badge in `StudentFlashcardsPage.jsx:1158` changed from `text-ink-muted` to `text-ink-soft` (11px badge gets the stronger token).
  - ✅ Amber "Past 4 weeks · X active days" in `dashboard-page.css:2036` changed from `#f59e0b` (amber) to `var(--sa-text-2)` (ink-soft blue-grey) — both contrast and semantic fix.
  - ℹ️ "READY" chip: `dark:text-white/70` on `dark:bg-white/[0.05]` gives ~8:1 — already AA-compliant.
  - ℹ️ "NO DATE SET" small label: already `#94a3b8` (7:1) — already compliant.

- [x] **T15. Tap targets below 44pt** — ✅ FIXED 2026-06-13:
  - ✅ "Open" buttons in `CourseDetailPage.jsx` (`csum-open` class): `min-height` lifted from 36px → 44px in `courses.css:666`.
  - ℹ️ Results chevron (~34pt): decorative indicator, the entire `student-results-attempt-row` (cursor:pointer) is the tap target — no change needed.
  - ℹ️ Quick-action cards in study hub: `study-action-card` is 116px tall — already far exceeds 44pt.
  - ℹ️ Notes toolbar (drawing tool buttons at 22×22px): intentionally dense GoodNotes-style palette — standard drawing app convention; increasing to 44pt would break the compact toolbar UX.

- [ ] **T16. Type scale: one body size, one H1 treatment, caps for labels only** — MOSTLY RESOLVED 2026-06-13:
  - ✅ A complete type-role token system already exists (`00-tokens/typography.css:136-172`): body = `--type-size-base` 16px, page-title = `--type-page-title`/`3xl` 28px, section-title = `--type-section-title`/`xl` 18px, label = `--type-label`/`xs` 12px.
  - ✅ **One H1 treatment** — every page's header title (`AppHeader` + `.study-topbar-title h1` + `.lms-topbar h1`) already uses `--type-size-xl` (18px). Consistent across all pages.
  - ✅ **One reading body** — quiz reading text (`lms-reading-question`) is already at the 16px base (`TakeQuizPage.jsx:258`). The "notes ~17-18px" outlier is the **sticky-note canvas** (`AiNotesPage.jsx:1106`, `fontSize:17`, handwriting `STICKY_NOTE_FONT`) — a deliberately distinct freeform-canvas context, not flowing body text.
  - ✅ Off-scale title snapped: `.student-result-detail-hero h1` was a hardcoded `34px`/`30px` → now `var(--type-size-3xl)` (28px), matching every other page hero (`results.css:909`, mobile override removed).
  - ℹ️ Remaining off-scale numbers on the results page (`23/30/28/22px` stat/score `strong`s) are **metrics**, intentionally sized per card tier — not body/title inconsistencies; left as-is.
  - ℹ️ ALL-CAPS lesson names (`IMG_6645.png`): data is stored uppercase in DB — frontend cannot auto-case without breaking names like "AI". Fix is to update DB content via admin panel (backend).

- [ ] **T17. Unify chips/badges (≥7 variants) and count badges (4 variants)** — PARTIAL 2026-06-13:
  - ✅ Filter-chip shape: lessons filter chip base rule set to full pill `border-radius:999px` (`lessons.css:244`), matching flashcards filter pills (was a `12px` rect already overridden later in-file; made the base rule self-consistent).
  - ⬜ Status chips (READY/IN PROGRESS, FREE green, Unanswered amber, FAILED/PASSED/REVIEWED, XP/Level) — chips are implemented ad-hoc with inline utility classes across many files; full unification into one `Chip` component (h≈24, pill radius, caption-caps, semantic variants) is a dedicated refactor needing per-page verification.
  - ⬜ Count badges (big-numeral tile / number-over-label / inline pill / circle) — one recipe, also a dedicated pass.

- [ ] **T18. Standardize empty states and add missing pressed/disabled states** — PARTIAL 2026-06-13:
  - ✅ Planner reminder field disable: `StudyReminderSettingsCard` conditionally renders the lead-time `HourStepper` only when the planner toggle is on (and the daily-time field only when its toggle is on) — the governed control disappears when off.
  - ✅ Saved-state glyph: bookmark toggles already swap outline→**filled bookmark** (not a check) — `StudentQuizzesPage.jsx:298`, `AiNotesListPage.jsx:201`. No check-glyph swap remains.
  - ⬜ One EmptyState component (planner empty state CTA, exam-countdown debug text) — dedicated component pass.
  - ⬜ Global `:active` press dim + 40% disabled opacity on rows/buttons — broad shared-CSS change, verify per surface.

- [ ] **T19. Iconography & imagery: one illustration language**
  - **Evidence:** flat-cute crab mascot (`quiz 1.png`, `study->ai notes 1.PNG`) vs rendered 3D-ish robot (`study hub 1.png`) vs emoji-tile brain/flame/trophy (`study hub 2.png`, `study hub 4.png`, `Istudy hub 5.png`); text chevron "View history >" vs icon chevrons (`study hub 2.png`); bright light-blue avatar tile outweighs every header icon (all screens); bell gets an outline highlight when open, search gets a field ring, avatar gets nothing (`notification drop down.png` vs `search drop down.png`).
  - **Fix:** pick one mascot/illustration style; icon chevrons everywhere; tinted-dark avatar tile; one header-active treatment.

- [x] **T20. Layout odds and ends** — ✅ PARTIALLY FIXED 2026-06-13:
  - ✅ Planner stat tiles "4Due Today": added `display:flex; flex-direction:column; gap:2px` to `.planner-native-stat > div` in `StudyPlannerPage.css` + `display:block` on `strong` — now renders "4\nDue Today".
  - ✅ Duplicate "Planner" buttons: `UpcomingTasksCard` heading button changed from "Planner" → "View all" in `StudentDashboardPage.jsx:865` — no more two adjacent "Planner" navigation buttons.
  - ✅ Number formatting: standardized results percentages to whole numbers (`Math.round`) — `ResultsListPage.jsx:201` average (`20.0%`→`20%`) + `ResultPage.jsx` score ring (`useCountUp` decimals 1→0, aria-label rounded). Matches the rest of the app.
  - ✅ Streak dots at streak = 0: `StreakHeatmap` now tracks the streak only (was `max(streak, goalsCompleted)`), so "Start your first streak today" shows zero lit dots — `StudentDashboardPage.jsx:542`.
  - ✅ Search placeholder truncation: shortened to "Search courses, quizzes…" / "Search students, courses…" (descriptive aria-label retained) — `GlobalSearch.jsx:318`.
  - ⬜ Two "Done" affordances in notes personalize mode — separate UX design decision.
  - ⬜ Sticky-header fade mask — requires adding gradient overlays to scroll containers in `courses.css` / `study-2.css`.
  - ⬜ "Review"/"Quiz" leading chips look like buttons — visual affordance cleanup.
  - ℹ️ "−45 pts" hyphen-not-minus: `snapshot.trendLabel` is a pre-formatted string from the backend API — fixing the minus glyph/colour needs a backend change (out of scope).
  - ⬜ Header retitles to "Lessons / LESSON NOTES" while the active tab is Study (`study->ai notes 1.PNG`) — keep subtitle tied to tab section.

---

# Per-screen findings (full detail)

## `/app/courses` — StudentCoursesPage
**Screenshots:** `/Users/laheez/Desktop/screenshot app/courses/course 1.png`, `course 2.png`
- Header pattern (title + caps subtitle "STUDY LIBRARY") is the app's most consistent element — keep.
- "READY" gray chip at ~10px caps is low contrast (T14); "IN PROGRESS" blue chip fine.
- Medicine progress bar is a teal→green→purple gradient — no other progress element uses it (T13).
- Meta "0 lessons · 0 done · No lessons yet" — dimmest gray in the app, est. ~3.4:1 at 13px (T14); copy is redundant.
- Card radius ~16px vs Q-Bank ~28px vs documented `--ds-card-radius` 22px (T8).
- First card clipped by sticky section header with no fade (T20).

## `/app/courses/:courseId` — CourseDetailPage
**Screenshots:** `/Users/laheez/Desktop/screenshot app/courses/course:obstetrics and gynacology/IMG_6640.png` – `IMG_6644.png`
- No header back button (T3); header truncates "Gynacology and Obst…" while the H1 repeats in content — use large-title collapse pattern.
- "Start Next Lesson" filled style appears only here (T7).
- "0 **of 2**" mixes two type sizes inline without baseline alignment.
- Progress-breakdown bar solid amber at 0% complete — amber means "not started" here, "unanswered" in quiz, "warning" in streaks (T13).
- "Open" text-buttons ~36×30pt (T15); make topic rows tappable.
- Scroll-under both edges: stat labels collide with header (`IMG_6642.png`); "Progress breakdown" ghosts through tab bar (`IMG_6640.png`) (T4).
- Test lesson "jnkjbkj" visible (T5).

## Header dropdowns (all routes) — AppHeader
**Screenshots:** `/Users/laheez/Desktop/screenshot app/header drop down/USER AVATHAR dropdown.png`, `notification drop down.png`, `search drop down.png`
- Avatar + search panels transparent → text-on-text (T2); notification panel opaque — one component, three backgrounds.
- Avatar menu items right-aligned, no leading icons (T11); no scrim behind any dropdown (T2).
- Desktop keyboard hints in search (T11); placeholder truncates (T20).
- Bell/search/avatar three different active-state treatments; avatar tile heaviest element on every screen (T19).
- "Show notification" test button (T5).

## `/app/quizzes` — StudentQuizzesPage (Q-Bank)
**Screenshots:** `/Users/laheez/Desktop/screenshot app/quiz/quiz 1.png`, `quiz 2.png`, `quiz:medicine.png`, `quiz:medicine:lesson -wise.png`, `quiz:medicine:topic wise.png`
- "1 SETS" pluralization (T5). Big-numeral count tiles exist only here + Lessons, not Courses (T8).
- "> Back" wrong-direction chevron on all three drill-downs (T3).
- Sub-navigation in floating card rows while the page header stays "Q-Bank / PRACTICE QUESTION SETS" — title never changes as you go deeper; native: header becomes "Medicine", back says "Q-Bank" (T3).
- `lesson -wise`: triple-nested cards; "Mital sten…" truncation beside an unexplained ✓ badge; pill + rect buttons in the same row (T6, T7).
- Count tile layout differs from `quiz 1.png`'s — second implementation of the same component (T17).
- `topic wise` is the cleanest of the trio; use as the template.
- Desktop scrollbar sliver + floating rounded container corner (`quiz 2.png`) (T11).

## `/app/quizzes/:quizId` — TakeQuizPage
**Screenshots:** `/Users/laheez/Desktop/screenshot app/quiz/quiz taking page loading.png`, `quiz taking page1.png` – `page5.png`
- Status-bar collision once scrolled (T1). Loading layout broken (T9).
- Finish scrolls away (T10); action rows not docked (T10).
- Justified + hyphenated question/answer text (T10).
- Theme/sun toggle in quiz header (T10, T11).
- Position rendered three times (stats row, Progress, "Question 1 of 10") (T10).
- All unanswered chips amber-bordered → everything looks flagged; 5 legend dot colors indistinguishable at ~10px (T10, T13).
- "Show answer" gray-on-dark borderline AA (T14).
- `page5.png`: bottom half empty void; scrollbar visible (T10, T11).

## `/app/results` — ResultsListPage
**Screenshots:** `/Users/laheez/Desktop/screenshot app/results /results 1.png`, `results 2.png`, `results 3.png`
- Tinted stat tiles (blue/green/purple) appear nowhere else — Study Hub tiles are neutral (T17).
- "PERFORMANCE" eyebrow purple; every other eyebrow blue (T13).
- "20% avg" vs "20.0%" vs "10%" precision drift (T20).
- "valvular heart disease" lowercase vs "Rheumatology" capitalized in identical rows (`results 2.png`) (T5).
- REVIEWED chip green on a 0% attempt (T13); chevron circles ~36pt (T15).
- Sparkline clips card bottom edge; tab-bar bleed (`results 1.png`) (T4).

## `/app/dashboard` — StudentDashboardPage (Study Hub)
**Screenshots:** `/Users/laheez/Desktop/screenshot app/study hub/study hub 1.png` – `study hub 4.png`, `Istudy hub 5.png`
- "Resume practice" only gradient CTA; "Laheez" only gradient text (T7).
- Robot vs crab vs emoji-tile illustration styles on one tab (T19).
- "Server date 2026-06-11 · Asia/Colombo" debug line (T5).
- Streak dots contradict streak=0 (T20); "View history >" text chevron (T19).
- Green "0%" on every course row (T13).
- Duplicate "Planner" buttons; chip-as-button task rows (T20).
- "Result s" button wrap (T6); "−45 pts" hyphen-minus uncolored (T20).
- "dcscscscd" test content in Question of the Day (T5); XP/Level pills are a fourth chip style on this tab alone (T17).
- Tab-bar bleed on `1`, `3`, `4` (T4).

## `/app/study` — StudentStudyPage
**Screenshots:** `/Users/laheez/Desktop/screenshot app/study/study 1.png`, `study 2.png`
- Cleanest screens in the set; the eyebrow + title + description + tinted icon tile row IS the component system the rest of the app needs.
- No visible pressed state on rows (T18); low-contrast chevrons.
- `study 2.png`: card cut mid-row under header without fade mask (T20).

## `/app/ai-notes` — AiNotesListPage (Lessons)
**Screenshots:** `/Users/laheez/Desktop/screenshot app/study/study:ai notes/study->ai notes 1.PNG`, `study->ai notes 2.PNG`, `ainotes:medicine/IMG_6645.png` – `IMG_6647.png`
- "1 LESSONS" (T5); count pill placement breaks from Q-Bank (T8).
- Header retitles "Lessons / LESSON NOTES" under the Study tab (T20).
- Correct "< Back" here — the component quiz pages should use (T3).
- Filter chips rect r≈12 vs flashcards full pills (T17).
- ALL-CAPS lesson names truncate mid-word "HEMATOLOGIC AL…" (T6, T16).
- Saved state swaps bookmark→check glyph (T18).
- Ghost text behind tab bar (T4).

## `/app/ai-notes/:id` — AiNotesPage (note canvas)
**Screenshots:** `/Users/laheez/Desktop/screenshot app/study/study:ai notes/ainotes:medicine/ai notes startup/1.jpeg`, `2.jpeg`, `3.jpeg`, `ai notes with personilized button enables.png`
- Light-mode skeleton flash (`1.jpeg`); double-exposed transition (`2.jpeg`) (T9).
- Final canvas (`3.jpeg`) is the most polished screen in the app — but its ~17–18px body diverges from quiz ~15px (T16).
- Personalize mode: two simultaneous "Done" affordances; breadcrumb casing inconsistency; toolbar icons ~36pt; "Autosaved loca…" truncation (T20, T15, T5).

## `/app/flashcards` — StudentFlashcardsPage
**Screenshots:** `/Users/laheez/Desktop/screenshot app/study/study:flash cards/study->flashcard 1.PNG`, `2.PNG`, `extended.PNG`
- "LEAR N" header wrap (T6).
- Desktop data-table pattern on mobile; misaligned zebra count panel; "No cards" rows near-invisible (T12, T14).
- Filter pills differ from lesson filter chips (T17).
- "sdcsdvsdv", "jnkjbkj" test data (T5).

## `/app/planner` — StudyPlannerPage
**Screenshots:** `/Users/laheez/Desktop/screenshot app/study/study:planner/study->planer 1.png` – `study->planer 4.png`
- Circle check toggles (read as radios) instead of switches; explicit "Save reminders"; free-text number input; floating unlabeled "−" button (T11).
- "4Due Today" / "0Open" / "7Done" numeral-label cramming (T20).
- Empty state body ~20px (larger than titles) and no "Add task" CTA (T16, T18).
- Stat tiles half-hidden behind tab bar (T4); segmented control is a fifth "selected" style (T17).

---

# Cross-cutting summary

1. **Safe areas & overlays (P0):** top inset missing in quiz; bottom insets missing app-wide; 2 of 3 dropdowns missing opaque backing; no scrim anywhere. One `SafeScroll` wrapper + one `OverlaySurface` token fixes a dozen screens.
2. **"Web app" tells (9):** desktop scrollbars; keyboard hints; right-pointing Back; Save buttons for settings; checkbox-circles vs switches; free-text number input; justified+hyphenated text; theme toggle in content; dropdowns instead of sheets/menus.
3. **Navigation model:** sub-navigation inside content cards while the global header stays static; header title should reflect the current node, back shows parent.
4. **Component drift:** card radii 16/22/28; ≥7 chip variants; 5 button styles; 4 count-badge recipes; 3 stat-tile styles; 4 selection-control looks. This is the missing-token signal.
5. **Typography:** one family (Plus Jakarta Sans — good), no shared scale; body 15–20px across screens; caps misapplied to data.
6. **Contrast:** tertiary grays at 10–13px likely below 4.5:1 in ≥6 places.
7. **States:** no pressed states; 3 empty-state layouts; loaders broken in 2 flows; disabled states absent.
8. **Imagery:** 3 illustration languages; glyph-swap state changes; mixed text/icon chevrons.

---

# Proposed design tokens

Aligns with the existing elevation ladder and card tokens in `frontend/src/shared/theme.css` (`--sa-surface` ladder, `--surface-card`, `--ds-card-radius`) — extend, don't fork.

## Type scale (Plus Jakarta Sans)
| Token | Size/Line | Weight | Use |
|---|---|---|---|
| `type/display` | 28/34 | 800 | Hero numerals, score rings |
| `type/title-1` | 24/30 | 700 | Page H1 (one per screen) |
| `type/title-2` | 20/26 | 700 | Card/section titles |
| `type/headline` | 17/22 | 600 | Row titles, button labels |
| `type/body` | 16/23 | 400 | All reading text incl. quiz (left-aligned, `hyphens: none`) |
| `type/callout` | 14/19 | 500 | Meta lines, descriptions |
| `type/footnote` | 13/17 | 500 | Dates, counts — must hit 4.5:1 |
| `type/caption-caps` | 11/14 +0.08em uppercase | 700 | Eyebrows & labels ONLY — never data, never <11px |

## Color & elevation (dark)
```
surface/page      #0A0A0F     (existing)
surface/recessed  #111117     (existing — skeletons, wells, empty states)
surface/card      #16181F     (existing — ALL cards)
surface/raised    #1C1F27     (existing — nested rows, stat tiles)
surface/overlay   #232733 @88% + blur(24px)   ← NEW: menus, popovers, sheets
scrim             rgba(0,0,0,0.45)            ← NEW: behind every overlay
line/soft         rgba(255,255,255,0.08)
text/primary      #F2F4F8
text/secondary    #A8AEC0     (≥4.5:1 on card — minimum for <17px text)
text/tertiary     #7E8496     (decorative / ≥17px only)
accent/brand      #4D7CFE     (links, active tab, focus, PROGRESS — the only progress color)
accent/ai         #8B7CF6     (purple — AI-feature branding only)
semantic/success  #30D158     (pass/saved/done only — never 0%)
semantic/warning  #FFB340     (due, streak-at-risk, EXAM TRAP)
semantic/danger   #FF453A     (failed, destructive, Log out)
semantic/neutral  text/secondary on surface/raised (READY, REVIEWED)
```

## Spacing (4pt base)
`space/1=4, /2=8, /3=12, /4=16 (card padding), /5=20, /6=24 (screen gutter), /8=32 (section gap)`
Screen gutter fixed at 20–24pt. Bottom scroll inset = `safe-area + 64 (tab bar) + 16`.

## Radii
```
radius/control  12    buttons, inputs, rect chips
radius/card     22    every card (matches --ds-card-radius)
radius/pill     999   filter chips, status chips, count pills
```
Drop the 16px and 28px card variants. Nesting rule: max two card layers (card → raised row), never three.

## Component tokens
```
button/primary    filled accent/brand, white text, h=50, radius/control
button/secondary  surface/raised fill, text/primary, h=50
button/tertiary   1px line/soft outline, accent text, h=44
button/quiet      text-only accent, 44pt hit area
tap-minimum       44×44pt (icon buttons, chevrons, toolbar)
chip              h=24, radius/pill, caption-caps; semantic variants above
nav/back          left chevron icon + parent label, top-left, 44pt
tab-bar           blur(28px) on rgba(10,10,15,0.78), 1px top hairline
toggle            iOS-style switch, applies immediately — no Save buttons
```

Adopting `surface/overlay` + scrim, the back component, safe-area insets, and the button/chip tokens mechanically resolves ~70% of the issues above; the rest is the content sweep (T5) and per-screen layout fixes.
