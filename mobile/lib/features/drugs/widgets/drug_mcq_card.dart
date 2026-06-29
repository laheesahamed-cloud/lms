import 'dart:math';
import 'package:flutter/material.dart';
import '../../../theme/tokens.dart';

const _questionLabels = {
  'drug_class':     'What class does this drug belong to?',
  'uses':           'What is this drug primarily used for?',
  'warnings':       'What is the main warning for this drug?',
  'pregnancy_info': 'What is the pregnancy safety status?',
};

class DrugMCQCard extends StatefulWidget {
  final Map<String, dynamic> drug;
  final List<String> distractors;
  final String questionType;
  final void Function(bool correct) onAnswered;

  const DrugMCQCard({
    super.key,
    required this.drug,
    required this.distractors,
    required this.questionType,
    required this.onAnswered,
  });

  @override
  State<DrugMCQCard> createState() => _DrugMCQCardState();
}

class _DrugMCQCardState extends State<DrugMCQCard> {
  late final List<String> _options;
  late final String _correct;
  String? _selected;

  @override
  void initState() {
    super.initState();
    _correct = (widget.drug[widget.questionType] as String?) ?? '—';
    final opts = [_correct, ...widget.distractors.take(3)];
    opts.shuffle(Random());
    _options = opts;
  }

  void _pick(String opt) {
    if (_selected != null) return;
    setState(() => _selected = opt);
    final correct = opt == _correct;
    Future.delayed(const Duration(milliseconds: 900), () {
      if (mounted) widget.onAnswered(correct);
    });
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final question = _questionLabels[widget.questionType] ?? 'What do you know about this drug?';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 8),
        Text(
          widget.drug['name'] as String? ?? '',
          style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700,
              color: c.inkStrong, letterSpacing: -0.3),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 6),
        Text(question,
            style: TextStyle(fontSize: 15, color: c.inkSoft, height: 1.5),
            textAlign: TextAlign.center),
        const SizedBox(height: 20),
        ...List.generate(_options.length, (i) {
          final opt = _options[i];
          final isSelected = _selected == opt;
          final isCorrect  = opt == _correct;
          Color? bg;
          Color borderColor = c.inkMuted.withValues(alpha: 0.2);

          if (_selected != null) {
            if (isCorrect) {
              bg = Colors.green.withValues(alpha: 0.1);
              borderColor = Colors.green;
            } else if (isSelected) {
              bg = Colors.red.withValues(alpha: 0.08);
              borderColor = Colors.red;
            }
          }

          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: AnimatedOpacity(
              duration: const Duration(milliseconds: 200),
              opacity: (_selected != null && !isCorrect && !isSelected) ? 0.4 : 1.0,
              child: GestureDetector(
                onTap: () => _pick(opt),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  decoration: BoxDecoration(
                    color: bg ?? c.surface1,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: borderColor, width: 1.5),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 28, height: 28,
                        decoration: BoxDecoration(
                          color: c.inkMuted.withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          String.fromCharCode(65 + i),
                          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700,
                              color: c.inkSoft),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(opt,
                            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500,
                                color: c.inkStrong)),
                      ),
                      if (_selected != null && isCorrect)
                        const Icon(Icons.check_circle_outline_rounded, size: 18, color: Colors.green),
                      if (_selected != null && isSelected && !isCorrect)
                        const Icon(Icons.cancel_outlined, size: 18, color: Colors.red),
                    ],
                  ),
                ),
              ),
            ),
          );
        }),
      ],
    );
  }
}
