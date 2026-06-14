import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../theme/motion.dart';
import '../state/auth_controller.dart';
import '../state/onboarding.dart';
import '../features/onboarding/splash_page.dart';
import '../features/onboarding/welcome_page.dart';
import '../features/auth/login_page.dart';
import '../features/auth/register_page.dart';
import '../features/auth/forgot_password_page.dart';
import '../features/auth/reset_password_page.dart';
import '../features/onboarding/pending_page.dart';
import '../features/results/review_page.dart';
import '../features/ai_notes/note_canvas_page.dart';
import '../features/shell/app_shell.dart';
import '../features/dashboard/dashboard_page.dart';
import '../features/courses/courses_page.dart';
import '../features/courses/course_detail_page.dart';
import '../features/quizzes/quizzes_page.dart';
import '../features/quizzes/take_quiz_page.dart';
import '../features/results/results_page.dart';
import '../features/results/result_detail_page.dart';
import '../features/flashcards/flashcards_page.dart';
import '../features/study/study_hub_page.dart';
import '../features/ai_notes/ai_notes_list_page.dart';
import '../features/ai_notes/ai_note_reader_page.dart';
import '../features/profile/profile_page.dart';
import '../features/notifications/notifications_page.dart';
import '../features/bookmarks/bookmarks_page.dart';
import '../features/planner/planner_page.dart';
import '../features/notes/notes_page.dart';
import '../features/subscriptions/subscriptions_page.dart';

