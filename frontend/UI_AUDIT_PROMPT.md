# ERPM LMS iOS App — Full UI/UX Audit Prompt (iPhone 17 Simulator)

Audit the ERPM Medical LMS native iOS app (Capacitor) running in the **iPhone 17 simulator**, page by page, in **both light and dark mode**, and produce a written report. Audit only — do not fix anything yet.

## Context

- App bundle id: `com.erpm.medical.lms` (installed on the booted iPhone 17 simulator).
- Frontend source: `frontend/src` — surfaces in `src/surfaces/{app,website,admin}`, routes in `src/routes`, design tokens in `src/shared/styles` (theme.css).
- Design system ground truth (verify against `shared/theme.css` before flagging):
  - Font: **Plus Jakarta Sans** (self-hosted) everywhere.
  - Semantic colors: success/warning/error use **Apple system colors**; brand blue for primary actions; intentional split — *accessible* variant for text, *vivid* variant for fills.
  - Unified card system: `--surface-card`, `--line-soft`, `--ds-card-radius: 22px`, `--ds-card-shadow` — one card look across all pages.
  - Dark elevation ladder (student app): page `#0a0a0f` < recessed `#111117` < card `#16181f` < raised `#1c1f27`, all via `--sa-surface`; sidebar pinned `#0a0a0f`.
- A previous audit exists at `frontend/UI_UX_AUDIT.md` (tasks T1–T20). Re-check those issues: mark each as FIXED / STILL OPEN / REGRESSED in the new report. Do not overwrite that file.
- Test login: `[PASTE TEST EMAIL]` / `[PASTE TEST PASSWORD]`. If login fails or the API banner ("Cannot reach the LMS API at https://xyndrome.lk/api/") appears, first check the API from the Mac with curl; if the server is down, tell me, audit whatever is reachable offline (auth pages, error states), and explicitly list every page you could NOT audit.

## Tooling

- Screenshot: `xcrun simctl io booted screenshot /tmp/lms-audit/<page>_<mode>_<n>.png`, then Read the PNG to actually inspect it. Create `/tmp/lms-audit/` first.
- Appearance: `xcrun simctl ui booted appearance dark` / `light`. Screenshot the SAME page in both modes before moving on.
- Clean status bar (once, at start): `xcrun simctl status_bar booted override --time "9:41" --batteryLevel 100 --cellularBars 4 --operatorName ""`
- Relaunch app: `xcrun simctl terminate booted com.erpm.medical.lms; xcrun simctl launch booted com.erpm.medical.lms`
- Navigation: use the computer-use MCP (`request_access` for "Simulator", full tier) to tap, type, and scroll inside the simulator window. After EVERY tap/scroll, take a fresh screenshot to confirm where you are — never assume navigation succeeded.
- Scroll each page to the bottom, screenshotting every viewport — findings below the fold count.
- Optional console/errors: `xcrun simctl spawn booted log stream --predicate 'processImagePath CONTAINS "lms"' --style compact` in the background while navigating; or Safari → Develop → Simulator web inspector for the WebView console.

## Scope — every page, no sampling

First enumerate the real route list from `frontend/src/routes` and `src/surfaces/app`, then audit every page reachable in the iOS app. Expected inventory (verify against code, add anything missed):

1. Launch / mode select (LaunchModePage)
2. Login / Sign in
3. Create Profile / Register
4. Forgot password
5. Dashboard
6. Courses list
7. Course detail (csum summary view)
8. Quiz player — start, in-question, answer feedback, results, review screens
9. AI Quiz generator
10. AI Notes list
11. AI Notes reader (reading mode AND Personalize mode with tools panel)
12. Bookmarks
13. Search (if present)
14. Notifications / Announcements
15. Profile / Account
16. Settings
17. Subscription / paywall / plans
18. Legal pages reachable in-app (terms, privacy, cookie, refund)

For each page also exercise its **states**: empty state, loading state, error state, and any modals, sheets, dropdowns, and toasts it owns — these are part of the page's audit.

## Per-page checklist

Grade each item; cite the screenshot filename for every finding.

1. **Safe areas** — content under the Dynamic Island / status bar; home-indicator clearance; tab-bar bleed or content sliding behind it; bottom buttons reachable; keyboard does not cover the focused input on forms.
2. **Typography** — Plus Jakarta Sans actually rendering (no system-font fallback flash); consistent type scale across pages (page title, section header, body, caption should be the same sizes everywhere); line-height and truncation; body ≥ 15px, captions ≥ 11px; no unreadable low-contrast micro-text.
3. **Apple HIG colors** — success/warning/error match the Apple system palette per theme.css; text uses the accessible variant, fills the vivid variant; brand blue only for primary actions; contrast AA in BOTH modes (4.5:1 body, 3:1 large text/icons).
4. **Dark/light parity** — every surface follows the token ladder (no hardcoded `#fff`/`#000` leaking through in one mode); borders use `--line-soft`; images, illustrations, and charts legible in both modes; status-bar text legible against the page background in both modes.
5. **Component consistency** — all cards on `--surface-card` with 22px radius and the shared shadow (flag bespoke gradients/radii); buttons, inputs, chips, dropdowns share heights, radii, padding; one SVG icon set with uniform stroke weight; spacing on a consistent rhythm (~8pt grid).
6. **UX consistency** — back-navigation works and looks the same on every page; one page-header pattern; consistent empty/loading/error treatments; touch targets ≥ 44pt; visible tap feedback; no horizontal scroll or nested scrollbars.
7. **Performance** — cold launch time to first content; transition jank between pages; scroll smoothness on long lists; image pop-in / layout shift; long spinners; note anything that feels < 60fps and on which page.
8. **HIG details** — sheets/alerts behave natively (dismiss gestures, scrim); no gesture conflicts with the system edge-swipe; pull-to-refresh where expected; dropdowns/popovers opaque (this was a P0 last audit).

## Report

Write the report to `frontend/UI_UX_AUDIT_V3.md`:

1. **Executive summary** — overall grade, top 5 issues, what improved since UI_UX_AUDIT.md.
2. **Previous-audit re-check** — T1–T20 each marked FIXED / STILL OPEN / REGRESSED with screenshot evidence.
3. **Per-page sections** — screenshots referenced by path, each finding with: severity (P0 blocker / P1 major / P2 minor / P3 polish), what's wrong, the HIG/design-system rule it violates, suggested fix, and the offending file:line in `frontend/src` (grep to confirm — every token/color/typography claim must be verified in code, not guessed from pixels).
4. **Cross-page consistency matrix** — table of what was actually observed per page: title size, body size, card radius, card background, page background, header pattern, back-nav pattern. Inconsistencies jump out as rows that differ.
5. **Prioritized task list** — T1–Tn ordered P0→P3, each with effort estimate (S/M/L) and file pointers.
6. **Coverage appendix** — every page/state audited with its screenshot files, and every page NOT audited with the reason.

Rules: screenshot every page in both modes BEFORE writing the report; report only what you can show in a screenshot or prove in code; do not fix anything; if blocked (login, API down), say so and continue with what is reachable.
