import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

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
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Coming back from the background: re-check the session so an expired
    // token sends us to login automatically (no close-and-reopen needed).
    if (state == AppLifecycleState.resumed) {
      ref.read(authControllerProvider.notifier).revalidateSession();
    }
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(goRouterProvider);
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
