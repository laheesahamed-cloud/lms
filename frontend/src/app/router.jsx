import { Suspense, lazy, memo, useEffect, useLayoutEffect, useState } from 'react';
import { Navigate, RouterProvider, createBrowserRouter, useLocation } from 'react-router-dom';
import { ProtectedRoute, PublicOnlyRoute } from '../shared/auth/RouteGate.jsx';
import { AppRouteError } from './AppRouteError.jsx';
import { AppErrorBoundary } from './AppErrorBoundary.jsx';
import { AppFrame } from './AppFrame.jsx';
import { useAuthStore } from '../shared/stores/authStore.js';
import { isStaffUser, userHasPermissions } from '../shared/auth/roleAccess.js';
import { detectPlatform } from '../shared/platform/detect.js';
import { getRouterBasename, normalizeLegacyBuildPath } from '../shared/platform/config.js';
import { XyndromeLogoMark } from '../shared/brand/XyndromeBrand.jsx';
import { configureRoutePreloaders } from './routePreloading.js';

const PLATFORM = detectPlatform();
const ROUTER_BASENAME = getRouterBasename(PLATFORM);
const ROUTE_FALLBACK_DELAY_MS = 220;
const routeUi = {
  screenShell:
    'lms-route-page page page-wrapper page-content app-content w-full max-w-full min-w-0 overflow-x-hidden px-page-x pb-page-y pt-page-y text-ink-strong max-[520px]:px-3.5 max-[520px]:pb-[var(--lms-mobile-content-bottom)] max-[520px]:pt-3.5',
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
const RefundPolicyPage = lazyNamed(() => import('../surfaces/website/pages/RefundPolicyPage.jsx'),       'RefundPolicyPage');
const CookiePolicyPage = lazyNamed(() => import('../surfaces/website/pages/CookiePolicyPage.jsx'),       'CookiePolicyPage');

const CoursesPage = lazyNamed(() => import('../surfaces/admin/pages/courses/CoursesPage.jsx'), 'CoursesPage');
const AdminDashboardPage = lazyNamed(() => import('../surfaces/admin/pages/dashboard/AdminDashboardPage.jsx'), 'AdminDashboardPage');
const QuizzesPage = lazyNamed(() => import('../surfaces/admin/pages/quizzes/QuizzesPage.jsx'), 'QuizzesPage');
const QuizBuilderPage = lazyNamed(() => import('../surfaces/admin/pages/quizzes/QuizBuilderPage.jsx'), 'QuizBuilderPage');
const AdminSubscriptionsPage = lazyNamed(() => import('../surfaces/admin/pages/subscriptions/AdminSubscriptionsPage.jsx'), 'AdminSubscriptionsPage');
const AdminFinancePage = lazyNamed(() => import('../surfaces/admin/pages/finance/AdminFinancePage.jsx'), 'AdminFinancePage');
const QuestionsPage = lazyNamed(() => import('../surfaces/admin/pages/questions/QuestionsPage.jsx'), 'QuestionsPage');
const AdminQuestionReportsPage = lazyNamed(() => import('../surfaces/admin/pages/questions/AdminQuestionReportsPage.jsx'), 'AdminQuestionReportsPage');
const BulkQuestionInputPage = lazyNamed(() => import('../surfaces/admin/pages/questions/BulkQuestionInputPage.jsx'), 'BulkQuestionInputPage');
const StructurePage = lazyNamed(() => import('../surfaces/admin/pages/structure/StructurePage.jsx'), 'StructurePage');
const UsersPage = lazyNamed(() => import('../surfaces/admin/pages/users/UsersPage.jsx'), 'UsersPage');
const AdminStudentDetailPage = lazyNamed(() => import('../surfaces/admin/pages/users/AdminStudentDetailPage.jsx'), 'AdminStudentDetailPage');
const AdminSettingsPage = lazyNamed(() => import('../surfaces/admin/pages/settings/AdminSettingsPage.jsx'), 'AdminSettingsPage');
const AdminSetupPage = lazyNamed(() => import('../surfaces/admin/pages/setup/AdminSetupPage.jsx'), 'AdminSetupPage');
const AdminAnnouncementsPage = lazyNamed(() => import('../surfaces/admin/pages/announcements/AdminAnnouncementsPage.jsx'), 'AdminAnnouncementsPage');
const AdminReportsPage = lazyNamed(() => import('../surfaces/admin/pages/reports/AdminReportsPage.jsx'), 'AdminReportsPage');
const StudentDashboardPage = lazyNamed(() => import('../surfaces/app/student/dashboard/StudentDashboardPage.jsx'), 'StudentDashboardPage');
const StudentCoursesPage = lazyNamed(() => import('../surfaces/app/student/courses/StudentCoursesPage.jsx'), 'StudentCoursesPage');
const CourseDetailPage = lazyNamed(() => import('../surfaces/app/student/courses/CourseDetailPage.jsx'), 'CourseDetailPage');
const StudentBillingPage = lazyNamed(() => import('../surfaces/app/student/billing/StudentBillingPage.jsx'), 'StudentBillingPage');
const StudentCheckoutPage = lazyNamed(() => import('../surfaces/app/student/billing/StudentCheckoutPage.jsx'), 'StudentCheckoutPage');
const BookmarksPage = lazyNamed(() => import('../surfaces/app/student/bookmarks/BookmarksPage.jsx'), 'BookmarksPage');
const StudentNotificationsPage = lazyNamed(() => import('../surfaces/app/student/notifications/StudentNotificationsPage.jsx'), 'StudentNotificationsPage');
const StudyPlannerPage = lazyNamed(() => import('../surfaces/app/student/planner/StudyPlannerPage.jsx'), 'StudyPlannerPage');
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
const LaunchModePreviewPage = lazyNamed(() => import('../shared/launch/LaunchModePreviewPage.jsx'), 'LaunchModePreviewPage');
const AiQuizGeneratorPage = lazyNamed(() => import('../surfaces/website/ai/AiQuizGeneratorPage.jsx'), 'AiQuizGeneratorPage');
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
    ['/quizzes', QuizzesPage.preload],
    ['/quizzes/new', QuizBuilderPage.preload],
    ['/subscriptions', AdminSubscriptionsPage.preload],
    ['/finance', AdminFinancePage.preload],
    ['/ai-notes', AdminAiNotesListPage.preload],
    ['/users', UsersPage.preload],
    ['/announcements', AdminAnnouncementsPage.preload],
    ['/reports', AdminReportsPage.preload],
    ['/setup', AdminSetupPage.preload],
    ['/settings', AdminSettingsPage.preload],
  ]),
  student: new Map([
    ['/dashboard', StudentDashboardPage.preload],
    ['/courses', StudentCoursesPage.preload],
    ['/notifications', StudentNotificationsPage.preload],
    ['/planner', StudyPlannerPage.preload],
    ['/ai-notes', AiNotesListPage.preload],
    ['/flashcards', StudentFlashcardsPage.preload],
    ['/quizzes', StudentQuizzesPage.preload],
    ['/exams', StudentQuizzesPage.preload],
    ['/results', ResultsListPage.preload],
    ['/bookmarks', BookmarksPage.preload],
    ['/subscriptions', StudentBillingPage.preload],
  ]),
};

