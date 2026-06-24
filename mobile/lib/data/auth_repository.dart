import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'api_client.dart';
import 'models.dart';

class AuthResult {
  final String token;
  final AppUser user;
  AuthResult(this.token, this.user);
}

/// Talks to the existing NestJS auth endpoints (§4 / §8). Same backend + DB.
class AuthRepository {
  final ApiClient api;
  AuthRepository(this.api);

  Future<AuthResult> login(String email, String password) async {
    final r = await api.dio
        .post('/auth/login', data: {'email': email, 'password': password});
    return _withCookieToken(r, _parse(r.data));
  }

  Future<AuthResult> register({
    required String fullName,
    required String email,
    required String password,
    required String confirmPassword,
    required bool acceptedTerms,
  }) async {
    final r = await api.dio.post('/auth/register', data: {
      'fullName': fullName,
      'email': email,
      'password': password,
      'confirmPassword': confirmPassword,
      'acceptedTerms': acceptedTerms,
    });
    return _withCookieToken(r, _parse(r.data));
  }

  /// Signs in (or auto-creates the account) with a Google ID token, mirroring
  /// the web flow. Same session handling as [login] (cookie -> Bearer).
  Future<AuthResult> loginWithGoogle(String idToken) async {
    final r = await api.dio.post('/auth/google', data: {'credential': idToken});
    return _withCookieToken(r, _parse(r.data));
  }

  Future<AppUser> me() async {
    final r = await api.dio.get('/auth/me');
    final data = r.data;
    final u = (data is Map && data['user'] != null) ? data['user'] : data;
    return AppUser.fromJson(Map<String, dynamic>.from(u as Map));
  }

  Future<AppUser> updateProfile({
    required String fullName,
    String? avatarKey,
  }) async {
    final r = await api.dio.patch('/auth/profile', data: {
      'fullName': fullName,
      if (avatarKey != null && avatarKey.isNotEmpty) 'avatarKey': avatarKey,
    });
    final data = r.data;
    final u = (data is Map && data['user'] != null) ? data['user'] : data;
    return AppUser.fromJson(Map<String, dynamic>.from(u as Map));
  }

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
    required String confirmPassword,
  }) =>
      api.dio.patch('/auth/password', data: {
        'currentPassword': currentPassword,
        'newPassword': newPassword,
        'confirmPassword': confirmPassword,
      });

  /// Requests a reset link. Returns the backend's message (which is the same
  /// privacy-safe copy the web app shows).
  Future<String> forgotPassword(String email) async {
    final r =
        await api.dio.post('/auth/forgot-password', data: {'email': email.trim()});
    final m = (r.data is Map) ? Map<String, dynamic>.from(r.data) : {};
    return (m['message'] ??
            'If an account exists for that email, a reset link is on its way.')
        .toString();
  }

  /// Completes a reset. The backend (`ResetPasswordDto`) requires the new
  /// password twice — sending `password` alone silently fails validation.
  Future<void> resetPassword(
    String token,
    String newPassword,
    String confirmPassword,
  ) =>
      api.dio.post('/auth/reset-password', data: {
        'token': token,
        'newPassword': newPassword,
        'confirmPassword': confirmPassword,
      });

  Future<void> logout() async {
    try {
      await api.dio.post('/auth/logout');
    } catch (_) {
      // best-effort; local token is cleared regardless
    }
  }

  /// Permanently deletes the signed-in account (server soft-deletes: scrambles
  /// the email + sets deleted_at, and clears the session cookie).
  Future<void> deleteAccount() async {
    await api.dio.delete('/auth/account');
  }

  AuthResult _parse(dynamic data) {
    final m = Map<String, dynamic>.from(data as Map);
    final token = (m['sessionToken'] ?? m['token'] ?? '').toString();
    final u = m['user'] ?? m;
    return AuthResult(token, AppUser.fromJson(Map<String, dynamic>.from(u as Map)));
  }

  /// The backend strips `sessionToken` from the login/register body and only
  /// sets the httpOnly `lms_session` cookie. A native HTTP client (unlike a
  /// browser) can still read it from the `Set-Cookie` response header, and the
  /// backend accepts it as `Authorization: Bearer <sessionToken>`. So when the
  /// body has no token, fall back to the cookie value.
  AuthResult _withCookieToken(Response r, AuthResult parsed) {
    if (parsed.token.isNotEmpty) return parsed;
    final cookies = r.headers.map['set-cookie'] ?? const <String>[];
    for (final c in cookies) {
      final m = RegExp(r'lms_session=([^;]+)').firstMatch(c);
      if (m != null && m.group(1)!.isNotEmpty) {
        return AuthResult(Uri.decodeComponent(m.group(1)!), parsed.user);
      }
    }
    return parsed;
  }
}

final authRepositoryProvider =
    Provider<AuthRepository>((ref) => AuthRepository(ref.read(apiClientProvider)));
