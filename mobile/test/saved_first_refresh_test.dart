import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:xyndrome/data/api_client.dart';
import 'package:xyndrome/features/lessons/lessons_repository.dart';
import 'package:xyndrome/state/current_user.dart';
import 'package:xyndrome/state/local_scope.dart';
import 'package:xyndrome/state/saved_first.dart';

class _Fake implements HttpClientAdapter {
  bool done = false;
  int calls = 0;
  @override
  Future<ResponseBody> fetch(RequestOptions o, Stream<Uint8List>? s, Future<void>? c) async {
    calls++;
    final body = jsonEncode([
      {'id': 1, 'lessonId': 7, 'lessonTitle': 'L', 'lessonCompleted': done, 'courseId': 3}
    ]);
    return ResponseBody.fromString(body, 200,
        headers: {Headers.contentTypeHeader: ['application/json']});
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  test('finishing a lesson shows as done after freshNext + invalidate', () async {
    SharedPreferences.setMockInitialValues({});
    LocalScope.uid = 'u1';
    final fake = _Fake();
    final dio = Dio()..httpClientAdapter = fake;
    final container = ProviderContainer(overrides: [
      apiClientProvider.overrideWithValue(ApiClient(dio)),
      userScopeProvider.overrideWithValue('tok'),
    ]);
    addTearDown(container.dispose);

    var l = await container.read(lessonsListProvider.future);
    expect(l.first.lessonCompleted, false);

    fake.done = true; // the server now knows it is finished
    freshNext('lessons');
    container.invalidate(lessonsListProvider);
    l = await container.read(lessonsListProvider.future);
    expect(l.first.lessonCompleted, true, reason: 'fresh read after completion');

    // The saved copy is written in the background; give it a moment.
    await Future.delayed(const Duration(milliseconds: 300));
    // Next launch: saved copy is the finished one.
    final c2 = ProviderContainer(overrides: [
      apiClientProvider.overrideWithValue(ApiClient(dio)),
      userScopeProvider.overrideWithValue('tok'),
    ]);
    addTearDown(c2.dispose);
    final l2 = await c2.read(lessonsListProvider.future);
    expect(l2.first.lessonCompleted, true, reason: 'saved copy updated');
  });

  test('a plain invalidate right after a fetch reuses the saved copy; freshNext asks again', () async {
    SharedPreferences.setMockInitialValues({});
    LocalScope.uid = 'u2';
    final fake = _Fake();
    final dio = Dio()..httpClientAdapter = fake;
    final container = ProviderContainer(overrides: [
      apiClientProvider.overrideWithValue(ApiClient(dio)),
      userScopeProvider.overrideWithValue('tok'),
    ]);
    addTearDown(container.dispose);
    await container.read(lessonsListProvider.future);
    await Future.delayed(const Duration(milliseconds: 300)); // saved copy written
    final callsAfterFirst = fake.calls;

    // Coming back to the screen moments later: no new request.
    container.invalidate(lessonsListProvider);
    await container.read(lessonsListProvider.future);
    await Future.delayed(const Duration(milliseconds: 1200));
    expect(fake.calls, callsAfterFirst, reason: 'fetched seconds ago, not asked again');

    // Something changed on the server and the caller says so: fresh answer.
    fake.done = true;
    freshNext('lessons');
    container.invalidate(lessonsListProvider);
    final fresh = await container.read(lessonsListProvider.future);
    expect(fresh.first.lessonCompleted, true, reason: 'freshNext waits for the server');
  });
}
