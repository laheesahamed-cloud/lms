import { Suspense, lazy, memo } from 'react';
import { Navigate, createBrowserRouter, useLocation } from 'react-router-dom';
import { ProtectedRoute, PublicOnlyRoute } from '../components/auth/RouteGate.jsx';
import { AppRouteError } from './AppRouteError.jsx';
import { AppFrame } from './AppFrame.jsx';
import { PanelLayout } from '../components/layout/PanelLayout.jsx';
import { useAuthStore } from '../stores/authStore.js';
import { ui } from '../styles/tailwindClasses.js';
import { shouldPreloadRoutes } from '../utils/performanceProfile.js';

const APP_BASENAME = import.meta.env.VITE_APP_BASENAME || '/';
const LEGACY_BUILD_BASENAME = '/lms/frontend/dist';

function toAppPath(path) {
  if (APP_BASENAME === '/') {
    return path;
  }

  return `${APP_BASENAME}${path}`.replace(/\/{2,}/g, '/');
}

if (typeof window !== 'undefined') {
  const { pathname, search, hash } = window.location;

  if (hash.startsWith('#/')) {
    window.history.replaceState(null, '', `${toAppPath(hash.slice(1))}${search}`);
  } else if (pathname === LEGACY_BUILD_BASENAME || pathname.startsWith(`${LEGACY_BUILD_BASENAME}/`)) {
    const cleanPath = pathname.slice(LEGACY_BUILD_BASENAME.length) || '/';
    window.history.replaceState(null, '', `${toAppPath(cleanPath)}${search}${hash}`);
  }
}

function lazyNamed(loader, exportName) {
  const Component = lazy(() =>
    loader().then((module) => ({ default: module[exportName] }))
  );
  Component.preload = loader;
  return Component;
}

const LandingPage  = lazyNamed(() => import('../pages/LandingPage.jsx'),               'LandingPage');
const LoginPage    = lazyNamed(() => import('../features/auth/LoginPage.jsx'),          'LoginPage');
const RegisterPage = lazyNamed(() => import('../features/auth/RegisterPage.jsx'),       'RegisterPage');
const ForgotPasswordPage = lazyNamed(() => import('../features/auth/ForgotPasswordPage.jsx'), 'ForgotPasswordPage');
const ResetPasswordPage = lazyNamed(() => import('../features/auth/ResetPasswordPage.jsx'), 'ResetPasswordPage');
const TermsPage    = lazyNamed(() => import('../pages/TermsPage.jsx'),                  'TermsPage');
const PrivacyPolicyPage = lazyNamed(() => import('../pages/PrivacyPolicyPage.jsx'),     'PrivacyPolicyPage');

