import 'package:flutter/material.dart';
import '../../theme/tokens.dart';

class SplashPage extends StatefulWidget {
  const SplashPage({super.key});

  @override
  State<SplashPage> createState() => _SplashPageState();
}

class _SplashPageState extends State<SplashPage> with TickerProviderStateMixin {
  late final AnimationController _logoCtrl;
  late final AnimationController _ecgCtrl;
  late final Animation<double> _logoScale;
  late final Animation<double> _logoOpacity;

  @override
  void initState() {
    super.initState();
    _logoCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 520),
    );
    _ecgCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2200),
    )..repeat();

    _logoScale = Tween<double>(begin: 0.72, end: 1.0).animate(
      CurvedAnimation(parent: _logoCtrl, curve: AppCurves.easeOut),
    );
    _logoOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _logoCtrl, curve: const Interval(0.0, 0.65)),
    );

    _logoCtrl.forward();
  }

  @override
  void dispose() {
    _logoCtrl.dispose();
    _ecgCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final logoAsset = isDark
        ? 'assets/brand/xyndrome-logo-mark-dark.webp'
        : 'assets/brand/xyndrome-logo-mark-light.webp';

    return Scaffold(
      backgroundColor: context.c.page,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AnimatedBuilder(
              animation: _logoCtrl,
              builder: (_, child) => Opacity(
                opacity: _logoOpacity.value,
                child: Transform.scale(scale: _logoScale.value, child: child),
              ),
              child: Image.asset(logoAsset, width: 88, height: 88),
            ),
            const SizedBox(height: 48),
            AnimatedBuilder(
              animation: _ecgCtrl,
              builder: (context2, unused) => CustomPaint(
                size: const Size(200, 44),
                painter: _EcgPainter(_ecgCtrl.value, isDark),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _EcgPainter extends CustomPainter {
  final double t;
  final bool isDark;

  static const _blue = Color(0xFF3B82F6);
  static const _lightBlue = Color(0xFF2563EB);
  static const _indigo = Color(0xFF6366F1);

  // [normalizedX, yOffset] — negative Y = up in canvas coords
  static const _shape = [
    [0.00,  0.0], [0.06,  0.0],
    [0.08, -3.0], [0.11,  0.0],                              // P wave
    [0.17,  0.0],
    [0.19,  2.5], [0.22, -18.0], [0.25,  8.0], [0.28, 0.0], // QRS complex
    [0.34,  0.0], [0.38, -5.0],  [0.44,  0.0],              // T wave
    [0.50,  0.0],
    [0.56,  0.0], [0.58, -3.0], [0.61,  0.0],
    [0.67,  0.0],
    [0.69,  2.5], [0.72, -18.0], [0.75,  8.0], [0.78, 0.0],
    [0.84,  0.0], [0.88, -5.0],  [0.94,  0.0],
    [1.00,  0.0],
  ];

  _EcgPainter(this.t, this.isDark);

  double _getY(double x) {
    x = ((x % 1.0) + 1.0) % 1.0;
    for (int i = 0; i < _shape.length - 1; i++) {
      if (x >= _shape[i][0] && x <= _shape[i + 1][0]) {
        final frac = (x - _shape[i][0]) / (_shape[i + 1][0] - _shape[i][0]);
        return _shape[i][1] + frac * (_shape[i + 1][1] - _shape[i][1]);
      }
    }
    return 0;
  }

  Color _trailColor(double prog) {
    final base = isDark ? _blue : _lightBlue;
    if (prog < 0.75) {
      return Color.lerp(base.withValues(alpha: 0.0), base, prog / 0.75)!;
    }
    return Color.lerp(base, _indigo, (prog - 0.75) / 0.25)!;
  }

  @override
  void paint(Canvas canvas, Size size) {
    final mid = size.height / 2;
    const trailLen = 0.60;
    const steps = 220;

    final paint = Paint()
      ..strokeWidth = 1.8
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;

    for (int i = 0; i < steps - 1; i++) {
      final prog = i / steps;
      final t0 = t - trailLen + prog * trailLen;
      final t1 = t - trailLen + ((i + 1) / steps) * trailLen;
      final x0 = ((t0 % 1.0) + 1.0) % 1.0;
      final x1 = ((t1 % 1.0) + 1.0) % 1.0;
      if ((x1 - x0).abs() > 0.4) continue;
      paint.color = _trailColor(prog);
      canvas.drawLine(
        Offset(x0 * size.width, mid + _getY(t0)),
        Offset(x1 * size.width, mid + _getY(t1)),
        paint,
      );
    }

    // Glowing indigo dot at the leading edge
    final hx = (t % 1.0) * size.width;
    final hy = mid + _getY(t);
    canvas.drawCircle(
      Offset(hx, hy),
      6.0,
      Paint()
        ..color = _indigo.withValues(alpha: 0.28)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4),
    );
    canvas.drawCircle(Offset(hx, hy), 2.2, Paint()..color = Colors.white);
  }

  @override
  bool shouldRepaint(_EcgPainter old) => old.t != t || old.isDark != isDark;
}
