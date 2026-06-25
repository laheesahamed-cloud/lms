import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../config/app_config.dart';
import '../data/api_client.dart';
import '../data/auth_repository.dart';
import '../data/google_auth.dart';
import '../data/public_settings.dart';
import '../data/models.dart';
import '../data/secure_store.dart';
import '../services/push.dart';

/// Mirrors the web authStore keys (§8): token, user, isAuthenticated,
/// isHydrating, error.
class AuthState {
  final bool isHydrating;
  final bool isAuthenticated;
  final AppUser? user;
  final String? token;
  final String? error;

  const AuthState({
    this.isHydrating = false,
    this.isAuthenticated = false,
    this.user,
    this.token,
    this.error,
  });

  AuthState copyWith({
    bool? isHydrating,
    bool? isAuthenticated,
    AppUser? user,
    String? token,
    String? error,
  }) =>
      AuthState(
        isHydrating: isHydrating ?? this.isHydrating,
        isAuthenticated: isAuthenticated ?? this.isAuthenticated,
        user: user ?? this.user,
        token: token ?? this.token,
        error: error,
      );
}

/// Outcome the auth pages branch on: signed in, needs email verification, or
/// failed (with the error already surfaced via [AuthState.error]).
class AuthAttempt {
  final bool signedIn;
  final String? verifyEmail; // non-null → route to the verify-email screen
  final String? devCode;
  const AuthAttempt({this.signedIn = false, this.verifyEmail, this.devCode});
}

class AuthController extends Notifier<AuthState> {
  @override
  AuthState build() {
    final api = ref.read(apiClientProvider);
    api.onUnauthorized = _onUnauthorized;
    Push.init(api);
    Future.microtask(_hydrate);
    return const AuthState(isHydrating: true);
  }

  ApiClient get _api => ref.read(apiClientProvider);
  AuthRepository get _repo => ref.read(authRepositoryProvider);

  Future<void> _hydrate() async {
    final token = await SecureStore.readToken();
    if (token == null || token.isEmpty) {
      state = const AuthState(isHydrating: false);
      return;
    }
    _api.setToken(token);
    try {
      final user = await _repo.me();
      state = AuthState(
          isHydrating: false,
          isAuthenticated: true,
          user: user,
          token: token);
      Push.onAuthenticated();
    } catch (_) {
      await SecureStore.clear();
      _api.setToken(null);
      state = const AuthState(isHydrating: false);
    }
  }

  void _onUnauthorized() {
    SecureStore.clear();
    _api.setToken(null);
    state = const AuthState(isHydrating: false, error: 'Your session expired.');
  }

  /// Re-check the session when the app returns to the foreground. If the token
  /// expired while we were backgrounded, `/auth/me` returns 401 → the
  /// ApiClient hook fires [_onUnauthorized] → the router sends us to login,
  /// without needing to close and reopen the app. A transient failure
  /// (timeout / server cold-start) is swallowed, so a flaky network never logs
  /// the user out. No-op for the local demo session.
  Future<void> revalidateSession() async {
    final token = state.token;
    if (!state.isAuthenticated || token == null || token == 'demo') return;
    try {
      final user = await _repo.me();
      if (state.isAuthenticated) state = state.copyWith(user: user);
    } catch (_) {
      // A real 401 already routed to login via onUnauthorized; ignore the rest.
    }
  }

  Future<AuthAttempt> login(String email, String password) async {
    try {
      final out = await _repo.login(email.trim(), password);
      if (out.needsVerification) {
        state = state.copyWith(error: null);
        return AuthAttempt(verifyEmail: out.verifyEmail, devCode: out.devCode);
      }
      _applySession(out.session!);
      return const AuthAttempt(signedIn: true);
    } catch (e) {
      state = state.copyWith(error: _msg(e));
      return const AuthAttempt();
    }
  }

  /// Native Google sign-in: get an ID token from Google, exchange it at
  /// POST /auth/google, then store the session exactly like [login].
  /// Returns false (with no error) if the user cancels the Google picker.
  Future<bool> loginWithGoogle() async {
    try {
      // Instant: use the live server client id if it has already loaded,
      // otherwise the baked fallback — never block on /settings/public.
      final loaded = ref.read(publicAuthSettingsProvider).asData?.value;
      final clientId = (loaded != null && loaded.googleClientId.isNotEmpty)
          ? loaded.googleClientId
          : AppConfig.googleWebClientId;
      final idToken = await googleSignInIdToken(serverClientId: clientId);
      if (idToken == null) return false; // user cancelled
      // Google accounts are pre-verified by Google, so they never hit the OTP
      // step — the backend always returns a live session here.
      await _applySession(await _repo.loginWithGoogle(idToken));
      return true;
    } catch (e) {
      state = state.copyWith(error: _msg(e));
      return false;
    }
  }

