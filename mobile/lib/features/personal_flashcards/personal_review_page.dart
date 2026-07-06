import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../theme/tokens.dart';
import 'personal_flashcards_store.dart';

/// Flip-card review session for a personal deck.
/// Cards are shown front-first; tap to reveal back.
/// Grade with Again / Hard / Good / Easy — SM-2 lite scheduling.
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
  int _index = 0;
  bool _revealed = false;
  bool _loading = true;
  int _total = 0;

  late AnimationController _flipCtrl;
  late Animation<double> _flipAnim;

  @override
  void initState() {
    super.initState();
    _flipCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 350),
    );
    _flipAnim = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(parent: _flipCtrl, curve: Curves.easeInOut),
    );
    _load();
  }

  @override
  void dispose() {
    _flipCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final allCards = await PersonalFlashcardsStore.loadCards(widget.deckId);
    final due = allCards.where((c) => c.isDue).toList()..shuffle(Random());
    if (mounted) {
      setState(() {
        _queue = due;
        _total = due.length;
        _loading = false;
      });
    }
  }

  void _reveal() {
    if (_revealed) return;
    setState(() => _revealed = true);
    _flipCtrl.forward();
  }

  Future<void> _grade(int rating) async {
    HapticFeedback.selectionClick();
    final card = _queue[_index];
    final updated = card.graded(rating);
    await PersonalFlashcardsStore.saveCardReview(widget.deckId, updated);

    _flipCtrl.reset();

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
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: c.page,
      body: SafeArea(
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : Column(
                children: [
                  // ── Header ──
                  Padding(
                    padding: const EdgeInsets.fromLTRB(4, 8, 16, 0),
                    child: Row(
                      children: [
                        IconButton(
                          icon: const Icon(Icons.close_rounded),
                          onPressed: () => context.pop(),
                          color: c.inkStrong,
                        ),
                        Expanded(
                          child: Text(widget.title,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                  fontSize: 17,
                                  fontWeight: FontWeight.w700,
                                  color: c.inkStrong)),
                        ),
                        if (_queue.isNotEmpty)
                          Text(
                            '${min(_index + 1, _total)}/$_total',
                            style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: c.inkSoft),
                          ),
                      ],
                    ),
                  ),

                  // ── Progress bar ──
                  if (_queue.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: LinearProgressIndicator(
                          value: _total == 0
                              ? 1
                              : min(_index, _total) / _total,
                          minHeight: 4,
                          backgroundColor: c.inkMuted.withValues(alpha: 0.2),
                          color: c.primary,
                        ),
                      ),
                    ),

                  const SizedBox(height: 16),

                  // ── Card or done ──
                  Expanded(
                    child: _index >= _queue.length
                        ? _Done(total: _total, onClose: () => context.pop())
                        : _queue.isEmpty
                            ? _NothingDue(onClose: () => context.pop())
                            : _CardBody(
                                card: _queue[_index],
                                revealed: _revealed,
                                flipAnim: _flipAnim,
                                isDark: isDark,
                                onTap: _reveal,
                                c: c,
                              ),
                  ),

                  // ── Grade buttons ──
                  if (_index < _queue.length && _revealed)
                    _GradeBar(onGrade: _grade),

                  // ── Tap hint ──
                  if (_index < _queue.length && !_revealed)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 24),
                      child: Text('Tap card to reveal answer',
                          style: TextStyle(
                              fontSize: 13, color: c.inkMuted)),
                    ),

                  if (_index < _queue.length && _revealed)
                    const SizedBox(height: 16),
                ],
              ),
      ),
    );
  }
}

class _CardBody extends StatelessWidget {
  final PersonalCard card;
  final bool revealed;
  final Animation<double> flipAnim;
  final bool isDark;
  final VoidCallback onTap;
  final AppColors c;

  const _CardBody({
    required this.card,
    required this.revealed,
    required this.flipAnim,
    required this.isDark,
    required this.onTap,
    required this.c,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: AnimatedBuilder(
          animation: flipAnim,
          builder: (_, __) {
            final angle = flipAnim.value * pi;
            final showBack = angle > pi / 2;
            return Transform(
              alignment: Alignment.center,
              transform: Matrix4.identity()
                ..setEntry(3, 2, 0.001)
                ..rotateX(angle),
              child: Container(
                width: double.infinity,
                constraints: const BoxConstraints(minHeight: 260),
                decoration: BoxDecoration(
                  color: isDark
                      ? const Color(0xFF1C1F27)
                      : Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: isDark ? 0.4 : 0.12),
                      blurRadius: 24,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: Transform(
                  alignment: Alignment.center,
                  transform: showBack
                      ? (Matrix4.identity()..rotateX(pi))
                      : Matrix4.identity(),
                  child: Padding(
                    padding: const EdgeInsets.all(28),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 3),
                          decoration: BoxDecoration(
                            color: (showBack
                                    ? const Color(0xFF16A34A)
                                    : c.primary)
                                .withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            showBack ? 'ANSWER' : 'QUESTION',
                            style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 1.2,
                                color: showBack
                                    ? const Color(0xFF16A34A)
                                    : c.primary),
                          ),
                        ),
                        const SizedBox(height: 20),
                        Text(
                          showBack ? card.back : card.front,
                          textAlign: TextAlign.center,
                          style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w700,
                              height: 1.4,
                              color: c.inkStrong),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _GradeBar extends StatelessWidget {
  final void Function(int) onGrade;
  const _GradeBar({required this.onGrade});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
      child: Row(
        children: [
          _GradeBtn(label: 'Again', sublabel: '1d',
              color: const Color(0xFFDC2626), onTap: () => onGrade(1)),
          const SizedBox(width: 8),
          _GradeBtn(label: 'Hard', sublabel: '~3d',
              color: const Color(0xFFF97316), onTap: () => onGrade(2)),
          const SizedBox(width: 8),
          _GradeBtn(label: 'Good', sublabel: '~7d',
              color: const Color(0xFF2563EB), onTap: () => onGrade(3)),
          const SizedBox(width: 8),
          _GradeBtn(label: 'Easy', sublabel: '~14d',
              color: const Color(0xFF16A34A), onTap: () => onGrade(4)),
        ],
      ),
    );
  }
}

class _GradeBtn extends StatelessWidget {
  final String label;
  final String sublabel;
  final Color color;
  final VoidCallback onTap;
  const _GradeBtn(
      {required this.label,
      required this.sublabel,
      required this.color,
      required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: color.withValues(alpha: 0.3)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(label,
                  style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                      color: color)),
              Text(sublabel,
                  style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: color.withValues(alpha: 0.7))),
            ],
          ),
        ),
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
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.check_circle_rounded,
                size: 72, color: Color(0xFF16A34A)),
            const SizedBox(height: 20),
            Text('Session Complete!',
                style: TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.w800,
                    color: c.inkStrong)),
            const SizedBox(height: 8),
            Text('You reviewed $total card${total == 1 ? '' : 's'}.',
                style: TextStyle(fontSize: 15, color: c.inkSoft)),
            const SizedBox(height: 32),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: onClose,
                child: const Text('Done'),
              ),
            ),
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
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.done_all_rounded, size: 60, color: c.inkMuted),
            const SizedBox(height: 16),
            Text('Nothing due right now',
                style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    color: c.inkStrong)),
            const SizedBox(height: 8),
            Text('Check back later for more reviews.',
                style: TextStyle(fontSize: 14, color: c.inkSoft)),
            const SizedBox(height: 28),
            FilledButton(onPressed: onClose, child: const Text('Back')),
          ],
        ),
      ),
    );
  }
}
