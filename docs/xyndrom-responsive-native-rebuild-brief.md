# xyndrom Responsive Web And Capacitor Native Rebuild Brief

Status: discussion draft
Created: 2026-06-10
Workspace: `/Applications/XAMPP/xamppfiles/htdocs/lms`
Proposed separate app root: `/Applications/XAMPP/xamppfiles/htdocs/xyndrom`

## Copy-Paste Master Prompt

Use this prompt when starting or resuming the xyndrom rebuild discussion:

```text
We are rebuilding our current patched LMS into a fresh separate app named xyndrom at `/Applications/XAMPP/xamppfiles/htdocs/xyndrom`.

The existing LMS at `/Applications/XAMPP/xamppfiles/htdocs/lms` is the reference source for product behavior, API concepts, database schema, brand assets, design tokens, routes, content structure, lessons, quizzes, results, subscriptions, notifications, admin workflows, and security tests. Do not blindly copy patched frontend code. Reuse the best concepts and data contracts, then build a cleaner responsive browser web app plus a full-control local Capacitor native app.

Primary goal:
Create a premium medical study app that feels native, smooth, secure, responsive, and optimized for lower-end devices. It must not feel like a website trapped inside a WebView, and the native build must not be a hosted/guest web page.

Architecture direction:
- New app root: `/Applications/XAMPP/xamppfiles/htdocs/xyndrom`.
- Frontend: React + Vite, fresh app shell, responsive browser web, and local bundled Capacitor native app. Do not build an installable web-app target.
- Native: Capacitor iOS and Android with locally bundled assets, StatusBar, SplashScreen, Keyboard, Haptics, App lifecycle, Push Notifications, Local Notifications, safe areas, native back behavior, reconnect handling, and secure token storage.
- Native hard rule: do not point Capacitor production builds at a hosted website URL. The native app owns navigation, shell, transitions, storage, permissions, and plugins locally; the server is used for API/data only.
- Backend: use the current NestJS API and MySQL database first. Improve endpoints, indexes, pagination, caching, and response shaping only where the new UI shows a real need.
- Database: keep the existing learning data model as the first source of truth. Bundle stable app chrome, theme, onboarding, subject metadata, and static UI content locally so the app is not over-dependent on database calls.

Design direction:
- Use Apple Human Interface Guidelines ideas for materials and color: materials must support hierarchy, color must be semantic and adaptive, light/dark modes must be designed together, and accessibility settings must be respected.
- Build a modern medical visual language with restrained morphism: blur, translucency, depth, and edge highlights only where they improve hierarchy.
- Provide low-power fallbacks for blur, heavy shadows, background effects, and animations.
- Avoid generic AI-looking layouts. Use real LMS concepts, real medical study content, realistic empty/loading/error states, and polished domain-specific UI.
- Create both dark mode and light mode with user/system switching.
- Ask the owner to choose the final color theme before mockups.

Motion direction:
- Smooth but controlled native-feeling motion.
- Use route transitions, sheet/drawer transitions, quiz answer feedback, list reveals, skeleton loading, and press feedback.
- Animate transform and opacity only.
- No animation should block input.
- Respect `prefers-reduced-motion`.
- Include a performance mode: Auto, Rich, Balanced, Low.
- Target 60 fps on mid-range phones and graceful behavior on low graphical devices.

Security direction:
- Use OWASP Top 10 2025 for web risk awareness.
- Use OWASP ASVS 5.0.0 for API/backend verification.
- Use OWASP MASVS and Mobile Top 10 2024 for Capacitor/mobile security.
- Enforce server-side authorization. Never trust role, subscription, or access state from the client.
- Use parameterized SQL/query APIs only.
- Store native tokens in secure storage, not plain localStorage.
- Add validation, rate limits, upload limits, MIME checks, audit logs, CSP, dependency scanning, secrets checks, and regression scripts.

First discussion task:
Ask more than 20 decision questions covering brand style, logo, colors, theme, dark/light mode, native behavior, database strategy, offline needs, animation style, security, platforms, and first mockups.

First deliverable:
Create or update a simple Markdown planning file we can review before implementation. Do not scaffold the app until the owner answers the key decisions.
```

## Owner Answer Template

