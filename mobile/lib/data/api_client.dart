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
      ..headers['Accept'] = 'application/json';

    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        if (_token != null && _token!.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $_token';
        }
        handler.next(options);
      },
      onError: (e, handler) async {
        if (e.response?.statusCode == 401) {
          onUnauthorized?.call();
          return handler.next(e);
        }
        final isTimeout = e.type == DioExceptionType.connectionTimeout ||
            e.type == DioExceptionType.receiveTimeout ||
            e.type == DioExceptionType.sendTimeout;
        final attempt = (e.requestOptions.extra['retry'] as int?) ?? 0;
        if (isTimeout && attempt < AppConfig.retryCount) {
          await Future.delayed(AppConfig.retryDelay * (attempt + 1));
          final ro = e.requestOptions;
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

final apiClientProvider = Provider<ApiClient>((ref) => ApiClient());
