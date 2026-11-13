import 'dart:math';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../config/app_config.dart';

/// Dio wrapper mirroring the web Axios client (§7.2): Bearer header,
/// 10s timeout, timeout retry with backoff, 401 hook.
class ApiClient {
  final Dio dio;
  String? _token;
  void Function()? onUnauthorized;

  ApiClient([Dio? d]) : dio = d ?? Dio() {
    _setup();
  }

  void setToken(String? t) => _token = t;

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
      onRequest: (options, handler) {
        if (_token != null && _token!.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $_token';
        }
        handler.next(options);
      },
      onError: (e, handler) async {
        final status = e.response?.statusCode;
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
