# xyndrome — Pure-Native Student App (iOS + Android) — Build Plan

**Document status:** Draft v1 for approval
**Date:** 2026-06-13
**Author:** Engineering (Claude Code)
**Scope:** Student side only — a 1:1 pure-native rebuild of the existing React/Capacitor LMS student app.

---

## 0. Decisions locked (from your answers)

| Decision | Choice | Consequence |
|---|---|---|
| **Technology** | **Flutter** (single Dart codebase) | True native (AOT ARM, no webview). One codebase renders pixel-identical on iOS + Android — best match to "exactly copy the same design + effects." |
| **Billing** | **External web checkout** (PayHere) | Native app opens the existing web payment flow in the system browser. ⚠️ Flagged store-policy risk — see §14. |
| **Offline** | **Hybrid: online-first app, but offline-first for notes + free content** | The app is online-first overall (graceful offline states + the same retry/timeout resilience as the web Axios client), **except** the user's own notes ("writing own notes") and free (non-premium) study content, which are **offline-first** — created/edited locally and synced when back online. See §3.3. |
| **Build order** | **All ~26 screens planned as one build** | The plan below is a single end-to-end build (still organized into an ordered task list / WBS in §19 so it's buildable "one task at a time"). |

**What stays identical and is NOT touched:** the NestJS v11 backend, the MySQL database, every API endpoint, the design tokens (we mirror their exact values), the logo, and all brand assets. The native apps are a new **frontend only** that talks to the same backend the web app already uses.

---

## 1. Goal & non-goals

### Goal
Two real native apps (iOS + Android) from **one Flutter codebase** that are a faithful, pixel-accurate replica of the current student web app: same logo, same design language (XYNDROME v2), same color tone, same elements, same effects (glassmorphism, score-ring count-up, flashcard flip, note-canvas + scribble sound, haptics), same screens, same backend, same database. Fully responsive across phone / tablet (iPad) / desktop form factors.

### Non-goals (explicitly out of scope)
- **Admin side** (`/admin/*`) — student only.
- **Backend / DB changes** — reused as-is. (Two small *additive* server touchpoints may be needed; see §9.4 "Open server items.")
- **New features** — this is a replication, not a redesign.
- **In-app purchase (StoreKit / Play Billing)** — per your choice we use external web checkout for v1.
- **Full offline mode for the whole app** — only the notes + free-content slice is offline-first in v1 (§3.3); premium/network features stay online-first.

---

## 2. Why Flutter (one paragraph)

The single hardest requirement is "**exactly** the same design and effects on **both** iOS and Android." Flutter draws every pixel itself (Impeller/Skia) rather than mapping to each platform's native widgets, so a glassmorphism card, a conic-gradient score ring, a flashcard flip, and the custom note canvas look **identical** on both platforms from one codebase — no per-platform drift. It compiles ahead-of-time to native ARM (no webview, unlike Capacitor), gives 60/120 fps animations, and has first-class tools for exactly the things this app needs: `BackdropFilter` (glass), `CustomPainter` (score ring, paper texture, drawing canvas), `AnimationController` (count-up, flip, route transitions), pointer pressure (Apple Pencil / S-Pen), and platform haptics/notifications.

---

## 3. High-level architecture

```
┌──────────────────────────────────────────────────────────────┐
│  NEW: Flutter app  (mobile/)                                   │
│  ┌───────────┬───────────┬───────────┬─────────────────────┐  │
│  │  UI layer │  State     │  Domain   │  Data / API         │  │
│  │ (widgets, │ (Riverpod  │ (models,  │ (Dio client, repos, │  │
│  │  theme,   │  providers)│  mappers) │  secure storage)    │  │
│  │  screens) │            │           │                     │  │
│  └───────────┴───────────┴───────────┴─────────────────────┘  │
└───────────────────────────────┬──────────────────────────────┘
                                 │  HTTPS, Authorization: Bearer <token>
                                 ▼
┌──────────────────────────────────────────────────────────────┐
│  EXISTING (unchanged): NestJS v11 API  →  MySQL (raw SQL)      │
│  /auth/*  /student/*  /push/*  /plans  /subscriptions/*  ...   │
└──────────────────────────────────────────────────────────────┘
```

### 3.1 Where it lives
A new top-level folder in the monorepo: **`mobile/`** (Flutter project). The existing `frontend/`, `backend/`, etc. are untouched. The Capacitor `frontend/ios` + `frontend/android` projects are left in place (we do not delete them yet — the new apps eventually replace them on the stores).

### 3.2 Chosen Flutter stack (libraries)

| Concern | Web app uses | Flutter equivalent (proposed) | Why |
|---|---|---|---|
| Language | JS (React 19) | **Dart 3 + Flutter 3.x (stable)** | — |
| State | Zustand | **Riverpod 2** | Closest to Zustand's simple, testable global stores; compile-safe. |
| Routing | React Router 7 | **go_router** | Declarative routes, deep links, redirect guards (auth). |
| HTTP | Axios | **Dio** + `dio_smart_retry` | Interceptors, base-URL, timeout + retry parity with the Axios client. |
| Secure token | localStorage | **flutter_secure_storage** | Keychain (iOS) / EncryptedSharedPreferences (Android) — upgrade over web localStorage. |
| Light cache/prefs | localStorage | **shared_preferences** + **hive** | Settings, theme, light response cache (mirrors `createTimedApiCache`). |
| SVG | inline JSX SVG | **flutter_svg** | Render the medical icon set + ported UI icons. |
| Glass | CSS backdrop-filter | **BackdropFilter** + saturation shader | See §11.1. |
| Drawing | DOM canvas | **CustomPaint** + `perfect_freehand` (Dart) + pointer pressure | Note canvas / annotations. |
| Procedural audio | Web Audio API | **flutter_soloud** (+ platform channel fallback) | Low-latency generated buffers + real-time modulation. See §11.4. |
| Push | @capacitor/push-notifications | **firebase_messaging** (FCM + APNs) + **flutter_local_notifications** | Register token to `POST /push/native-token`. |
| Haptics | @capacitor/haptics | **HapticFeedback** (built-in) + `gaussian`/platform channel for richer set | Map the semantic haptic vocabulary. |
| External checkout | web route | **url_launcher** (external browser) | Per billing decision (§14). |
| Google sign-in | GIS web | **google_sign_in** | Posts credential to `/auth/google`. |
| Status bar / system UI | @capacitor/status-bar | **SystemChrome** | Match `#0b121b`. |
| Splash | @capacitor/splash | **flutter_native_splash** | Background `#0b121b`. |
| Env config | Vite `import.meta.env` | **--dart-define** + a `config.dart` | Dev vs prod API origin. |

> All library choices are defaults open to change at kickoff; nothing here forces a specific package beyond the architecture.

### 3.3 Offline-first slice (notes + free content)
While the app is online-first overall, **the user's own notes and free (non-premium) study content are offline-first** — they must work with no connection and sync opportunistically.

- **Local store:** a structured local DB (**Hive** or **Drift/SQLite**) is the *source of truth* for personal notes and free content; the network is a sync target, not a prerequisite.
- **Scope offline-first:**
  - **Personal notes** — `StudentNotesPage` text + the AI-notes canvas annotations the student authors (create / edit / delete fully offline).
  - **Free content** — lessons / flashcards / quizzes flagged as free (non-subscription) are cached on first view and remain readable offline.
- **Sync model:** local-write-first → background sync queue with last-write-wins + `updatedAt` conflict handling; each pending change carries a dirty flag and retries when connectivity returns (reuses the lesson-annotations endpoints `…/lessons/:lessonId/annotations` and the notes/planner endpoints).
- **UI:** an "Offline — saved on device, will sync" indicator on notes; free content shows a "Saved for offline" badge; premium/network-only screens show the standard graceful offline state.
- **Premium content stays online** (and is also a billing/entitlement boundary).

> Open confirmation: exact definition of "free stuff" — assumed = the student's own notes/annotations **plus** any lesson/flashcard/quiz the backend marks as free (non-premium). Flag in §18.

---

## 4. Design system port (tokens → Flutter `ThemeData`)

The web app's tokens live in `frontend/src/shared/styles/00-tokens/` + `01-base/theme.css`. We mirror them **verbatim** into a single Dart source of truth: `mobile/lib/theme/tokens.dart` (raw values) + `app_theme.dart` (light/dark `ThemeData`). The student app default is **dark**.

### 4.1 Color tokens

**Dark mode (student default)**
| Token | Value |
|---|---|
| page bg `--surface-0` | `#0A0A0F` |
| recessed `--surface-1` | `#111117` |
| `--surface-2` | `#14141B` |
| `--surface-3` | `#1A1A22` |
| `--surface-4` | `#20202A` |
| card `--surface-card` | `#16181F` |
| raised `--surface-card-elevated` | `#1C1F27` |
| glass | `rgba(10,10,15,0.82)` / strong `0.94` / subtle `rgba(12,12,18,0.70)` |
| text strong `--ink-strong` | `#F8FAFC` |
| text medium `--ink-medium` | `#CBD5E1` |
| text soft `--ink-soft` | `#94A3B8` |
| text muted `--ink-muted` | `#8294AE` |
| line soft / medium / strong | `rgba(203,213,225,0.13 / 0.20 / 0.28)` |
| brand primary | `#60A5FA` (hover `#93C5FD`, light `rgba(96,165,250,0.12)`) |
| student accent `--sa-purple` | `#38BDF8` (soft `rgba(56,189,248,0.055)`) |

**Light mode**
| Token | Value |
|---|---|
| page `--ds-surface-page` | `#F7F9FC` |
| card | `#FBFCFF` · raised `#FDFEFF` · muted `#F3F6FA` |
| text primary/secondary/muted | `#0F172A` / `#475569` / `#64748B` |
| accent primary/secondary | `#2563EB` / `#7C3AED` |
| success/warning/error/info | `#2E7D32` / `#A16207` / `#B3261E` / `#0891B2` |
| border soft/medium/strong | `#E7EDF5` / `#CBD8E8` / `#94A3B8` |

**Dark elevation ladder (audit every screen against this):** page `#0A0A0F` < recessed `#111117` < card `#16181F` < raised `#1C1F27`.

### 4.2 Card system
- **Dark:** gradient `linear-gradient(145deg, rgba(200,210,220,.075), rgba(180,195,210,.038) 50%, rgba(160,175,190,.016))` over `rgba(28,30,38,0.86)`; border transparent; shadow `0 20px 46px -30px rgba(0,0,0,0.66)`; inset hairline `inset 0 1px 0 rgba(210,220,230,0.09)`; **glass** `blur(18px) saturate(1.35)`.
- **Light:** fill `linear-gradient(180deg, rgba(255,255,255,0.98), rgba(250,253,255,0.96))`; border `rgba(37,99,235,0.14)`; shadow `0 24px 70px -42px rgba(30,64,175,0.36)`; no blur (flat).
- **Dark shadow ladder:** xs/sm/md/lg as in tokens (`0 8/12/18/26px …`).

### 4.3 Typography
- **Families:** display/body/brand = **Plus Jakarta Sans**; handwriting (note canvas only) = **Patrick Hand**; mono = platform mono.
- ⚠️ Fonts in repo are `.woff2` (web-only). Flutter needs `.ttf`/`.otf`. **Action:** re-source the same families as TTF — Plus Jakarta Sans weights 400/500/600/700/800/900 and Patrick Hand 400 (both are the same families, open-licensed; Patrick Hand `.ttf` already exists in repo). Bundle under `mobile/assets/fonts/`. Note custom weight **450** (`--type-weight-regular`): map to a 400/500 face or use variable font.
- **Sizes:** 2xs 11 · xs 12 · sm 13 · md 14 · base 16 · lg 17 · xl 18 · 2xl 22 · 3xl 28→31 · 4xl 36→40.
- **Leading:** tight 1.08 · title 1.16 · snug 1.28 · normal 1.45 · body 1.58 · relaxed 1.72.
- **Text styles:** display 900/36 · page-title 800/28 · section-title 800/18 · card-title 800/17 · body 450/16 · body-strong 700/16 · ui 700/14 · label 800/12 · caption 600/13 · metric 800/28.

### 4.4 Radius / spacing / motion
- **Radius:** card 22 · card-compact 18 (mobile) · inner 14 · nav 14.
- **Spacing (4px grid):** 4/8/12/16/24/32. Page pad x 24 / y 16; section gap 24; card pad 24→16 mobile; control height / touch target **44**. Responsive pad `clamp(16, 2.2vw, 24)`.
- **Motion easing:** ease-out `cubic-bezier(0.16,1,0.3,1)` · ease-in `cubic-bezier(0.4,0,1,1)` · standard `cubic-bezier(0.23,1,0.32,1)` → Dart `Cubic(...)` curves.
- **Durations:** micro 140 · hover 150 · dropdown 180 · modal 220 · route 240 · card-enter 220.
- **Route entrance:** `translateY(10px)→0`, ease-out 220ms.
- **Reduced motion:** if `MediaQuery.disableAnimations` (honors iOS Reduce Motion / Android animator scale) → snap all durations to ~1ms, exactly like the web.

### 4.5 Button hierarchy (design direction, 2026-06-13)
- **Hero CTA (rare, accent):** the **blue→indigo gradient** button (`linear-gradient(135deg, #3B82F6 → #6366F1)`, white text, **flat — no glow**) is reserved for a **single** call-to-action in the **dashboard hero** — currently **"Start daily goal."** Use **at most one per screen**, effectively one in the app's main hub. It is an accent, **not** the default button.
- **Primary (everyday):** **solid flat brand blue**, no gradient — dark `#60A5FA` with dark text (`#04121F`); light `#2563EB` with white text. Used for Start exam, Save, Submit, etc.
- **Secondary:** neutral elevated (raised surface `#1C1F27` + hairline border).
- **Soft / tertiary:** primary-light tint (`rgba(96,165,250,0.12)`) + blue text (e.g. "＋ New note").
- **Ghost / link:** text-only where appropriate. This hierarchy is encoded once in the Flutter button theme so the gradient never leaks onto ordinary actions. **All buttons are flat** — no glow, no drop shadow, light hairline borders only; press feedback is a subtle scale/opacity dip (iOS-style).

### 4.6 Native iOS feel — no 3D (design direction, 2026-06-13)
The app should feel like a native iOS app: clean, flat, content-first.
- **No 3D / skeuomorphic effects:** no card-flip rotation (`rotateY`/perspective), no tilt, no extruded depth. The flashcard uses a **flat cross-fade reveal** instead (§11.3).
- **No glows** anywhere (buttons, tab indicator, status dots, logo) and **no heavy strokes** — borders are light hairlines (`--line-soft`); icon strokes are thin, SF-symbol-like (~1.5–1.7 weight).
- **Depth comes only from** (a) iOS materials — the frosted-glass blur/translucency on cards (`UIVisualEffectView`/`BackdropFilter`, kept because it *is* native iOS), and (b) **subtle** ambient shadows — softened from the web values.
- Honors this on both platforms (the Flutter codebase is shared), but the *feel* target is iOS HIG; Android inherits the same flat language.

### 4.7 Native animations — everywhere (design direction, 2026-06-13)
Lean into rich, **native-feeling motion throughout** — but still **no 3D** (§4.6): everything is spring / translate / fade / scale, never rotation. Encode one shared motion kit so every screen feels alive:
- **Page transitions:** iOS push/pop (slide-from-right + interactive back-swipe, `CupertinoPageRoute`); modals as bottom **sheets** that spring up; tab switches cross-fade.
- **Shared-element (Hero) transitions:** course card → course detail, flashcard → expanded, lesson tile → reader, result row → result page.
- **Staggered list entrance:** rows fade + slide-up with ~30–40 ms stagger (`flutter_staggered_animations`).
- **Spring physics** on gestures: sheet drag-to-dismiss, pull-to-refresh, swipe actions on rows, card/button press (subtle scale + opacity dip).
- **Micro-interactions:** tab pill slide, bookmark/heart toggle, checkbox, segmented controls, switches — all animated.
- **Loading:** skeleton **shimmer** placeholders during boot/lazy loads (not spinners) → content cross-fades in.
- **Number / progress motion:** score-ring count-up, progress-bar fills, metric count-ups, streak pulse.
- **Onboarding:** parallax between welcome slides; mascot idle micro-motion; animated page dots.
- **Reduced motion:** all of the above collapse to ~1 ms / plain cross-fade when the OS setting is on.
Flutter tooling: `AnimationController` / `AnimatedSwitcher` / implicit animations, `Hero`, `CupertinoPageRoute`, `SpringSimulation`, `RefreshIndicator` / `CupertinoSliverRefreshControl`, `shimmer`, `flutter_staggered_animations`.

---

## 5. Navigation & responsive shell

Replicates `AppShell` / `StudentPanelLayout` / `AppSidebar`.

### 5.1 Breakpoints
`<380` (tight phone, hide tab labels) · `≤900` (phone/tablet portrait → bottom tab bar) · `≥901` (desktop/large iPad landscape → left sidebar). Secondary content breakpoints 430 / 601 mirrored where the web uses them.

### 5.2 Mobile (≤900): bottom tab bar
- **5 tabs:** Courses · Q-Bank · **Study Hub** (center) · Study · Results — iOS-18-style floating pill indicator; 64px height + `safe-area-inset-bottom`.
- The **"Study"** tab is a grouped hub that routes to Planner / Flashcards / Lessons (AI Notes) / Saved (Bookmarks) / Notes (matchPaths behavior from the web shell).
- `<380px`: hide tab labels, shrink icons.
- Focus-mode routes (taking a quiz/exam, AI-note reader, review) **hide the tab bar** (full-screen), same as web.

### 5.3 Desktop / large tablet (≥901): sidebar
- Left drawer 280px, collapsible to 80px (220ms animation). 10 items in order: **Study Hub, Courses, Planner, Lessons, Flashcards, Q-Bank, Exams, Results, Saved, Subscriptions**.
- Content offset right; active item = brand-primary color + glow shadow; sidebar footer = avatar initials + "Medical Student".
- Cmd/Ctrl-K search parity → in-app search sheet.

### 5.4 Safe area / system insets
Use `SafeArea` + `MediaQuery.padding` to replicate `--lms-safe-*`. iOS notch / Dynamic Island and Android status/nav bars handled natively (no CSS `env()` needed). Content uses full dynamic height (Flutter handles `100dvh` equivalent automatically).

### 5.5 First-run & launch flow (welcome → login → create account)
1. **First-ever launch:** native splash → **`/welcome`** onboarding (2–3 parallax slides introducing Q-Bank/exams, AI notes/flashcards, progress/planner) → **`/auth/login`**.
2. **Later launches:** splash → if a stored session validates via `GET /auth/me` → `/app/dashboard`; otherwise → `/auth/login`. Onboarding is shown **only once**, gated by a persisted `seenOnboarding` flag (`shared_preferences`).
3. **Create account:** from login, "Create account" → **`/auth/register`** (`POST /auth/register`, **same backend + MySQL DB**) → dashboard (Free plan; push notifications default **off** until opt-in).
All auth, accounts, and data come from the **existing NestJS API + MySQL** — the native app keeps no server/data of its own.

---

## 6. Screen build list (all student screens)

Each screen = one Flutter route (go_router) ported from the named web component, wired to the listed endpoints, reproducing the listed effects. Public `/auth/*` and authenticated `/app/*`.

### Auth (public)
| Native route | Web source | Endpoints | Key effects |
|---|---|---|---|
| `/welcome` | (new — native onboarding) | none (local, `seenOnboarding` flag) | **First-run only:** 2–3 parallax welcome slides + animated dots → "Get started" → login. Skipped on later launches (§5.5) |
| `/auth/login` | LoginPage | `POST /auth/login`, `POST /auth/google` (+ `/auth/google/code`) | Animated 4-layer radial-gradient + grid-mask background; Google sign-in |
| `/auth/register` | RegisterPage | `POST /auth/register` | **Create account** — full name/email/password/confirm/terms; password ≥10; → Free plan; "account created"; **same backend + DB** |
| `/auth/forgot-password` | ForgotPasswordPage | `POST /auth/forgot-password` | — |
| `/auth/reset-password` | ResetPasswordPage | `POST /auth/reset-password` | Token from deep link |

### Student app (authenticated)
| Native route | Web source | Endpoints | Key effects / notes |
|---|---|---|---|
| `/app/dashboard` | StudentDashboardPage | `GET /student/boot` (then `/student/dashboard`), `POST /student/dashboard/activity` | Page hero + metric chips; **study mascot**; progress, weak topics, daily goals |
| `/app/pending` | DashboardPage (pending) | `GET /auth/me` | Awaiting-approval holding state |
| `/app/profile` | ProfilePage | `PATCH /auth/profile`, `PATCH /auth/password` | Avatar picker (procedural, §13), password mgmt |
| `/app/courses` | StudentCoursesPage | `GET /student/courses` | Course library, lesson progress; subject color palettes |
| `/app/courses/:id` | CourseDetailPage | `GET /student/courses/:id`, `PATCH /student/courses/lessons/:lessonId/progress` | `csum-*` flat summary; dynamic subject color (cardiology=rose, etc.) |
| `/app/quizzes` | StudentQuizzesPage (practice) | `GET /student/quiz-attempts/quizzes` | Q-Bank practice library |
| `/app/exams` | StudentQuizzesPage (exam) | `GET /student/quiz-attempts/quizzes` | Exam library (timed) |
| `/app/quizzes/:quizId` | TakeQuizPage | `GET …/quiz/:quizId`; practice: `…/practice/:quizId/save\|draft\|finish`, `…/answer/:qid/prewarm\|reveal`; exam: `…/exam/:quizId/save\|submit`; `POST /student/question-reports` | Focus mode (no tab bar); timer; haptics; report question |
| `/app/quizzes/:quizId/practice-review` | PracticeReviewPage | `GET …/practice-review/:quizId` | Answers + explanations |
| `/app/results` | ResultsListPage | `GET …/results` | History list, filter/sort |
| `/app/results/:attemptId` | ResultPage | `GET …/result/:attemptId` | **Animated conic-gradient score ring + count-up** |
| `/app/review/:attemptId` | ReviewPage | `GET …/review/:attemptId`, `POST …/review/:attemptId/complete` | Full incorrect-answer review workspace |
| `/app/ai-notes` | AiNotesListPage | `GET /student/ai-notes` | Lessons/notes library, search |
| `/app/ai-notes/:id` | AiNotesPage | `GET /student/ai-notes/:id` | **Note canvas + procedural pen/scribble sound** (§11.4), paper texture |
| `/app/study/lesson/:lessonId` | AiNotesPage (lesson) | `GET /student/ai-notes/lesson/:lessonId`, `GET /student/lessons/:id`, lesson annotations CRUD `…/lessons/:lessonId/annotations` | Focused canvas edit; highlights/notes |
| `/app/flashcards` | StudentFlashcardsPage | (deck source via study endpoints) | **Flip animation**; 11 card types color-coded |
| `/app/notes` | StudentNotesPage | lessons + annotations endpoints | Personal notes + lesson reader |
| `/app/planner` | StudyPlannerPage | `GET /student/planner`, `GET /student/planner/agenda`, `POST /student/planner`, `PATCH/DELETE /student/planner/:id` | Agenda, tasks, due dates, reminders |
| `/app/study` | StudentStudyPage | — | Hub → AI Notes / Flashcards / Planner |
| `/app/bookmarks` | BookmarksPage | `GET /student/bookmarks`, `POST /student/bookmarks/toggle` | Saved items, filter by type |
| `/app/notifications` | StudentNotificationsPage | `GET /student/notifications`, `POST /student/notifications/:id/read` | Inbox; mark read |
| `/app/subscriptions` | StudentBillingPage | `GET /plans`, `GET /subscriptions/me`, `POST /subscriptions/request`, `…/payhere/initiate`, `…/manual-payment/request`, `PATCH /subscriptions/:id/extend\|renew\|cancel\|payment`, `DELETE /subscriptions/requests/:id` | Plans, status, payment history |
| `/app/subscriptions/checkout/:planId` | StudentCheckoutPage | `POST /subscriptions/payhere/initiate` → **external browser** (§14) | PayHere; return via deep link |
| (settings) | settings.api | `GET /settings/public`, `…/availability`, `POST /settings/availability/unlock` | Branding/feature flags, availability gating |

---

## 7. Backend / API integration

The backend is **unchanged**. The Flutter app calls the same endpoints the web app calls. Authoritative endpoint list is the frontend api wrappers in `frontend/src/shared/api/*.api.js` (13 modules). Full table in §6; the complete set is enumerated and grouped by feature (auth, profile, boot, dashboard, courses, quizzes/exams, results/review, ai-notes, bookmarks, notifications, planner, push, subscriptions, settings).

### 7.1 Base URL (`config.dart`, via `--dart-define`)
The web resolves base URL per platform (`frontend/src/shared/platform/config.js`). Native equivalent:
- **Dev (simulator/emulator):** iOS sim → `http://localhost:3000/api`; Android emulator → `http://10.0.2.2:3000/api`; physical device → `http://<LAN-ip>:3000/api`.
- **Prod:** an **absolute** HTTPS origin (web's same-origin `/api` doesn't exist for a native app). ⚠️ **Open item:** you must provide the production API origin (see §18).

### 7.2 Dio client parity with Axios (`frontend/src/shared/api/client.js`)
- Inject `Authorization: Bearer <token>` when a token exists.
- Timeout: **10s native** default (web uses 30s; native config uses 10s) — configurable.
- **Retry** with exponential backoff (default 2 retries; retry writes), via `dio_smart_retry` + custom logic; base-URL fallback list on network failure.
- On **401** → clear auth, route to login, optional session-lock overlay if user was authenticated.
- **Redaction:** strip tokens/passwords/auth codes from all logs (parity with web).
- Light **response cache** for read endpoints (mirror `createTimedApiCache`).

### 7.3 Boot batching
On launch call **`GET /student/boot`** — one request returning 6 slices (dashboard, notifications, planner/agenda, quizzes, bookmarks, ai-notes) via `Promise.allSettled` server-side; null slices fall back to standalone endpoints. The Flutter app hydrates the dashboard/study-hub from boot, then lazy-loads detail screens.

> **Path note:** frontend wrappers call `/student/boot`, `/student/dashboard`, etc. The backend module scan reported `/boot/student`, `/dashboard/student`. These must be reconciled against the live NestJS controllers at kickoff (1-hour verification task) — the wrappers are the source of truth for what the app sends.

---

## 8. Auth & session

Mirrors `authStore.js` + `authToken.js` (native path).

- **Token model:** server returns `sessionToken` on login/register/google. Store it in **flutter_secure_storage** (Keychain / EncryptedSharedPreferences) under a `lms_native_session_token` key, plus cached `user`.
- **Header:** every request sends `Authorization: Bearer <token>` (no httpOnly cookie on native — that's the web path).
- **Hydration:** at app boot, probe `GET /auth/me` (short timeout); set `isAuthenticated`/`user`; show splash until resolved. go_router redirect guard sends unauthenticated users to `/auth/login`.
- **State keys (Riverpod):** `token`, `user`, `isAuthenticated`, `isHydrating`, `authNotice`, `sessionExpiredLock` — same shape as Zustand store.
- **Sign-up:** `POST /auth/register` `{fullName,email,password,confirmPassword,acceptedTerms}` → set token+user → land on dashboard (Free plan). New-signup notification-off default replicated (push prefs default off until user opts in).
- **Google sign-in:** `google_sign_in` → POST credential to `/auth/google` (or code to `/auth/google/code`). ⚠️ Needs iOS + Android OAuth client IDs (see §18).
- **Logout:** `POST /auth/logout` + clear secure storage + unregister push token (`DELETE /push/native-token`).

---

## 9. Native platform features (replace Capacitor plugins)

Current Capacitor config: App ID `com.erpm.medical.lms` (the **new native apps use a rebranded ID — `app.xyndrome.lk`**), name **xyndrome**, status bar/splash `#0b121b`.

| Capability | Capacitor (current) | Flutter native plan |
|---|---|---|
| **Push** | @capacitor/push-notifications (APNs/FCM) | `firebase_messaging`; register device token via `POST /push/native-token`, unregister on logout. iOS: APNs entitlement + Firebase. Android: FCM. |
| **Local notifications** | @capacitor/local-notifications; channels `default`, `exam_reminders`, `course_updates`, `account_alerts` (vibration+lights) | `flutter_local_notifications`; **recreate the 4 Android channels exactly**; iOS categories. |
| **Haptics** | @capacitor/haptics (impact / selection / transient / notification success-warning-error) | `HapticFeedback` + richer set via platform channel; map each web call site to the matching generator. Honor system haptic/reduced-motion settings. |
| **Status bar** | dark overlay `#0b121b` | `SystemChrome.setSystemUIOverlayStyle` matching `#0b121b`. |
| **Splash** | auto-hide, `#0b121b` | `flutter_native_splash` bg `#0b121b`, logo mark. |
| **Keyboard** | @capacitor/keyboard overlay + listeners | Native insets / `MediaQuery.viewInsets`; scroll-into-view for focused fields. |
| **App lifecycle** | @capacitor/app | `WidgetsBindingObserver` / `AppLifecycleState`. |
| **Deep links** | (PWA shortcuts) | `app_links` / Universal Links + App Links for: password reset, PayHere return, push taps, and shortcuts (Courses / Quizzes / Lessons). |

### 9.4 Open server items (small, additive — confirm at kickoff)
- `POST /push/native-token` already exists ✅ — confirm payload shape (platform, token).
- PayHere return URL must redirect to a deep link the app can catch (or app polls `GET /subscriptions/me`). May need one config value server-side. Confirm.

---

## 10. Responsive / multi-form-factor

The web is mobile-first with phone/tablet/desktop layouts; Flutter replicates with `LayoutBuilder` + `MediaQuery`:
- **Phone (≤900):** single column, bottom tab bar, compact card radius 18, page pad 16–24.
- **Tablet / iPad (601–900 portrait, ≥901 landscape):** wider content column (mirror the web's single forced width ~1080 where applicable), sidebar appears ≥901.
- **Desktop (≥901):** sidebar 280/80, multi-column where the web uses it.
- Test matrix in §17 covers iPhone SE → Pro Max, iPad mini → 12.9", common Android phones + tablets, and large-window desktop.

---

## 11. The hard parts (effects) — replication strategy

### 11.1 Dark glassmorphism cards
`BackdropFilter(ImageFilter.blur(18,18))` inside a `ClipRRect(22)`, layered with: the 3-stop diagonal grey gradient over `rgba(28,30,38,0.86)`, an inner 1px hairline (`inset 0 1px 0 rgba(210,220,230,0.09)` via a top border-gradient), and the ambient shadow. The `saturate(1.35)` needs a **color-matrix shader** (`ColorFilter.matrix`) layered with the blur, since `ImageFilter.blur` alone won't saturate. Build one reusable `GlassCard` widget; tune blur/saturation per platform if needed. Light mode = flat (no backdrop filter).

### 11.2 Score ring (Result page)
`CustomPainter` drawing a conic/sweep gradient arc + `AnimationController` count-up of the number, ease-out 220–600ms; reduced-motion → instant.

### 11.3 Flashcard reveal + 11 card types
**No 3D flip** (per §4.6). Tapping a card does a **flat cross-fade reveal** (front fades/slides out, answer fades/slides in — `AnimatedSwitcher` / opacity + small `translateY`), the native-iOS feel. Color-coded badges per the 11 types (Q&A, Definition, Mechanism, Features, Management, Classification, Causes, Diagnosis, Complications, Mnemonic, Key Points, Summary).

### 11.4 Note canvas + **procedural scribble/drawing audio** (highest-risk item)
The web generates audio **on the fly with the Web Audio API — there are no sound files** (`NoteCanvas.jsx` lines 612–698; `AiNotesPage.jsx` `startDrawingStrokeSound`/`modulate`/`stop`). Two behaviors to replicate:
1. **Scribble (typing):** 55ms filtered-noise burst, bandpass 1700–3000 Hz Q≈6, throttled ≥58ms (~17/s), fired on text input.
2. **Drawing ('spen'):** 3 looped procedural buffers (main/texture/vertical) modulated in real time by pen **pressure, speed, tilt, direction**; throttle 95–320ms. Plus a 'secret' mode (fart/dog/cat/boing/squeak).

**Audio — Flutter approach:** use **`flutter_soloud`** (low-latency engine that supports raw PCM buffers + real-time volume/pitch modulation and looping). Either (a) synthesize equivalent noise buffers at runtime, or (b) since the scribble is deterministic, **pre-render a few short PCM/wav clips** offline and modulate playback rate/volume per stroke (simplest, near-identical result). For Apple Pencil / S-Pen, read `PointerEvent.pressure`, `tilt`, and compute speed/direction from successive points. Mark this as a focused spike (1–2 days) with a fidelity check against the web.

**Ink / drawing surface — two fidelity tiers:**
- **Tier A (default, one codebase):** `CustomPaint` + `perfect_freehand` (Dart port) for natural pressure-aware strokes, rendered on **Impeller** (Flutter's Metal-backed iOS renderer); paper grain/tooth via a tiled texture or noise shader; handwriting text uses **Patrick Hand**. Smooth at 120 Hz; perceived latency is ~90–95% of Apple Notes — indistinguishable for the vast majority of note-taking.
- **Tier B (equal-to-native ink, recommended upgrade):** embed the platform's **real ink engine as a native view** — **`UiKitView` hosting `PKCanvasView` (PencilKit)** on iOS and **`AndroidView` hosting a native ink/`MotionEvent` canvas** on Android — while the rest of the AI-notes screen (lists, reader, callouts, offline-first store, sync) stays shared Flutter. This gives Apple's predictive-touch, ~9 ms ink — **literally equal to a fully-native Swift app** — at the cost of a small per-platform native module to maintain. Choose Tier B if Apple-Notes-grade handwriting is a priority; otherwise ship Tier A and upgrade the canvas later without touching the rest of the app.

### 11.5 Animated login background
4-layer radial-gradient (cyan + indigo + blue + sky) + grid-mask, slowly animated. Flutter: stacked `RadialGradient` containers + a `CustomPainter` grid with a mask, animated via a long-running `AnimationController`; reduced-motion → static.

### 11.6 Haptic vocabulary
Map every web haptic call site (impact / selection / transient / success-warning-error) to the matching Flutter generator so the feel matches; honor system settings.

### 11.7 Reduced motion
Global: read `MediaQuery.disableAnimations`; a `motion.dart` helper returns ~1ms durations when true — applied to all of the above.

---

## 12. Branding & assets pipeline

Reuse the **exact** brand assets so it matches pixel-for-pixel.

| Asset | Source | Native use |
|---|---|---|
| Logo mark (gradient X + stethoscope) | `frontend/public/brand/xyndrome-logo-mark-{light,dark}.webp` | In-app logo. Files named **by background**: **dark theme → `-dark.webp`**, **light theme → `-light.webp`** (per `LandingNav.jsx`). Convert webp→png/svg for crisp native scaling. |
| App icon source | `pwa-icon.svg`, `pwa-icon-512.png`, `apple-touch-icon.png` | Generate iOS icon set + Android adaptive icon (`pwa-maskable*` as adaptive foreground) via `flutter_launcher_icons`. |
| Fonts | Plus Jakarta Sans (`.woff2`) + Patrick Hand (`.ttf`) | Re-source PJS as `.ttf` (same family); bundle both under `assets/fonts/`. |
| Medical icons | `frontend/public/medical/*.svg` (10: blood, brain, dna, heart, lungs, microscope, pills, stethoscope, syringe, tooth) | `flutter_svg`. |
| Course/quiz art | `frontend/public/lms-assets/quiz-course-art/{maternal,medicine,surgery,systems}-cutout.{png,webp}` | Bundle as image assets. |
| Mascot | `StudyMascot.jsx` (5 inline-SVG variants: stetho, brain, readiness, streak, review) + generated webp mascots in `public/temp/mascots/` | Port SVG variants to `flutter_svg` widgets (preferred) or bundle webp. |
| Avatars | `profileAvatarData.js` (6 procedural variants: skin/hair/shirt combos) | Port the generator to a Dart `CustomPainter`/SVG. |
| UI icons | inline JSX SVG (`ActionIcons.jsx`, nav icons) | Port to a Dart icon set (SVG or `IconData`). |
| Manifest meta | `manifest.webmanifest`: name "xyndrome", theme/bg `#05070d`, shortcuts Courses/Quizzes/Lessons | Drives app name, splash color, home-screen quick actions. |

---

## 13. App identity & store metadata
- **Name:** xyndrome. **Bundle / Application ID:** **`app.xyndrome.lk`** (rebranded from the old `com.erpm.medical.lms`; `erpm` dropped). Because the ID changed, these are **new App Store / Play listings**, not an in-place update of the old erpm app. Flutter package name = `xyndrome`; the iOS `PRODUCT_BUNDLE_IDENTIFIER` and Android `applicationId`/`namespace` are set to `app.xyndrome.lk`. Use a temp dev id `app.xyndrome.lk.dev` during development to install side-by-side with any existing build.
- Categories: Education / Medical (from manifest).
- iOS: APNs, Sign in with Google, Universal Links entitlements. Android: FCM, App Links, adaptive icon.

---

## 14. Billing (your choice: external web checkout) — with risk flagged
- **Plan:** the native Subscriptions screen reads plans + status (`GET /plans`, `GET /subscriptions/me`). Checkout opens the existing **PayHere** web flow (`POST /subscriptions/payhere/initiate` → payment URL) in the **system browser** via `url_launcher`; on completion the user returns via deep link and the app refreshes `GET /subscriptions/me`. Manual-payment and request flows reuse the same endpoints.
- ⚠️ **Store-policy risk (on record):** Apple App Store (Guideline 3.1.1) and Google Play generally **require their in-app purchase systems for digital subscriptions** and reject apps that route digital-goods purchases to an external web checkout. This can block approval. Mitigations if rejected: (a) hide purchase in the app and present plans as informational only, or (b) implement StoreKit / Play Billing later. We build external-checkout for v1 as decided and keep IAP as a fast-follow option.

---

## 15. Configuration & environments
- `--dart-define` flavors: `dev`, `staging`, `prod` → API base URL, Google client IDs, Firebase config, PayHere return URL.
- `mobile/lib/config/config.dart` reads these; no secrets committed.
- Firebase project(s) for FCM/APNs; `google-services.json` (Android) + `GoogleService-Info.plist` (iOS).

---

## 16. Tooling, build & release
- **Toolchain:** Flutter stable, Dart 3, Xcode (iOS), Android Studio / Gradle (Android).
- **CI/CD (proposed):** GitHub Actions / Codemagic — analyze + test on PR; build IPA/AAB on tag; deliver to **TestFlight** + **Play Internal testing**.
- **Signing:** iOS provisioning + APNs key; Android keystore (Play App Signing).
- **Versioning:** semver + build number; match store track.

---

## 17. Testing & QA
- **Unit/widget tests:** theme tokens, API client (auth header, 401, retry, redaction), repositories, key widgets (GlassCard, ScoreRing, Flashcard).
- **Golden tests:** snapshot critical screens in light + dark to lock visual fidelity.
- **Integration:** auth flow, boot hydration, take-quiz (practice + exam), result, note canvas.
- **Responsive matrix:** iPhone SE/14/15 Pro Max; iPad mini/Air/12.9"; Pixel/Samsung phones + tablet; large desktop window. Verify bottom-tab ↔ sidebar switch at 900/901, safe-area on notch/Dynamic Island, dark elevation ladder on every screen.
- **Fidelity audit:** side-by-side vs. web for each screen (color tone, radius, shadows, motion timing, glass).
- **Accessibility:** reduced-motion, dynamic type, contrast (Apple HIG semantics), 44px touch targets.

---

## 18. Risks & open items (need from you / to confirm at kickoff)
1. **Production API origin (HTTPS)** — required; native can't use same-origin `/api`. *(blocking for prod build, not for dev)*
2. **Google OAuth client IDs** (iOS + Android) for `/auth/google`. *(blocking for Google sign-in)*
3. **Firebase / APNs setup** — Firebase project + APNs auth key for push. *(blocking for push)*
4. **PayHere return deep link** — confirm return URL → app deep link (or poll `subscriptions/me`).
5. **Billing store policy** — accept rejection risk of external checkout, or plan IAP fast-follow (§14).
6. **Procedural audio fidelity** — confirm the soloud / pre-rendered approach matches the web's pen feel (spike).
7. **API path reconciliation** — `/student/boot` (frontend) vs `/boot/student` (backend scan) — 1h verification.
8. **Bundle ID** — ✅ decided: **`app.xyndrome.lk`** (new listings; rebrand from `com.erpm.medical.lms`).
9. **Fonts** — confirm re-sourcing Plus Jakarta Sans as `.ttf` (same family, open license).
10. **"Free stuff" definition** (offline-first scope, §3.3) — confirm it means the student's own notes/annotations **plus** backend-flagged free (non-premium) lessons/flashcards/quizzes. Does the API expose a `free`/premium flag per item?

---

## 19. Work breakdown (ordered tasks — "one task at a time," built into one app)

> All screens ship together (your choice), but built in this dependency order so each task is runnable/verifiable.

**T0 — Project bootstrap**
- Create `mobile/` Flutter app; configure flavors (`dev/staging/prod`), bundle IDs, splash, launcher icons, fonts.

**T1 — Design system**
- `tokens.dart` (all §4 values) + light/dark `ThemeData`; `GlassCard`, shadows, typography, motion helper, reduced-motion.

**T2 — Networking & auth core**
- Dio client (auth header, timeout, retry, 401, redaction, base-URL fallback); secure storage; Riverpod auth store; `/auth/me` hydration; go_router with auth redirect.

**T3 — Navigation shell**
- Responsive shell: bottom tab bar (5) ≤900 + sidebar (10) ≥901; focus-mode hiding; safe areas; page hero + metric chips.

**T4 — Onboarding + Auth screens**
- First-run **welcome/onboarding** (2–3 parallax slides + animated dots, persisted `seenOnboarding`) → login (§5.5).
- Login (animated bg + Google), **Create account / Register** (`POST /auth/register`, same DB), Forgot, Reset (deep link).
- Shared **motion kit** (§4.7) wired here first: page transitions, hero, staggered entrance, shimmer.

**T5 — Dashboard / Study Hub**
- Boot batching hydration; metrics, weak topics, daily goals, mascot.

**T6 — Courses**
- Library + course detail (subject color palettes, lesson progress).

**T7 — Q-Bank / Exams + Take Quiz**
- Practice + exam libraries; TakeQuiz focus mode (timer, save/draft/finish, reveal/prewarm, exam submit, report question); haptics.

**T8 — Results & Review**
- Results list; Result page (score ring + count-up); Review workspace; practice-review.

**T9 — AI Notes / Lessons + Note Canvas**
- List + reader; **note canvas** (CustomPaint + pressure) + **procedural audio spike**; annotations CRUD; paper texture; Patrick Hand.

**T10 — Flashcards**
- Flip animation + 11 color-coded types.

**T11 — Planner / Notes / Bookmarks (+ offline-first slice, §3.3)**
- Planner agenda CRUD; personal notes; bookmarks toggle/filter.
- Local DB (Hive/Drift) as source of truth for **personal notes** + **free content**; offline create/edit; background sync queue (dirty flags, last-write-wins); offline/"saved on device" indicators.

**T12 — Notifications + Push**
- Inbox + mark-read; FCM/APNs registration to `/push/native-token`; 4 local-notification channels; push prefs (default off for new accounts).

**T13 — Profile**
- Profile edit, avatar picker (procedural), password change.

**T14 — Subscriptions + external checkout**
- Plans + status; PayHere external browser checkout + deep-link return.

**T15 — Settings / availability gating**
- `/settings/public` + availability unlock.

**T16 — Polish & fidelity pass**
- Side-by-side audit vs web; glass tuning; motion timing; reduced motion; accessibility; golden tests.

**T17 — Release engineering**
- CI/CD, signing, TestFlight + Play internal; store assets.

---

## 20. Definition of done
- Both apps build and run natively on iOS + Android (no webview).
- Every student screen in §6 present, wired to the same backend, visually matching the web (light + dark) within the fidelity audit tolerance.
- Bottom-tab ↔ sidebar responsive behavior correct across the test matrix; safe areas correct.
- Auth (email + Google), boot hydration, take-quiz, results, note canvas + scribble feel, flashcards, planner, notifications + push, subscriptions external checkout all functional.
- Reduced-motion, haptics, and dark elevation ladder verified.
- TestFlight + Play internal builds delivered.

---

### Appendix A — Source-of-truth files in the existing app
- Design tokens: `frontend/src/shared/styles/00-tokens/` + `01-base/theme.css`
- Nav shell: `frontend/src/shared/layout/{AppShell,StudentPanelLayout,AppSidebar}.jsx`
- Auth: `frontend/src/shared/stores/authStore.js`, `authToken.js`
- API client: `frontend/src/shared/api/client.js`; wrappers: `frontend/src/shared/api/*.api.js`
- Platform/base-URL: `frontend/src/shared/platform/config.js`
- Note canvas + audio: `frontend/src/surfaces/app/student/ai-notes/{NoteCanvas,AiNotesPage}.jsx`
- Capacitor config: `frontend/capacitor.config.ts`
- Assets: `frontend/public/brand/`, `frontend/public/medical/`, `frontend/public/lms-assets/`, `frontend/src/shared/assets/fonts/`
- Manifest: `frontend/public/manifest.webmanifest`
