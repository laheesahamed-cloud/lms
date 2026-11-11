import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../theme/tokens.dart';
import '../lessons/lesson_models.dart';
import '../lessons/lessons_repository.dart';
import '../quizzes/quizzes_repository.dart';

/// A search field that works in place: results appear right under it, on the
/// same screen, and there is no new window to open or close.
///
/// [lessonsOnly] is for the lessons page, where only lessons make sense (all
/// of them, across every course). The dashboard leaves it off and also finds
/// Q-bank sets.
///
/// Matching happens on the phone against the lists the app already loads, so
/// there is no extra server call.
class GlobalSearch extends ConsumerStatefulWidget {
  final bool lessonsOnly;
  const GlobalSearch({super.key, this.lessonsOnly = false});

  @override
  ConsumerState<GlobalSearch> createState() => _GlobalSearchState();
}

class _GlobalSearchState extends ConsumerState<GlobalSearch> {
  final _controller = TextEditingController();
  final _fieldKey = GlobalKey();
  String _query = '';
  bool _allLessons = false;
  bool _allQuizzes = false;

  static const _preview = 6;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  /// Every word typed has to appear somewhere in the item's text, in any
  /// order, so "cardio rev 3" finds "Cardio Revision 3".
  static bool _matches(List<String> words, List<String> fields) {
    final hay =
        fields.where((f) => f.trim().isNotEmpty).join(' ').toLowerCase();
    for (final w in words) {
      if (!hay.contains(w)) return false;
    }
    return true;
  }

  void _clear() {
    _controller.clear();
    setState(() {
      _query = '';
      _allLessons = false;
      _allQuizzes = false;
    });
  }

