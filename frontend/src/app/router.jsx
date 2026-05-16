import { Suspense, lazy, memo, useLayoutEffect } from 'react';
import { Navigate, createBrowserRouter, useLocation } from 'react-router-dom';
import { ProtectedRoute, PublicOnlyRoute } from '../components/auth/RouteGate.jsx';
import { AppRouteError } from './AppRouteError.jsx';
import { AppErrorBoundary } from './AppErrorBoundary.jsx';
import { AppFrame } from './AppFrame.jsx';
import { PanelLayout } from '../components/layout/PanelLayout.jsx';
import { useAuthStore } from '../stores/authStore.js';
import { ui } from '../styles/tailwindClasses.js';
import { shouldPreloadRoutes } from '../utils/performanceProfile.js';
import { detectPlatform } from '../platform/detect.js';
import { getRouterBasename, normalizeLegacyBuildPath } from '../platform/config.js';

const PLATFORM = detectPlatform();
const ROUTER_BASENAME = getRouterBasename(PLATFORM);

normalizeLegacyBuildPath(PLATFORM);

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
const QuestionReviewPage = lazyNamed(() => import('../features/admin/questions/QuestionReviewPage.jsx'), 'QuestionReviewPage');
const StructurePage = lazyNamed(() => import('../features/admin/structure/StructurePage.jsx'), 'StructurePage');
const UsersPage = lazyNamed(() => import('../features/admin/users/UsersPage.jsx'), 'UsersPage');
const AdminStudentDetailPage = lazyNamed(() => import('../features/admin/users/AdminStudentDetailPage.jsx'), 'AdminStudentDetailPage');
const AdminSettingsPage = lazyNamed(() => import('../features/admin/settings/AdminSettingsPage.jsx'), 'AdminSettingsPage');
const AdminSetupPage = lazyNamed(() => import('../features/admin/setup/AdminSetupPage.jsx'), 'AdminSetupPage');
const AdminAnnouncementsPage = lazyNamed(() => import('../features/admin/announcements/AdminAnnouncementsPage.jsx'), 'AdminAnnouncementsPage');
const AdminReportsPage = lazyNamed(() => import('../features/admin/reports/AdminReportsPage.jsx'), 'AdminReportsPage');
const AdminDoubtsPage = lazyNamed(() => import('../features/admin/doubts/AdminDoubtsPage.jsx'), 'AdminDoubtsPage');
const StudentDashboardPage = lazyNamed(() => import('../features/student/dashboard/StudentDashboardPage.jsx'), 'StudentDashboardPage');
const StudentCoursesPage = lazyNamed(() => import('../features/student/courses/StudentCoursesPage.jsx'), 'StudentCoursesPage');
const CourseDetailPage = lazyNamed(() => import('../features/student/courses/CourseDetailPage.jsx'), 'CourseDetailPage');
const StudentBillingPage = lazyNamed(() => import('../features/student/billing/StudentBillingPage.jsx'), 'StudentBillingPage');
const StudentCheckoutPage = lazyNamed(() => import('../features/student/billing/StudentCheckoutPage.jsx'), 'StudentCheckoutPage');
const BookmarksPage = lazyNamed(() => import('../features/student/bookmarks/BookmarksPage.jsx'), 'BookmarksPage');
const StudentNotificationsPage = lazyNamed(() => import('../features/student/notifications/StudentNotificationsPage.jsx'), 'StudentNotificationsPage');
const StudyPlannerPage = lazyNamed(() => import('../features/student/planner/StudyPlannerPage.jsx'), 'StudyPlannerPage');
const StudentDoubtsPage = lazyNamed(() => import('../features/student/doubts/StudentDoubtsPage.jsx'), 'StudentDoubtsPage');
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
    ['/questions/review', QuestionReviewPage.preload],
    ['/quizzes', QuizzesPage.preload],
    ['/quizzes/new', QuizBuilderPage.preload],
    ['/subscriptions', AdminSubscriptionsPage.preload],
    ['/ai-notes', AdminAiNotesListPage.preload],
    ['/users', UsersPage.preload],
    ['/announcements', AdminAnnouncementsPage.preload],
    ['/reports', AdminReportsPage.preload],
    ['/doubts', AdminDoubtsPage.preload],
    ['/setup', AdminSetupPage.preload],
    ['/settings', AdminSettingsPage.preload],
  ]),
  student: new Map([
    ['/dashboard', StudentDashboardPage.preload],
    ['/courses', StudentCoursesPage.preload],
    ['/notifications', StudentNotificationsPage.preload],
    ['/planner', StudyPlannerPage.preload],
    ['/doubts', StudentDoubtsPage.preload],
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
  if (!path || (!PLATFORM.isNative && !shouldPreloadRoutes())) {
    return;
  }

  const cleanPath = path.replace(/^\/(?:admin|app|student)(?=\/|$)/, '') || '/dashboard';
  const preload = roleRoutePreloaders[role]?.get(cleanPath) || commonRoutePreloaders.get(cleanPath);
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

  useLayoutEffect(() => {
    if (typeof document === 'undefined') return undefined;
    let cancelled = false;
    const raf = window.requestAnimationFrame(() => {
      if (cancelled) return;
      window.__lmsRouteReady = true;
      document.dispatchEvent(new CustomEvent('lms:route-ready', {
        detail: { pathname: location.pathname },
      }));
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
    };
  }, [location.pathname]);

  return (
    <div className="lms-route-reveal motion-smooth animate-panelRouteFade" key={location.pathname}>
      {children}
    </div>
  );
});

function withSuspense(element) {
  return (
    <AppErrorBoundary>
      <Suspense fallback={<RouteFallback />}>
        <RouteReveal>{element}</RouteReveal>
      </Suspense>
    </AppErrorBoundary>
  );
}

function RoleSwitch({ admin, student }) {
  const user = useAuthStore((state) => state.user);
  return user?.role === 'admin' ? admin : student;
}

function roleHomePath(user) {
  if (user?.role === 'admin') return '/admin/dashboard';
  if (user?.role === 'student' && user.status !== 'active') return '/pending';
  return '/dashboard';
}

function prefixRolePath(path, user) {
  const normalized = path && path !== '/' ? path : '/dashboard';
  const cleanPath = normalized.replace(/^\/(?:admin|student|app)(?=\/|$)/, '') || '/dashboard';
  const prefix = user?.role === 'admin' ? '/admin' : '';
  return `${prefix}${cleanPath}`;
}

function LegacyRoleRedirect({ targetPath = '' }) {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrating = useAuthStore((state) => state.isHydrating);
  const location = useLocation();

  if (isHydrating) return <RouteFallback />;

  if (!isAuthenticated || !user) {
    const from = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/auth/login?from=${encodeURIComponent(from)}`} replace />;
  }

  return <Navigate to={`${prefixRolePath(targetPath || location.pathname, user)}${location.search}${location.hash}`} replace />;
}

function RoleHomeRedirect() {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrating = useAuthStore((state) => state.isHydrating);
  const location = useLocation();

  if (isHydrating) return <RouteFallback />;

  if (!isAuthenticated || !user) {
    const from = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/auth/login?from=${encodeURIComponent(from)}`} replace />;
  }

  return <Navigate to={roleHomePath(user)} replace />;
}

