# Scripts

Operational scripts are grouped by purpose:

- `dev/` for local development helpers.
- `build/` for build orchestration.
- `smoke/` for smoke tests and visual checks.
- `release/` for release packaging.
- `native/` for Capacitor/iOS/Android helpers.
- `desktop/` for Electron helpers.
- `database/` for database maintenance scripts.

Root package scripts should call files from these folders instead of adding new flat scripts at `scripts/`.
