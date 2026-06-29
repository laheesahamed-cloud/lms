import 'dart:convert';
import 'dart:math' as math;
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../theme/tokens.dart';
import '../../widgets/locked_view.dart';
import '../../widgets/skeletons.dart';
import '../bookmarks/bookmark_button.dart';
import 'note_models.dart';
import 'notes_repository.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Stroke model
// ─────────────────────────────────────────────────────────────────────────────

class _Stroke {
  final List<Offset> pts;
  final Color color;
  final double width;
  final bool isHighlighter;
  final bool isEraser;
  const _Stroke({
    required this.pts,
    required this.color,
    required this.width,
    this.isHighlighter = false,
    this.isEraser = false,
  });

  Map<String, dynamic> toJson() => {
    'pts': [for (final p in pts) [p.dx, p.dy]],
    'c': color.toARGB32(),
    'w': width,
    'hl': isHighlighter,
    'er': isEraser,
  };

  factory _Stroke.fromJson(Map<String, dynamic> m) {
    final raw = m['pts'] as List;
    return _Stroke(
      pts: [for (final p in raw) Offset((p[0] as num).toDouble(), (p[1] as num).toDouble())],
      color: Color((m['c'] as num).toInt()),
      width: (m['w'] as num).toDouble(),
      isHighlighter: m['hl'] == true,
      isEraser: m['er'] == true,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Ink painter
// ─────────────────────────────────────────────────────────────────────────────

class _InkPainter extends CustomPainter {
  final List<_Stroke> strokes;
  final _Stroke? current;
  const _InkPainter({required this.strokes, this.current});

  @override
  void paint(Canvas canvas, Size size) {
    canvas.saveLayer(Rect.fromLTWH(0, 0, size.width, size.height), Paint());
    for (final s in strokes) { _draw(canvas, s); }
    if (current != null) { _draw(canvas, current!); }
    canvas.restore();
  }

  void _draw(Canvas canvas, _Stroke s) {
    if (s.pts.isEmpty) return;

    if (s.isEraser) {
      final p = Paint()
        ..blendMode = BlendMode.clear
        ..strokeWidth = s.width
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..style = PaintingStyle.stroke;
      _drawSmooth(canvas, s.pts, p);
      return;
    }

    final p = Paint()
      ..color = s.isHighlighter ? s.color.withValues(alpha: 0.38) : s.color
      ..strokeWidth = s.width
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke
      ..blendMode = s.isHighlighter ? BlendMode.multiply : BlendMode.srcOver;

    _drawSmooth(canvas, s.pts, p);
  }

  // Overlapping filled-circles pen (smooth edges, no tip shimmer).
  void _drawSmooth(Canvas canvas, List<Offset> pts, Paint p) {
    if (pts.length == 1) {
      final fp = Paint()
        ..color = p.color
        ..blendMode = p.blendMode
        ..style = PaintingStyle.fill;
      canvas.drawCircle(pts[0], p.strokeWidth / 2, fp);
      return;
    }
    final path = Path()..moveTo(pts[0].dx, pts[0].dy);
    for (var i = 1; i < pts.length; i++) {
      path.lineTo(pts[i].dx, pts[i].dy);
    }
    canvas.drawPath(path, p);
  }

  @override
  bool shouldRepaint(_InkPainter old) =>
      old.strokes != strokes || old.current != current;
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

enum _Tool { pen, highlighter, eraser }

class NoteCanvasFlutterPage extends ConsumerStatefulWidget {
  final String lessonId;
  const NoteCanvasFlutterPage({super.key, required this.lessonId});

  @override
  ConsumerState<NoteCanvasFlutterPage> createState() => _State();
}

class _State extends ConsumerState<NoteCanvasFlutterPage> {

  // ── Tool state ──────────────────────────────────────────────────────────────
  _Tool _tool = _Tool.pen;

  static const _penPalette = [
    Color(0xFF1F2937), Color(0xFF000000), Color(0xFF2563EB), Color(0xFF1D4ED8),
    Color(0xFF7C3AED), Color(0xFFDB2777), Color(0xFFDC2626), Color(0xFFEA580C),
    Color(0xFF059669), Color(0xFF0D9488), Color(0xFFB45309), Color(0xFF4B5563),
    Color(0xFFFFFFFF),
  ];
  static const _hlPalette = [
    Color(0xFFFBBF24), Color(0xFF60A5FA), Color(0xFF34D399), Color(0xFFF472B6),
    Color(0xFFA78BFA), Color(0xFF22D3EE), Color(0xFFFB7185), Color(0xFFFDBA74),
  ];

  List<Color> _penFavs = const [Color(0xFF1F2937), Color(0xFF2563EB), Color(0xFFDC2626)];
  List<Color> _hlFavs  = const [Color(0xFFFBBF24), Color(0xFF60A5FA), Color(0xFF34D399)];
  int _penSel = 0, _hlSel = 0;
  List<double> _penSizes = [2.0, 4.5, 8.0];
  List<double> _hlSizes  = [12.0, 20.0, 30.0];
  List<double> _erSizes  = [16.0, 28.0, 44.0];
  int _penSizeSel = 1, _hlSizeSel = 1, _erSizeSel = 1;

  List<Color>  get _favs  => _tool == _Tool.highlighter ? _hlFavs : _penFavs;
  int          get _sel   => _tool == _Tool.highlighter ? _hlSel  : _penSel;
  Color        get _color => _favs[_sel];
  List<double> get _sizes => switch (_tool) {
    _Tool.pen         => _penSizes,
    _Tool.highlighter => _hlSizes,
    _Tool.eraser      => _erSizes,
  };
  int    get _sizeSel    => switch (_tool) {
    _Tool.pen         => _penSizeSel,
    _Tool.highlighter => _hlSizeSel,
    _Tool.eraser      => _erSizeSel,
  };
  double get _activeSize => _sizes[_sizeSel];
  (double, double) get _sizeRange => switch (_tool) {
    _Tool.pen         => (1.0, 16.0),
    _Tool.highlighter => (8.0, 40.0),
    _Tool.eraser      => (8.0, 60.0),
  };

  // ── Canvas state ────────────────────────────────────────────────────────────
  final _tc     = TransformationController();
  final List<_Stroke> _strokes = [];
  _Stroke? _current;
  bool _panMode = false; // false = draw, true = scroll/pan

  // ── Ink persistence ─────────────────────────────────────────────────────────
  static const _toolsKey = 'lms.inktools.v4';
  String get _inkKey => 'lms.fink.${widget.lessonId}'; // flutter ink key

  // ── Lifecycle ────────────────────────────────────────────────────────────────
  @override
  void initState() {
    super.initState();
    _loadTools();
    _loadInk();
  }

  @override
  void dispose() {
    _tc.dispose();
    super.dispose();
  }

  // ── Prefs ───────────────────────────────────────────────────────────────────
  Future<void> _loadTools() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_toolsKey);
    if (raw == null) return;
    try {
      final m = jsonDecode(raw) as Map<String, dynamic>;
      List<Color> favs(String k, List<Color> fb) {
        final l = m[k];
        if (l is! List || l.length != 3) { return fb; }
        return [for (final v in l) Color((v as num).toInt())];
      }
      List<double> szs(String k, List<double> fb) {
        final l = m[k];
        if (l is! List || l.length != 3) { return fb; }
        return [for (final v in l) (v as num).toDouble()];
      }
      if (mounted) { setState(() {
        _penFavs = favs('pf', _penFavs); _hlFavs = favs('hf', _hlFavs);
        _penSel  = (m['ps'] as num?)?.toInt() ?? 0;
        _hlSel   = (m['hs'] as num?)?.toInt() ?? 0;
        _penSizes = szs('pz', _penSizes); _hlSizes = szs('hz', _hlSizes);
        _erSizes  = szs('ez', _erSizes);
        _penSizeSel = (m['pzs'] as num?)?.toInt() ?? 1;
        _hlSizeSel  = (m['hzs'] as num?)?.toInt() ?? 1;
        _erSizeSel  = (m['ezs'] as num?)?.toInt() ?? 1;
      }); }
    } catch (_) {}
  }

  Future<void> _saveTools() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_toolsKey, jsonEncode({
      'pf': [for (final c in _penFavs) c.toARGB32()],
      'hf': [for (final c in _hlFavs)  c.toARGB32()],
      'ps': _penSel, 'hs': _hlSel,
      'pz': _penSizes, 'hz': _hlSizes, 'ez': _erSizes,
      'pzs': _penSizeSel, 'hzs': _hlSizeSel, 'ezs': _erSizeSel,
    }));
  }

