import 'dart:async';
import 'dart:convert';
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

/// Full AI-notes screen (Flutter, §11.4 + NOTES_SCREEN_PLAN.md).
/// Fixed chrome (header + tool strip) sits OUTSIDE one InteractiveViewer; the
/// warm "canvas" (note widgets + ink) lives INSIDE it, so zoom is crisp, ink stays
/// glued, and the header never moves. Pencil draws; fingers pan/zoom.
class NoteCanvasPage extends ConsumerStatefulWidget {
  final String lessonId;
  const NoteCanvasPage({super.key, required this.lessonId});
  @override
  ConsumerState<NoteCanvasPage> createState() => _NoteCanvasPageState();
}

enum _Tool { pen, highlighter, eraser }

class _Stroke {
  final _Tool tool;
  final Color color;
  final double width; // base width; the pen scales this per point by pressure
  final List<Offset> points;
  // Normalised 0..1 stylus pressure, one per point. Empty for legacy strokes and
  // for devices/fingers with no pressure → those render at a flat [width]. Only
  // the pen varies width by pressure; the highlighter and eraser stay fixed.
  final List<double> pressures;
  _Stroke(this.tool, this.color, this.width,
      {List<Offset>? points, List<double>? pressures})
      : points = points ?? [],
        pressures = pressures ?? [];

  void add(Offset o, double pressure) {
    points.add(o);
    pressures.add(pressure);
  }

  // Effective half-stretch of the pen at point [i] (0.4..1.0 of base width), so a
  // light touch tapers and a firm press fills out — the natural-pen feel.
  double widthAt(int i) =>
      i < pressures.length ? width * (0.4 + 0.6 * pressures[i]) : width;

  Map<String, dynamic> toJson() => {
        't': tool.index,
        'c': color.toARGB32(),
        'w': width,
        'p': [for (final o in points) [o.dx, o.dy]],
        if (pressures.isNotEmpty) 'pr': pressures,
      };

  factory _Stroke.fromJson(Map<String, dynamic> m) => _Stroke(
        _Tool.values[(m['t'] as num).toInt()],
        Color((m['c'] as num).toInt()),
        (m['w'] as num).toDouble(),
        points: [
          for (final p in (m['p'] as List))
            Offset((p[0] as num).toDouble(), (p[1] as num).toDouble())
        ],
        pressures: [
          for (final v in ((m['pr'] as List?) ?? const []))
            (v as num).toDouble()
        ],
      );
}

class _NoteCanvasPageState extends ConsumerState<NoteCanvasPage> {
  final List<_Stroke> _strokes = [];
  _Stroke? _active;
  _Tool _tool = _Tool.pen;
  bool _penDown = false;
  // Repaints the ink layer while drawing WITHOUT rebuilding the note (no flicker).
  final ValueNotifier<int> _tick = ValueNotifier<int>(0);
  // Persisting re-serializes the whole stroke list, so we don't write on every
  // pen-lift — a burst of strokes is coalesced into one save after writing stops.
  Timer? _saveTimer;
  bool _inkDirty = false;
  // Bumped whenever the COMMITTED ink changes (commit/undo/clear/load). The
  // committed painters repaint on a change of this — `_strokes` is mutated in
  // place, so its identity/length can't tell the painter the ink changed.
  int _inkGen = 0;

  // Pen palette — dark ink colours.
  static const _penPalette = [
    Color(0xFF1F2937), Color(0xFF000000), Color(0xFF2563EB), Color(0xFF1D4ED8),
    Color(0xFF7C3AED), Color(0xFFDB2777), Color(0xFFDC2626), Color(0xFFEA580C),
    Color(0xFF059669), Color(0xFF0D9488), Color(0xFFB45309), Color(0xFF4B5563),
  ];
  // Highlighter palette — medium highlight tones; blended (multiply on a light
  // page, screen on a dark page) so the text keeps its colour and only the
  // paper/cards take the colour — exactly like GoodNotes.
  static const _hlPalette = [
    Color(0xFFFBBF24), Color(0xFF60A5FA), Color(0xFF34D399), Color(0xFFF472B6),
    Color(0xFFA78BFA), Color(0xFF22D3EE), Color(0xFFFB7185), Color(0xFFFDBA74),
  ];

  // 3 editable favourite colour slots per tool (GoodNotes-style quick picks).
  List<Color> _penFavs = const [
    Color(0xFF1F2937), // ink black
    Color(0xFF2563EB), // blue
    Color(0xFFDC2626), // red
  ];
  List<Color> _hlFavs = const [
    Color(0xFFFBBF24), // amber
    Color(0xFF60A5FA), // blue
    Color(0xFF34D399), // green
  ];
  int _penSel = 0;
  int _hlSel = 0;
  // 3 editable size presets per tool (S/M/L), GoodNotes-style.
  List<double> _penSizes = [2.0, 4.5, 8.0];
  List<double> _hlSizes = [12.0, 20.0, 30.0];
  List<double> _erSizes = [16.0, 28.0, 44.0];
  int _penSizeSel = 1;
  int _hlSizeSel = 1;
  int _erSizeSel = 1;