Paste short answers under this template when ready:

```text
Name/spelling: xyndrom (final)
Logo direction:
Preferred theme candidate:
Dark/light mode default:
Primary accent color:
Morphism strength:
Low-device fallback: yes/no
First release audience: students/admins/both
Native platforms first:
Offline requirements:
Push/local notifications:
Admin inside native app: yes/no
Database change permission:
API versioning preference:
Top 3 screens for mockups:
Animation style:
Security extras:
First milestone:
```

## Goal

Create a clean xyndrom app that feels native, smooth, secure, and easier to maintain than the current patched LMS surface.

The new build should reuse the best ideas from the current LMS: API concepts, database model, content structure, brand direction, lessons, quizzes, results, subscriptions, notifications, and admin workflows. It should not blindly copy the patched frontend code. The target is a separate responsive browser web app plus a local bundled Capacitor native app for iOS and Android.

## What We Already Have In The Current LMS

- Root stack: React/Vite frontend plus NestJS backend rebuild.
- Mobile stack: Capacitor 8 already installed in `frontend/`.
- Existing native config reference: app id `com.erpm.medical.lms`, older app name, native web dir `dist-capacitor`; the new app must use final app name `xyndrom`.
- Current API map covers auth, dashboard, courses, lessons, quizzes, results, admin content, users, plans, subscriptions, notifications, push, and study planner.
- Current database concept includes users, courses, topics, subtopics, lessons, questions, quizzes, attempts, answers, and results.
- Existing platform separation docs already define web, native iOS, native Android, tablet, desktop, and CSS target keys.
- Existing design system defines a clinical dark medical study platform with light mode support, motion tokens, and older brand/logo assets that can guide the final `xyndrom` identity.
- Security regression scripts already exist for auth, SQL injection, access control, API negatives, secrets, and OWASP checks.

## Product Direction

xyndrom should feel like a premium medical study app, not a website trapped inside a WebView and not a remote hosted site loaded by Capacitor.

Design principles:

- Native-first touch rhythm: fast press feedback, clear sheets, bottom navigation where useful, safe-area aware layouts, keyboard-aware forms.
- Smooth but controlled animation: route transitions, sheets, quiz feedback, loading states, and list reveals should feel fluid without wasting GPU time.
- Low-device optimization: every visual effect must have a cheaper fallback.
- Modern morphism: use materials, blur, depth, translucency, and edge highlights where they help hierarchy; avoid heavy blur everywhere.
- Human-made feel: real study content, domain-specific UI states, consistent spacing, realistic empty states, no generic oversized AI-looking hero cards.
- Light and dark modes designed together, not inverted after the fact.
- Less database dependency for stable app chrome: app shell, nav, theme, local settings, onboarding copy, and static medical categories can be bundled; dynamic learning data stays API/database-backed.

## HIG-Informed Design Notes

Reference links:

- Apple Human Interface Guidelines - Materials: https://developer.apple.com/design/human-interface-guidelines/materials
- Apple Human Interface Guidelines - Color: https://developer.apple.com/design/human-interface-guidelines/color

How we should apply them:

- Use platform-style materials to express hierarchy, especially for navigation bars, sheets, dialogs, toolbars, and floating controls.
- Treat blur and vibrancy as structural effects, not decoration.
- Use semantic color tokens that adapt across light mode, dark mode, high contrast, and reduced transparency.
- Keep important text and controls legible without relying on glass effects.
- Provide reduced-transparency and reduced-motion fallbacks.
- Keep the app usable when blur, shadows, and background effects are disabled.

## Security References

Reference links:

- OWASP Top 10: https://owasp.org/www-project-top-ten/
- OWASP ASVS: https://owasp.org/www-project-application-security-verification-standard/
- OWASP MASVS: https://mas.owasp.org/MASVS/
- OWASP Mobile Top 10: https://owasp.org/www-project-mobile-top-10/

Security direction:

