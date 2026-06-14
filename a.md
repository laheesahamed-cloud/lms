# Capacitor iOS Simulator Bug Report

## Summary

Tested the installed Capacitor iOS app (`com.erpm.medical.lms`, display name `xyndrome`) on the booted iPhone 17 simulator. The app launches to the native login screen, and a disposable student user was successfully created through the same native registration API path used by the Capacitor app.

## Environment

- Simulator: iPhone 17, iOS 26.4
- Device UDID: `1288DBFD-2FCD-47B0-B88F-68B63EF3602A`
- App bundle: `com.erpm.medical.lms`
- API base: `https://xyndrome.lk/api`
- Test date: 2026-06-13 Europe/Minsk

## Test Account Created

- Full name: `Capacitor Simulator Test 20260612225542`
- Email: `capacitor.sim.20260612225542@example.com`
- User ID: `68`
- Role: `student`
- Status: `active`
- Subscription status: `active`
- Password/session token: intentionally not recorded in this report.

## Steps Performed

1. Launched the installed simulator app with `xcrun simctl launch booted com.erpm.medical.lms`.
2. Captured the launch/login screen from the simulator.
3. Attempted to deep-link to registration using `com.erpm.medical.lms://register` and `capacitor://localhost/register`.
4. Created a disposable user through `POST /auth/register?native=1` with `X-LMS-Native: 1`.
5. Verified the account can log in through `POST /auth/login?native=1`.
6. Verified the native session token works with `GET /auth/me`.
7. Attempted to seed the simulator WebView localStorage with the native auth keys and relaunch.

## Actual Results

- The app launches successfully and displays the login screen.
- Native registration succeeds with HTTP `201`, returns a session token, and redirects to `/app/dashboard`.
- Native login succeeds for the new account.
- `GET /auth/me` succeeds with the issued native session token.
- Deep links to `/register` fail because the installed app has no matching URL scheme configured.
- Full UI tap-through automation could not be completed in this environment because:
  - `simctl` provides screenshots/launch/openurl but no tap command.
  - `osascript`/System Events is blocked from assistive access.
  - Appium and `ios_webkit_debug_proxy` are not installed.

## Expected Results

- A tester should be able to open the native registration screen and create a student account directly in the simulator.
- If deep-link testing is required, the app should expose a supported URL scheme or universal link for routes such as `/register`.

## Evidence

- Launch screenshot: `tmp/capacitor-simulator-bug-report/01-launch.png`
- Deep-link attempt screenshots:
  - `tmp/capacitor-simulator-bug-report/02-openurl-custom.png`
  - `tmp/capacitor-simulator-bug-report/02-openurl-capacitor.png`
- Post-auth-seed simulator state: `tmp/capacitor-simulator-bug-report/03-after-auth-seed.png`
- Final simulator state: `tmp/capacitor-simulator-bug-report/04-final-login-state.png`

## Recommendation

For reliable simulator QA, add one of these:

1. A native URL scheme/universal link that can open `/register`.
2. An XCUITest target for the Capacitor shell that can drive signup and login flows.
3. A documented simulator test setup that grants the needed Accessibility permission or installs Appium/WebKit debugging tools.
