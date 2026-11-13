import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:xyndrome/data/api_client.dart';

/// Answers each request with the next canned (status, body) pair and counts calls.
class _FakeAdapter implements HttpClientAdapter {
  _FakeAdapter(this.replies);
  final List<(int, Map<String, dynamic>)> replies;
  int calls = 0;

  @override
  Future<ResponseBody> fetch(RequestOptions options,
      Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    final (status, body) = replies[calls < replies.length ? calls : replies.length - 1];
    calls++;
    return ResponseBody.fromString(jsonEncode(body), status, headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    });
  }

  @override
  void close({bool force = false}) {}
}

ApiClient _client(_FakeAdapter adapter, {String? token = 'tok'}) {
  final api = ApiClient(Dio());
  api.dio.options.baseUrl = 'http://test.local/api';
  api.dio.httpClientAdapter = adapter;
  api.setToken(token);
  return api;
}

void main() {
  test('a 401 carrying the MySQL connection-limit text does not sign out', () async {
    final adapter = _FakeAdapter([
      (401, {'message': "User 'x' has exceeded the 'max_user_connections' resource (current value: 1)"}),
    ]);
    final api = _client(adapter);
    var signedOut = false;
    api.onUnauthorized = () => signedOut = true;
    await expectLater(api.dio.get('/student/dashboard'), throwsA(isA<DioException>()));
    expect(signedOut, isFalse);
  });

  test('a real expired-session 401 still signs out', () async {
    final adapter = _FakeAdapter([
      (401, {'message': 'Session is invalid or has expired'}),
    ]);
    final api = _client(adapter);
    var signedOut = false;
    api.onUnauthorized = () => signedOut = true;
    await expectLater(api.dio.get('/student/dashboard'), throwsA(isA<DioException>()));
    expect(signedOut, isTrue);
  });

  test('a read that gets 503 busy is retried and then succeeds', () async {
    final adapter = _FakeAdapter([
      (503, {'code': 'DATABASE_UNAVAILABLE', 'message': 'busy'}),
      (200, {'ok': true}),
    ]);
    final api = _client(adapter);
    final res = await api.dio.get('/quiz-attempts/quizzes');
    expect(res.statusCode, 200);
    expect(adapter.calls, 2);
  });

  test('a write that gets 503 is not repeated (no double save)', () async {
    final adapter = _FakeAdapter([
      (503, {'code': 'DATABASE_UNAVAILABLE', 'message': 'busy'}),
      (201, {'ok': true}),
    ]);
    final api = _client(adapter);
    await expectLater(
        api.dio.post('/student/planner/bulk', data: {}), throwsA(isA<DioException>()));
    expect(adapter.calls, 1);
  });

  test('isDatabaseBusy recognises the busy signals only', () {
    expect(isDatabaseBusy({'code': 'DATABASE_UNAVAILABLE'}), isTrue);
    expect(isDatabaseBusy({'message': 'Queue limit reached.'}), isTrue);
    expect(isDatabaseBusy({'message': 'Session is invalid or has expired'}), isFalse);
    expect(isDatabaseBusy('not a map'), isFalse);
  });
}
