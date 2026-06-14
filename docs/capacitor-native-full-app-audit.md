# Capacitor Native App UI Audit

Date: 2026-06-13
App: Xyndrome LMS
Scope: Full app native-feel review for the Capacitor iOS app, with extra focus on scrolling smoothness, keyboard behavior, headers, bottom navigation, auth screens, and student app pages.

## Short Summary

The app already has a serious native foundation: Capacitor is configured for an edge-to-edge iOS shell, the main app uses a dedicated scroll root, keyboard behavior is guarded on iOS, and many native-only CSS overrides exist.

The main reason the app can still feel less native is not one single color or one single page. It is the combination of nested scroll areas, fixed headers, blurred fixed bars, custom smooth scrolling, and keyboard guard complexity. These things can make the screen feel jumpy, heavy, or web-like even when the UI looks polished.

The highest-value work is:

1. Make one clear scrolling contract for the whole app.
2. Make header behavior consistent on native phone.
3. Lock down keyboard behavior with a repeatable QA checklist.
4. Reduce heavy blur and animation on fixed native UI.
5. Audit every important page in the simulator with a real test login.

## How This Audit Was Done

- Reviewed the Capacitor configuration.
- Reviewed iOS native bridge behavior in `AppBridgeViewController.swift`.
- Reviewed native CSS files for viewport, safe area, scrolling, keyboard, top bar, and bottom nav behavior.
- Reviewed app shell, route scroll restoration, header, sidebar, bottom nav, auth, billing, quiz, notes, AI notes, review, and student layout code.
- Ran a simulator/browser probe on the signed-out native login route.
- Ran the real Capacitor iOS build, sync, install, and launch path on the booted iPhone simulator.
- Added and ran a real XCUITest simulator harness against the Capacitor app so the audit could tap fields, open the iOS keyboard, and capture native screenshots.

## Real Capacitor Run

Device: iPhone 17 simulator, iOS 26.4.1
Bundle id: `com.erpm.medical.lms`
Installed app name: `xyndrome`
Clean screenshot set: `/Applications/XAMPP/xamppfiles/htdocs/lms/tmp/native-audit-screenshots-4-auth/`

Native commands/results:

- `npm run cap:sync:ios` passed.
- `xcodebuild` build/install/launch path passed.
- Auth keyboard proof command passed with 1 test, 0 failures:
  `xcodebuild test -project frontend/ios/App/App.xcodeproj -scheme NativeAuditUITests -configuration Debug -destination 'id=1288DBFD-2FCD-47B0-B88F-68B63EF3602A' -resultBundlePath tmp/native-audit-ui-test-3.xcresult CODE_SIGNING_ALLOWED=NO`
- Full auth + create-user submit command passed the auth keyboard test, then failed the create-user submit test at the Confirm password focus step:
  `xcodebuild test -project frontend/ios/App/App.xcodeproj -scheme NativeAuditUITests -configuration Debug -destination 'id=1288DBFD-2FCD-47B0-B88F-68B63EF3602A' -resultBundlePath tmp/native-audit-ui-test-4.xcresult CODE_SIGNING_ALLOWED=NO`

Real simulator evidence:

| Check | Result | Evidence | Simple meaning |
| --- | --- | --- | --- |
| Login closed layout | Pass with polish note | `01-login-closed.png` | No Capacitor top header; logo is above "Welcome back"; content is readable. Top area still feels visually heavy. |
| Login email keyboard | Partial pass | `02-login-email-keyboard.png` | Keyboard appears and the screen does not jump, but the Sign in area is covered by the keyboard. |
| Login password keyboard | Partial pass | `03-login-password-keyboard.png` | Keyboard appears and the focused password field stays visible. Submit/link reachability still needs scroll testing. |
| Create-user closed layout | Pass | `04-register-closed.png` | The full create-user form is visible when the keyboard is closed. |
| Create-user full-name keyboard | Partial pass | `05-register-name-keyboard.png` | Keyboard appears without a whole-screen jump, but lower fields and submit are behind the keyboard. |
| Create-user submit attempt | Fail | `tmp/native-audit-ui-test-4.xcresult` and `tmp/native-audit-screenshots-4-register-submit/E4A458DE-2F37-46F4-88FC-5A6F9DF39D1D.txt` | After typing Password, tapping Confirm password did not move keyboard focus; the Password field still had keyboard focus. |

