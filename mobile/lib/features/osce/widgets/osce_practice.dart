import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../theme/tokens.dart';
import '../osce_repository.dart';

/// The tick-off checklist and viva questions.
///
/// Both station types end the same way — you walk the case, then you practise
/// it — so this lives here rather than being written twice. A short case shows
/// it as its own stop; a long case shows it after the history is complete.

class OscePracticeBlock extends StatelessWidget {
  final List<OsceChecklistSection> checklist;
  final List<OsceQuestion> questions;
  final Map<String, bool> checked;
  final ValueChanged<String> onToggle;
  const OscePracticeBlock({
    super.key,
    required this.checklist,
    required this.questions,
    required this.checked,
    required this.onToggle,
  });

  /// Stable key for one item, so a reordered case doesn't shuffle saved ticks
  /// onto the wrong lines.
  static String keyFor(String section, int index) => '$section:$index';

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    var total = 0;
    var done = 0;
    for (final section in checklist) {
      for (var i = 0; i < section.items.length; i++) {
        total++;
        if (checked[keyFor(section.section, i)] == true) done++;
      }
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (total > 0) ...[
          Container(
            padding: const EdgeInsets.all(13),
            decoration: BoxDecoration(
              color: c.card,
              borderRadius: BorderRadius.circular(AppRadius.inner),
              border: Border.all(color: c.line),
            ),
            child: Row(
              children: [
                Expanded(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(99),
                    child: LinearProgressIndicator(
                      value: done / total,
                      minHeight: 7,
                      backgroundColor: c.surface2,
                      valueColor: AlwaysStoppedAnimation(c.primary),
                    ),
                  ),
                ),
                const SizedBox(width: 11),
                Text('$done/$total',
                    style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w700,
                        color: c.inkMedium)),
              ],
            ),
          ),
          const SizedBox(height: 16),
        ],

        for (final section in checklist) ...[
          Text(section.section.replaceAll('_', ' ').toUpperCase(),
              style: TextStyle(
                  fontSize: 10.5,
                  letterSpacing: 1.1,
                  fontWeight: FontWeight.w800,
                  color: c.inkMuted)),
          const SizedBox(height: 8),
          for (var i = 0; i < section.items.length; i++)
            OsceChecklistRow(
              label: section.items[i],
              done: checked[keyFor(section.section, i)] == true,
              onTap: () => onToggle(keyFor(section.section, i)),
            ),
          const SizedBox(height: 16),
        ],

        if (questions.isNotEmpty) ...[
          Text('VIVA QUESTIONS',
              style: TextStyle(
                  fontSize: 10.5,
                  letterSpacing: 1.1,
                  fontWeight: FontWeight.w800,
                  color: c.inkMuted)),
          const SizedBox(height: 8),
          for (final q in questions) OsceVivaCard(question: q),
        ],
      ],
    );
  }
}

