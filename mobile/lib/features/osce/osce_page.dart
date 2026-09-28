import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../theme/tokens.dart';
import 'osce_repository.dart';
import 'osce_media_cache.dart';
import 'widgets/osce_shell.dart';

/// Step 1 of the drill-down: which course. Keeping courses, subjects and
/// stations on separate pushed screens means the back chevron always walks one
/// level up and nothing rearranges underneath you.
class OscePage extends ConsumerWidget {
  const OscePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final courses = ref.watch(osceCoursesProvider);

    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 100),
        children: [
          Text('OSCE CLINICAL',
              style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.4,
                  color: c.accent)),
          const SizedBox(height: 4),
          Text('Choose a course',
              style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.5,
                  color: c.inkStrong)),
          const SizedBox(height: 6),
          Text('Walk an examination station head to toe, then practise the checklist.',
              style: TextStyle(fontSize: 13.5, height: 1.5, color: c.inkSoft)),
          const SizedBox(height: 14),

          // The other way in: start from where the finding is rather than from
          // the course the station is filed under.
          GestureDetector(
            onTap: () => context.push('/app/osce/body-map'),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: c.primary.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(AppRadius.inner),
                border: Border.all(color: c.primary.withValues(alpha: 0.28)),
              ),
              child: Row(
                children: [
                  Icon(Icons.accessibility_new_rounded, size: 20, color: c.primary),
                  const SizedBox(width: 11),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Find by body region',
                            style: TextStyle(
                                fontSize: 14.5,
                                fontWeight: FontWeight.w700,
                                color: c.inkStrong)),
                        Text('Tap where the finding is',
                            style: TextStyle(fontSize: 12, color: c.inkMuted)),
                      ],
                    ),
                  ),
                  Icon(Icons.chevron_right_rounded, color: c.primary),
                ],
              ),
            ),
          ),
          const SizedBox(height: 18),

          courses.when(
            loading: () => const OsceLoading(),
            error: (err, _) => OsceErrorNote(
              message: 'Could not load the stations.',
              onRetry: () => ref.invalidate(osceCoursesProvider),
            ),
            data: (list) {
              if (list.isEmpty) {
                return const OsceEmptyNote(
                  title: 'No stations yet',
                  body: 'Examination stations appear here as they are published.',
                );
              }
              return Column(
                children: [
                  for (final course in list)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: OsceRow(
                        icon: Icons.school_rounded,
                        title: course.title,
                        subtitle: '${course.subjectCount} subject'
                            '${course.subjectCount == 1 ? '' : 's'} · '
                            '${course.caseCount} station${course.caseCount == 1 ? '' : 's'}',
                        locked: course.locked,
                        onTap: () => context.push('/app/osce/course/${course.id}',
                            extra: course.title),
                      ),
                    ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}

/// Step 2: the subjects inside one course.
class OsceSubjectsPage extends ConsumerWidget {
  final int courseId;
  final String courseTitle;
  const OsceSubjectsPage({super.key, required this.courseId, this.courseTitle = ''});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final subjects = ref.watch(osceSubjectsProvider(courseId));

    return OsceScaffold(
      eyebrow: courseTitle.isEmpty ? 'OSCE CLINICAL' : courseTitle.toUpperCase(),
      title: 'Choose a subject',
      children: [
        subjects.when(
          loading: () => const OsceLoading(),
          error: (err, _) => OsceErrorNote(
            message: 'Could not load these subjects.',
            onRetry: () => ref.invalidate(osceSubjectsProvider(courseId)),
          ),
          data: (list) {
            if (list.isEmpty) {
              return const OsceEmptyNote(
                title: 'Nothing here yet',
                body: 'Stations for this course are still being written.',
              );
            }
            return Column(
              children: [
                for (final subject in list)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: OsceRow(
                      icon: Icons.category_rounded,
                      title: subject.name,
                      subtitle: '${subject.caseCount} station'
                          '${subject.caseCount == 1 ? '' : 's'}',
                      locked: subject.locked,
                      onTap: () => context.push('/app/osce/subject/${subject.id}',
                          extra: subject.name),
                    ),
                  ),
              ],
            );
          },
        ),
      ],
    );
  }
}

/// Step 3: the stations inside one subject.
/// Short case = examination-led, long case = history-led. A student should
/// know which they're walking into before they tap.
class _TypeChip extends StatelessWidget {
  final String type;
  const _TypeChip({required this.type});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final long = type == 'long';
    final tint = long ? c.accent : c.primary;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: tint.withValues(alpha: 0.13),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: tint.withValues(alpha: 0.32)),
      ),
      child: Text(long ? 'LONG' : 'SHORT',
          style: TextStyle(
              fontSize: 9, letterSpacing: 0.5, fontWeight: FontWeight.w800, color: tint)),
    );
  }
}

