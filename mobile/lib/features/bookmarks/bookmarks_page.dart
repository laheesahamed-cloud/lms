import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';

import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';
import 'bookmarks_repository.dart';

class BookmarksPage extends ConsumerStatefulWidget {
  const BookmarksPage({super.key});
  @override
  ConsumerState<BookmarksPage> createState() => _BookmarksPageState();
}

class _BookmarksPageState extends ConsumerState<BookmarksPage> {
  String _filter = 'All';
  // Maps a filter chip to the backend itemType ('All' = no filter).
  static const _filters = <String, String?>{
    'All': null,
    'Quiz': 'quiz',
    'Note': 'ai_note',
    'Question': 'question',
  };

  IconData _iconFor(String itemType) => itemType == 'ai_note'
      ? Icons.description_outlined
      : itemType == 'question'
          ? Icons.help_outline_rounded
          : Icons.fact_check_outlined;

  void _open(Bookmark b) {
    switch (b.itemType) {
      case 'quiz':
        context.push('/app/quizzes/${b.itemId}${b.examModeOnly ? '?exam=1' : ''}');
        break;
      case 'ai_note':
        context.push('/app/ai-notes/${b.itemId}');
        break;
      case 'question':
        if (b.quizId != null) context.push('/app/quizzes/${b.quizId}');
        break;
    }
  }

  Future<void> _remove(Bookmark b) async {
    try {
      await toggleBookmark(ref, b.itemType, b.itemId);
      ref.invalidate(bookmarksProvider);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not update bookmark.')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final bookmarksAsync = ref.watch(bookmarksProvider);

    return SafeArea(
      child: RefreshIndicator(
        onRefresh: () => ref.refresh(bookmarksProvider.future),
        child: bookmarksAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ListView(
            children: [
              const SizedBox(height: 120),
              Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Text('Could not load your saved items.\n$e',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: c.inkSoft, fontSize: 14)),
                ),
              ),
            ],
          ),
          data: (all) {
            final type = _filters[_filter];
            final items =
                type == null ? all : all.where((e) => e.itemType == type).toList();
            return ListView(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
              children: [
                Text('Saved',
                    style: TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.w800,
                        color: c.inkStrong,
                        letterSpacing: -0.5)),
                const SizedBox(height: 14),
                SizedBox(
                  height: 36,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    children: [
                      for (final f in _filters.keys)
                        Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: GestureDetector(
                            onTap: () => setState(() => _filter = f),
                            child: AnimatedContainer(
                              duration: AppDur.micro,
                              padding: const EdgeInsets.symmetric(horizontal: 16),
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                color:
                                    _filter == f ? c.primaryTint : c.cardElevated,
                                borderRadius: BorderRadius.circular(99),
                              ),
                              child: Text(f,
                                  style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w700,
                                      color:
                                          _filter == f ? c.primary : c.inkSoft)),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                if (items.isEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 60),
                    child: Column(
                      children: [
                        Icon(Icons.bookmark_border_rounded,
                            size: 40, color: c.inkMuted),
                        const SizedBox(height: 12),
                        Text(
                            _filter == 'All'
                                ? 'Nothing saved yet.'
                                : 'No saved ${_filter.toLowerCase()}s.',
                            style: TextStyle(color: c.inkSoft, fontSize: 14)),
                      ],
                    ),
                  )
                else
                  AnimationLimiter(
                    child: Column(
                      children: AnimationConfiguration.toStaggeredList(
                        duration: const Duration(milliseconds: 320),
                        childAnimationBuilder: (w) => SlideAnimation(
                            verticalOffset: 18,
                            child: FadeInAnimation(child: w)),
                        children: [
                          for (final b in items)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: GlassCard(
                                onTap: () => _open(b),
                                child: Row(
                                  children: [
                                    Container(
                                      width: 42,
                                      height: 42,
                                      decoration: BoxDecoration(
                                        color: c.surface2,
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                      child: Icon(_iconFor(b.itemType),
                                          size: 20, color: c.accent),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(b.title,
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                              style: TextStyle(
                                                  fontSize: 15.5,
                                                  fontWeight: FontWeight.w700,
                                                  color: c.inkStrong)),
                                          const SizedBox(height: 2),
                                          Text(
                                              [
                                                b.typeLabel,
                                                if (b.courseTitle.isNotEmpty)
                                                  b.courseTitle
                                                else if (b.topicName.isNotEmpty)
                                                  b.topicName
                                              ].join(' · '),
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                              style: TextStyle(
                                                  fontSize: 13,
                                                  color: c.inkSoft)),
                                        ],
                                      ),
                                    ),
                                    IconButton(
                                      tooltip: 'Remove',
                                      onPressed: () => _remove(b),
                                      icon: Icon(Icons.bookmark_rounded,
                                          size: 20, color: c.primary),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}
