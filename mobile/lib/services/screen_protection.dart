import 'dart:io' show Platform;
import 'package:flutter/services.dart';

/// Screen-capture protection, bridged to the native layer.
///
/// * **Android** — `FLAG_SECURE` is a hard block, on for the whole app once
///   [enable] is called. The OS refuses the screenshot, recordings and casts
///   come out black, and the recents thumbnail is hidden.
/// * **iOS** — [enable] only turns on *detection* (a brief on-screen notice
///   after the fact — the real screenshot still saves normally). Real
///   blocking is a separate, screen-scoped toggle: [enableSecureMode] /
///   [disableSecureMode], meant to wrap quiz/exam screens specifically,
///   using the same undocumented technique WhatsApp uses for its own
///   protected screens. See `SecureQuizMode.swift` for how.
///
/// Use [capabilities] rather than assuming, so nothing in the UI claims a
/// screenshot was prevented on a platform where it wasn't.
const MethodChannel _channel = MethodChannel('app.xyndrome.lk/screen_protection');

class ScreenProtectionCapabilities {
  final bool blocksScreenshots;
  final bool blocksRecording;
  final bool hidesInAppSwitcher;
  final bool detectsScreenshots;

  const ScreenProtectionCapabilities({
    required this.blocksScreenshots,
    required this.blocksRecording,
    required this.hidesInAppSwitcher,
    required this.detectsScreenshots,
  });

  static const none = ScreenProtectionCapabilities(
    blocksScreenshots: false,
    blocksRecording: false,
    hidesInAppSwitcher: false,
    detectsScreenshots: false,
  );

  factory ScreenProtectionCapabilities.fromMap(Map<dynamic, dynamic> raw) {
    final m = Map<String, dynamic>.from(raw);
    return ScreenProtectionCapabilities(
      blocksScreenshots: m['blocksScreenshots'] == true,
      blocksRecording: m['blocksRecording'] == true,
      hidesInAppSwitcher: m['hidesInAppSwitcher'] == true,
      detectsScreenshots: m['detectsScreenshots'] == true,
    );
  }
}

class ScreenProtection {
  ScreenProtection._();

  static bool _enabled = false;
  static bool _handlerAttached = false;

  /// Fired on iOS *after* a screenshot has been saved. There is no way to stop
  /// it — this exists so the app can tell the user it was noticed.
  static void Function()? onScreenshotTaken;

  static bool get supported => Platform.isAndroid || Platform.isIOS;
  static bool get isEnabled => _enabled;

  /// Turn protection on. Safe to call more than once.
  static Future<void> enable() async {
    if (!supported || _enabled) return;
    _attachHandler();
    try {
      await _channel.invokeMethod('enable');
      _enabled = true;
    } on PlatformException {
      // Never let protection setup break app start.
    }
  }

  /// Turn protection off — e.g. if you ever want to allow captures on a
  /// specific screen.
  static Future<void> disable() async {
    if (!supported || !_enabled) return;
    try {
      await _channel.invokeMethod('disable');
      _enabled = false;
    } on PlatformException {
      // ignored
    }
  }

  /// Genuinely blanks the app's content in any real screenshot or recording,
  /// scoped to whatever screen is on top when this is called (iOS only —
  /// Android is already fully protected app-wide once [enable] runs). Call
  /// when a quiz/exam screen opens.
  static Future<void> enableSecureMode() async {
    if (!supported) return;
    try {
      await _channel.invokeMethod('enableSecureMode');
    } catch (_) {
      // Android has no handler for this method (it's already protected
      // app-wide by FLAG_SECURE) — that surfaces as MissingPluginException,
      // not PlatformException, hence the broad catch here.
    }
  }

  /// Pairs with [enableSecureMode]. Call when leaving that screen so the
  /// rest of the app is unaffected.
  static Future<void> disableSecureMode() async {
    if (!supported) return;
    try {
      await _channel.invokeMethod('disableSecureMode');
    } catch (_) {
      // Same MissingPluginException case on Android — see enableSecureMode.
    }
  }

