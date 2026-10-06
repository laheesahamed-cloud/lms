import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';

import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';
import 'courses_repository.dart';
import '../../widgets/shell_insets.dart';
import 'subject_icons.dart';

/// Student course library — grouped by exam type, with a dropdown filter.
class CoursesPage extends ConsumerStatefulWidget {
  const CoursesPage({super.key});

  @override
  ConsumerState<CoursesPage> createState() => _CoursesPageState();
}

class _CoursesPageState extends ConsumerState<CoursesPage> {
  String? _examType; // null = All


  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final coursesAsync = ref.watch(studentCoursesProvider);

    return SafeArea(
      bottom: false,
      child: coursesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Padding(
          padding: const EdgeInsets.all(24),
          child: Text('Could not load courses.\n$e',
              textAlign: TextAlign.center,
              style: TextStyle(color: c.inkSoft, fontSize: 14)),
        ),
        data: (courses) {
          // Group by exam type, preserving server order within each group
          final byExam = <String, List<CourseCard>>{};
          for (final course in courses) {
            final key = course.examType.isNotEmpty ? course.examType : 'General';
            byExam.putIfAbsent(key, () => []).add(course);
          }

          final examTypes = byExam.keys.toList()..sort();

          // Apply dropdown filter
          final visibleEntries = _examType == null
              ? byExam.entries.toList()
              : byExam.entries.where((e) => e.key == _examType).toList();

          // Flat item list: header + cards
          final items = <_ListItem>[];
          for (final entry in visibleEntries) {
            items.add(_SectionHeader(entry.key));
            for (final course in entry.value) {
              items.add(_CourseItem(course));
            }
          }

          return ListView(
            padding: EdgeInsets.fromLTRB(16, 14, 16, 28 + shellNavInset(context)),
            children: <Widget>[
              Text('YOUR LIBRARY',
                  style: TextStyle(
                      fontSize: 12, fontWeight: FontWeight.w800,
                      letterSpacing: 1.4, color: c.accent)),
              const SizedBox(height: AppSpace.x1),
              Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
                Expanded(
                  child: Text('Courses',
                      style: TextStyle(
                          fontSize: 28, fontWeight: FontWeight.w800,
                          letterSpacing: -0.5, color: c.inkStrong)),
                ),
                if (examTypes.isNotEmpty)
                  _ExamDropdown(
                    value: _examType,
                    types: examTypes,
                    onChanged: (v) => setState(() => _examType = v),
                  ),
              ]),
              const SizedBox(height: AppSpace.x2),
              Text('Pick a course, then a subject, then a lesson to open its notes.',
                  style: TextStyle(fontSize: 15.5, height: 1.4, color: c.inkSoft)),
              const SizedBox(height: AppSpace.x4),
              if (items.isEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 40),
                  child: Text('No courses available.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: c.inkSoft)),
                )
              else
                AnimationLimiter(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: AnimationConfiguration.toStaggeredList(
                      duration: const Duration(milliseconds: 375),
                      childAnimationBuilder: (Widget w) =>
                          SlideAnimation(verticalOffset: 22, child: FadeInAnimation(child: w)),
                      children: [
                        for (final item in items)
                          if (item is _SectionHeader)
                            _ExamDivider(label: item.label)
                          else if (item is _CourseItem)
                            Padding(
                              padding: const EdgeInsets.only(bottom: AppSpace.x3),
                              child: _CourseCard(course: item.course),
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
class _CourseItem extends _ListItem {
  final CourseCard course;
  _CourseItem(this.course);
}

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
            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800,
                letterSpacing: 1.3, color: c.inkMuted)),
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
  const _CourseCard({required this.course});
  final CourseCard course;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    // Both the glyph and the tint come from the course's name, so a course
    // keeps the same identity wherever it appears and whatever else is in the
    // list beside it.
    final identity = subjectIcon(course.title);
    final accent = identity.colour;
    final double frac = (course.progressPercent / 100).clamp(0.0, 1.0);
    final int pct = course.progressPercent.round();

    return GlassCard(
      onTap: () => context.push('/app/courses/${course.id}'),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
        Row(children: <Widget>[
          Container(
            width: 48, height: 48,
            decoration: BoxDecoration(
              color: accent.withValues(alpha: 0.16),
              borderRadius: BorderRadius.circular(AppRadius.inner),
            ),
            child: SvgPicture.asset(
              identity.asset,
              // 20, not the 24 the Material glyph used: a Tabler icon's stroke
              // runs much closer to the edge of its 24 box, so matching the
              // number made it read noticeably bigger than what it replaced.
              width: 20,
              height: 20,
              colorFilter: ColorFilter.mode(accent, BlendMode.srcIn),
            ),
          ),
          const SizedBox(width: AppSpace.x4),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
              Text(course.title, maxLines: 2, overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800,
                      letterSpacing: -0.2, color: c.inkStrong)),
              const SizedBox(height: 2),
              Text(
                course.totalLessons > 0
                    ? '${course.totalLessons} lessons'
                    : (course.subjectCount > 0 ? '${course.subjectCount} subjects' : 'Course'),
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: c.inkMuted),
              ),
            ]),
          ),
          Icon(Icons.chevron_right_rounded, color: c.inkMuted, size: 22),
        ]),
        if (course.description.isNotEmpty) ...[
          const SizedBox(height: AppSpace.x3),
          Text(course.description, maxLines: 2, overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 14, height: 1.4, color: c.inkSoft)),
        ],
        const SizedBox(height: AppSpace.x4),
        ClipRRect(
          borderRadius: BorderRadius.circular(AppRadius.pill),
          child: LinearProgressIndicator(
            value: frac, minHeight: 6,
            backgroundColor: c.surface2,
            valueColor: AlwaysStoppedAnimation<Color>(accent),
          ),
        ),
        const SizedBox(height: AppSpace.x2),
        Text('$pct% complete',
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: c.inkMedium)),
      ]),
    );
  }
}
