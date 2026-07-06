import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../theme/tokens.dart';
import '../../widgets/content_image.dart';
import 'flashcards_repository.dart';

/// FSRS review session: front → reveal answer → grade (Again/Hard/Good/Easy),
/// each button labelled with its predicted interval. Grades sync to the server.
class ReviewSessionPage extends ConsumerStatefulWidget {
  final String noteIdsCsv;
  final String title;
  const ReviewSessionPage(
      {super.key, required this.noteIdsCsv, required this.title});

  @override
  ConsumerState<ReviewSessionPage> createState() => _ReviewSessionPageState();
}

class _ReviewSessionPageState extends ConsumerState<ReviewSessionPage>
    with SingleTickerProviderStateMixin {
  int _index = 0;
  bool _flipped = false;
  int _reviewed = 0;
  int _uidSeq = 0;

  // Swipe-to-grade (only when flipped): drag follows the finger, then the card
  // springs back or flies off. Swipe right = Good (3), swipe left = Again (1).
  Offset _drag = Offset.zero;
  Offset _animFrom = Offset.zero;
  Offset _animTo = Offset.zero;
  late final AnimationController _swipe;

  static const _again = Color(0xFFDC2626);
  static const _hard = Color(0xFFF59E0B);
  static const _good = Color(0xFF16A34A);
  static const _easy = Color(0xFF2563EB);

  @override
  void initState() {
    super.initState();
    _swipe = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 260))
      ..addListener(() {
        setState(() {
          _drag = Offset.lerp(_animFrom, _animTo, _swipe.value)!;
        });
      });
  }

  @override
  void dispose() {
    _swipe.dispose();
    super.dispose();
  }

  void _springBack() {
    _animFrom = _drag;
    _animTo = Offset.zero;
    _swipe.forward(from: 0);
  }

  // Fly the card off-screen in [dir] (-1 left / +1 right), then grade.
  void _flyOffAndGrade(QueueCard qc, int dir, int rating) {
    final w = MediaQuery.of(context).size.width;
    _animFrom = _drag;
    _animTo = Offset(dir * w * 1.5, _drag.dy);
    _swipe.forward(from: 0).then((_) {
      _drag = Offset.zero;
      _grade(qc, rating); // advances index + resets _flipped
    });
  }

  void _grade(QueueCard qc, int rating) {
    rating == 1 ? HapticFeedback.heavyImpact() : HapticFeedback.mediumImpact();
    final api = ref.read(flashcardsApiProvider);
    _uidSeq++;
    final uid = '${DateTime.now().microsecondsSinceEpoch}-${qc.card.id}-$_uidSeq';
    // Fire-and-forget (offline-safe via reviewUid); UI advances immediately.
    submitFlashcardReview(
      api,
      cardId: qc.card.id,
      rating: rating,
      reviewUid: uid,
      reviewTimeIso: DateTime.now().toUtc().toIso8601String(),
    ).catchError((_) {});
    setState(() {
      _reviewed++;
      _index++;
      _flipped = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final queueAsync = ref.watch(flashQueueProvider(widget.noteIdsCsv));
    return Scaffold(
      backgroundColor: c.page,
      body: SafeArea(
        child: queueAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('Could not load cards.\n$e',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: c.inkSoft)),
                  const SizedBox(height: 16),
                  TextButton(
                      onPressed: () => context.pop(), child: const Text('Back')),
                ],
              ),
            ),
          ),
          data: (queue) {
            final total = queue.cards.length;
            if (total == 0 || _index >= total) {
              return _done(c, total);
            }
            final qc = queue.cards[_index];
            return Column(
              children: [
                _topBar(c, total),
                Expanded(child: _cardArea(c, qc)),
                _flipped ? _gradeBar(c, qc) : _showAnswerBar(c),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _topBar(AppColors c, int total) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 6, 16, 6),
      child: Row(
        children: [
          IconButton(
            onPressed: () => context.pop(),
            icon: Icon(Icons.close_rounded, size: 22, color: c.inkMedium),
          ),
          Expanded(
            child: Text(widget.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: c.inkStrong)),
          ),
          Text('${_index + 1} / $total',
              style: TextStyle(
                  fontSize: 14, fontWeight: FontWeight.w700, color: c.inkSoft)),
        ],
      ),
    );
  }

  Widget _cardArea(AppColors c, QueueCard qc) {
    final w = MediaQuery.of(context).size.width;
    final threshold = w * 0.26;
    // Tilt + hint strength follow how far the card is dragged.
    final dragRatio = (_drag.dx / w).clamp(-1.0, 1.0);
    final tilt = dragRatio * 0.18; // radians, gentle lean
    final hint = (_drag.dx.abs() / threshold).clamp(0.0, 1.0);

    return GestureDetector(
      onTap: () { HapticFeedback.lightImpact(); setState(() => _flipped = !_flipped); },
      onHorizontalDragUpdate: _flipped && !_swipe.isAnimating
          ? (d) => setState(() => _drag += Offset(d.delta.dx, d.delta.dy * 0.3))
          : null,
      onHorizontalDragEnd: _flipped && !_swipe.isAnimating
          ? (_) {
              if (_drag.dx > threshold) {
                _flyOffAndGrade(qc, 1, 3); // swipe right → Good
              } else if (_drag.dx < -threshold) {
                _flyOffAndGrade(qc, -1, 1); // swipe left → Again
              } else {
                _springBack();
              }
            }
          : null,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 6, 16, 16),
        child: Transform.translate(
          offset: _drag,
          child: Transform.rotate(
            angle: tilt,
            child: Stack(
              alignment: Alignment.center,
              children: [
                TweenAnimationBuilder<double>(
                  tween: Tween(begin: 0, end: _flipped ? 1.0 : 0.0),
                  duration: const Duration(milliseconds: 420),
                  curve: Curves.easeInOut,
                  builder: (context, t, _) {
                    final angle = t * math.pi;
                    final showBack = angle > math.pi / 2;
                    final face = showBack
                        // Counter-rotate the back so its text isn't mirrored.
                        ? Transform(
                            alignment: Alignment.center,
                            transform: Matrix4.identity()..rotateY(math.pi),
                            child: _cardFace(c, qc, back: true),
                          )
                        : _cardFace(c, qc, back: false);
                    return Transform(
                      alignment: Alignment.center,
                      transform: Matrix4.identity()
                        ..setEntry(3, 2, 0.0012) // perspective
                        ..rotateY(angle),
                      child: face,
                    );
                  },
                ),
                if (_drag.dx > 4) _swipeHint('Good', _good, hint, right: true),
                if (_drag.dx < -4) _swipeHint('Again', _again, hint, right: false),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _swipeHint(String label, Color color, double strength,
      {required bool right}) {
    return Positioned(
      top: 18,
      left: right ? 18 : null,
      right: right ? null : 18,
      child: Opacity(
        opacity: strength,
        child: Transform.rotate(
          angle: right ? -0.22 : 0.22,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: color, width: 2.5),
              color: color.withValues(alpha: 0.12),
            ),
            child: Text(label.toUpperCase(),
                style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1,
                    color: color)),
          ),
        ),
      ),
    );
  }

  Widget _cardFace(AppColors c, QueueCard qc, {required bool back}) {
    return Container(
      width: double.infinity,
      constraints: BoxConstraints(
          minHeight: MediaQuery.of(context).size.height * 0.62),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: c.cardElevated,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: c.line),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: back
            ? [
                Text('ANSWER',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.4,
                        color: c.accent)),
                const SizedBox(height: 14),
                _flashcardImage(qc.card),
                _answerBody(c, qc.card.answer),
              ]
            : [
                Text(qc.card.question,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                        fontSize: 18,
                        height: 1.45,
                        fontWeight: FontWeight.w700,
                        color: c.inkStrong)),
                const SizedBox(height: 14),
                Text('Tap to reveal answer',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: c.inkMuted)),
              ],
      ),
    );
  }

  Widget _answerBody(AppColors c, String answer) {
    final lines = answer.split('\n');
    final widgets = <Widget>[];
    for (final raw in lines) {
      final line = raw.trimRight();
      if (line.trim().isEmpty) {
        widgets.add(const SizedBox(height: 6));
        continue;
      }
      final trimmed = line.trimLeft();
      final isBullet = trimmed.startsWith('•') ||
          trimmed.startsWith('-') ||
          trimmed.startsWith('*');
      if (isBullet) {
        final text = trimmed.replaceFirst(RegExp(r'^[•\-\*]\s*'), '');
        widgets.add(Padding(
          padding: const EdgeInsets.only(bottom: 5),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('• ',
                  style: TextStyle(
                      fontSize: 16,
                      height: 1.5,
                      fontWeight: FontWeight.w800,
                      color: c.primary)),
              Expanded(
                child: Text(text,
                    style: TextStyle(
                        fontSize: 16,
                        height: 1.5,
                        fontWeight: FontWeight.w600,
                        color: c.inkStrong)),
              ),
            ],
          ),
        ));
      } else {
        widgets.add(Padding(
          padding: const EdgeInsets.only(bottom: 5),
          child: Text(line,
              style: TextStyle(
                  fontSize: 16,
                  height: 1.5,
                  fontWeight: FontWeight.w600,
                  color: c.inkStrong)),
        ));
      }
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: widgets,
    );
  }

  // Images are stored as http(s) URLs or base64 data: URIs.
  Widget _flashcardImage(FlashCard card) {
    if (card.imageUrl.trim().isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: ContentImage(
        card.imageUrl,
        fit: card.imageFit == 'cover' ? BoxFit.cover : BoxFit.contain,
      ),
    );
  }

  Widget _showAnswerBar(AppColors c) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
      decoration: BoxDecoration(border: Border(top: BorderSide(color: c.line))),
      child: SizedBox(
        width: double.infinity,
        height: 50,
        child: FilledButton(
          onPressed: () => setState(() => _flipped = true),
          child: const Text('Show answer',
              style: TextStyle(fontWeight: FontWeight.w800)),
        ),
      ),
    );
  }

  Widget _gradeBar(AppColors c, QueueCard qc) {
    Widget btn(String label, int rating, Color color) {
      final preview = qc.previewFor(rating);
      return Expanded(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 3),
          child: GestureDetector(
            onTap: () => _grade(qc, rating),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 9),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: color.withValues(alpha: 0.45)),
              ),
              child: Column(
                children: [
                  Text(preview?.label ?? '',
                      style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: color)),
                  const SizedBox(height: 2),
                  Text(label,
                      style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          color: color)),
                ],
              ),
            ),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.fromLTRB(13, 8, 13, 12),
      decoration: BoxDecoration(border: Border(top: BorderSide(color: c.line))),
      child: Row(
        children: [
          btn('Again', 1, _again),
          btn('Hard', 2, _hard),
          btn('Good', 3, _good),
          btn('Easy', 4, _easy),
        ],
      ),
    );
  }

  Widget _done(AppColors c, int total) {
    final didReview = _reviewed > 0;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(didReview ? Icons.celebration_rounded : Icons.check_circle_rounded, size: 48),
            const SizedBox(height: 14),
            Text(didReview ? 'Session complete' : 'Nothing due here',
                style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: c.inkStrong)),
            const SizedBox(height: 6),
            Text(
              didReview
                  ? 'You reviewed $_reviewed card${_reviewed == 1 ? '' : 's'}. Come back when more are due.'
                  : 'No cards are due in this deck right now.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 15.5, height: 1.45, color: c.inkSoft),
            ),
            const SizedBox(height: 22),
            FilledButton(
              onPressed: () => context.pop(),
              child: const Text('Back to decks'),
            ),
          ],
        ),
      ),
    );
  }
}
