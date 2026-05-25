# Access control matrix

This backend is deny-by-default for private data: routes either remain intentionally public, require an authenticated student and scope database queries by that student's `user_id`, or require an active staff account plus a permission from `backend/src/modules/auth/role-permissions.ts`.

## Public routes

| Route group | Allowed callers | Notes |
| --- | --- | --- |
| `GET /api/health`, `GET /api/health/ready` | Public | Operational health only. |
| `GET /api/health/metrics` | Public in non-production; token in production | Requires `X-Health-Token` when `NODE_ENV=production`. |
| `POST /api/auth/login`, `POST /api/auth/register` | Public | Creates HttpOnly session cookie for web; native clients may request bearer token. |
| `POST /api/auth/forgot-password`, `POST /api/auth/reset-password` | Public | Reset tokens are hashed at rest and expire. |
| `GET /api/settings/public` | Public | Public branding/contact settings only. |
| `GET /api/plans` | Public | Active public plan catalog only. |
| `GET /api/push/vapid-public-key` | Public | Public push key only. |
| `POST /api/subscriptions/payhere/notify` | Payment provider | Verifies payment notification before activation. |

## Authenticated student routes

| Route group | Allowed callers | Ownership / IDOR rule |
| --- | --- | --- |
| `GET/PATCH /api/auth/profile`, `PATCH /api/auth/password`, `GET /api/auth/me`, `POST /api/auth/logout` | Current authenticated user | Operates only on current session user. |
| `GET /api/dashboard/student`, `POST /api/dashboard/student/activity` | Active student | Reads/writes by current student id. |
| `GET /api/courses/student*`, `PATCH /api/courses/student/lessons/:lessonId/progress` | Active student | Progress is written with current student id; lesson access is checked. |
| `GET /api/lessons/student*` | Active student | Premium lesson content is hidden unless current student's plan grants access. |
| `GET/POST/PATCH/DELETE /api/lessons/:lessonId/annotations*` | Active student | Annotation queries include both `lesson_id` and current `user_id`. |
| `GET/POST/PATCH/DELETE /api/smart-notes*` | Active student | Smart note queries include current `user_id`. |
| `GET /api/ai-notes`, `GET /api/ai-notes/:id`, `GET /api/ai-notes/student/lesson/:lessonId` | Active student | Note payload is removed unless current student's plan grants feature/course/lesson access. |
| `GET /api/quizzes/:id/cards` | Active student | Quiz answer cards require current student's course/question-bank access or free quiz status. |
| `GET/POST /api/quiz-attempts*`, `GET /api/results*` | Active student | Attempts, results, practice sessions, and reviews are scoped to current `user_id`. |
| `GET/POST /api/study-bookmarks*` | Active student | Bookmark list/toggle is scoped to current `user_id`. |
| `GET/POST/PATCH/DELETE /api/study-planner*` | Active student | Planner task queries include current `user_id`. |
| `GET/POST /api/subscriptions/me`, `/request`, `/payhere/initiate`, `/manual-payment/request` | Active student | Billing and requests use current student id only. |
| `GET/PUT/POST/DELETE /api/push/settings`, `/subscribe`, `/native-token` | Authenticated user | Push preferences and tokens are scoped to current user/device. |

## Staff routes

| Permission | Route groups | Allowed roles |
| --- | --- | --- |
| `admin.access` | `/api/admin/*` boundary | All active staff roles; downstream route still checks specific permissions. |
| `content.manage` | Courses, topics, subtopics, lessons admin, papers, AI lesson canvas admin, theory recap writes | `admin`, `content_editor` |
| `questions.manage` | Questions CRUD/import/export, question keyword bulk actions | `admin`, `content_editor`, `reviewer` |
| `quizzes.manage` | Quiz admin list/meta/find/create/update/delete | `admin`, `content_editor` |
| `content.review` | Question review queue | `admin`, `reviewer`, `tutor` |
| `students.manage` | Users/student management | `admin`, `support` |
| `subscriptions.manage` | Subscription admin lists/actions, coupons, invoices, payment proofs | `admin`, `finance` |
| `plans.manage` | Plan and subscription-feature management | `admin`, `finance` |
| `settings.manage` | General/payment/SMTP/AI provider settings, setup status | `admin` |
| `ai.manage` | AI generation endpoints | `admin`, `content_editor` |
| `notifications.manage` | Announcement and push-notification admin sends/status | `admin`, `support` |
| `reports.view` | Admin dashboard/reports | `admin`, `content_editor`, `reviewer`, `tutor`, `finance`, `support` |

## Regression coverage

`backend/test/access-control-regression.ts` verifies:

| Case | Expected result |
| --- | --- |
| Student requests paid quiz answer cards without course access | Denied before answer rows are loaded. |
| Student requests paid quiz answer cards with matching course access | Allowed. |
| Staff without `subscriptions.manage` calls `GET /api/subscriptions` | Forbidden. |
| Finance staff calls `GET /api/subscriptions` | Receives admin list, not student billing fallback. |
| Student calls `GET /api/subscriptions` | Receives billing data for their own user id only. |
