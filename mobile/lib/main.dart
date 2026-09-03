import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'features/results/reviewed_attempts.dart';
import 'features/subscriptions/iap_reconciler.dart';
import 'services/screen_protection.dart';
import 'theme/app_theme.dart';
import 'router/app_router.dart';
import 'state/auth_controller.dart';
import 'state/onboarding.dart';
import 'state/theme_mode.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Don't block runApp() on SharedPreferences — that causes a multi-second
  // hang on the splash screen. Instead render immediately and swap in the
  // real app once prefs are ready (usually <100ms after first frame).
  runApp(const _PrefsBootstrap());
}

class _PrefsBootstrap extends StatefulWidget {
  const _PrefsBootstrap();

  @override
  State<_PrefsBootstrap> createState() => _PrefsBootstrapState();
}

class _PrefsBootstrapState extends State<_PrefsBootstrap> {
  SharedPreferences? _prefs;

  @override
  void initState() {
    super.initState();
    SharedPreferences.getInstance().then((p) {
      ReviewedAttempts.init(p);
      if (mounted) setState(() => _prefs = p);
    });
  }

  @override
  Widget build(BuildContext context) {
    final prefs = _prefs;
    if (prefs == null) {
      // Show a plain black screen while prefs load — identical to the native
      // launch screen so the transition is invisible to the user.
      return const MaterialApp(
        debugShowCheckedModeBanner: false,
        home: Scaffold(backgroundColor: Color(0xFF0A0A0F)),
      );
    }
    return ProviderScope(
      overrides: [sharedPrefsProvider.overrideWithValue(prefs)],
      child: const XyndromeApp(),
    );
  }
}

class XyndromeApp extends ConsumerStatefulWidget {
  const XyndromeApp({super.key});

  @override
  ConsumerState<XyndromeApp> createState() => _XyndromeAppState();
}

class _XyndromeAppState extends ConsumerState<XyndromeApp>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // Pick up purchases StoreKit knows about but the server may not (reinstall,
    // new device, or a purchase that never got redeemed).
    final reconciler = ref.read(iapReconcilerProvider);
    reconciler.start();
    WidgetsBinding.instance.addPostFrameCallback((_) => reconciler.sync());

    // Screen-capture protection:
    //  - Android: FLAG_SECURE, a real OS-level block, app-wide.
    //  - iOS: SecureQuizMode, applied per route — the hub/list pages stay
    //    open, content screens are protected. See
    //    ScreenProtection.shouldProtectPath (unit-tested in
    //    test/screen_protection_paths_test.dart).
    //
    // The blank-white-screen episode this went through was NOT caused by this
    // code: it was a broken build (Xcode.app building the same project
    // concurrently left the plugins unresolved, so shared_preferences never
    // returned and the app hung before its first frame).
    ScreenProtection.enable();
  }

  GoRouter? _router;

  /// Attached from [build], never initState: reading `goRouterProvider` during
  /// initState builds the router before the provider scope has settled.
  /// Idempotent — build runs often, this wires up once.
  void _attachRouterListener(GoRouter router) {
    if (identical(_router, router)) return;
    _router?.routeInformationProvider.removeListener(_syncScreenProtection);
    _router?.routerDelegate.removeListener(_syncScreenProtection);
    _router = router;
    // Both listenables: routeInformationProvider carries the canonical URI,
    // routerDelegate fires on imperative push/pop. Either alone misses some
    // transitions, and syncForRoute no-ops when nothing changed.
    router.routeInformationProvider.addListener(_syncScreenProtection);
    router.routerDelegate.addListener(_syncScreenProtection);
    WidgetsBinding.instance.addPostFrameCallback((_) => _syncScreenProtection());
  }

  void _syncScreenProtection() {
    final path = _router?.routeInformationProvider.value.uri.path ??
        _router?.routerDelegate.currentConfiguration.uri.path;
    if (path == null) return;
    ScreenProtection.syncForRoute(path);
  }

  @override
  void dispose() {
    _router?.routeInformationProvider.removeListener(_syncScreenProtection);
    _router?.routerDelegate.removeListener(_syncScreenProtection);
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Coming back from the background: re-check the session so an expired
    // token sends us to login automatically (no close-and-reopen needed).
    if (state == AppLifecycleState.resumed) {
      ref.read(authControllerProvider.notifier).revalidateSession();
      // Also catches a renewal that happened while we were backgrounded.
      ref.read(iapReconcilerProvider).sync();
    }
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(goRouterProvider);
    _attachRouterListener(router);
    return MaterialApp.router(
      title: 'xyndrome',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      themeMode: ref.watch(themeModeProvider),
      routerConfig: router,
      builder: (context, child) => GestureDetector(
        behavior: HitTestBehavior.translucent,
        onTap: () => FocusManager.instance.primaryFocus?.unfocus(),
        child: child,
      ),
    );
  }
}