  /// Navigation-level pages that are deliberately NOT capture-protected:
  /// the hubs and list screens, which hold no purchased content — only
  /// navigation, progress and account info. Everything else (lessons, quiz
  /// taking, flashcards, ECG, drugs, saved items, note detail …) stays
  /// protected.
  ///
  /// Matched exactly, so `/app/quizzes` (the Q-Bank list) is open while
  /// `/app/quizzes/123` (actually sitting the quiz) is protected.
  static const Set<String> _unprotectedPaths = <String>{
    '/app/dashboard', // Study Hub
    '/app/quizzes', // Q-Bank list
    '/app/courses', // Courses list
    '/app/study', // Study hub
    '/app/results', // Results list
    '/app/profile',
    '/app/profile/edit',
    '/app/profile/password',
  };

  /// Routes that actually show purchased content. Protection is an **allowlist**
  /// rather than "everything except the hubs" — deliberately.
  ///
  /// With a denylist, `/splash` and `/auth/login` counted as protected, so the
  /// view got re-parented during early startup before the hierarchy had
  /// settled, and the app came up blank white. An allowlist means anything not
  /// listed here (splash, login, auth, subscriptions, notifications) is simply
  /// left alone — which is also correct on the merits: none of those screens
  /// carry content worth protecting.
  static const List<String> _protectedPrefixes = <String>[
    '/app/lessons',
    '/app/study/lesson',
    '/app/quizzes/', // a specific quiz — the list itself stays open
    '/app/courses/', // a specific course
    '/app/results/', // a specific result
    '/app/qbank',
    '/app/exams',
    '/app/review',
    '/app/exam-complete',
    '/app/flashcards',
    '/app/my-flashcards',
    '/app/my-notes',
    '/app/canvas',
    '/app/ecg',
    '/app/auscultation',
    '/app/drugs',
    '/app/planner',
    '/app/bookmarks',
  ];

  /// Mirrors the native state, which starts off.
  static bool _secureModeOn = false;

  static bool shouldProtectPath(String path) {
    final normalized = path.split('?').first.replaceAll(RegExp(r'/+$'), '');
    final route = normalized.isEmpty ? '/' : normalized;
    if (_unprotectedPaths.contains(route)) return false;
    return _protectedPrefixes.any(
      (prefix) => route == prefix || route.startsWith(prefix),
    );
  }

  /// Turn capture protection on/off to match [path]. Only acts on an actual
  /// change: re-parenting the view is visually disruptive, so calling this on
  /// every navigation must be cheap when the state is already correct.
  /// Kill switch for the iOS secure-view re-parenting.
  ///
  /// `SecureQuizMode.enable()` moves Flutter's rendering view into a secure
  /// text field's canvas — synchronous UIKit work on the main thread, run
  /// exactly when a protected screen is being pushed. It has repeatedly
  /// destabilised the app (blank launches, dead touch input, slow navigation,
  /// lesson screens rendering as a dead end).
  ///
  /// Android is unaffected: FLAG_SECURE is a real OS block and stays on.
  /// iOS keeps screenshot *detection*. Flip this to true only to re-test the
  /// re-parenting on a device.
  static const bool _iosSecureViewEnabled = true;

  static Future<void> syncForRoute(String path) async {
    if (!supported || !Platform.isIOS || !_iosSecureViewEnabled) return;
    final shouldProtect = shouldProtectPath(path);
    if (shouldProtect == _secureModeOn) return;
    _secureModeOn = shouldProtect;
    if (shouldProtect) {
      await enableSecureMode();
    } else {
      await disableSecureMode();
    }
  }

  /// What this platform can actually do. Read it instead of guessing.
  static Future<ScreenProtectionCapabilities> capabilities() async {
    if (!supported) return ScreenProtectionCapabilities.none;
    try {
      final res = await _channel.invokeMethod('capabilities');
      if (res is Map) return ScreenProtectionCapabilities.fromMap(res);
    } on PlatformException {
      // fall through
    }
    return ScreenProtectionCapabilities.none;
  }

  static void _attachHandler() {
    if (_handlerAttached) return;
    _handlerAttached = true;
    _channel.setMethodCallHandler((call) async {
      if (call.method == 'screenshotTaken') onScreenshotTaken?.call();
      return null;
    });
  }
}