  List<Color> get _favs => _tool == _Tool.highlighter ? _hlFavs : _penFavs;
  int get _sel => _tool == _Tool.highlighter ? _hlSel : _penSel;
  Color get _activeColor => _favs[_sel];

  List<double> get _sizes => switch (_tool) {
        _Tool.pen => _penSizes,
        _Tool.highlighter => _hlSizes,
        _Tool.eraser => _erSizes,
      };
  int get _sizeSel => switch (_tool) {
        _Tool.pen => _penSizeSel,
        _Tool.highlighter => _hlSizeSel,
        _Tool.eraser => _erSizeSel,
      };
  double get _activeSize => _sizes[_sizeSel];

  (double, double) get _sizeRange => switch (_tool) {
        _Tool.pen => (1.0, 16.0),
        _Tool.highlighter => (8.0, 40.0),
        _Tool.eraser => (8.0, 60.0),
      };

  void _selectFav(int i) {
    setState(() {
      if (_tool == _Tool.highlighter) {
        _hlSel = i;
      } else {
        _penSel = i;
      }
    });
    _saveTools();
  }

  // Reassign the active favourite slot to a palette colour.
  void _setColor(Color color) {
    setState(() {
      if (_tool == _Tool.highlighter) {
        _hlFavs = [..._hlFavs]..[_hlSel] = color;
      } else {
        _penFavs = [..._penFavs]..[_penSel] = color;
      }
    });
    _saveTools();
  }

  void _selectSize(int i) {
    setState(() {
      switch (_tool) {
        case _Tool.pen:
          _penSizeSel = i;
        case _Tool.highlighter:
          _hlSizeSel = i;
        case _Tool.eraser:
          _erSizeSel = i;
      }
    });
    _saveTools();
  }

  // Reassign the active size preset to a new value.
  void _setSizeValue(double v) {
    setState(() => _sizes[_sizeSel] = v);
    _saveTools();
  }

  String get _inkKey => 'lms.ink.${widget.lessonId}';
  static const _toolsKey = 'lms.inktools.v4';

  // The note body is the most expensive subtree and never changes while drawing.
  // Cache the built widget instance so a pen-down/up setState (which only flips
  // pen/ink state) reuses the SAME widget object — Flutter then skips rebuilding
  // the whole note tree, killing the per-stroke hitch.
  Widget? _noteCache;
  NoteDoc? _noteCacheKey;
  bool _noteCacheDark = false;
  Widget _noteContent(NoteDoc note, bool dark) {
    if (_noteCache == null ||
        !identical(_noteCacheKey, note) ||
        _noteCacheDark != dark) {
      _noteCacheKey = note;
      _noteCacheDark = dark;
      _noteCache = _NoteContent(note: note, dark: dark);
    }
    return _noteCache!;
  }

  @override
  void initState() {
    super.initState();
    _loadInk();
    _loadTools();
  }

  @override
  void dispose() {
    _saveTimer?.cancel();
    if (_inkDirty) _saveInk(); // flush any pending ink before leaving
    _tick.dispose();
    super.dispose();
  }

