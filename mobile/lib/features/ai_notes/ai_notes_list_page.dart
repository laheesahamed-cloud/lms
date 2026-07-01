import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';

import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';
import 'note_models.dart';
import 'notes_repository.dart';

class AiNotesListPage extends ConsumerStatefulWidget {
  const AiNotesListPage({super.key});

  @override
  ConsumerState<AiNotesListPage> createState() => _AiNotesListPageState();
}

class _AiNotesListPageState extends ConsumerState<AiNotesListPage> {
  String? _examType; // null = All

  static const List<Color> _accents = [
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
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text('Could not load lessons.\n$e',
                textAlign: TextAlign.center,
                style: TextStyle(color: c.inkSoft, fontSize: 15.5)),
          ),
        ),
        data: (notes) {
          final valid = notes.where((n) => n.lessonExists).toList();
          final allGroups = groupNotesByCourse(valid);

          // Distinct exam types
          final examTypes = allGroups
              .map((g) => g.examType.isNotEmpty ? g.examType : 'General')
              .toSet()
              .toList()
            ..sort();

          // Group all courses by exam type
          final byExam = <String, List<NoteCourseGroup>>{};
          for (final g in allGroups) {
            final key = g.examType.isNotEmpty ? g.examType : 'General';
            byExam.putIfAbsent(key, () => []).add(g);
          }

          // Apply dropdown filter: null = show all groups, else single group
          final visibleEntries = _examType == null
              ? byExam.entries.toList()
              : byExam.entries
                  .where((e) => e.key == _examType)
                  .toList();

          // Flat item list
          final items = <_ListItem>[];
          var globalIndex = 0;
          for (final entry in visibleEntries) {
            items.add(_SectionHeader(entry.key));
            for (final group in entry.value) {
              items.add(_CourseItem(group, globalIndex % _accents.length));
              globalIndex++;
            }
          }

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
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Expanded(
                    child: Text('Your lessons',
                        style: TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.w800,
                            color: c.inkStrong)),
                  ),
                  if (examTypes.isNotEmpty)
                    _ExamDropdown(
                      value: _examType,
                      types: examTypes,
                      onChanged: (v) => setState(() => _examType = v),
                    ),
                ],
              ),
              const SizedBox(height: 16),
              if (items.isEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 40),
                  child: Text('No lessons available yet.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: c.inkSoft)),
                ),
              AnimationLimiter(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: AnimationConfiguration.toStaggeredList(
                    duration: const Duration(milliseconds: 340),
                    childAnimationBuilder: (w) => SlideAnimation(
                      verticalOffset: 20,
                      child: FadeInAnimation(child: w),
                    ),
                    children: [
                      for (final item in items)
                        if (item is _SectionHeader)
                          _ExamDivider(label: item.label)
                        else if (item is _CourseItem)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: _CourseCard(
                              group: item.group,
                              accent: _accents[item.accentIndex],
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
}

sealed class _ListItem {}
class _SectionHeader extends _ListItem { final String label; _SectionHeader(this.label); }
class _CourseItem extends _ListItem { final NoteCourseGroup group; final int accentIndex; _CourseItem(this.group, this.accentIndex); }

class _ExamDivider extends StatelessWidget {
  final String label;
  const _ExamDivider({required this.label});
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Padding(
      padding: const EdgeInsets.only(top: 8, bottom: 14),
      child: Row(children: [
        Expanded(child: Divider(color: c.line, thickness: 1)),
        const SizedBox(width: 10),
        Text(label.toUpperCase(),
            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 1.3, color: c.inkMuted)),
        const SizedBox(width: 10),
        Expanded(child: Divider(color: c.line, thickness: 1)),
      ]),
    );
  }
}

class _ExamDropdown extends StatelessWidget {
  final String? value;
  final List<String> types;
  final ValueChanged<String?> onChanged;
  const _ExamDropdown({required this.value, required this.types, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return GestureDetector(
      onTapDown: (details) async {
        final result = await showMenu<String?>(
          context: context,
          position: RelativeRect.fromLTRB(
            details.globalPosition.dx - 160,
            details.globalPosition.dy + 4,
            details.globalPosition.dx,
            0,
          ),
          color: c.surface1,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          items: [
            _menuItem(context, c, null, value),
            for (final t in types) _menuItem(context, c, t, value),
          ],
        );
        if (result != null || value != null) onChanged(result);
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: c.surface2,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: c.line, width: 1),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Text(value ?? 'All',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700,
                  color: value != null ? c.primary : c.inkMedium)),
          const SizedBox(width: 4),
          Icon(Icons.keyboard_arrow_down_rounded, size: 18,
              color: value != null ? c.primary : c.inkMuted),
        ]),
      ),
    );
  }

  PopupMenuItem<String?> _menuItem(BuildContext ctx, AppColors c, String? type, String? sel) {
    final isSelected = type == sel;
    return PopupMenuItem<String?>(
      value: type,
      child: Row(children: [
        Icon(isSelected ? Icons.check_rounded : Icons.circle_outlined,
            size: 16, color: isSelected ? c.primary : c.inkMuted),
        const SizedBox(width: 10),
        Text(type ?? 'All',
            style: TextStyle(fontSize: 15,
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                color: isSelected ? c.primary : c.inkStrong)),
      ]),
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
    final key = group.courseId.isNotEmpty
        ? group.courseId
        : Uri.encodeComponent(group.courseTitle);
    return GlassCard(
      onTap: () => context.push('/app/ai-notes/course/$key'),
      child: Row(children: [
        Container(
          width: 48, height: 48,
          decoration: BoxDecoration(
            color: accent.withValues(alpha: 0.16),
            borderRadius: BorderRadius.circular(AppRadius.inner),
          ),
          child: Icon(Icons.auto_stories_outlined, color: accent, size: 24),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(group.courseTitle,
                maxLines: 2, overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800,
                    letterSpacing: -0.2, color: c.inkStrong)),
            const SizedBox(height: 3),
            Text('${group.lessonCount} lesson${group.lessonCount == 1 ? '' : 's'}',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: c.inkSoft)),
          ]),
        ),
        Icon(Icons.chevron_right_rounded, color: c.inkMuted, size: 22),
      ]),
    );
  }
}