- Use OWASP Top 10 2025 as the web risk baseline.
- Use OWASP ASVS 5.0.0 for backend/API verification.
- Use OWASP MASVS for the Capacitor mobile app baseline.
- Use OWASP Mobile Top 10 2024 as a mobile risk awareness checklist.
- Keep API authorization server-side; never trust role or subscription status from the client.
- Use parameterized SQL/query APIs only.
- Store native tokens in secure storage, not plain localStorage.
- Add strict validation DTOs, file upload limits, MIME checks, rate limits, audit logs, and error handling.
- Add CSP and dependency scanning for the web build.
- Protect payment proof uploads, push tokens, reset tokens, and subscription admin flows as high-risk areas.

## Proposed Architecture

### App Location

Create the new app outside the patched LMS tree:

```text
/Applications/XAMPP/xamppfiles/htdocs/xyndrom
```

The current LMS stays available as a reference and possible API provider during the rebuild.

### Frontend

Recommended starting point:

- React + Vite.
- Capacitor for iOS and Android using local bundled app assets.
- Reuse current API contract ideas.
- Build a fresh design token system.
- Use route-level code splitting.
- Use Motion/Framer Motion only where it improves native feel.
- Use CSS variables for theme, effect level, platform, safe areas, and reduced-motion.
- Keep browser web and native Capacitor behavior separated by platform adapters, not by loading the hosted web app inside native.

Open choice:

- Option A: pure React + Capacitor for maximum control and lighter UI.
- Option B: Ionic React + Capacitor for more built-in native controls.
- Option C: hybrid: pure React screens plus selected native-feeling components.

### Backend

Recommended starting point:

- Keep the current NestJS backend and MySQL database as the first backend target.
- Clean up API contracts as we build the new frontend.
- Add indexes, pagination, query limits, and response shaping where screens need speed.
- Add cache headers and local cache strategy for content that changes slowly.

### Hosting And Database Stability Context

Current testing server/hosting resources are considered enough for single-user testing:

- Shared/cPanel hosting.
- CloudLinux.
- 8 GB physical memory.
- IOPS 4096.
- Entry processes 100.
- Number of processes 200.
- CPU 400%.
- Server latency 0.04 seconds.

Stability implication:

- If the database or app crashes during single-user testing, treat it as an urgent app/database stability audit item before blaming hosting capacity.
- Audit connection pooling, repeated API calls, missing indexes, unbounded queries, N+1 queries, long transactions, file upload handling, memory spikes, background jobs, logs, and retry loops.
- Add lightweight health checks and timing logs around slow database routes before migrating screens into the new app.

### Native Wrapper

Expected native capabilities:

- Local bundled Capacitor runtime, not a hosted/guest web page.
- Capacitor StatusBar, SplashScreen, Keyboard, Haptics, App, Push Notifications, Local Notifications.
- Native safe-area support.
- Native back behavior on Android.
- Native keyboard avoidance strategy.
- App resume/reconnect handling.
- Optional secure storage plugin for tokens.
- Optional biometric unlock later.

Full-control native-like rule:

- Native iOS/Android builds must load the app from the bundled Capacitor web directory.
- Production native builds must not use `server.url` to open the live website.
- The native app shell owns navigation, route transitions, safe areas, keyboard behavior, haptics, permissions, push/local notifications, storage, and app lifecycle.
- The backend/API is used only for data, auth, sync, payments, notifications, and admin operations.
- Native-only behavior must live behind platform adapters so iOS, Android, and browser web can each behave correctly without fragile random checks.

## Motion And Performance Rules

Targets:

- 60 fps where possible on mid-range phones.
- No animation should block input.
- Page transitions: 180ms to 280ms.
- Button press feedback: 100ms to 160ms.
- Sheets/drawers: 220ms to 320ms.
- Skeleton loading if an operation feels longer than 300ms.

Implementation rules:

- Animate transform and opacity only.
- Avoid animating width, height, top, left, filters, and large box-shadows.
- Limit backdrop blur to nav/sheets/dialogs, with solid fallback for low-end mode.
- Use `prefers-reduced-motion`.
- Add an in-app `Performance mode` setting: Auto, Rich, Balanced, Low.
- Use virtualization for long question, result, user, and notification lists.
- Keep large images responsive and lazy loaded.
- Avoid endless decorative loops in frequently used study screens.

## Visual Theme Decisions To Make

We should choose one primary direction before creating mockups.

Theme candidates:

