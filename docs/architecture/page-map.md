# LMS Page Map

This map keeps the current LMS routes understandable before we split the website, student app, native wrapper, and admin panel more deeply.

## Current Local URLs

| Target | Local URL | Build Output | Notes |
| --- | --- | --- | --- |
| Current website | `http://localhost/lms/` | `frontend/dist/` | XAMPP/Apache loads this build. |
| Student app preview | `http://localhost:5174/` | dev server | Future `app.mylms.com` or `learn.mylms.com`. |
| Native bundled app | local Capacitor bundle | `frontend/dist-capacitor/` | Copied into iOS/Android by `npx cap sync`. |
| Backend API | `http://localhost:3000/api` | `backend/dist/` | Used by web and native. |

## Public Website Pages

These pages are public and should stay simple and stable.

| Route | Page | Source |
| --- | --- | --- |
| `/` | Landing website | `frontend/src/pages/LandingPage.jsx` |
| `/login` | Login | `frontend/src/features/auth/LoginPage.jsx` |
| `/register` | Register | `frontend/src/features/auth/RegisterPage.jsx` |
| `/auth/login` | Login alias | `frontend/src/features/auth/LoginPage.jsx` |
| `/auth/register` | Register alias | `frontend/src/features/auth/RegisterPage.jsx` |
| `/auth/forgot-password` | Forgot password | `frontend/src/features/auth/ForgotPasswordPage.jsx` |
| `/auth/reset-password` | Reset password | `frontend/src/features/auth/ResetPasswordPage.jsx` |
| `/terms` | Terms | `frontend/src/pages/TermsPage.jsx` |
| `/privacy-policy` | Privacy policy | `frontend/src/pages/PrivacyPolicyPage.jsx` |

## Student App Pages

These are the important student LMS pages. For the future app subdomain, these should be the main app experience.

| Route | Page | Source |
| --- | --- | --- |
| `/dashboard` | Student dashboard | `frontend/src/features/student/dashboard/StudentDashboardPage.jsx` |
| `/pending` | Awaiting approval | `frontend/src/pages/DashboardPage.jsx` |
| `/profile` | Profile | `frontend/src/pages/ProfilePage.jsx` |
| `/courses` | Course list | `frontend/src/features/student/courses/StudentCoursesPage.jsx` |
| `/courses/:courseId` | Course detail | `frontend/src/features/student/courses/CourseDetailPage.jsx` |
| `/quizzes` | Practice quizzes | `frontend/src/features/student/quizzes/StudentQuizzesPage.jsx` |
| `/exams` | Exam mode quizzes | `frontend/src/features/student/quizzes/StudentQuizzesPage.jsx` |
| `/quizzes/:quizId` | Take quiz | `frontend/src/features/student/quizzes/TakeQuizPage.jsx` |
| `/quizzes/:quizId/practice-review` | Practice review | `frontend/src/features/student/results/PracticeReviewPage.jsx` |
| `/results` | Results list | `frontend/src/features/student/results/ResultsListPage.jsx` |
| `/results/:attemptId` | Result detail | `frontend/src/features/student/results/ResultPage.jsx` |
| `/review/:attemptId` | Review workspace | `frontend/src/features/student/results/ReviewPage.jsx` |
| `/ai-notes` | AI notes list | `frontend/src/features/student/ai-notes/AiNotesListPage.jsx` |
| `/ai-notes/:id` | AI note reader | `frontend/src/features/student/ai-notes/AiNotesPage.jsx` |
| `/study/lesson/:lessonId` | Lesson study reader | `frontend/src/features/student/ai-notes/AiNotesPage.jsx` |
| `/notes` | Student notes | `frontend/src/features/student/notes/StudentNotesPage.jsx` |
| `/flashcards` | Flashcards | `frontend/src/features/student/flashcards/StudentFlashcardsPage.jsx` |
| `/bookmarks` | Bookmarks | `frontend/src/features/student/bookmarks/BookmarksPage.jsx` |
| `/notifications` | Notifications | `frontend/src/features/student/notifications/StudentNotificationsPage.jsx` |
| `/planner` | Study planner | `frontend/src/features/student/planner/StudyPlannerPage.jsx` |
| `/doubts` | Student doubts | `frontend/src/features/student/doubts/StudentDoubtsPage.jsx` |
| `/subscriptions` | Billing/subscription | `frontend/src/features/student/billing/StudentBillingPage.jsx` |
| `/subscriptions/checkout/:planId` | Checkout | `frontend/src/features/student/billing/StudentCheckoutPage.jsx` |

## Admin Pages

Admin can remain web-only/local-first for now.