function dynamicRoutePreloader(path) {
  const cleanPath = String(path || '')
    .split('#')[0]
    .split('?')[0]
    .replace(/^\/(?:admin|app|student)(?=\/|$)/, '') || '/dashboard';

  if (/^\/quizzes\/\d+$/.test(cleanPath)) return TakeQuizPage.preload;
  if (/^\/quizzes\/\d+\/practice-review$/.test(cleanPath)) return PracticeReviewPage.preload;
  if (/^\/results\/\d+$/.test(cleanPath)) return ResultPage.preload;
  if (/^\/review\/\d+$/.test(cleanPath)) return ReviewPage.preload;
  if (/^\/courses\/\d+$/.test(cleanPath)) return CourseDetailPage.preload;
  if (/^\/ai-notes\/\d+$/.test(cleanPath)) return AiNotesPage.preload;
  if (/^\/study\/lesson\/\d+$/.test(cleanPath)) return AiNotesPage.preload;
  return null;
}

configureRoutePreloaders({ commonRoutePreloaders, roleRoutePreloaders, dynamicRoutePreloader });

function RouteFallback() {
  return (
    <main className={routeUi.screenShell} aria-busy="true">
      <div className="grid min-h-[42dvh] place-items-center">
        <span className="skeleton-pulse grid size-16 place-items-center rounded-full bg-surface-card shadow-[var(--ds-card-shadow)]">
          <XyndromeLogoMark size={44} />
        </span>
      </div>
    </main>
  );
}

