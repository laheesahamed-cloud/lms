import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../theme/tokens.dart';
import 'personal_flashcards_store.dart';

/// Flip-card review session for a personal deck.
/// Cards are shown front-first; tap to reveal back.
/// Grade with Again / Hard / Good / Easy — SM-2 lite scheduling.
/// Cards studied per session.
const int kPersonalSessionSize = 20;

class PersonalReviewPage extends StatefulWidget {
  final String deckId;
  final String title;

  const PersonalReviewPage({
    super.key,
    required this.deckId,
    required this.title,
  });

  @override
  State<PersonalReviewPage> createState() => _PersonalReviewPageState();
}

class _PersonalReviewPageState extends State<PersonalReviewPage>
    with SingleTickerProviderStateMixin {
  List<PersonalCard> _queue = [];
  final Map<PersonalCard, String> _owner = Map.identity();
  int _index = 0;
  bool _revealed = false;
  bool _loading = true;
  int _total = 0;

  // Swipe-to-grade (only once revealed): drag follows the finger, then the
  // card springs back or flies off. Swipe right = Good, swipe left = Again.
  // Same mechanic as the main Flashcards review screen
  // (review_session_page.dart) — ported directly for visual/feel parity.
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
        setState(() => _drag = Offset.lerp(_animFrom, _animTo, _swipe.value)!);
      });
    _load();
  }

  @override
  void dispose() {
    _swipe.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    // deckId 'all' studies every deck of mine together; remember which deck
    // each card came from so its grade is saved back to the right one.
    final allCards = <PersonalCard>[];
    if (widget.deckId == 'all') {
      for (final d in await PersonalFlashcardsStore.loadDecks()) {
        for (final card in await PersonalFlashcardsStore.loadCards(d.id)) {
          allCards.add(card);
          _owner[card] = d.id;
        }
      }
    } else {
      allCards.addAll(await PersonalFlashcardsStore.loadCards(widget.deckId));
    }
    // A session is one batch of 20, not the whole backlog. The rest wait for
    // the next tap on Study.
    final due = (allCards.where((c) => c.isDue).toList()..shuffle(Random()))
        .take(kPersonalSessionSize)
        .toList();
    if (mounted) {
      setState(() {
        _queue = due;
        _total = due.length;
        _loading = false;
      });
    }
  }

  // Toggles both ways — tapping again after reveal flips back to the
  // question, matching the main Flashcards review screen's behaviour. This
  // used to be one-way only (`if (_revealed) return;`), so a second tap did
  // nothing once the answer was showing.
  void _toggleFlip() {
    HapticFeedback.lightImpact();
    setState(() => _revealed = !_revealed);
  }

  void _springBack() {
    _animFrom = _drag;
    _animTo = Offset.zero;
    _swipe.forward(from: 0);
  }

  // Fly the card off-screen in [dir] (-1 left / +1 right), then grade.
  void _flyOffAndGrade(int dir, int rating) {
    final w = MediaQuery.of(context).size.width;
    _animFrom = _drag;
    _animTo = Offset(dir * w * 1.5, _drag.dy);
    _swipe.forward(from: 0).then((_) {
      _drag = Offset.zero;
      _grade(rating);
    });
  }

  Future<void> _grade(int rating) async {
    HapticFeedback.selectionClick();
    final card = _queue[_index];
    final updated = card.graded(rating);
    await PersonalFlashcardsStore.saveCardReview(_owner[card] ?? widget.deckId, updated);

    if (_index + 1 >= _queue.length) {
      // Session done
      setState(() {
        _index = _queue.length; // past end = show completion
        _revealed = false;
      });
    } else {
      setState(() {
        _index++;
        _revealed = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;

    return Scaffold(
      backgroundColor: c.page,
      body: SafeArea(
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : Column(
                children: [
                  // ── Header (same bar as the course flashcards review) ──
                  if (_queue.isNotEmpty && _index < _queue.length)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(8, 6, 16, 6),
                      child: Row(
                        children: [
                          IconButton(
                            onPressed: () => context.pop(),
                            icon: Icon(Icons.close_rounded,
                                size: 22, color: c.inkMedium),
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
                          Text('${_index + 1} / $_total',
                              style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w700,
                                  color: c.inkSoft)),
                        ],
                      ),
                    ),

                  // ── Card or done ──
                  Expanded(
                    child: _queue.isEmpty
                        ? _NothingDue(onClose: () => context.pop())
                        : _index >= _queue.length
                            ? _Done(total: _total, onClose: () => context.pop())
                            : _cardArea(c, _queue[_index]),
                  ),

                  // ── Grade buttons ──
                  if (_index < _queue.length && _revealed)
                    _gradeBar(c, _queue[_index]),

                  // ── Show answer (same bar as the course flashcards review) ──
                  if (_index < _queue.length && !_revealed)
                    Container(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                      decoration: BoxDecoration(
                          border: Border(top: BorderSide(color: c.line))),
                      child: SizedBox(
                        width: double.infinity,
                        height: 50,
                        child: FilledButton(
                          onPressed: _toggleFlip,
                          child: const Text('Show answer',
                              style: TextStyle(fontWeight: FontWeight.w800)),
                        ),
                      ),
                    ),
                ],
              ),
      ),
    );
  }

  // Card area: tap to reveal, drag-to-grade once revealed. Structure and
  // mechanics (perspective flip, drag tilt, fly-off threshold) ported
  // directly from the main Flashcards review screen
  // (review_session_page.dart's _cardArea/_cardFace/_swipeHint) for visual
  // and feel parity — front/back content simplified since a personal card
  // is plain front/back text with no image or bullet formatting.
  Widget _cardArea(AppColors c, PersonalCard card) {
    final w = MediaQuery.of(context).size.width;
    final threshold = w * 0.26;
    final dragRatio = (_drag.dx / w).clamp(-1.0, 1.0);
    final tilt = dragRatio * 0.18;
    final hint = (_drag.dx.abs() / threshold).clamp(0.0, 1.0);

    return GestureDetector(
      onTap: _toggleFlip,
      onHorizontalDragUpdate: _revealed && !_swipe.isAnimating
          ? (d) => setState(() => _drag += Offset(d.delta.dx, d.delta.dy * 0.3))
          : null,
      onHorizontalDragEnd: _revealed && !_swipe.isAnimating
          ? (_) {
              if (_drag.dx > threshold) {
                _flyOffAndGrade(1, 3); // swipe right → Good
              } else if (_drag.dx < -threshold) {
                _flyOffAndGrade(-1, 1); // swipe left → Again
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
                  tween: Tween(begin: 0, end: _revealed ? 1.0 : 0.0),
                  duration: const Duration(milliseconds: 420),
                  curve: Curves.easeInOut,
                  builder: (context, t, _) {
                    final angle = t * pi;
                    final showBack = angle > pi / 2;
                    final face = showBack
                        ? Transform(
                            alignment: Alignment.center,
                            transform: Matrix4.identity()..rotateY(pi),
                            child: _cardFace(c, card, back: true),
                          )
                        : _cardFace(c, card, back: false);
                    return Transform(
                      alignment: Alignment.center,
                      transform: Matrix4.identity()
                        ..setEntry(3, 2, 0.0012)
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

  Widget _cardFace(AppColors c, PersonalCard card, {required bool back}) {
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
                Text(card.back,
                    style: TextStyle(
                        fontSize: 16,
                        height: 1.5,
                        fontWeight: FontWeight.w600,
                        color: c.inkStrong)),
              ]
            : [
                Text(card.front,
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

  // "1d"/"3d"/"2w"/"1mo" — same convention _CardTile._fmtDate already uses
  // elsewhere on this page, just relative-duration instead of relative-date.
  String _fmtInterval(double days) {
    if (days < 1) return '<1d';
    if (days < 7) return '${days.round()}d';
    if (days < 30) return '${(days / 7).round()}w';
    return '${(days / 30).round()}mo';
  }

  Widget _gradeBar(AppColors c, PersonalCard card) {
    Widget btn(String label, int rating, Color color) {
      final preview = _fmtInterval(card.graded(rating).intervalDays);
      return Expanded(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 3),
          child: GestureDetector(
            onTap: () => _grade(rating),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 9),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: color.withValues(alpha: 0.45)),
              ),
              child: Column(
                children: [
                  Text(preview,
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
}

class _Done extends StatelessWidget {
  final int total;
  final VoidCallback onClose;
  const _Done({required this.total, required this.onClose});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.celebration_rounded, size: 48, color: c.inkStrong),
            const SizedBox(height: 14),
            Text('Session complete',
                style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: c.inkStrong)),
            const SizedBox(height: 6),
            Text(
              'You reviewed $total card${total == 1 ? '' : 's'}. Come back when more are due.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 15.5, height: 1.45, color: c.inkSoft),
            ),
            const SizedBox(height: 22),
            FilledButton(onPressed: onClose, child: const Text('Back to decks')),
          ],
        ),
      ),
    );
  }
}

class _NothingDue extends StatelessWidget {
  final VoidCallback onClose;
  const _NothingDue({required this.onClose});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.check_circle_rounded, size: 48, color: c.inkStrong),
            const SizedBox(height: 14),
            Text('Nothing due here',
                style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: c.inkStrong)),
            const SizedBox(height: 6),
            Text('No cards are due in this deck right now.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 15.5, height: 1.45, color: c.inkSoft)),
            const SizedBox(height: 22),
            FilledButton(onPressed: onClose, child: const Text('Back to decks')),
          ],
        ),
      ),
    );
  }
}
