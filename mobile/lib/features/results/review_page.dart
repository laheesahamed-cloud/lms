import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';

class _Q {
  final String stem;
  final List<String> options;
  final int correct;
  final int chosen;
  final String explanation;
  const _Q(this.stem, this.options, this.correct, this.chosen, this.explanation);
}

class ReviewPage extends StatelessWidget {
  final String attemptId;
  const ReviewPage({super.key, required this.attemptId});

  static const _qs = [
    _Q(
      'A 58-year-old man presents with crushing chest pain and ST elevation in II, III, aVF. Which artery is most likely occluded?',
      ['Left anterior descending', 'Right coronary artery', 'Left circumflex', 'Left main'],
      1,
      1,
      'Inferior STEMI (II, III, aVF) is most often due to occlusion of the right coronary artery.',
    ),
    _Q(
      'First-line management of stable SVT after vagal manoeuvres fail?',
      ['IV adenosine', 'IV amiodarone', 'DC cardioversion', 'IV metoprolol'],
      0,
      2,
      'Adenosine is first-line for stable SVT when vagal manoeuvres fail; cardioversion is for unstable patients.',
    ),
    _Q(
      'Which finding best distinguishes HFpEF from HFrEF?',
      ['Raised BNP', 'Ejection fraction ≥50%', 'Pulmonary oedema', 'Peripheral oedema'],
      1,
      0,
      'HFpEF is defined by preserved EF (≥50%); BNP and congestion occur in both.',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final correct = _qs.where((q) => q.chosen == q.correct).length;
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
        children: [
          Row(
            children: [
              IconButton(
                onPressed: () => context.pop(),
                icon: Icon(Icons.arrow_back_ios_new_rounded,
                    size: 18, color: c.inkMedium),
              ),
              Text('Review',
                  style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: c.inkStrong)),
              const Spacer(),
              Text('$correct/${_qs.length} correct',
                  style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                      color: c.inkSoft)),
            ],
          ),
          const SizedBox(height: 10),
          for (int qi = 0; qi < _qs.length; qi++)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: GlassCard(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Question ${qi + 1}',
                        style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.8,
                            color: c.accent)),
                    const SizedBox(height: 6),
                    Text(_qs[qi].stem,
                        style: TextStyle(
                            fontSize: 14.5,
                            height: 1.4,
                            fontWeight: FontWeight.w700,
                            color: c.inkStrong)),
                    const SizedBox(height: 12),
                    for (int oi = 0; oi < _qs[qi].options.length; oi++)
                      _OptionRow(
                        text: _qs[qi].options[oi],
                        correct: oi == _qs[qi].correct,
                        wrongChosen:
                            oi == _qs[qi].chosen && _qs[qi].chosen != _qs[qi].correct,
                      ),
                    const SizedBox(height: 10),
                    Container(
                      padding: const EdgeInsets.all(11),
                      decoration: BoxDecoration(
                        color: c.surface2,
                        borderRadius: BorderRadius.circular(AppRadius.inner),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(Icons.lightbulb_outline_rounded,
                              size: 17, color: c.accent),
                          const SizedBox(width: 9),
                          Expanded(
                            child: Text(_qs[qi].explanation,
                                style: TextStyle(
                                    fontSize: 12.5,
                                    height: 1.45,
                                    color: c.inkMedium)),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _OptionRow extends StatelessWidget {
  final String text;
  final bool correct;
  final bool wrongChosen;
  const _OptionRow(
      {required this.text, required this.correct, required this.wrongChosen});
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final tint = correct ? c.success : (wrongChosen ? c.error : null);
    final icon = correct
        ? Icons.check_circle_rounded
        : (wrongChosen ? Icons.cancel_rounded : Icons.circle_outlined);
    return Padding(
      padding: const EdgeInsets.only(bottom: 7),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 10),
        decoration: BoxDecoration(
          color: tint == null ? c.surface2 : tint.withValues(alpha: 0.13),
          borderRadius: BorderRadius.circular(AppRadius.inner),
        ),
        child: Row(
          children: [
            Icon(icon, size: 17, color: tint ?? c.inkMuted),
            const SizedBox(width: 9),
            Expanded(
              child: Text(text,
                  style: TextStyle(
                      fontSize: 13,
                      fontWeight:
                          (correct || wrongChosen) ? FontWeight.w700 : FontWeight.w500,
                      color: tint ?? c.inkMedium)),
            ),
          ],
        ),
      ),
    );
  }
}
