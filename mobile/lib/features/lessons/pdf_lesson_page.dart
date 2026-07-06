import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart' show Ticker;
import 'package:pdfrx/pdfrx.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../theme/tokens.dart';

/// PDF viewer body — no Scaffold, no header, no toolbar.
/// Dropped into the Expanded slot of LessonCanvasPage, which owns the header
/// and tool strip. Tool state is forwarded from the canvas; zoom/pan mirrors
/// the canvas matrix system exactly.
///
/// Memory safety: only pages within one viewport-height of the current scroll
/// position are rendered as PdfPageView bitmaps. Out-of-range pages show as
/// white placeholders (ink overlay still drawn). The visible range updates
/// lazily (only when it actually changes) so smooth panning is never blocked.
class PdfLessonPage extends StatefulWidget {
  final String lessonId;
  final String pdfUrl;
  /// 0 = pen, 1 = highlighter, 2 = eraser — matches _Tool.index in lesson_canvas_page.dart
  final int toolIndex;
  final Color penColor;
  final Color hlColor;
  final double penSize;
  final double hlSize;
  final double eraserSize;
  final String uid;

  const PdfLessonPage({
    super.key,
    required this.lessonId,
    required this.pdfUrl,
    required this.toolIndex,
    required this.penColor,
    required this.hlColor,
    required this.penSize,
    required this.hlSize,
    required this.eraserSize,
    required this.uid,
  });

  @override
  State<PdfLessonPage> createState() => _PdfLessonPageState();
}

// ── Stroke ────────────────────────────────────────────────────────────────────

enum _PdfTool { pen, highlighter, eraser }

class _PdfStroke {
  final _PdfTool tool;
  final Color color;
  /// Content-space width (base size ÷ zoom at draw time) — same convention as canvas.
  final double width;
  /// Normalised 0..1 within the page rect.
  final List<Offset> points;

  _PdfStroke(this.tool, this.color, this.width) : points = [];
  void add(Offset p) => points.add(p);

  Map<String, dynamic> toJson() => {
        't': tool.index,
        'c': color.toARGB32(),
        'w': width,
        'p': [for (final o in points) [o.dx, o.dy]],
      };

  static _PdfStroke fromJson(Map<String, dynamic> m) {
    final s = _PdfStroke(
      _PdfTool.values[m['t'] as int? ?? 0],
      Color(m['c'] as int),
      (m['w'] as num).toDouble(),
    );
    for (final raw in m['p'] as List) {
      final pair = raw as List;
      s.points.add(Offset((pair[0] as num).toDouble(), (pair[1] as num).toDouble()));
    }
    return s;
  }
}

// ── Rendering helpers (ported verbatim from lesson_canvas_page.dart) ──────────

class _OneEuro {
  final double minCutoff;
  final double beta;
  final double dCutoff;
  Offset? _x;
  Offset _dx = Offset.zero;
  Duration? _t;

  _OneEuro({this.minCutoff = 1.0, this.beta = 0.7, this.dCutoff = 1.0});

  static double _alpha(double cutoff, double dt) {
    final tau = 1.0 / (2 * math.pi * cutoff);
    return 1.0 / (1.0 + tau / dt);
  }

  Offset filter(Offset x, Duration t, {double scale = 1.0}) {
    if (_x == null) { _x = x; _t = t; return x; }
    var dt = (t - _t!).inMicroseconds / 1e6;
    if (dt <= 0 || dt > 0.1) dt = 1 / 120.0;
    _t = t;
    final dxRaw = (x - _x!) / dt;
    final aD = _alpha(dCutoff, dt);
    _dx = _dx + (dxRaw - _dx) * aD;
    final cutoff = minCutoff + beta * (_dx.distance * scale);
    final a = _alpha(cutoff, dt);
    final xHat = _x! + (x - _x!) * a;
    _x = xHat;
    return xHat;
  }
}

Paint _linePaint(Color color, double width) => Paint()
  ..color = color
  ..style = PaintingStyle.stroke
  ..strokeWidth = width
  ..strokeCap = StrokeCap.round
  ..strokeJoin = StrokeJoin.round
  ..isAntiAlias = true;

Paint _eraserPaint(double width) => Paint()
  ..blendMode = BlendMode.clear
  ..style = PaintingStyle.stroke
  ..strokeWidth = width
  ..strokeCap = StrokeCap.round
  ..strokeJoin = StrokeJoin.round;

List<Offset> _smoothN(List<Offset> pts, int passes) {
  var cur = pts;
  for (var k = 0; k < passes; k++) {
    final n = cur.length;
    if (n < 3) return cur;
    final out = List<Offset>.of(cur);
    for (var i = 1; i < n - 1; i++) {
      final a = cur[i - 1], b = cur[i], c = cur[i + 1];
      out[i] = Offset(a.dx * 0.25 + b.dx * 0.5 + c.dx * 0.25,
          a.dy * 0.25 + b.dy * 0.5 + c.dy * 0.25);
    }
    cur = out;
  }
  return cur;
}

