# Student App System and Design Log

Created: 2026-05-17

This file records the current understanding before any implementation. It is intentionally a planning and alignment document, not a code-change plan that has already been approved.

## Current Agreement

- No app code should be changed until explicit approval is given.
- The first implementation focus is the student home/dashboard only.
- Admin pages are out of scope for the first phase.
- The new direction should work as both a responsive website surface and a native app surface.
- The public website should live on the main domain, for example `domain.com`.
- The student app surface should live on the app subdomain, for example `app.mydomain.com`.
- During local development, localhost stands in for the future app subdomain.
- The native app should use the student app surface, with the exact bundled-vs-remote loading strategy still to be finalized.
- Work should follow explicit surface scope:
  - If the request says `app`, change only the student app surface.
  - If the request says `website`, change only the public website surface.
  - If the request says `both`, change both surfaces deliberately.
- Old student dashboard design can eventually be removed/replaced, but only after the final approach is approved.
- The proposed frontend surface/folder migration is documented in `docs/frontend-surface-architecture-plan.md`.
- The frontend source migration to `surfaces/website`, `surfaces/app`, `surfaces/admin`, and `shared` has been completed.
- Apache deep-link fallback is handled by `.htaccess` so local `/lms/app/*` and `/lms/admin/*` paths can load the React app.

## Existing System Shape

The project is already organized around a React frontend, NestJS backend, Capacitor native wrapper, Electron desktop wrapper, and shared contracts.

```text
/lms
  app-3/                 New UI prototype and design source
  frontend/              React + Vite frontend
    src/app/             App frame, router, providers, boot/error handling
    src/surfaces/app     Student LMS app pages
    src/surfaces/website Public website and auth entry pages
    src/surfaces/admin   Admin-only pages
    src/shared/          Shared API, shell, platform, stores, styles, utilities
    ios/                 Capacitor iOS wrapper
    android/             Capacitor Android wrapper
  backend/               NestJS API
  shared/                Shared types, constants, contracts, validation
  desktop/               Electron desktop wrapper
  docs/                  Project notes and architecture docs
```

## Runtime Split Already Present

The frontend already has platform detection in `frontend/src/shared/platform/detect.js`.

It detects:

- `web`
- `pwa`
- `native`
- `desktop`
- phone/tablet/desktop form factors
- iOS/Android/macOS/Windows/Linux operating systems

The frontend already has host logic in `frontend/src/shared/platform/config.js`.

Relevant behavior:

- Main router basename defaults to `/lms` for normal web.
- Native and desktop builds use `/`.
- `VITE_APP_ONLY_HOSTS` and `VITE_APP_ONLY_HOST_PATTERN` can identify app-only hosts.
- The default app-only host pattern already matches `app.` and `app-lms.` style domains.
- `AppOnlyBrowserGate` can block normal browser access to app-only hosts if configured.

This means the codebase is already partly prepared for:

```text
domain.com          Public website
app.mydomain.com    Student app/native app endpoint
localhost           Local development stand-in
```

## Build and Packaging

Root commands in `package.json` coordinate the separate parts:

- `npm run build:frontend`
- `npm run build:backend`
- `npm run start:api`
- `npm run start:api:bg`
- `npm run mobile:cap:sync`
- `npm run mobile:cap:ios`
- `npm run mobile:cap:android`
- `npm run desktop:dev`

Frontend commands in `frontend/package.json` define target builds:

- `npm run build:web`
- `npm run build:pwa`
- `npm run build:cap`
- `npm run build:desktop`

The Capacitor config uses:

```text
webDir: dist-capacitor
appId: com.erpm.medical.lms
appName: ERPM Medical LMS
```

This means the native app currently bundles built web assets from `frontend/dist-capacitor`. If the final production strategy is to wrap a remote `app.mindomain.com` instead, the native strategy needs a deliberate decision:

