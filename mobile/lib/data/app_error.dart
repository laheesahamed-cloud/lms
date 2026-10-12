import 'dart:io';

import 'package:dio/dio.dart';

/// Turns anything thrown anywhere in the app into something a student can read.
///
/// Screens used to print the exception straight onto the page, so a dropped
/// Wi-Fi connection showed:
///
///   DioException [connection error]: The connection errored: Failed host
///   lookup: 'xyndrome.lk' ... SocketException ... errno = 8
///
/// which tells a medical student nothing, names our server, and looks like the
/// app is broken rather than the network. Every one of those sites now goes
/// through here instead.
///
/// The CODE is the part worth keeping. It is short, stable and safe to read out
/// over the phone, so a support conversation can start with "it says NET-01"
/// instead of a screenshot of a stack trace.
class AppError {
  /// One or two plain sentences: what happened, and what to do about it.
  final String message;

  /// A short stable tag, e.g. `NET-01`. Shown to the user and quotable.
  final String code;

  const AppError(this.message, this.code);

  /// What a screen actually prints.
  String get display => '$message ($code)';

  @override
  String toString() => display;
}

/// True when [error] is the network being unavailable rather than anything
/// wrong with the app or the server — worth testing separately, because this
/// is the one case where retrying really is the whole answer.
bool isOffline(Object? error) => appError(error).code == 'NET-01';

AppError appError(Object? error) {
  if (error is AppError) return error;

  if (error is DioException) return _fromDio(error);

  // Reached when something outside Dio touches the network — an Image.network,
  // a file download, a socket opened directly.
  if (error is SocketException) {
    return const AppError(
      'No internet connection. Check your connection and try again.',
      'NET-01',
    );
  }
  if (error is HttpException) {
    return const AppError(
      'Could not reach the server. Try again in a moment.',
      'NET-05',
    );
  }
  if (error is FormatException) {
    return const AppError(
      "The server's reply could not be read. Try again in a moment.",
      'APP-02',
    );
  }

  // A string thrown by our own code is already meant for a person.
  if (error is String && error.isNotEmpty) return AppError(error, 'APP-03');

  return const AppError('Something went wrong. Please try again.', 'APP-01');
}

AppError _fromDio(DioException e) {
  switch (e.type) {
    case DioExceptionType.connectionError:
      // A DNS failure and a dead Wi-Fi look identical from here, and to the
      // student they are the same thing: nothing is getting through.
      return const AppError(
        'No internet connection. Check your connection and try again.',
        'NET-01',
      );
    case DioExceptionType.connectionTimeout:
    case DioExceptionType.sendTimeout:
    case DioExceptionType.receiveTimeout:
      return const AppError(
        'The connection timed out. Check your signal and try again.',
        'NET-02',
      );
    case DioExceptionType.cancel:
      return const AppError('That request was cancelled.', 'NET-03');
    case DioExceptionType.badCertificate:
      return const AppError(
        'The secure connection could not be verified. If you are on public '
        'Wi-Fi, try a different network.',
        'NET-04',
      );
    case DioExceptionType.badResponse:
      return _fromStatus(e);
    case DioExceptionType.unknown:
      // Dio wraps a socket failure as `unknown` on some platforms, so the
      // underlying error decides rather than the type.
      if (e.error is SocketException) {
        return const AppError(
          'No internet connection. Check your connection and try again.',
          'NET-01',
        );
      }
      return const AppError('Something went wrong. Please try again.', 'APP-01');
  }
}

AppError _fromStatus(DioException e) {
  final status = e.response?.statusCode ?? 0;

  // The backend writes its 4xx messages FOR students — "This quiz is included
  // with selected course plans", "Generating a study plan is included with a
  // subscription". Those say more than anything generic could, so they are
  // preferred wherever one exists and reads like a sentence.
  final server = _serverMessage(e.response?.data);

  switch (status) {
    case 400:
    case 409:
    case 422:
      return AppError(
          server ?? 'That did not work. Please check and try again.',
          'REQ-$status');
    case 401:
      return AppError(
          server ?? 'Your session has ended. Please sign in again.', 'AUTH-01');
    case 403:
      return AppError(
          server ?? 'You do not have access to this yet.', 'ACC-403');
    case 404:
      return AppError(server ?? 'We could not find that.', 'REQ-404');
    case 429:
      return const AppError(
          'Too many requests. Wait a moment and try again.', 'REQ-429');
    default:
      if (status >= 500) {
        return AppError(
            'The server is having trouble. Please try again shortly.',
            'SRV-$status');
      }
      return AppError(
          server ?? 'Something went wrong. Please try again.', 'APP-01');
  }
}

/// The server's own wording, when it has any and it reads like a sentence.
///
/// Nest sends `{ message: ... }`, sometimes as a list when validation fails.
/// Anything that looks like a class name, a stack trace or a bare status line
/// is rejected — those are for the log, not the screen.
String? _serverMessage(dynamic data) {
  if (data is! Map) return null;
  final raw = data['message'] ?? data['error'];
  final text = raw is List
      ? raw.map((x) => x.toString()).where((x) => x.isNotEmpty).join('\n')
      : raw?.toString();
  if (text == null) return null;

  final trimmed = text.trim();
  if (trimmed.isEmpty || trimmed.length > 240) return null;
  if (trimmed.contains('Exception') ||
      trimmed.contains('\n    at ') ||
      RegExp(r'^[A-Z][A-Za-z]*Error\b').hasMatch(trimmed)) {
    return null;
  }
  return trimmed;
}
