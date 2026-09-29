import 'dart:io' show Platform;
import 'package:flutter/services.dart';

/// Read-aloud for question approach text, iOS-only for now — bridged to
/// native `AVSpeechSynthesizer` via a hand-written MethodChannel rather than
/// a Flutter plugin, the same pattern used elsewhere in this app (see
/// ScreenProtection / StoreKitBridge): CocoaPods is unusable in this
/// project's build environment, so any pubspec dependency shipping native
/// iOS code fails the build.
class TtsService {
  TtsService._();

  static const MethodChannel _channel = MethodChannel('app.xyndrome.lk/tts');

  static bool get supported => Platform.isIOS;

  static Future<void> speak(String text) async {
    if (!supported || text.trim().isEmpty) return;
    try {
      await _channel.invokeMethod('speak', {'text': text});
    } on PlatformException {
      // No native bridge available — read-aloud simply does nothing.
    }
  }

  /// Which voice the student will actually hear: `premium`, `enhanced`,
  /// `compact` or `none`.
  ///
  /// Worth surfacing because iOS ships only the compact voice — the flat,
  /// obviously-synthetic one — and the good voices are a free per-device
  /// download the student has to make themselves. Without telling them,
  /// picking the best installed voice changes nothing on most phones.
  static Future<String> voiceQuality() async {
    if (!supported) return 'none';
    try {
      final q = await _channel.invokeMethod<String>('voiceQuality');
      return q ?? 'none';
    } on PlatformException {
      return 'none';
    } on MissingPluginException {
      // An older build of the native side without this method.
      return 'none';
    }
  }

  static Future<void> stop() async {
    if (!supported) return;
    try {
      await _channel.invokeMethod('stop');
    } on PlatformException {
      // ignored
    }
  }
}
