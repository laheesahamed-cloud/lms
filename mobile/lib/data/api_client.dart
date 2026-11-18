import 'dart:math';

import 'package:dio/dio.dart';
import '../state/practice_queue.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../config/app_config.dart';

/// Dio wrapper mirroring the web Axios client (§7.2): Bearer header,
/// 10s timeout, timeout retry with backoff, 401 hook.
class ApiClient {
  final Dio dio;
  // The saved session token: the RENEWAL token (OPTIMIZE 10.2). Used only to
  // get a signed access token, and as a fallback when renewal can't reach the
  // server (the server still accepts it the old way).
  String? _token;
  // Signed access token (about 1 hour), kept in memory: the server trusts it by
  // its signature, so normal requests need no session lookup in the database.
  String? _access;
  DateTime? _accessExpires;
  Future<bool>? _renewing;
  void Function()? onUnauthorized;

  ApiClient([Dio? d]) : dio = d ?? Dio() {
    _setup();
  }

  /// [keepAccess]: a sign-in reply already carried this session's access
  /// token (captured by the response hook) — keep it instead of renewing.
  void setToken(String? t, {bool keepAccess = false}) {
    _token = t;
    if (keepAccess && t != null) return;
    _access = null;
    _accessExpires = null;
  }

  void _takeAccess(Object? data) {
    if (data is Map && data['accessToken'] is String) {
      _access = data['accessToken'] as String;
      final secs = (data['accessExpiresIn'] as num?)?.toInt() ?? 3600;
      _accessExpires = DateTime.now().add(Duration(seconds: secs));
    }
  }

  bool get _accessFresh =>
      _access != null &&
      _accessExpires != null &&
      DateTime.now().isBefore(_accessExpires!.subtract(const Duration(seconds: 30)));

  static /// The requests practices may ride along with (OPTIMIZE 10.28): start-up,
/// lesson done, exam finish, flashcard save and the 12-hour sync.
bool _ridesAlong(RequestOptions o) {
  final method = o.method.toUpperCase();
  if (method != 'POST' && method != 'PATCH') return false;
  final p = o.path;
  return p.contains('/app/start') ||
      (p.contains('/courses/student/lessons/') && p.endsWith('/progress')) ||
      (p.contains('/quiz-attempts/exam/') && p.endsWith('/finish')) ||
      p.contains('/student/flashcards/reviews') ||
      p.contains('/student/dashboard/sync');
}

bool _usesSessionToken(String path) =>
      path.contains('/auth/token') ||
      path.contains('/auth/logout') ||
      path.contains('/app/start');

  /// One renewal at a time. true = new access token; false = the session itself
  /// was refused (signed out). Network trouble throws and leaves the session.
  Future<bool> _renew() {
    final running = _renewing;
    if (running != null) return running;
    final task = () async {
      try {
        final r = await Dio(BaseOptions(
          baseUrl: dio.options.baseUrl,
          connectTimeout: dio.options.connectTimeout,
          receiveTimeout: dio.options.receiveTimeout,
          headers: {
            ...dio.options.headers,
            'Authorization': 'Bearer $_token',
          },
        )).post('/auth/token');
        _takeAccess(r.data);
        return _access != null;
      } on DioException catch (e) {
        if (e.response?.statusCode == 401 && !isDatabaseBusy(e.response?.data)) return false;
        rethrow;
      }
    }();
    _renewing = task;
    return task.whenComplete(() => _renewing = null);
  }

