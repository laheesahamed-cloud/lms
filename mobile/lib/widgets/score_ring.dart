import 'dart:math';
import 'dart:async';

import 'package:flutter/material.dart';
import '../theme/tokens.dart';

/// Animated conic-gradient score ring with count-up (§11.2). Reduced-motion → instant.
class ScoreRing extends StatefulWidget {
  final double percent; // 0..100
  final double size;
  final String label;
  const ScoreRing(
      {super.key,
      required this.percent,
      this.size = 132,
      this.label = 'Score',
      this.startDelay = Duration.zero});

  /// Hold before sweeping. A caller whose card arrives on a staggered entrance
  /// needs this: starting on the first frame means the ring fills underneath
  /// the card's own slide-and-fade, and the sweep is never actually seen.
  final Duration startDelay;

  @override
  State<ScoreRing> createState() => _ScoreRingState();
}

class _ScoreRingState extends State<ScoreRing>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  Timer? _start;
  late final Animation<double> _anim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 900));
    _anim = CurvedAnimation(parent: _ctrl, curve: AppCurves.easeOut);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (MediaQuery.of(context).disableAnimations) {
        _ctrl.value = 1;
      } else if (widget.startDelay == Duration.zero) {
        _ctrl.forward();
      } else {
        _start = Timer(widget.startDelay, () {
          if (mounted) _ctrl.forward();
        });
      }
    });
  }

  @override
  void dispose() {
    _start?.cancel();
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return SizedBox(
      width: widget.size,
      height: widget.size,
      child: AnimatedBuilder(
        animation: _anim,
        builder: (_, _) {
          final v = _anim.value * (widget.percent / 100);
          return CustomPaint(
            painter: _RingPainter(
                progress: v, track: c.surface2, colors: [c.accent, c.primary]),
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('${(v * 100).round()}%',
                      style: TextStyle(
                          fontSize: (widget.size * 0.22).clamp(14.0, 30.0),
                          fontWeight: FontWeight.w800,
                          color: c.inkStrong,
                          letterSpacing: -0.5)),
                  Text(widget.label.toUpperCase(),
                      style: TextStyle(
                          fontSize: (widget.size * 0.09).clamp(8.0, 11.0),
                          fontWeight: FontWeight.w700,
                          color: c.inkSoft,
                          letterSpacing: 1.0)),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  final double progress;
  final Color track;
  final List<Color> colors;
  _RingPainter(
      {required this.progress, required this.track, required this.colors});

  @override
  void paint(Canvas canvas, Size size) {
    final stroke = (size.width * 0.09).clamp(7.0, 12.0);
    final center = Offset(size.width / 2, size.height / 2);
    final radius = (size.width - stroke) / 2;

    final bg = Paint()
      ..color = track
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round;
    canvas.drawCircle(center, radius, bg);

    final shader = SweepGradient(
      startAngle: -pi / 2,
      endAngle: 3 * pi / 2,
      colors: colors,
    ).createShader(Rect.fromCircle(center: center, radius: radius));
    final fg = Paint()
      ..shader = shader
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(Rect.fromCircle(center: center, radius: radius), -pi / 2,
        2 * pi * progress, false, fg);
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.progress != progress;
}
