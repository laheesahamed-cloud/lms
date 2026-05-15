# Backend Platform

Platform-specific server adapters belong here.

- `web/` for browser/PWA-facing behavior.
- `native/` for Capacitor mobile behavior such as native push or deep-link adapters.
- `desktop/` for Electron-specific adapters.

Keep product modules under `modules/`. This folder is only for behavior that differs by runtime.
