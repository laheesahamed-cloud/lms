# Project Cleanup Summary

Date: 2026-05-13

## Scope

This cleanup focused on preserving the stable student LMS experience while reducing generated clutter, stale source leftovers, and platform build friction for website, Capacitor iOS, Capacitor Android, and macOS desktop packaging.

## Cleanup Completed

- Removed the archived unused source folder from `archive_unused/`.
- Removed generated release and native build outputs after validation.
- Rebuilt and kept `frontend/dist/` because the local Apache website at `/lms/` loads its CSS and JS from `/lms/frontend/dist/assets/`.
- Removed empty leftover source folders under frontend and backend feature/component areas.
- Removed TypeScript incremental build cache files and ignored future `*.tsbuildinfo` output.
- Removed generated Android build output from `frontend/android/app/build/`.
- Added ignore rules for Capacitor, Android, iOS DerivedData, and generated frontend outputs.
- Restored required PWA/offline assets into `frontend/public/` so Vite builds keep manifest, service worker, icons, and offline quotes available.

## Stability Fixes Preserved

- Native auth login/register now request session-token exposure with both `X-LMS-Native: 1` and `?native=1`.
- The backend only exposes `sessionToken` for native auth requests and keeps browser responses cookie-based.
- Native sign-in/sign-up now fails loudly if a token is missing instead of flashing the dashboard and collapsing into a white screen.
- Native runtime error handling now shows a dark overlay instead of replacing the whole app body with a blank white page.

## Optimization Completed

- Production frontend builds now use Oxc minification.
- Source maps are disabled by default and can be enabled with `VITE_SOURCEMAP=true`.
- Capacitor builds emit to `frontend/dist-capacitor`.
- macOS desktop scripts now support both Apple Silicon and Intel DMG builds:
  - `npm run desktop:dist:mac:arm64`
  - `npm run desktop:dist:mac:x64`
  - `npm run desktop:dist:mac:m1`

## Validation Results

- Backend build: passed.
- Frontend website build: passed.
- Frontend Capacitor build: passed.
- Capacitor sync for iOS/Android: passed.
- iOS simulator build: passed.
- macOS Apple Silicon DMG packaging: passed, unsigned and using default Electron icon.
- macOS Intel DMG packaging: passed, unsigned and using default Electron icon.
- API health check after cleanup: passed.

## Remaining Environment Blocker

Android debug build could not be completed on this machine because macOS reported that no Java Runtime is installed. Install a Java 21 runtime, then run:

```sh
cd frontend/android
./gradlew :app:assembleDebug
```

## Recommended Next Cleanup Pass

- Add a real Electron/macOS app icon before distribution.
- Configure macOS signing/notarization for release DMGs.
- Run full Android APK/AAB validation after Java is installed.
- Add route-level visual smoke checks for the student platform once a browser automation flow is available.
