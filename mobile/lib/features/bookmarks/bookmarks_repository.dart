import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../state/auth_controller.dart';
import '../../state/catalogue.dart';
import '../../state/content_files.dart';
import '../../state/current_user.dart';

String _s(dynamic v) => v == null ? '' : v.toString();
int _i(dynamic v) => v == null ? 0 : (v is int ? v : int.tryParse(v.toString()) ?? 0);
bool _b(dynamic v) => v == true || v == 1 || v == '1' || v == 'true';

/// A saved item. `itemType` is quiz | ai_note | question.
class Bookmark {
  final int id;
  final String itemType;
  final int itemId;
  final String title;
  final bool examModeOnly;
  final int? quizId; // for question bookmarks: the quiz to open
  final String courseTitle;
  final String topicName;

  Bookmark({
    required this.id,
    required this.itemType,
    required this.itemId,
    required this.title,
    required this.examModeOnly,
    required this.quizId,
    required this.courseTitle,
    required this.topicName,
  });

  /// Display label for the type filter / subtitle.
  String get typeLabel => itemType == 'ai_note'
      ? 'Note'
      : itemType == 'question'
          ? 'Question'
          : 'Quiz';

  factory Bookmark.fromJson(dynamic raw) {
    final m = (raw is Map) ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    return Bookmark(
      id: _i(m['id']),
      itemType: _s(m['itemType']),
      itemId: _i(m['itemId']),
      title: _s(m['title']),
      examModeOnly: _b(m['examModeOnly']),
      quizId: m['quizId'] == null ? null : _i(m['quizId']),
      courseTitle: _s(m['courseTitle']),
      topicName: _s(m['topicName']),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'itemType': itemType,
        'itemId': itemId,
        'title': title,
        'examModeOnly': examModeOnly,
        if (quizId != null) 'quizId': quizId,
        'courseTitle': courseTitle,
        'topicName': topicName,
      };
}

/// This account's bookmarks file on the phone (OPTIMIZE 10.25: bookmarks live
/// on the device only — no API call to read, add or remove one).
String _fileFor(String? userId) => 'bookmarks_${userId ?? 'guest'}.json';

String? _userId(Ref ref) => ref.read(authControllerProvider).user?.id;

Future<List<Bookmark>> _read(String? userId) async {
  final raw = await ContentFiles.read(_fileFor(userId));
  if (raw == null) return <Bookmark>[];
  try {
    return (jsonDecode(raw) as List).map(Bookmark.fromJson).toList();
  } catch (_) {
    return <Bookmark>[];
  }
}

/// The student's bookmarks, newest first, read from the phone (0 requests).
final bookmarksProvider = FutureProvider<List<Bookmark>>((ref) async {
  ref.watch(userScopeProvider);
  ref.watch(authControllerProvider.select((s) => s.user?.id));
  return _read(_userId(ref));
});

/// Names for a new bookmark from the lists already on the phone (the one
/// list the screen showing the button has loaded — nothing is downloaded).
Future<Bookmark> _describe(WidgetRef ref, String itemType, int itemId) async {
  String title = '', courseTitle = '', topicName = '';
  bool examOnly = false;
  Catalogue? cat;
  if (itemType == 'quiz') {
    cat = ref.read(quizCatalogueProvider).value;
    final q = cat?.quizzes.where((r) => r[0] == itemId).firstOrNull;
    if (q != null) {
      title = _s(q[8]).isNotEmpty ? _s(q[8]) : _s(q[9]);
      examOnly = q[6] == 1;
      courseTitle = _s(cat!.courseById[q[1]]?[1]);
      topicName = _s(cat.subjectById[q[2]]?[2]);
    }
  } else if (itemType == 'ai_note') {
    cat = ref.read(catalogueProvider).value;
    final l = cat?.lessonById[itemId];
    if (l != null) {
      title = _s(l[4]);
      courseTitle = _s(cat!.courseById[l[1]]?[1]);
      topicName = _s(cat.subjectById[l[2]]?[2]);
    }
  }
  return Bookmark(
    id: DateTime.now().millisecondsSinceEpoch,
    itemType: itemType,
    itemId: itemId,
    title: title,
    examModeOnly: examOnly,
    quizId: null,
    courseTitle: courseTitle,
    topicName: topicName,
  );
}

/// Toggle a bookmark on/off on the phone. Passing an already-saved
/// (itemType, itemId) removes it.
Future<void> toggleBookmark(
  WidgetRef ref,
  String itemType,
  int itemId,
) async {
  final userId = ref.read(authControllerProvider).user?.id;
  final list = await _read(userId);
  final at = list.indexWhere((b) => b.itemType == itemType && b.itemId == itemId);
  if (at >= 0) {
    list.removeAt(at);
  } else {
    list.insert(0, await _describe(ref, itemType, itemId));
  }
  await ContentFiles.write(_fileFor(userId), jsonEncode([for (final b in list) b.toJson()]));
  ref.invalidate(bookmarksProvider);
}
