import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../theme/tokens.dart';
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

    // Check free spin limit client-side
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
      setState(() => _error = 'Could not load a drug — please try again.');
      return;
    }

    setState(() {
      _current    = item;
      _phase      = _Phase.spinning;
      _error      = null;
      _mcqCorrect = null;
    });
  }

  void _onSpinDone() {
    if (mounted) setState(() => _phase = _Phase.mcq);
  }

  void _onMCQAnswered(bool correct) {
    setState(() { _mcqCorrect = correct; _phase = _Phase.card; });
  }

  void _spinAgain() {
    setState(() { _phase = _Phase.idle; _current = null; _mcqCorrect = null; _error = null; });
  }

  @override
  Widget build(BuildContext context) {
    final c  = context.c;
    final st = ref.watch(drugQueueProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Drug Randomizer'),
        centerTitle: false,
        bottom: (!st.hasSub)
            ? PreferredSize(
                preferredSize: const Size.fromHeight(28),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                  child: Row(
                    children: [
                      Text(
                        '${min(st.useCount, st.freeLimit)} / ${st.freeLimit} free spins',
                        style: TextStyle(fontSize: 12, color: c.inkSoft),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: LinearProgressIndicator(
                            value: (st.useCount / st.freeLimit).clamp(0.0, 1.0),
                            minHeight: 4,
                            backgroundColor: c.inkMuted.withValues(alpha: 0.15),
                            valueColor: AlwaysStoppedAnimation(c.primary),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              )
            : null,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
          child: _buildBody(c, st),
        ),
      ),
    );
  }

  Widget _buildBody(dynamic c, DrugQueueState st) {
    switch (_phase) {
      case _Phase.idle:
        return _IdleView(
          ready: st.ready,
          error: _error ?? st.error,
          onSpin: _spin,
        );

      case _Phase.spinning:
        return LotterySpinner(
          drugName: _current!.drug['name'] as String,
          onDone: _onSpinDone,
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
          children: [
            _ResultBadge(correct: _mcqCorrect ?? false),
            const SizedBox(height: 16),
            DrugInfoCard(drug: _current!.drug),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: _spinAgain,
                icon: const Text('🎲', style: TextStyle(fontSize: 18)),
                label: const Text('Spin Again'),
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

class _IdleView extends StatelessWidget {
  final bool ready;
  final String? error;
  final VoidCallback onSpin;
  const _IdleView({required this.ready, this.error, required this.onSpin});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Column(
      children: [
        const SizedBox(height: 32),
        const Text('🎲', style: TextStyle(fontSize: 64)),
        const SizedBox(height: 16),
        Text('Ready to study?',
            style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w700,
                color: c.inkStrong,
                letterSpacing: -0.3)),
        const SizedBox(height: 8),
        Text(
          'Spin to get a random drug, answer a quick question,\nthen see the full drug card.',
          style: TextStyle(fontSize: 14, color: c.inkSoft, height: 1.5),
          textAlign: TextAlign.center,
        ),
        if (error != null) ...[
          const SizedBox(height: 16),
          Text(error!, style: const TextStyle(color: Colors.red, fontSize: 14)),
        ],
        const SizedBox(height: 32),
        SizedBox(
          width: 180,
          child: FilledButton.icon(
            onPressed: ready ? onSpin : null,
            icon: !ready
                ? const SizedBox(
                    width: 18, height: 18,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white))
                : const Text('🎲', style: TextStyle(fontSize: 20)),
            label: Text(
              ready ? 'Spin' : 'Loading…',
              style: const TextStyle(
                  fontSize: 18, fontWeight: FontWeight.w700),
            ),
            style: FilledButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16)),
            ),
          ),
        ),
      ],
    );
  }
}

class _ResultBadge extends StatelessWidget {
  final bool correct;
  const _ResultBadge({required this.correct});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
      decoration: BoxDecoration(
        color: correct
            ? Colors.green.withValues(alpha: 0.12)
            : Colors.red.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(30),
      ),
      child: Text(
        correct ? '✓ Correct!' : '✗ Not quite — here\'s the full answer',
        style: TextStyle(
          fontSize: 15,
          fontWeight: FontWeight.w600,
          color: correct ? Colors.green.shade700 : Colors.red.shade600,
        ),
      ),
    );
  }
}