What passed:

- `npm run cap:sync:ios` completed successfully.
- The real Xcode simulator build completed successfully with `xcodebuild`.
- The freshly built app installed into a new simulator bundle container.
- The app launched successfully as process `46016`.
- The app opened to the signed-out login screen without a blank screen.
- No extra Capacitor top header was visible.
- The Xyndrome logo appears above "Welcome back."
- The iOS status bar and Dynamic Island area did not overlap the auth content.
- Native logs showed `KeyboardPlugin: no resize`, which matches the intended Capacitor keyboard config.
- Real XCUITest taps can now open login and create-user fields and capture keyboard screenshots.

What needs follow-up:

- `npx cap run ios --target ... --no-sync` failed with a Capacitor/native-run JSON parse error, so the reliable path today is `xcodebuild` plus `simctl install` plus `simctl launch`.
- Vite reported empty CSS import warnings for `native-ios.css` and `native-ios-tablet.css`.
- Login and create-user keyboard opening is proven, but keyboard-state scrolling is not good enough yet because lower controls can sit behind the keyboard.
- Create-user cannot be considered native-ready until the Confirm password field reliably accepts focus after Password.
- The login screen visually works, but the closed-keyboard layout still has a large dark top area. Do a final auth vertical-balance pass after the keyboard fixes.

## Important Limitation

The simulator did not reach a valid logged-in native session during this audit. The create-user submit flow was attempted in the real simulator, but it failed before submit because Confirm password did not receive keyboard focus after the Password field.

Before final approval, a test user or dev-only QA login must be added so every protected screen can be opened and tested in the simulator without guessing.

## What Is Already Good

- The native app uses an app-level scroll root instead of relying only on browser window scrolling.
- iOS keyboard handling is being handled intentionally instead of using default WKWebView behavior.
- Auth pages now have a native-specific keyboard layout approach.
- Native phone CSS already disables some expensive dashboard effects.
- Route scroll restoration already avoids smooth scrolling on native phone in the shared route helper.
- The bottom nav is already built as a native-style primary navigation surface.
- Safe-area variables exist for the status bar and home indicator.

## Main Native-Feel Problems

| Area | What users may feel | Why it matters |
| --- | --- | --- |
| Scrolling | Some pages may feel sticky, trapped, or inconsistent | Native apps usually have one predictable main scroll area |
| Headers | Header behavior may differ between pages | Users notice when top bars jump or change rules |
| Keyboard | Keyboard opening can expose layout edge cases | Forms must stay stable and keep buttons reachable |
| Bottom nav | Blur and animated effects can make scroll less smooth | Fixed translucent bars are expensive in WKWebView |
| Page effects | Heavy shadows, blur, and animation can reduce smoothness | Native feel depends more on response than decoration |
| Touch targets | Some small icon actions may be hard to tap | Phone controls should have comfortable hit areas |
| Protected QA | Full simulator audit is not repeatable yet | We need a real path to test every screen |
| Native run tooling | Real app launched, but `cap run ios` failed | QA should not depend on fragile manual fallback commands |
| Auth vertical balance | Login works, but top empty space still feels heavy | The first screen sets the user's trust in the app |
| Create-user focus | Confirm password may not focus after Password on native keyboard | Users can get stuck before account creation |

## Ticket List

### NAT-001: Define One Main Scroll Root

Priority: P0
Area: Scrolling

