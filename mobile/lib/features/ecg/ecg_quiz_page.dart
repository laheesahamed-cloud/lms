import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';
import '../../widgets/content_image.dart';
import 'ecg_repository.dart';

class EcgQuizPage extends ConsumerStatefulWidget {
  const EcgQuizPage({super.key});

  @override
  ConsumerState<EcgQuizPage> createState() => _EcgQuizPageState();
}

class _EcgQuizPageState extends ConsumerState<EcgQuizPage> {
  bool _loading = true;
  String? _error;
  List<EcgQuizQuestion> _questions = [];
  List<List<String>> _shuffledOptions = [];

  int _idx = 0;
  String? _picked;
  int _score = 0;
  bool _done = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final qs = await ref.read(ecgRepositoryProvider).quiz(count: 10);
      if (!mounted) return;
      setState(() {
        _questions = qs;
        _shuffledOptions = qs.map((q) {
          final o = [...q.options]..shuffle(Random());
          return o;
        }).toList();
        _idx = 0; _picked = null; _score = 0; _done = false;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() { _error = "Couldn't load the quiz"; _loading = false; });
    }
  }

  void _pick(String opt) {
    if (_picked != null) return;
    setState(() {
      _picked = opt;
      if (opt == _questions[_idx].answer) _score++;
    });
  }

  void _next() {
    if (_idx + 1 >= _questions.length) {
      setState(() => _done = true);
    } else {
      setState(() { _idx++; _picked = null; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final isLandscape = MediaQuery.orientationOf(context) == Orientation.landscape;
    final hPad = isLandscape ? 24.0 : 16.0;

    return SafeArea(
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 880),
          child: ListView(
            padding: EdgeInsets.fromLTRB(hPad, 8, hPad, 32),
            children: [
              _BackTitle(c: c),
              const SizedBox(height: 10),
              _buildBody(c),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBody(AppColors c) {
    if (_loading) return _Skeleton(c: c);
    if (_error != null) {
      return _ErrorBox(c: c, onRetry: _load);
    }
    if (_questions.isEmpty) {
      return _EmptyBox(c: c, text: 'No ECG quiz questions available yet.');
    }
    if (_done) return _Result(c: c, score: _score, total: _questions.length, onRetry: _load);

    final q = _questions[_idx];
    final options = _shuffledOptions[_idx];

    // Progress + meta
    final progress = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: _idx / _questions.length,
            minHeight: 6,
            backgroundColor: c.inkMuted.withValues(alpha: 0.15),
            valueColor: AlwaysStoppedAnimation(c.primary),
          ),
        ),
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('Question ${_idx + 1} of ${_questions.length}',
                style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: c.inkSoft)),
            Text('Score: $_score',
                style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: c.inkSoft)),
          ],
        ),
      ],
    );

    final image = q.imageUrl.isEmpty
        ? const SizedBox.shrink()
        : Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(AppRadius.inner),
              border: Border.all(color: c.line),
            ),
            padding: const EdgeInsets.all(8),
            child: ContentImage(q.imageUrl, fit: BoxFit.contain, borderRadius: 8),
          );

    final qAndOptions = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(q.questionText,
            style: TextStyle(fontSize: 16.5, fontWeight: FontWeight.w800,
                letterSpacing: -0.3, color: c.inkStrong)),
        const SizedBox(height: AppSpace.x3),
        for (final opt in options) ...[
          _OptionTile(
            text: opt,
            state: _picked == null
                ? _OptState.idle
                : (opt == q.answer
                    ? _OptState.correct
                    : (opt == _picked ? _OptState.wrong : _OptState.dim)),
            onTap: () => _pick(opt),
            c: c,
          ),
          const SizedBox(height: 10),
        ],
        if (_picked != null) _Feedback(q: q, correct: _picked == q.answer, c: c, onNext: _next,
            isLast: _idx + 1 >= _questions.length),
      ],
    );

    // Always stacked: ECG image on top, question + options below — in both
    // portrait and landscape (a wide ECG strip reads best full-width).
    final card = GlassCard(
      padding: const EdgeInsets.all(AppSpace.x4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (q.imageUrl.isNotEmpty) ...[image, const SizedBox(height: AppSpace.x4)],
          qAndOptions,
        ],
      ),
    );

    return Column(
      children: [
        progress,
        const SizedBox(height: 14),
        card,
      ],
    );
  }
}

// ── Back + title ──────────────────────────────────────────────────────────────

class _BackTitle extends StatelessWidget {
  final AppColors c;
  const _BackTitle({required this.c});
  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        IconButton(
          padding: EdgeInsets.zero,
          constraints: const BoxConstraints(minWidth: 40, minHeight: 40),
          icon: Icon(Icons.arrow_back_ios_new_rounded, size: 20, color: c.inkStrong),
          onPressed: () => context.pop(),
        ),
        const SizedBox(width: 4),
        Text('ECG Quiz',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800,
                letterSpacing: -0.4, color: c.inkStrong)),
      ],
    );
  }
}

