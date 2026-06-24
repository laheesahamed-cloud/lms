import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../theme/tokens.dart';
import 'bookmarks_repository.dart';

/// A reusable save/bookmark toggle. Reflects the live saved state (from the
/// bookmarks list) and flips it on tap via `POST /study-bookmarks/toggle`.
class BookmarkButton extends ConsumerWidget {
  final String itemType; // 'quiz' | 'ai_note' | 'question'
  final int itemId;
  final double size;
  const BookmarkButton({
    super.key,
    required this.itemType,
    required this.itemId,
    this.size = 20,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final saved = ref.watch(bookmarksProvider).maybeWhen(
          data: (list) =>
              list.any((b) => b.itemType == itemType && b.itemId == itemId),
          orElse: () => false,
        );
    return IconButton(
      visualDensity: VisualDensity.compact,
      padding: const EdgeInsets.all(6),
      constraints: const BoxConstraints(),
      tooltip: saved ? 'Saved' : 'Save',
      onPressed: itemId <= 0
          ? null
          : () async {
              try {
                await toggleBookmark(ref, itemType, itemId);
                ref.invalidate(bookmarksProvider);
              } catch (_) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Could not update bookmark.')),
                  );
                }
              }
            },
      icon: Icon(
        saved ? Icons.bookmark_rounded : Icons.bookmark_border_rounded,
        size: size,
        color: saved ? c.primary : c.inkMedium,
      ),
    );
  }
}
