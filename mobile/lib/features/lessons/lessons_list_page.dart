import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';

import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';
import 'lesson_models.dart';
import 'lessons_repository.dart';
import '../../widgets/page_header.dart';
import '../../widgets/shell_insets.dart';
import '../courses/subject_icons.dart';

class LessonsListPage extends ConsumerStatefulWidget {
  const LessonsListPage({super.key});

  @override
  ConsumerState<LessonsListPage> createState() => _LessonsListPageState();
}

class _LessonsListPageState extends ConsumerState<LessonsListPage> {
  String? _examType; // null = All


  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final notesAsync = ref.watch(lessonsListProvider);

    return SafeArea(
      bottom: false,
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
          final allGroups = groupLessonsByCourse(valid);

          // Distinct exam types
          final examTypes = allGroups
              .map((g) => g.examType.isNotEmpty ? g.examType : 'General')
              .toSet()
              .toList()
            ..sort();

          // Group all courses by exam type
          final byExam = <String, List<LessonCourseGroup>>{};
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
          for (final entry in visibleEntries) {
            items.add(_SectionHeader(entry.key));
            for (final group in entry.value) {
              items.add(_CourseItem(group));
            }
          }

          return ListView(
            padding: EdgeInsets.fromLTRB(16, 14, 16, 28 + shellNavInset(context)),
            children: [
              PageHeader(
                title: 'Your lessons',
                actions: [
                  if (examTypes.isNotEmpty)
                    _ExamDropdown(
                      value: _examType,
                      types: examTypes,
                      onChanged: (v) => setState(() => _examType = v),
                    ),
                ],
              ),
              const SizedBox(height: 12),
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
class _CourseItem extends _ListItem { final LessonCourseGroup group; _CourseItem(this.group); }

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
  final LessonCourseGroup group;
  const _CourseCard({required this.group});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    // The same identity the Courses page gives this course, so one course does
    // not arrive as a stethoscope on one screen and an open book on the other.
    final identity = subjectIcon(group.courseTitle);
    final accent = identity.colour;
    final key = group.courseId.isNotEmpty
        ? group.courseId
        : Uri.encodeComponent(group.courseTitle);
    return GlassCard(
      onTap: () => context.push('/app/lessons/course/$key'),
      child: Row(children: [
        Container(
          width: 48, height: 48,
          // Sized Container with no alignment hands the child tight
          // constraints, which stretches an SVG to fill the chip.
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: accent.withValues(alpha: 0.16),
            borderRadius: BorderRadius.circular(AppRadius.inner),
          ),
          child: SvgPicture.asset(
            identity.asset,
            width: identity.size,
            height: identity.size,
            colorFilter: ColorFilter.mode(accent, BlendMode.srcIn),
          ),
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
