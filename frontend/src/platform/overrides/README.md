# Platform override compatibility

This folder is compatibility-only for older imports.

New platform-specific code should live in:

- `../web/` for browser website defaults.
- `../pwa/` for installed PWA behavior.
- `../native/` for Capacitor app behavior.
- `../native/ios/phone/` for iPhone-only native app code.
- `../native/ios/tablet/` for iPad-only native app code.
- `../native/android/phone/` for Android phone-only native app code.
- `../native/android/tablet/` for Android tablet-only native app code.
- `../desktop/` for Electron desktop behavior.

Prefer `selectPlatformComponent` or `selectPlatformValue` from `src/platform/select.js` at the composition boundary.
