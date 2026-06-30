import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';

import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';
import '../../widgets/skeletons.dart';
import 'note_models.dart';
import 'notes_repository.dart';

class AiNotesListPage extends ConsumerStatefulWidget {
  const AiNotesListPage({super.key});

  @override
  ConsumerState<AiNotesListPage> createState() => _AiNotesListPageState();
}

class _AiNotesListPageState extends ConsumerState<AiNotesListPage> {
  String _examTypeFilter = 'all';

  static const List<Color> _accents = <Color>[
    Color(0xFF6366F1),
    Color(0xFFF43F5E),
    Color(0xFF10B981),
    Color(0xFFF59E0B),
    Color(0xFF38BDF8),
    Color(0xFF8B5CF6),
  ];

  @override
  Widget build(BuildContext context) {
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
        data: (notes) {
          final allGroups = groupNotesByCourse(notes);
          final examTypes = allGroups
              .map((g) => g.examType)
              .where((t) => t.trim().isNotEmpty)
              .toSet()
              .toList()
            ..sort();
          final groups = _examTypeFilter == 'all'
              ? allGroups
              : allGroups.where((g) => g.examType == _examTypeFilter).toList();
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
            children: [
              Text('LESSONS',
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
              if (examTypes.length > 1) ...[
                const SizedBox(height: 14),
                _examTypeChips(c, examTypes),
              ],
              const SizedBox(height: 16),
              if (groups.isEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 40),
                  child: Text('No notes yet.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: c.inkSoft)),
                ),
              AnimationLimiter(
                child: Column(
                  children: AnimationConfiguration.toStaggeredList(
                    duration: const Duration(milliseconds: 350),
                    childAnimationBuilder: (w) => SlideAnimation(
                      verticalOffset: 22,
                      child: FadeInAnimation(child: w),
                    ),
                    children: [
                      for (var i = 0; i < groups.length; i++)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: _CourseCard(
                            group: groups[i],
                            accent: _accents[i % _accents.length],
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
    );
  }

  Widget _examTypeChips(AppColors c, List<String> types) {
    final all = ['all', ...types];
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (final type in all)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: GestureDetector(
                onTap: () => setState(() => _examTypeFilter = type),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 160),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                  decoration: BoxDecoration(
                    color: _examTypeFilter == type ? c.primary : c.surface2,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: _examTypeFilter == type
                          ? c.primary
                          : c.inkMuted.withValues(alpha: 0.2),
                      width: 1,
                    ),
                  ),
                  child: Text(
                    type == 'all' ? 'All' : type,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: _examTypeFilter == type
                          ? Colors.white
                          : c.inkMedium,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _CourseCard extends StatelessWidget {
  final NoteCourseGroup group;
  final Color accent;
  const _CourseCard({required this.group, required this.accent});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    // Use courseId if available, otherwise encode the title as the key.
    final key = group.courseId.isNotEmpty
        ? group.courseId
        : Uri.encodeComponent(group.courseTitle);
    return GlassCard(
      onTap: () => context.push('/app/ai-notes/course/$key'),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: accent.withValues(alpha: 0.16),
              borderRadius: BorderRadius.circular(AppRadius.inner),
            ),
            child: Icon(Icons.auto_stories_outlined, color: accent, size: 24),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(group.courseTitle,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.2,
                        color: c.inkStrong)),
                const SizedBox(height: 3),
                Text(
                  '${group.lessonCount} lesson${group.lessonCount == 1 ? '' : 's'}',
                  style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: c.inkSoft),
                ),
              ],
            ),
          ),
          Icon(Icons.chevron_right_rounded, color: c.inkMuted, size: 22),
        ],
      ),
    );
  }
}
