import 'package:flutter/foundation.dart';

/// Runtime configuration. Override per environment with:
///   flutter run --dart-define=API_BASE_URL=https://api.xyndrome.lk/api
class AppConfig {
  static const String _defineBase =
      String.fromEnvironment('API_BASE_URL', defaultValue: '');

  /// Absolute API origin. Native production builds MUST pass an absolute
  /// HTTPS origin via --dart-define (the web app's same-origin "/api" does
  /// not exist for a native app).
  static String get apiBaseUrl {
    if (_defineBase.isNotEmpty) return _defineBase;
    // Dev defaults (§7.1).
    if (defaultTargetPlatform == TargetPlatform.android && !kIsWeb) {
      return 'http://10.0.2.2:3000/api'; // Android emulator bridge
    }
    return 'http://localhost:3000/api'; // iOS sim / web dev
  }

  static const Duration apiTimeout = Duration(seconds: 10);
  static const int retryCount = 2;
  static const Duration retryDelay = Duration(milliseconds: 500);

  static const String appName = 'xyndrome';
  static const String bundleId = 'app.xyndrome.lk';

  /// Web origin for the external PayHere checkout (§14). Override with
  /// --dart-define=WEB_BASE=https://your-domain. (Exact path = open item §18.)
  static const String webBase =
      String.fromEnvironment('WEB_BASE', defaultValue: 'https://xyndrome.lk');
  static String checkoutUrl(String planId) =>
      '$webBase/app/subscriptions/checkout/$planId';
}
