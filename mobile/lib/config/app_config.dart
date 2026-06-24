/// Runtime configuration. Override per environment with:
///   flutter run --dart-define=API_BASE_URL=https://xyndrome.lk/api
class AppConfig {
  static const String _defineBase =
      String.fromEnvironment('API_BASE_URL', defaultValue: '');

  /// The live production API origin (HTTPS). The web app's same-origin "/api"
  /// does not exist for a native app, so this must be an absolute HTTPS origin.
  static const String productionBaseUrl = 'https://xyndrome.lk/api';

  /// Absolute API origin. Always the live HTTPS production API, in every build,
  /// unless explicitly overridden with `--dart-define=API_BASE_URL=...` (e.g. to
  /// point at a local dev server). No cleartext/localhost default — HTTPS only.
  static String get apiBaseUrl =>
      _defineBase.isNotEmpty ? _defineBase : productionBaseUrl;

  /// iOS Google OAuth client id — baked in because iOS requires it registered in
  /// the Info.plist URL scheme at build time (can't be runtime-only). Public
  /// value, not a secret. The WEB/server client id is intentionally NOT here —
  /// the app reads it live from the server (`/settings/public`) so it can change
  /// without an app rebuild. Override per-build with --dart-define if ever needed.
  static const String googleIosClientId = String.fromEnvironment(
    'GOOGLE_IOS_CLIENT_ID',
    defaultValue:
        '660151858831-jdgfe43ohnqvqicsspa775eql9bmngmi.apps.googleusercontent.com',
  );

  static const Duration apiTimeout = Duration(seconds: 10);
  static const int retryCount = 2;
  static const Duration retryDelay = Duration(milliseconds: 500);

  static const String appName = 'xyndrome';
  static const String bundleId = 'app.xyndrome.lk';
}