1. Clinical Graphite: deep neutral surfaces, electric clinical blue, teal success, restrained glass.
2. Surgical Light: white/pearl canvas, blue-gray type, soft cyan accent, minimal blur.
3. Midnight Study: dark navy-black, blue accent, violet only for tags, amber only for warnings.
4. Liquid Medical: modern transparent materials, stronger light/dark glass, careful low-power fallback.
5. Academic Emerald: dark graphite, emerald/teal progress, blue only for links and focus.
6. xyndrom Mono: black/white primary brand with one medical accent chosen by you.

## First Mockups To Create After Answers

Recommended first visual set:

- Launch/login screen.
- Student dashboard.
- Course detail / lesson reader.
- Quiz taking screen.
- Quiz result and review screen.
- Study notes or flashcards screen.
- Subscription/payment proof flow.
- Admin dashboard or admin content manager, if admin belongs in the same app.

Mockups should use real LMS content concepts, real route names, realistic medical study data, real loading/empty/error states, and both mobile and desktop layouts.

## Pages And Features To Create

This section is the working page inventory for the new xyndrom build. The goal is not to copy the current patched screens line-by-line, but to recreate the product with cleaner UX, stronger native feel, better data loading, and fewer fragile dependencies.

Page rules:

- Every page must have mobile, tablet, and desktop behavior defined.
- Every page must support light mode, dark mode, loading, empty, error, and offline/reconnect states where relevant.
- Every page with forms must show inline validation, disabled/loading submit states, and clear success/failure feedback.
- Every page with long lists must use pagination, infinite loading, or virtualization.
- Every frequently used action must have fast press feedback and must not wait for decorative animation.
- Native screens must be local bundled Capacitor screens and must respect safe areas, keyboard overlap, Android back behavior, haptics, and reduced-motion settings.
- Browser web screens must remain responsive web pages only; do not create an installable web-app target.
- Do not use the native app as a guest container for the public website.

### Public Web And Auth

| Page | Features To Create |
| --- | --- |
| Landing page | xyndrom brand hero, real medical study value proposition, subject/course preview, quiz preview, notes/flashcards preview, subscription/pricing section, testimonials/results proof, FAQ, final CTA, login/register links, responsive desktop/mobile layout, low-animation mode. |
| Login | Email/password login, password visibility toggle, remember/session behavior, server error handling, role-aware redirect, forgot password link, native keyboard-safe layout. |
| Register | Student registration form, validation, password rules, optional phone field, plan/approval messaging, success state, login link. |
| Forgot password | Email input, rate-limit friendly success message, loading/error states, return-to-login action. |
| Reset password | Token validation, new password fields, password confirmation, expired-token state, success redirect. |
| Terms page | Clean legal layout, readable headings, last-updated date, mobile-friendly long-form text. |
| Privacy policy | Data collection, account, payment, notification, and learning analytics sections; readable legal layout. |
| Refund/cancellation policy | Payment/refund terms, subscription rules, proof upload notes, support contact path. |
| Cookie/basic web policy | Only if needed for public website analytics or marketing tools; keep minimal. |

### Student App Core

| Page | Features To Create |
| --- | --- |
| App launch / boot | Branded splash handoff, auth restore, API health check, theme restore, performance mode restore, graceful server-down screen. |
| Student dashboard | Progress summary, continue studying card, current courses, quiz streak/accuracy, due reminders, latest notifications, subscription status, quick actions, skeleton loading, cached last-known dashboard. |
| Pending approval | Clear account status, what happens next, support/contact action, refresh status button, logout option. |
| Profile and account | Avatar/profile details, email/phone, password change, theme preference, performance mode, notification preferences, logout, session/security status. |
| Global search | Search courses, lessons, questions, notes, bookmarks, and AI notes; debounce input; show grouped results; support keyboard and mobile search sheet. |

### Student Learning