  void _openLesson(LessonListItem l) {
    if (l.locked) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text(l.lockReason.isNotEmpty
                ? l.lockReason
                : 'This lesson is included with a subscription.')),
      );
      return;
    }
    context.push('/app/study/lesson/${l.canvasId}');
  }

  void _openQuiz(QuizListItem q) {
    if (q.locked) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content:
                Text('This question bank is included with a subscription.')),
      );
      return;
    }
    context.push('/app/quizzes/${q.id}${q.examModeOnly ? '?exam=1' : ''}');
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final words = _query
        .toLowerCase()
        .split(RegExp(r'\s+'))
        .where((w) => w.isNotEmpty)
        .toList();
    final searching = words.isNotEmpty;

    final hint = widget.lessonsOnly
        ? 'Search all lessons'
        : 'Search lessons and Q-bank';

    final field = Container(
      height: 46,
      padding: const EdgeInsets.symmetric(horizontal: 14),
      decoration: BoxDecoration(
        color: c.surface2,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: c.line),
      ),
      child: Row(
        children: [
          Icon(Icons.search_rounded, size: 20, color: c.inkMuted),
          const SizedBox(width: 10),
          Expanded(
            child: TextField(
              controller: _controller,
              textInputAction: TextInputAction.search,
              // Close the keyboard on the search key, and on a tap anywhere
              // outside the field, so it never needs a hunt to dismiss.
              onSubmitted: (_) => FocusManager.instance.primaryFocus?.unfocus(),
              onTapOutside: (_) => FocusManager.instance.primaryFocus?.unfocus(),
              onChanged: (v) => setState(() {
                _query = v;
                _allLessons = false;
                _allQuizzes = false;
              }),
              style: TextStyle(fontSize: 15, color: c.inkStrong),
              decoration: InputDecoration(
                isDense: true,
                border: InputBorder.none,
                hintText: hint,
                hintStyle: TextStyle(fontSize: 15, color: c.inkMuted),
              ),
            ),
          ),
          if (_query.isNotEmpty)
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: _clear,
              child: Padding(
                padding: const EdgeInsets.only(left: 8),
                child: Icon(Icons.close_rounded, size: 19, color: c.inkMuted),
              ),
            ),
        ],
      ),
    );

    // The field is the same widget in the same place whether or not anything
    // is typed. It used to be returned on its own while empty and then wrapped
    // in a Column after the first letter; Flutter saw a different widget there,
    // rebuilt the text field, and the keyboard closed after one character.
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        KeyedSubtree(key: _fieldKey, child: field),
        if (searching) ..._results(c, words),
      ],
    );
  }

  List<Widget> _results(AppColors c, List<String> words) {
    // Only read the lists once somebody is actually searching.
    final lessonsAsync = ref.watch(lessonsListProvider);
    final lessons = (lessonsAsync.value ?? const <LessonListItem>[])
        .where((n) => n.lessonExists)
        .where((l) => _matches(
            words, [l.title, l.subjectName, l.topicName, l.courseTitle]))
        .toList();

    var quizzes = const <QuizListItem>[];
    var loading = lessonsAsync.isLoading && lessonsAsync.value == null;
    if (!widget.lessonsOnly) {
      final quizzesAsync = ref.watch(quizListProvider);
      loading = loading || (quizzesAsync.isLoading && quizzesAsync.value == null);
      quizzes = (quizzesAsync.value ?? const <QuizListItem>[])
          .where((q) => _matches(words, [
                q.title,
                q.subjectName,
                q.topicName,
                q.subtopicName,
                q.lessonTitle,
                q.courseTitle,
              ]))
          .toList();
    }

    final shownLessons =
        _allLessons ? lessons : lessons.take(_preview).toList();
    final shownQuizzes =
        _allQuizzes ? quizzes : quizzes.take(_preview).toList();

    return [
        const SizedBox(height: 6),
        if (loading)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 22),
            child: Center(child: CircularProgressIndicator()),
          )
        else if (lessons.isEmpty && quizzes.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 18),
            child: Center(
              child: Text('Nothing found for "${_query.trim()}".',
                  style: TextStyle(fontSize: 14.5, color: c.inkSoft)),
            ),
          )
        else ...[
          if (lessons.isNotEmpty) ...[
            _heading(c, 'Lessons', lessons.length),
            for (final l in shownLessons)
              _row(
                c,
                icon: Icons.menu_book_rounded,
                title: l.title,
                subtitle: [l.courseTitle, l.subjectName]
                    .where((s) => s.trim().isNotEmpty)
                    .join(' · '),
                locked: l.locked,
                onTap: () => _openLesson(l),
              ),
            if (lessons.length > _preview)
              _toggle(c, _allLessons, lessons.length - _preview,
                  () => setState(() => _allLessons = !_allLessons)),
          ],
          if (quizzes.isNotEmpty) ...[
            _heading(c, 'Q-bank sets', quizzes.length),
            for (final q in shownQuizzes)
              _row(
                c,
                icon: Icons.quiz_rounded,
                title: q.title.trim().isNotEmpty ? q.title.trim() : 'Practice set',
                subtitle: [q.courseTitle, q.subjectName, '${q.totalQuestions} questions']
                    .where((s) => s.trim().isNotEmpty)
                    .join(' · '),
                locked: q.locked,
                onTap: () => _openQuiz(q),
              ),
            if (quizzes.length > _preview)
              _toggle(c, _allQuizzes, quizzes.length - _preview,
                  () => setState(() => _allQuizzes = !_allQuizzes)),
          ],
        ],
    ];
  }

  Widget _heading(AppColors c, String label, int n) => Padding(
        padding: const EdgeInsets.fromLTRB(2, 12, 2, 8),
        child: Row(
          children: [
            Expanded(
              child: Text(label,
                  style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: c.inkStrong)),
            ),
            Text('$n',
                style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: c.inkSoft)),
          ],
        ),
      );

  Widget _toggle(AppColors c, bool open, int more, VoidCallback onTap) =>
      GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(2, 4, 2, 8),
          child: Text(open ? 'Show fewer' : 'Show $more more',
              style: TextStyle(
                  fontSize: 14, fontWeight: FontWeight.w800, color: c.primary)),
        ),
      );

  Widget _row(
    AppColors c, {
    required IconData icon,
    required String title,
    required String subtitle,
    required bool locked,
    required VoidCallback onTap,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: c.card,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: c.line),
            ),
            child: Row(
              children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    color: c.surface2,
                    borderRadius: BorderRadius.circular(11),
                  ),
                  child: Icon(icon, size: 18, color: c.inkMedium),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: locked ? c.inkSoft : c.inkStrong)),
                      if (subtitle.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(subtitle,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(fontSize: 12.5, color: c.inkSoft)),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: 6),
                Icon(
                    locked
                        ? Icons.lock_outline_rounded
                        : Icons.chevron_right_rounded,
                    size: 20,
                    color: c.inkMuted),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
