# LMS Local Run

This project now runs in 2 parts:

- `XAMPP / Apache` serves the static root entry at `http://localhost/lms/`
- `NestJS` serves the API on `http://localhost:3000/api`

## First-time setup

From the project root:

```bash
npm run install:all
```

Make sure:

- XAMPP Apache is running
- MySQL is running
- your backend env matches your local database

Useful env files:

- [frontend/.env.example](/Applications/XAMPP/xamppfiles/htdocs/lms/frontend/.env.example)
- [backend/.env.example](/Applications/XAMPP/xamppfiles/htdocs/lms/backend/.env.example)

Database seed/export:

- [database/lms.sql](/Applications/XAMPP/xamppfiles/htdocs/lms/database/lms.sql)

Versioned backend migrations:

```bash
npm run migrate:backend
```

## Daily startup

1. Start XAMPP Apache and MySQL.
2. Start the API:

```bash
npm run start:api
```

If you want the API to stay available after closing the terminal, start it in the background instead:

```bash
npm run start:api:bg
```

Useful background commands:

```bash
npm run status:api
npm run stop:api:bg
```

3. Open the app:

```text
http://localhost/lms/#/login
```

Mobile browser preview:

```bash
npm run mobile:preview
```

Then open:

```text
http://localhost/lms/mobile-preview.html
```

This is a browser device frame, so it does not require Xcode, iOS Simulator, or any native emulator.

## Build checks

Frontend:

```bash
npm run check:frontend
```

Backend:

```bash
npm run check:backend
```

API health:

```bash
npm run check:health
```

Both:

```bash
npm run build
```

## Notes

- The React UI is served directly from `frontend/dist`.
- If the login page shows `Network Error`, the NestJS API is usually not running.
- `npm run start:api` runs in the current terminal only. If you close that terminal, the API stops too.
- `npm run start:api:bg` is the better local option when you want the app to keep working after closing VS Code terminals.
- If `npm run check:health` does not return JSON, the API is offline or using a different port.
- The Vite dev server is optional now. The normal local flow uses Apache + the built frontend bundle.

## Runtime Validation

Use this quick pass after major changes:

1. Open `http://localhost/lms/#/login`
2. Sign in as an admin and check:
   - dashboard
   - courses
   - structure
   - users
   - questions
   - quizzes
   - lessons
3. Sign in as a student and check:
   - dashboard
   - courses
   - lessons
   - quizzes
   - take quiz
   - results
   - review
4. If something crashes, reload once and check the app error screen message before tracing deeper.