  Future<AuthAttempt> register({
    required String fullName,
    required String email,
    required String password,
    required String confirmPassword,
    required bool acceptedTerms,
  }) async {
    try {
      final out = await _repo.register(
        fullName: fullName.trim(),
        email: email.trim(),
        password: password,
        confirmPassword: confirmPassword,
        acceptedTerms: acceptedTerms,
      );
      if (out.needsVerification) {
        state = state.copyWith(error: null);
        return AuthAttempt(verifyEmail: out.verifyEmail, devCode: out.devCode);
      }
      _applySession(out.session!);
      return const AuthAttempt(signedIn: true);
    } catch (e) {
      state = state.copyWith(error: _msg(e));
      return const AuthAttempt();
    }
  }

  /// Verify the 6-digit onboarding code, then sign in. Returns null on success,
  /// or a user-facing error message.
  Future<String?> verifyEmail(
      {required String email, required String code}) async {
    try {
      _applySession(await _repo.verifyEmailOtp(email.trim(), code.trim()));
      return null;
    } catch (e) {
      return _msg(e);
    }
  }

  /// Re-send the verification code. Returns the cooldown seconds (if any) and an
  /// error message (null on success).
  Future<({String? error, int? retryAfter})> resendEmail(String email) async {
    try {
      return (error: null, retryAfter: await _repo.resendEmailOtp(email.trim()));
    } catch (e) {
      return (error: _msg(e), retryAfter: null);
    }
  }

  Future<void> _applySession(AuthResult res) async {
    await SecureStore.writeToken(res.token);
    _api.setToken(res.token);
    state = AuthState(
        isHydrating: false,
        isAuthenticated: true,
        user: res.user,
        token: res.token);
    Push.onAuthenticated();
  }

  /// Local demo sign-in — explore the app with demo data, no backend.
  void enterDemo() {
    state = const AuthState(
      isHydrating: false,
      isAuthenticated: true,
      token: 'demo',
      user: AppUser(
        id: 'demo',
        fullName: 'Emma Isabella',
        email: 'emma@medschool.lk',
        role: 'student',
        plan: 'Free',
      ),
    );
  }

  /// Edit profile. Returns null on success, or a user-facing error message.
  Future<String?> updateProfile({
    required String fullName,
    String? avatarKey,
  }) async {
    // Demo mode never touches the backend.
    if (state.token == 'demo') {
      state = state.copyWith(
        user: state.user?.copyWith(
            fullName: fullName.trim(), avatarKey: avatarKey ?? ''),
      );
      return null;
    }
    try {
      final user = await _repo.updateProfile(
        fullName: fullName.trim(),
        avatarKey: avatarKey,
      );
      state = state.copyWith(user: user);
      return null;
    } catch (e) {
      return _msg(e);
    }
  }

  /// Change password. Returns null on success, or a user-facing error message.
  Future<String?> changePassword({
    required String currentPassword,
    required String newPassword,
    required String confirmPassword,
  }) async {
    if (state.token == 'demo') return null;
    try {
      await _repo.changePassword(
        currentPassword: currentPassword,
        newPassword: newPassword,
        confirmPassword: confirmPassword,
      );
      return null;
    } catch (e) {
      return _msg(e);
    }
  }

  Future<void> logout() async {
    await _repo.logout();
    await SecureStore.clear();
    _api.setToken(null);
    state = const AuthState(isHydrating: false);
  }

  /// Permanently delete the account, then sign out locally. Returns an error
  /// message on failure; local session is cleared only once the server confirms.
  Future<String?> deleteAccount() async {
    try {
      await _repo.deleteAccount();
    } catch (e) {
      return _msg(e);
    }
    await SecureStore.clear();
    _api.setToken(null);
    state = const AuthState(isHydrating: false);
    return null;
  }

  String _msg(Object e) {
    if (e is DioException) {
      final data = e.response?.data;
      if (data is Map && data['message'] != null) {
        final m = data['message'];
        return m is List ? m.join('\n') : m.toString();
      }
      if (e.type == DioExceptionType.connectionError ||
          e.type == DioExceptionType.connectionTimeout) {
        return 'Can\'t reach the server. Check your connection.';
      }
    }
    return 'Something went wrong. Please try again.';
  }
}

final authControllerProvider =
    NotifierProvider<AuthController, AuthState>(AuthController.new);