Simple explanation:
Right now the app has the correct idea with `.lms-app-scroll-root`, but some pages and components also create their own scroll areas. Too many scroll boxes can make the app feel like a web page instead of a native app.

Task:

- Decide that `.lms-app-scroll-root` is the main vertical scroll area on native phone.
- Allow inner scrolling only for real exceptions: modals, drawers, tables, horizontal carousels, and canvas/editor tools.
- Review pages that use `overflow-y-auto`, sticky sections, or fixed mobile bars.
- Remove unnecessary page-level nested vertical scrolling.

How to test:

- On iPhone simulator, swipe slowly from the middle of each screen.
- The page should move naturally with no trapped scroll zones.
- The bottom nav and header should not shake or lag.

Before / After / Why:

| Before | After | Why |
| --- | --- | --- |
| Multiple parts of a page can scroll vertically | One main page scroll, with limited intentional inner scrolls | Swiping becomes predictable and native-feeling |

### NAT-002: Test iOS Scroll Deceleration

Priority: P1
Area: Scrolling smoothness

Simple explanation:
The native iOS bridge sets the web view scroll deceleration to `.fast`. That can make scrolling stop quicker than normal iOS screens.

Task:

- A/B test `.fast` versus `.normal` in the iOS simulator and on a real iPhone.
- Keep the value that feels closest to native iOS list scrolling.
- Test long pages like dashboard, lessons, billing, quiz review, and notes.

How to test:

- Flick a long page with medium speed.
- Compare whether the scroll slows down like a normal iPhone app.

Before / After / Why:

| Before | After | Why |
| --- | --- | --- |
| Scroll may stop too quickly | Scroll slows down at a natural iOS pace | Users judge native quality by scroll physics |

### NAT-003: Reduce Heavy Bottom Nav Blur On Native

Priority: P1
Area: Bottom navigation

Simple explanation:
The light bottom nav uses blur and saturation. It looks nice, but fixed blur can make WKWebView scrolling feel heavier.

Task:

- Test an opaque or very low-blur bottom nav style on native phone.
- Keep the current layout and active state, but reduce expensive visual effects.
- Keep dark mode close to the current opaque behavior.

How to test:

- Scroll a long page with the bottom nav visible.
- Watch for lag, text shimmer, or delayed nav repaint.

Before / After / Why:

| Before | After | Why |
| --- | --- | --- |
| Fixed nav uses strong blur and saturation | Native nav uses a lighter, more stable surface | Less GPU work usually means smoother scrolling |

### NAT-004: Create A Header Behavior Rule For Native Phone

Priority: P1
Area: Headers

Simple explanation:
Headers should follow the same rule everywhere. If one page has a sticky header, another has a fixed native layer, and another has a custom bar, users feel that the app is not fully native.

Task:

- Decide the native phone header rule:
  - Option A: compact fixed top bar across app pages.
  - Option B: iOS-style large title that collapses while scrolling.
- Apply that rule consistently to student pages.
- Keep auth pages separate because they should feel focused and centered.

How to test:

- Open dashboard, course detail, quiz, review, billing, notes, and profile.
- Scroll each page from top to middle.
- Header movement should feel intentional and consistent.

Before / After / Why:

| Before | After | Why |
| --- | --- | --- |
| Different pages can have different header behavior | Native phone has one clear header pattern | Consistency makes the app feel built for mobile |

### NAT-005: Build A Keyboard Regression Checklist

Priority: P0
Area: Forms and keyboard

Simple explanation:
Keyboard handling is complex because Capacitor resize is disabled and the iOS bridge manually guards scroll position. This is powerful, but it needs repeatable testing.

Current simulator result:

- Login email, login password, and create-user full-name keyboard opening passed in XCUITest.
- Login lower controls and create-user lower controls can sit behind the keyboard, so reachability is still not solved.
- Create-user Confirm password focus failed during the registration-submit attempt.

Task:

