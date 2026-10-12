import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:xyndrome/data/app_error.dart';

DioException _dio(DioExceptionType type, {int? status, dynamic body, Object? err}) =>
    DioException(
      requestOptions: RequestOptions(path: '/x'),
      type: type,
      error: err,
      response: status == null
          ? null
          : Response(
              requestOptions: RequestOptions(path: '/x'),
              statusCode: status,
              data: body),
    );

void main() {
  test('the screenshot case: DNS failure reads as no internet', () {
    final e = _dio(DioExceptionType.connectionError,
        err: const SocketException("Failed host lookup: 'xyndrome.lk'"));
    final a = appError(e);
    expect(a.code, 'NET-01');
    expect(a.message, contains('No internet connection'));
    expect(a.display, isNot(contains('SocketException')));
    expect(a.display, isNot(contains('xyndrome.lk')));
    expect(isOffline(e), isTrue);
  });

  test('a bare SocketException outside Dio maps the same way', () {
    expect(appError(const SocketException('nope')).code, 'NET-01');
  });

  test('timeouts are their own code', () {
    expect(appError(_dio(DioExceptionType.receiveTimeout)).code, 'NET-02');
    expect(appError(_dio(DioExceptionType.connectionTimeout)).code, 'NET-02');
  });

  test('a socket failure wrapped as unknown is still no internet', () {
    expect(
        appError(_dio(DioExceptionType.unknown,
                err: const SocketException('x')))
            .code,
        'NET-01');
  });

  test("the backend's own student-facing message is preferred", () {
    final a = appError(_dio(DioExceptionType.badResponse,
        status: 403,
        body: {'message': 'Generating a study plan is included with a subscription.'}));
    expect(a.message, 'Generating a study plan is included with a subscription.');
    expect(a.code, 'ACC-403');
  });

  test('a server message that is really an exception is NOT shown', () {
    final a = appError(_dio(DioExceptionType.badResponse,
        status: 400,
        body: {'message': 'TypeError: Cannot read property foo of undefined'}));
    expect(a.message, isNot(contains('TypeError')));
    expect(a.message, contains('check and try again'));
  });

  test('validation lists are joined', () {
    final a = appError(_dio(DioExceptionType.badResponse,
        status: 422, body: {'message': ['Title is required', 'Pick a course']}));
    expect(a.message, contains('Title is required'));
    expect(a.message, contains('Pick a course'));
  });

  test('5xx never leaks the body', () {
    final a = appError(_dio(DioExceptionType.badResponse,
        status: 500, body: {'message': 'ER_WRONG_FIELD_WITH_GROUP at line 42'}));
    expect(a.code, 'SRV-500');
    expect(a.display, isNot(contains('ER_WRONG_FIELD')));
  });

  test('401 and 429 read as themselves', () {
    expect(appError(_dio(DioExceptionType.badResponse, status: 401)).code, 'AUTH-01');
    expect(appError(_dio(DioExceptionType.badResponse, status: 429)).code, 'REQ-429');
  });

  test('anything unrecognised still produces a sentence and a code', () {
    final a = appError(Object());
    expect(a.code, 'APP-01');
    expect(a.message, endsWith('Please try again.'));
    expect(a.display, contains('(APP-01)'));
  });
}
