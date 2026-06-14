import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';
import '../../widgets/app_button.dart';

/// Immutable demo MCQ question.
class _Question {
  final String stem;
  final List<String> options;
  final int correctIndex;
  final String explanation;

  const _Question({
    required this.stem,
    required this.options,
    required this.correctIndex,
    required this.explanation,
  });
}

/// Focus-mode quiz runner (full screen, no app nav). Practice mode reveals
/// correctness + explanation; exam mode silently records answers.
class TakeQuizPage extends StatefulWidget {
  final String quizId;
  final bool examMode;

  const TakeQuizPage({
    super.key,
    required this.quizId,
    this.examMode = false,
  });

  @override
  State<TakeQuizPage> createState() => _TakeQuizPageState();
}

class _TakeQuizPageState extends State<TakeQuizPage> {
  static const List<_Question> _questions = [
    _Question(
      stem:
          'A 58-year-old man presents with crushing substernal chest pain radiating to the left arm. ECG shows ST-elevation in leads II, III, and aVF. Which coronary artery is most likely occluded?',
      options: [
        'Left anterior descending artery',
        'Right coronary artery',
        'Left circumflex artery',
        'Left main coronary artery',
      ],
      correctIndex: 1,
      explanation:
          'Inferior MI (ST-elevation in II, III, aVF) most commonly results from occlusion of the right coronary artery, which supplies the inferior wall in roughly 80–85% of people (right-dominant circulation).',
    ),
    _Question(
      stem:
          'Which antibiotic class inhibits bacterial protein synthesis by binding the 30S ribosomal subunit?',
      options: [
        'Macrolides',
        'Beta-lactams',
        'Aminoglycosides',
        'Fluoroquinolones',
      ],
      correctIndex: 2,
      explanation:
          'Aminoglycosides (e.g. gentamicin) bind the 30S subunit, causing misreading of mRNA. Macrolides act on the 50S subunit; beta-lactams target cell-wall synthesis; fluoroquinolones inhibit DNA gyrase.',
    ),
    _Question(
      stem:
          'A patient with type 1 diabetes is found drowsy with deep, rapid breathing and a fruity odour on the breath. Which acid–base disturbance is expected?',
      options: [
        'Respiratory alkalosis',
        'Metabolic alkalosis',
        'High anion-gap metabolic acidosis',
        'Respiratory acidosis',
      ],
      correctIndex: 2,
      explanation:
          'Diabetic ketoacidosis produces a high anion-gap metabolic acidosis from accumulated ketoacids. Kussmaul respiration is the compensatory respiratory drive to blow off CO2.',
    ),
    _Question(
      stem:
          'Which vitamin deficiency classically causes the triad of confusion, ophthalmoplegia, and ataxia (Wernicke encephalopathy)?',
      options: [
        'Vitamin B12 (cobalamin)',
        'Vitamin B1 (thiamine)',
        'Vitamin B6 (pyridoxine)',
        'Vitamin C (ascorbic acid)',
      ],
      correctIndex: 1,
      explanation:
          'Thiamine (B1) deficiency causes Wernicke encephalopathy, frequently seen in chronic alcohol use. Always give thiamine before glucose to avoid precipitating the syndrome.',
    ),
    _Question(
      stem:
          'A 24-year-old woman has a blood pressure of 150/95 mmHg and a continuous abdominal bruit. Which is the most likely cause of her secondary hypertension?',
      options: [
        'Primary hyperaldosteronism',
        'Pheochromocytoma',
        'Fibromuscular dysplasia of the renal artery',
        'Coarctation of the aorta',
      ],
      correctIndex: 2,
      explanation:
          'Fibromuscular dysplasia is the leading cause of renal artery stenosis in young women, producing renovascular hypertension and an abdominal bruit. Angiography classically shows a "string of beads" appearance.',
    ),
  ];

  int _currentIndex = 0;
  late final List<int?> _answers =
      List<int?>.filled(_questions.length, null, growable: false);
  // Practice-mode reveal flags, one per question.
  late final List<bool> _revealed =
      List<bool>.filled(_questions.length, false, growable: false);

  int get _total => _questions.length;
  _Question get _q => _questions[_currentIndex];
  bool get _isLast => _currentIndex == _total - 1;
  bool get _isRevealed => !widget.examMode && _revealed[_currentIndex];

  void _select(int i) {
    if (_isRevealed) return; // locked once checked in practice mode
    setState(() => _answers[_currentIndex] = i);
  }