const adminPanelRoutes = [
  {
    index: true,
    element: <Navigate to="dashboard" replace />,
  },
  {
    path: 'dashboard',
    element: withSuspense(<AdminDashboardPage />),
  },
  {
    path: 'profile',
    element: withSuspense(<ProfilePage />),
  },
  {
    path: 'courses',
    element: withSuspense(<CoursesPage />),
  },
  {
    path: 'structure',
    element: withSuspense(<StructurePage />),
  },
  {
    path: 'users',
    element: withSuspense(<UsersPage />),
  },
  {
    path: 'users/:userId',
    element: withSuspense(<AdminStudentDetailPage />),
  },
  {
    path: 'questions',
    element: withSuspense(<QuestionsPage />),
  },
  {
    path: 'questions/bulk',
    element: withSuspense(<BulkQuestionInputPage />),
  },
  {
    path: 'questions/review',
    element: withSuspense(<QuestionReviewPage />),
  },
  {
    path: 'quizzes',
    element: withSuspense(<QuizzesPage />),
  },
  {
    path: 'quizzes/new',
    element: withSuspense(<QuizBuilderPage />),
  },
  {
    path: 'quizzes/:quizId/edit',
    element: withSuspense(<QuizBuilderPage />),
  },
  {
    path: 'subscriptions',
    element: withSuspense(<AdminSubscriptionsPage />),
  },
  {
    path: 'ai-notes',
    element: withSuspense(<AdminAiNotesListPage />),
  },
  {
    path: 'ai-notes/:id',
    element: withSuspense(<AdminAiNotesEditorPage />),
  },
  {
    path: 'announcements',
    element: withSuspense(<AdminAnnouncementsPage />),
  },
  {
    path: 'reports',
    element: withSuspense(<AdminReportsPage />),
  },
  {
    path: 'doubts',
    element: withSuspense(<AdminDoubtsPage />),
  },
  {
    path: 'setup',
    element: withSuspense(<AdminSetupPage />),
  },
  {
    path: 'settings',
    element: withSuspense(<AdminSettingsPage />),
  },
];

