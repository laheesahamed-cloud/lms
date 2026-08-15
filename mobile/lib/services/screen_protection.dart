import 'dart:io' show Platform;
import 'package:flutter/services.dart';

/// Screen-capture protection, bridged to the native layer.
///
/// The two platforms are genuinely not equivalent, and this API does not
/// pretend otherwise:
///
/// * **Android** — `FLAG_SECURE` is a hard block. The OS refuses the
///   screenshot, recordings and casts come out black, and the recents
///   thumbnail is hidden.
/// * **iOS** — screenshots **cannot** be blocked; Apple exposes no API for it.
///   What works is covering the screen while it is being recorded or mirrored,
///   covering the app-switcher snapshot, and being *told* after a screenshot
///   was taken.
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

  /// Fired when screen recording or AirPlay mirroring starts or stops (iOS).
  static void Function(bool capturing)? onCaptureStateChanged;

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
      switch (call.method) {
        case 'screenshotTaken':
          onScreenshotTaken?.call();
          break;
        case 'captureStateChanged':
          final m = Map<String, dynamic>.from(call.arguments as Map? ?? {});
          onCaptureStateChanged?.call(m['captured'] == true);
          break;
      }
      return null;
    });
  }
}