- Bundle local web assets into the app, or
- Point the native app at a remote app endpoint, or
- Use a hybrid approach with local shell and remote API/data.

That decision should be settled before implementation.

## Routing Shape

The router in `frontend/src/app/router.jsx` already separates roles:

```text
/admin/...   Admin routes
/app/...     Student app routes
/dashboard   Legacy/role-switched route
```

Student route examples:

- `/app/dashboard`
- `/app/courses`
- `/app/quizzes`
- `/app/exams`
- `/app/ai-notes`
- `/app/results`
- `/app/subscriptions`

Admin route examples:

- `/admin/dashboard`
- `/admin/courses`
- `/admin/questions`
- `/admin/quizzes`
- `/admin/users`
- `/admin/settings`

There are also legacy unprefixed routes such as `/dashboard`, `/courses`, and `/quizzes`. The app frame redirects authenticated users toward role-appropriate paths.

## Current Layout System

The authenticated app shell is built around:

- `frontend/src/shared/layout/AppShell.jsx`
- `frontend/src/shared/layout/AppSidebar.jsx`
- `frontend/src/shared/layout/AppHeader.jsx`
- `frontend/src/shared/search/GlobalSearch.jsx`
- `frontend/src/shared/styles/02-layout/*`
- `frontend/src/shared/styles/05-platforms/*`

Current student navigation:

- Desktop/tablet uses `AppSidebar`.
- Phone uses `MobileBottomNav`.
- Student mobile bottom nav already has:
  - Courses
  - Q-Bank
  - Home
  - Lessons
  - Results

This matches the `app-3` prototype direction closely.

## Student Dashboard Today

The current student dashboard lives in:

```text
frontend/src/surfaces/app/student/dashboard/StudentDashboardPage.jsx
frontend/src/shared/styles/04-pages/dashboard.css
```

It already pulls real student data through:

- `fetchStudentDashboard`
- `fetchStudentQuizzes`
- `fetchStudyBookmarks`
- `listAiNotes`

Major current dashboard sections:

- Study Hub topbar
- Welcome/resume hero
- Streak card
- Quick actions
- Performance summary cards
- Score trend
- Today's study plan
- Daily goals
- Recent attempts

This is important: the production dashboard already has real data logic. The redesign should reuse that data model where possible instead of treating `app-3` as a data replacement.

## `app-3` Prototype

The `app-3` folder contains a standalone prototype, not just screenshots.

Important files:

```text
app-3/index.html
app-3/app-shell.jsx
app-3/screens-1.jsx
app-3/screens-2.jsx
app-3/tweaks-panel.jsx
app-3/audit.html
app-3/screenshots/
app-3/uploads/
```

The prototype renders a medical study app redesign called `Medical Study App — Redesign`.

It uses:

- React loaded from CDN
- Babel in-browser JSX transform
- `Plus Jakarta Sans`
- `Bricolage Grotesque`
- A phone-frame preview
- Shared tokens in `app-shell.jsx`
- A top app header
- A bottom tab nav
- Several screens: Study Hub, Q-Bank, Courses, Lessons, Results, lesson detail

The prototype is useful as a design source, but it is not production-ready as-is because:

- It uses CDN scripts.
- It uses browser Babel.
- It is not connected to the real LMS API.
- Its components are global-window prototype components, not imported production React modules.

## `app-3` Design Direction

Main visual language:

- Soft lavender background
- White cards
- Deep navy text
- Cobalt-to-purple gradient used sparingly
- Rounded but structured phone UI
- Strong hierarchy with large friendly headings
- App-like top header and bottom nav
- Fewer controls visible at once
- Clear primary action: resume/practice/continue
- Encouraging empty states
- Score, streak, and progress treated as first-class information

Prototype tokens:

```text
bg:          #EFF1FB
surface:     #FFFFFF
surface2:    #F4F5FB
ink:         #0E1538
primary:     #3D5AFE
accent2:     #8B5CF6
ok:          #16A974
warn:        #F08A2C
danger:      #E5484D
```