| Page | Features To Create |
| --- | --- |
| Courses list | Course cards, subject/category filters, progress indicators, search, enrolled/locked states, responsive grid/list, cached category metadata. |
| Course detail | Course overview, topics/subtopics tree, lesson progress, quiz links, locked content state, continue button, lesson count, completion summary. |
| Lesson/study reader | Medical content renderer, headings, images/video embeds, progress marking, bookmark toggle, AI note link, quick recap, readable type scale, safe scroll position restore. |
| AI notes list | Generated notes grouped by course/lesson, search/filter, status chips, empty state, refresh, cached recently opened notes. |
| AI note reader/canvas | Structured note content, images/diagrams if available, lesson link, bookmarks, copy/share where allowed, content loading fallback, math/medical formatting support. |
| Student notes | Personal notes list, create/edit/delete note, local draft save, lesson/course association, search, sync status, conflict-safe save behavior. |
| Flashcards | Deck list, study mode, flip interaction, correct/wrong/self-rating actions, progress, spaced-review-ready data shape, reduced-motion flip fallback. |
| Bookmarks | Saved lessons/questions/notes, filters by type/course, remove bookmark, deep link back to original content. |
| Study planner | Calendar/list view, create study tasks, reminders, completion toggles, overdue/upcoming states, local notification integration if enabled. |

### Student Quiz And Results

| Page | Features To Create |
| --- | --- |
| Quiz list / practice | Practice and exam tabs, filters by course/topic, question count, difficulty/status tags, last attempt summary, locked states. |
| Exam list | Timed/exam-mode quiz list, rules summary, start confirmation, resume available attempt if supported. |
| Take quiz | Question viewer, answer options, timer where needed, progress bar, save answer, next/previous, flag/review, haptic feedback, local draft answer save, submit confirmation, network retry handling. |
| Practice review | Correct/wrong explanation, chosen answer, correct answer, topic links, bookmark question, retry action, compact mobile review navigation. |
| Results list | Attempts history, score, accuracy, date, quiz type, filters, pagination, empty state. |
| Result detail | Score breakdown, time spent, correct/wrong/skipped counts, topic performance, next action suggestions, review CTA. |
| Review workspace | Full answer review, filters for wrong/skipped/bookmarked, explanation rendering, lesson links, question report action if needed. |

### Student Billing And Notifications

| Page | Features To Create |
| --- | --- |
| Subscription/billing | Current plan, expiry/access status, available plans, payment instructions, pending request state, billing history summary. |
| Checkout/payment proof | Plan summary, payment method instructions, proof upload, file validation, preview/remove file, submit loading state, audit-friendly request metadata. |
| Notifications | Announcement/system/study notification list, unread state, mark read, grouped dates, deep links, push/local notification settings entry. |
| Notification settings | Push opt-in, local reminders opt-in, quiet hours if needed, test notification action for admin/test builds. |

### Admin Console

| Page | Features To Create |
| --- | --- |
| Admin dashboard | Key counts, revenue/subscription summary, pending approvals/payments, recent activity, content health, system health widgets, slow route warnings. |
| Course management | Create/edit/delete courses, image/icon, order, visibility, lock/access rules, course stats, safe delete warnings. |
| Structure manager | Topics, subtopics, lessons hierarchy, drag/reorder if safe, publish/unpublish, validation for empty or broken branches. |
| Users | Search/filter students/admins, status, role, subscription/access state, bulk-safe actions, pagination. |
| Student detail | Profile, enrollment/access, attempts/results, payment history, notes/admin remarks, manual status changes with audit log. |
| Question bank | Search/filter questions, create/edit/delete, course/topic mapping, image/media support, answer/explanation editor, import/export, duplicate checks. |
| Bulk question input | Paste/import workflow, parsing preview, validation errors by row, duplicate warnings, batch save with rollback/error report. |
| Question review/reports | Student-reported questions, issue type, admin resolution, edit question action, audit trail. |
| Quiz management | Quiz list, filters, publish state, practice/exam type, question counts, duplicate/archive actions. |
| Quiz builder | Create/edit quiz, select questions, ordering/randomization settings, timing, pass rules, publish validation, preview mode. |
| Subscription admin | Plans, requests, manual payments, proof review, approve/reject, audit log, access expiry controls. |
| Finance/admin payments | Revenue summaries, pending/approved/rejected payments, filters/export if needed, reconciliation notes. |
| AI notes admin list | Generated note inventory, status, course/lesson mapping, search, regenerate/edit entry points. |
| AI note editor | Edit structured note content, media/diagram handling, preview, publish/unpublish, version-safe save. |
| Announcements | Create/edit announcements, audience targeting, scheduling, push/local delivery options, read stats. |
| Reports | Student progress, quiz performance, weak topics, course completion, subscriptions, export-ready tables. |
| Setup | First-run checks, required settings checklist, admin account state, database/API health, missing config warnings. |
| Settings | General, theme, landing content, payment, SMTP/email, availability, notification, APNs, FCM, AI provider, popup alert, API recovery settings. |

