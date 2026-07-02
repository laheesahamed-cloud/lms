import 'dart:convert';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pdfrx/pdfrx.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../state/auth_controller.dart';
import '../../theme/tokens.dart';

/// GoodNotes-style PDF viewer with per-page ink annotation.
/// Opened automatically when a lesson's NoteDoc has a non-empty pdfUrl.
///
/// Ink is stored per-page in SharedPreferences under
/// `lms.pdf.ink.$uid.$lessonId.$pageIndex` — same namespace model as canvas ink.
class PdfLessonPage extends ConsumerStatefulWidget {
  final String lessonId;
  final String pdfUrl;
  final String title;
  const PdfLessonPage({
    super.key,
    required this.lessonId,
    required this.pdfUrl,
    required this.title,
  });
  @override
  ConsumerState<PdfLessonPage> createState() => _PdfLessonPageState();
}

enum _PdfTool { pen, highlighter, eraser }

class _PdfStroke {
  final _PdfTool tool;
  final Color color;
  final double width;
  final List<Offset> points; // normalised 0..1 on the page dimensions

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

// ── Ink painter ────────────────────────────────────────────────────────────────

class _InkPainter extends CustomPainter {
  final List<_PdfStroke> strokes;
  final _PdfStroke? active;
  final bool dark;
  _InkPainter(this.strokes, this.active, this.dark) : super();

  @override
  void paint(Canvas canvas, Size size) {
    for (final s in strokes) {
      _paintStroke(canvas, size, s);
    }
    if (active != null) _paintStroke(canvas, size, active!);
  }

  void _paintStroke(Canvas canvas, Size size, _PdfStroke s) {
    if (s.points.length < 2) return;
    final pts = [for (final p in s.points) Offset(p.dx * size.width, p.dy * size.height)];
    if (s.tool == _PdfTool.highlighter) {
      final paint = Paint()
        ..color = s.color.withValues(alpha: 0.35)
        ..strokeWidth = s.width
        ..strokeCap = StrokeCap.square
        ..style = PaintingStyle.stroke
        ..blendMode = dark ? BlendMode.screen : BlendMode.multiply;
      final path = Path()..moveTo(pts.first.dx, pts.first.dy);
      for (var i = 1; i < pts.length; i++) path.lineTo(pts[i].dx, pts[i].dy);
      canvas.drawPath(path, paint);
    } else if (s.tool == _PdfTool.eraser) {
      final paint = Paint()
        ..color = Colors.white
        ..strokeWidth = s.width
        ..strokeCap = StrokeCap.round
        ..style = PaintingStyle.stroke
        ..blendMode = BlendMode.clear;
      final path = Path()..moveTo(pts.first.dx, pts.first.dy);
      for (var i = 1; i < pts.length; i++) path.lineTo(pts[i].dx, pts[i].dy);
      canvas.drawPath(path, paint);
    } else {
      // Pen: union of overlapping filled circles (same technique as canvas)
      final r = s.width / 2;
      final paint = Paint()..color = s.color..style = PaintingStyle.fill;
      canvas.drawCircle(pts.first, r, paint);
      for (var i = 1; i < pts.length; i++) {
        final a = pts[i - 1], b = pts[i];
        final dist = (b - a).distance;
        if (dist < 0.5) continue;
        final steps = math.max(1, (dist / r).ceil());
        for (var j = 0; j <= steps; j++) {
          final t = j / steps;
          canvas.drawCircle(Offset.lerp(a, b, t)!, r, paint);
        }
      }
    }
  }

  @override
  bool shouldRepaint(_InkPainter old) => true;
}

// ── State ──────────────────────────────────────────────────────────────────────

class _PdfLessonPageState extends ConsumerState<PdfLessonPage> {
  PdfDocument? _doc;
  String? _error;
  bool _loading = true;

  _PdfTool _tool = _PdfTool.pen;
  Color _penColor = const Color(0xFF1a1a2e);
  Color _hlColor = const Color(0xFFFFEB3B);
  double _penWidth = 3.0;
  double _hlWidth = 18.0;
  double _eraserWidth = 28.0;

  // Per-page strokes: pageIndex → list
  final Map<int, List<_PdfStroke>> _pageStrokes = {};
  // Active stroke (currently drawing)
  _PdfStroke? _active;
  int _activePageIndex = -1;
  // Page repaint notifiers
  final Map<int, ValueNotifier<int>> _pageNotifiers = {};

  String _uid = 'anon';
  String _inkKey(int pageIndex) => 'lms.pdf.ink.$_uid.${widget.lessonId}.$pageIndex';

