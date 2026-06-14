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
    return _parse(r.data);
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
    return _parse(r.data);
  }

  Future<AppUser> me() async {
    final r = await api.dio.get('/auth/me');
    final data = r.data;
    final u = (data is Map && data['user'] != null) ? data['user'] : data;
    return AppUser.fromJson(Map<String, dynamic>.from(u as Map));
  }

  Future<void> forgotPassword(String email) =>
      api.dio.post('/auth/forgot-password', data: {'email': email});

  Future<void> resetPassword(String token, String password) =>
      api.dio.post('/auth/reset-password',
          data: {'token': token, 'password': password});

  Future<void> logout() async {
    try {
      await api.dio.post('/auth/logout');
    } catch (_) {
      // best-effort; local token is cleared regardless
    }
  }

  AuthResult _parse(dynamic data) {
    final m = Map<String, dynamic>.from(data as Map);
    final token = (m['sessionToken'] ?? m['token'] ?? '').toString();
    final u = m['user'] ?? m;
    return AuthResult(token, AppUser.fromJson(Map<String, dynamic>.from(u as Map)));
  }
}

final authRepositoryProvider =
    Provider<AuthRepository>((ref) => AuthRepository(ref.read(apiClientProvider)));
