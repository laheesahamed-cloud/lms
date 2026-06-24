import 'package:dio/dio.dart';

/// Turns an exception (usually a [DioException]) into a user-facing message,
/// preferring the backend's own `message` field.
String authErrorMessage(Object e, [String fallback = 'Something went wrong. Please try again.']) {
  if (e is DioException) {
    final data = e.response?.data;
    if (data is Map && data['message'] != null) {
      final m = data['message'];
      return m is List ? m.join('\n') : m.toString();
    }
    if (e.type == DioExceptionType.connectionError ||
        e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout) {
      return "Can't reach the server. Check your connection.";
    }
  }
  return fallback;
}