- Create a keyboard QA checklist for:
  - Login
  - Create user
  - Forgot password
  - Reset password
  - Checkout/payment forms
  - Profile forms
  - Note title/body fields
  - Search fields
  - Modals with inputs
- Confirm that keyboard opening does not push the whole screen upward.
- Confirm that the area below the input can scroll when space is tight.
- Confirm that the submit button can still be reached.

How to test:

- Tap every important input on iPhone simulator.
- Rotate if supported.
- Test small phone height as well as normal iPhone height.

Before / After / Why:

| Before | After | Why |
| --- | --- | --- |
| Keyboard behavior is handled but not fully regression-tested | Every important input has a repeatable pass/fail test | Forms feel reliable and users do not lose context |

### NAT-006: Remove Custom Smooth Scroll From Native Phone Actions

Priority: P1
Area: Scrolling behavior

Simple explanation:
The shared route scroll helper already avoids smooth scrolling on native phone, but some pages still call `scrollIntoView({ behavior: 'smooth' })`. On native, long smooth-scroll animations can feel slow or fight the user's finger.

Task:

- Add or reuse a helper that chooses `auto` on native phone and `smooth` on web.
- Replace direct smooth `scrollIntoView` calls in pages like billing, notes, quiz, and review flows.

How to test:

- Tap actions that jump to a section or question.
- Native phone should move immediately or very quickly without a long animated glide.

Before / After / Why:

| Before | After | Why |
| --- | --- | --- |
| Some page actions force smooth scrolling | Native phone uses instant or platform-aware scrolling | Native apps prioritize direct response |

### NAT-007: Audit Touch Target Sizes

Priority: P1
Area: Tap comfort

Simple explanation:
Some icon actions, especially in dense tools like AI Notes, appear visually small. On phones, the tap area should be comfortable even if the icon itself stays small.

Task:

- Audit all icon-only buttons on phone.
- Make touch areas at least 44px by 44px where possible.
- Keep the visual icon size if needed, but increase the invisible hit area.
- Pay special attention to AI Notes toolbar, delete buttons, stickers, quiz controls, and header actions.

How to test:

- Tap controls quickly with one thumb.
- The user should not need precision tapping.

Before / After / Why:

| Before | After | Why |
| --- | --- | --- |
| Some actions may have small tap areas | Controls have comfortable mobile hit areas | Fewer missed taps means higher user satisfaction |

### NAT-008: Add A Real Simulator QA Login

Priority: P1
Area: QA workflow

Simple explanation:
The protected app cannot be fully audited in the simulator without a valid user session. A repeatable QA login makes testing real instead of theoretical.

Task:

- Add a safe test user flow for local/native development.
- Document credentials or seed command in the developer docs.
- Make sure it is not exposed in production.

How to test:

- Fresh install the native app.
- Log in with the test user.
- Open every main route without manual localStorage editing.

Before / After / Why:

| Before | After | Why |
| --- | --- | --- |
| Protected screens cannot be reliably opened during audit | QA can enter the full app every time | Full simulator testing becomes repeatable |

### NAT-009: Set A Native Effects Budget

Priority: P2
Area: Visual performance

Simple explanation:
Blur, large shadows, fixed background effects, and animations can look premium, but too many of them make a mobile web view feel heavy.

Task:

- List all native phone blur, backdrop-filter, large shadow, and fixed ambient effects.
- Disable or simplify non-essential effects on native app routes.
- Keep animation for meaningful feedback only.

How to test:

- Scroll long pages and open overlays.
- Watch for stutter, delayed repaint, or text shimmer.

Before / After / Why:

| Before | After | Why |
| --- | --- | --- |
| Some visual effects may cost scroll performance | Native routes use a smaller effect budget | Smoothness matters more than decoration in a native app |

### NAT-010: Create A Page-By-Page Native QA Pass

Priority: P0
Area: Full app QA

Simple explanation:
Every important screen needs a quick simulator pass. Otherwise one screen may feel native while another feels web-like.

