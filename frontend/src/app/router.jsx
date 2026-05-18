import { Suspense, lazy, memo, useLayoutEffect } from 'react';
import { Navigate, RouterProvider, createBrowserRouter, useLocation } from 'react-router-dom';
import { ProtectedRoute, PublicOnlyRoute } from '../shared/auth/RouteGate.jsx';
import { AppRouteError } from './AppRouteError.jsx';
import { AppErrorBoundary } from './AppErrorBoundary.jsx';
import { AppFrame } from './AppFrame.jsx';
import { useAuthStore } from '../shared/stores/authStore.js';
import { shouldPreloadRoutes } from '../shared/utils/performanceProfile.js';
import { detectPlatform } from '../shared/platform/detect.js';
import { getRouterBasename, normalizeLegacyBuildPath } from '../shared/platform/config.js';

const PLATFORM = detectPlatform();
const ROUTER_BASENAME = getRouterBasename(PLATFORM);
const routeUi = {
  screenShell:
    'lms-route-page page page-wrapper page-content app-content w-full max-w-full min-w-0 overflow-x-hidden px-page-x pb-page-y pt-page-y text-ink-strong max-[520px]:px-3.5 max-[520px]:pb-[var(--lms-mobile-content-bottom)] max-[520px]:pt-3.5',
  routeSkeleton: 'route-skeleton',
  routeSkeletonTop: 'route-skeleton__top',
  routeSkeletonGrid: 'route-skeleton__grid',
  routeSkeletonCard: 'route-skeleton__card',
  shimmer: 'skeleton-pulse',
};

normalizeLegacyBuildPath(PLATFORM);

function lazyNamed(loader, exportName) {
  const Component = lazy(() =>
    loader().then((module) => ({ default: module[exportName] }))
  );
  Component.preload = loader;
  return Component;
}

const LandingPage  = lazyNamed(() => import('../surfaces/website/pages/LandingPage.jsx'),               'LandingPage');
const LoginPage    = lazyNamed(() => import('../surfaces/website/auth/LoginPage.jsx'),          'LoginPage');
const RegisterPage = lazyNamed(() => import('../surfaces/website/auth/RegisterPage.jsx'),       'RegisterPage');
const ForgotPasswordPage = lazyNamed(() => import('../surfaces/website/auth/ForgotPasswordPage.jsx'), 'ForgotPasswordPage');
const ResetPasswordPage = lazyNamed(() => import('../surfaces/website/auth/ResetPasswordPage.jsx'), 'ResetPasswordPage');
const TermsPage    = lazyNamed(() => import('../surfaces/website/pages/TermsPage.jsx'),                  'TermsPage');
const PrivacyPolicyPage = lazyNamed(() => import('../surfaces/website/pages/PrivacyPolicyPage.jsx'),     'PrivacyPolicyPage');

