import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../theme/tokens.dart';
import 'osce_repository.dart';
import 'osce_media_cache.dart';
import 'widgets/osce_practice.dart';

/// A long case plays as a conversation.
///
/// The student works the real exam sequence — introduction, presenting
/// complaint, systemic review, and so on — and each tap reveals the next
/// exchange, so the history *accumulates* on screen the way it does in your
/// head during the real thing. A short case is examination-led and lives in
/// OsceCasePage; this is the history-led counterpart.
class OsceLongCasePage extends ConsumerStatefulWidget {
  final String slug;
  const OsceLongCasePage({super.key, required this.slug});

  @override
  ConsumerState<OsceLongCasePage> createState() => _OsceLongCasePageState();
}

class _OsceLongCasePageState extends ConsumerState<OsceLongCasePage> {
  int _section = 0;
  int _revealed = 1; // exchanges shown in the current section
  final Map<String, bool> _checked = {};
  final ScrollController _scroll = ScrollController();

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  void _toggle(OsceLongCase kase, String key) {
    setState(() => _checked[key] = !(_checked[key] ?? false));
    // Fire-and-forget: a dropped tick isn't worth interrupting the student for.
    ref.read(osceRepositoryProvider)
        .saveProgress(kase.id, checklist: _checked, seen: const [])
        .catchError((_) {});
  }

  void _next(OsceLongCase kase) {
    final section = kase.sections[_section];
    HapticFeedback.selectionClick();

    if (_revealed < section.exchanges.length) {
      setState(() => _revealed++);
      _scrollToEnd();
    } else if (_section < kase.sections.length - 1) {
      setState(() { _section++; _revealed = 1; });
      _scroll.jumpTo(0);
    }
  }