Task:

- Test these areas:
  - Auth: login, create user, forgot password, reset password
  - Dashboard
  - Courses and course detail
  - Lessons and video pages
  - AI Notes
  - Normal notes
  - Q-bank
  - Quiz taking
  - Quiz review and results
  - Billing and checkout
  - Notifications
  - Profile and settings
  - Admin pages, if admin is supported on native phone
- Record pass/fail notes for scroll, header, keyboard, tap targets, safe area, loading, and modals.

How to test:

- Use the same iPhone simulator size for the first pass.
- Then repeat risky screens on a smaller height.

Before / After / Why:

| Before | After | Why |
| --- | --- | --- |
| Native quality is checked page by page informally | Every page has a repeatable checklist | Problems become visible before users feel them |

### NAT-011: Make Phone Modals Feel Like Native Sheets

Priority: P2
Area: Modals and overlays

Simple explanation:
Some popups still behave like desktop centered modals. On phones, important popups often feel better as bottom sheets or full-screen sheets.

Task:

- Audit all mobile modals.
- Convert high-use phone modals to bottom sheets or full-screen sheets.
- Make sure sheets respect safe areas and lock background scroll.

How to test:

- Open modals from dashboard, notes, billing, quiz, and profile.
- Confirm the modal is easy to dismiss and does not create double scrolling.

Before / After / Why:

| Before | After | Why |
| --- | --- | --- |
| Some overlays feel desktop-like | Phone overlays behave like sheets | Users recognize the interaction pattern immediately |

### NAT-012: Make Loading And Route Feedback Consistent

Priority: P2
Area: Navigation feedback

Simple explanation:
Native apps feel responsive when route changes and loading states are consistent. Different loading behavior across auth, student, and admin can feel uneven.

Task:

- Audit route fallback/loading states across auth, student, and admin.
- Keep feedback fast and calm.
- Avoid large layout jumps after loading.

How to test:

- Navigate quickly between routes.
- The screen should not flash, jump, or show mismatched loading UI.

Before / After / Why:

| Before | After | Why |
| --- | --- | --- |
| Loading feedback may vary by area | Route feedback feels consistent | The app feels more reliable |

### NAT-013: Accessibility And Dynamic Text Audit

Priority: P2
Area: Accessibility

Simple explanation:
Native quality also means the app still works with VoiceOver, larger text, and clear focus states.

Task:

- Check icon-only buttons for accessible names.
- Check color contrast.
- Check important pages with larger text settings.
- Check form errors and required fields.
- Check that focus does not disappear behind the keyboard.

How to test:

- Use browser accessibility checks where possible.
- Use iOS simulator accessibility settings for larger text and VoiceOver spot checks.

Before / After / Why:

| Before | After | Why |
| --- | --- | --- |
| Accessibility needs a native-focused pass | Controls and forms remain usable under accessibility settings | More users can use the app comfortably |

### NAT-014: Decide If Admin Is Supported On Native Phone

Priority: P2
Area: Admin experience

Simple explanation:
Admin screens are usually dense. If admin is meant to work in the native phone app, it needs its own mobile rules. If not, the app should make that clear.

Task:

- Decide whether admin is officially supported on native phone.
- If yes, audit tables, sidebars, forms, filters, and bulk actions.
- If no, show a clear unsupported or desktop-recommended state.

How to test:

- Open admin routes on iPhone simulator.
- Confirm whether the experience is usable without pinching or horizontal fighting.

Before / After / Why:

| Before | After | Why |
| --- | --- | --- |
| Admin phone support is not clearly defined | Admin has a clear mobile support decision | Users do not get a half-supported experience |

### NAT-015: Add Native Audit Instrumentation

Priority: P1
Area: QA tooling

Simple explanation:
The app needs a small reusable way to measure scroll root, header position, keyboard state, and frame smoothness during simulator testing.

Task:

