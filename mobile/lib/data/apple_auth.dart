import 'dart:io' show Platform;
import 'package:flutter/services.dart';

/// Native Sign in with Apple, bridged to the Swift handler in AppDelegate via a
/// MethodChannel (no plugin/pod needed — uses Apple's AuthenticationServices).
const MethodChannel _channel = MethodChannel('app.xyndrome.lk/apple_auth');

/// Apple requires Sign in with Apple only on Apple platforms; the button is
/// shown on iOS only. (Android would need the web OAuth flow — not wired.)
bool appleButtonVisible() => Platform.isIOS;

/// Result of a native Apple sign-in: the identity token plus, on the FIRST
/// sign-in only, the user's name (Apple never resends it afterwards).
class AppleCredential {
  final String identityToken;
  final String? fullName;
  const AppleCredential(this.identityToken, this.fullName);
}

/// Runs the system Sign in with Apple sheet. Returns the credential, or null if
/// the user cancels. Throws on a real failure.
Future<AppleCredential?> appleSignIn() async {
  final res = await _channel.invokeMethod('signIn');
  if (res == null) return null; // user cancelled
  final map = Map<String, dynamic>.from(res as Map);
  final token = (map['identityToken'] ?? '').toString();
  if (token.isEmpty) {
    throw StateError('Apple sign-in did not return an identity token.');
  }
  final name = (map['fullName'] ?? '').toString().trim();
  return AppleCredential(token, name.isEmpty ? null : name);
}