class OsceChecklistRow extends StatelessWidget {
  final String label;
  final bool done;
  final VoidCallback onTap;
  const OsceChecklistRow({
    super.key,
    required this.label,
    required this.done,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Padding(
      padding: const EdgeInsets.only(bottom: 7),
      child: GestureDetector(
        onTap: () { HapticFeedback.selectionClick(); onTap(); },
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 11),
          decoration: BoxDecoration(
            color: c.card,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: c.line),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 19,
                height: 19,
                margin: const EdgeInsets.only(top: 1),
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: done ? c.success : Colors.transparent,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(
                      color: done ? c.success : c.lineMedium, width: 1.5),
                ),
                child: done
                    ? const Icon(Icons.check_rounded, size: 13, color: Color(0xFF04121F))
                    : null,
              ),
              const SizedBox(width: 11),
              Expanded(
                child: Text(label,
                    style: TextStyle(
                      fontSize: 13.5,
                      height: 1.45,
                      fontWeight: FontWeight.w600,
                      color: done ? c.inkMuted : c.inkStrong,
                      decoration: done ? TextDecoration.lineThrough : null,
                    )),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class OsceVivaCard extends StatefulWidget {
  final OsceQuestion question;
  const OsceVivaCard({super.key, required this.question});

  @override
  State<OsceVivaCard> createState() => _OsceVivaCardState();
}

class _OsceVivaCardState extends State<OsceVivaCard> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: GestureDetector(
        onTap: () => setState(() => _open = !_open),
        child: AnimatedSize(
          duration: AppDur.dropdown,
          curve: AppCurves.standard,
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.all(13),
            decoration: BoxDecoration(
              color: c.card,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: c.line),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(widget.question.q,
                          style: TextStyle(
                              fontSize: 13.5,
                              fontWeight: FontWeight.w700,
                              height: 1.4,
                              color: c.inkStrong)),
                    ),
                    Icon(_open ? Icons.expand_less_rounded : Icons.expand_more_rounded,
                        size: 20, color: c.inkMuted),
                  ],
                ),
                if (_open) ...[
                  const SizedBox(height: 9),
                  Text(widget.question.a,
                      style: TextStyle(fontSize: 13, height: 1.6, color: c.inkMedium)),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Links from this station to the others it connects to — a cause, a
/// complication, a differential.
///
/// The server resolves each slug and drops anything that wouldn't open, so
/// every row here is a station that actually exists. It also hands back the
/// real title and station type, which is what makes the row readable and the
/// navigation land on the right page (a long case needs `?type=long`).
class OsceRelatedStations extends StatelessWidget {
  final List<OsceRelated> related;
  final ValueChanged<OsceRelated> onOpen;
  const OsceRelatedStations({
    super.key,
    required this.related,
    required this.onOpen,
  });

  @override
  Widget build(BuildContext context) {
    if (related.isEmpty) return const SizedBox.shrink();
    final c = context.c;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 18),
        Text('Related stations',
            style: TextStyle(
                fontSize: 15, fontWeight: FontWeight.w800, color: c.inkStrong)),
        const SizedBox(height: 10),
        for (final rel in related)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: GestureDetector(
              onTap: () { HapticFeedback.selectionClick(); onOpen(rel); },
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: c.card,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: c.line),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                      decoration: BoxDecoration(
                        color: c.accent.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(rel.rel,
                          style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                              color: c.accent)),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(rel.label,
                              style: TextStyle(
                                  fontSize: 13.5,
                                  fontWeight: FontWeight.w600,
                                  color: c.inkStrong)),
                          if (rel.title.isNotEmpty && rel.note.isNotEmpty)
                            Padding(
                              padding: const EdgeInsets.only(top: 2),
                              child: Text(rel.note,
                                  style: TextStyle(fontSize: 11.5, color: c.inkMuted)),
                            ),
                        ],
                      ),
                    ),
                    Icon(Icons.chevron_right_rounded, size: 20, color: c.inkMuted),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// The route for a related station, carrying the type so the router opens the
/// history-led page for a long case instead of the examination-led one.
String osceCaseRoute(OsceRelated rel) =>
    '/app/osce/${rel.caseSlug}${rel.stationType == 'long' ? '?type=long' : ''}';

/// Summary & Connect — each mechanism with the findings it explains.
///
/// A short case teaches signs one at a time; this is where they stop being a
/// list and become a chain. Reading down it, the student sees *why* the findings
/// they just collected belong to this diagnosis, which is the step an examiner
/// actually tests. The server only sends steps that explain at least one
/// finding, so there are no empty branches here.
class OsceConnectGraph extends StatelessWidget {
  final List<OsceConnectStep> steps;
  final ValueChanged<String>? onOpenSign;
  const OsceConnectGraph({super.key, required this.steps, this.onOpenSign});

  @override
  Widget build(BuildContext context) {
    if (steps.isEmpty) return const SizedBox.shrink();
    final c = context.c;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 18),
        Text('How it fits together',
            style: TextStyle(
                fontSize: 15, fontWeight: FontWeight.w800, color: c.inkStrong)),
        const SizedBox(height: 4),
        Text('Each step of the mechanism, and the findings it explains.',
            style: TextStyle(fontSize: 12.5, height: 1.5, color: c.inkSoft)),
        const SizedBox(height: 12),

        for (var i = 0; i < steps.length; i++)
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(13),
                decoration: BoxDecoration(
                  color: c.card,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: c.line),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 22,
                          height: 22,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: c.primary.withValues(alpha: 0.14),
                            borderRadius: BorderRadius.circular(7),
                          ),
                          child: Text('${steps[i].step}',
                              style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800,
                                  color: c.primary)),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(steps[i].title,
                              style: TextStyle(
                                  fontSize: 14.5,
                                  fontWeight: FontWeight.w700,
                                  height: 1.35,
                                  color: c.inkStrong)),
                        ),
                      ],
                    ),
                    if (steps[i].body.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 7, left: 32),
                        child: Text(steps[i].body,
                            style: TextStyle(
                                fontSize: 13, height: 1.55, color: c.inkMedium)),
                      ),

                    Padding(
                      padding: const EdgeInsets.only(top: 11, left: 32),
                      child: Text('SO YOU FIND',
                          style: TextStyle(
                              fontSize: 9.5,
                              letterSpacing: 1.1,
                              fontWeight: FontWeight.w800,
                              color: c.inkMuted)),
                    ),
                    const SizedBox(height: 6),
                    Padding(
                      padding: const EdgeInsets.only(left: 32),
                      child: Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: [
                          for (final sign in steps[i].signs)
                            GestureDetector(
                              onTap: onOpenSign == null
                                  ? null
                                  : () {
                                      HapticFeedback.selectionClick();
                                      onOpenSign!(sign.id);
                                    },
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 10, vertical: 6),
                                decoration: BoxDecoration(
                                  color: c.success.withValues(alpha: 0.10),
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(
                                      color: c.success.withValues(alpha: 0.30)),
                                ),
                                child: Text(sign.name,
                                    style: TextStyle(
                                        fontSize: 12.5,
                                        fontWeight: FontWeight.w700,
                                        color: c.success)),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              // The arrow that makes it a chain rather than a stack of cards.
              if (i < steps.length - 1)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Icon(Icons.arrow_downward_rounded,
                      size: 17, color: c.inkMuted),
                ),
            ],
          ),
      ],
    );
  }
}
