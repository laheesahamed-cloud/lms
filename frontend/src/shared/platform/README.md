# Frontend Platform Architecture

Shared runtime detection stays in `detect.js`, `config.js`, `select.js`, and `PlatformProvider.jsx`.

Platform-specific code belongs here:

- `web/` for normal browser behavior.
- `pwa/` for installed or standalone PWA behavior.
- `native/` for Capacitor mobile behavior.
- `native/ios/phone` and `native/ios/tablet` for iPhone/iPad-only components.
- `native/android/phone` and `native/android/tablet` for Android-specific components.
- `desktop/` for Electron-specific frontend behavior.

`overrides/` is now compatibility-only. New imports should point directly at `platform/web`, `platform/pwa`, `platform/native`, or `platform/desktop`.