  void _primaryAction() {
    final answered = _answers[_currentIndex] != null;

    // Practice mode: first tap on an answered question reveals the result.
    if (!widget.examMode && answered && !_revealed[_currentIndex]) {
      setState(() => _revealed[_currentIndex] = true);
      return;
    }

    if (_isLast) {
      context.go('/app/results');
      return;
    }

    setState(() => _currentIndex += 1);
  }

  String get _primaryLabel {
    final answered = _answers[_currentIndex] != null;
    if (!widget.examMode && answered && !_revealed[_currentIndex]) {
      return 'Check';
    }
    return _isLast ? 'Finish' : 'Next';
  }

  bool get _primaryEnabled {
    final answered = _answers[_currentIndex] != null;
    // In exam mode you can always advance (skip allowed); in practice you must
    // pick an answer before Check/Next becomes available.
    if (widget.examMode) return true;
    return answered;
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final selected = _answers[_currentIndex];

    return Scaffold(
      backgroundColor: c.page,
      body: SafeArea(
        child: Column(
          children: [
            _TopBar(
              currentIndex: _currentIndex,
              total: _total,
              examMode: widget.examMode,
              onBack: () => context.pop(),
            ),
            Expanded(
              child: AnimatedSwitcher(
                duration: AppDur.route,
                switchInCurve: AppCurves.easeOut,
                switchOutCurve: AppCurves.easeIn,
                transitionBuilder: (child, animation) {
                  final slide = Tween<Offset>(
                    begin: const Offset(0.06, 0),
                    end: Offset.zero,
                  ).animate(animation);
                  return FadeTransition(
                    opacity: animation,
                    child: SlideTransition(position: slide, child: child),
                  );
                },
                child: ListView(
                  // Key the scroll view by question so the switcher cross-fades.
                  key: ValueKey<int>(_currentIndex),
                  padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
                  children: [
                    Text(
                      'QUESTION ${_currentIndex + 1}',
                      style: TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.4,
                        color: c.accent,
                      ),
                    ),
                    const SizedBox(height: AppSpace.x3),
                    Text(
                      _q.stem,
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        height: 1.4,
                        color: c.inkStrong,
                      ),
                    ),
                    const SizedBox(height: AppSpace.x5),
                    for (var i = 0; i < _q.options.length; i++) ...[
                      _OptionTile(
                        letter: String.fromCharCode(65 + i),
                        text: _q.options[i],
                        selected: selected == i,
                        revealed: _isRevealed,
                        isCorrect: i == _q.correctIndex,
                        onTap: () => _select(i),
                      ),
                      if (i != _q.options.length - 1)
                        const SizedBox(height: AppSpace.x3),
                    ],
                    if (_isRevealed) ...[
                      const SizedBox(height: AppSpace.x5),
                      _ExplanationCard(
                        correct: selected == _q.correctIndex,
                        text: _q.explanation,
                      ),
                    ],
                  ],
                ),
              ),
            ),
            _BottomBar(
              label: _primaryLabel,
              enabled: _primaryEnabled,
              onPressed: _primaryAction,
            ),
          ],
        ),
      ),
    );
  }
}

class _TopBar extends StatelessWidget {
  final int currentIndex;
  final int total;
  final bool examMode;
  final VoidCallback onBack;

