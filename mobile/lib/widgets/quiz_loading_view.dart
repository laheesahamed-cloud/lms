import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../theme/tokens.dart';

/// Branded quiz loading screen — a small card-stack with question marks drifting
/// in (a native, lightweight nod to the web "question-suction" loader). Used for
/// quiz/exam loading and the submit transition. One repeating controller only.
class QuizLoadingView extends StatefulWidget {
  final String label;
  const QuizLoadingView({super.key, this.label = 'Preparing your quiz…'});

  @override
  State<QuizLoadingView> createState() => _QuizLoadingViewState();
}

class _QuizLoadingViewState extends State<QuizLoadingView>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  static const _markColors = [
    Color(0xFF2563FF), Color(0xFF00D26A), Color(0xFF7C3AED),
    Color(0xFFFF5A1F), Color(0xFF06B6D4),
  ];

  @override
  void initState() {
    super.initState();
    _c = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 2200))
      ..repeat();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: 180,
            height: 150,
            child: AnimatedBuilder(
              animation: _c,
              builder: (_, _) {
                final t = _c.value;
                return Stack(
                  alignment: Alignment.center,
                  children: [
                    for (int i = 0; i < 5; i++) _mark(i, t),
                    _cardStack(t, c),
                  ],
                );
              },
            ),
          ),
          const SizedBox(height: 20),
          Text(widget.label,
              style: TextStyle(
                  fontSize: 14.5, fontWeight: FontWeight.w600, color: c.inkSoft)),
        ],
      ),
    );
  }

  Widget _cardStack(double t, AppColors c) {
    final pulse = 1 + 0.035 * math.sin(t * 2 * math.pi);
    return Transform.scale(
      scale: pulse,
      child: SizedBox(
        width: 96,
        height: 108,
        child: Stack(
          children: [
            Positioned(
                left: 18,
                top: 9,
                child: Transform.rotate(angle: 0.13, child: _card(c, faded: .35))),
            Positioned(
                left: -6,
                top: 5,
                child: Transform.rotate(angle: -0.10, child: _card(c, faded: .55))),
            Positioned(left: 6, top: 0, child: _card(c, front: true)),
          ],
        ),
      ),
    );
  }

  Widget _card(AppColors c, {bool front = false, double faded = 1}) {
    return Container(
      width: 78,
      height: 98,
      decoration: BoxDecoration(
        color: front ? c.cardElevated : c.cardElevated.withValues(alpha: faded),
        borderRadius: BorderRadius.circular(13),
        border: Border.all(color: c.line),
        boxShadow: front
            ? [
                BoxShadow(
                    color: Colors.black.withValues(alpha: 0.07),
                    blurRadius: 16,
                    offset: const Offset(0, 7))
              ]
            : null,
      ),
      child: !front
          ? null
          : Padding(
              padding: const EdgeInsets.all(10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                            color: c.primary, shape: BoxShape.circle)),
                    const SizedBox(width: 6),
                    Expanded(child: _line(c, h: 6)),
                  ]),
                  const SizedBox(height: 11),
                  for (int i = 0; i < 3; i++)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 7),
                      child: Row(children: [
                        Container(
                          width: 10,
                          height: 10,
                          decoration: BoxDecoration(
                              color: i == 1 ? c.primaryTint : c.surface2,
                              borderRadius: BorderRadius.circular(3),
                              border: Border.all(color: c.line)),
                        ),
                        const SizedBox(width: 6),
                        Expanded(child: _line(c, h: 5, w: i == 2 ? .7 : 1)),
                      ]),
                    ),
                ],
              ),
            ),
    );
  }

  Widget _line(AppColors c, {double h = 6, double w = 1}) => FractionallySizedBox(
        widthFactor: w,
        alignment: Alignment.centerLeft,
        child: Container(
            height: h,
            decoration: BoxDecoration(
                color: c.line, borderRadius: BorderRadius.circular(3))),
      );

  Widget _mark(int i, double t) {
    final phase = (t + i / 5) % 1.0;
    final dy = -78 * (1 - phase) - 8;
    final dx = (i.isEven ? 1 : -1) * (28 + 13 * i) * (1 - phase) * 0.6;
    final opacity = (phase < 0.15
            ? phase / 0.15
            : (phase > 0.72 ? (1 - phase) / 0.28 : 1))
        .clamp(0.0, 1.0);
    final scale = 0.6 + 0.4 * (1 - phase);
    return Transform.translate(
      offset: Offset(dx, dy),
      child: Opacity(
        opacity: opacity * 0.9,
        child: Transform.scale(
          scale: scale,
          child: Text('?',
              style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: _markColors[i % _markColors.length])),
        ),
      ),
    );
  }
}
