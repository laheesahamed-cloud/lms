import 'dart:io' show Platform;
import 'package:google_sign_in/google_sign_in.dart';
import '../config/app_config.dart';

/// Whether to show the "Continue with Google" button.
/// [serverGoogleConfigured] comes live from the server (`/settings/public`).
/// iOS additionally needs its own client id baked into the build (Info.plist).
bool googleButtonVisible(bool serverGoogleConfigured) {
  if (!serverGoogleConfigured) return false;
  if (Platform.isIOS) return AppConfig.googleIosClientId.isNotEmpty;
  return true; // Android signs in with the server (web) client id only
}

/// Runs native Google sign-in and returns a fresh Google ID token for
/// `POST /auth/google`. Returns null if the user cancels; throws on failure.
///
/// [serverClientId] is the web/server client id read live from the server, so
/// it's never hardcoded. On iOS the SDK also reads `GIDClientID` from Info.plist
/// (baked at build — required by iOS for the OAuth redirect).
Future<String?> googleSignInIdToken({required String serverClientId}) async {
  if (serverClientId.isEmpty) {
    throw StateError('Google sign-in is not configured on the server.');
  }
  final google = GoogleSignIn(
    scopes: const ['email', 'profile', 'openid'],
    serverClientId: serverClientId,
  );
  // Always show the account picker rather than silently reusing the last one.
  await google.signOut();
  final account = await google.signIn();
  if (account == null) return null; // user cancelled
  final auth = await account.authentication;
  final idToken = auth.idToken;
  if (idToken == null || idToken.isEmpty) {
    throw StateError('Google sign-in did not return an ID token.');
  }
  return idToken;
}