class _CoverFallback extends StatelessWidget {
  final AppColors colors;
  const _CoverFallback({required this.colors});
  @override
  Widget build(BuildContext context) => Container(
        color: colors.primary.withValues(alpha: 0.12),
        child: Icon(Icons.medical_information_rounded, size: 20, color: colors.primary),
      );
}

class OsceStationsPage extends ConsumerStatefulWidget {
  final int topicId;
  final String subjectTitle;
  const OsceStationsPage({super.key, required this.topicId, this.subjectTitle = ''});

  @override
  ConsumerState<OsceStationsPage> createState() => _OsceStationsPageState();
}

class _OsceStationsPageState extends ConsumerState<OsceStationsPage> {
  String _query = '';
  bool _starredOnly = false;

  int get topicId => widget.topicId;
  String get subjectTitle => widget.subjectTitle;

  Future<void> _toggleFavourite(OsceCaseSummary item) async {
    HapticFeedback.selectionClick();
    try {
      await ref.read(osceRepositoryProvider).setFavourite(item.id, !item.favourite);
      ref.invalidate(osceCasesProvider('$topicId'));
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not save that just now.')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final cases = ref.watch(osceCasesProvider('$topicId'));

    return OsceScaffold(
      eyebrow: subjectTitle.isEmpty ? 'STATIONS' : subjectTitle.toUpperCase(),
      title: 'Choose a station',
      children: [
        cases.when(
          loading: () => const OsceLoading(),
          error: (err, _) => OsceErrorNote(
            message: 'Could not load these stations.',
            onRetry: () => ref.invalidate(osceCasesProvider('$topicId')),
          ),
          data: (all) {
            if (all.isEmpty) {
              return const OsceEmptyNote(
                title: 'Nothing here yet',
                body: 'Stations for this subject are still being written.',
              );
            }
            final q = _query.trim().toLowerCase();
            final list = all.where((item) {
              if (_starredOnly && !item.favourite) return false;
              if (q.isEmpty) return true;
              return item.title.toLowerCase().contains(q)
                  || item.summary.toLowerCase().contains(q);
            }).toList();
            final starred = all.where((i) => i.favourite).length;

            return Column(
              children: [
                // Search only earns its space once there are enough stations to
                // scroll; below that the list itself is the index.
                if (all.length > 5 || starred > 0)
                  _StationFilter(
                    query: _query,
                    starredOnly: _starredOnly,
                    starredCount: starred,
                    onQuery: (v) => setState(() => _query = v),
                    onStarredOnly: (v) => setState(() => _starredOnly = v),
                  ),
                if (list.isEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 30),
                    child: Text(
                      _starredOnly && starred == 0
                          ? 'No starred stations yet — tap the star on one to keep it here.'
                          : 'Nothing matches that.',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 13.5, color: c.inkMuted),
                    ),
                  ),
                for (final item in list)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: GestureDetector(
                      onTap: item.locked
                          ? () => showLockedNote(context)
                          : () => context.push(
                              '/app/osce/${item.slug}?type=${item.stationType}'),
                      child: Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: c.card,
                          borderRadius: BorderRadius.circular(AppRadius.inner),
                          border: Border.all(color: c.line),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(11),
                              child: SizedBox(
                                width: 64,
                                height: 48,
                                child: item.cover != null
                                    ? OsceCachedImage(
                                        url: item.cover!.thumb,
                                        fit: BoxFit.cover,
                                        placeholder: (_) => _CoverFallback(colors: c))
                                    : _CoverFallback(colors: c),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Expanded(
                                        child: Text(item.title,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: TextStyle(
                                                fontSize: 15.5,
                                                fontWeight: FontWeight.w700,
                                                color: c.inkStrong)),
                                      ),
                                      _TypeChip(type: item.stationType),
                                    ],
                                  ),
                                  if (item.summary.isNotEmpty) ...[
                                    const SizedBox(height: 4),
                                    Text(item.summary,
                                        maxLines: 3,
                                        overflow: TextOverflow.ellipsis,
                                        style: TextStyle(
                                            fontSize: 12.5,
                                            height: 1.45,
                                            color: c.inkMuted)),
                                  ],
                                ],
                              ),
                            ),
                            // A locked station can't be starred — there's nothing
                            // to come back to until it opens.
                            if (!item.locked)
                              GestureDetector(
                                onTap: () => _toggleFavourite(item),
                                behavior: HitTestBehavior.opaque,
                                child: Padding(
                                  padding: const EdgeInsets.fromLTRB(8, 6, 2, 8),
                                  child: Icon(
                                    item.favourite
                                        ? Icons.star_rounded
                                        : Icons.star_outline_rounded,
                                    size: 21,
                                    color: item.favourite ? c.warning : c.inkMuted,
                                  ),
                                ),
                              ),
                            Padding(
                              padding: const EdgeInsets.only(top: 10, left: 2),
                              child: item.locked
                                  ? Icon(Icons.lock_outline_rounded,
                                      size: 17, color: c.warning)
                                  : Icon(Icons.chevron_right_rounded, color: c.inkMuted),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
              ],
            );
          },
        ),
      ],
    );
  }
}


