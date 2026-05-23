# Backend endpoint coverage matrix

Date: 2026-05-23

| Route | Method | Guard used | Required permission | Ownership check | Test coverage | Remaining risk |
| --- | --- | --- | --- | --- | --- | --- |
| `/api/health` | GET | None | None | None | `security.e2e.ts` | Keep response low-detail |
| `/api/health/ready` | GET | None | None | None | `security.e2e.ts` | Public readiness exposes only aggregate status |
| `/api/health/metrics` | GET | Health token check in controller | `HEALTH_METRICS_TOKEN` | None | `security.e2e.ts` | Token must be strong and secret |
| `/api/auth/login` | POST | Public plus rate limit | None | N/A | `auth-regression.ts` | Brute force depends on in-memory limiter |
| `/api/auth/register` | POST | Public plus validation | None | N/A | `auth-regression.ts` | Signup abuse controls may need captcha/email verify |
| `/api/auth/me` | GET | `AuthService.me` | Authenticated user | Self via session token | `auth-regression.ts` | None known |
| `/api/auth/logout` | POST | `AuthService.logout` | Authenticated session token when present | Token invalidation by exact session hash | `auth-regression.ts` | None known |
| `/api/auth/forgot-password` | POST | Public plus rate limit | None | N/A | `auth-regression.ts` | Email enumeration response kept generic |
| `/api/auth/reset-password` | POST | Token validation | Reset token | Reset token ownership by hash | `auth-regression.ts` | Reset token delivery depends on SMTP config |
| `/api/auth/profile` | PATCH | `AuthService.updateProfile` | Authenticated user | Self via session token | `security.e2e.ts` | None known |
| `/api/auth/password` | PATCH | `AuthService.changePassword` | Authenticated user | Self via session token | `auth-regression.ts` | None known |
| `/api/questions/*` | GET/POST/PATCH/DELETE | `AdminGuard`, global `PermissionGuard` | `questions.manage` | Admin content scope | `access-control-regression.ts`, `api-security-negative-regression.ts`, `sql-injection-regression.ts` | No object ownership model for global content |
| `/api/quizzes` | GET/POST/PATCH/DELETE | `AdminGuard`, global `PermissionGuard` | `quizzes.manage` | Admin content scope | `access-control-regression.ts` | No object ownership model for global content |
| `/api/quizzes/:id/cards` | GET | `StudentGuard` | Student | Course/plan/free quiz access in service | `access-control-regression.ts` | Coverage is service-level, not HTTP server-level |
| `/api/quiz-attempts/quizzes` | GET | Service `requireStudent` | Student | Self via user id | `security.e2e.ts` | None known |
| `/api/quiz-attempts/results` | GET | Service `requireStudent` | Student | `qa.user_id = ?` | `security.e2e.ts` | None known |
| `/api/quiz-attempts/quiz/:quizId` | GET | Service `requireStudent` | Student | Plan/course access checks | `security.e2e.ts` | Paid-provider contract should be verified with seeded fixtures |
| `/api/quiz-attempts/practice/:quizId/save` | POST | Service `requireStudent` | Student | Practice session by user/quiz | `security.e2e.ts` | None known |
| `/api/quiz-attempts/exam/:quizId/submit` | POST | Service `requireStudent` | Student | New attempt tied to user id | `security.e2e.ts` | Duplicate-submit policy still product-dependent |
| `/api/quiz-attempts/result/:attemptId` | GET | Service `requireStudent` | Student | `qa.id = ? AND qa.user_id = ?` | `api-security-negative-regression.ts` | None known |
| `/api/quiz-attempts/review/:attemptId` | GET | Service `requireStudent` | Student | `qa.id = ? AND qa.user_id = ?` | `api-security-negative-regression.ts` | None known |
| `/api/results*` | GET | Delegates to quiz attempts service | Student | `qa.user_id = ?` | `api-security-negative-regression.ts` indirectly | Route-level e2e not present |
| `/api/lessons/meta`, `/api/lessons/admin` | GET | `AdminGuard`, global `PermissionGuard` | `content.manage` | Admin content scope | `security.e2e.ts` | None known |
| `/api/lessons` | POST/PATCH/DELETE | `AdminGuard`, global `PermissionGuard` | `content.manage` | Admin content scope | `security.e2e.ts` | No object ownership model for global content |
| `/api/lessons/student*` | GET | Service student auth | Student | Plan/course/free lesson access | `security.e2e.ts` | Paid-content fixture coverage should keep expanding |
| `/api/lessons/:lessonId/annotations*` | GET/POST/PATCH/DELETE | Service student auth | Student | `lesson_id` plus `user_id`; `findOwnedAnnotation` | `api-security-negative-regression.ts` | None known |
| `/api/smart-notes*` | GET/POST/PATCH/DELETE | Service student auth | Student | `id = ? AND user_id = ?` | `api-security-negative-regression.ts` | None known |
| `/api/courses/student*` | GET/PATCH | Service student auth | Student | User progress by `user_id` and plan access | `security.e2e.ts` | None known |
| `/api/courses*` | GET/POST/PATCH/DELETE | `AdminGuard`, global `PermissionGuard` | `content.manage` | Admin content scope | `security.e2e.ts` | No object ownership model for global content |
| `/api/topics*` | GET/POST/PATCH/DELETE | `AdminGuard`, global `PermissionGuard` | `content.manage` | Admin content scope | `security.e2e.ts` | No object ownership model for global content |
| `/api/subtopics*` | GET/POST/PATCH/DELETE | `AdminGuard`, global `PermissionGuard` | `content.manage` | Admin content scope | `security.e2e.ts` | No object ownership model for global content |
| `/api/papers*` | GET/POST/PATCH/DELETE | `AdminGuard`, global `PermissionGuard` | `content.manage` | Admin content scope | `security.e2e.ts` | No object ownership model for global content |
| `/api/users*` | GET/POST/PATCH/DELETE | `AdminGuard`, global `PermissionGuard` | `students.manage` | Admin student-management scope | `security.e2e.ts` | None known |
| `/api/settings/public` | GET | Public | None | Public-safe settings only | `security.e2e.ts` | Keep new settings out of public serializer by default |
| `/api/settings*` | GET/POST/PUT/DELETE | Manual `requireAdmin`, global `PermissionGuard` | `settings.manage` | Admin settings scope | `secrets-regression.ts`, `security.e2e.ts` | None known |
| `/api/plans` | GET | Public | None | Public active plan data | `security.e2e.ts` | Ensure future fields do not expose internal pricing/payment metadata |
| `/api/plans/admin`, `/api/plans/features`, `/api/plans*` mutating | GET/POST/PATCH/DELETE | Manual `requireAdmin`, global `PermissionGuard` | `plans.manage` | Admin plans scope | `security.e2e.ts` | None known |
| `/api/subscriptions` | GET | `requireAuthenticatedUser` | Student self or `subscriptions.manage` for staff | Student gets `getStudentBilling(user.id)` | `access-control-regression.ts` | None known |
| `/api/subscriptions/admin*` | GET/POST/PATCH/DELETE | Manual `requireAdmin`, global `PermissionGuard` | `subscriptions.manage` | Admin billing scope | `api-security-negative-regression.ts` | Webhook remains public by design |
| `/api/subscriptions/request`, `/payhere/initiate`, `/manual-payment/request`, `/me` | GET/POST | Manual `requireStudent` | Student | Uses authenticated student id | `access-control-regression.ts`, `security.e2e.ts` | Live PayHere provider callback still needs production verification |
| `/api/subscriptions/payhere/notify` | POST | Public webhook | PayHere hash validation in service | Transaction by provider payload | `security.e2e.ts` | Provider retry behavior should be monitored after live PayHere verification |
| `/api/uploads/payment-proofs/:fileName` | GET | `AdminGuard`, global `PermissionGuard` | `subscriptions.manage` | Admin billing scope | `security.e2e.ts` | None known |
| `/api/ai*` | POST | `AdminGuard`, global `PermissionGuard` | `ai.manage` | Admin AI scope | `security.e2e.ts` | Prompt/data leakage controls still need human review for generated content |
| `/api/ai-notes/generate` | POST | Global `PermissionGuard`, service admin auth | `ai.manage` | Admin AI scope | `security.e2e.ts` | Prompt/data leakage controls still need human review for generated content |
| `/api/ai-notes/admin*` | GET/POST/PATCH/DELETE | Global `PermissionGuard`, service admin auth | `content.manage` | Admin content scope | `security.e2e.ts` | No object ownership model for global content |
| `/api/ai-notes`, `/api/ai-notes/student/lesson/:lessonId`, `/api/ai-notes/:id` | GET | Service student auth | Student | Plan/free lesson/note access checks | `security.e2e.ts` | Paid-note fixture coverage should keep expanding |
| `/api/study-bookmarks*` | GET/POST | Manual `requireStudent` in controller | Student | `user_id = ?` | `security.e2e.ts` | None known |
| `/api/theory-recap/question/:questionId` | GET | Manual `requireAuthenticatedUser` | Authenticated user | Content is question-scoped, not user-owned | `security.e2e.ts` | Student entitlement policy remains intentionally content-scoped |
| `/api/theory-recap*` mutating/generate | PUT/POST/DELETE | Manual `requireAdmin`, global `PermissionGuard` | `content.manage` or `ai.manage` | Admin content scope | `security.e2e.ts` | None known |
| `/api/setup` | GET | `AdminGuard`, global `PermissionGuard` | `settings.manage` | Admin setup scope | `security.e2e.ts` | None known |
| `/api/push/vapid-public-key` | GET | Public | None | Public VAPID key only | `security.e2e.ts` | None known |
| `/api/push/settings`, `/subscribe`, `/native-token` | GET/PUT/POST/DELETE | Service auth | Student self settings/tokens | `security.e2e.ts` | Web push subscribe remains disabled by design |
| `/api/push/admin/status`, `/api/push/admin/send` | GET/POST | Global `PermissionGuard`, service admin auth | `notifications.manage` | Admin notification scope | `security.e2e.ts` | None known |
| `/api/announcements/admin*` | GET/POST/PATCH/DELETE | Global `PermissionGuard`, service admin auth | `notifications.manage` | Admin announcement scope | `security.e2e.ts` | None known |
| `/api/notifications*` | GET/POST | Service student auth | Student | Notification reads by user id | `security.e2e.ts` | None known |
| `/api/study-planner*` | GET/POST/PATCH/DELETE | Service student auth | Student | `user_id = ?` on tasks | `security.e2e.ts` | None known |
| `/api/reports/admin` | GET | Global `PermissionGuard`, service admin auth | `reports.view` | Admin report scope | `security.e2e.ts` | Dynamic filters reviewed with allow-listed columns |
| `/api/question-review/admin*` | GET/POST/PATCH | Global `PermissionGuard`, service admin auth | `content.review` | Admin review scope | `security.e2e.ts` | None known |
| `/api/lesson-doubts` | GET/POST | Service student auth | Student | `d.user_id = ?` for list/create | `security.e2e.ts` | Student update/delete routes do not exist; admin answer remains permission-gated |
| `/api/lesson-doubts/admin*` | GET/PATCH | Global `PermissionGuard`, service admin auth | `support.manage` | Admin support scope | `security.e2e.ts` | None known |
