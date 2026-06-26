import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';

import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';
import '../../widgets/skeletons.dart';
import 'note_models.dart';
import 'notes_repository.dart';

/// Library of AI notes (real data) — tapping one opens the native canvas page.
class AiNotesListPage extends ConsumerWidget {
  const AiNotesListPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final notesAsync = ref.watch(notesListProvider);
    return SafeArea(
      child: notesAsync.when(
        loading: () => const NoteListSkeleton(),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text('Could not load notes.\n$e',
                textAlign: TextAlign.center,
                style: TextStyle(color: c.inkSoft, fontSize: 15.5)),
          ),
        ),
        data: (notes) => AnimationLimiter(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
            children: AnimationConfiguration.toStaggeredList(
              duration: const Duration(milliseconds: 320),
              childAnimationBuilder: (w) => SlideAnimation(
                verticalOffset: 22,
                child: FadeInAnimation(child: w),
              ),
              children: [
                Text('AI NOTES',
                    style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.2,
                        color: c.accent)),
                const SizedBox(height: 6),
                Text('Your lessons',
                    style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w800,
                        color: c.inkStrong)),
                const SizedBox(height: 16),
                if (notes.isEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 40),
                    child: Text('No notes yet.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: c.inkSoft)),
                  ),
                for (final n in notes)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _NoteRow(item: n),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _NoteRow extends StatelessWidget {
  final NoteListItem item;
  const _NoteRow({required this.item});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return GestureDetector(
      onTap: () => context.push('/app/study/lesson/${item.lessonId}'),
      child: GlassCard(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: c.primaryTint,
                borderRadius: BorderRadius.circular(11),
              ),
              child: Icon(Icons.auto_stories_outlined, size: 20, color: c.primary),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(item.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: c.inkStrong)),
                  if (item.subtitle.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(item.subtitle,
                        style: TextStyle(fontSize: 13, color: c.inkSoft)),
                  ],
                ],
              ),
            ),
            Icon(Icons.chevron_right_rounded, color: c.inkSoft),
          ],
        ),
      ),
    );
  }
}
