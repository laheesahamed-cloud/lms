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

  /// WEB/server Google OAuth client id (the ID-token audience the backend
  /// verifies). Baked in as an INSTANT fallback so the Google button shows and
  /// works on the very first launch without waiting for `/settings/public`. The
  /// live server value still takes over once it loads, so it can change without a
  /// rebuild — only this fallback needs a rebuild if the id ever changes.
  /// Override per-build with --dart-define=GOOGLE_WEB_CLIENT_ID=...
  static const String googleWebClientId = String.fromEnvironment(
    'GOOGLE_WEB_CLIENT_ID',
    defaultValue:
        '660151858831-1d6dphmbff8ia7s285o21g4e1mjjf4u5.apps.googleusercontent.com',
  );

  static const Duration apiTimeout = Duration(seconds: 10);
  static const int retryCount = 2;
  static const Duration retryDelay = Duration(milliseconds: 500);

  static const String appName = 'xyndrome';
  static const String bundleId = 'app.xyndrome.lk';
}
