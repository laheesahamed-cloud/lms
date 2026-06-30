import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/api_client.dart';
import '../../state/current_user.dart';

String _s(dynamic v) => v == null ? '' : v.toString();
int _i(dynamic v) => v == null ? 0 : (v is int ? v : int.tryParse(v.toString()) ?? 0);
bool _b(dynamic v) => v == true || v == 1 || v == '1' || v == 'true';

/// A saved item — `GET /study-bookmarks`. `itemType` is quiz | ai_note | question.
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
}

final bookmarksProvider = FutureProvider.autoDispose<List<Bookmark>>((ref) async {
  ref.watch(currentUserIdProvider);
  final api = ref.read(apiClientProvider);
  final res = await api.dio.get('/study-bookmarks');
  final data = res.data;
  final rows = (data is List)
      ? data
      : (data is Map ? (data['bookmarks'] ?? data['items'] ?? const []) : const []);
  return (rows as List).map(Bookmark.fromJson).toList();
});

/// Toggle a bookmark on/off. Passing an already-saved (itemType,itemId) removes it.
Future<void> toggleBookmark(
  WidgetRef ref,
  String itemType,
  int itemId,
) async {
  final api = ref.read(apiClientProvider);
  await api.dio.post('/study-bookmarks/toggle',
      data: {'itemType': itemType, 'itemId': itemId});
}