  Future<void> _loadInk() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_inkKey);
    if (raw == null || raw.isEmpty) return;
    try {
      final m = jsonDecode(raw) as Map<String, dynamic>;
      final list = m['strokes'] as List;
      if (mounted) { setState(() {
        _strokes.clear();
        _strokes.addAll(list.map((e) => _Stroke.fromJson(Map<String, dynamic>.from(e as Map))));
      }); }
    } catch (_) {}
  }

  Future<void> _saveInk() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_inkKey, jsonEncode({
      'strokes': [for (final s in _strokes) s.toJson()],
    }));
  }

  // ── Drawing ──────────────────────────────────────────────────────────────────

  // Convert screen position → canvas/scene position accounting for zoom+pan.
  Offset _toCanvas(Offset local) =>
      MatrixUtils.transformPoint(Matrix4.inverted(_tc.value), local);

  void _onPointerDown(PointerDownEvent e) {
    if (_panMode && e.kind != PointerDeviceKind.stylus) return;
    final pt = _toCanvas(e.localPosition);
    setState(() => _current = _Stroke(
      pts: [pt],
      color: _tool == _Tool.eraser ? Colors.white : _color,
      width: _activeSize,
      isHighlighter: _tool == _Tool.highlighter,
      isEraser: _tool == _Tool.eraser,
    ));
  }

  void _onPointerMove(PointerMoveEvent e) {
    if (_current == null) return;
    if (_panMode && e.kind != PointerDeviceKind.stylus) return;
    final pt = _toCanvas(e.localPosition);
    setState(() => _current = _Stroke(
      pts: [..._current!.pts, pt],
      color: _current!.color,
      width: _current!.width,
      isHighlighter: _current!.isHighlighter,
      isEraser: _current!.isEraser,
    ));
  }

  void _onPointerUp(PointerUpEvent e) {
    if (_current == null) return;
    setState(() {
      _strokes.add(_current!);
      _current = null;
    });
    _saveInk();
  }

  void _undo() {
    if (_strokes.isEmpty) return;
    setState(() => _strokes.removeLast());
    _saveInk();
  }

  void _clear() {
    setState(() => _strokes.clear());
    _saveInk();
  }

  // ── Tool setters ─────────────────────────────────────────────────────────────
  void _selectFav(int i) {
    setState(() => _tool == _Tool.highlighter ? _hlSel = i : _penSel = i);
    _saveTools();
  }
  void _setColor(Color c) {
    setState(() {
      if (_tool == _Tool.highlighter) { _hlFavs = [..._hlFavs]..[_hlSel] = c; }
      else { _penFavs = [..._penFavs]..[_penSel] = c; }
    });
    _saveTools();
  }
  void _selectSize(int i) {
    setState(() {
      switch (_tool) {
        case _Tool.pen:         _penSizeSel = i;
        case _Tool.highlighter: _hlSizeSel  = i;
        case _Tool.eraser:      _erSizeSel  = i;
      }
    });
    _saveTools();
  }
  void _setSizeValue(double v) {
    setState(() => _sizes[_sizeSel] = v);
    _saveTools();
  }

  // ── Build ────────────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    final c    = context.c;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final noteAsync = ref.watch(lessonNoteProvider(widget.lessonId));

    return Scaffold(
      backgroundColor: c.page,
      body: SafeArea(
        child: Column(children: [
          _header(c, noteAsync.asData?.value),
          _toolStrip(c),
          Expanded(
            child: noteAsync.when(
              loading: () => const NoteSkeleton(),
              error:   (e, _) => _errorWidget(c, e),
              data:    (note) => note.locked
                  ? LockedView(title: 'Lesson locked', reason: note.lockReason)
                  : note.isEmpty
                      ? _emptyNote(c)
                      : _canvas(note, dark),
            ),
          ),
        ]),
      ),
    );
  }

  // ── Header ───────────────────────────────────────────────────────────────────
  Widget _header(AppColors c, NoteDoc? note) => Padding(
    padding: const EdgeInsets.fromLTRB(8, 6, 12, 6),
    child: Row(children: [
      IconButton(
        onPressed: () => Navigator.of(context).maybePop(),
        icon: Icon(Icons.arrow_back_ios_new_rounded, size: 18, color: c.inkMedium),
      ),
      Expanded(child: Text(
        (note?.title.trim().isNotEmpty ?? false) ? note!.title : 'Lesson',
        maxLines: 1, overflow: TextOverflow.ellipsis,
        style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: c.inkStrong),
      )),
      if (note != null && !note.locked && note.noteId > 0)
        BookmarkButton(itemType: 'ai_note', itemId: note.noteId),
    ]),
  );

  // ── Tool strip ───────────────────────────────────────────────────────────────
  Widget _toolStrip(AppColors c) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
    decoration: BoxDecoration(border: Border(bottom: BorderSide(color: c.line))),
    child: Row(children: [
      Expanded(child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(children: [
          _toolBtn(c, Icons.edit_outlined, _tool == _Tool.pen, () {
            setState(() { _tool = _Tool.pen; _panMode = false; });
          }),
          const SizedBox(width: 6),
          _toolBtn(c, Icons.brush_outlined, _tool == _Tool.highlighter, () {
            setState(() { _tool = _Tool.highlighter; _panMode = false; });
          }),
          const SizedBox(width: 6),
          _toolBtn(c, Icons.cleaning_services_outlined, _tool == _Tool.eraser, () {
            setState(() { _tool = _Tool.eraser; _panMode = false; });
          }),
          _sep(c),
          // Pan/scroll toggle
          _toolBtn(c, Icons.pan_tool_outlined, _panMode, () {
            setState(() => _panMode = !_panMode);
          }),
          _sep(c),
          if (_tool != _Tool.eraser) ...[
            for (var i = 0; i < 3; i++) ...[_favSlot(c, i), const SizedBox(width: 6)],
            _sep(c),
          ],
          for (var i = 0; i < 3; i++) ...[_sizeSlot(c, i), const SizedBox(width: 6)],
        ]),
      )),
      _sep(c),
      _toolBtn(c, Icons.undo_rounded, false, _strokes.isNotEmpty ? _undo : null),
      const SizedBox(width: 6),
      _toolBtn(c, Icons.delete_outline_rounded, false, _strokes.isNotEmpty ? _clear : null),
    ]),
  );

  Widget _sep(AppColors c) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 8),
    child: Container(width: 1, height: 24, color: c.line),
  );

  Widget _favSlot(AppColors c, int i) {
    final isHl = _tool == _Tool.highlighter;
    final col  = _favs[i];
    final on   = _sel == i;
    return GestureDetector(
      onTap: () => on ? _openColorPicker(c) : _selectFav(i),
      child: Container(
        width: 30, height: 30, alignment: Alignment.center,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: on ? c.inkStrong : c.line, width: on ? 2.5 : 1),
        ),
        child: Container(
          width: 19, height: 19,
          decoration: BoxDecoration(
            color: isHl ? col.withValues(alpha: 0.6) : col,
            shape: BoxShape.circle,
          ),
        ),
      ),
    );
  }

  Widget _sizeSlot(AppColors c, int i) {
    final on = _sizeSel == i;
    final (lo, hi) = _sizeRange;
    final t   = ((_sizes[i] - lo) / (hi - lo)).clamp(0.0, 1.0);
    final dot = 5.0 + t * 14.0;
    return GestureDetector(
      onTap: () => on ? _openSizePicker(c) : _selectSize(i),
      child: Container(
        width: 32, height: 32, alignment: Alignment.center,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(9),
          color: on ? c.primaryTint : Colors.transparent,
          border: Border.all(color: on ? c.primary : c.line, width: on ? 2 : 1),
        ),
        child: Container(
          width: dot, height: dot,
          decoration: BoxDecoration(color: on ? c.primary : c.inkMedium, shape: BoxShape.circle),
        ),
      ),
    );
  }

  Widget _toolBtn(AppColors c, IconData icon, bool on, VoidCallback? onTap) =>
    InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        width: 34, height: 34,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(8),
          color: on ? c.primaryTint : Colors.transparent,
          border: Border.all(color: on ? c.primary : c.line),
        ),
        child: Icon(icon, size: 18,
            color: onTap == null ? c.inkMuted : (on ? c.primary : c.inkMedium)),
      ),
    );

  // ── Flutter canvas ───────────────────────────────────────────────────────────
  Widget _canvas(NoteDoc note, bool dark) {
    return Listener(
      onPointerDown: _onPointerDown,
      onPointerMove: _onPointerMove,
      onPointerUp:   _onPointerUp,
      child: InteractiveViewer(
        transformationController: _tc,
        panEnabled: _panMode,
        scaleEnabled: true,
        minScale: 0.5,
        maxScale: 4.0,
        constrained: false,
        child: SizedBox(
          width: MediaQuery.of(context).size.width,
          child: Stack(
            children: [
              // Note content (Flutter widgets)
              _NoteContent(doc: note, dark: dark),
              // Ink overlay (CustomPainter)
              IgnorePointer(
                child: CustomPaint(
                  painter: _InkPainter(strokes: _strokes, current: _current),
                  child: SizedBox(
                    width: MediaQuery.of(context).size.width,
                    height: math.max(
                      _noteContentHeight(note),
                      MediaQuery.of(context).size.height,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // Approximate content height for CustomPaint sizing.
  double _noteContentHeight(NoteDoc note) {
    double h = 120; // title + subtitle + tags + divider
    h += note.sections.length * 140.0;
    h += note.keyPoints.isNotEmpty ? 80.0 : 0;
    h += note.summaryBox.isNotEmpty ? 80.0 : 0;
    return h + 120; // bottom padding
  }

  // ── Bottom sheets ────────────────────────────────────────────────────────────
  void _openColorPicker(AppColors c) {
    final isHl    = _tool == _Tool.highlighter;
    final palette = isHl ? _hlPalette : _penPalette;
    showModalBottomSheet(
      context: context,
      backgroundColor: c.card,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(22))),
      builder: (_) => StatefulBuilder(builder: (_, ss) {
        final active = _color.toARGB32();
        return Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
          child: Column(mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(isHl ? 'Highlighter colour' : 'Pen colour',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: c.inkStrong)),
            const SizedBox(height: 16),
            Wrap(spacing: 12, runSpacing: 12, children: [
              for (var i = 0; i < palette.length; i++)
                GestureDetector(
                  onTap: () { _setColor(palette[i]); ss(() {}); },
                  child: Container(
                    width: 34, height: 34,
                    decoration: BoxDecoration(
                      color: isHl ? palette[i].withValues(alpha: 0.6) : palette[i],
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: palette[i].toARGB32() == active ? c.inkStrong : c.line,
                        width: palette[i].toARGB32() == active ? 3 : 1,
                      ),
                    ),
                  ),
                ),
            ]),
          ]),
        );
      }),
    );
  }

  void _openSizePicker(AppColors c) {
    final isHl = _tool == _Tool.highlighter;
    showModalBottomSheet(
      context: context,
      backgroundColor: c.card,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(22))),
      builder: (_) => StatefulBuilder(builder: (_, ss) {
        final (lo, hi) = _sizeRange;
        return Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
          child: Column(mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Text('Size', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: c.inkStrong)),
              const Spacer(),
              Text('${_activeSize.round()}',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: c.inkMedium)),
            ]),
            const SizedBox(height: 14),
            Center(child: Container(
              height: _activeSize.clamp(lo, hi), width: 180,
              decoration: BoxDecoration(
                color: _tool == _Tool.eraser ? c.inkMuted
                    : isHl ? _color.withValues(alpha: 0.5) : _color,
                borderRadius: BorderRadius.circular(40),
              ),
            )),
            Slider(
              min: lo, max: hi,
              value: _activeSize.clamp(lo, hi),
              onChanged: (v) { _setSizeValue(v); ss(() {}); },
            ),
          ]),
        );
      }),
    );
  }

  Widget _errorWidget(AppColors c, Object e) => Center(child: Padding(
    padding: const EdgeInsets.all(24),
    child: Text('Could not load this note.\n$e',
        textAlign: TextAlign.center,
        style: TextStyle(color: c.inkSoft, fontSize: 15.5)),
  ));

  Widget _emptyNote(AppColors c) => Center(child: Padding(
    padding: const EdgeInsets.all(24),
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      Icon(Icons.notes_outlined, size: 40, color: c.inkMuted),
      const SizedBox(height: 12),
      Text('No note for this lesson yet.',
          textAlign: TextAlign.center,
          style: TextStyle(color: c.inkSoft, fontSize: 15.5)),
    ]),
  ));
}