  Future<void> _loadTools() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_toolsKey);
    if (raw == null) return;
    try {
      final m = jsonDecode(raw) as Map<String, dynamic>;
      List<Color> favs(String k, List<Color> fallback) {
        final l = m[k];
        if (l is! List || l.length != 3) return fallback;
        return [for (final v in l) Color((v as num).toInt())];
      }

      List<double> sizes(String k, List<double> fallback) {
        final l = m[k];
        if (l is! List || l.length != 3) return fallback;
        return [for (final v in l) (v as num).toDouble()];
      }

      _penFavs = favs('pf', _penFavs);
      _hlFavs = favs('hf', _hlFavs);
      _penSel = (m['ps'] as num?)?.toInt() ?? 0;
      _hlSel = (m['hs'] as num?)?.toInt() ?? 0;
      _penSizes = sizes('pz', _penSizes);
      _hlSizes = sizes('hz', _hlSizes);
      _erSizes = sizes('ez', _erSizes);
      _penSizeSel = (m['pzs'] as num?)?.toInt() ?? 1;
      _hlSizeSel = (m['hzs'] as num?)?.toInt() ?? 1;
      _erSizeSel = (m['ezs'] as num?)?.toInt() ?? 1;
      if (mounted) setState(() {});
    } catch (_) {}
  }

  Future<void> _saveTools() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
        _toolsKey,
        jsonEncode({
          'pf': [for (final c in _penFavs) c.toARGB32()],
          'hf': [for (final c in _hlFavs) c.toARGB32()],
          'ps': _penSel,
          'hs': _hlSel,
          'pz': _penSizes,
          'hz': _hlSizes,
          'ez': _erSizes,
          'pzs': _penSizeSel,
          'hzs': _hlSizeSel,
          'ezs': _erSizeSel,
        }));
  }

  Future<void> _loadInk() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_inkKey);
    if (raw == null) return;
    try {
      final list = (jsonDecode(raw) as List)
          .map((m) => _Stroke.fromJson(Map<String, dynamic>.from(m as Map)))
          .toList();
      if (mounted) {
        setState(() {
          _strokes.addAll(list);
          _inkGen++;
        });
      }
    } catch (_) {}
  }

  // Coalesce rapid strokes: restart a short timer on each change and only write
  // once writing pauses. dispose() flushes whatever is still pending.
  void _scheduleSaveInk() {
    _inkDirty = true;
    _saveTimer?.cancel();
    _saveTimer = Timer(const Duration(milliseconds: 1200), () {
      _saveTimer = null;
      if (_inkDirty) _saveInk();
    });
  }

  Future<void> _saveInk() async {
    _inkDirty = false;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
        _inkKey, jsonEncode([for (final s in _strokes) s.toJson()]));
  }

  // Normalise raw stylus pressure into 0..1 across the device's own range. Pens
  // with no pressure (or a finger) report min == max → flat 1.0.
  static double _norm(PointerEvent e) {
    final range = e.pressureMax - e.pressureMin;
    if (range <= 0) return 1.0;
    return ((e.pressure - e.pressureMin) / range).clamp(0.0, 1.0);
  }

  void _onDown(PointerDownEvent e) {
    if (e.kind != PointerDeviceKind.stylus) return;
    final s = _Stroke(_tool, _activeColor, _activeSize)
      ..add(e.localPosition, _norm(e));
    setState(() {
      _penDown = true;
      _active = s;
    });
  }

  void _onMove(PointerMoveEvent e) {
    if (_active == null || e.kind != PointerDeviceKind.stylus) return;
    final p = e.localPosition;
    // Skip sub-pixel jitter: fewer points → cheaper paint per frame, cheaper
    // commit redraw, and a smaller saved blob, with no visible quality loss.
    if ((p - _active!.points.last).distanceSquared < 0.8) return;
    _active!.add(p, _norm(e));
    _tick.value++; // repaint ink only — no widget rebuild (kills the flicker)
  }

  void _onUp(PointerUpEvent e) {
    if (_active == null) return;
    setState(() {
      _strokes.add(_active!);
      _active = null;
      _penDown = false;
      _inkGen++;
    });
    _scheduleSaveInk();
  }

  void _undo() {
    if (_strokes.isEmpty) return;
    setState(() {
      _strokes.removeLast();
      _inkGen++;
    });
    _scheduleSaveInk();
  }

  void _clear() {
    if (_strokes.isEmpty) return;
    setState(() {
      _strokes.clear();
      _inkGen++;
    });
    _scheduleSaveInk();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final noteAsync = ref.watch(lessonNoteProvider(widget.lessonId));
    return Scaffold(
      backgroundColor: c.page,
      body: SafeArea(
        child: Column(
          children: [
            _header(c, noteAsync.asData?.value),
            _toolStrip(c),
            Expanded(
              child: noteAsync.when(
                loading: () => const NoteSkeleton(),
                error: (e, _) => _error(c, e),
                data: (note) => note.locked
                    ? LockedView(
                        title: 'Lesson locked', reason: note.lockReason)
                    : note.isEmpty
                        ? _emptyNote(c)
                        : _canvas(c, dark, note),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _header(AppColors c, NoteDoc? note) => Padding(
        padding: const EdgeInsets.fromLTRB(8, 6, 12, 6),
        child: Row(
          children: [
            IconButton(
              onPressed: () => Navigator.of(context).maybePop(),
              icon: Icon(Icons.arrow_back_ios_new_rounded, size: 18, color: c.inkMedium),
            ),
            Expanded(
              child: Text(
                  (note?.title.trim().isNotEmpty ?? false) ? note!.title : 'Lesson',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                      fontSize: 17, fontWeight: FontWeight.w800, color: c.inkStrong)),
            ),
            if (note != null && !note.locked && note.noteId > 0)
              BookmarkButton(itemType: 'ai_note', itemId: note.noteId),
          ],
        ),
      );

  Widget _toolStrip(AppColors c) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          border: Border(bottom: BorderSide(color: c.line)),
        ),
        child: Row(
          children: [
            Expanded(
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    _toolBtn(c, Icons.edit_outlined, _tool == _Tool.pen,
                        () => setState(() => _tool = _Tool.pen)),
                    const SizedBox(width: 6),
                    _toolBtn(c, Icons.brush_outlined,
                        _tool == _Tool.highlighter,
                        () => setState(() => _tool = _Tool.highlighter)),
                    const SizedBox(width: 6),
                    _toolBtn(c, Icons.cleaning_services_outlined,
                        _tool == _Tool.eraser,
                        () => setState(() => _tool = _Tool.eraser)),
                    _sep(c),
                    if (_tool != _Tool.eraser) ...[
                      for (var i = 0; i < 3; i++) ...[
                        _favSlot(c, i),
                        const SizedBox(width: 6),
                      ],
                      _sep(c),
                    ],
                    for (var i = 0; i < 3; i++) ...[
                      _sizeSlot(c, i),
                      const SizedBox(width: 6),
                    ],
                  ],
                ),
              ),
            ),
            _sep(c),
            _toolBtn(c, Icons.undo_rounded, false,
                _strokes.isEmpty ? null : _undo),
            const SizedBox(width: 6),
            _toolBtn(c, Icons.delete_outline_rounded, false,
                _strokes.isEmpty ? null : _clear),
          ],
        ),
      );

  Widget _sep(AppColors c) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8),
        child: Container(width: 1, height: 24, color: c.line),
      );

  // A quick-pick favourite colour. Tap to select; tap the active one to edit it.
  Widget _favSlot(AppColors c, int i) {
    final isHl = _tool == _Tool.highlighter;
    final color = _favs[i];
    final on = _sel == i;
    return GestureDetector(
      onTap: () => on ? _openColorPicker(c) : _selectFav(i),
      child: Container(
        width: 30,
        height: 30,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border:
              Border.all(color: on ? c.inkStrong : c.line, width: on ? 2.5 : 1),
        ),
        child: Container(
          width: 19,
          height: 19,
          decoration: BoxDecoration(
            color: isHl ? color.withValues(alpha: 0.6) : color,
            shape: BoxShape.circle,
          ),
        ),
      ),
    );
  }

  // A size preset. Tap to select; tap the active one to change its value.
  Widget _sizeSlot(AppColors c, int i) {
    final on = _sizeSel == i;
    final (lo, hi) = _sizeRange;
    final t = ((_sizes[i] - lo) / (hi - lo)).clamp(0.0, 1.0);
    final dot = 5.0 + t * 14.0;
    return GestureDetector(
      onTap: () => on ? _openSizePicker(c) : _selectSize(i),
      child: Container(
        width: 32,
        height: 32,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(9),
          color: on ? c.primaryTint : Colors.transparent,
          border: Border.all(color: on ? c.primary : c.line, width: on ? 2 : 1),
        ),
        child: Container(
          width: dot,
          height: dot,
          decoration: BoxDecoration(
              color: on ? c.primary : c.inkMedium, shape: BoxShape.circle),
        ),
      ),
    );
  }

  // Reassign the selected colour favourite from the full palette.
  void _openColorPicker(AppColors c) {
    final isHl = _tool == _Tool.highlighter;
    final palette = isHl ? _hlPalette : _penPalette;
    showModalBottomSheet(
      context: context,
      backgroundColor: c.card,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(22))),
      builder: (_) => StatefulBuilder(
        builder: (ctx, setSheet) {
          final active = _activeColor.toARGB32();
          return Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(isHl ? 'Highlighter colour' : 'Pen colour',
                    style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: c.inkStrong)),
                const SizedBox(height: 16),
                Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  children: [
                    for (var i = 0; i < palette.length; i++)
                      GestureDetector(
                        onTap: () {
                          _setColor(palette[i]);
                          setSheet(() {});
                        },
                        child: Container(
                          width: 34,
                          height: 34,
                          decoration: BoxDecoration(
                            color: isHl
                                ? palette[i].withValues(alpha: 0.6)
                                : palette[i],
                            shape: BoxShape.circle,
                            border: Border.all(
                                color: palette[i].toARGB32() == active
                                    ? c.inkStrong
                                    : c.line,
                                width: palette[i].toARGB32() == active ? 3 : 1),
                          ),
                        ),
                      ),
                  ],
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  // Change the selected size preset's value.
  void _openSizePicker(AppColors c) {
    final isHl = _tool == _Tool.highlighter;
    showModalBottomSheet(
      context: context,
      backgroundColor: c.card,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(22))),
      builder: (_) => StatefulBuilder(
        builder: (ctx, setSheet) {
          final (lo, hi) = _sizeRange;
          return Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text('Size',
                        style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            color: c.inkStrong)),
                    const Spacer(),
                    Text('${_activeSize.round()}',
                        style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: c.inkMedium)),
                  ],
                ),
                const SizedBox(height: 14),
                Center(
                  child: Container(
                    height: _activeSize.clamp(lo, hi),
                    width: 180,
                    decoration: BoxDecoration(
                      color: _tool == _Tool.eraser
                          ? c.inkMuted
                          : (isHl
                              ? _activeColor.withValues(alpha: 0.5)
                              : _activeColor),
                      borderRadius: BorderRadius.circular(40),
                    ),
                  ),
                ),
                Slider(
                  min: lo,
                  max: hi,
                  value: _activeSize.clamp(lo, hi),
                  onChanged: (v) {
                    _setSizeValue(v);
                    setSheet(() {});
                  },
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _toolBtn(AppColors c, IconData icon, bool on, VoidCallback? onTap) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          width: 34,
          height: 34,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(8),
            color: on ? c.primaryTint : Colors.transparent,
            border: Border.all(color: on ? c.primary : c.line),
          ),
          child: Icon(icon,
              size: 18,
              color: onTap == null ? c.inkMuted : (on ? c.primary : c.inkMedium)),
        ),
      );

  Widget _error(AppColors c, Object e) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text('Could not load this note.\n$e',
              textAlign: TextAlign.center, style: TextStyle(color: c.inkSoft, fontSize: 15.5)),
        ),
      );

  Widget _emptyNote(AppColors c) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.notes_outlined, size: 40, color: c.inkMuted),
              const SizedBox(height: 12),
              Text('No note for this lesson yet.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: c.inkSoft, fontSize: 15.5)),
            ],
          ),
        ),
      );

  Widget _canvas(AppColors c, bool dark, NoteDoc note) {
    // The eraser is the only tool that must mutate the committed ink live; pen
    // and highlighter draw their in-flight stroke on the cheap top layer only.
    final erasing = _active?.tool == _Tool.eraser;
    return InteractiveViewer(
      constrained: false,
      minScale: 1.0,
      maxScale: 5.0,
      panEnabled: !_penDown,
      scaleEnabled: !_penDown,
      // Lock a drag to one axis (no sideways jump while scrolling vertically);
      // horizontal room only exists once zoomed in (0 horizontal slack at 1x).
      // Small vertical margin = a little overscroll, not endless empty space.
      panAxis: PanAxis.aligned,
      boundaryMargin: const EdgeInsets.symmetric(vertical: 48, horizontal: 0),
      child: SizedBox(
        width: MediaQuery.of(context).size.width,
        child: Stack(
          children: [
            _noteContent(note, dark),
            // Committed highlighter: blended onto the note below (multiply on a
            // light page, screen on a dark one) so the text keeps its colour.
            // No RepaintBoundary — the blend must see the note beneath it — so
            // it deliberately does NOT repaint mid pen-stroke (only on commit,
            // or live while erasing).
            Positioned.fill(
              child: CustomPaint(
                  painter: _InkPainter(_strokes, erasing ? _active : null,
                      highlighter: true, dark: dark, gen: _inkGen,
                      repaint: erasing ? _tick : null)),
            ),
            // Committed pen + eraser ink, cached in its own layer so it is not
            // redrawn while writing.
            Positioned.fill(
              child: RepaintBoundary(
                child: CustomPaint(
                    painter: _InkPainter(_strokes, erasing ? _active : null,
                        highlighter: false, gen: _inkGen,
                        repaint: erasing ? _tick : null)),
              ),
            ),
            // Live layer: the in-flight stroke + stylus input. This is the ONLY
            // thing that repaints per pointer move, so ink stays on the pen tip.
            Positioned.fill(
              child: Listener(
                behavior: HitTestBehavior.translucent,
                onPointerDown: _onDown,
                onPointerMove: _onMove,
                onPointerUp: _onUp,
                child: RepaintBoundary(
                  child: CustomPaint(
                      painter: _LivePainter(erasing ? null : _active,
                          dark: dark, repaint: _tick)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---- Ink drawing helpers (shared by the committed + live painters) ----

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

void _drawStroke(Canvas canvas, _Stroke s, Paint paint) {
  if (s.points.length == 1) {
    canvas.drawCircle(s.points.first, s.width / 2,
        Paint()..color = paint.color..blendMode = paint.blendMode);
    return;
  }
  canvas.drawPath(_smoothPath(s.points), paint);
}

// Pen rendering with per-point pressure. When the stroke carries pressure we draw
// it as a UNION OF FILLED CIRCLES — one per point, radius = that point's pressure.
// The union has naturally smooth EDGES (no bumpy per-segment joints) and a clean
// pressure taper, and because each circle is independent, streaming in new points
// never disturbs the ink already drawn (no tip shimmer). Consecutive points are
// resampled so circles always overlap — no gaps even on a fast stroke. Opaque, so
// overlaps don't darken.
void _drawPen(Canvas canvas, _Stroke s, Color color) {
  final pts = s.points;
  final n = pts.length;
  if (n == 0) return;
  final fill = Paint()
    ..color = color
    ..style = PaintingStyle.fill
    ..isAntiAlias = true;
  final flat = s.pressures.length != n;
  double rad(int i) => (flat ? s.width : s.widthAt(i)) / 2;
  canvas.drawCircle(pts.first, rad(0), fill);
  for (var i = 1; i < n; i++) {
    final a = pts[i - 1], b = pts[i];
    final ra = rad(i - 1), rb = rad(i);
    final dist = (b - a).distance;
    final minR = ra < rb ? ra : rb;
    final step = minR * 0.5 < 0.75 ? 0.75 : minR * 0.5; // dense enough to overlap
    final steps = dist <= step ? 1 : (dist / step).ceil();
    for (var k = 1; k <= steps; k++) {
      final t = k / steps;
      canvas.drawCircle(
          Offset(a.dx + (b.dx - a.dx) * t, a.dy + (b.dy - a.dy) * t),
          ra + (rb - ra) * t,
          fill);
    }
  }
}

// Quadratic-bezier smoothing through point midpoints — crisp, no jagged joints.
Path _smoothPath(List<Offset> pts) {
  final path = Path()..moveTo(pts.first.dx, pts.first.dy);
  if (pts.length < 3) {
    for (final o in pts.skip(1)) {
      path.lineTo(o.dx, o.dy);
    }
    return path;
  }
  for (var i = 1; i < pts.length - 1; i++) {
    final mid = Offset(
        (pts[i].dx + pts[i + 1].dx) / 2, (pts[i].dy + pts[i + 1].dy) / 2);
    path.quadraticBezierTo(pts[i].dx, pts[i].dy, mid.dx, mid.dy);
  }
  path.lineTo(pts.last.dx, pts.last.dy);
  return path;
}

/// Paints the COMMITTED ink only (one layer per call: highlighter or pen).
/// Critically, this does NOT repaint while a pen/highlighter stroke is in
/// flight — the live stroke lives on [_LivePainter] above it — so the costly
/// whole-page highlighter blend and the redraw of every existing stroke happen
/// once per stroke (on commit), not once per pointer move. That is what keeps
/// the pen tip from outrunning the ink. The eraser is the one exception: it
/// must cut into committed ink, so it is fed here and follows [repaint] live.
class _InkPainter extends CustomPainter {
  final List<_Stroke> strokes;
  final _Stroke? active; // only an in-flight eraser is fed here, for a live cut
  final bool highlighter; // this painter's layer
  final bool dark;
  final int gen; // committed-ink generation; changes => content changed
  _InkPainter(this.strokes, this.active,
      {required this.highlighter, this.dark = false, this.gen = 0, super.repaint});

  @override
  void paint(Canvas canvas, Size size) {
    final bounds = Offset.zero & size;
    final all = [...strokes, ?active];

    if (highlighter) {
      if (!all.any((s) => s.tool == _Tool.highlighter)) return;
      // Blend the whole highlighter layer onto the note: the text keeps its
      // colour and only the paper/cards take the colour (the GoodNotes trick).
      //  • light page / dark text → multiply: dark text survives (x × 0 = 0).
      //  • dark page / light text → screen:   white text survives (1 ∨ x = 1).
      // Strokes are opaque inside the layer, so overlaps stay uniform (no
      // darkening), then the whole layer is blended onto the note once.
      canvas.saveLayer(bounds,
          Paint()..blendMode = dark ? BlendMode.screen : BlendMode.multiply);
      for (final s in all) {
        if (s.points.isEmpty) continue;
        if (s.tool == _Tool.highlighter) {
          // Translucent ink so the multiply layer tints the paper while dark
          // text/ink underneath stays crisp (real-highlighter look).
          _drawStroke(canvas, s, _linePaint(s.color.withValues(alpha: 0.4), s.width));
        } else if (s.tool == _Tool.eraser) {
          _drawStroke(canvas, s, _eraserPaint(s.width));
        }
      }
      canvas.restore();
      return;
    }

    // Pen layer. Isolating layer only when erasing, so clear hits ink (not text).
    final hasEraser = all.any((s) => s.tool == _Tool.eraser);
    if (hasEraser) canvas.saveLayer(bounds, Paint());
    for (final s in all) {
      if (s.points.isEmpty) continue;
      if (s.tool == _Tool.pen) {
        _drawPen(canvas, s, s.color);
      } else if (s.tool == _Tool.eraser) {
        _drawStroke(canvas, s, _eraserPaint(s.width));
      }
    }
    if (hasEraser) canvas.restore();
  }

  // Repaint only when the committed ink actually changes (a stroke committed,
  // undo/clear, load, theme flip) — NOT when only `_penDown` toggled. `gen`
  // carries that signal because `strokes` is mutated in place (its identity and
  // length stay equal across a commit). Live erasing still repaints because it
  // is driven by the `repaint` listenable, which bypasses this check.
  @override
  bool shouldRepaint(_InkPainter old) =>
      old.gen != gen ||
      !identical(old.active, active) ||
      old.dark != dark ||
      old.highlighter != highlighter;
}

/// Paints ONLY the in-progress stroke, isolated inside a [RepaintBoundary] on a
/// cheap top layer that repaints every pointer move (via [repaint]). Because it
/// is the only thing that repaints mid-stroke, the ink stays glued to the pen
/// tip. The eraser is handled by [_InkPainter] (it must cut into committed ink),
/// so nothing is drawn here for it.
class _LivePainter extends CustomPainter {
  final _Stroke? active;
  final bool dark;
  _LivePainter(this.active, {required this.dark, super.repaint});

  @override
  void paint(Canvas canvas, Size size) {
    final s = active;
    if (s == null || s.points.isEmpty) return;
    switch (s.tool) {
      case _Tool.pen:
        _drawPen(canvas, s, s.color);
      case _Tool.highlighter:
        // "Wet" preview: a translucent marker while the stroke is in flight.
        // On release it commits to the multiply/screen layer and snaps to the
        // exact GoodNotes look (text crisp underneath).
        _drawStroke(canvas, s, _linePaint(s.color.withValues(alpha: 0.4), s.width));
      case _Tool.eraser:
        break;
    }
  }

  @override
  bool shouldRepaint(_LivePainter old) => true;
}

/// The warm dot-grid "paper" with the note content rendered as widgets.
class _NoteContent extends StatelessWidget {
  final NoteDoc note;
  final bool dark;
  const _NoteContent({required this.note, required this.dark});

  @override
  Widget build(BuildContext context) {
    final paper = dark ? const Color(0xFF17150F) : const Color(0xFFFAF3E6);
    final dot = dark ? Colors.white.withValues(alpha: 0.05) : const Color(0xFFE7DABF);
    final ink = dark ? const Color(0xFFDCE6FF) : const Color(0xFF322F29);
    final muted = dark ? const Color(0xFF9AA4BF) : const Color(0xFF6B6155);

    return CustomPaint(
      painter: _DotGridPainter(dot),
      child: Container(
        decoration: BoxDecoration(
          color: paper,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: dark ? Colors.white12 : const Color(0xFFECDFC6)),
        ),
        margin: const EdgeInsets.all(10),
        padding: const EdgeInsets.fromLTRB(14, 16, 14, 28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                border: Border.all(color: dark ? Colors.white12 : const Color(0xFFE2D3B4)),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Text(note.title.toUpperCase(),
                  textAlign: TextAlign.center,
                  style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: ink,
                      letterSpacing: 0.4)),
            ),
            if (note.subtitle.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(note.subtitle,
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 14, color: muted)),
              ),
            const SizedBox(height: 14),
            for (var i = 0; i < note.sections.length; i++)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _SectionCard(
                    section: note.sections[i],
                    index: i,
                    ink: ink,
                    muted: muted,
                    dark: dark),
              ),
            if (note.keyPoints.isNotEmpty) _keyPoints(ink),
            if (note.summaryBox.isNotEmpty) _summary(ink),
          ],
        ),
      ),
    );
  }

  Widget _keyPoints(Color ink) => Container(
        padding: const EdgeInsets.all(14),
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          color: dark ? Colors.white.withValues(alpha: 0.03) : const Color(0xFFFFFDF6),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: dark ? Colors.white12 : const Color(0xFFEADFCE)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('KEY POINTS',
                style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    color: ink,
                    letterSpacing: 0.6)),
            const SizedBox(height: 8),
            for (var i = 0; i < note.keyPoints.length; i++)
              Padding(
                padding: const EdgeInsets.only(bottom: 5),
                child: _bullet(note.keyPoints[i], ink,
                    _kPalette[i % _kPalette.length],
                    index: i, dark: dark),
              ),
          ],
        ),
      );

  Widget _summary(Color ink) => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: dark ? const Color(0xFF12233A) : const Color(0xFFECF2FD),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: dark ? Colors.white12 : const Color(0xFFCFE0F8)),
        ),
        child: _inlineText(
            note.summaryBox,
            TextStyle(fontSize: 14, height: 1.4, color: ink, fontWeight: FontWeight.w600),
            accent: const Color(0xFF0EA5E9),
            dark: dark),
      );
}

