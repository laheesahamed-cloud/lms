import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'features/results/reviewed_attempts.dart';
import 'features/subscriptions/iap_reconciler.dart';
import 'services/screen_protection.dart';
import 'theme/app_theme.dart';
import 'features/shell/blocked_placeholder.dart';
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
    ScreenProtection.onShowGapCover = _openGap;
    ScreenProtection.onHideGapCover = _closeGap;
    router.routeInformationProvider.addListener(_syncScreenProtection);
    router.routerDelegate.addListener(_syncScreenProtection);
    WidgetsBinding.instance.addPostFrameCallback((_) => _syncScreenProtection());
  }

  /// Boundary used to snapshot the protected screen for the shield.
  final GlobalKey _shieldBoundary = GlobalKey();

  /// True while the secure-text shield is being rebuilt. The placeholder is
  /// painted then — and because the capture-protected snapshot window sits on
  /// top, only a SCREENSHOT ever sees it. On screen nothing changes.
  bool _inGap = false;

  /// Sends the current frame to native, ready for the next resume.
  ///
  /// Pushed while the lesson is still on screen, so it reveals nothing that was
  /// not already visible. Skipped during the gap, which would otherwise
  /// snapshot the placeholder and show that to the student next time.
  Future<void> _pushSnapshot() async {
    if (_inGap || !ScreenProtection.secureModeOn) return;
    final ro = _shieldBoundary.currentContext?.findRenderObject();
    if (ro is! RenderRepaintBoundary) return;
    try {
      final view = WidgetsBinding.instance.platformDispatcher.views.first;
      final image = await ro.toImage(pixelRatio: view.devicePixelRatio);
      final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
      image.dispose();
      if (bytes == null) return;
      await ScreenProtection.updateSnapshot(bytes.buffer.asUint8List());
    } catch (_) {
      // A failed snapshot just means the shield cannot raise next time, and the
      // rebuild falls back to painting the placeholder visibly.
    }
  }

  Future<void> _openGap() async {
    // Shield first, placeholder second: the shield has to be covering the
    // screen before the content is swapped, or the swap is visible.
    final raised = await ScreenProtection.raiseShield();
    if (!mounted) return;
    setState(() => _inGap = true);
    if (!raised) {
      // No snapshot yet. The placeholder is then visible to the student — ugly,
      // but the alternative is leaving the lesson on screen unprotected.
      await ScreenProtection.trace('shield: no snapshot, placeholder visible');
    }
  }

  Future<void> _closeGap() async {
    if (!mounted) return;
    setState(() => _inGap = false);
    // Let Flutter actually present the real content again before the shield
    // comes down, or the snapshot is pulled away before there is anything
    // behind it.
    await WidgetsBinding.instance.endOfFrame;
    await Future<void>.delayed(const Duration(milliseconds: 32));
    await ScreenProtection.lowerShield();
  }

  void _syncScreenProtection() {
    final path = _router?.routeInformationProvider.value.uri.path ??
        _router?.routerDelegate.currentConfiguration.uri.path;
    if (path == null) return;
    ScreenProtection.syncForRoute(path);
    // A protected screen just opened: get a snapshot on its first frame so the
    // shield is never without one.
    WidgetsBinding.instance.addPostFrameCallback((_) => _pushSnapshot());
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
      // Capture protection does not survive the trip — see handleResume().
      ScreenProtection.handleResume();
    }
    // A rebuild must not land while the app is away: it produces a shield that
    // looks installed and protects nothing. See handleResume().
    ScreenProtection.noteForeground(state == AppLifecycleState.resumed);
    // Refresh the shield's frame on the way out, while the lesson is still
    // painted. Best effort: if the app suspends before this finishes, the
    // previous snapshot is used.
    if (state == AppLifecycleState.inactive ||
        state == AppLifecycleState.paused ||
        state == AppLifecycleState.hidden) {
      _pushSnapshot();
    }
    // Every transition, so a quick switch (which keeps protection) can be
    // compared against a long one (which loses it). The suspicion is that only
    // the long one reaches `paused`, where Flutter tears down its rendering
    // surface while it sits inside the secure canvas.
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
        child: Stack(
          children: [
            // The boundary wraps ONLY the content, never the placeholder.
            //
            // It used to wrap both, which caused the nastiest bug in this
            // feature: a snapshot taken anywhere near the moment the gap opens
            // would rasterise the PLACEHOLDER, and the shield then displayed
            // that on the next resume. The student saw "Screenshot blocked" on
            // screen while Flutter painted the real lesson underneath for the
            // capture to find — precisely inverted. Guarding the push on a flag
            // was not enough, because a push already in flight when the flag
            // flips still catches it. Structure is the fix, not a check.
            RepaintBoundary(
              key: _shieldBoundary,
              child: child ?? const SizedBox.shrink(),
            ),
            // Painted over the live content, which stays mounted, so scroll
            // offsets and in-progress canvas work are untouched.
            if (_inGap) const Positioned.fill(child: BlockedPlaceholder()),
          ],
        ),
      ),
    );
  }
}
