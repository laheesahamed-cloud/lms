# Desktop

Electron shell code lives here.

- `main.cjs` owns the Electron main process.
- `preload.cjs` owns the preload bridge.
- `assets/` is for desktop-packaging assets only.

Shared frontend UI still belongs in `frontend/src`. Desktop-specific frontend behavior belongs in `frontend/src/platform/desktop`.
