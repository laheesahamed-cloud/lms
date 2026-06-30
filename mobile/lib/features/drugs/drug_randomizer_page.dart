import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';
import 'drug_queue_service.dart';
import 'drug_randomizer_repository.dart';
import 'widgets/lottery_spinner.dart';
import 'widgets/drug_mcq_card.dart';
import 'widgets/drug_info_card.dart';
import 'widgets/upgrade_prompt.dart';

enum _Phase { idle, spinning, mcq, card }

class DrugRandomizerPage extends ConsumerStatefulWidget {
  const DrugRandomizerPage({super.key});

  @override
  ConsumerState<DrugRandomizerPage> createState() => _DrugRandomizerPageState();
}

class _DrugRandomizerPageState extends ConsumerState<DrugRandomizerPage> {
  _Phase    _phase      = _Phase.idle;
  DrugItem? _current;
  bool?     _mcqCorrect;
  String?   _error;

  Future<void> _spin() async {
    if (_phase == _Phase.spinning) return;
    final svc = ref.read(drugQueueProvider.notifier);

    if (ref.read(drugQueueProvider).queue.isEmpty) {
      setState(() => _error = 'Could not load — please try again.');
      return;
    }

    // Server decides — await before showing spinner
    final item = await svc.pop();
    if (!mounted) return;

    if (item == null) {
      // limit_reached — hasSub + count already corrected in service
      final st = ref.read(drugQueueProvider);
      showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        builder: (_) => UpgradePrompt(freeLimit: st.freeLimit),
      );
      return;
    }

    setState(() {
      _current    = item;
      _phase      = _Phase.spinning;
      _error      = null;
      _mcqCorrect = null;
    });
  }

  void _onSpinDone()           { if (mounted) setState(() => _phase = _Phase.mcq); }
  void _onMCQAnswered(bool ok) => setState(() { _mcqCorrect = ok; _phase = _Phase.card; });
  void _spinAgain()            => setState(() {
    _phase = _Phase.idle; _current = null; _mcqCorrect = null; _error = null;
  });

  @override
  Widget build(BuildContext context) {
    final c         = context.c;
    final st        = ref.watch(drugQueueProvider);
    final isLandscape = MediaQuery.orientationOf(context) == Orientation.landscape;
    final hPad      = isLandscape ? 24.0 : 16.0;

    return SafeArea(
      child: ListView(
        padding: EdgeInsets.fromLTRB(hPad, 14, hPad, 32),
        children: [
          // Header — compact in landscape
          if (!isLandscape) ...[
            Text('STUDY TOOL',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800,
                    letterSpacing: 1.4, color: c.accent)),
            const SizedBox(height: 5),
            Text('Drugs',
                style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800,
                    letterSpacing: -0.5, color: c.inkStrong)),
            const SizedBox(height: 14),
          ] else ...[
            Row(
              children: [
                Text('Drugs',
                    style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800,
                        letterSpacing: -0.4, color: c.inkStrong)),
                const Spacer(),
                if (!st.hasSub)
                  _SpinProgress(used: st.useCount, limit: st.freeLimit, c: c,
                      compact: true),
              ],
            ),
            const SizedBox(height: 12),
          ],

          // Free spin progress (portrait only — landscape shows it in header row)
          if (!st.hasSub && !isLandscape) ...[
            _SpinProgress(used: st.useCount, limit: st.freeLimit, c: c),
            const SizedBox(height: 16),
          ],

          _buildPhase(c, st, isLandscape),
        ],
      ),
    );
  }

  Widget _buildPhase(AppColors c, DrugQueueState st, bool isLandscape) {
    switch (_phase) {
      case _Phase.idle:
        return _IdleCard(
          ready: st.ready, error: _error, onSpin: _spin,
          c: c, landscape: isLandscape,
        );

      case _Phase.spinning:
        return Padding(
          padding: EdgeInsets.symmetric(vertical: isLandscape ? 8 : 32),
          child: Column(
            children: [
              Text('Drawing a drug…',
                  style: TextStyle(fontSize: 16, color: c.inkSoft),
                  textAlign: TextAlign.center),
              const SizedBox(height: 20),
              LotterySpinner(
                drugName: _current!.drug['name'] as String,
                onDone: _onSpinDone,
              ),
            ],
          ),
        );

      case _Phase.mcq:
        return isLandscape
            ? _LandscapeMCQ(
                drug: _current!.drug,
                distractors: _current!.distractors,
                questionType: _current!.questionType,
                onAnswered: _onMCQAnswered,
                c: c,
              )
            : DrugMCQCard(
                drug: _current!.drug,
                distractors: _current!.distractors,
                questionType: _current!.questionType,
                onAnswered: _onMCQAnswered,
              );

      case _Phase.card:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Back button row
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                children: [
                  GestureDetector(
                    onTap: _spinAgain,
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.arrow_back_ios_new_rounded,
                            size: 16, color: c.inkSoft),
                        const SizedBox(width: 4),
                        Text('Back',
                            style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: c.inkSoft)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            _ResultBadge(correct: _mcqCorrect ?? false, c: c),
            const SizedBox(height: 16),
            DrugInfoCard(drug: _current!.drug),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: _spinAgain,
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Spin Again',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                style: FilledButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14)),
                ),
              ),
            ),
          ],
        );
    }
  }
}