/// Section accent palette (web NoteCanvas `PALETTE`) — cycled by section index
/// so each card gets a distinct colour, exactly like the web note.
const _kPalette = <Color>[
  Color(0xFF2563EB), Color(0xFFDC2626), Color(0xFF0EA5E9), Color(0xFFD97706),
  Color(0xFF7C3AED), Color(0xFF60A5FA), Color(0xFFDB2777), Color(0xFFEA580C),
  Color(0xFF16A34A), Color(0xFFCA8A04), Color(0xFFA7D8FF), Color(0xFFFFE082),
  Color(0xFFFF8A80), Color(0xFF80CBC4), Color(0xFFCE93D8), Color(0xFFFFCC80),
  Color(0xFFF48FB1), Color(0xFF80DEEA), Color(0xFFA5D6A7), Color(0xFFFFE0B2),
];

/// Highlight cycle (web `DEFAULT_HIGHLIGHT_COLORS`), prefixed by the section accent.
const _kHighlightColors = <Color>[
  Color(0xFFFBBF24), Color(0xFF60A5FA), Color(0xFF34D399), Color(0xFFF472B6),
  Color(0xFFA78BFA), Color(0xFF22D3EE), Color(0xFFFB7185), Color(0xFFFDBA74),
];

Color? _parseHex(String? hex) {
  if (hex == null || hex.trim().isEmpty) return null;
  var h = hex.replaceAll('#', '').trim();
  if (h.length == 6) h = 'FF$h';
  final v = int.tryParse(h, radix: 16);
  return v == null ? null : Color(v);
}