- Create a dev-only native audit probe or overlay.
- Show current route, scroll root size, scroll position, viewport height, keyboard state, header mode, and bottom nav state.
- Keep it disabled in production.

How to test:

- Enable the probe in local native builds.
- Visit every major screen and record measurements.

Before / After / Why:

| Before | After | Why |
| --- | --- | --- |
| Native feel is judged mostly by looking | Native feel can be measured during QA | Measurements reduce guesswork |

### NAT-016: Verify Safe Area On Every Fixed Element

Priority: P1
Area: Safe area and viewport

Simple explanation:
Fixed headers, bottom nav, sheets, and toolbars must avoid the notch, Dynamic Island, and home indicator.

Task:

- Check all fixed elements against `--native-safe-top` and `--native-safe-bottom`.
- Test on simulator sizes with and without Dynamic Island.
- Confirm modals and drawers also respect safe areas.

How to test:

- Use iPhone SE-size and Dynamic Island-size simulators.
- Nothing should touch the top sensor area or bottom home indicator.

Before / After / Why:

| Before | After | Why |
| --- | --- | --- |
| Safe-area variables exist but need full route verification | Every fixed element respects device safe areas | The app feels intentionally built for iPhone |

### NAT-017: Make Haptic Feedback Consistent

Priority: P2
Area: Interaction feel

Simple explanation:
The app has haptic logic, but bottom nav appears excluded. That might be intentional, but it should be a product decision.

Task:

- Decide where haptics should happen:
  - Primary buttons
  - Toggle switches
  - Bottom nav changes
  - Destructive actions
  - Quiz answer selection
- Keep haptics subtle and consistent.

How to test:

- Tap common actions on a real iPhone.
- Feedback should feel helpful, not noisy.

Before / After / Why:

| Before | After | Why |
| --- | --- | --- |
| Some interactions have haptics and some do not | Haptics follow a clear app rule | Physical feedback feels intentional |

### NAT-018: Keep And Extend Real Simulator Tap Automation

Priority: P0
Area: Native QA automation

Simple explanation:
The real Capacitor app now has a working XCUITest harness for auth keyboard checks. Keep it because it caught a real create-user focus issue that screenshots alone would have missed.

Task:

- Keep `NativeAuditUITests` as the repeatable native QA harness.
- Extend it beyond auth into forgot/reset password, checkout, profile, search, notes, and protected app pages.
- Capture screenshots before keyboard, during keyboard, and after keyboard close.
- Save pass/fail notes into the native QA checklist.

How to test:

- Run one command that launches the native app and taps each auth input.
- The keyboard should open without pushing the full screen upward.
- The submit button should remain reachable on small screens.

Before / After / Why:

| Before | After | Why |
| --- | --- | --- |
| Simulator testing depended on launch screenshots | XCUITest taps real fields, opens the real keyboard, and saves evidence | Keyboard quality needs real interaction, not only visual screenshots |

### NAT-019: Fix The Capacitor iOS Run Command

Priority: P1
Area: Native developer workflow

Simple explanation:
`cap sync ios` worked, and the app built with Xcode. But `npx cap run ios --target ... --no-sync` failed with a JSON parse error from Capacitor/native-run. That makes native QA harder.

Task:

- Investigate the Capacitor/native-run target parsing failure.
- Check whether the issue is caused by the iOS 26 simulator output, the native-run package, or local CLI version mismatch.
- Fix the package/script if possible.
- If not fixed immediately, add a documented fallback command using `xcodebuild`, `simctl install`, and `simctl launch`.

How to test:

- Run the documented native command from a clean terminal.
- It should build, install, and launch the iOS simulator app without manual recovery.

Before / After / Why:

| Before | After | Why |
| --- | --- | --- |
| Native launch requires manual Xcode/simctl fallback | One reliable command launches the real Capacitor app | QA gets repeated often only when the run path is easy |

### NAT-020: Clean Empty Native CSS Import Warnings

