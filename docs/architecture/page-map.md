# LMS Page Map

This map documents the current frontend surface split.

## Local Targets

| Target | Local URL | Build Output | Notes |
| --- | --- | --- | --- |
| Public website | `http://localhost/lms/` | `frontend/dist/` | Local stand-in for `domain.com`. |
| Student app | `http://localhost/lms/app/dashboard` | `frontend/dist/` | Local stand-in for `app.mydomain.com`. |
| Native bundled app | local Capacitor bundle | `frontend/dist-capacitor/` | Copied into iOS/Android by Capacitor sync. |
| Backend API | `http://localhost:3000/api` | `backend/dist/` | Used by website, app, admin, and native. |

## Surface Folders

| Surface | Purpose | Source |
| --- | --- | --- |
| Website | Public `domain.com` pages, auth entry, policy pages, and AI generator entry points. | `frontend/src/surfaces/website/` |
| App | Student `app.mydomain.com` and native-app pages. | `frontend/src/surfaces/app/` |
| Admin | Admin console pages. | `frontend/src/surfaces/admin/` |
| Shared | Cross-surface API, layout, auth, platform, styles, stores, utilities. | `frontend/src/shared/` |
| Runtime | React app bootstrap, router, providers, error boundaries. | `frontend/src/app/` |

## Public Website Routes

| Route | Page | Source |
| --- | --- | --- |
| `/` | Landing website | `frontend/src/surfaces/website/pages/LandingPage.jsx` |
| `/login` | Login | `frontend/src/surfaces/website/auth/LoginPage.jsx` |
| `/register` | Register | `frontend/src/surfaces/website/auth/RegisterPage.jsx` |
| `/auth/login` | Login alias | `frontend/src/surfaces/website/auth/LoginPage.jsx` |
| `/auth/register` | Register alias | `frontend/src/surfaces/website/auth/RegisterPage.jsx` |
| `/auth/forgot-password` | Forgot password | `frontend/src/surfaces/website/auth/ForgotPasswordPage.jsx` |
| `/auth/reset-password` | Reset password | `frontend/src/surfaces/website/auth/ResetPasswordPage.jsx` |
| `/terms` | Terms | `frontend/src/surfaces/website/pages/TermsPage.jsx` |
| `/privacy-policy` | Privacy policy | `frontend/src/surfaces/website/pages/PrivacyPolicyPage.jsx` |

## Student App Routes

Student app routes exist under `/app/*` and are intended to map to `app.mydomain.com` in production.

| Route | Page | Source |
| --- | --- | --- |
| `/app/dashboard` | Student dashboard | `frontend/src/surfaces/app/student/dashboard/StudentDashboardPage.jsx` |
| `/app/pending` | Awaiting approval | `frontend/src/shared/pages/DashboardPage.jsx` |
| `/app/profile` | Profile | `frontend/src/shared/account/ProfilePage.jsx` |
| `/app/courses` | Course list | `frontend/src/surfaces/app/student/courses/StudentCoursesPage.jsx` |
| `/app/courses/:courseId` | Course detail | `frontend/src/surfaces/app/student/courses/CourseDetailPage.jsx` |
| `/app/quizzes` | Practice quizzes | `frontend/src/surfaces/app/student/quizzes/StudentQuizzesPage.jsx` |
| `/app/exams` | Exam mode quizzes | `frontend/src/surfaces/app/student/quizzes/StudentQuizzesPage.jsx` |
| `/app/quizzes/:quizId` | Take quiz | `frontend/src/surfaces/app/student/quizzes/TakeQuizPage.jsx` |
| `/app/quizzes/:quizId/practice-review` | Practice review | `frontend/src/surfaces/app/student/results/PracticeReviewPage.jsx` |
| `/app/results` | Results list | `frontend/src/surfaces/app/student/results/ResultsListPage.jsx` |
| `/app/results/:attemptId` | Result detail | `frontend/src/surfaces/app/student/results/ResultPage.jsx` |
| `/app/review/:attemptId` | Review workspace | `frontend/src/surfaces/app/student/results/ReviewPage.jsx` |
| `/app/ai-notes` | AI notes list | `frontend/src/surfaces/app/student/ai-notes/AiNotesListPage.jsx` |
| `/app/ai-notes/:id` | AI note reader | `frontend/src/surfaces/app/student/ai-notes/AiNotesPage.jsx` |
| `/app/study/lesson/:lessonId` | Lesson study reader | `frontend/src/surfaces/app/student/ai-notes/AiNotesPage.jsx` |
| `/app/notes` | Student notes | `frontend/src/surfaces/app/student/notes/StudentNotesPage.jsx` |
| `/app/flashcards` | Flashcards | `frontend/src/surfaces/app/student/flashcards/StudentFlashcardsPage.jsx` |
| `/app/bookmarks` | Bookmarks | `frontend/src/surfaces/app/student/bookmarks/BookmarksPage.jsx` |
| `/app/notifications` | Notifications | `frontend/src/surfaces/app/student/notifications/StudentNotificationsPage.jsx` |
| `/app/planner` | Study planner | `frontend/src/surfaces/app/student/planner/StudyPlannerPage.jsx` |
| `/app/subscriptions` | Billing/subscription | `frontend/src/surfaces/app/student/billing/StudentBillingPage.jsx` |
| `/app/subscriptions/checkout/:planId` | Checkout | `frontend/src/surfaces/app/student/billing/StudentCheckoutPage.jsx` |

