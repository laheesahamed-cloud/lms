# LMS API Map

This is a compact map of the API. Use it to find which backend module owns a failing request.

## Health And Diagnostics

| Method | Route | Owner |
| --- | --- | --- |
| GET | `/api/health` | `HealthController` |
| GET | `/api/health/ready` | `HealthController` |
| GET | `/api/health/metrics` | `HealthController` |

## Auth

| Method | Route | Owner |
| --- | --- | --- |
| POST | `/api/auth/login` | `AuthController` |
| POST | `/api/auth/register` | `AuthController` |
| GET | `/api/auth/me` | `AuthController` |
| POST | `/api/auth/logout` | `AuthController` |
| POST | `/api/auth/forgot-password` | `AuthController` |
| POST | `/api/auth/reset-password` | `AuthController` |
| PATCH | `/api/auth/profile` | `AuthController` |
| PATCH | `/api/auth/password` | `AuthController` |

## Student Learning

| Method | Route | Owner |
| --- | --- | --- |
| GET | `/api/dashboard/student` | `DashboardController` |
| POST | `/api/dashboard/student/activity` | `DashboardController` |
| GET | `/api/courses/student` | `CoursesController` |
| GET | `/api/courses/student/:id` | `CoursesController` |
| PATCH | `/api/courses/student/lessons/:lessonId/progress` | `CoursesController` |
| GET | `/api/lessons/student` | `LessonsController` |
| GET | `/api/lessons/student/:id` | `LessonsController` |
| GET | `/api/ai-notes` | `AiNotesController` |
| GET | `/api/ai-notes/student/lesson/:lessonId` | `AiNotesController` |
| GET | `/api/study-bookmarks` | `StudyBookmarksController` |
| POST | `/api/study-bookmarks/toggle` | `StudyBookmarksController` |

## Quizzes And Results

| Method | Route | Owner |
| --- | --- | --- |
| GET | `/api/quiz-attempts/quizzes` | `QuizAttemptsController` |
| GET | `/api/quiz-attempts/quiz/:quizId` | `QuizAttemptsController` |
| POST | `/api/quiz-attempts/practice/:quizId/save` | `QuizAttemptsController` |
| POST | `/api/quiz-attempts/exam/:quizId/submit` | `QuizAttemptsController` |
| GET | `/api/quiz-attempts/practice-review/:quizId` | `QuizAttemptsController` |
| GET | `/api/results` | `ResultsController` |
| GET | `/api/results/:attemptId` | `ResultsController` |
| GET | `/api/results/review/:attemptId` | `ResultsController` |

## Admin Content

| Method | Route | Owner |
| --- | --- | --- |
| GET/POST/PATCH/DELETE | `/api/courses` | `CoursesController` |
| GET/POST/PATCH/DELETE | `/api/topics` | `TopicsController` |
| GET/POST/PATCH/DELETE | `/api/subtopics` | `SubtopicsController` |
| GET | `/api/lessons/meta` | `LessonsController` |
| GET | `/api/lessons/admin` | `LessonsController` |
| POST/PATCH/DELETE | `/api/lessons` | `LessonsController` |
| GET/POST/PATCH/DELETE | `/api/questions` | `QuestionsController` |
| POST | `/api/questions/import` | `QuestionsController` |
| GET | `/api/questions/export` | `QuestionsController` |
| POST | `/api/questions/keywords/bulk` | `QuestionsController` |
| POST | `/api/questions/bulk-delete` | `QuestionsController` |
| GET/POST/PATCH/DELETE | `/api/quizzes` | `QuizzesController` |
| GET/POST/PATCH/DELETE | `/api/papers` | `PapersController` |

## Admin Operations

| Method | Route | Owner |
| --- | --- | --- |
| GET | `/api/dashboard/admin` | `DashboardController` |
| GET/POST/PATCH/DELETE | `/api/users` | `UsersController` |
| GET | `/api/reports/admin` | `WorkspaceController` |
| GET/POST/PATCH | `/api/question-review/admin` | `WorkspaceController` |
| GET/POST/PATCH/DELETE | `/api/announcements/admin` | `WorkspaceController` |
| GET/PUT | `/api/settings/*` | `SettingsController` |
| GET | `/api/setup` | `SetupController` |

## Subscriptions

| Method | Route | Owner |
| --- | --- | --- |
| GET | `/api/plans` | `PlansController` |
| GET | `/api/plans/admin` | `PlansController` |
| GET/POST/PATCH/DELETE | `/api/plans/*` | `PlansController` |
| GET | `/api/subscriptions/me` | `SubscriptionsController` |
| GET | `/api/subscriptions/admin` | `SubscriptionsController` |
| GET | `/api/subscriptions/admin/requests` | `SubscriptionsController` |
| GET | `/api/subscriptions/admin/audit` | `SubscriptionsController` |
| POST | `/api/subscriptions/request` | `SubscriptionsController` |
| POST | `/api/subscriptions/manual-payment/request` | `SubscriptionsController` |
| POST | `/api/subscriptions/payhere/initiate` | `SubscriptionsController` |
| POST | `/api/subscriptions/payhere/notify` | `SubscriptionsController` |

## Workspace

| Method | Route | Owner |
| --- | --- | --- |
| GET | `/api/notifications` | `WorkspaceController` |
| POST | `/api/notifications/:id/read` | `WorkspaceController` |
| GET/POST/PATCH/DELETE | `/api/study-planner` | `WorkspaceController` |
| GET/PUT/POST/DELETE | `/api/theory-recap/*` | `TheoryRecapController` |

## Push

| Method | Route | Owner |
| --- | --- | --- |
| GET | `/api/push/vapid-public-key` | `PushNotificationsController` |
| GET/PUT | `/api/push/settings` | `PushNotificationsController` |
| POST/DELETE | `/api/push/subscribe` | `PushNotificationsController` |
| POST/DELETE | `/api/push/native-token` | `PushNotificationsController` |
| POST | `/api/push/admin/send` | `PushNotificationsController` |
