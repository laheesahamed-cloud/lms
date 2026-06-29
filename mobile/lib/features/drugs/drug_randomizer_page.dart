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

  void _spin() {
    if (_phase == _Phase.spinning) return;
    final svc = ref.read(drugQueueProvider.notifier);
    final st  = ref.read(drugQueueProvider);

    if (!st.hasSub && st.useCount >= st.freeLimit) {
      showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        builder: (_) => UpgradePrompt(freeLimit: st.freeLimit),
      );
      return;
    }

    final item = svc.pop();
    if (item == null) {
      setState(() => _error = 'Could not load — please try again.');
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
  void _spinAgain()            => setState(() { _phase = _Phase.idle; _current = null; _mcqCorrect = null; _error = null; });

  @override
  Widget build(BuildContext context) {
    final c  = context.c;
    final st = ref.watch(drugQueueProvider);

    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
        children: [
          Text('STUDY TOOL',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800,
                  letterSpacing: 1.4, color: c.accent)),
          const SizedBox(height: 5),
          Text('Drugs',
              style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800,
                  letterSpacing: -0.5, color: c.inkStrong)),
          const SizedBox(height: 14),

          if (!st.hasSub) ...[
            _SpinProgress(used: st.useCount, limit: st.freeLimit, c: c),
            const SizedBox(height: 16),
          ],

          _buildPhase(c, st),
        ],
      ),
    );
  }

  Widget _buildPhase(AppColors c, DrugQueueState st) {
    switch (_phase) {
      case _Phase.idle:
        return _IdleCard(ready: st.ready, error: _error, onSpin: _spin, c: c);

      case _Phase.spinning:
        return Column(
          children: [
            const SizedBox(height: 32),
            Text('Drawing a drug…',
                style: TextStyle(fontSize: 16, color: c.inkSoft),
                textAlign: TextAlign.center),
            const SizedBox(height: 24),
            LotterySpinner(
              drugName: _current!.drug['name'] as String,
              onDone: _onSpinDone,
            ),
          ],
        );

      case _Phase.mcq:
        return DrugMCQCard(
          drug: _current!.drug,
          distractors: _current!.distractors,
          questionType: _current!.questionType,
          onAnswered: _onMCQAnswered,
        );

      case _Phase.card:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
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
  final String? error;
  final VoidCallback onSpin;
  final AppColors c;
  const _IdleCard({required this.ready, this.error, required this.onSpin, required this.c});

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      const SizedBox(height: 24),
      GlassCard(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
        child: Column(children: [
          Container(
            width: 72, height: 72,
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
            child: Icon(Icons.medication_outlined, size: 36, color: c.primary),
          ),
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
          SizedBox(
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
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
              ),
            ),
          ),
        ]),
      ),
    ]);
  }
}

// ── Progress bar ────────────────────────────────────────────────────────────

class _SpinProgress extends StatelessWidget {
  final int used, limit;
  final AppColors c;
  const _SpinProgress({required this.used, required this.limit, required this.c});

  @override
  Widget build(BuildContext context) {
    final clamped = used.clamp(0, limit);
    return Row(children: [
      Text('$clamped / $limit free spins',
          style: TextStyle(fontSize: 13, color: c.inkSoft)),
      const SizedBox(width: 12),
      Expanded(
        child: ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: (clamped / limit).clamp(0.0, 1.0),
            minHeight: 5,
            backgroundColor: c.inkMuted.withValues(alpha: 0.15),
            valueColor: AlwaysStoppedAnimation(
                clamped >= limit ? Colors.orange : c.primary),
          ),
        ),
      ),
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
