# LMS Project Inventory

Use this as the quick map of what exists in the project. When debugging, start here to find the right surface, module, command, or database area.

## Runtime Shape

| Layer | Purpose | Main Path |
| --- | --- | --- |
| Public website | Landing, auth, policy, demos | `frontend/src/surfaces/website/` |
| Student app | Dashboard, courses, lessons, quizzes, results, notes | `frontend/src/surfaces/app/` |
| Admin console | Content, users, questions, quizzes, subscriptions, reports | `frontend/src/surfaces/admin/` |
| Shared frontend | API clients, layout, auth, stores, styles, platform helpers | `frontend/src/shared/` |
| Backend API | NestJS modules and controllers | `backend/src/` |
| Database sync | Local schema bootstrap/backfill | `backend/src/modules/schema/schema-sync.service.ts` |
| Desktop wrapper | Electron shell | `desktop/` |
| Native wrapper | Capacitor iOS/Android | `frontend/ios/`, `frontend/android/` |

## Local URLs

| Area | URL |
| --- | --- |
| Website | `http://localhost/lms/` |
| Login | `http://localhost/lms/auth/login` |
| Student dashboard | `http://localhost/lms/app/dashboard` |
| Admin dashboard | `http://localhost/lms/admin/dashboard` |
| Backend API base | `http://localhost:3000/api` |
| API health | `http://localhost:3000/api/health` |

Plain `/api/` is not a route. Use a specific endpoint such as `/api/health`.

## Commands

| Command | Use |
| --- | --- |
| `npm run install:all` | Install frontend and backend dependencies |
| `npm run start:api` | Start backend in current terminal |
| `npm run start:api:bg` | Start backend in background |
| `npm run status:api` | Check background API status |
| `npm run stop:api:bg` | Stop background API |
| `npm run dev:frontend` | Start Vite frontend dev server |
| `npm run build:frontend` | Build React app |
| `npm run build:backend` | Build NestJS API |
| `npm run build` | Build frontend and backend |
| `npm test` | Static project smoke check |
| `npm run mobile:cap:sync` | Build and sync Capacitor app |

## Backend Modules

| Module | What It Owns | Key Files |
| --- | --- | --- |
| Auth | Login, register, sessions, profile, password reset, guards | `backend/src/modules/auth/` |
| Users | Admin user management and student details | `backend/src/modules/users/` |
| Courses | Course list/detail and student lesson progress | `backend/src/modules/courses/` |
| Topics/Subtopics | Course hierarchy subjects and topics | `backend/src/modules/topics/`, `backend/src/modules/subtopics/` |
| Lessons | Lesson CRUD, student lesson reader, annotations | `backend/src/modules/lessons/` |
| Questions | Question bank, CSV import/export, keywords, options | `backend/src/modules/questions/` |
| Quizzes | Quiz CRUD and quiz cards | `backend/src/modules/quizzes/` |
| Quiz Attempts | Practice/exam attempt flow, scoring, review | `backend/src/modules/quiz-attempts/` |
| Results | Results wrapper API backed by quiz attempts | `backend/src/modules/results/` |
| Dashboard | Admin/student dashboard data and study activity | `backend/src/modules/dashboard/` |
| Subscriptions/Plans | Plans, features, payment requests, audit events | `backend/src/modules/plans/`, `backend/src/modules/subscriptions/` |
| AI | Quiz/explanation/theory generation | `backend/src/modules/ai/` |
| AI Notes | Lesson note/canvas generation and reading | `backend/src/modules/ai-notes/` |
| Smart Notes | Student smart-note processing | `backend/src/modules/smart-notes/` |
| Workspace | Announcements, notifications, planner, reports, question review | `backend/src/modules/workspace/` |
| Push | Web/native push subscription and sending | `backend/src/modules/push-notifications/` |
| Settings | General, payment, SMTP, AI provider config | `backend/src/modules/settings/` |
| Setup | Schema/setup diagnostics | `backend/src/modules/setup/` |
| Health | Health, readiness, metrics | `backend/src/health.controller.ts` |

## Frontend Surfaces

| Surface | Important Pages |
| --- | --- |
| Website | `LandingPage`, `LoginPage`, `RegisterPage`, policy pages, AI demo pages |
| Student | `StudentDashboardPage`, `StudentCoursesPage`, `CourseDetailPage`, `AiNotesPage`, `StudentQuizzesPage`, `TakeQuizPage`, results pages, billing, planner |
| Admin | `AdminDashboardPage`, `CoursesPage`, `StructurePage`, `UsersPage`, `QuestionsPage`, `QuizBuilderPage`, subscriptions, AI notes, reports, settings |
| Shared | `AppHeader`, auth store/gates, API clients, profile avatar, theme/platform styles |

For route-by-route details, use `docs/architecture/page-map.md`.

## Database Areas

| Area | Tables/Signals |
| --- | --- |
| Users/sessions | `users`, `session_token`, `session_expires_at` |
| Course hierarchy | `courses`, `topics`, `subtopics`, `lessons` |
| Questions/quizzes | `questions`, `question_options`, `question_quizzes`, `quizzes` |
| Attempts/results | `quiz_attempts`, `student_answers`, `practice_sessions`, `practice_answers` |
| Subscriptions | `plans`, `user_subscriptions`, `subscription_requests`, `payment_transactions`, `subscription_audit_events` |
| Student activity | `study_activity_events`, `student_lesson_progress`, `study_bookmarks` |
| Content governance | `question_review_items`, `content_audit_events`, `content_versions` |
| Notifications/workspace | `announcements`, `announcement_reads`, `study_planner_tasks` |
| AI notes | `ai_illustrated_notes`, `smart_notes`, `question_theory_recaps` |

## New Production Foundations

| Foundation | Where |
| --- | --- |
| CI smoke/build workflow | `.github/workflows/ci.yml` |
| Static smoke check | `scripts/qa/static-check.mjs` |
| Results API wrapper | `backend/src/modules/results/` |
| Role permissions | `backend/src/modules/auth/role-permissions.ts` |
| Permission guard/decorator | `backend/src/modules/auth/permission.guard.ts`, `permissions.decorator.ts` |
| Content audit/version schema | `backend/src/modules/schema/schema-sync.service.ts` |
| Question audit/version writes | `backend/src/modules/questions/questions.service.ts` |
| Health/readiness/metrics | `backend/src/health.controller.ts` |