const CoursesPage = lazyNamed(() => import('../features/admin/courses/CoursesPage.jsx'), 'CoursesPage');
const AdminDashboardPage = lazyNamed(() => import('../features/admin/dashboard/AdminDashboardPage.jsx'), 'AdminDashboardPage');
const QuizzesPage = lazyNamed(() => import('../features/admin/quizzes/QuizzesPage.jsx'), 'QuizzesPage');
const QuizBuilderPage = lazyNamed(() => import('../features/admin/quizzes/QuizBuilderPage.jsx'), 'QuizBuilderPage');
const AdminSubscriptionsPage = lazyNamed(() => import('../features/admin/subscriptions/AdminSubscriptionsPage.jsx'), 'AdminSubscriptionsPage');
const QuestionsPage = lazyNamed(() => import('../features/admin/questions/QuestionsPage.jsx'), 'QuestionsPage');
const BulkQuestionInputPage = lazyNamed(() => import('../features/admin/questions/BulkQuestionInputPage.jsx'), 'BulkQuestionInputPage');
const StructurePage = lazyNamed(() => import('../features/admin/structure/StructurePage.jsx'), 'StructurePage');
const UsersPage = lazyNamed(() => import('../features/admin/users/UsersPage.jsx'), 'UsersPage');
const AdminSettingsPage = lazyNamed(() => import('../features/admin/settings/AdminSettingsPage.jsx'), 'AdminSettingsPage');
const StudentDashboardPage = lazyNamed(() => import('../features/student/dashboard/StudentDashboardPage.jsx'), 'StudentDashboardPage');
const StudentCoursesPage = lazyNamed(() => import('../features/student/courses/StudentCoursesPage.jsx'), 'StudentCoursesPage');
const CourseDetailPage = lazyNamed(() => import('../features/student/courses/CourseDetailPage.jsx'), 'CourseDetailPage');
const StudentBillingPage = lazyNamed(() => import('../features/student/billing/StudentBillingPage.jsx'), 'StudentBillingPage');
const StudentCheckoutPage = lazyNamed(() => import('../features/student/billing/StudentCheckoutPage.jsx'), 'StudentCheckoutPage');
const BookmarksPage = lazyNamed(() => import('../features/student/bookmarks/BookmarksPage.jsx'), 'BookmarksPage');
const StudentFlashcardsPage = lazyNamed(() => import('../features/student/flashcards/StudentFlashcardsPage.jsx'), 'StudentFlashcardsPage');
const StudentNotesPage = lazyNamed(() => import('../features/student/notes/StudentNotesPage.jsx'), 'StudentNotesPage');
const AiNotesPage = lazyNamed(() => import('../features/student/ai-notes/AiNotesPage.jsx'), 'AiNotesPage');
const AiNotesListPage = lazyNamed(() => import('../features/student/ai-notes/AiNotesListPage.jsx'), 'AiNotesListPage');
const AdminAiNotesListPage = lazyNamed(() => import('../features/admin/ai-notes/AdminAiNotesListPage.jsx'), 'AdminAiNotesListPage');
const AdminAiNotesEditorPage = lazyNamed(() => import('../features/admin/ai-notes/AdminAiNotesEditorPage.jsx'), 'AdminAiNotesEditorPage');
const StudentQuizzesPage = lazyNamed(() => import('../features/student/quizzes/StudentQuizzesPage.jsx'), 'StudentQuizzesPage');
const TakeQuizPage = lazyNamed(() => import('../features/student/quizzes/TakeQuizPage.jsx'), 'TakeQuizPage');
const PracticeReviewPage = lazyNamed(() => import('../features/student/results/PracticeReviewPage.jsx'), 'PracticeReviewPage');
const ResultPage = lazyNamed(() => import('../features/student/results/ResultPage.jsx'), 'ResultPage');
const ResultsListPage = lazyNamed(() => import('../features/student/results/ResultsListPage.jsx'), 'ResultsListPage');
const ReviewPage = lazyNamed(() => import('../features/student/results/ReviewPage.jsx'), 'ReviewPage');
const DashboardPage = lazyNamed(() => import('../pages/DashboardPage.jsx'), 'DashboardPage');
const NotFoundPage = lazyNamed(() => import('../pages/NotFoundPage.jsx'), 'NotFoundPage');
const AiQuizGeneratorPage = lazyNamed(() => import('../features/ai/AiQuizGeneratorPage.jsx'), 'AiQuizGeneratorPage');
const LessonNotesDemoPage = lazyNamed(() => import('../pages/LessonNotesDemoPage.jsx'), 'LessonNotesDemoPage');
const HeadacheNotesDemoPage = lazyNamed(() => import('../pages/HeadacheNotesDemoPage.jsx'), 'HeadacheNotesDemoPage');
const PwaPreviewPage = lazyNamed(() => import('../pages/PwaPreviewPage.jsx'), 'PwaPreviewPage');
const BrowserTestPage = lazyNamed(() => import('../pages/BrowserTestPage.jsx'), 'BrowserTestPage');
const GptPage = lazyNamed(() => import('../pages/GptPage.jsx'), 'GptPage');
const GeminiPage = lazyNamed(() => import('../pages/GeminiPage.jsx'), 'GeminiPage');
const ProfilePage = lazyNamed(() => import('../pages/ProfilePage.jsx'), 'ProfilePage');

const commonRoutePreloaders = new Map([
  ['/profile', ProfilePage.preload],
  ['/ai/gemini', AiQuizGeneratorPage.preload],
  ['/ai/chatgpt', AiQuizGeneratorPage.preload],
]);