final goRouterProvider = Provider<GoRouter>((ref) {
  final refresh = ValueNotifier<int>(0);
  ref.listen(authControllerProvider, (_, _) => refresh.value++);
  ref.listen(onboardingSeenProvider, (_, _) => refresh.value++);
  ref.onDispose(refresh.dispose);

  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: refresh,
    redirect: (context, state) {
      // Gated dev preview: build with --dart-define=PREVIEW=true to browse
      // any /app route without auth (for screenshots). Off by default.
      if (const bool.fromEnvironment('PREVIEW')) return null;
      final auth = ref.read(authControllerProvider);
      final seen = ref.read(onboardingSeenProvider);
      final loc = state.matchedLocation;

      if (auth.isHydrating) return loc == '/splash' ? null : '/splash';

      final atWelcome = loc == '/welcome';
      final atAuth = loc.startsWith('/auth');

      if (!auth.isAuthenticated) {
        if (!seen) return atWelcome ? null : '/welcome';
        if (!atAuth) return '/auth/login';
        return null;
      }
      if (atWelcome || atAuth || loc == '/splash') return '/app/dashboard';
      return null;
    },
    routes: [
      GoRoute(
        path: '/splash',
        pageBuilder: (c, s) => fadePage(key: s.pageKey, child: const SplashPage()),
      ),
      GoRoute(
        path: '/welcome',
        pageBuilder: (c, s) => fadePage(key: s.pageKey, child: const WelcomePage()),
      ),
      GoRoute(
        path: '/auth/login',
        pageBuilder: (c, s) => slidePage(key: s.pageKey, child: const LoginPage()),
      ),
      GoRoute(
        path: '/auth/register',
        pageBuilder: (c, s) => slidePage(key: s.pageKey, child: const RegisterPage()),
      ),
      GoRoute(
        path: '/auth/forgot-password',
        pageBuilder: (c, s) =>
            slidePage(key: s.pageKey, child: const ForgotPasswordPage()),
      ),
      GoRoute(
        path: '/auth/reset-password',
        pageBuilder: (c, s) => slidePage(
          key: s.pageKey,
          child: ResetPasswordPage(
              token: s.uri.queryParameters['token'] ?? ''),
        ),
      ),
      GoRoute(
        path: '/app/pending',
        pageBuilder: (c, s) =>
            fadePage(key: s.pageKey, child: const PendingPage()),
      ),
      GoRoute(
        path: '/app/canvas',
        pageBuilder: (c, s) =>
            slidePage(key: s.pageKey, child: const NoteCanvasPage()),
      ),

      // Focus-mode (full-screen) routes — no app nav.
      GoRoute(
        path: '/app/courses/:courseId',
        pageBuilder: (c, s) => slidePage(
          key: s.pageKey,
          child: Scaffold(
              body: CourseDetailPage(courseId: s.pathParameters['courseId']!)),
        ),
      ),
      GoRoute(
        path: '/app/quizzes/:quizId',
        pageBuilder: (c, s) => slidePage(
          key: s.pageKey,
          child: TakeQuizPage(
            quizId: s.pathParameters['quizId']!,
            examMode: s.uri.queryParameters['exam'] == '1',
          ),
        ),
      ),
      GoRoute(
        path: '/app/results/:attemptId',
        pageBuilder: (c, s) => slidePage(
          key: s.pageKey,
          child: Scaffold(
              body:
                  ResultDetailPage(attemptId: s.pathParameters['attemptId']!)),
        ),
      ),
      GoRoute(
        path: '/app/ai-notes/:noteId',
        pageBuilder: (c, s) => slidePage(
          key: s.pageKey,
          child: Scaffold(
              body: AiNoteReaderPage(noteId: s.pathParameters['noteId']!)),
        ),
      ),
      GoRoute(
        path: '/app/review/:attemptId',
        pageBuilder: (c, s) => slidePage(
          key: s.pageKey,
          child: Scaffold(
              body: ReviewPage(attemptId: s.pathParameters['attemptId']!)),
        ),
      ),

      // Primary destinations — wrapped in the responsive shell.
      ShellRoute(
        builder: (context, state, child) =>
            AppShell(location: state.uri.path, child: child),
        routes: [
          GoRoute(
            path: '/app/dashboard',
            pageBuilder: (c, s) =>
                fadePage(key: s.pageKey, child: const DashboardPage()),
          ),
          GoRoute(
            path: '/app/courses',
            pageBuilder: (c, s) =>
                fadePage(key: s.pageKey, child: const CoursesPage()),
          ),
          GoRoute(
            path: '/app/quizzes',
            pageBuilder: (c, s) => fadePage(
                key: s.pageKey, child: const QuizzesPage(examMode: false)),
          ),
          GoRoute(
            path: '/app/exams',
            pageBuilder: (c, s) => fadePage(
                key: s.pageKey, child: const QuizzesPage(examMode: true)),
          ),
          GoRoute(
            path: '/app/study',
            pageBuilder: (c, s) =>
                fadePage(key: s.pageKey, child: const StudyHubPage()),
          ),
          GoRoute(
            path: '/app/results',
            pageBuilder: (c, s) =>
                fadePage(key: s.pageKey, child: const ResultsPage()),
          ),
          GoRoute(
            path: '/app/flashcards',
            pageBuilder: (c, s) =>
                fadePage(key: s.pageKey, child: const FlashcardsPage()),
          ),
          GoRoute(
            path: '/app/ai-notes',
            pageBuilder: (c, s) =>
                fadePage(key: s.pageKey, child: const AiNotesListPage()),
          ),
          GoRoute(
            path: '/app/planner',
            pageBuilder: (c, s) =>
                fadePage(key: s.pageKey, child: const PlannerPage()),
          ),
          GoRoute(
            path: '/app/notes',
            pageBuilder: (c, s) =>
                fadePage(key: s.pageKey, child: const NotesPage()),
          ),
          GoRoute(
            path: '/app/bookmarks',
            pageBuilder: (c, s) =>
                fadePage(key: s.pageKey, child: const BookmarksPage()),
          ),
          GoRoute(
            path: '/app/notifications',
            pageBuilder: (c, s) =>
                fadePage(key: s.pageKey, child: const NotificationsPage()),
          ),
          GoRoute(
            path: '/app/subscriptions',
            pageBuilder: (c, s) =>
                fadePage(key: s.pageKey, child: const SubscriptionsPage()),
          ),
          GoRoute(
            path: '/app/profile',
            pageBuilder: (c, s) =>
                fadePage(key: s.pageKey, child: const ProfilePage()),
          ),
        ],
      ),
    ],
  );
});
