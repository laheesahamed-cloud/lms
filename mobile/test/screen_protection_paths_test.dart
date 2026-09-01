import 'package:flutter_test/flutter_test.dart';
import 'package:xyndrome/services/screen_protection.dart';

void main() {
  group('open — never protected', () {
    for (final p in [
      '/splash', '/', '/auth/login', '/auth/register', '/welcome',
      '/app/dashboard', '/app/quizzes', '/app/courses', '/app/study',
      '/app/results', '/app/profile', '/app/profile/edit',
      '/app/subscriptions', '/app/notifications', '/app/pending',
    ]) {
      test(p, () => expect(ScreenProtection.shouldProtectPath(p), isFalse));
    }
  });

  group('content — protected', () {
    for (final p in [
      '/app/lessons', '/app/lessons/12', '/app/study/lesson/9',
      '/app/quizzes/5', '/app/courses/3', '/app/results/7',
      '/app/flashcards', '/app/my-notes/1', '/app/ecg', '/app/drugs',
      '/app/review/4', '/app/bookmarks', '/app/planner',
    ]) {
      test(p, () => expect(ScreenProtection.shouldProtectPath(p), isTrue));
    }
  });

  test('trailing slash and query are ignored', () {
    expect(ScreenProtection.shouldProtectPath('/app/dashboard/'), isFalse);
    expect(ScreenProtection.shouldProtectPath('/app/quizzes?x=1'), isFalse);
    expect(ScreenProtection.shouldProtectPath('/app/quizzes/5?mode=exam'), isTrue);
  });
}