function DelayedRouteFallback() {
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowFallback(true), ROUTE_FALLBACK_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return showFallback ? <RouteFallback /> : null;
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setPrefersReducedMotion(query.matches);
    sync();
    query.addEventListener?.('change', sync);
    return () => query.removeEventListener?.('change', sync);
  }, []);

  return prefersReducedMotion;
}

const RouteReveal = memo(function RouteReveal({ children }) {
  const location = useLocation();
  const prefersReducedMotion = usePrefersReducedMotion();
  const routeRevealClassName = [
    'lms-route-reveal',
    'motion-smooth',
    !prefersReducedMotion && 'animate-panelRouteFade',
  ].filter(Boolean).join(' ');

  useLayoutEffect(() => {
    if (typeof document === 'undefined') return undefined;
    let cancelled = false;
    const raf = window.requestAnimationFrame(() => {
      if (cancelled) return;
      window.__lmsRouteReady = true;
      document.dispatchEvent(new CustomEvent('lms:route-ready', {
        detail: {
          pathname: location.pathname,
          search: location.search,
          routeKey: `${location.pathname}${location.search}`,
        },
      }));
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
    };
  }, [location.pathname, location.search]);

  return (
    <div className={routeRevealClassName}>
      {children}
    </div>
  );
});

function withSuspense(element) {
  return (
    <AppErrorBoundary>
      <Suspense fallback={<DelayedRouteFallback />}>
        <RouteReveal>{element}</RouteReveal>
      </Suspense>
    </AppErrorBoundary>
  );
}

function withLayoutSuspense(element) {
  return (
    <AppErrorBoundary>
      <Suspense fallback={<DelayedRouteFallback />}>
        {element}
      </Suspense>
    </AppErrorBoundary>
  );
}

function RoleSwitch({ admin, student, adminPermissions = [] }) {
  const user = useAuthStore((state) => state.user);
  if (isStaffUser(user)) {
    if (adminPermissions.length && !userHasPermissions(user, adminPermissions)) {
      return <Navigate to={roleHomePath(user)} replace />;
    }
    return admin;
  }
  return student;
}

function roleHomePath(user) {
  if (isStaffUser(user)) return '/admin/dashboard';
  if (user?.role === 'student' && user.status !== 'active') return '/pending';
  return '/dashboard';
}

function prefixRolePath(path, user) {
  const normalized = path && path !== '/' ? path : '/dashboard';
  const cleanPath = normalized.replace(/^\/(?:admin|student|app)(?=\/|$)/, '') || '/dashboard';
  const prefix = isStaffUser(user) ? '/admin' : '';
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
    element: withSuspense(
      <ProtectedRoute role="admin" requiredPermissions={['content.manage']}>
        <CoursesPage />
      </ProtectedRoute>
    ),
  },
  {
    path: 'structure',
    element: withSuspense(
      <ProtectedRoute role="admin" requiredPermissions={['content.manage']}>
        <StructurePage />
      </ProtectedRoute>
    ),
  },
  {
    path: 'users',
    element: withSuspense(
      <ProtectedRoute role="admin" requiredPermissions={['students.manage']}>
        <UsersPage />
      </ProtectedRoute>
    ),
  },
  {
    path: 'users/:userId',
    element: withSuspense(
      <ProtectedRoute role="admin" requiredPermissions={['students.manage']}>
        <AdminStudentDetailPage />
      </ProtectedRoute>
    ),
  },
  {
    path: 'questions',
    element: withSuspense(
      <ProtectedRoute role="admin" requiredPermissions={['questions.manage']}>
        <QuestionsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: 'questions/bulk',
    element: withSuspense(
      <ProtectedRoute role="admin" requiredPermissions={['questions.manage']}>
        <BulkQuestionInputPage />
      </ProtectedRoute>
    ),
  },
  {
    path: 'quizzes',
    element: withSuspense(
      <ProtectedRoute role="admin" requiredPermissions={['quizzes.manage']}>
        <QuizzesPage />
      </ProtectedRoute>
    ),
  },
  {
    path: 'quizzes/new',
    element: withSuspense(
      <ProtectedRoute role="admin" requiredPermissions={['quizzes.manage']}>
        <QuizBuilderPage />
      </ProtectedRoute>
    ),
  },
  {
    path: 'quizzes/:quizId/edit',
    element: withSuspense(
      <ProtectedRoute role="admin" requiredPermissions={['quizzes.manage']}>
        <QuizBuilderPage />
      </ProtectedRoute>
    ),
  },
  {
    path: 'subscriptions',
    element: withSuspense(
      <ProtectedRoute role="admin" requiredPermissions={['subscriptions.manage']}>
        <AdminSubscriptionsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: 'finance',
    element: withSuspense(
      <ProtectedRoute role="admin" requiredPermissions={['subscriptions.manage', 'reports.view']}>
        <AdminFinancePage />
      </ProtectedRoute>
    ),
  },
  {
    path: 'ai-notes',
    element: withSuspense(
      <ProtectedRoute role="admin" requiredPermissions={['content.manage']}>
        <AdminAiNotesListPage />
      </ProtectedRoute>
    ),
  },
  {
    path: 'ai-notes/:id',
    element: withSuspense(
      <ProtectedRoute role="admin" requiredPermissions={['content.manage']}>
        <AdminAiNotesEditorPage />
      </ProtectedRoute>
    ),
  },
  {
    path: 'announcements',
    element: withSuspense(
      <ProtectedRoute role="admin" requiredPermissions={['notifications.manage']}>
        <AdminAnnouncementsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: 'reports',
    element: withSuspense(
      <ProtectedRoute role="admin" requiredPermissions={['reports.view']}>
        <AdminReportsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: 'setup',
    element: withSuspense(
      <ProtectedRoute role="admin" requiredPermissions={['settings.manage']}>
        <AdminSetupPage />
      </ProtectedRoute>
    ),
  },
  {
    path: 'settings',
    element: withSuspense(
      <ProtectedRoute role="admin" requiredPermissions={['settings.manage']}>
        <AdminSettingsPage />
      </ProtectedRoute>
    ),
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

const router = createBrowserRouter([
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
        path: 'refund-policy',
        element: withSuspense(<RefundPolicyPage />),
      },
      {
        path: 'cookie-policy',
        element: withSuspense(<CookiePolicyPage />),
      },
      {
        path: 'ai',
        element: withSuspense(
          <AiQuizGeneratorPage
            engineKey="gemini"
            generatorLabel="Gemini"
            heroEyebrow="AI Question Builder"
            heroTitle="Gemini Quiz Generator"
            heroDescription="Generate draft SBA and True/False questions, review the output, and save approved items into the LMS question bank."
          />
        ),
      },
      {
        path: 'ai/gemini',
        element: withSuspense(
          <AiQuizGeneratorPage
            engineKey="gemini"
            generatorLabel="Gemini"
            heroEyebrow="AI Question Builder"
            heroTitle="Gemini Quiz Generator"
            heroDescription="Generate draft SBA and True/False questions, review the output, and save approved items into the LMS question bank."
          />
        ),
      },
      {
        path: 'ai/chatgpt',
        element: withSuspense(
          <AiQuizGeneratorPage
            engineKey="openai"
            generatorLabel="ChatGPT"
            heroEyebrow="AI Question Builder"
            heroTitle="ChatGPT Quiz Generator"
            heroDescription="Generate draft SBA and True/False questions, review the output, and save approved items into the LMS question bank."
          />
        ),
      },
      {
        path: 'launch-preview/:mode',
        element: withSuspense(<LaunchModePreviewPage />),
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
        element: withLayoutSuspense(
          <ProtectedRoute allowPending>
            <PanelLayout />
          </ProtectedRoute>
        ),
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
                  adminPermissions={['content.manage']}
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
              <ProtectedRoute role="admin" requiredPermissions={['content.manage']}>
                {withSuspense(<StructurePage />)}
              </ProtectedRoute>
            ),
          },
          {
            path: 'users',
            element: (
              <ProtectedRoute role="admin" requiredPermissions={['students.manage']}>
                {withSuspense(<UsersPage />)}
              </ProtectedRoute>
            ),
          },
          {
            path: 'users/:userId',
            element: (
              <ProtectedRoute role="admin" requiredPermissions={['students.manage']}>
                {withSuspense(<AdminStudentDetailPage />)}
              </ProtectedRoute>
            ),
          },
          {
            path: 'questions',
            element: (
              <ProtectedRoute role="admin" requiredPermissions={['questions.manage']}>
                {withSuspense(<QuestionsPage />)}
              </ProtectedRoute>
            ),
          },
          {
            path: 'questions/bulk',
            element: (
              <ProtectedRoute role="admin" requiredPermissions={['questions.manage']}>
                {withSuspense(<BulkQuestionInputPage />)}
              </ProtectedRoute>
            ),
          },
          {
            path: 'question-reports',
            element: (
              <ProtectedRoute role="admin" requiredPermissions={['content.review']}>
                {withSuspense(<AdminQuestionReportsPage />)}
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
                  adminPermissions={['quizzes.manage']}
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
              <ProtectedRoute role="admin" requiredPermissions={['quizzes.manage']}>
                {withSuspense(<QuizBuilderPage />)}
              </ProtectedRoute>
            ),
          },
          {
            path: 'quizzes/:quizId/edit',
            element: (
              <ProtectedRoute role="admin" requiredPermissions={['quizzes.manage']}>
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
                  adminPermissions={['subscriptions.manage']}
                />
              </ProtectedRoute>
            ),
          },
          {
            path: 'finance',
            element: (
              <ProtectedRoute role="admin" requiredPermissions={['subscriptions.manage', 'reports.view']}>
                {withSuspense(<AdminFinancePage />)}
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
                  adminPermissions={['content.manage']}
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
                  adminPermissions={['content.manage']}
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
              <ProtectedRoute role="admin" requiredPermissions={['notifications.manage']}>
                {withSuspense(<AdminAnnouncementsPage />)}
              </ProtectedRoute>
            ),
          },
          {
            path: 'reports',
            element: (
              <ProtectedRoute role="admin" requiredPermissions={['reports.view']}>
                {withSuspense(<AdminReportsPage />)}
              </ProtectedRoute>
            ),
          },
          {
            path: 'setup',
            element: (
              <ProtectedRoute role="admin" requiredPermissions={['settings.manage']}>
                {withSuspense(<AdminSetupPage />)}
              </ProtectedRoute>
            ),
          },
          {
            path: 'settings',
            element: (
              <ProtectedRoute role="admin" requiredPermissions={['settings.manage']}>
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