  void _scrollToEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scroll.hasClients) return;
      _scroll.animateTo(
        _scroll.position.maxScrollExtent,
        duration: AppDur.modal,
        curve: AppCurves.easeOut,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final async = ref.watch(osceLongCaseProvider(widget.slug));

    return Scaffold(
      backgroundColor: c.page,
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('Could not open this station.',
                      style: TextStyle(fontSize: 15, color: c.inkMedium)),
                  const SizedBox(height: 10),
                  TextButton(
                    onPressed: () => ref.invalidate(osceLongCaseProvider(widget.slug)),
                    child: const Text('Try again'),
                  ),
                ],
              ),
            ),
          ),
        ),
        data: (kase) {
          if (kase.sections.isEmpty) {
            return SafeArea(
              child: Center(
                child: Text('This case has no history yet.',
                    style: TextStyle(color: c.inkMuted)),
              ),
            );
          }
          final section = kase.sections[_section.clamp(0, kase.sections.length - 1)];
          final shown = section.exchanges.take(_revealed).toList();
          final more = _revealed < section.exchanges.length;
          final lastSection = _section >= kase.sections.length - 1;

          return SafeArea(
            child: Column(
              children: [
                _Header(
                  title: kase.title,
                  step: _section + 1,
                  total: kase.sections.length,
                  sectionTitle: section.title,
                ),
                _PatientStrip(patient: kase.patient, cast: kase.cast),
                Expanded(
                  child: ListView(
                    controller: _scroll,
                    padding: const EdgeInsets.fromLTRB(16, 6, 16, 16),
                    children: [
                      if (section.purpose.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 14),
                          child: Text(section.purpose,
                              style: TextStyle(
                                  fontSize: 13, height: 1.5, color: c.inkSoft)),
                        ),
                      for (final ex in shown) _Exchange(exchange: ex, cast: kase.cast),
                      if (!more && lastSection)
                        _Wrap(
                          kase: kase,
                          checked: _checked,
                          onToggle: (key) => _toggle(kase, key),
                        ),
                    ],
                  ),
                ),
                _NextBar(
                  label: more
                      ? 'Next question'
                      : lastSection
                          ? 'History complete'
                          : 'Next: ${kase.sections[_section + 1].title}',
                  done: !more && lastSection,
                  onTap: (!more && lastSection) ? null : () => _next(kase),
                  progress: section.exchanges.isEmpty
                      ? 1
                      : _revealed / section.exchanges.length,
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _Header extends StatelessWidget {
  final String title;
  final int step;
  final int total;
  final String sectionTitle;
  const _Header({
    required this.title,
    required this.step,
    required this.total,
    required this.sectionTitle,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Padding(
      padding: const EdgeInsets.fromLTRB(6, 4, 16, 6),
      child: Row(
        children: [
          IconButton(
            onPressed: () => Navigator.of(context).maybePop(),
            icon: Icon(Icons.chevron_left_rounded, size: 30, color: c.inkStrong),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                        fontSize: 16, fontWeight: FontWeight.w800, color: c.inkStrong)),
                Text('Step $step of $total  ·  $sectionTitle',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                        fontSize: 11, fontWeight: FontWeight.w700, color: c.inkMuted)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Who you're talking to — kept on screen so the history has a face.
class _PatientStrip extends StatelessWidget {
  final OscePatient patient;
  final OsceCast cast;
  const _PatientStrip({required this.patient, required this.cast});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final bits = [
      if (patient.age != null) '${patient.age}',
      if (patient.sex.isNotEmpty) patient.sex,
      if (patient.occupation.isNotEmpty) patient.occupation,
    ].join(' · ');

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 6),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: c.card,
        borderRadius: BorderRadius.circular(AppRadius.inner),
        border: Border.all(color: c.line),
      ),
      child: Row(
        children: [
          _Avatar(url: cast.patient?.thumb, fallback: Icons.person_rounded),
          const SizedBox(width: 11),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(patient.name,
                    style: TextStyle(
                        fontSize: 14.5, fontWeight: FontWeight.w800, color: c.inkStrong)),
                if (bits.isNotEmpty)
                  Text(bits, style: TextStyle(fontSize: 11.5, color: c.inkMuted)),
                if (patient.opening.isNotEmpty) ...[
                  const SizedBox(height: 5),
                  Text('“${patient.opening}”',
                      style: TextStyle(
                          fontSize: 12.5,
                          height: 1.4,
                          fontStyle: FontStyle.italic,
                          color: c.inkMedium)),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  final String? url;
  final IconData fallback;
  const _Avatar({required this.url, required this.fallback});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return ClipRRect(
      borderRadius: BorderRadius.circular(10),
      child: SizedBox(
        width: 44,
        height: 44,
        child: (url == null || url!.isEmpty)
            ? Container(
                color: c.primary.withValues(alpha: 0.12),
                child: Icon(fallback, size: 22, color: c.primary),
              )
            : OsceCachedImage(
                url: url!,
                fit: BoxFit.cover,
                placeholder: (_) => Container(
                      color: c.primary.withValues(alpha: 0.12),
                      child: Icon(fallback, size: 22, color: c.primary),
                    )),
      ),
    );
  }
}

/// One question and its answer. The student's line reads as theirs; the
/// patient answers in their own words.
class _Exchange extends StatelessWidget {
  final OsceExchange exchange;
  final OsceCast cast;
  const _Exchange({required this.exchange, required this.cast});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (exchange.ask.isNotEmpty)
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _Avatar(url: cast.doctor?.thumb, fallback: Icons.medical_services_rounded),
                const SizedBox(width: 9),
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 10),
                    decoration: BoxDecoration(
                      color: c.primary.withValues(alpha: 0.13),
                      borderRadius: const BorderRadius.only(
                        topLeft: Radius.circular(4),
                        topRight: Radius.circular(14),
                        bottomLeft: Radius.circular(14),
                        bottomRight: Radius.circular(14),
                      ),
                    ),
                    child: Text(exchange.ask,
                        style: TextStyle(
                            fontSize: 13.5, height: 1.5, color: c.inkStrong)),
                  ),
                ),
              ],
            ),
          if (exchange.reply.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 8, left: 26),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 10),
                      decoration: BoxDecoration(
                        color: c.card,
                        borderRadius: const BorderRadius.only(
                          topLeft: Radius.circular(14),
                          topRight: Radius.circular(4),
                          bottomLeft: Radius.circular(14),
                          bottomRight: Radius.circular(14),
                        ),
                        border: Border.all(color: c.line),
                      ),
                      child: Text(exchange.reply,
                          style: TextStyle(
                              fontSize: 13.5, height: 1.5, color: c.inkMedium)),
                    ),
                  ),
                ],
              ),
            ),
          if (exchange.note.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 7, left: 26),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.lightbulb_outline_rounded, size: 14, color: c.warning),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(exchange.note,
                        style: TextStyle(
                            fontSize: 12, height: 1.45, color: c.warning)),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// After the history: what it points to, and what you'd do first.