void _crSegment(Path path, List<Offset> pts, int i, int n) {
  const eps = 1e-6;
  final p0 = pts[i == 0 ? 0 : i - 1];
  final p1 = pts[i];
  final p2 = pts[i + 1];
  final p3 = pts[i + 2 >= n ? n - 1 : i + 2];
  final t01 = math.sqrt((p0 - p1).distance) + eps;
  final t12 = math.sqrt((p1 - p2).distance) + eps;
  final t23 = math.sqrt((p2 - p3).distance) + eps;
  final m1 = (p2 - p1) + ((p1 - p0) / t01 - (p2 - p0) / (t01 + t12)) * t12;
  final m2 = (p2 - p1) + ((p3 - p2) / t23 - (p3 - p1) / (t12 + t23)) * t12;
  final c1 = p1 + m1 / 3.0;
  final c2 = p2 - m2 / 3.0;
  path.cubicTo(c1.dx, c1.dy, c2.dx, c2.dy, p2.dx, p2.dy);
}

Path _smoothPath(List<Offset> pts) {
  final path = Path()..moveTo(pts.first.dx, pts.first.dy);
  final n = pts.length;
  if (n < 3) {
    for (final o in pts.skip(1)) path.lineTo(o.dx, o.dy);
    return path;
  }
  for (var i = 0; i < n - 1; i++) _crSegment(path, pts, i, n);
  return path;
}

// ── Painter ───────────────────────────────────────────────────────────────────

class _PdfInkPainter extends CustomPainter {
  final List<_PdfStroke> strokes;
  final _PdfStroke? active;
  final bool dark;
  _PdfInkPainter(this.strokes, this.active, this.dark);

  @override
  void paint(Canvas canvas, Size size) {
    _paintHighlighterLayer(canvas, size);
    _paintPenLayer(canvas, size);
  }

  void _drawStroke(Canvas canvas, Size size, _PdfStroke s, Paint paint) {
    final pts = [for (final p in s.points) Offset(p.dx * size.width, p.dy * size.height)];
    if (pts.length == 1) {
      canvas.drawCircle(pts.first, s.width / 2,
          Paint()..color = paint.color..blendMode = paint.blendMode);
      return;
    }
    canvas.drawPath(_smoothPath(_smoothN(pts, 2)), paint);
  }

  void _paintHighlighterLayer(Canvas canvas, Size size) {
    final all = active == null ? strokes : [...strokes, active!];
    if (!all.any((s) => s.tool == _PdfTool.highlighter)) return;
    canvas.saveLayer(Offset.zero & size,
        Paint()..blendMode = dark ? BlendMode.screen : BlendMode.multiply);
    for (final s in all) {
      if (s.points.isEmpty) continue;
      if (s.tool == _PdfTool.highlighter) {
        _drawStroke(canvas, size, s, _linePaint(s.color.withValues(alpha: 0.4), s.width));
      } else if (s.tool == _PdfTool.eraser) {
        _drawStroke(canvas, size, s, _eraserPaint(s.width));
      }
    }
    canvas.restore();
  }

  void _paintPenLayer(Canvas canvas, Size size) {
    final all = active == null ? strokes : [...strokes, active!];
    final hasPen = all.any((s) => s.tool == _PdfTool.pen);
    final hasEraser = all.any((s) => s.tool == _PdfTool.eraser);
    if (!hasPen && !hasEraser) return;
    if (hasEraser) canvas.saveLayer(Offset.zero & size, Paint());
    for (final s in all) {
      if (s.points.isEmpty) continue;
      if (s.tool == _PdfTool.pen) {
        _drawStroke(canvas, size, s, _linePaint(s.color, s.width));
      } else if (s.tool == _PdfTool.eraser) {
        _drawStroke(canvas, size, s, _eraserPaint(s.width));
      }
    }
    if (hasEraser) canvas.restore();
  }

  @override
  bool shouldRepaint(_PdfInkPainter old) => true;
}

// ── Scrollbar painter ─────────────────────────────────────────────────────────

class _ScrollbarPainter extends CustomPainter {
  final double scale;
  final double ty;
  final double contentH;
  final double viewH;
  final bool dark;
  final bool grabbed;

  const _ScrollbarPainter({
    required this.scale,
    required this.ty,
    required this.contentH,
    required this.viewH,
    required this.dark,
    this.grabbed = false,
  });

  static const double _rightPad = 5.0;
  static const double _topPad   = 6.0;
  static const double _minThumb = 40.0;

