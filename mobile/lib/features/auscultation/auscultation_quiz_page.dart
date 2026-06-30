import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';
import 'auscultation_repository.dart';
import 'widgets/audio_player_card.dart';

class AuscultationQuizPage extends ConsumerStatefulWidget {
  final String category;
  const AuscultationQuizPage({super.key, required this.category});
  @override
  ConsumerState<AuscultationQuizPage> createState() => _AuscultationQuizPageState();
}

class _AuscultationQuizPageState extends ConsumerState<AuscultationQuizPage> {
  List<AuscQuizQuestion> _questions = [];
  bool _loading = true;
  String? _error;
  int _idx = 0;
  String? _picked;
  int _score = 0;
  bool _done = false;
  List<String> _options = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; _idx = 0; _picked = null; _score = 0; _done = false; });
    try {
      final qs = await ref.read(auscultationRepositoryProvider).quiz(widget.category, count: 10);
      if (!mounted) return;
      setState(() { _questions = qs; _loading = false; _shuffle(); });
    } catch (_) {
      if (mounted) setState(() { _error = 'Could not load quiz'; _loading = false; });
    }
  }

  void _shuffle() {
    if (_idx >= _questions.length) { _options = []; return; }
    final o = [..._questions[_idx].options];
    final rnd = math.Random(_questions[_idx].id);
    for (var i = o.length - 1; i > 0; i--) { final j = rnd.nextInt(i + 1); final t = o[i]; o[i] = o[j]; o[j] = t; }
    _options = o;
  }

  void _pick(String opt) {
    if (_picked != null) return;
    setState(() {
      _picked = opt;
      if (opt == _questions[_idx].answer) _score++;
    });
  }

  void _next() {
    if (_idx + 1 >= _questions.length) { setState(() => _done = true); return; }
    setState(() { _idx++; _picked = null; _shuffle(); });
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final isLandscape = MediaQuery.orientationOf(context) == Orientation.landscape;
    final hPad = isLandscape ? 24.0 : 16.0;
    final label = widget.category == 'lung' ? 'Lung' : 'Heart';

    return SafeArea(
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 760),
          child: ListView(
            padding: EdgeInsets.fromLTRB(hPad, 8, hPad, 32),
            children: [
              Row(children: [
                IconButton(
                  padding: EdgeInsets.zero, constraints: const BoxConstraints(minWidth: 40, minHeight: 40),
                  icon: Icon(Icons.arrow_back_ios_new_rounded, size: 20, color: c.inkStrong),
                  onPressed: () => context.pop(),
                ),
                const SizedBox(width: 4),
                Text('$label Sounds Quiz', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, letterSpacing: -0.4, color: c.inkStrong)),
              ]),
              const SizedBox(height: 12),
              _body(c),
            ],
          ),
        ),
      ),
    );
  }

  Widget _body(AppColors c) {
    if (_loading) {
      return Container(height: 320, decoration: BoxDecoration(color: c.card, borderRadius: BorderRadius.circular(AppRadius.card), border: Border.all(color: c.line)));
    }
    if (_error != null) {
      return Padding(padding: const EdgeInsets.symmetric(vertical: 40), child: Column(children: [
        Icon(Icons.cloud_off_rounded, size: 32, color: c.inkMuted),
        const SizedBox(height: 12), Text(_error!, style: TextStyle(fontSize: 14, color: c.inkSoft)),
        const SizedBox(height: 14), OutlinedButton(onPressed: _load, child: const Text('Retry')),
      ]));
    }
    if (_questions.isEmpty) {
      return Padding(padding: const EdgeInsets.symmetric(vertical: 48),
        child: Center(child: Text('No ${widget.category} quiz questions yet.', textAlign: TextAlign.center, style: TextStyle(fontSize: 14, color: c.inkSoft))));
    }
    if (_done) {
      final pct = _score / _questions.length;
      return GlassCard(padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 20), child: Column(children: [
        Text('$_score / ${_questions.length}', style: TextStyle(fontSize: 48, fontWeight: FontWeight.w900, letterSpacing: -1, color: c.primary)),
        const SizedBox(height: 6),
        Text(pct == 1 ? 'Perfect!' : pct >= 0.7 ? 'Great ear!' : pct >= 0.4 ? 'Keep practising.' : 'Listen again and retry.',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: c.inkSoft)),
        const SizedBox(height: 22),
        Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          FilledButton(onPressed: _load, child: const Text('Try again')),
          const SizedBox(width: 10),
          OutlinedButton(onPressed: () => context.pop(), child: const Text('Back')),
        ]),
      ]));
    }

    final q = _questions[_idx];
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      ClipRRect(
        borderRadius: BorderRadius.circular(999),
        child: LinearProgressIndicator(value: _idx / _questions.length, minHeight: 6, backgroundColor: c.surface2, valueColor: AlwaysStoppedAnimation(c.primary)),
      ),
      const SizedBox(height: 8),
      Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Text('Question ${_idx + 1} of ${_questions.length}', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: c.inkSoft)),
        Text('Score: $_score', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: c.inkSoft)),
      ]),
      const SizedBox(height: 14),
      GlassCard(padding: const EdgeInsets.all(AppSpace.x4), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        if (q.hasAudio) AudioPlayerCard(kind: 'quiz', id: q.id, category: widget.category, title: 'Listen to the sound'),
        const SizedBox(height: AppSpace.x4),
        Text(q.questionText, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, letterSpacing: -0.3, color: c.inkStrong)),
        const SizedBox(height: AppSpace.x3),
        ..._options.map((opt) => _option(c, q, opt)),
        if (_picked != null) ...[
          const SizedBox(height: AppSpace.x3),
          _feedback(c, q),
        ],
      ])),
    ]);
  }

  Widget _option(AppColors c, AuscQuizQuestion q, String opt) {
    Color border = c.line;
    Color bg = c.card;
    Color text = c.inkStrong;
    if (_picked != null) {
      if (opt == q.answer) { border = Colors.green; bg = Colors.green.withValues(alpha: 0.10); text = Colors.green.shade700; }
      else if (opt == _picked) { border = Colors.red; bg = Colors.red.withValues(alpha: 0.08); text = Colors.red.shade700; }
    }
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: GestureDetector(
        onTap: () => _pick(opt),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(14), border: Border.all(color: border, width: 1.5)),
          child: Text(opt, style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w600, color: text)),
        ),
      ),
    );
  }

  Widget _feedback(AppColors c, AuscQuizQuestion q) {
    final correct = _picked == q.answer;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpace.x4),
      decoration: BoxDecoration(
        color: (correct ? Colors.green : Colors.red).withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(correct ? 'Correct!' : 'Answer: ${q.answer}', style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: c.inkStrong)),
        if (q.explanation.isNotEmpty) ...[
          const SizedBox(height: 6),
          Text(q.explanation, style: TextStyle(fontSize: 13.5, height: 1.55, color: c.inkSoft)),
        ],
        const SizedBox(height: 14),
        SizedBox(width: double.infinity, child: FilledButton(
          onPressed: _next,
          child: Text(_idx + 1 >= _questions.length ? 'See result' : 'Next question'),
        )),
      ]),
    );
  }
}