Priority: P2
Area: Build cleanup

Simple explanation:
The native build works, but Vite warns that `native-ios.css` and `native-ios-tablet.css` are empty. Empty platform files may be intentional placeholders, but warnings create noise during native QA.

Task:

- Decide whether the empty files should stay as documented placeholders.
- If yes, add a small comment or remove the warning source if the build tool allows it.
- If no, remove the imports and files.
- Keep `native-ios-phone.css` because it contains active iOS phone rules.

How to test:

- Run `npm run cap:sync:ios`.
- The build should finish without avoidable CSS warning noise.

Before / After / Why:

| Before | After | Why |
| --- | --- | --- |
| Native build shows empty CSS import warnings | Build output is quiet except for real problems | Cleaner logs make real native issues easier to see |

### NAT-021: Final Auth Vertical-Balance Pass

Priority: P1
Area: Auth polish

Simple explanation:
The real native login screen has the right structure: no Capacitor top header, logo above "Welcome back," and readable fields. But the closed-keyboard screen still has a large dark top area, so the form can feel slightly low/heavy.

Task:

- Recheck login and create-user screens on the real simulator.
- Tune the closed-keyboard vertical balance only after keyboard behavior is proven.
- Keep the screen non-scrollable when the keyboard is closed.
- Keep the below-input area scrollable when the keyboard is open or screen height is too small.

How to test:

- Screenshot login and create-user with keyboard closed.
- Screenshot the same screens with keyboard open.
- The content should feel calm and centered without jumping.

Before / After / Why:

| Before | After | Why |
| --- | --- | --- |
| Auth screen structure is correct but top empty space still feels heavy | Auth content sits in a calmer visual center in both keyboard states | The first screen should feel intentional, not merely functional |

### NAT-022: Fix Create-User Confirm Password Focus

Priority: P0
Area: Create-user keyboard flow

Simple explanation:
In the real iPhone simulator, the create-user form could type Full name, Email address, and Password. But after typing Password, tapping Confirm password did not move keyboard focus there. Xcode reported the Password field was still keyboard-focused while Confirm password stayed unfocused. This can stop users before account creation.

Task:

- Make the create-user form scroll/focus the active field with enough clearance above the keyboard.
- Add a reliable next-field path from Password to Confirm password.
- Confirm the Confirm password field accepts focus and typed text after Password.
- Confirm the Create Profile button can be reached after the keyboard is closed.
- Re-run the registration-submit XCUITest and capture the dashboard or visible API error state.

How to test:

- Run `NativeAuditUITests/testRegistrationSubmitResult()`.
- Full name, Email, Password, and Confirm password should all accept typed text.
- The test should either reach Study Hub or show a real server/API error after submit.

Before / After / Why:

| Before | After | Why |
| --- | --- | --- |
| Confirm password may not receive focus after Password | Confirm password focuses and accepts typing reliably | New users should not get stuck while creating an account |

## Page Coverage Checklist

Use this checklist after NAT-008 and NAT-022 are done.

