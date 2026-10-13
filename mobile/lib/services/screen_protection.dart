import 'dart:io' show File, FileMode, Platform;

import 'package:path_provider/path_provider.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart' show WidgetsBinding;

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

  /// Whether a protected screen is currently shielded — read on resume to
  /// decide whether recovery is needed at all.
  static bool get secureModeOn => _secureModeOn;

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

  /// The last path [syncForRoute] acted on, so [handleResume] can replay it
  /// through this same code path rather than calling the channel directly.
  static String? _lastSyncedPath;

  static Future<void> syncForRoute(String path) async {
    if (!supported || !Platform.isIOS || !_iosSecureViewEnabled) return;
    _lastSyncedPath = path;
    final shouldProtect = shouldProtectPath(path);
    if (shouldProtect == _secureModeOn) return;
    _secureModeOn = shouldProtect;
    if (shouldProtect) {
      await enableSecureMode();
    } else {
      await disableSecureMode();
    }
  }

  /// Re-applies protection after the app comes back from the background.
  ///
  /// Protection dies across a background trip: screenshots start saving again
  /// on the very screen that was blocked a moment earlier. The native view
  /// tree is provably fine — the Flutter view is still inside the secure
  /// canvas, the field still in the window, `isSecureTextEntry` still true,
  /// same canvas object, correct frames.
  ///
  /// A native `UILabel` placed inside that same canvas is ALSO captured after
  /// the trip, which rules out Flutter's render surface: the whole secure
  /// container loses its exclusion, so nothing done on the Flutter side can
  /// restore it.
  ///
  /// Six native rebuilds failed to get it back — toggling `isSecureTextEntry`
  /// (which does not even rebuild the canvas), a same-turn teardown/rebuild
  /// (which broke blocking outright), 80ms-separated, `CADisplayLink`
  /// frame-separated, and one with activation settled and the torn-down state
  /// held 350ms. Each produced a new, correctly parented canvas; captures still
  /// went through.
  ///
  /// Yet leaving for the dashboard and coming back restores it every time,
  /// through these same two calls. Two differences from the attempts above
  /// remain untested, and this tries both at once:
  ///
  ///  * it runs through [syncForRoute], the exact path a navigation takes,
  ///    rather than calling the channel directly;
  ///  * the gap is seconds, not milliseconds — as long as a student actually
  ///    spends on the dashboard before coming back.
  ///
  /// NOTE: content is unprotected during that gap. Acceptable while testing
  /// whether the gap is the variable at all; an opaque cover goes in front
  /// before this ships.
  static Future<void> handleResume() async {
    if (!supported || !Platform.isIOS || !_iosSecureViewEnabled) return;
    // `_pendingReprotect` outlives a failed attempt on purpose. Keying this off
    // `_secureModeOn` alone was a bug: the first resume clears that flag before
    // its gap, so a second resume arriving mid-gap saw "nothing protected" and
    // did nothing at all.
    final path = _pendingReprotect ?? (_secureModeOn ? _lastSyncedPath : null);
    if (path == null) return;
    _pendingReprotect = path;

    // Newest attempt wins. Closing and reopening the app several times in
    // quick succession used to leave several of these interleaved, each
    // tearing down and rebuilding over the others.
    final attempt = ++_recoveryAttempt;

    // Part of the sequence that was measured to work — do not drop it.
    await WidgetsBinding.instance.endOfFrame;
    onShowGapCover?.call();
    try {
      await disableSecureMode();
      // Clearing the mirror is what lets syncForRoute act instead of no-opping.
      _secureModeOn = false;
      await Future<void>.delayed(_resumeGap);

      // Abandon rather than rebuild into nothing. Rebuilding while the app is
      // backgrounded — which is what happened when the app was closed again
      // mid-gap — produces a field that never registers with the render
      // server, and marking protection ON then was the fatal part: nothing
      // retried, and the lesson stayed capturable until the route changed.
      // Rapidly closing and reopening three to five times reproduced it every
      // time.
      if (attempt != _recoveryAttempt || !_foreground) return;

      await syncForRoute(path);
      // Cleared only here, so an abandoned attempt is retried on the next
      // resume instead of being forgotten.
      _pendingReprotect = null;
    } finally {
      onHideGapCover?.call();
    }
  }

  /// Wired up in main() to show and hide the gap cover. Callbacks rather than a
  /// direct dependency, so this service stays free of widgets.
  static void Function()? onShowGapCover;
  static void Function()? onHideGapCover;

  /// Protected route still owing a rebuild. Survives abandoned attempts.
  static String? _pendingReprotect;

  /// Bumped per attempt so a later resume supersedes an in-flight one.
  static int _recoveryAttempt = 0;

  /// Whether the app is foregrounded right now. A rebuild that lands while it
  /// is not produces a shield that looks installed and protects nothing.
  static bool _foreground = true;

  static void noteForeground(bool value) => _foreground = value;

  /// How long the torn-down state is held before protection is rebuilt.
  ///
  /// Not a tuning knob — it IS the fix. Six native rebuilds separated by
  /// 0–350ms all failed; this works because it is roughly the gap a student
  /// leaving for another screen actually produces. Shortening or lengthening
  /// it silently breaks captures, so it cannot be changed without a device
  /// re-test.
  static const Duration _resumeGap = Duration(milliseconds: 1200);

  /// Known limitation: this recovers protection after a SHORT suspension
  /// (around a second, the common case — glancing at a notification, a quick
  /// app switch). It does NOT recover it after a long one: ~18s in another app
  /// and captures go through, with the lifecycle trace and this whole recovery
  /// running identically to the case that works. Suspension duration is the
  /// only variable that separates them, and no amount of extra delay here
  /// changes the outcome. Leaving the lesson and coming back still restores it.

  /// Appends a line to a trace file inside the app's own container, and also
  /// sends it to the console via NSLog.
  ///
  /// The file is the part that matters. Two earlier experiments produced no
  /// evidence at all and looked like they had never run: Dart's `debugPrint`
  /// is invisible in a release build, and `devicectl --console` only follows
  /// the process it launched itself — so a force-quit and reopen, which is the
  /// natural thing to do after installing a build, silently detaches it. A
  /// file survives all of that and can be pulled off the device afterwards.
  static Future<void> trace(String message) async {
    if (!supported || !Platform.isIOS) return;
    final line = '${DateTime.now().toIso8601String()}  $message';
    try {
      await _channel.invokeMethod('log', message);
    } catch (_) {
      // Android has no handler; nothing to trace there.
    }
    try {
      final dir = await getApplicationDocumentsDirectory();
      await File('${dir.path}/xysec.log')
          .writeAsString('$line\n', mode: FileMode.append, flush: true);
    } catch (_) {
      // Tracing must never be the reason something fails.
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
