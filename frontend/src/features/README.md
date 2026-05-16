# Features Folder

This folder contains role-specific product pages and feature modules.

- `auth/`: login, register, forgot/reset password.
- `student/`: student LMS pages used by the website, future app subdomain, and native app.
- `admin/`: admin-only management pages.
- `ai/`: standalone AI generator/demo pages.

Keep shared layout, shell, sidebar, and top bar code in `frontend/src/components/`.
Keep API clients in `frontend/src/api/`.
Keep platform-specific web/native behavior in `frontend/src/platform/`.
