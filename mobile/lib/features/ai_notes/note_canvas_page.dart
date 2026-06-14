import 'dart:ui' show PointMode;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import '../../theme/tokens.dart';

/// Tier-A note canvas (§11.4): pressure-aware ink on a paper texture,
/// pen/eraser/colours, undo, clear, with haptic stroke feedback.
/// (Procedural scribble audio = follow-up via flutter_soloud / PencilKit Tier B.)
class _Stroke {
  final List<Offset> points;
  final List<double> widths;
  final Color color;
  final bool eraser;
  _Stroke(this.color, this.eraser)
      : points = <Offset>[],
        widths = <double>[];
}

class NoteCanvasPage extends StatefulWidget {
  const NoteCanvasPage({super.key});
  @override
  State<NoteCanvasPage> createState() => _NoteCanvasPageState();
}

class _NoteCanvasPageState extends State<NoteCanvasPage> {
  final List<_Stroke> _strokes = [];
  _Stroke? _active;
  bool _eraser = false;
  int _color = 0;
  int _hapticTick = 0;

  static const _palette = [
    Color(0xFFF8FAFC), // ink
    Color(0xFF60A5FA), // blue
    Color(0xFFF87171), // red
    Color(0xFF34D399), // green
    Color(0xFFFBBF24), // amber
  ];

  Color get _ink {
    // On light theme swap the white ink for near-black.
    if (_color == 0 && Theme.of(context).brightness == Brightness.light) {
      return const Color(0xFF0F172A);
    }
    return _palette[_color];
  }

  void _start(Offset p, double pressure) {
    HapticFeedback.selectionClick();
    final s = _Stroke(_ink, _eraser);
    s.points.add(p);
    s.widths.add(_w(pressure));
    setState(() {
      _active = s;
      _strokes.add(s);
    });
  }

  void _extend(Offset p, double pressure) {
    if (_active == null) return;
    // light, throttled haptic for the "scribble" feel
    if ((_hapticTick++ & 7) == 0) HapticFeedback.selectionClick();
    setState(() {
      _active!.points.add(p);
      _active!.widths.add(_w(pressure));
    });
  }

  double _w(double pressure) {
    final base = _eraser ? 22.0 : 3.2;
    final pr = pressure <= 0 ? 1.0 : pressure; // mouse/web → no pressure
    return base * (0.55 + 0.9 * pr);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Scaffold(
      backgroundColor: c.page,
      body: SafeArea(
        child: Column(
          children: [
            // Top bar
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 6, 12, 6),
              child: Row(
                children: [
                  IconButton(
                    onPressed: () => context.pop(),
                    icon: Icon(Icons.arrow_back_ios_new_rounded,
                        size: 18, color: c.inkMedium),
                  ),
                  Text('Personalize',
                      style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w800,
                          color: c.inkStrong)),
                  const Spacer(),
                  TextButton(
                    onPressed: () => context.pop(),
                    child: Text('Done',
                        style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w800,
                            color: c.primary)),
                  ),
                ],
              ),
            ),
            // Canvas
            Expanded(
              child: Container(
                margin: const EdgeInsets.fromLTRB(14, 0, 14, 12),
                clipBehavior: Clip.antiAlias,
                decoration: BoxDecoration(
                  color: c.card,
                  borderRadius: BorderRadius.circular(AppRadius.card),
                ),
                child: Listener(
                  behavior: HitTestBehavior.opaque,
                  onPointerDown: (e) =>
                      _start(e.localPosition, e.pressure),
                  onPointerMove: (e) =>
                      _extend(e.localPosition, e.pressure),
                  onPointerUp: (_) => _active = null,
                  child: CustomPaint(
                    painter: _CanvasPainter(
                        strokes: _strokes,
                        rule: c.line,
                        eraseColor: c.card),
                    size: Size.infinite,
                  ),
                ),
              ),
            ),
            // Toolbar
            _Toolbar(
              palette: _palette,
              selectedColor: _color,
              eraser: _eraser,
              onColor: (i) => setState(() {
                _color = i;
                _eraser = false;
              }),
              onPen: () => setState(() => _eraser = false),
              onEraser: () => setState(() => _eraser = true),
              onUndo: _strokes.isEmpty
                  ? null
                  : () => setState(() => _strokes.removeLast()),
              onClear: _strokes.isEmpty
                  ? null
                  : () => setState(_strokes.clear),
            ),
          ],
        ),
      ),
    );
  }
}

