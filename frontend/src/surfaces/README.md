# Frontend Surfaces

This folder is the product-facing UI boundary.

- `website/` is the public `domain.com` surface: landing, auth entry, policy pages, and LMS entry points.
- `app/` is the student `app.mydomain.com` and native-app surface: dashboard, courses, Q-Bank, lessons, results, billing, planner.
- `admin/` is the admin console surface: management pages, tables, settings, reports.

Shared code belongs in `frontend/src/shared`, not inside a surface, unless it is truly surface-specific.