## Admin Routes

| Route | Page | Source |
| --- | --- | --- |
| `/admin/dashboard` | Admin dashboard | `frontend/src/surfaces/admin/pages/dashboard/AdminDashboardPage.jsx` |
| `/admin/courses` | Course management | `frontend/src/surfaces/admin/pages/courses/CoursesPage.jsx` |
| `/admin/structure` | LMS structure | `frontend/src/surfaces/admin/pages/structure/StructurePage.jsx` |
| `/admin/users` | User management | `frontend/src/surfaces/admin/pages/users/UsersPage.jsx` |
| `/admin/users/:userId` | Student detail | `frontend/src/surfaces/admin/pages/users/AdminStudentDetailPage.jsx` |
| `/admin/questions` | Question bank | `frontend/src/surfaces/admin/pages/questions/QuestionsPage.jsx` |
| `/admin/questions/bulk` | Bulk question input | `frontend/src/surfaces/admin/pages/questions/BulkQuestionInputPage.jsx` |
| `/admin/questions/review` | Question review | `frontend/src/surfaces/admin/pages/questions/QuestionReviewPage.jsx` |
| `/admin/quizzes` | Quiz management | `frontend/src/surfaces/admin/pages/quizzes/QuizzesPage.jsx` |
| `/admin/quizzes/new` | New quiz | `frontend/src/surfaces/admin/pages/quizzes/QuizBuilderPage.jsx` |
| `/admin/quizzes/:quizId/edit` | Edit quiz | `frontend/src/surfaces/admin/pages/quizzes/QuizBuilderPage.jsx` |
| `/admin/subscriptions` | Subscription admin | `frontend/src/surfaces/admin/pages/subscriptions/AdminSubscriptionsPage.jsx` |
| `/admin/ai-notes` | AI note admin list | `frontend/src/surfaces/admin/pages/ai-notes/AdminAiNotesListPage.jsx` |
| `/admin/ai-notes/:id` | AI note editor | `frontend/src/surfaces/admin/pages/ai-notes/AdminAiNotesEditorPage.jsx` |
| `/admin/announcements` | Announcements | `frontend/src/surfaces/admin/pages/announcements/AdminAnnouncementsPage.jsx` |
| `/admin/reports` | Reports | `frontend/src/surfaces/admin/pages/reports/AdminReportsPage.jsx` |
| `/admin/setup` | Setup | `frontend/src/surfaces/admin/pages/setup/AdminSetupPage.jsx` |
| `/admin/settings` | Settings | `frontend/src/surfaces/admin/pages/settings/AdminSettingsPage.jsx` |

## AI Website Routes

| Route | Page | Source |
| --- | --- | --- |
| `/ai` | AI generator | `frontend/src/surfaces/website/ai/AiQuizGeneratorPage.jsx` |
| `/ai/gemini` | Gemini generator | `frontend/src/surfaces/website/ai/AiQuizGeneratorPage.jsx` |
| `/ai/chatgpt` | ChatGPT generator | `frontend/src/surfaces/website/ai/AiQuizGeneratorPage.jsx` |

## Compatibility Routes

These exist so old links do not break.

| Route | Purpose |
| --- | --- |
| `/dashboard`, `/courses`, etc. | Legacy role-switched routes that redirect or render the appropriate role page. |
| `/student/*` | Old student prefix. Redirects by role. |
| `/billing` | Redirects to `/subscriptions`. |