// ── Idle card ───────────────────────────────────────────────────────────────

class _IdleCard extends StatelessWidget {
  final bool ready;
  final bool landscape;
  final String? error;
  final VoidCallback onSpin;
  final AppColors c;
  const _IdleCard({
    required this.ready, required this.c, required this.landscape,
    this.error, required this.onSpin,
  });

  @override
  Widget build(BuildContext context) {
    final icon = Container(
      width: landscape ? 64 : 72,
      height: landscape ? 64 : 72,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            c.accent.withValues(alpha: 0.22),
            c.primary.withValues(alpha: 0.14),
          ],
        ),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Icon(Icons.medication_outlined,
          size: landscape ? 30 : 36, color: c.primary),
    );

    final button = SizedBox(
      width: double.infinity,
      child: FilledButton.icon(
        onPressed: ready ? onSpin : null,
        icon: ready
            ? const Icon(Icons.shuffle_rounded)
            : const SizedBox(width: 18, height: 18,
                child: CircularProgressIndicator(
                    strokeWidth: 2, color: Colors.white)),
        label: Text(ready ? 'Spin' : 'Loading…',
            style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
        style: FilledButton.styleFrom(
          padding: const EdgeInsets.symmetric(vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
      ),
    );

    if (landscape) {
      // Landscape: icon + text on left, button on right
      return GlassCard(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            icon,
            const SizedBox(width: 20),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Ready to study?',
                      style: TextStyle(fontSize: 19, fontWeight: FontWeight.w700,
                          color: c.inkStrong, letterSpacing: -0.3)),
                  const SizedBox(height: 6),
                  Text(
                    'Spin to get a random drug, answer a quick question, then see the full drug card.',
                    style: TextStyle(fontSize: 13, color: c.inkSoft, height: 1.5),
                  ),
                  if (error != null) ...[
                    const SizedBox(height: 8),
                    Text(error!, style: const TextStyle(color: Colors.red, fontSize: 13)),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 20),
            SizedBox(width: 140, child: button),
          ],
        ),
      );
    }

    // Portrait: stacked
    return GlassCard(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
      child: Column(children: [
        icon,
        const SizedBox(height: 20),
        Text('Ready to study?',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700,
                color: c.inkStrong, letterSpacing: -0.3),
            textAlign: TextAlign.center),
        const SizedBox(height: 8),
        Text(
          'Spin to get a random drug, answer a quick question, then see the full drug card.',
          style: TextStyle(fontSize: 14, color: c.inkSoft, height: 1.5),
          textAlign: TextAlign.center,
        ),
        if (error != null) ...[
          const SizedBox(height: 12),
          Text(error!, style: const TextStyle(color: Colors.red, fontSize: 14),
              textAlign: TextAlign.center),
        ],
        const SizedBox(height: 28),
        button,
      ]),
    );
  }
}

// ── Landscape MCQ wrapper ───────────────────────────────────────────────────

class _LandscapeMCQ extends StatelessWidget {
  final Map<String, dynamic> drug;
  final List<String> distractors;
  final String questionType;
  final void Function(bool) onAnswered;
  final AppColors c;
  const _LandscapeMCQ({
    required this.drug, required this.distractors,
    required this.questionType, required this.onAnswered, required this.c,
  });

  @override
  Widget build(BuildContext context) {
    return DrugMCQCard(
      drug: drug,
      distractors: distractors,
      questionType: questionType,
      onAnswered: onAnswered,
    );
  }
}

// ── Progress bar ────────────────────────────────────────────────────────────

class _SpinProgress extends StatelessWidget {
  final int used, limit;
  final AppColors c;
  final bool compact;
  const _SpinProgress({
    required this.used, required this.limit, required this.c,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    final clamped = used.clamp(0, limit);
    final bar = ClipRRect(
      borderRadius: BorderRadius.circular(4),
      child: LinearProgressIndicator(
        value: (clamped / limit).clamp(0.0, 1.0),
        minHeight: compact ? 4 : 5,
        backgroundColor: c.inkMuted.withValues(alpha: 0.15),
        valueColor: AlwaysStoppedAnimation(
            clamped >= limit ? Colors.orange : c.primary),
      ),
    );
    return Row(children: [
      Text('$clamped / $limit free spins',
          style: TextStyle(fontSize: compact ? 12 : 13, color: c.inkSoft)),
      const SizedBox(width: 10),
      if (compact) SizedBox(width: 60, child: bar)
      else Expanded(child: bar),
    ]);
  }
}

// ── Result badge ────────────────────────────────────────────────────────────

class _ResultBadge extends StatelessWidget {
  final bool correct;
  final AppColors c;
  const _ResultBadge({required this.correct, required this.c});

  @override
  Widget build(BuildContext context) {
    final color = correct ? Colors.green : Colors.red;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(correct ? Icons.check_circle_outline_rounded : Icons.cancel_outlined,
              size: 18, color: color),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              correct ? 'Correct!' : 'Not quite — see the full answer below',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: color),
            ),
          ),
        ],
      ),
    );
  }
}
