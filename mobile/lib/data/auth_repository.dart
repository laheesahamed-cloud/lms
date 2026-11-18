import '../state/notice_store.dart';
import '../state/catalogue.dart' show savedProgressVersion;
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'api_client.dart';
import 'models.dart';

class AuthResult {
  final String token;
  final AppUser user;
  /// Phone sign-in only (step 5): what the first screen needs — Study Hub top,
  /// notices, announcements, catalogue version — so no follow-up requests.
  final Map? start;
  AuthResult(this.token, this.user, {this.start});
}

/// Result of a login/register call: EITHER a live session, OR a pending email
/// verification (the backend withholds the session until the student confirms a
/// 6-digit code — mirrors the web flow).
class AuthOutcome {
  final AuthResult? session;
  final String? verifyEmail; // non-null when OTP verification is required
  final String? devCode; // dev/local only (no SMTP) — backend echoes the code

  const AuthOutcome.session(AuthResult this.session)
      : verifyEmail = null,
        devCode = null;
  const AuthOutcome.verify(this.verifyEmail, this.devCode) : session = null;

  bool get needsVerification => verifyEmail != null;
}

/// Talks to the existing NestJS auth endpoints (§4 / §8). Same backend + DB.
class AuthRepository {
  final ApiClient api;
  AuthRepository(this.api);

  Future<AuthOutcome> login(String email, String password) async {
    final r = await api.dio.post('/auth/login',
        data: {'email': email, 'password': password}, options: await _signInOptions());
    return _outcome(r);
  }

  Future<AuthOutcome> register({
    required String fullName,
    required String email,
    required String password,
    required String confirmPassword,
    required bool acceptedTerms,
    required String country,
    required String university,
  }) async {
    final r = await api.dio.post('/auth/register', data: {
      'fullName': fullName,
      'email': email,
      'universityCountry': country,
      'university': university,
      'password': password,
      'confirmPassword': confirmPassword,
      'acceptedTerms': acceptedTerms,
    });
    return _outcome(r);
  }

  /// Verify the 6-digit onboarding code. On success the backend returns a normal
  /// session payload (token via body or `lms_session` cookie), exactly like login.
  Future<AuthResult> verifyEmailOtp(String email, String code) async {
    final r = await api.dio.post('/auth/verify-email-otp',
        data: {'email': email, 'code': code}, options: await _signInOptions());
    return _withCookieToken(r, _parse(r.data));
  }

  /// Re-send the verification code. Returns `retryAfterSeconds` when the backend
  /// is still within its resend cooldown, otherwise null.
  Future<int?> resendEmailOtp(String email) async {
    final r =
        await api.dio.post('/auth/resend-email-otp', data: {'email': email});
    final m = (r.data is Map) ? Map<String, dynamic>.from(r.data) : {};
    final retry = m['retryAfterSeconds'];
    return (retry is num) ? retry.toInt() : null;
  }

  /// Signs in (or auto-creates the account) with a Google ID token, mirroring
  /// the web flow. Same session handling as [login] (cookie -> Bearer).
  Future<AuthResult> loginWithGoogle(String idToken) async {
    final r = await api.dio.post('/auth/google', data: {'credential': idToken}, options: await _signInOptions());
    return _withCookieToken(r, _parse(r.data));
  }

  /// Signs in (or auto-creates the account) with a native Sign in with Apple
  /// identity token. [fullName] is sent only on the user's first Apple sign-in
  /// (Apple omits it afterwards). Same session handling as [login].
  Future<AuthResult> loginWithApple(String identityToken, {String? fullName}) async {
    final r = await api.dio.post('/auth/apple', data: {
      'identityToken': identityToken,
      if (fullName != null && fullName.isNotEmpty) 'fullName': fullName,
    }, options: await _signInOptions());
    return _withCookieToken(r, _parse(r.data));
  }

