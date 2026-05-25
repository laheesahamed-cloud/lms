# Platform Separation

The frontend uses one codebase for public web, PWA, Capacitor native, and future desktop targets. Platform-specific behavior must enter through `frontend/src/shared/platform`, not through random checks in feature pages.

## Architecture

Use a hybrid approach:

- Build-time target: `VITE_LMS_BUILD_TARGET=web|pwa|native|desktop`.
- Runtime detection: iOS, Android, Windows, macOS, Linux, phone, tablet, desktop.
- React context: `PlatformProvider`.
- Config policy: `platform/config.js`.
- Component/value selection: `platform/select.js`.
- CSS scoping: `html[data-lms-*]`.
- App-only host guard: `AppOnlyBrowserGate`.

## Current Structure

```text
frontend/src/shared/platform/
  detect.js
  config.js
  PlatformProvider.jsx
  AppOnlyBrowserGate.jsx
  select.js
  styles.css
  overrides/
    web/
    pwa/
    native/
      ios/
        phone/
        tablet/
      android/
        phone/
        tablet/
    desktop/
      windows/
      macos/
```

## Startup Flow

```text
main.jsx
  -> detect platform
  -> write html data-lms-* attributes
  -> register service worker only when platform config allows it
  -> render App

App.jsx
  -> block app-only hosts opened in a normal browser
  -> provide PlatformProvider
  -> render RouterProvider
  -> mount PWA runtime effects only for web/PWA

router.jsx
  -> asks platform config for basename
  -> renders the shared route tree

AppFrame.jsx
  -> renders routes
  -> runs native iOS repaint fix only for native iOS
```

One shared router is still used because the role routes are mostly the same today. It is safe because platform-specific router behavior is limited to config-derived policy: basename and legacy-path normalization. If a future target needs a genuinely different route tree, create a router factory that chooses route arrays from `platform/config.js`; do not add platform checks inside route definitions.

## Target Keys

`detect.js` exposes:

- `native-ios-phone`
- `native-ios-tablet`
- `native-android-phone`
- `native-android-tablet`
- `web-mobile`
- `web-tablet`
- `web-desktop`
- `web-pwa-phone`
- `web-pwa-tablet`
- `web-pwa-desktop`
- `desktop-windows`
- `desktop-macos`

It writes:

```text
data-lms-runtime
data-lms-os
data-lms-form-factor
data-lms-target
data-lms-pwa
```

## Build Commands

```bash
npm run build:web
npm run build:pwa
npm run build:cap
npm run build:desktop
```

`build:cap` sets `VITE_LMS_BUILD_TARGET=native` and `CAPACITOR_BUILD=1`, so native uses relative assets and does not register the service worker.

## App-Only Hosts

Configure:

```env
VITE_PUBLIC_WEBSITE_URL=https://www.example.com
VITE_APP_ONLY_HOSTS=app.example.com,app-lms.example.com
VITE_APP_ONLY_HOST_PATTERN=^(app|app-lms)\.
```

Normal browser on `app.example.com`: private endpoint message.
Native shell on `app.example.com`: allowed.

## Real Applied Separations

Header install action:

- `AppHeader` renders `HeaderInstallAction`.
- Web/PWA dynamically loads `platform/web/HeaderInstallAction.jsx`, which renders `PwaInstallPrompt`.
- Native uses `platform/native/HeaderInstallAction.jsx`, which renders `null`.

Notification delivery:

- Web/PWA select Web Push delivery.
- Native selects a native placeholder and never runs Web Push registration.

PWA runtime:

- `main.jsx` registers service worker only when `shouldRegisterServiceWorker()` allows it.
- `App.jsx` mounts offline/recovery PWA effects only when `shouldMountPwaExperiences()` allows it.
- `PwaInstallPrompt` also checks `shouldShowPwaInstallPrompt()`.

Layout policy:

- `AppShell` asks `shouldUseOverlayNavigation()` instead of owning tablet/native logic directly.

CSS:

- Platform-specific CSS lives in `styles/05-platforms/` and is loaded by `styles/index.css`.
- `platform/styles.css` is a compatibility shim for older imports only.
- PWA-only CSS uses `html[data-lms-runtime="pwa"]`.
- Native-only CSS must use `html[data-lms-runtime="native"]` or a target key.

## Safe Change Rules

Website only:

- Prefer `platform/web`.
- Use `html[data-lms-runtime="web"]` or `html[data-lms-target="web-desktop"]`.
- Build with `npm run build:web`.

PWA only:

- Prefer `platform/pwa`.
- Use `html[data-lms-runtime="pwa"]` or `web-pwa-*` target keys.
- Build with `npm run build:pwa`.

iPhone app only:

- Put components in `platform/native/ios/phone`.
- Use `html[data-lms-target="native-ios-phone"]`.
- Do not edit `app.css` broad media queries for iPhone-only fixes.

iPad app only:

- Put components in `platform/native/ios/tablet`.
- Use `html[data-lms-target="native-ios-tablet"]`.

Android phone only:

- Put components in `platform/native/android/phone`.
- Use `html[data-lms-target="native-android-phone"]`.

Android tablet only:

- Put components in `platform/native/android/tablet`.
- Use `html[data-lms-target="native-android-tablet"]`.

Desktop app only:

- Put components in `platform/desktop`.
- Use `desktop-windows` or `desktop-macos` target keys.

## Examples

Component:

```jsx
import { selectPlatformComponent } from '../platform/select.js';
import { SharedHeader } from './SharedHeader.jsx';
import { IPhoneHeader } from '../platform/native/ios/phone/IPhoneHeader.jsx';

const Header = selectPlatformComponent({
  'native-ios-phone': IPhoneHeader,
}, SharedHeader);
```

Value:

```js
import { selectPlatformValue } from '../platform/select.js';

export const navDensity = selectPlatformValue({
  'native-ios-phone': 'compact',
  'web-desktop': 'expanded',
}, 'comfortable');
```

CSS:

```css
html[data-lms-target="native-ios-phone"] .lesson-toolbar {
  padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
}

html[data-lms-target="web-desktop"] .lesson-toolbar {
  padding-bottom: 12px;
}
```

## Do Not Edit For Platform-Only Changes

Avoid direct platform-only edits in:

- `frontend/src/shared/styles/99-legacy/app.css`
- `shared/theme.css`
- `shared/foundation.css`
- `frontend/src/app/router.jsx`
- `frontend/src/app/App.jsx`
- `frontend/src/app/AppFrame.jsx`
- `frontend/src/shared/layout/AppHeader.jsx`
- `frontend/src/shared/layout/AppShell.jsx`
- `frontend/src/shared/layout/AppSidebar.jsx`
- surface feature pages under `frontend/src/surfaces`

If a platform-only change seems to require those files, first add a platform override or a config policy in `frontend/src/shared/platform`.

## Remaining Shared Surface

Most feature routes and page bodies are still shared. This is intentional until a target needs a real divergence. The rule is: shared code can change shared behavior; target-only behavior must go through `platform`.