const roleRoutePreloaders = {
  admin: new Map([
    ['/dashboard', AdminDashboardPage.preload],
    ['/courses', CoursesPage.preload],
    ['/structure', StructurePage.preload],
    ['/questions', QuestionsPage.preload],
    ['/questions/bulk', BulkQuestionInputPage.preload],
    ['/quizzes', QuizzesPage.preload],
    ['/quizzes/new', QuizBuilderPage.preload],
    ['/subscriptions', AdminSubscriptionsPage.preload],
    ['/ai-notes', AdminAiNotesListPage.preload],
    ['/users', UsersPage.preload],
    ['/settings', AdminSettingsPage.preload],
  ]),
  student: new Map([
    ['/dashboard', StudentDashboardPage.preload],
    ['/courses', StudentCoursesPage.preload],
    ['/ai-notes', AiNotesListPage.preload],
    ['/flashcards', StudentFlashcardsPage.preload],
    ['/quizzes', StudentQuizzesPage.preload],
    ['/exams', StudentQuizzesPage.preload],
    ['/results', ResultsListPage.preload],
    ['/bookmarks', BookmarksPage.preload],
    ['/subscriptions', StudentBillingPage.preload],
  ]),
};

export function preloadRouteByPath(path, role = useAuthStore.getState().user?.role) {
  if (!path || !shouldPreloadRoutes()) {
    return;
  }

  const preload = roleRoutePreloaders[role]?.get(path) || commonRoutePreloaders.get(path);
  if (typeof preload === 'function') {
    preload().catch(() => {});
  }
}