Widget _bullet(String text, Color ink, Color accent,
        {int index = 0, bool dark = false}) =>
    Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          margin: const EdgeInsets.only(top: 7, right: 9),
          width: 7,
          height: 7,
          decoration: BoxDecoration(color: accent, shape: BoxShape.circle),
        ),
        Expanded(
          child: _inlineText(
            text,
            TextStyle(fontSize: 14, height: 1.45, color: ink),
            accent: accent,
            highlightIndex: index,
            dark: dark,
          ),
        ),
      ],
    );

/// Builds a RichText honouring `==highlight==` (cycling colours, like the web)
/// and `**bold**` (blue term).
Widget _inlineText(String raw, TextStyle base,
    {Color accent = const Color(0xFF2563EB),
    int highlightIndex = 0,
    bool dark = false}) {
  final runs = parseInline(raw);
  final palette = <Color>[accent, ..._kHighlightColors];
  final boldColor = dark ? const Color(0xFFFF8A80) : const Color(0xFF1D4ED8);
  final hlText = dark ? const Color(0xFFF8FBFF) : const Color(0xFF334155);
  final children = <TextSpan>[];
  var markIndex = 0;
  for (final r in runs) {
    if (r.highlight) {
      final col = palette[(highlightIndex + markIndex) % palette.length];
      markIndex++;
      children.add(TextSpan(
        text: r.text,
        style: base.copyWith(
          color: hlText,
          fontWeight: FontWeight.w600,
          background: Paint()..color = col.withValues(alpha: dark ? 0.34 : 0.23),
        ),
      ));
    } else if (r.bold) {
      children.add(TextSpan(
        text: r.text,
        style: base.copyWith(fontWeight: FontWeight.w800, color: boldColor),
      ));
    } else {
      children.add(TextSpan(text: r.text, style: base));
    }
  }
  return RichText(text: TextSpan(style: base, children: children));
}

