import 'package:flutter/material.dart';
import '../../theme/tokens.dart';

/// 4-layer radial-gradient backdrop (cyan + indigo + blue + sky), §11.5.
class AuthBackground extends StatelessWidget {
  final Widget child;
  const AuthBackground({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Stack(
      children: [
        Positioned.fill(child: ColoredBox(color: c.page)),
        Positioned.fill(child: CustomPaint(painter: _BgPainter(dark: dark))),
        child,
      ],
    );
  }
}

class _BgPainter extends CustomPainter {
  final bool dark;
  _BgPainter({required this.dark});

  void _blob(Canvas canvas, Offset center, double r, Color color) {
    final paint = Paint()
      ..shader = RadialGradient(
        colors: [color, color.withValues(alpha: 0)],
      ).createShader(Rect.fromCircle(center: center, radius: r));
    canvas.drawCircle(center, r, paint);
  }

  @override
  void paint(Canvas canvas, Size size) {
    final a = dark ? 0.16 : 0.10;
    final w = size.width, h = size.height;
    _blob(canvas, Offset(w * 0.12, -h * 0.02), w * 0.75,
        const Color(0xFF38BDF8).withValues(alpha: a));
    _blob(canvas, Offset(w * 0.92, h * 0.05), w * 0.75,
        const Color(0xFF6366F1).withValues(alpha: a));
    _blob(canvas, Offset(w * 0.78, h * 0.96), w * 0.85,
        const Color(0xFF2563EB).withValues(alpha: a * 0.85));
    _blob(canvas, Offset(w * 0.04, h * 0.9), w * 0.65,
        const Color(0xFF7DD3FC).withValues(alpha: a * 0.7));
  }

  @override
  bool shouldRepaint(_BgPainter old) => old.dark != dark;
}