### Native Capacitor Shell

| Area | Features To Create |
| --- | --- |
| Local bundled runtime | Build native from bundled Capacitor assets, keep API calls remote, never load the live website as the native app shell. |
| Native app shell | Status bar styling, safe-area CSS variables, bottom navigation or adaptive nav, route transition layer, app resume/pause handling. |
| Secure auth storage | Store tokens/session data with secure native storage where available; avoid plain localStorage for native tokens. |
| Keyboard handling | Forms and quiz inputs remain reachable when keyboard opens; no hidden submit buttons. |
| Haptics | Subtle haptic feedback for answer selection, correct/wrong feedback, saves, payment submission, and destructive confirmations if enabled. |
| Push notifications | Native token registration, notification permission state, settings sync, deep links from notifications. |
| Local reminders | Study planner reminders, permission state, scheduled/cancelled reminder handling. |
| Android back behavior | Back navigates through history; dashboard/root asks before exit if needed; modals/sheets close first. |
| Offline/reconnect | Clear offline banner, cached last-known content where allowed, retry actions, no infinite retry loops. |
| Performance mode | Auto/Rich/Balanced/Low setting controlling blur, shadows, list animations, and heavy visual effects. |

### Shared Components And System States

| Component/System | Features To Create |
| --- | --- |
| Design tokens | Color, typography, spacing, radius, elevation, material, motion, z-index, safe-area, performance-level tokens. |
| App layout | Responsive top bar/sidebar/bottom nav patterns, page shell, section headers, breadcrumbs where useful. |
| Cards and lists | Stable dimensions, skeleton states, empty states, error states, touch-friendly row actions. |
| Forms | Labels, helper text, validation, password field, file upload, select/tabs/segmented controls, loading buttons. |
| Tables/admin grids | Search, filters, pagination, density control if needed, mobile stacked layout, export action where needed. |
| Modals/sheets | Native-feeling sheets, destructive confirmations, focus trap, escape/back handling, reduced-motion fallback. |
| Toasts/feedback | Success/error/warning feedback, auto-dismiss rules, accessible announcements. |
| Media renderer | Safe medical content rendering for images, videos, embeds, generated diagrams, and long text. |
| Security states | Unauthorized, forbidden, expired session, payment locked, admin-only, maintenance, and server unavailable screens. |
| Diagnostics | Health check display for admin/setup, slow API timing logs, database readiness checks, crash/stability audit notes. |

## Questions For You

Please answer as many as you can. Short answers are fine.

### Brand And Naming

1. Final app name is `xyndrom`. Should the brand display stay lowercase everywhere, including splash, headers, and app-store metadata?
2. Should the app keep the existing logo files, or do you want a redesigned logo?
3. Should the logo feel medical, academic, futuristic, or minimal?
4. Should the logo wordmark be text-only, icon-only, or icon plus `xyndrom`?
5. Do you want a slogan/tagline inside the app, or no tagline?

### Color And Visual Style

6. Which theme candidate above do you prefer?
7. Should dark mode be the default, or should the app follow system settings?
8. Should light mode be bright white/clinical or soft gray/pearl?
9. What single primary accent color do you want: blue, cyan, teal, green, violet, or another?
10. Do you want glass/liquid effects to be subtle, medium, or strong?
11. Should low-end devices automatically reduce blur and animation?
12. Should the app feel more Apple-like, Material-like, or a balanced custom style?
13. Should medical illustrations/photos be used, or should the app stay mostly UI-only?

### Users And Product Scope

