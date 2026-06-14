import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/api_client.dart';
import '../data/auth_repository.dart';
import '../data/models.dart';
import '../data/secure_store.dart';

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

class AuthController extends Notifier<AuthState> {
  @override
  AuthState build() {
    final api = ref.read(apiClientProvider);
    api.onUnauthorized = _onUnauthorized;
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

  Future<bool> login(String email, String password) async {
    try {
      final res = await _repo.login(email.trim(), password);
      await SecureStore.writeToken(res.token);
      _api.setToken(res.token);
      state = AuthState(
          isHydrating: false,
          isAuthenticated: true,
          user: res.user,
          token: res.token);
      return true;
    } catch (e) {
      state = state.copyWith(error: _msg(e));
      return false;
    }
  }

  Future<bool> register({
    required String fullName,
    required String email,
    required String password,
    required String confirmPassword,
    required bool acceptedTerms,
  }) async {
    try {
      final res = await _repo.register(
        fullName: fullName.trim(),
        email: email.trim(),
        password: password,
        confirmPassword: confirmPassword,
        acceptedTerms: acceptedTerms,
      );
      await SecureStore.writeToken(res.token);
      _api.setToken(res.token);
      state = AuthState(
          isHydrating: false,
          isAuthenticated: true,
          user: res.user,
          token: res.token);
      return true;
    } catch (e) {
      state = state.copyWith(error: _msg(e));
      return false;
    }
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

  Future<void> logout() async {
    await _repo.logout();
    await SecureStore.clear();
    _api.setToken(null);
    state = const AuthState(isHydrating: false);
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