class _SectionCard extends StatelessWidget {
  final NoteSection section;
  final int index;
  final Color ink;
  final Color muted;
  final bool dark;
  const _SectionCard(
      {required this.section,
      required this.index,
      required this.ink,
      required this.muted,
      required this.dark});

  @override
  Widget build(BuildContext context) {
    final accent =
        _parseHex(section.accentColor) ?? _kPalette[index % _kPalette.length];
    final surface = dark ? const Color(0xFF1C1B16) : Colors.white;
    final cornerTint =
        Color.alphaBlend(accent.withValues(alpha: dark ? 0.22 : 0.13), surface);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [cornerTint, surface],
          stops: const [0.0, 0.62],
        ),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: accent.withValues(alpha: 0.30)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (section.heading.isNotEmpty)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: accent.withValues(alpha: 0.094),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: accent.withValues(alpha: 0.22)),
              ),
              child: Text(section.heading.toUpperCase(),
                  style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.5,
                      color: dark ? accent : _darken(accent))),
            ),
          if (section.bullets.isNotEmpty) const SizedBox(height: 8),
          for (var i = 0; i < section.bullets.length; i++)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: _bullet(section.bullets[i], ink, accent,
                  index: i, dark: dark),
            ),
          if (section.callout.isNotEmpty) _callout(accent),
        ],
      ),
    );
  }

  Widget _callout(Color accent) {
    final trap = RegExp(r'^\[?\s*(exam\s*trap|trap|warning)\s*\]?\s*[:-]?\s*',
        caseSensitive: false);
    final isTrap = trap.hasMatch(section.callout);
    final text =
        isTrap ? section.callout.replaceFirst(trap, '') : section.callout;
    return Container(
      margin: const EdgeInsets.only(top: 6),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color:
            dark ? Colors.white.withValues(alpha: 0.05) : const Color(0xFFFFFBEB),
        borderRadius: BorderRadius.circular(11),
        border: Border.all(color: accent.withValues(alpha: 0.8)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('⚡', style: TextStyle(fontSize: 15.5)),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (isTrap) ...[
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: const Color(0xFFDC2626)
                          .withValues(alpha: dark ? 0.18 : 0.12),
                      borderRadius: BorderRadius.circular(99),
                      border: Border.all(
                          color: const Color(0xFFDC2626).withValues(alpha: 0.30)),
                    ),
                    child: Text('EXAM TRAP',
                        style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.6,
                            color: dark
                                ? const Color(0xFFFCA5A5)
                                : const Color(0xFFDC2626))),
                  ),
                  const SizedBox(height: 5),
                ],
                _inlineText(
                  text,
                  TextStyle(fontSize: 13, height: 1.42, color: ink),
                  accent: accent,
                  highlightIndex: index,
                  dark: dark,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Color _darken(Color c) {
    final hsl = HSLColor.fromColor(c);
    return hsl.withLightness((hsl.lightness * 0.55).clamp(0.0, 1.0)).toColor();
  }
}

class _DotGridPainter extends CustomPainter {
  final Color dot;
  _DotGridPainter(this.dot);
  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()..color = dot;
    const step = 18.0;
    for (var y = 10.0; y < size.height; y += step) {
      for (var x = 10.0; x < size.width; x += step) {
        canvas.drawCircle(Offset(x, y), 1.1, p);
      }
    }
  }

  @override
  bool shouldRepaint(_DotGridPainter old) => old.dot != dot;
}