function RouteFallback() {
  return (
    <main className={ui.screenShell} aria-busy="true">
      <div className={ui.routeSkeleton}>
        <div className={ui.routeSkeletonTop}>
          <span className={ui.shimmer} />
          <span className={ui.shimmer} />
          <span className={ui.shimmer} />
        </div>
        <div className={ui.routeSkeletonGrid}>
          {[1, 2, 3].map((item) => (
            <div className={ui.routeSkeletonCard} key={item}>
              <span className={ui.shimmer} />
              <span className={ui.shimmer} />
              <span className={ui.shimmer} />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

const RouteReveal = memo(function RouteReveal({ children }) {
  const location = useLocation();
  return (
    <div className="motion-smooth animate-panelRouteFade" key={location.pathname}>
      {children}
    </div>
  );
});

function withSuspense(element) {
  return (
    <Suspense fallback={<RouteFallback />}>
      <RouteReveal>{element}</RouteReveal>
    </Suspense>
  );
}

function RoleSwitch({ admin, student }) {
  const user = useAuthStore((state) => state.user);
  return user?.role === 'admin' ? admin : student;
}

function LegacyRoleRedirect() {
  const location = useLocation();
  const cleanPath = location.pathname.replace(/^\/(?:admin|student)(?=\/|$)/, '') || '/dashboard';
  return <Navigate to={`${cleanPath}${location.search}${location.hash}`} replace />;
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppFrame />,
    errorElement: <AppRouteError />,
    children: [
      {
        index: true,
        element: withSuspense(<LandingPage />),
      },
      {
        path: 'login',
        element: withSuspense(
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        ),
      },
      {
        path: 'register',
        element: withSuspense(
          <PublicOnlyRoute>
            <RegisterPage />
          </PublicOnlyRoute>
        ),
      },
      {
        path: 'auth/login',
        element: withSuspense(
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        ),
      },
      {
        path: 'auth/register',
        element: withSuspense(
          <PublicOnlyRoute>
            <RegisterPage />
          </PublicOnlyRoute>
        ),
      },
      {
        path: 'auth/forgot-password',
        element: withSuspense(
          <PublicOnlyRoute>
            <ForgotPasswordPage />
          </PublicOnlyRoute>
        ),
      },
      {
        path: 'auth/reset-password',
        element: withSuspense(
          <PublicOnlyRoute>
            <ResetPasswordPage />
          </PublicOnlyRoute>
        ),
      },
      {
        path: 'terms',
        element: withSuspense(<TermsPage />),
      },
      {
        path: 'privacy-policy',
        element: withSuspense(<PrivacyPolicyPage />),
      },
      {
        path: 'ai',
        element: withSuspense(
          <AiQuizGeneratorPage
            engineKey="gemini"
            generatorLabel="Gemini"
            heroEyebrow="Standalone Gemini Route"
            heroTitle="Gemini Quiz Generator"
            heroDescription="Generate draft SBA and True/False questions with the fixed Gemini API, then review and save them into the LMS question bank."
          />
        ),
      },
      {
        path: 'ai/gemini',
        element: withSuspense(
          <AiQuizGeneratorPage
            engineKey="gemini"
            generatorLabel="Gemini"
            heroEyebrow="Standalone Gemini Route"
            heroTitle="Gemini Quiz Generator"
            heroDescription="Generate draft SBA and True/False questions with the fixed Gemini API, then review and save them into the LMS question bank."
          />
        ),
      },
      {
        path: 'ai/chatgpt',
        element: withSuspense(
          <AiQuizGeneratorPage
            engineKey="openai"
            generatorLabel="ChatGPT"
            heroEyebrow="Standalone ChatGPT Route"
            heroTitle="ChatGPT Quiz Generator"
            heroDescription="Generate draft SBA and True/False questions with the fixed ChatGPT / OpenAI API, then review and save them into the LMS question bank."
          />
        ),
      },
      {
        path: 'lesson-notes-demo',
        element: withSuspense(<LessonNotesDemoPage />),
      },
      {
        path: 'headache-notes-demo',
        element: withSuspense(<HeadacheNotesDemoPage />),
      },
      {
        path: 'pwa-preview',
        element: withSuspense(<PwaPreviewPage />),
      },
      {
        path: 'browser-test',
        element: withSuspense(<BrowserTestPage />),
      },
      {
        path: 'gpt',
        element: withSuspense(<GptPage />),
      },
      {
        path: 'gemini',
        element: withSuspense(<GeminiPage />),
      },
      {
        element: <PanelLayout />,
        children: [
          {
            path: 'dashboard',
            element: (
              <ProtectedRoute>
                <RoleSwitch
                  admin={withSuspense(<AdminDashboardPage />)}
                  student={withSuspense(<StudentDashboardPage />)}
                />
              </ProtectedRoute>
            ),
          },
          {
            path: 'pending',
            element: (
              <ProtectedRoute role="student" allowPending>
                {withSuspense(
                  <DashboardPage
                    title="Awaiting approval"
                    subtitle="This page mirrors the current pending flow for newly registered student accounts."
                    cards={[
                      { kicker: 'Pending', title: 'Approval required', text: 'Students stay here until an admin marks the account active.' },
                    ]}
                  />
                )}
              </ProtectedRoute>
            ),
          },
          {
            path: 'profile',
            element: (
              <ProtectedRoute>
                {withSuspense(<ProfilePage />)}
              </ProtectedRoute>
            ),
          },
          {
            path: 'courses',
            element: (
              <ProtectedRoute>
                <RoleSwitch
                  admin={withSuspense(<CoursesPage />)}
                  student={withSuspense(<StudentCoursesPage />)}
                />
              </ProtectedRoute>
            ),
          },
          {
            path: 'courses/:courseId',
            element: (
              <ProtectedRoute role="student">
                {withSuspense(<CourseDetailPage />)}
              </ProtectedRoute>
            ),
          },
          {
            path: 'structure',
            element: (
              <ProtectedRoute role="admin">
                {withSuspense(<StructurePage />)}
              </ProtectedRoute>
            ),
          },
          {
            path: 'users',
            element: (
              <ProtectedRoute role="admin">
                {withSuspense(<UsersPage />)}
              </ProtectedRoute>
            ),
          },
          {
            path: 'questions',
            element: (
              <ProtectedRoute role="admin">
                {withSuspense(<QuestionsPage />)}
              </ProtectedRoute>
            ),
          },
          {
            path: 'questions/bulk',
            element: (
              <ProtectedRoute role="admin">
                {withSuspense(<BulkQuestionInputPage />)}
              </ProtectedRoute>
            ),
          },
          {
            path: 'quizzes',
            element: (
              <ProtectedRoute>
                <RoleSwitch
                  admin={withSuspense(<QuizzesPage />)}
                  student={withSuspense(<StudentQuizzesPage pageMode="practice" />)}
                />
              </ProtectedRoute>
            ),
          },
          {
            path: 'exams',
            element: (
              <ProtectedRoute role="student">
                {withSuspense(<StudentQuizzesPage pageMode="exam" />)}
              </ProtectedRoute>
            ),
          },
          {
            path: 'quizzes/new',
            element: (
              <ProtectedRoute role="admin">
                {withSuspense(<QuizBuilderPage />)}
              </ProtectedRoute>
            ),
          },
          {
            path: 'quizzes/:quizId/edit',
            element: (
              <ProtectedRoute role="admin">
                {withSuspense(<QuizBuilderPage />)}
              </ProtectedRoute>
            ),
          },
          {
            path: 'quizzes/:quizId/practice-review',
            element: (
              <ProtectedRoute role="student">
                {withSuspense(<PracticeReviewPage />)}
              </ProtectedRoute>
            ),
          },
          {
            path: 'quizzes/:quizId',
            element: (
              <ProtectedRoute role="student">
                {withSuspense(<TakeQuizPage />)}
              </ProtectedRoute>
            ),
          },
          {
            path: 'subscriptions/checkout/:planId',
            element: (
              <ProtectedRoute role="student">
                {withSuspense(<StudentCheckoutPage />)}
              </ProtectedRoute>
            ),
          },
          {
            path: 'subscriptions',
            element: (
              <ProtectedRoute>
                <RoleSwitch
                  admin={withSuspense(<AdminSubscriptionsPage />)}
                  student={withSuspense(<StudentBillingPage />)}
                />
              </ProtectedRoute>
            ),
          },
          {
            path: 'billing',
            element: <Navigate to="/subscriptions" replace />,
          },
          {
            path: 'bookmarks',
            element: (
              <ProtectedRoute role="student">
                {withSuspense(<BookmarksPage />)}
              </ProtectedRoute>
            ),
          },
          {
            path: 'flashcards',
            element: (
              <ProtectedRoute role="student">
                {withSuspense(<StudentFlashcardsPage />)}
              </ProtectedRoute>
            ),
          },
          {
            path: 'notes',
            element: (
              <ProtectedRoute role="student">
                {withSuspense(<StudentNotesPage />)}
              </ProtectedRoute>
            ),
          },
          {
            path: 'study/lesson/:lessonId',
            element: (
              <ProtectedRoute role="student">
                {withSuspense(<AiNotesPage />)}
              </ProtectedRoute>
            ),
          },
          {
            path: 'ai-notes',
            element: (
              <ProtectedRoute>
                <RoleSwitch
                  admin={withSuspense(<AdminAiNotesListPage />)}
                  student={withSuspense(<AiNotesListPage />)}
                />
              </ProtectedRoute>
            ),
          },
          {
            path: 'ai-notes/:id',
            element: (
              <ProtectedRoute>
                <RoleSwitch
                  admin={withSuspense(<AdminAiNotesEditorPage />)}
                  student={withSuspense(<AiNotesPage />)}
                />
              </ProtectedRoute>
            ),
          },
          {
            path: 'results',
            element: (
              <ProtectedRoute role="student">
                {withSuspense(<ResultsListPage />)}
              </ProtectedRoute>
            ),
          },
          {
            path: 'results/:attemptId',
            element: (
              <ProtectedRoute role="student">
                {withSuspense(<ResultPage />)}
              </ProtectedRoute>
            ),
          },
          {
            path: 'review/:attemptId',
            element: (
              <ProtectedRoute role="student">
                {withSuspense(<ReviewPage />)}
              </ProtectedRoute>
            ),
          },
          {
            path: 'settings',
            element: (
              <ProtectedRoute role="admin">
                {withSuspense(<AdminSettingsPage />)}
              </ProtectedRoute>
            ),
          },
        ],
      },
      {
        path: 'admin',
        element: <LegacyRoleRedirect />,
      },
      {
        path: 'admin/*',
        element: <LegacyRoleRedirect />,
      },
      {
        path: 'student',
        element: <LegacyRoleRedirect />,
      },
      {
        path: 'student/*',
        element: <LegacyRoleRedirect />,
      },
      {
        path: '*',
        element: withSuspense(<NotFoundPage />),
      },
    ],
  },
], {
  basename: APP_BASENAME === '/' ? undefined : APP_BASENAME,
});