  // Returns (thumbTop, thumbH, trackH) for the current scroll state.
  (double, double, double) _geometry() {
    final totalH = contentH * scale;
    final trackH = viewH - _topPad * 2;
    final thumbH = (viewH / totalH * trackH).clamp(_minThumb, trackH);
    final frac = (-ty).clamp(0.0, totalH - viewH) / (totalH - viewH);
    final thumbTop = _topPad + frac * (trackH - thumbH);
    return (thumbTop, thumbH, trackH);
  }

  @override
  void paint(Canvas canvas, Size size) {
    final totalH = contentH * scale;
    if (totalH <= viewH + 4) return;

    final thumbW  = grabbed ? 10.0 : 4.0;
    final trackW  = grabbed ? 10.0 : 4.0;
    final (thumbTop, thumbH, trackH) = _geometry();
    final x = size.width - _rightPad - trackW;

    final trackColor = dark ? const Color(0x18FFFFFF) : const Color(0x12000000);
    final thumbColor = grabbed
        ? (dark ? const Color(0xEEFFFFFF) : const Color(0xCC000000))
        : (dark ? const Color(0x80FFFFFF) : const Color(0x66000000));

    // Track
    canvas.drawRRect(
      RRect.fromRectAndRadius(
          Rect.fromLTWH(x, _topPad, trackW, trackH),
          Radius.circular(trackW / 2)),
      Paint()..color = trackColor,
    );
    // Thumb
    canvas.drawRRect(
      RRect.fromRectAndRadius(
          Rect.fromLTWH(x, thumbTop, thumbW, thumbH),
          Radius.circular(thumbW / 2)),
      Paint()..color = thumbColor,
    );
    // Three handle-grip lines when grabbed
    if (grabbed) {
      final gripColor = dark
          ? const Color(0x55000000)
          : const Color(0x55FFFFFF);
      final gp = Paint()..color = gripColor..strokeWidth = 1.5
          ..strokeCap = StrokeCap.round;
      final cx = x + thumbW / 2;
      final cy = thumbTop + thumbH / 2;
      for (var i = -1; i <= 1; i++) {
        final gy = cy + i * 3.5;
        canvas.drawLine(Offset(cx - 2.5, gy), Offset(cx + 2.5, gy), gp);
      }
    }
  }

  @override
  bool shouldRepaint(_ScrollbarPainter old) =>
      scale != old.scale || ty != old.ty || contentH != old.contentH ||
      viewH != old.viewH || dark != old.dark || grabbed != old.grabbed;
}

// Eraser cursor ring — shown at the stylus position when the eraser tool is active.
class _EraserCursorPainter extends CustomPainter {
  final Offset pos;
  final double radius;

  const _EraserCursorPainter({required this.pos, required this.radius});

  @override
  void paint(Canvas canvas, Size size) {
    final r = math.max(radius, 6.0);
    // Soft white fill so the ring is visible on dark ink
    canvas.drawCircle(pos, r,
        Paint()..color = const Color(0x22FFFFFF)..style = PaintingStyle.fill);
    // Dark outer ring
    canvas.drawCircle(pos, r,
        Paint()
          ..color = const Color(0xAA000000)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.5
          ..isAntiAlias = true);
    // White inner ring (contrast on dark pages)
    canvas.drawCircle(pos, r - 1.5,
        Paint()
          ..color = const Color(0x99FFFFFF)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.0
          ..isAntiAlias = true);
  }

  @override
  bool shouldRepaint(_EraserCursorPainter old) =>
      pos != old.pos || radius != old.radius;
}

// ── State ─────────────────────────────────────────────────────────────────────