class _Wrap extends StatelessWidget {
  final OsceLongCase kase;
  final Map<String, bool> checked;
  final ValueChanged<String> onToggle;
  const _Wrap({
    required this.kase,
    required this.checked,
    required this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 6),
        if (kase.differentials.isNotEmpty) ...[
          Text('DIFFERENTIALS',
              style: TextStyle(
                  fontSize: 10.5,
                  letterSpacing: 1.1,
                  fontWeight: FontWeight.w800,
                  color: c.inkMuted)),
          const SizedBox(height: 8),
          for (var i = 0; i < kase.differentials.length; i++)
            Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: c.card,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: c.line),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 20,
                        height: 20,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: c.primary.withValues(alpha: 0.14),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text('${i + 1}',
                            style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                                color: c.primary)),
                      ),
                      const SizedBox(width: 9),
                      Expanded(
                        child: Text(kase.differentials[i].diagnosis,
                            style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                                color: c.inkStrong)),
                      ),
                    ],
                  ),
                  if (kase.differentials[i].supporting.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 7),
                      child: Text('For: ${kase.differentials[i].supporting}',
                          style: TextStyle(
                              fontSize: 12.5, height: 1.45, color: c.success)),
                    ),
                  if (kase.differentials[i].against.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text('Against: ${kase.differentials[i].against}',
                          style: TextStyle(
                              fontSize: 12.5, height: 1.45, color: c.inkMuted)),
                    ),
                ],
              ),
            ),
        ],
        if (kase.initialManagement.isNotEmpty) ...[
          const SizedBox(height: 10),
          Text('INITIAL MANAGEMENT',
              style: TextStyle(
                  fontSize: 10.5,
                  letterSpacing: 1.1,
                  fontWeight: FontWeight.w800,
                  color: c.inkMuted)),
          const SizedBox(height: 8),
          for (final step in kase.initialManagement)
            Padding(
              padding: const EdgeInsets.only(bottom: 7),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    margin: const EdgeInsets.only(top: 7),
                    width: 5,
                    height: 5,
                    decoration: BoxDecoration(color: c.accent, shape: BoxShape.circle),
                  ),
                  const SizedBox(width: 9),
                  Expanded(
                    child: Text(step,
                        style: TextStyle(
                            fontSize: 13.5, height: 1.5, color: c.inkMedium)),
                  ),
                ],
              ),
            ),
        ],

        // The history is only half the station — the checklist and viva are how
        // you rehearse it, same as a short case.
        if (kase.checklist.isNotEmpty || kase.questions.isNotEmpty) ...[
          const SizedBox(height: 18),
          Divider(color: c.line, height: 1),
          const SizedBox(height: 18),
          Text('PRACTISE THIS CASE',
              style: TextStyle(
                  fontSize: 10.5,
                  letterSpacing: 1.1,
                  fontWeight: FontWeight.w800,
                  color: c.accent)),
          const SizedBox(height: 4),
          Text('Tick off what you covered, then check yourself on the viva.',
              style: TextStyle(fontSize: 12.5, height: 1.5, color: c.inkSoft)),
          const SizedBox(height: 14),
          OscePracticeBlock(
            checklist: kase.checklist,
            questions: kase.questions,
            checked: checked,
            onToggle: onToggle,
          ),
        ],

        OsceRelatedStations(
          related: kase.related,
          onOpen: (rel) => context.push(osceCaseRoute(rel)),
        ),
      ],
    );
  }
}

class _NextBar extends StatelessWidget {
  final String label;
  final bool done;
  final double progress;
  final VoidCallback? onTap;
  const _NextBar({
    required this.label,
    required this.done,
    required this.progress,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final onPrimary = Theme.of(context).brightness == Brightness.dark
        ? const Color(0xFF04121F)
        : Colors.white;

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 14),
      decoration: BoxDecoration(border: Border(top: BorderSide(color: c.line))),
      child: Column(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(99),
            child: LinearProgressIndicator(
              value: progress.clamp(0, 1),
              minHeight: 4,
              backgroundColor: c.surface2,
              valueColor: AlwaysStoppedAnimation(c.primary),
            ),
          ),
          const SizedBox(height: 10),
          GestureDetector(
            onTap: onTap,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 14),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: done ? c.surface2 : c.primary,
                borderRadius: BorderRadius.circular(13),
                border: Border.all(color: done ? c.line : c.primary),
              ),
              child: Text(label,
                  style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: done ? c.inkMuted : onPrimary)),
            ),
          ),
        ],
      ),
    );
  }
}