  static const List<Color> _penPalette = [
    Color(0xFF1a1a2e),
    Color(0xFF2563EB),
    Color(0xFFDC2626),
    Color(0xFF16A34A),
    Color(0xFF9333EA),
    Color(0xFFF97316),
  ];
  static const List<Color> _hlPalette = [
    Color(0xFFFFEB3B),
    Color(0xFF86EFAC),
    Color(0xFF93C5FD),
    Color(0xFFFCA5A5),
    Color(0xFFF9A8D4),
    Color(0xFFF9FAFB),
  ];

  @override
  void initState() {
    super.initState();
    _uid = ref.read(authControllerProvider).user?.id ?? 'anon';
    _openPdf();
  }

  @override
  void dispose() {
    _doc?.dispose();
    for (final n in _pageNotifiers.values) n.dispose();
    super.dispose();
  }

  Future<void> _openPdf() async {
    final baseUrl = const String.fromEnvironment('API_BASE_URL',
        defaultValue: 'https://xyndrome.lk/api');
    // pdfUrl is relative like /uploads/pdf/file.pdf — resolve against server root
    final serverRoot = baseUrl.replaceAll(RegExp(r'/api$'), '');
    final fullUrl = widget.pdfUrl.startsWith('http')
        ? widget.pdfUrl
        : '$serverRoot${widget.pdfUrl}';
    try {
      final doc = await PdfDocument.openUri(Uri.parse(fullUrl));
      if (mounted) setState(() { _doc = doc; _loading = false; });
      // Pre-load ink for all pages
      for (var i = 0; i < doc.pages.length; i++) {
        await _loadPageInk(i);
      }
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _loading = false; });
    }
  }

  Future<void> _loadPageInk(int pageIndex) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_inkKey(pageIndex));
    if (raw == null) return;
    try {
      final list = (jsonDecode(raw) as List)
          .map((m) => _PdfStroke.fromJson(Map<String, dynamic>.from(m as Map)))
          .toList();
      if (mounted) {
        setState(() { _pageStrokes[pageIndex] = list; });
      }
    } catch (_) {}
  }

  Future<void> _savePageInk(int pageIndex) async {
    final strokes = _pageStrokes[pageIndex] ?? [];
    final prefs = await SharedPreferences.getInstance();
    if (strokes.isEmpty) {
      await prefs.remove(_inkKey(pageIndex));
    } else {
      await prefs.setString(
          _inkKey(pageIndex), jsonEncode([for (final s in strokes) s.toJson()]));
    }
  }

  ValueNotifier<int> _notifierFor(int pageIndex) =>
      _pageNotifiers.putIfAbsent(pageIndex, () => ValueNotifier<int>(0));

  void _bumpPage(int pageIndex) {
    final n = _notifierFor(pageIndex);
    n.value++;
  }

  Color get _activeColor => _tool == _PdfTool.highlighter ? _hlColor : _penColor;
  double get _activeWidth {
    switch (_tool) {
      case _PdfTool.pen: return _penWidth;
      case _PdfTool.highlighter: return _hlWidth;
      case _PdfTool.eraser: return _eraserWidth;
    }
  }

  void _startStroke(int pageIndex) {
    _active = _PdfStroke(_tool, _activeColor, _activeWidth);
    _activePageIndex = pageIndex;
  }

  void _addPoint(Offset normPt) {
    if (_active == null) return;
    _active!.add(normPt);
    _bumpPage(_activePageIndex);
  }

  void _endStroke() {
    if (_active == null) return;
    final s = _active!;
    _active = null;
    if (s.points.length < 2) { _activePageIndex = -1; return; }
    _pageStrokes.putIfAbsent(_activePageIndex, () => []).add(s);
    _bumpPage(_activePageIndex);
    final idx = _activePageIndex;
    _activePageIndex = -1;
    _savePageInk(idx);
  }

  void _undoPage(int pageIndex) {
    final strokes = _pageStrokes[pageIndex];
    if (strokes == null || strokes.isEmpty) return;
    setState(() { strokes.removeLast(); });
    _bumpPage(pageIndex);
    _savePageInk(pageIndex);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final dark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: c.surface1,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(c, dark),
            Expanded(child: _buildBody(c, dark)),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(AppColors c, bool dark) {
    return Container(
      height: 52,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      decoration: BoxDecoration(
        color: c.surface1,
        border: Border(bottom: BorderSide(color: c.line, width: 0.5)),
      ),
      child: Row(
        children: [
          IconButton(
            icon: Icon(Icons.arrow_back_ios_new_rounded, size: 18, color: c.inkMedium),
            onPressed: () => Navigator.of(context).maybePop(),
          ),
          Expanded(
            child: Text(
              widget.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: c.inkStrong),
            ),
          ),
          // Tool buttons
          _ToolBtn(icon: Icons.draw_rounded, active: _tool == _PdfTool.pen, color: c, onTap: () => setState(() => _tool = _PdfTool.pen)),
          _ToolBtn(icon: Icons.highlight_rounded, active: _tool == _PdfTool.highlighter, color: c, onTap: () => setState(() => _tool = _PdfTool.highlighter)),
          _ToolBtn(icon: Icons.auto_fix_high_rounded, active: _tool == _PdfTool.eraser, color: c, onTap: () => setState(() => _tool = _PdfTool.eraser)),
          const SizedBox(width: 4),
          // Color picker for current tool
          if (_tool != _PdfTool.eraser)
            _ColorPicker(
              palette: _tool == _PdfTool.highlighter ? _hlPalette : _penPalette,
              selected: _tool == _PdfTool.highlighter ? _hlColor : _penColor,
              onSelect: (col) => setState(() {
                if (_tool == _PdfTool.highlighter) _hlColor = col;
                else _penColor = col;
              }),
            ),
        ],
      ),
    );
  }

  Widget _buildBody(AppColors c, bool dark) {
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
    return ListView.builder(
      padding: const EdgeInsets.symmetric(vertical: 12),
      itemCount: doc.pages.length,
      itemBuilder: (ctx, i) => _buildPage(ctx, i, doc.pages[i], dark),
    );
  }

  Widget _buildPage(BuildContext ctx, int pageIndex, PdfPage page, bool dark) {
    final pageW = page.width;
    final pageH = page.height;
    final screenW = MediaQuery.of(ctx).size.width - 24;
    final scale = screenW / pageW;
    final renderH = pageH * scale;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Container(
          width: screenW,
          height: renderH,
          color: Colors.white,
          child: Stack(
            children: [
              // PDF page render
              PdfPageView(
                document: _doc!,
                pageNumber: pageIndex + 1,
                alignment: Alignment.topLeft,
              ),
              // Ink layer
              ValueListenableBuilder<int>(
                valueListenable: _notifierFor(pageIndex),
                builder: (_, __, ___) => RepaintBoundary(
                  child: CustomPaint(
                    size: Size(screenW, renderH),
                    painter: _InkPainter(
                      _pageStrokes[pageIndex] ?? const [],
                      _activePageIndex == pageIndex ? _active : null,
                      dark,
                    ),
                  ),
                ),
              ),
              // Gesture layer
              Positioned.fill(
                child: GestureDetector(
                  behavior: HitTestBehavior.translucent,
                  onPanStart: (d) {
                    _startStroke(pageIndex);
                    final norm = Offset(d.localPosition.dx / screenW, d.localPosition.dy / renderH);
                    _addPoint(norm);
                  },
                  onPanUpdate: (d) {
                    final norm = Offset(d.localPosition.dx / screenW, d.localPosition.dy / renderH);
                    _addPoint(norm);
                  },
                  onPanEnd: (_) => _endStroke(),
                  onPanCancel: () => _endStroke(),
                ),
              ),
              // Page number + undo
              Positioned(
                bottom: 6,
                right: 8,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    GestureDetector(
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
                                style: const TextStyle(fontSize: 11, color: Colors.white, fontWeight: FontWeight.w600)),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Small widgets ──────────────────────────────────────────────────────────────

class _ToolBtn extends StatelessWidget {
  final IconData icon;
  final bool active;
  final AppColors color;
  final VoidCallback onTap;
  const _ToolBtn({required this.icon, required this.active, required this.color, required this.onTap});
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        width: 36, height: 36,
        margin: const EdgeInsets.symmetric(horizontal: 2),
        decoration: BoxDecoration(
          color: active ? color.accent.withValues(alpha: 0.12) : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(icon, size: 20, color: active ? color.accent : color.inkMuted),
      ),
    );
  }
}

class _ColorPicker extends StatelessWidget {
  final List<Color> palette;
  final Color selected;
  final ValueChanged<Color> onSelect;
  const _ColorPicker({required this.palette, required this.selected, required this.onSelect});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => _showSheet(context),
      child: Container(
        width: 26, height: 26,
        margin: const EdgeInsets.only(right: 4),
        decoration: BoxDecoration(
          color: selected,
          shape: BoxShape.circle,
          border: Border.all(color: Colors.black.withValues(alpha: 0.18), width: 1.5),
        ),
      ),
    );
  }

  void _showSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => Container(
        margin: const EdgeInsets.all(12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Theme.of(context).scaffoldBackgroundColor,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Wrap(
              spacing: 12, runSpacing: 12,
              children: [
                for (final col in palette)
                  GestureDetector(
                    onTap: () { Navigator.pop(context); onSelect(col); },
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 120),
                      width: 40, height: 40,
                      decoration: BoxDecoration(
                        color: col,
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: col == selected
                              ? Colors.black.withValues(alpha: 0.55)
                              : Colors.black.withValues(alpha: 0.12),
                          width: col == selected ? 2.5 : 1.5,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}