Navigation design in `app-3`:

- Top header: menu, title/eyebrow, search, avatar
- Bottom tabs: Courses, Q-Bank, Home, Lessons, Results
- Detail screens use back navigation
- Extra controls should move into menu or context areas

The audit file says the header should stay limited to about three controls. This is a good principle for the native/student app.

## Design Warnings

The existing dashboard CSS currently has very large responsive type and heavy overrides in `dashboard.css`. It appears to have been tuned aggressively for dashboard visuals and imported last in `styles/index.css`.

Because `dashboard.css` is imported last, it can override many earlier design tokens and platform rules.

That means the redesign should avoid layering more overrides on top of old overrides. The cleaner final approach is probably:

- Preserve dashboard data-fetching and behavior.
- Replace old dashboard layout/CSS with a cleaner app-style structure.
- Keep the rest of the student/admin system stable during phase one.
- Avoid touching admin CSS or admin layout.

## Proposed Product Split

Recommended mental model:

```text
Public website
  Domain: domain.com
  Audience: public visitors, marketing, login/register entry
  Navigation: website navbar, landing sections, public pages

Student app
  Domain: app.mydomain.com or local development equivalent
  Audience: authenticated students
  Navigation: app-like shell, bottom tabs on phones, sidebar/topbar on desktop if needed
  Native: wraps or loads this app surface

Admin console
  Domain/path: admin area
  Audience: admins only
  Navigation: admin sidebar/console
  First phase: do not touch
```

## Phase One Recommended Scope

Status update: the physical surface split is complete. The next app work should focus on redesigning the student dashboard inside the new app surface.

Only redesign:

```text
frontend/src/surfaces/app/student/dashboard/StudentDashboardPage.jsx
frontend/src/shared/styles/04-pages/dashboard.css
```

Possibly inspect but avoid changing unless approved:

```text
frontend/src/shared/layout/AppHeader.jsx
frontend/src/shared/layout/AppSidebar.jsx
frontend/src/shared/layout/AppShell.jsx
frontend/src/shared/styles/02-layout/bottom-nav.css
frontend/src/shared/styles/05-platforms/native*.css
```

Do not change:

```text
frontend/src/surfaces/admin/
backend/
database/
shared API contracts
admin routes
admin navigation
```

## Phase One Dashboard Intent

Student dashboard should become the real production version of the `app-3` Study Hub.

Keep from current dashboard:

- Real API data
- Authenticated student context
- Resume/recommended action logic
- Recent attempts
- Daily goals
- Performance summary
- Lesson/note links
- Error/loading states

Borrow from `app-3`:

- Friendly Study Hub composition
- Top app header restraint
- Strong continue card
- Streak treatment
- Compact performance cards
- Bottom-tab mental model
- Responsive phone-first layout
- Soft lavender/white/deep-navy palette
- Gradient only as a motif, not everywhere

## Responsive Requirements

The student dashboard must be checked across:

- Small phones around 320px wide
- Normal phones around 390px wide
- Large phones
- Tablets
- Desktop web
- Native iOS safe areas
- Native Android safe areas

Core rule: no text overlap, no card overlap, no clipped bottom content behind tab bars, no unreadable tiny controls, no desktop-only layout forced onto phones.

## Open Questions

These must be answered before implementation:

1. Should `app.mindomain.com` be accessible in a normal browser, or only inside the native app?
2. Should the native app load remote `app.mindomain.com`, or bundle `dist-capacitor` locally?
3. Should the public PWA on `mindomain.com` include the logged-in student app, or should PWA only be public/marketing/login?
4. Should phase one replace only the student dashboard design, or also adjust the shared student shell/navigation?
5. Should desktop student view use a sidebar/topbar, or a widened version of the app-style dashboard?
6. Should the final student mobile nav be exactly `Courses`, `Q-Bank`, `Home`, `Lessons`, `Results`?
7. Should the old dashboard CSS be fully replaced in phase one, or kept partially while the new dashboard is introduced?