// ─────────────────────────────────────────────────────────────────────────────
// Flutter note content renderer
// ─────────────────────────────────────────────────────────────────────────────

class _NoteContent extends StatelessWidget {
  final NoteDoc doc;
  final bool dark;
  const _NoteContent({required this.doc, required this.dark});

  // Parchment / dark background colour.
  Color get _bg   => dark ? const Color(0xFF0F1117) : const Color(0xFFFAF3E6);
  Color get _fg   => dark ? Colors.white : const Color(0xFF111215);
  Color get _fg2  => dark ? Colors.white60 : const Color(0xFF666670);
  Color get _card => dark ? const Color(0xFF1C1F27) : Colors.white;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: _DotGridPainter(bg: _bg, dark: dark),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 24, 14, 80),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            if (doc.title.isNotEmpty)
              Text(doc.title,
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: _fg)),
            if (doc.subtitle.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(doc.subtitle, style: TextStyle(fontSize: 13, color: _fg2)),
            ],
            if (doc.tags.isNotEmpty) ...[
              const SizedBox(height: 8),
              Wrap(spacing: 6, children: [
                for (final t in doc.tags.take(7))
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFFE0EAFF),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(t, style: const TextStyle(
                        fontSize: 11, fontWeight: FontWeight.w600,
                        color: Color(0xFF3356CC))),
                  ),
              ]),
            ],
            if (doc.title.isNotEmpty) ...[
              const SizedBox(height: 16),
              Divider(color: Colors.black.withValues(alpha: 0.10), height: 1),
              const SizedBox(height: 16),
            ],
            for (final s in doc.sections) ...[
              _sectionCard(s),
              const SizedBox(height: 12),
            ],
            if (doc.keyPoints.isNotEmpty) ...[
              _tintedBox(
                header: 'Key Points',
                headerColor: const Color(0xFF2558CC),
                bg: const Color(0xFFEAF1FF),
                border: const Color(0xFF93B8FF),
                children: [
                  for (final pt in doc.keyPoints)
                    _bulletRow('★', const Color(0xFF3366DD), pt),
                ],
              ),
              const SizedBox(height: 12),
            ],
            if (doc.summaryBox.isNotEmpty) ...[
              _tintedBox(
                header: 'Summary',
                headerColor: const Color(0xFF7A4F00),
                bg: const Color(0xFFFFF6E5),
                border: const Color(0xFFD9A94A),
                children: [
                  Text(doc.summaryBox,
                      style: const TextStyle(fontSize: 13, color: Color(0xFF5A3A00))),
                ],
              ),
              const SizedBox(height: 12),
            ],
            const SizedBox(height: 60),
          ],
        ),
      ),
    );
  }

  Widget _sectionCard(NoteSection s) {
    final accent = _hexColor(s.accentColor ?? '#2563eb');
    return Container(
      decoration: BoxDecoration(
        color: _card,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 6, offset: const Offset(0, 2))],
      ),
      child: IntrinsicHeight(
        child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Container(width: 4,
              margin: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(color: accent, borderRadius: BorderRadius.circular(2))),
          const SizedBox(width: 10),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(0, 12, 14, 12),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                if (s.heading.isNotEmpty)
                  Text.rich(_inline(s.heading, 15, bold: true, base: _fg)),
                if (s.heading.isNotEmpty && s.bullets.isNotEmpty)
                  const SizedBox(height: 5),
                for (final b in s.bullets) ...[
                  _bulletRow('•', accent, b),
                ],
                if (s.callout.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.04),
                        borderRadius: BorderRadius.circular(6)),
                    child: Text(s.callout,
                        style: TextStyle(fontSize: 12, fontStyle: FontStyle.italic, color: _fg2)),
                  ),
                ],
              ]),
            ),
          ),
        ]),
      ),
    );
  }

  Widget _bulletRow(String dot, Color dotColor, String text) => Padding(
    padding: const EdgeInsets.only(bottom: 3),
    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(dot, style: TextStyle(fontSize: 13, color: dotColor, height: 1.5)),
      const SizedBox(width: 6),
      Expanded(child: Text.rich(_inline(text, 13, bold: false, base: _fg))),
    ]),
  );

  Widget _tintedBox({
    required String header, required Color headerColor,
    required Color bg, required Color border,
    required List<Widget> children,
  }) => Container(
    decoration: BoxDecoration(
      color: bg, borderRadius: BorderRadius.circular(12),
      border: Border.all(color: border),
    ),
    padding: const EdgeInsets.all(14),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min, children: [
      Text(header, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: headerColor)),
      const SizedBox(height: 8),
      ...children,
    ]),
  );

  // Inline ==highlight== and **bold** parser → TextSpan.
  TextSpan _inline(String text, double size, {required bool bold, required Color base}) {
    final baseFont = bold ? FontWeight.w700 : FontWeight.w400;
    final spans = <InlineSpan>[];
    var s = text;
    while (s.isNotEmpty) {
      if (s.startsWith('==')) {
        final e = s.indexOf('==', 2);
        if (e == -1) { spans.add(TextSpan(text: s)); break; }
        spans.add(TextSpan(
          text: s.substring(2, e),
          style: TextStyle(fontSize: size, fontWeight: baseFont,
              backgroundColor: const Color(0xFFFFE566).withValues(alpha: 0.55),
              color: Colors.black),
        ));
        s = s.substring(e + 2); continue;
      }
      if (s.startsWith('**')) {
        final e = s.indexOf('**', 2);
        if (e == -1) { spans.add(TextSpan(text: s)); break; }
        spans.add(TextSpan(
          text: s.substring(2, e),
          style: TextStyle(fontSize: size, fontWeight: FontWeight.w700, color: base),
        ));
        s = s.substring(e + 2); continue;
      }
      var nx = s.length;
      final hi = s.indexOf('=='); if (hi != -1 && hi < nx) nx = hi;
      final bd = s.indexOf('**'); if (bd != -1 && bd < nx) nx = bd;
      spans.add(TextSpan(
        text: s.substring(0, nx),
        style: TextStyle(fontSize: size, fontWeight: baseFont, color: base, height: 1.5),
      ));
      s = s.substring(nx);
    }
    return TextSpan(children: spans);
  }

  Color _hexColor(String hex) {
    var h = hex.replaceAll('#', '');
    if (h.length == 3) h = h.split('').map((c) => '$c$c').join();
    if (h.length != 6) return const Color(0xFF2563EB);
    return Color(int.parse('FF$h', radix: 16));
  }
}

// Dot-grid parchment background painter.
class _DotGridPainter extends CustomPainter {
  final Color bg;
  final bool dark;
  const _DotGridPainter({required this.bg, required this.dark});

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRect(Rect.fromLTWH(0, 0, size.width, size.height), Paint()..color = bg);
    final dot = Paint()
      ..color = (dark ? Colors.white : Colors.black).withValues(alpha: 0.10);
    const step = 20.0;
    for (double x = step; x < size.width; x += step) {
      for (double y = step; y < size.height; y += step) {
        canvas.drawCircle(Offset(x, y), 1, dot);
      }
    }
  }

  @override
  bool shouldRepaint(_DotGridPainter old) => old.bg != bg || old.dark != dark;
}

