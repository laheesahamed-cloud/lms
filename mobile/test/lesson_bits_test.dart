import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:xyndrome/state/catalogue.dart';
import 'package:xyndrome/state/local_scope.dart';
import 'package:xyndrome/state/saved_first.dart';

// Finished lessons as a bitmap (OPTIMIZE 10.14): bit n = lesson id n, lowest
// bit first in each byte — the same layout the server writes.
void main() {
  test('decodes the server bitmap into lesson ids', () {
    // ids 3 and 9: byte 0 = 0x08, byte 1 = 0x02 (what MariaDB produced).
    final b64 = base64Encode([0x08, 0x02]);
    expect(decodeLessonBits(b64), [3, 9]);
    expect(decodeLessonBits(''), isEmpty);
  });

  test('setting a bit grows the bitmap and keeps the others', () {
    var b64 = setLessonBit('', 9);
    b64 = setLessonBit(b64, 3);
    b64 = setLessonBit(b64, 1534);
    expect(base64Decode(b64).length, 192);
    expect(decodeLessonBits(b64), [3, 9, 1534]);
  });

  test('progress model reads the bitmap as finished lessons', () {
    final p = StudentProgress.fromJson({'lessonsBits': base64Encode([0x08, 0x02]), 'lessonsVersion': 4});
    expect(p.lessonDone(3), isTrue);
    expect(p.lessonDone(9), isTrue);
    expect(p.lessonDone(4), isFalse);
  });

  test('"unchanged" reply takes the saved bitmap; Done flips a bit locally', () async {
    SharedPreferences.setMockInitialValues({});
    LocalScope.uid = '972';
    await seedSaved('progress', {'lessonsBits': base64Encode([0x08]), 'lessonsVersion': 1, 'quizzes': []});
    expect(await savedProgressVersion(), '972:1');

    final merged = await mergeProgress({'lessonsUnchanged': true, 'lessonsVersion': 1, 'quizzes': []}) as Map;
    expect(merged['lessonsBits'], base64Encode([0x08]));
    expect(merged.containsKey('lessonsUnchanged'), isFalse);

    await markLessonDoneLocally(9, 2);
    final saved = await readSaved('progress') as Map;
    expect(decodeLessonBits(saved['lessonsBits'] as String), [3, 9]);
    expect(saved['lessonsVersion'], 2);
    expect(await savedProgressVersion(), '972:2');
  });
}