/// Search and a starred-only toggle for a subject's station list.
///
/// Hidden until the list is long enough to need it — on a short list the
/// stations themselves are faster to scan than a search box.
class _StationFilter extends StatelessWidget {
  final String query;
  final bool starredOnly;
  final int starredCount;
  final ValueChanged<String> onQuery;
  final ValueChanged<bool> onStarredOnly;
  const _StationFilter({
    required this.query,
    required this.starredOnly,
    required this.starredCount,
    required this.onQuery,
    required this.onStarredOnly,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Expanded(
            child: Container(
              height: 40,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(
                color: c.surface2,
                borderRadius: BorderRadius.circular(11),
                border: Border.all(color: c.line),
              ),
              child: Row(
                children: [
                  Icon(Icons.search_rounded, size: 18, color: c.inkMuted),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      onChanged: onQuery,
                      style: TextStyle(fontSize: 14, color: c.inkStrong),
                      decoration: InputDecoration(
                        isDense: true,
                        border: InputBorder.none,
                        hintText: 'Search stations',
                        hintStyle: TextStyle(fontSize: 14, color: c.inkMuted),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (starredCount > 0) ...[
            const SizedBox(width: 8),
            GestureDetector(
              onTap: () { HapticFeedback.selectionClick(); onStarredOnly(!starredOnly); },
              child: Container(
                height: 40,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  color: starredOnly
                      ? c.warning.withValues(alpha: 0.14)
                      : c.surface2,
                  borderRadius: BorderRadius.circular(11),
                  border: Border.all(
                      color: starredOnly ? c.warning.withValues(alpha: 0.45) : c.line),
                ),
                child: Row(
                  children: [
                    Icon(starredOnly ? Icons.star_rounded : Icons.star_outline_rounded,
                        size: 18, color: starredOnly ? c.warning : c.inkMuted),
                    const SizedBox(width: 5),
                    Text('$starredCount',
                        style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: starredOnly ? c.warning : c.inkMedium)),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