| Page area | Scroll | Header | Keyboard | Bottom nav | Safe area | Touch targets | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Login | Partial pass | N/A | Partial pass | N/A | Pass | Needs pass | Real XCUITest opened email/password keyboards with no whole-screen jump; lower controls can be covered |
| Create user | Partial pass | N/A | Fail | N/A | Pass | Needs pass | Closed layout and full-name keyboard pass; Confirm password focus failed after Password |
| Forgot/reset password | Needs pass | N/A | Needs pass | N/A | Needs pass | Needs pass | High keyboard risk |
| Dashboard | Needs pass | Needs pass | Low risk | Needs pass | Needs pass | Needs pass | Watch heavy effects |
| Courses | Needs pass | Needs pass | Low risk | Needs pass | Needs pass | Needs pass | Check cards and filters |
| Course detail | Needs pass | Needs pass | Low risk | Needs pass | Needs pass | Needs pass | Check sticky sections |
| Lessons/video | Needs pass | Needs pass | Medium risk | Needs pass | Needs pass | Needs pass | Check video controls |
| AI Notes | Needs pass | Needs pass | Needs pass | Needs pass | Needs pass | Needs pass | High complexity page |
| Normal notes | Needs pass | Needs pass | Needs pass | Needs pass | Needs pass | Needs pass | Check drawers and editor |
| Q-bank | Needs pass | Needs pass | Medium risk | Needs pass | Needs pass | Needs pass | Check filters |
| Quiz taking | Needs pass | Needs pass | Medium risk | Needs pass | Needs pass | Needs pass | Check fixed quiz bar |
| Results/review | Needs pass | Needs pass | Low risk | Needs pass | Needs pass | Needs pass | Check sticky review header |
| Billing/checkout | Needs pass | Needs pass | Needs pass | Needs pass | Needs pass | Needs pass | High form risk |
| Notifications | Needs pass | Needs pass | Low risk | Needs pass | Needs pass | Needs pass | Check empty/loading states |
| Profile/settings | Needs pass | Needs pass | Needs pass | Needs pass | Needs pass | Needs pass | High form risk |
| Admin | Needs decision | Needs decision | Needs decision | Needs decision | Needs decision | Needs decision | Decide support first |

## Suggested Work Order

### Phase 1: Must Fix Before Visual Polish

- NAT-001: Define one main scroll root.
- NAT-005: Build keyboard regression checklist.
- NAT-022: Fix create-user Confirm password focus.
- NAT-008: Add real simulator QA login.
- NAT-010: Create page-by-page native QA pass.
- NAT-018: Keep and extend real simulator tap automation.
- NAT-019: Fix the Capacitor iOS run command.

Why this phase comes first:
These tasks protect the basic feel of the app. If scrolling, keyboard, and QA access are not reliable, visual polish will not solve the user satisfaction problem.

### Phase 2: Native Feel Polish

- NAT-002: Test iOS scroll deceleration.
- NAT-003: Reduce heavy bottom nav blur on native.
- NAT-004: Create a header behavior rule.
- NAT-006: Remove custom smooth scroll from native phone actions.
- NAT-016: Verify safe area on every fixed element.
- NAT-021: Final auth vertical-balance pass.

Why this phase comes second:
These tasks make the app feel more like a real iPhone app during daily use.

### Phase 3: Quality, Accessibility, And Edge Cases

- NAT-007: Audit touch target sizes.
- NAT-009: Set a native effects budget.
- NAT-011: Make phone modals feel like native sheets.
- NAT-012: Make loading and route feedback consistent.
- NAT-013: Accessibility and dynamic text audit.
- NAT-014: Decide if admin is supported on native phone.
- NAT-015: Add native audit instrumentation.
- NAT-017: Make haptic feedback consistent.
- NAT-020: Clean empty native CSS import warnings.

Why this phase comes third:
These tasks turn a working native app into a comfortable, polished one.

## Acceptance Criteria For A Native-Feeling App

The app should pass these checks before calling the native UI complete:

- Swiping any main page feels natural and predictable.
- Keyboard opening does not push the whole screen upward.
- Forms remain usable on small screens.
- Headers behave consistently across student pages.
- Bottom nav stays stable while scrolling.
- Fixed UI respects safe areas.
- Important buttons are easy to tap with one thumb.
- Loading states do not flash or jump.
- Heavy blur and animation do not hurt scroll performance.
- Every major route has been tested in the simulator with a real logged-in user.
- The native iOS run command is reliable, or the Xcode/simctl fallback is documented.
- Auth keyboard behavior is proven by real taps, not only screenshots.

## Simple Final Recommendation

Do not start by redesigning colors. Start with scrolling, keyboard, header behavior, and bottom-nav performance. Those are the things users feel immediately, even if they cannot explain them.

After that, polish color, spacing, and visual density page by page.
