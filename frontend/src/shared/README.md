# Shared Frontend Code

This folder contains code used by more than one surface.

- `api/`: API clients.
- `auth/`: route guards and auth UI helpers.
- `layout/`: shared shell, topbar, sidebar, panel layout, theme controls.
- `platform/`: web/PWA/native/desktop detection and platform-specific adapters.
- `stores/`: global client state.
- `styles/`: shared stylesheet entrypoint, tokens, layout, component, page, and platform CSS.
- `ui/`: reusable UI primitives.
- `utils/`: cross-surface utilities.

Do not place surface-only code here. Student app code belongs in `surfaces/app`, public website code belongs in `surfaces/website`, and admin code belongs in `surfaces/admin`.