## Suggested Approval Gate

Before coding, approve one of these directions:

### Option A: Dashboard Only

Replace only the student dashboard UI using `app-3` as inspiration. Keep the current shell/sidebar/nav.

Lowest risk. Best first step.

### Option B: Dashboard Plus Student Mobile Shell

Replace the dashboard and tune the mobile student bottom nav/header to match `app-3`.

Medium risk. Better app feel.

### Option C: Student App Surface

Create a stronger `/app` student-only experience for dashboard and navigation, while keeping admin and public website separate.

Higher risk. Best long-term structure, but needs clearer domain/native decisions first.

## Current Recommendation

Start with Option A or Option B.

Do not redesign everything at once. The safest path is:

1. Make student dashboard excellent.
2. Verify phone/tablet/desktop/native behavior.
3. Then decide whether to migrate the remaining student pages.
4. Keep admin untouched.

## 2026-05-17 Dashboard Redesign Decision

The student dashboard redesign completed its first pass with Option A: dashboard only.

Implementation notes:

- Source inspiration is `app-3/screens-1.jsx` and its Study Hub dashboard structure.
- Production dashboard file is `frontend/src/surfaces/app/student/dashboard/StudentDashboardPage.jsx`.
- Production dashboard styles are now fully replaced in `frontend/src/shared/styles/04-pages/dashboard.css`.
- Old dashboard-specific class system was removed from the student dashboard instead of layering overrides.
- Admin dashboard was not touched.
- The same student dashboard surface serves browser web and the native app wrapper path under `/app/dashboard`.
- Build passed with `npm run build --prefix frontend`.

Current dashboard direction:

- Match the `app-3` home dashboard much more literally, not just as inspiration.
- Narrow native-style Study Hub feed on web and app surfaces.
- `app-3` style top bar: menu, title, search, avatar.
- White continue/resume hero card with soft gradient motif and stethoscope mark.
- Orange daily streak card with 4-week heatmap.
- Navy readiness card with gradient icon and progress rail.
- Three compact quick action cards.
- Random active database question card replacing the previous case card; it reveals the answer only after an option tap.
- Admin dashboard remains untouched.

## CSS Cleanup Rule

For every UI change from this point:

- Do not layer new visual CSS over old page-specific CSS.
- Delete or replace the old related styles in the same pass.
- Keep each page surface owning its own design in `04-pages` when possible.
- Shared utility CSS may keep only cross-page safety rules, not old dashboard/page visuals.
- Before finishing a UI change, search for leftover selectors from the removed design and remove them if they belong to the changed area.

Dashboard cleanup already applied:

- `frontend/src/shared/styles/04-pages/dashboard.css` owns the dashboard design.
- Old dashboard selectors were removed from `frontend/src/shared/styles/06-utilities/responsive.css`.
- Old native dashboard selector was removed from `frontend/src/shared/styles/05-platforms/native.css`.
- Remaining old dashboard selectors were removed from `frontend/src/shared/styles/99-legacy/app.css` and `frontend/src/shared/styles/03-components/cards.css`.

## 2026-05-17 Student Surface Responsive Pass

The student app shell now has a scoped `student-app-shell` class, so student pages can receive the Study Hub visual language without leaking into admin.

Implementation notes:

- Student-wide responsive styles live in `frontend/src/shared/styles/04-pages/student-app.css`.
- The stylesheet applies only inside `.student-app-shell`.
- It updates non-dashboard student pages to the Study Hub palette, rounded cards, responsive topbar, touch-friendly controls, tables, forms, alerts, and mobile spacing.
- Dashboard, exam, practice review, and review pages are excluded from the broad route-page shell because they already own specialized layouts.
- Admin remains outside this styling path.
- Frontend build passed with `npm run build --prefix frontend`.