// ── Option tile ───────────────────────────────────────────────────────────────

enum _OptState { idle, correct, wrong, dim }

class _OptionTile extends StatelessWidget {
  final String text;
  final _OptState state;
  final VoidCallback onTap;
  final AppColors c;
  const _OptionTile({
    required this.text, required this.state, required this.onTap, required this.c,
  });

  @override
  Widget build(BuildContext context) {
    Color border = c.line;
    Color bg = c.card;
    Color fg = c.inkStrong;
    Widget? trailing;
    switch (state) {
      case _OptState.idle:
        break;
      case _OptState.correct:
        border = Colors.green; bg = Colors.green.withValues(alpha: 0.10); fg = Colors.green.shade700;
        trailing = const Icon(Icons.check_circle_rounded, size: 20, color: Colors.green);
        break;
      case _OptState.wrong:
        border = Colors.red; bg = Colors.red.withValues(alpha: 0.08); fg = Colors.red.shade700;
        trailing = const Icon(Icons.cancel_rounded, size: 20, color: Colors.red);
        break;
      case _OptState.dim:
        fg = c.inkSoft;
        break;
    }

    return Opacity(
      opacity: state == _OptState.dim ? 0.55 : 1,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: border, width: 1.5),
          ),
          child: Row(
            children: [
              Expanded(
                child: Text(text,
                    style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w600, color: fg)),
              ),
              if (trailing != null) ...[const SizedBox(width: 8), trailing],
            ],
          ),
        ),
      ),
    );
  }
}

// ── Feedback ──────────────────────────────────────────────────────────────────

class _Feedback extends StatelessWidget {
  final EcgQuizQuestion q;
  final bool correct;
  final bool isLast;
  final AppColors c;
  final VoidCallback onNext;
  const _Feedback({
    required this.q, required this.correct, required this.c, required this.onNext,
    required this.isLast,
  });

  @override
  Widget build(BuildContext context) {
    final color = correct ? Colors.green : Colors.red;
    return Container(
      margin: const EdgeInsets.only(top: 6),
      padding: const EdgeInsets.all(AppSpace.x4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(correct ? 'Correct!' : 'Answer: ${q.answer}',
              style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800, color: color)),
          if (q.explanation.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(q.explanation,
                style: TextStyle(fontSize: 13.5, height: 1.55, color: c.inkSoft)),
          ],
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: onNext,
              style: FilledButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: Text(isLast ? 'See result' : 'Next question',
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Result ────────────────────────────────────────────────────────────────────

class _Result extends StatelessWidget {
  final AppColors c;
  final int score, total;
  final VoidCallback onRetry;
  const _Result({required this.c, required this.score, required this.total, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    final pct = total == 0 ? 0 : score / total;
    final label = pct == 1
        ? 'Perfect! 🎉'
        : pct >= 0.7
            ? 'Great work!'
            : pct >= 0.4
                ? 'Keep practising.'
                : 'Review the topics and try again.';
    return GlassCard(
      padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 24),
      child: Column(
        children: [
          Text('$score / $total',
              style: TextStyle(fontSize: 52, fontWeight: FontWeight.w900,
                  letterSpacing: -1, color: c.primary)),
          const SizedBox(height: 6),
          Text(label, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: c.inkSoft)),
          const SizedBox(height: 24),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              FilledButton(
                onPressed: onRetry,
                style: FilledButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 13),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text('Try again', style: TextStyle(fontWeight: FontWeight.w700)),
              ),
              const SizedBox(width: 10),
              OutlinedButton(
                onPressed: () => context.pop(),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 13),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text('Back to ECG', style: TextStyle(fontWeight: FontWeight.w700)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ── States ────────────────────────────────────────────────────────────────────

class _Skeleton extends StatelessWidget {
  final AppColors c;
  const _Skeleton({required this.c});
  @override
  Widget build(BuildContext context) {
    return Container(
      height: 380,
      decoration: BoxDecoration(
        color: c.card,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: c.line),
      ),
    );
  }
}

class _EmptyBox extends StatelessWidget {
  final AppColors c;
  final String text;
  const _EmptyBox({required this.c, required this.text});
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 48),
      child: Center(
        child: Text(text, textAlign: TextAlign.center,
            style: TextStyle(fontSize: 14, color: c.inkSoft)),
      ),
    );
  }
}

class _ErrorBox extends StatelessWidget {
  final AppColors c;
  final VoidCallback onRetry;
  const _ErrorBox({required this.c, required this.onRetry});
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 40),
      child: Column(
        children: [
          Icon(Icons.cloud_off_rounded, size: 32, color: c.inkMuted),
          const SizedBox(height: 12),
          Text("Couldn't load the quiz", style: TextStyle(fontSize: 14, color: c.inkSoft)),
          const SizedBox(height: 14),
          OutlinedButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    );
  }
}