| Route | Page | Source |
| --- | --- | --- |
| `/admin/dashboard` | Admin dashboard | `frontend/src/features/admin/dashboard/AdminDashboardPage.jsx` |
| `/admin/courses` | Course management | `frontend/src/features/admin/courses/CoursesPage.jsx` |
| `/admin/structure` | LMS structure | `frontend/src/features/admin/structure/StructurePage.jsx` |
| `/admin/users` | User management | `frontend/src/features/admin/users/UsersPage.jsx` |
| `/admin/users/:userId` | Student detail | `frontend/src/features/admin/users/AdminStudentDetailPage.jsx` |
| `/admin/questions` | Question bank | `frontend/src/features/admin/questions/QuestionsPage.jsx` |
| `/admin/questions/bulk` | Bulk question input | `frontend/src/features/admin/questions/BulkQuestionInputPage.jsx` |
| `/admin/questions/review` | Question review | `frontend/src/features/admin/questions/QuestionReviewPage.jsx` |
| `/admin/quizzes` | Quiz management | `frontend/src/features/admin/quizzes/QuizzesPage.jsx` |
| `/admin/quizzes/new` | New quiz | `frontend/src/features/admin/quizzes/QuizBuilderPage.jsx` |
| `/admin/quizzes/:quizId/edit` | Edit quiz | `frontend/src/features/admin/quizzes/QuizBuilderPage.jsx` |
| `/admin/subscriptions` | Subscription admin | `frontend/src/features/admin/subscriptions/AdminSubscriptionsPage.jsx` |
| `/admin/ai-notes` | AI note admin list | `frontend/src/features/admin/ai-notes/AdminAiNotesListPage.jsx` |
| `/admin/ai-notes/:id` | AI note editor | `frontend/src/features/admin/ai-notes/AdminAiNotesEditorPage.jsx` |
| `/admin/announcements` | Announcements | `frontend/src/features/admin/announcements/AdminAnnouncementsPage.jsx` |
| `/admin/reports` | Reports | `frontend/src/features/admin/reports/AdminReportsPage.jsx` |
| `/admin/doubts` | Doubt management | `frontend/src/features/admin/doubts/AdminDoubtsPage.jsx` |
| `/admin/setup` | Setup | `frontend/src/features/admin/setup/AdminSetupPage.jsx` |
| `/admin/settings` | Settings | `frontend/src/features/admin/settings/AdminSettingsPage.jsx` |

## Dev / Demo Pages

These are useful during development but should not be part of the polished student app navigation.

| Route | Page | Source |
| --- | --- | --- |
| `/ai` | AI generator demo | `frontend/src/features/ai/AiQuizGeneratorPage.jsx` |
| `/ai/gemini` | Gemini generator demo | `frontend/src/features/ai/AiQuizGeneratorPage.jsx` |
| `/ai/chatgpt` | ChatGPT generator demo | `frontend/src/features/ai/AiQuizGeneratorPage.jsx` |
| `/lesson-notes-demo` | Lesson notes demo | `frontend/src/pages/LessonNotesDemoPage.jsx` |
| `/headache-notes-demo` | Headache notes demo | `frontend/src/pages/HeadacheNotesDemoPage.jsx` |
| `/pwa-preview` | PWA preview | `frontend/src/pages/PwaPreviewPage.jsx` |
| `/browser-test` | Browser test | `frontend/src/pages/BrowserTestPage.jsx` |
| `/gpt` | GPT test page | `frontend/src/pages/GptPage.jsx` |
| `/gemini` | Gemini test page | `frontend/src/pages/GeminiPage.jsx` |

## Compatibility Routes

These exist so old links do not break.

| Route | Purpose |
| --- | --- |
| `/app/*` | Old student app prefix. Keep temporarily, but prefer clean student routes like `/dashboard`. |
| `/student/*` | Old student prefix. Redirects by role. |
| `/billing` | Redirects to `/subscriptions`. |

## Folder Meaning

| Folder | Meaning |
| --- | --- |
| `frontend/src/pages/` | Public/shared/simple pages. |
| `frontend/src/features/auth/` | Auth pages and auth-specific UI. |
| `frontend/src/features/student/` | Student LMS product pages. |
| `frontend/src/features/admin/` | Admin-only management pages. |
| `frontend/src/features/ai/` | Standalone AI generator/demo area. |
| `frontend/src/components/layout/` | App shell, top bar, sidebar, bottom navigation. |
| `frontend/src/platform/` | Web/native/PWA platform detection and config. |

## Next Arrangement Step

After this map, the safest code cleanup is:

1. Keep current website routes working.
2. Move dev/demo routes out of the main student app navigation.
3. Create a dedicated student-app build mode.
4. Keep admin web-only.
5. Only then polish the student app UI for wrapping.