const CoursesPage = lazyNamed(() => import('../surfaces/admin/pages/courses/CoursesPage.jsx'), 'CoursesPage');
const AdminDashboardPage = lazyNamed(() => import('../surfaces/admin/pages/dashboard/AdminDashboardPage.jsx'), 'AdminDashboardPage');
const QuizzesPage = lazyNamed(() => import('../surfaces/admin/pages/quizzes/QuizzesPage.jsx'), 'QuizzesPage');
const QuizBuilderPage = lazyNamed(() => import('../surfaces/admin/pages/quizzes/QuizBuilderPage.jsx'), 'QuizBuilderPage');
const AdminSubscriptionsPage = lazyNamed(() => import('../surfaces/admin/pages/subscriptions/AdminSubscriptionsPage.jsx'), 'AdminSubscriptionsPage');
const QuestionsPage = lazyNamed(() => import('../surfaces/admin/pages/questions/QuestionsPage.jsx'), 'QuestionsPage');
const BulkQuestionInputPage = lazyNamed(() => import('../surfaces/admin/pages/questions/BulkQuestionInputPage.jsx'), 'BulkQuestionInputPage');
const QuestionReviewPage = lazyNamed(() => import('../surfaces/admin/pages/questions/QuestionReviewPage.jsx'), 'QuestionReviewPage');
const StructurePage = lazyNamed(() => import('../surfaces/admin/pages/structure/StructurePage.jsx'), 'StructurePage');
const UsersPage = lazyNamed(() => import('../surfaces/admin/pages/users/UsersPage.jsx'), 'UsersPage');
const AdminStudentDetailPage = lazyNamed(() => import('../surfaces/admin/pages/users/AdminStudentDetailPage.jsx'), 'AdminStudentDetailPage');
const AdminSettingsPage = lazyNamed(() => import('../surfaces/admin/pages/settings/AdminSettingsPage.jsx'), 'AdminSettingsPage');
const AdminSetupPage = lazyNamed(() => import('../surfaces/admin/pages/setup/AdminSetupPage.jsx'), 'AdminSetupPage');
const AdminAnnouncementsPage = lazyNamed(() => import('../surfaces/admin/pages/announcements/AdminAnnouncementsPage.jsx'), 'AdminAnnouncementsPage');
const AdminReportsPage = lazyNamed(() => import('../surfaces/admin/pages/reports/AdminReportsPage.jsx'), 'AdminReportsPage');
const AdminDoubtsPage = lazyNamed(() => import('../surfaces/admin/pages/doubts/AdminDoubtsPage.jsx'), 'AdminDoubtsPage');
const StudentDashboardPage = lazyNamed(() => import('../surfaces/app/student/dashboard/StudentDashboardPage.jsx'), 'StudentDashboardPage');
const StudentCoursesPage = lazyNamed(() => import('../surfaces/app/student/courses/StudentCoursesPage.jsx'), 'StudentCoursesPage');
const CourseDetailPage = lazyNamed(() => import('../surfaces/app/student/courses/CourseDetailPage.jsx'), 'CourseDetailPage');
const StudentBillingPage = lazyNamed(() => import('../surfaces/app/student/billing/StudentBillingPage.jsx'), 'StudentBillingPage');
const StudentCheckoutPage = lazyNamed(() => import('../surfaces/app/student/billing/StudentCheckoutPage.jsx'), 'StudentCheckoutPage');
const BookmarksPage = lazyNamed(() => import('../surfaces/app/student/bookmarks/BookmarksPage.jsx'), 'BookmarksPage');
const StudentNotificationsPage = lazyNamed(() => import('../surfaces/app/student/notifications/StudentNotificationsPage.jsx'), 'StudentNotificationsPage');
const StudyPlannerPage = lazyNamed(() => import('../surfaces/app/student/planner/StudyPlannerPage.jsx'), 'StudyPlannerPage');
const StudentDoubtsPage = lazyNamed(() => import('../surfaces/app/student/doubts/StudentDoubtsPage.jsx'), 'StudentDoubtsPage');
const StudentFlashcardsPage = lazyNamed(() => import('../surfaces/app/student/flashcards/StudentFlashcardsPage.jsx'), 'StudentFlashcardsPage');
const StudentNotesPage = lazyNamed(() => import('../surfaces/app/student/notes/StudentNotesPage.jsx'), 'StudentNotesPage');
const AiNotesPage = lazyNamed(() => import('../surfaces/app/student/ai-notes/AiNotesPage.jsx'), 'AiNotesPage');
const AiNotesListPage = lazyNamed(() => import('../surfaces/app/student/ai-notes/AiNotesListPage.jsx'), 'AiNotesListPage');
const AdminAiNotesListPage = lazyNamed(() => import('../surfaces/admin/pages/ai-notes/AdminAiNotesListPage.jsx'), 'AdminAiNotesListPage');
const AdminAiNotesEditorPage = lazyNamed(() => import('../surfaces/admin/pages/ai-notes/AdminAiNotesEditorPage.jsx'), 'AdminAiNotesEditorPage');
const StudentQuizzesPage = lazyNamed(() => import('../surfaces/app/student/quizzes/StudentQuizzesPage.jsx'), 'StudentQuizzesPage');
const TakeQuizPage = lazyNamed(() => import('../surfaces/app/student/quizzes/TakeQuizPage.jsx'), 'TakeQuizPage');
const PracticeReviewPage = lazyNamed(() => import('../surfaces/app/student/results/PracticeReviewPage.jsx'), 'PracticeReviewPage');
const ResultPage = lazyNamed(() => import('../surfaces/app/student/results/ResultPage.jsx'), 'ResultPage');
const ResultsListPage = lazyNamed(() => import('../surfaces/app/student/results/ResultsListPage.jsx'), 'ResultsListPage');
const ReviewPage = lazyNamed(() => import('../surfaces/app/student/results/ReviewPage.jsx'), 'ReviewPage');
const DashboardPage = lazyNamed(() => import('../shared/pages/DashboardPage.jsx'), 'DashboardPage');
const NotFoundPage = lazyNamed(() => import('../shared/pages/NotFoundPage.jsx'), 'NotFoundPage');
const AiQuizGeneratorPage = lazyNamed(() => import('../surfaces/website/ai/AiQuizGeneratorPage.jsx'), 'AiQuizGeneratorPage');
const LessonNotesDemoPage = lazyNamed(() => import('../surfaces/website/pages/LessonNotesDemoPage.jsx'), 'LessonNotesDemoPage');
const HeadacheNotesDemoPage = lazyNamed(() => import('../surfaces/website/pages/HeadacheNotesDemoPage.jsx'), 'HeadacheNotesDemoPage');
const PwaPreviewPage = lazyNamed(() => import('../surfaces/website/pages/PwaPreviewPage.jsx'), 'PwaPreviewPage');
const BrowserTestPage = lazyNamed(() => import('../surfaces/website/pages/BrowserTestPage.jsx'), 'BrowserTestPage');
const GptPage = lazyNamed(() => import('../surfaces/website/pages/GptPage.jsx'), 'GptPage');
const GeminiPage = lazyNamed(() => import('../surfaces/website/pages/GeminiPage.jsx'), 'GeminiPage');
const ProfilePage = lazyNamed(() => import('../shared/account/ProfilePage.jsx'), 'ProfilePage');
const PanelLayout = lazyNamed(() => import('../shared/layout/PanelLayout.jsx'), 'PanelLayout');

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
    <main className={routeUi.screenShell} aria-busy="true">
      <div className={routeUi.routeSkeleton}>
        <div className={routeUi.routeSkeletonTop}>
          <span className={routeUi.shimmer} />
          <span className={routeUi.shimmer} />
          <span className={routeUi.shimmer} />
        </div>
        <div className={routeUi.routeSkeletonGrid}>
          {[1, 2, 3].map((item) => (
            <div className={routeUi.routeSkeletonCard} key={item}>
              <span className={routeUi.shimmer} />
              <span className={routeUi.shimmer} />
              <span className={routeUi.shimmer} />
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

function withLayoutSuspense(element) {
  return (
    <AppErrorBoundary>
      <Suspense fallback={<RouteFallback />}>
        {element}
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
        subtitle="Approval Pending"
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
        element: withLayoutSuspense(
          <ProtectedRoute role="admin">
            <PanelLayout />
          </ProtectedRoute>
        ),
        children: adminPanelRoutes,
      },
      {
        path: 'app',
        element: withLayoutSuspense(
          <ProtectedRoute role="student" allowPending>
            <PanelLayout />
          </ProtectedRoute>
        ),
        children: studentPanelRoutes,
      },
      {
        element: withLayoutSuspense(<PanelLayout />),
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
                    subtitle="Approval Pending"
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

export function AppRouter() {
  return <RouterProvider router={router} />;
}
