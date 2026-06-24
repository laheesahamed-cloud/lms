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
  final prefs = await SharedPreferences.getInstance();
  runApp(
    ProviderScope(
      overrides: [sharedPrefsProvider.overrideWithValue(prefs)],
      child: const XyndromeApp(),
    ),
  );
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
      themeMode: ref.watch(themeModeProvider), // student choice (default dark)
      routerConfig: router,
      // Tap anywhere outside a focused field to dismiss the keyboard.
      builder: (context, child) => GestureDetector(
        behavior: HitTestBehavior.translucent,
        onTap: () => FocusManager.instance.primaryFocus?.unfocus(),
        child: child,
      ),
    );
  }
}
