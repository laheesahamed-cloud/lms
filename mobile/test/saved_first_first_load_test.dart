import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:xyndrome/data/api_client.dart';
import 'package:xyndrome/state/local_scope.dart';
import 'package:xyndrome/state/saved_first.dart';

class _Fake implements HttpClientAdapter {
  int calls = 0;
  @override
  Future<ResponseBody> fetch(RequestOptions o, Stream<Uint8List>? s, Future<void>? c) async {
    calls++;
    return ResponseBody.fromString(jsonEncode([1, 2, 3]), 200,
        headers: {Headers.contentTypeHeader: ['application/json']});
  }

  @override
  void close({bool force = false}) {}
}

// Regression (2026-11-15): with no saved copy, savedFirst waits for the
// request. Its shared-request wrapper's whenComplete callback returned the
// removed future (= the request itself), so the request waited on itself and
// never finished: the Planner spun forever on a phone with no saved planner.
void main() {
  test('first load with no saved copy completes', () async {
    SharedPreferences.setMockInitialValues({});
    LocalScope.uid = 'u-first-load';
    final fake = _Fake();
    final api = ApiClient(Dio()..httpClientAdapter = fake);
    final list = FutureProvider<List<int>>((ref) => savedFirst(
          ref,
          name: 'first_load_probe',
          fetch: () async => (await api.dio.get('/probe')).data,
          parse: (raw) async => (raw as List).cast<int>(),
        ));
    final container = ProviderContainer();
    addTearDown(container.dispose);

    final value = await container.read(list.future).timeout(const Duration(seconds: 5));
    expect(value, [1, 2, 3]);
    expect(fake.calls, 1);
  });
}