  void _setup() {
    dio.options
      ..baseUrl = AppConfig.apiBaseUrl
      ..connectTimeout = AppConfig.apiTimeout
      ..receiveTimeout = AppConfig.apiTimeout
      ..sendTimeout = AppConfig.apiTimeout
      ..headers['Accept'] = 'application/json'
      // Identifies this as the official mobile app so the backend serves
      // premium (non-free) quiz/lesson/flashcard content here instead of
      // showing the website's "Open in the App" gate. Must stay in sync with
      // backend/src/common/utils/mobile-client.util.ts.
      ..headers['X-App-Client'] = 'xyndrome-mobile-app';

    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        if (_token != null && _token!.isNotEmpty) {
          var bearer = _token!;
          if (!_usesSessionToken(options.path)) {
            if (!_accessFresh) {
              try {
                if (!await _renew()) {
                  // The session itself was refused: answer 401 here; the error
                  // handler below signs out (once).
                  return handler.reject(DioException(
                    requestOptions: options,
                    type: DioExceptionType.badResponse,
                    response: Response(requestOptions: options, statusCode: 401),
                  ), true);
                }
              } catch (_) {
                // Server unreachable for renewal: send the session token (the
                // old way) and let the request itself succeed or fail.
              }
            }
            if (_accessFresh) bearer = _access!;
          }
          options.headers['Authorization'] = 'Bearer $bearer';
          // 10.28: waiting practices ride along with the main requests the app
          // sends anyway (never a request of their own).
          if (_ridesAlong(options) && options.data is Map) {
            final list = await PracticeQueue.pending();
            if (list.isNotEmpty) {
              options.data = {...(options.data as Map), 'practices': list};
              options.extra['practices'] = true;
            }
          }
        }
        handler.next(options);
      },
      onResponse: (response, handler) {
        // Sign-in, renewal and the start-up reply carry a fresh access token.
        _takeAccess(response.data);
        // 10.28: the server saved the practices up to this number.
        final saved = int.tryParse(response.headers.value('x-practices-applied') ?? '');
        if (saved != null && saved > 0) PracticeQueue.confirm(saved);
        handler.next(response);
      },
      onError: (e, handler) async {
        final status = e.response?.statusCode;
        // The access token ran out (or was revoked): renew with the session
        // token and repeat the request once, instead of signing out.
        final body = e.response?.data;
        if (status == 401 &&
            body is Map &&
            body['code'] == 'ACCESS_TOKEN_EXPIRED' &&
            e.requestOptions.extra['renewed'] != true &&
            _token != null) {
          _access = null;
          try {
            if (await _renew()) {
              final ro = e.requestOptions..extra['renewed'] = true;
              ro.headers['Authorization'] = 'Bearer $_access';
              return handler.resolve(await dio.fetch(ro));
            }
            onUnauthorized?.call();
          } catch (_) {
            // fall through to the normal error
          }
          return handler.next(e);
        }
        if (status == 401) {
          // Only an authenticated session can "expire". A 401 on a sign-in
          // attempt — or before any token exists (fresh install) — is the
          // caller's error (e.g. wrong credentials), NOT an expired session.
          final path = e.requestOptions.path;
          final isAuthEndpoint = path.contains('/auth/login') ||
              path.contains('/auth/register') ||
              path.contains('/auth/forgot-password') ||
              path.contains('/auth/reset-password');
          // An older server answered a refused database connection with 401
          // and the MySQL text. That is "busy", not "signed out": signing out
          // here wiped the saved login, reminders and cached lists.
          if (_token != null &&
              _token!.isNotEmpty &&
              !isAuthEndpoint &&
              !isDatabaseBusy(e.response?.data)) {
            onUnauthorized?.call();
          }
          return handler.next(e);
        }
        final isTimeout = e.type == DioExceptionType.connectionTimeout ||
            e.type == DioExceptionType.receiveTimeout ||
            e.type == DioExceptionType.sendTimeout;
        final isBusy = status == 503 ||
            status == 502 ||
            status == 504 ||
            status == 429;
        final ro = e.requestOptions;
        final attempt = (ro.extra['retry'] as int?) ?? 0;
        // Only reads are retried: repeating a write (a plan, a review, an exam
        // submit) could save it twice. The dashboard is not retried on a timeout
        // either: it is the heaviest request, and asking again while the server
        // is still working on the first copy only adds to the load.
        final isRead = ro.method.toUpperCase() == 'GET';
        final heavyTimeout = isTimeout && ro.path.contains('/student/dashboard');
        if (isRead && (isTimeout || isBusy) && !heavyTimeout &&
            attempt < AppConfig.retryCount) {
          await Future.delayed(retryWait(e.response, attempt));
          ro.extra['retry'] = attempt + 1;
          try {
            final r = await dio.fetch(ro);
            return handler.resolve(r);
          } catch (_) {
            // fall through
          }
        }
        handler.next(e);
      },
    ));
  }
}

/// True when an error body says the database was busy or refused a connection
/// (rather than the login being bad).
bool isDatabaseBusy(Object? data) {
  if (data is Map) {
    if (data['code'] == 'DATABASE_UNAVAILABLE') return true;
    final msg = '${data['message'] ?? ''}'.toLowerCase();
    return msg.contains('max_user_connections') ||
        msg.contains('queue limit reached') ||
        msg.contains('too many connections');
  }
  return false;
}

final _jitter = Random();

/// How long to wait before retry number [attempt] + 1: the server's
/// Retry-After when it sends one (capped at 5s), else a short growing wait,
/// plus a little randomness so many phones don't retry on the same tick.
Duration retryWait(Response<dynamic>? response, int attempt) {
  final header = int.tryParse(response?.headers.value('retry-after') ?? '');
  final base = header != null
      ? Duration(seconds: header.clamp(1, 5))
      : AppConfig.retryDelay * (attempt + 1);
  return base + Duration(milliseconds: _jitter.nextInt(400));
}

final apiClientProvider = Provider<ApiClient>((ref) => ApiClient());