const studentPanelRoutes = [
  {
    index: true,
    element: <Navigate to="dashboard" replace />,
  },
  {
    path: 'dashboard',
    element: withSuspense(<StudentDashboardPage />),
  },
  {
    path: 'pending',
    element: withSuspense(
      <DashboardPage
        title="Awaiting approval"
        subtitle="This page mirrors the current pending flow for newly registered student accounts."
        cards={[
          { kicker: 'Pending', title: 'Approval required', text: 'Students stay here until an admin marks the account active.' },
        ]}
      />
    ),
  },
  {
    path: 'profile',
    element: withSuspense(<ProfilePage />),
  },
  {
    path: 'courses',
    element: withSuspense(<StudentCoursesPage />),
  },
  {
    path: 'courses/:courseId',
    element: withSuspense(<CourseDetailPage />),
  },
  {
    path: 'quizzes',
    element: withSuspense(<StudentQuizzesPage pageMode="practice" />),
  },
  {
    path: 'exams',
    element: withSuspense(<StudentQuizzesPage pageMode="exam" />),
  },
  {
    path: 'quizzes/:quizId/practice-review',
    element: withSuspense(<PracticeReviewPage />),
  },
  {
    path: 'quizzes/:quizId',
    element: withSuspense(<TakeQuizPage />),
  },
  {
    path: 'subscriptions/checkout/:planId',
    element: withSuspense(<StudentCheckoutPage />),
  },
  {
    path: 'subscriptions',
    element: withSuspense(<StudentBillingPage />),
  },
  {
    path: 'billing',
    element: <Navigate to="../subscriptions" replace />,
  },
  {
    path: 'bookmarks',
    element: withSuspense(<BookmarksPage />),
  },
  {
    path: 'notifications',
    element: withSuspense(<StudentNotificationsPage />),
  },
  {
    path: 'planner',
    element: withSuspense(<StudyPlannerPage />),
  },
  {
    path: 'doubts',
    element: withSuspense(<StudentDoubtsPage />),
  },
  {
    path: 'flashcards',
    element: withSuspense(<StudentFlashcardsPage />),
  },
  {
    path: 'notes',
    element: withSuspense(<StudentNotesPage />),
  },
  {
    path: 'study/lesson/:lessonId',
    element: withSuspense(<AiNotesPage />),
  },
  {
    path: 'ai-notes',
    element: withSuspense(<AiNotesListPage />),
  },
  {
    path: 'ai-notes/:id',
    element: withSuspense(<AiNotesPage />),
  },
  {
    path: 'results',
    element: withSuspense(<ResultsListPage />),
  },
  {
    path: 'results/:attemptId',
    element: withSuspense(<ResultPage />),
  },
  {
    path: 'review/:attemptId',
    element: withSuspense(<ReviewPage />),
  },
];

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppFrame />,
    errorElement: <AppRouteError />,
    children: [
      {
        index: true,
        element: withSuspense(PLATFORM.isNative ? <RoleHomeRedirect /> : <LandingPage />),
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
        path: 'admin',
        element: (
          <ProtectedRoute role="admin">
            <PanelLayout />
          </ProtectedRoute>
        ),
        children: adminPanelRoutes,
      },
      {
        path: 'app',
        element: (
          <ProtectedRoute role="student" allowPending>
            <PanelLayout />
          </ProtectedRoute>
        ),
        children: studentPanelRoutes,
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
            path: 'users/:userId',
            element: (
              <ProtectedRoute role="admin">
                {withSuspense(<AdminStudentDetailPage />)}
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
            path: 'questions/review',
            element: (
              <ProtectedRoute role="admin">
                {withSuspense(<QuestionReviewPage />)}
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
            path: 'notifications',
            element: (
              <ProtectedRoute>
                {withSuspense(<StudentNotificationsPage />)}
              </ProtectedRoute>
            ),
          },
          {
            path: 'planner',
            element: (
              <ProtectedRoute role="student">
                {withSuspense(<StudyPlannerPage />)}
              </ProtectedRoute>
            ),
          },
          {
            path: 'doubts',
            element: (
              <ProtectedRoute>
                <RoleSwitch
                  admin={withSuspense(<AdminDoubtsPage />)}
                  student={withSuspense(<StudentDoubtsPage />)}
                />
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
            path: 'announcements',
            element: (
              <ProtectedRoute role="admin">
                {withSuspense(<AdminAnnouncementsPage />)}
              </ProtectedRoute>
            ),
          },
          {
            path: 'reports',
            element: (
              <ProtectedRoute role="admin">
                {withSuspense(<AdminReportsPage />)}
              </ProtectedRoute>
            ),
          },
          {
            path: 'setup',
            element: (
              <ProtectedRoute role="admin">
                {withSuspense(<AdminSetupPage />)}
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
  basename: ROUTER_BASENAME,
});