class _Toolbar extends StatelessWidget {
  final List<Color> palette;
  final int selectedColor;
  final bool eraser;
  final ValueChanged<int> onColor;
  final VoidCallback onPen;
  final VoidCallback onEraser;
  final VoidCallback? onUndo;
  final VoidCallback? onClear;
  const _Toolbar({
    required this.palette,
    required this.selectedColor,
    required this.eraser,
    required this.onColor,
    required this.onPen,
    required this.onEraser,
    required this.onUndo,
    required this.onClear,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Container(
      margin: const EdgeInsets.fromLTRB(14, 0, 14, 14),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: c.cardElevated,
        borderRadius: BorderRadius.circular(AppRadius.nav + 4),
      ),
      child: Row(
        children: [
          _Tool(icon: Icons.edit_outlined, active: !eraser, onTap: onPen),
          const SizedBox(width: 6),
          _Tool(
              icon: Icons.backspace_outlined,
              active: eraser,
              onTap: onEraser),
          const SizedBox(width: 12),
          for (int i = 0; i < palette.length; i++)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 3),
              child: GestureDetector(
                onTap: () => onColor(i),
                child: Container(
                  width: 26,
                  height: 26,
                  decoration: BoxDecoration(
                    color: palette[i],
                    shape: BoxShape.circle,
                    border: (!eraser && selectedColor == i)
                        ? Border.all(color: c.inkStrong, width: 2.5)
                        : null,
                  ),
                ),
              ),
            ),
          const Spacer(),
          _Tool(icon: Icons.undo_rounded, active: false, onTap: onUndo),
          const SizedBox(width: 6),
          _Tool(
              icon: Icons.delete_outline_rounded,
              active: false,
              onTap: onClear),
        ],
      ),
    );
  }
}

class _Tool extends StatelessWidget {
  final IconData icon;
  final bool active;
  final VoidCallback? onTap;
  const _Tool({required this.icon, required this.active, required this.onTap});
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: active ? c.primaryTint : Colors.transparent,
          borderRadius: BorderRadius.circular(11),
        ),
        child: Icon(icon,
            size: 19,
            color: onTap == null
                ? c.inkMuted
                : (active ? c.primary : c.inkMedium)),
      ),
    );
  }
}

class _CanvasPainter extends CustomPainter {
  final List<_Stroke> strokes;
  final Color rule;
  final Color eraseColor;
  _CanvasPainter(
      {required this.strokes, required this.rule, required this.eraseColor});

  @override
  void paint(Canvas canvas, Size size) {
    // Ruled paper lines
    final linePaint = Paint()
      ..color = rule
      ..strokeWidth = 1;
    const gap = 34.0;
    for (double y = gap; y < size.height; y += gap) {
      canvas.drawLine(Offset(16, y), Offset(size.width - 16, y), linePaint);
    }
    // Strokes
    for (final s in strokes) {
      final paint = Paint()
        ..color = s.eraser ? eraseColor : s.color
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round;
      if (s.points.length == 1) {
        paint.strokeWidth = s.widths.first;
        canvas.drawPoints(PointMode.points, s.points, paint);
        continue;
      }
      for (int i = 1; i < s.points.length; i++) {
        paint.strokeWidth = s.widths[i];
        canvas.drawLine(s.points[i - 1], s.points[i], paint);
      }
    }
  }

  @override
  bool shouldRepaint(_CanvasPainter old) => true;
}