  /// The ONE cold-open request (OPTIMIZE 10.2 #2): renews the access token and
  /// returns the user, the catalogue version and Study Hub in one reply.
  /// [lastNoticeId]: the newest notice this phone holds, so the reply carries
  /// only newer ones (plus the active in-app announcements).
  Future<({AppUser user, Object? dashboard, int? contentVersion, Map raw})> start({int lastNoticeId = 0}) async {
    // Finished-lessons bitmap (10.14): the reply carries it only if ours is out of date.
    final have = await savedProgressVersion();
    final r = await api.dio.post('/app/start', data: {
      'lastNoticeId': lastNoticeId,
      'progressFormat': 'bits',
      'progressVersion': ?have,
    });
    final data = r.data as Map;
    return (
      user: AppUser.fromJson(Map<String, dynamic>.from(data['user'] as Map)),
      dashboard: data['dashboard'],
      contentVersion: (data['contentVersion'] as num?)?.toInt(),
      raw: data,
    );
  }

  Future<AppUser> updateProfile({
    AppUser? current,
    required String fullName,
    String? avatarKey,
    String? country,
    String? university,
  }) async {
    final r = await api.dio.patch('/auth/profile', data: {
      'fullName': fullName,
      if (avatarKey != null && avatarKey.isNotEmpty) 'avatarKey': avatarKey,
      if (country != null && country.isNotEmpty) 'universityCountry': country,
      if (university != null && university.isNotEmpty) 'university': university,
    });
    final data = r.data;
    final u = (data is Map && data['user'] != null) ? data['user'] : data;
    final m = Map<String, dynamic>.from(u as Map);
    // 2026-11-17: the server sends the phone only the changed fields (one
    // UPDATE, no reads); the rest of the user is kept from the current copy.
    if (current != null && m['email'] == null) {
      return current.copyWith(
        fullName: (m['fullName'] as String?) ?? fullName,
        avatarKey: (m['avatarKey'] as String?) ?? avatarKey,
        needsProfileSetup: m['needsProfileSetup'] == true,
      );
    }
    return AppUser.fromJson(m);
  }

  /// Records that the welcome screen was answered without changing the name —
  /// what Skip calls. Returns the account as the server now sees it.
  Future<AppUser> completeProfileSetup() async {
    final r = await api.dio.post('/auth/profile-setup/complete');
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
    // Best-effort; the local token is cleared regardless. A request that never
    // reached the server (no response — e.g. a stale connection after a server
    // restart) is tried once more, so the server session is really ended.
    for (var attempt = 0; attempt < 2; attempt++) {
      try {
        await api.dio.post('/auth/logout');
        return;
      } on DioException catch (e) {
        if (e.response != null) return; // the server answered: nothing to retry
      } catch (_) {
        return;
      }
    }
  }

  /// Permanently deletes the signed-in account (server soft-deletes: scrambles
  /// the email + sets deleted_at, and clears the session cookie).
  Future<void> deleteAccount() async {
    await api.dio.delete('/auth/account');
  }

  /// Distinguishes a verification-required response from a real session.
  /// The newest notice this phone holds for the last account, so the sign-in
  /// reply carries only newer ones.
  Future<Options> _signInOptions() async {
    // The last account's saved bitmap version ("userId:version"): the server
    // answers "unchanged" only for that same account (10.14).
    final last = await NoticeStore.lastAccount();
    final have = last == null ? null : await savedProgressVersion(uid: last);
    return Options(headers: {
      'X-Last-Notice-Id': '${await NoticeStore.lastIdForLastAccount()}',
      'X-Progress-Format': 'bits',
      'X-Progress-Version': ?have,
    });
  }

  AuthOutcome _outcome(Response r) {
    final m = (r.data is Map) ? Map<String, dynamic>.from(r.data) : {};
    if (m['emailVerificationRequired'] == true) {
      return AuthOutcome.verify(
        (m['email'] ?? '').toString(),
        m['devCode']?.toString(),
      );
    }
    return AuthOutcome.session(_withCookieToken(r, _parse(r.data)));
  }

  AuthResult _parse(dynamic data) {
    final m = Map<String, dynamic>.from(data as Map);
    final token = (m['sessionToken'] ?? m['token'] ?? '').toString();
    final u = m['user'] ?? m;
    return AuthResult(token, AppUser.fromJson(Map<String, dynamic>.from(u as Map)),
        start: m['start'] is Map ? m['start'] as Map : null);
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
        return AuthResult(Uri.decodeComponent(m.group(1)!), parsed.user, start: parsed.start);
      }
    }
    return parsed;
  }
}

final authRepositoryProvider =
    Provider<AuthRepository>((ref) => AuthRepository(ref.read(apiClientProvider)));