  const _TopBar({
    required this.currentIndex,
    required this.total,
    required this.examMode,
    required this.onBack,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final progress = (currentIndex + 1) / total;

    return Padding(
      padding: const EdgeInsets.fromLTRB(6, 4, 16, 8),
      child: Column(
        children: [
          Row(
            children: [
              IconButton(
                onPressed: onBack,
                iconSize: 24,
                constraints: const BoxConstraints(
                  minWidth: AppSpace.touch,
                  minHeight: AppSpace.touch,
                ),
                splashRadius: 22,
                icon: Icon(Icons.arrow_back_rounded, color: c.inkStrong),
              ),
              const SizedBox(width: AppSpace.x1),
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(AppRadius.pill),
                  child: LinearProgressIndicator(
                    value: progress,
                    minHeight: 6,
                    backgroundColor: c.surface2,
                    valueColor: AlwaysStoppedAnimation<Color>(c.primary),
                  ),
                ),
              ),
              const SizedBox(width: AppSpace.x4),
              Text(
                'Q ${currentIndex + 1}/$total',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  color: c.inkMedium,
                  letterSpacing: 0.2,
                ),
              ),
              if (examMode) ...[
                const SizedBox(width: AppSpace.x3),
                const _TimerChip(time: '28:13'),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _TimerChip extends StatelessWidget {
  final String time;
  const _TimerChip({required this.time});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: c.surface2,
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.timer_outlined, size: 15, color: c.warning),
          const SizedBox(width: 5),
          Text(
            time,
            style: TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w800,
              color: c.inkStrong,
              letterSpacing: 0.3,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }
}

class _OptionTile extends StatelessWidget {
  final String letter;
  final String text;
  final bool selected;
  final bool revealed;
  final bool isCorrect;
  final VoidCallback onTap;

  const _OptionTile({
    required this.letter,
    required this.text,
    required this.selected,
    required this.revealed,
    required this.isCorrect,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;

    // Resolve fills + accent color across the three visual states.
    Color? fill;
    Color circleColor;
    Color circleFg;
    Color textColor = c.inkMedium;
    Widget? trailing;

    if (revealed) {
      if (isCorrect) {
        fill = c.success.withValues(alpha: 0.14);
        circleColor = c.success;
        circleFg = c.page;
        textColor = c.inkStrong;
        trailing = Icon(Icons.check_rounded, size: 20, color: c.success);
      } else if (selected) {
        fill = c.error.withValues(alpha: 0.14);
        circleColor = c.error;
        circleFg = c.page;
        textColor = c.inkStrong;
        trailing = Icon(Icons.close_rounded, size: 20, color: c.error);
      } else {
        fill = null;
        circleColor = c.surface2;
        circleFg = c.inkSoft;
      }
    } else if (selected) {
      fill = c.primaryTint;
      circleColor = c.primary;
      circleFg = c.page;
      textColor = c.inkStrong;
    } else {
      fill = null;
      circleColor = c.surface2;
      circleFg = c.inkSoft;
    }

    final row = Row(
      children: [
        Container(
          width: 30,
          height: 30,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: circleColor,
            shape: BoxShape.circle,
          ),
          child: Text(
            letter,
            style: TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w800,
              color: circleFg,
            ),
          ),
        ),
        const SizedBox(width: AppSpace.x4),
        Expanded(
          child: Text(
            text,
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w600,
              height: 1.35,
              color: textColor,
            ),
          ),
        ),
        if (trailing != null) ...[
          const SizedBox(width: AppSpace.x3),
          trailing,
        ],
      ],
    );

    // A filled state uses a plain fill (no glass), otherwise the frosted card.
    if (fill != null) {
      return AnimatedContainer(
        duration: AppDur.hover,
        curve: AppCurves.standard,
        constraints: const BoxConstraints(minHeight: AppSpace.touch),
        child: Material(
          color: fill,
          borderRadius: BorderRadius.circular(AppRadius.compact),
          child: InkWell(
            onTap: revealed ? null : onTap,
            borderRadius: BorderRadius.circular(AppRadius.compact),
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpace.x4,
                vertical: 14,
              ),
              child: row,
            ),
          ),
        ),
      );
    }

    return GlassCard(
      onTap: revealed ? null : onTap,
      radius: AppRadius.compact,
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpace.x4,
        vertical: 14,
      ),
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 16),
        child: row,
      ),
    );
  }
}

class _ExplanationCard extends StatelessWidget {
  final bool correct;
  final String text;

  const _ExplanationCard({required this.correct, required this.text});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final accent = correct ? c.success : c.error;

    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                correct
                    ? Icons.check_circle_outline_rounded
                    : Icons.info_outline_rounded,
                size: 18,
                color: accent,
              ),
              const SizedBox(width: AppSpace.x2),
              Text(
                correct ? 'Correct' : 'Explanation',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.6,
                  color: accent,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpace.x3),
          Text(
            text,
            style: TextStyle(
              fontSize: 14,
              height: 1.5,
              fontWeight: FontWeight.w500,
              color: c.inkMedium,
            ),
          ),
        ],
      ),
    );
  }
}

class _BottomBar extends StatelessWidget {
  final String label;
  final bool enabled;
  final VoidCallback onPressed;

  const _BottomBar({
    required this.label,
    required this.enabled,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Container(
      color: c.page,
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
      child: AppButton(
        label,
        kind: AppButtonKind.primary,
        expand: true,
        onPressed: enabled ? onPressed : null,
      ),
    );
  }
}