class _PdfLessonPageState extends State<PdfLessonPage>
    with TickerProviderStateMixin {
  PdfDocument? _doc;
  String? _error;
  bool _loading = true;

  // Per-page ink
  final Map<int, List<_PdfStroke>> _pageStrokes = {};
  _PdfStroke? _active;
  _OneEuro? _euro;
  int _activePageIndex = -1;
  final Map<int, ValueNotifier<int>> _pageNotifiers = {};

  // Page layout rects in CONTENT (document) space
  List<Rect> _pageRects = [];
  double _contentH = 0;
  double _lastLayoutW = 0;

  // Zoom / pan (same approach as LessonCanvasPage)
  Matrix4 _matrix = Matrix4.identity();
  Matrix4 _invMatrix = Matrix4.identity();
  // Bumped on every pan/zoom — rebuilds ONLY the Transform subtree.
  final ValueNotifier<int> _xform = ValueNotifier<int>(0);
  // Updated only when the visible page range actually changes — rebuilds the
  // page stack so out-of-range pages lose their PdfPageView (memory freed).
  final ValueNotifier<(int, int)> _visibleRange = ValueNotifier<(int, int)>((0, 1));
  Size _viewport = Size.zero;
  final Map<int, Offset> _touches = {};
  Matrix4 _startMatrix = Matrix4.identity();
  Offset _startFocal = Offset.zero;
  double _startDist = 1.0;

  // Inertial fling
  VelocityTracker? _vt;
  Ticker? _fling;
  Offset _flingVel = Offset.zero;
  Duration? _flingPrev;
  static const double _flingDecel = 2.6;

  // Scrollbar drag — activated immediately on touch in the right-edge hit zone
  final ValueNotifier<bool> _sbGrabbed = ValueNotifier<bool>(false);
  int? _sbPointer;
  Offset _sbPointerStart = Offset.zero;
  double _sbDragStartY = 0;
  double _sbDragStartTy = 0;

  // Eraser cursor — tracks the stylus position while the eraser tool is active
  final ValueNotifier<Offset?> _eraserPos = ValueNotifier<Offset?>(null);

  // Tool accessors — always read from widget so tool-strip changes take effect
  // immediately on the next stroke, without setState.
  _PdfTool get _tool => _PdfTool.values[widget.toolIndex.clamp(0, 2)];
  Color get _activeColor =>
      _tool == _PdfTool.highlighter ? widget.hlColor : widget.penColor;
  double get _baseSize {
    switch (_tool) {
      case _PdfTool.pen:         return widget.penSize;
      case _PdfTool.highlighter: return widget.hlSize;
      case _PdfTool.eraser:      return widget.eraserSize;
    }
  }

  String _inkKey(int pageIndex) =>
      'lms.pdf.ink.${widget.uid}.${widget.lessonId}.$pageIndex';

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  @override
  void initState() {
    super.initState();
    _openPdf();
  }

  @override
  void dispose() {
    _doc?.dispose();
    _xform.dispose();
    _visibleRange.dispose();
    _sbGrabbed.dispose();
    _eraserPos.dispose();
    for (final n in _pageNotifiers.values) n.dispose();
    _stopFling();
    _fling?.dispose();
    super.dispose();
  }

  // ── PDF loading ────────────────────────────────────────────────────────────

  Future<void> _openPdf() async {
    final baseUrl = const String.fromEnvironment('API_BASE_URL',
        defaultValue: 'https://xyndrome.lk/api');
    final fullUrl = widget.pdfUrl.startsWith('http')
        ? widget.pdfUrl
        : '$baseUrl${widget.pdfUrl}';
    try {
      final doc = await PdfDocument.openUri(Uri.parse(fullUrl));
      if (!mounted) return;
      // Load ALL ink before triggering a rebuild so we only setState once.
      final allStrokes = <int, List<_PdfStroke>>{};
      for (var i = 0; i < doc.pages.length; i++) {
        final s = await _readPageInk(i);
        if (s != null) allStrokes[i] = s;
      }
      if (mounted) {
        setState(() {
          _doc = doc;
          _loading = false;
          _pageStrokes.addAll(allStrokes);
        });
        // After the frame _viewport and _pageRects are populated.
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _maybeUpdateVisibleRange();
        });
      }
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _loading = false; });
    }
  }

  // ── Ink persistence ────────────────────────────────────────────────────────

  Future<List<_PdfStroke>?> _readPageInk(int pageIndex) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_inkKey(pageIndex));
    if (raw == null) return null;
    try {
      return (jsonDecode(raw) as List)
          .map((m) => _PdfStroke.fromJson(Map<String, dynamic>.from(m as Map)))
          .toList();
    } catch (_) {
      return null;
    }
  }

  Future<void> _savePageInk(int pageIndex) async {
    final strokes = _pageStrokes[pageIndex] ?? [];
    final prefs = await SharedPreferences.getInstance();
    if (strokes.isEmpty) {
      await prefs.remove(_inkKey(pageIndex));
    } else {
      await prefs.setString(_inkKey(pageIndex),
          jsonEncode([for (final s in strokes) s.toJson()]));
    }
  }

  ValueNotifier<int> _notifierFor(int i) =>
      _pageNotifiers.putIfAbsent(i, () => ValueNotifier<int>(0));

  void _bumpPage(int i) => _notifierFor(i).value++;

  void _undoPage(int pageIndex) {
    final strokes = _pageStrokes[pageIndex];
    if (strokes == null || strokes.isEmpty) return;
    setState(() { strokes.removeLast(); });
    _bumpPage(pageIndex);
    _savePageInk(pageIndex);
  }

  // ── Layout ─────────────────────────────────────────────────────────────────

  static const double _vPad = 12.0;
  static const double _hPad = 12.0;
  static const double _pageGap = 6.0;

  void _computeLayout(double viewW) {
    final doc = _doc;
    if (doc == null || (viewW - _lastLayoutW).abs() < 0.5) return;
    _lastLayoutW = viewW;
    final pageW = viewW - _hPad * 2;
    final rects = <Rect>[];
    double y = _vPad;
    for (final page in doc.pages) {
      final h = page.height * (pageW / page.width);
      rects.add(Rect.fromLTWH(_hPad, y, pageW, h));
      y += h + _pageGap;
    }
    _pageRects = rects;
    _contentH = y - _pageGap + _vPad;
  }

  // ── Visible-page range ────────────────────────────────────────────────────
  // Pages within one viewport height above/below the current scroll position
  // get a real PdfPageView; all others show a white placeholder (ink still
  // drawn). Range is only updated when it actually changes so smooth panning
  // doesn't trigger Stack rebuilds.

  (int, int) _computeVisibleRange() {
    if (_pageRects.isEmpty || _viewport == Size.zero) return (0, 0);
    final scale = _matrix.getMaxScaleOnAxis();
    final ty = _matrix.getTranslation().y;
    final buffer = _viewport.height;
    int start = _pageRects.length, end = -1;
    for (var i = 0; i < _pageRects.length; i++) {
      final r = _pageRects[i];
      final top = r.top * scale + ty;
      final bot = r.bottom * scale + ty;
      if (bot >= -buffer && top <= _viewport.height + buffer) {
        if (i < start) start = i;
        if (i > end) end = i;
      }
    }
    if (end < 0) return (0, math.min(_pageRects.length - 1, 1));
    return (start, end);
  }

  void _maybeUpdateVisibleRange() {
    final next = _computeVisibleRange();
    if (next != _visibleRange.value) _visibleRange.value = next;
  }

  // ── Zoom / pan (mirrors LessonCanvasPage exactly) ─────────────────────────

  void _setMatrix(Matrix4 m) {
    _matrix = _clampMatrix(m);
    _invMatrix = Matrix4.inverted(_matrix);
    _xform.value++;
    _maybeUpdateVisibleRange();
  }

  Matrix4 _clampMatrix(Matrix4 m) {
    final s = m.getMaxScaleOnAxis();
    final t = m.getTranslation();
    final viewW = _viewport.width, viewH = _viewport.height;
    final cW = viewW * s, cH = _contentH * s;
    const vMargin = 48.0;

    final x = cW <= viewW
        ? (viewW - cW) / 2
        : t.x.clamp(viewW - cW, 0.0);

    final y = _contentH <= 0
        ? t.y
        : t.y.clamp((cH <= viewH ? 0.0 : viewH - cH) - vMargin, vMargin);

    return m.clone()..setTranslationRaw(x, y, 0);
  }

  Offset _centroid(List<Offset> pts) =>
      pts.fold(Offset.zero, (a, b) => a + b) / pts.length.toDouble();

  void _snapshotGesture() {
    _startMatrix = _matrix.clone();
    final pts = _touches.values.toList();
    if (pts.isEmpty) return;
    _startFocal = pts.length >= 2 ? _centroid(pts) : pts.first;
    _startDist = pts.length >= 2 ? (pts[0] - pts[1]).distance : 1.0;
  }

  void _applyTransform() {
    final pts = _touches.values.toList();
    if (pts.isEmpty) return;
    final twoFinger = pts.length >= 2;
    final focal = twoFinger ? _centroid(pts) : pts.first;
    final curDist = twoFinger ? (pts[0] - pts[1]).distance : _startDist;

    final startScale = _startMatrix.getMaxScaleOnAxis();
    double factor = (twoFinger && _startDist > 0) ? curDist / _startDist : 1.0;
    final target = (startScale * factor).clamp(1.0, 5.0);
    factor = startScale == 0 ? 1.0 : target / startScale;

    final dFocal = focal - _startFocal;

    final m = Matrix4.translationValues(focal.dx, focal.dy, 0)
      ..multiply(Matrix4.diagonal3Values(factor, factor, 1))
      ..multiply(Matrix4.translationValues(-focal.dx, -focal.dy, 0))
      ..multiply(Matrix4.translationValues(dFocal.dx, dFocal.dy, 0))
      ..multiply(_startMatrix);
    _setMatrix(m);
  }

  // ── Inertial fling ─────────────────────────────────────────────────────────

  void _startFling(Offset velocity) {
    var v = velocity.dx.abs() > velocity.dy.abs()
        ? Offset(velocity.dx, 0)
        : Offset(0, velocity.dy);
    const maxV = 8000.0;
    if (v.distance > maxV) v = v * (maxV / v.distance);
    if (v.distance < 80) return;
    _flingVel = v;
    _flingPrev = null;
    _fling ??= createTicker(_onFlingTick);
    _fling!.start();
  }

  void _onFlingTick(Duration elapsed) {
    final prev = _flingPrev;
    _flingPrev = elapsed;
    if (prev == null) return;
    var dt = (elapsed - prev).inMicroseconds / 1e6;
    if (dt <= 0) return;
    if (dt > 0.05) dt = 0.05;
    final before = _matrix.getTranslation();
    _setMatrix(
        Matrix4.translationValues(_flingVel.dx * dt, _flingVel.dy * dt, 0)
          ..multiply(_matrix));
    final after = _matrix.getTranslation();
    if ((after.x - before.x).abs() < 0.01) _flingVel = Offset(0, _flingVel.dy);
    if ((after.y - before.y).abs() < 0.01) _flingVel = Offset(_flingVel.dx, 0);
    _flingVel = _flingVel * math.exp(-_flingDecel * dt);
    if (_flingVel.distance < 30) _stopFling();
  }

  void _stopFling() {
    if (_fling?.isActive ?? false) _fling!.stop();
    _flingPrev = null;
    _flingVel = Offset.zero;
  }

  // ── Ink hit-test ───────────────────────────────────────────────────────────

  (int, Offset)? _hitTestPage(Offset viewportPt) {
    if (_pageRects.isEmpty) return null;
    final contentPt = MatrixUtils.transformPoint(_invMatrix, viewportPt);
    for (var i = 0; i < _pageRects.length; i++) {
      final r = _pageRects[i];
      if (r.contains(contentPt)) {
        return (i, Offset((contentPt.dx - r.left) / r.width,
            (contentPt.dy - r.top) / r.height));
      }
    }
    return null;
  }

  // ── Pointer routing ────────────────────────────────────────────────────────

  // ── Scrollbar drag handlers ────────────────────────────────────────────────
  // Right-edge 44px strip is the scrollbar hit zone. A long-press (200 ms) within
  // that zone activates drag; normal swipes fall through untouched.

  static const double _sbHitW = 44.0;

  bool _inSbZone(Offset pt) => pt.dx >= _viewport.width - _sbHitW;

  void _sbPointerDown(PointerDownEvent e) {
    // Only grab if the touch lands on the actual visible thumb, not anywhere on the strip.
    final scale = _matrix.getMaxScaleOnAxis();
    final totalH = _contentH * scale;
    final viewH  = _viewport.height;
    const topPad   = _ScrollbarPainter._topPad;
    const minThumb = _ScrollbarPainter._minThumb;
    final trackH = viewH - topPad * 2;
    final thumbH = (viewH / totalH * trackH).clamp(minThumb, trackH);
    final frac = (-_matrix.getTranslation().y).clamp(0.0, totalH - viewH) /
        ((totalH - viewH).clamp(1.0, double.infinity));
    final thumbTop = topPad + frac * (trackH - thumbH);
    final touchY = e.localPosition.dy;
    const hitPad = 16.0; // extra tap tolerance around the thumb
    if (touchY < thumbTop - hitPad || touchY > thumbTop + thumbH + hitPad) return;

    _stopFling();
    _sbPointer = e.pointer;
    _sbPointerStart = e.localPosition;
    _sbDragStartY = e.localPosition.dy;
    _sbDragStartTy = _matrix.getTranslation().y;
    _sbGrabbed.value = true;
  }

  void _sbPointerMove(PointerMoveEvent e) {
    if (e.pointer != _sbPointer) return;
    if (!_sbGrabbed.value) return;
    // Drag: map pointer-Y to scroll position
    final scale = _matrix.getMaxScaleOnAxis();
    final totalH = _contentH * scale;
    final viewH  = _viewport.height;
    if (totalH <= viewH) return;
    const topPad = _ScrollbarPainter._topPad;
    const minThumb = _ScrollbarPainter._minThumb;
    final trackH = viewH - topPad * 2;
    final thumbH = (viewH / totalH * trackH).clamp(minThumb, trackH);
    final usable = trackH - thumbH;
    if (usable <= 0) return;
    final dy = e.localPosition.dy - _sbDragStartY;
    final newTy = _sbDragStartTy - dy / usable * (totalH - viewH);
    final m = _matrix.clone()..setTranslationRaw(_matrix.getTranslation().x, newTy, 0);
    _setMatrix(m);
  }

  void _sbPointerUp(PointerEvent e) {
    if (e.pointer != _sbPointer) return;
    _sbPointer = null;
    if (_sbGrabbed.value) _sbGrabbed.value = false;
  }

  // ── Main pointer routing ───────────────────────────────────────────────────

  void _onPointerDown(PointerDownEvent e) {
    if (e.kind == PointerDeviceKind.stylus) {
      // Stylus never stops fling or pans — ink only.
      // Cancel any finger pan in progress (palm rejection).
      if (_touches.isNotEmpty) {
        _touches.clear();
        _vt = null;
        _snapshotGesture();
      }
      if (_tool == _PdfTool.eraser) _eraserPos.value = e.localPosition;
      _startInkStroke(e);
      return;
    }
    // Finger: stop any fling, blocked while a stylus stroke is active.
    _stopFling();
    if (_active != null) return;
    _touches[e.pointer] = e.localPosition;
    if (_touches.length == 1) {
      _vt = VelocityTracker.withKind(e.kind)
        ..addPosition(e.timeStamp, e.localPosition);
    } else {
      _vt = null;
    }
    _snapshotGesture();
  }

  void _onPointerMove(PointerMoveEvent e) {
    if (e.kind == PointerDeviceKind.stylus) {
      if (_tool == _PdfTool.eraser) _eraserPos.value = e.localPosition;
      _extendInkStroke(e);
      return;
    }
    if (_sbGrabbed.value) return; // scrollbar drag owns the gesture
    // Block finger pan while stylus ink is active.
    if (_active != null || !_touches.containsKey(e.pointer)) return;
    _touches[e.pointer] = e.localPosition;
    if (_touches.length == 1) _vt?.addPosition(e.timeStamp, e.localPosition);
    _applyTransform();
  }

  void _onPointerHover(PointerHoverEvent e) {
    if (e.kind == PointerDeviceKind.stylus && _tool == _PdfTool.eraser) {
      _eraserPos.value = e.localPosition;
    }
  }

  void _onPointerUp(PointerEvent e) {
    if (e.kind == PointerDeviceKind.stylus) {
      _eraserPos.value = null;
      _commitInkStroke();
      return;
    }
    final wasSinglePan = _touches.length == 1 && _vt != null;
    _touches.remove(e.pointer);
    if (wasSinglePan && _touches.isEmpty) {
      final v = _vt!.getVelocity().pixelsPerSecond;
      _vt = null;
      _startFling(v);
    } else {
      _vt = null;
      _snapshotGesture();
    }
  }

  void _onPointerCancel(PointerEvent e) {
    if (e.kind == PointerDeviceKind.stylus) {
      _eraserPos.value = null;
      _commitInkStroke();
      return;
    }
    _touches.remove(e.pointer);
    _vt = null;
    _snapshotGesture();
  }

  // ── Ink stroke handlers ────────────────────────────────────────────────────

  void _startInkStroke(PointerDownEvent e) {
    final hit = _hitTestPage(e.localPosition);
    if (hit == null) return;
    final (pageIndex, normPt) = hit;
    final scale = _matrix.getMaxScaleOnAxis();
    _euro = _OneEuro(minCutoff: 3.0, beta: 1.4, dCutoff: 1.2);
    final contentPt = MatrixUtils.transformPoint(_invMatrix, e.localPosition);
    _euro!.filter(contentPt, e.timeStamp, scale: scale); // seed filter
    _active = _PdfStroke(_tool, _activeColor, _baseSize / scale)..add(normPt);
    _activePageIndex = pageIndex;
    _bumpPage(pageIndex);
  }

  void _extendInkStroke(PointerMoveEvent e) {
    if (_active == null || _activePageIndex < 0) return;
    final scale = _matrix.getMaxScaleOnAxis();
    final contentPt = MatrixUtils.transformPoint(_invMatrix, e.localPosition);
    final filtered = _euro!.filter(contentPt, e.timeStamp, scale: scale);
    final r = _pageRects[_activePageIndex];
    // Same 0.6 on-screen pixel density threshold as the canvas.
    if (_active!.points.isNotEmpty) {
      final last = _active!.points.last;
      final lastContent = Offset(last.dx * r.width + r.left, last.dy * r.height + r.top);
      if ((filtered - lastContent).distance * scale < 0.6) return;
    }
    _active!.add(Offset(
      ((filtered.dx - r.left) / r.width).clamp(0.0, 1.0),
      ((filtered.dy - r.top) / r.height).clamp(0.0, 1.0),
    ));
    _bumpPage(_activePageIndex);
  }

  void _commitInkStroke() {
    final s = _active;
    if (s == null) return;
    _active = null;
    if (s.points.length < 2) { _activePageIndex = -1; return; }
    _pageStrokes.putIfAbsent(_activePageIndex, () => []).add(s);
    _bumpPage(_activePageIndex);
    final idx = _activePageIndex;
    _activePageIndex = -1;
    _savePageInk(idx);
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final c = context.c;

    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text('Could not open PDF.\n$_error',
              textAlign: TextAlign.center,
              style: TextStyle(color: c.inkSoft, fontSize: 14)),
        ),
      );
    }

    final doc = _doc!;

    return LayoutBuilder(builder: (ctx, cons) {
      _viewport = cons.biggest;
      _computeLayout(_viewport.width);

      // Two-layer ValueListenableBuilder pattern:
      //  • _xform   → rebuilt on every pan/zoom tick  → only updates the Transform
      //  • _visibleRange → rebuilt only when the on-screen page set changes → updates the Stack
      // The inner VLB is the `child` of the outer, so it is NOT rebuilt by _xform changes.
      final pageStack = ValueListenableBuilder<(int, int)>(
        valueListenable: _visibleRange,
        builder: (_, range, ___) => OverflowBox(
          alignment: Alignment.topLeft,
          minWidth: 0,
          maxWidth: double.infinity,
          minHeight: 0,
          maxHeight: double.infinity,
          child: SizedBox(
            width: _viewport.width,
            height: _contentH,
            child: Stack(
              children: [
                for (var i = 0; i < doc.pages.length; i++)
                  if (i < _pageRects.length)
                    Positioned(
                      left: _pageRects[i].left,
                      top: _pageRects[i].top,
                      width: _pageRects[i].width,
                      height: _pageRects[i].height,
                      child: _buildPage(
                        i, doc.pages[i], dark,
                        renderPdf: i >= range.$1 && i <= range.$2,
                      ),
                    ),
              ],
            ),
          ),
        ),
      );

      return Stack(children: [
        // ── Main pan/zoom + ink canvas ───────────────────────────────────────
        Listener(
          behavior: HitTestBehavior.translucent,
          onPointerDown: _onPointerDown,
          onPointerMove: _onPointerMove,
          onPointerUp: _onPointerUp,
          onPointerCancel: _onPointerCancel,
          onPointerHover: _onPointerHover,
          child: ClipRect(
            child: ValueListenableBuilder<int>(
              valueListenable: _xform,
              child: pageStack,
              builder: (_, __, child) => Transform(
                transform: _matrix,
                alignment: Alignment.topLeft,
                child: child,
              ),
            ),
          ),
        ),

        // ── Scrollbar (visual + drag hit zone) ───────────────────────────────
        // The visual layer sits on top and reads _xform + _sbGrabbed.
        IgnorePointer(
          child: ValueListenableBuilder<bool>(
            valueListenable: _sbGrabbed,
            builder: (_, grabbed, __) => ValueListenableBuilder<int>(
              valueListenable: _xform,
              builder: (_, __, ___) => CustomPaint(
                painter: _ScrollbarPainter(
                  scale: _matrix.getMaxScaleOnAxis(),
                  ty: _matrix.getTranslation().y,
                  contentH: _contentH,
                  viewH: _viewport.height,
                  dark: dark,
                  grabbed: grabbed,
                ),
                size: _viewport,
              ),
            ),
          ),
        ),
        // The interactive layer: right-edge hit zone for long-press drag.
        Positioned(
          top: 0, right: 0, bottom: 0,
          width: _sbHitW,
          child: Listener(
            behavior: HitTestBehavior.translucent,
            onPointerDown: _sbPointerDown,
            onPointerMove: _sbPointerMove,
            onPointerUp: _sbPointerUp,
            onPointerCancel: _sbPointerUp,
            child: const SizedBox.expand(),
          ),
        ),

        // ── Eraser cursor ring ────────────────────────────────────────────────
        IgnorePointer(
          child: ValueListenableBuilder<Offset?>(
            valueListenable: _eraserPos,
            builder: (_, pos, __) {
              if (pos == null) return const SizedBox.expand();
              return CustomPaint(
                painter: _EraserCursorPainter(
                  pos: pos,
                  radius: widget.eraserSize / 2,
                ),
                size: _viewport,
              );
            },
          ),
        ),
      ]);
    });
  }

  Widget _buildPage(int pageIndex, PdfPage page, bool dark,
      {required bool renderPdf}) {
    final r = _pageRects[pageIndex];
    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: Container(
        color: Colors.white,
        child: Stack(
          children: [
            // Only render the bitmap for visible/near pages.
            if (renderPdf)
              PdfPageView(
                document: _doc!,
                pageNumber: pageIndex + 1,
                alignment: Alignment.topLeft,
              ),
            // Ink overlay — always present so strokes survive scroll.
            ValueListenableBuilder<int>(
              valueListenable: _notifierFor(pageIndex),
              builder: (_, __, ___) => CustomPaint(
                size: Size(r.width, r.height),
                painter: _PdfInkPainter(
                  _pageStrokes[pageIndex] ?? const [],
                  _activePageIndex == pageIndex ? _active : null,
                  dark,
                ),
              ),
            ),
            // Page number pill with undo
            Positioned(
              bottom: 6,
              right: 8,
              child: GestureDetector(
                onTap: () => _undoPage(pageIndex),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.45),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.undo_rounded, size: 13, color: Colors.white),
                      const SizedBox(width: 3),
                      Text('${pageIndex + 1} / ${_doc!.pages.length}',
                          style: const TextStyle(
                              fontSize: 11,
                              color: Colors.white,
                              fontWeight: FontWeight.w600)),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