14. Is the first release mainly for students, admins, or both?
15. Which student screen is most important: dashboard, courses, quiz, notes, results, or payment?
16. Which admin screen is most important: courses, questions, quizzes, users, subscriptions, reports, or settings?
17. Should admin be inside the same native app, or should native be student-only?
18. Do students need offline access to lessons, quizzes, flashcards, or notes?
19. Should the app work without login for any public/demo content?
20. Should the current public landing page be rebuilt too, or only the logged-in app?

### Data And Database

21. Should we use the exact current MySQL database first?
22. Are we allowed to add indexes and new helper tables?
23. Are we allowed to rename API fields if we create a compatibility layer?
24. Which data should be bundled/hardcoded locally: categories, onboarding, subject icons, theme, or sample questions?
25. Which data must always come live from the database?
26. Do you want local draft saving for notes, quiz answers, and payment forms?
27. How fresh must data be: instant live sync, sync on screen open, or manual refresh?

### Native Capacitor Behavior

28. Which platforms are required first: responsive web, iOS, Android, or desktop web?
29. Should we support tablets in the first release?
30. Should native use bottom tabs, side navigation, or adaptive navigation?
31. Should Android back button exit the app from the dashboard or return to previous screen only?
32. Do you want haptic feedback on quiz answer selection, correct/wrong feedback, saves, and payments?
33. Do you need push notifications in the first release?
34. Do you want local study reminders when offline?
35. Should we add biometric unlock later?

### Animation And Smoothness

36. Which screens need the most polished transitions?
37. Do you prefer fast/snappy animation or soft/springy animation?
38. Should quiz feedback be calm/professional or more celebratory?
39. Should page transitions slide, fade, scale, or use shared elements?
40. Should there be a global performance toggle visible to users?

### Security And Accounts

41. What login methods are required: email/password, phone, Google, Apple, or admin-created accounts?
42. Do you need two-factor authentication for admins?
43. Should subscriptions/payments require extra confirmation or audit logs?
44. Should the app block rooted/jailbroken devices, warn only, or ignore for now?
45. Should screenshots be blocked on sensitive screens?
46. What user data is most sensitive in this LMS?

### Delivery And Review

47. Do you want the first deliverable to be static mockups, clickable prototype, or real scaffolded app?
48. Should I create the new app folder immediately after this discussion, or wait until theme decisions are locked?
49. Do you want me to migrate screen-by-screen or create the full shell first?
50. Which 3 screens should define the visual standard for the whole app?
51. Should the new app keep the current API path prefix `/api`, or use a new versioned prefix like `/api/v2`?
52. What is the must-have deadline or first milestone?

## Suggested Build Order After You Answer

1. Lock logo direction, color theme, and first platform target for the final `xyndrom` brand.
2. Create `/Applications/XAMPP/xamppfiles/htdocs/xyndrom`.
3. Scaffold the new responsive web app and Capacitor wrapper.
4. Build design tokens: color, type, spacing, motion, radius, elevation, materials, low-power mode.
5. Create the first 6 to 8 mockup screens with real content.
6. Wire auth and dashboard to the existing API.
7. Add lessons, quizzes, results, notes, subscriptions, and notifications one module at a time.
8. Add native polish: status bar, splash, keyboard, safe areas, haptics, back behavior, offline/reconnect.
9. Add security hardening and OWASP regression checks.
10. Run web/mobile visual QA and performance checks before each milestone.

## Initial Recommendation

Start with `Clinical Graphite` or `Liquid Medical`, but keep a strict low-power fallback. Build the app shell, dashboard, lesson reader, and quiz flow first because those screens define the daily feeling of the product. Use the existing database and NestJS API first, then optimize endpoints once the new UI exposes the real bottlenecks.

## Minimum Decisions Before Implementation

Implementation should wait until these choices are answered:

1. Logo direction for the final `xyndrom` brand.
2. First release platform order: responsive web, iOS, Android, desktop web.
3. Theme candidate, primary accent color, and dark/light default.
4. Whether admin belongs in the native app or stays web-only.
5. Offline scope for lessons, quizzes, flashcards, and notes.
6. Whether database indexes/helper tables are allowed.
7. First 3 screens to mock up and polish.
8. Motion style: fast/snappy, soft/springy, or mixed.
9. Native notification and haptic requirements.
10. Security extras such as 2FA, screenshot blocking, jailbreak/root warning, and audit logs.
