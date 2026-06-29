import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../theme/tokens.dart';
import '../../widgets/locked_view.dart';
import '../../widgets/skeletons.dart';
import '../bookmarks/bookmark_button.dart';
import 'note_models.dart';
import 'notes_repository.dart';

/// AI-notes canvas page.
///
/// Flutter owns the header (back + title + bookmark) and the tool strip
/// (pen / highlighter / eraser | colour swatches | size slots | undo | clear).
/// The note content and ink layer are a native iOS UiKitView backed by
/// NoteCanvasView.swift (NoteRendererView + PKCanvasView — zero WKWebView).
class NoteCanvasPage extends ConsumerStatefulWidget {
  final String lessonId;
  const NoteCanvasPage({super.key, required this.lessonId});
  @override
  ConsumerState<NoteCanvasPage> createState() => _NoteCanvasPageState();
}

enum _Tool { pen, highlighter, eraser }

class _NoteCanvasPageState extends ConsumerState<NoteCanvasPage> {
  _Tool _tool = _Tool.pen;
  MethodChannel? _ch;
  bool _hasInk = false;

  // ── Colour palettes ──────────────────────────────────────────────────────────
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

  List<Color> _penFavs = const [
    Color(0xFF1F2937), Color(0xFF2563EB), Color(0xFFDC2626),
  ];
  List<Color> _hlFavs = const [
    Color(0xFFFBBF24), Color(0xFF60A5FA), Color(0xFF34D399),
  ];
  int _penSel = 0, _hlSel = 0;
  List<double> _penSizes = [2.0, 4.5, 8.0];
  List<double> _hlSizes  = [12.0, 20.0, 30.0];
  List<double> _erSizes  = [16.0, 28.0, 44.0];
  int _penSizeSel = 1, _hlSizeSel = 1, _erSizeSel = 1;

  List<Color> get _favs   => _tool == _Tool.highlighter ? _hlFavs : _penFavs;
  int         get _sel    => _tool == _Tool.highlighter ? _hlSel  : _penSel;
  Color       get _color  => _favs[_sel];

  List<double> get _sizes => switch (_tool) {
    _Tool.pen         => _penSizes,
    _Tool.highlighter => _hlSizes,
    _Tool.eraser      => _erSizes,
  };
  int get _sizeSel => switch (_tool) {
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

  static const _toolsKey = 'lms.inktools.v4';
  String get _inkKey => 'lms.pkink.${widget.lessonId}';

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  @override
  void initState() {
    super.initState();
    _loadTools();
  }

  // ── Tool preference persistence ──────────────────────────────────────────────

  Future<void> _loadTools() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_toolsKey);
    if (raw == null) return;
    try {
      final m = jsonDecode(raw) as Map<String, dynamic>;
      List<Color> favs(String k, List<Color> fb) {
        final l = m[k];
        if (l is! List || l.length != 3) return fb;
        return [for (final v in l) Color((v as num).toInt())];
      }
      List<double> szs(String k, List<double> fb) {
        final l = m[k];
        if (l is! List || l.length != 3) return fb;
        return [for (final v in l) (v as num).toDouble()];
      }
      setState(() {
        _penFavs    = favs('pf', _penFavs);
        _hlFavs     = favs('hf', _hlFavs);
        _penSel     = (m['ps'] as num?)?.toInt() ?? 0;
        _hlSel      = (m['hs'] as num?)?.toInt() ?? 0;
        _penSizes   = szs('pz', _penSizes);
        _hlSizes    = szs('hz', _hlSizes);
        _erSizes    = szs('ez', _erSizes);
        _penSizeSel = (m['pzs'] as num?)?.toInt() ?? 1;
        _hlSizeSel  = (m['hzs'] as num?)?.toInt() ?? 1;
        _erSizeSel  = (m['ezs'] as num?)?.toInt() ?? 1;
      });
    } catch (_) {}
  }

  Future<void> _saveTools() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_toolsKey, jsonEncode({
      'pf':  [for (final c in _penFavs) c.toARGB32()],
      'hf':  [for (final c in _hlFavs)  c.toARGB32()],
      'ps':  _penSel,  'hs': _hlSel,
      'pz':  _penSizes, 'hz': _hlSizes, 'ez': _erSizes,
      'pzs': _penSizeSel, 'hzs': _hlSizeSel, 'ezs': _erSizeSel,
    }));
  }

  // ── Colour / size setters ────────────────────────────────────────────────────

  void _selectFav(int i) {
    setState(() => _tool == _Tool.highlighter ? _hlSel = i : _penSel = i);
    _saveTools(); _syncTool();
  }

  void _setColor(Color color) {
    setState(() {
      if (_tool == _Tool.highlighter) {
        _hlFavs = [..._hlFavs]..[_hlSel] = color;
      } else {
        _penFavs = [..._penFavs]..[_penSel] = color;
      }
    });
    _saveTools(); _syncTool();
  }

  void _selectSize(int i) {
    setState(() {
      switch (_tool) {
        case _Tool.pen:         _penSizeSel = i;
        case _Tool.highlighter: _hlSizeSel  = i;
        case _Tool.eraser:      _erSizeSel  = i;
      }
    });
    _saveTools(); _syncTool();
  }

  void _setSizeValue(double v) {
    setState(() => _sizes[_sizeSel] = v);
    _saveTools(); _syncTool();
  }

  // ── Native canvas channel ────────────────────────────────────────────────────

  void _onViewCreated(int id, NoteDoc note, bool dark) {
    final ch = MethodChannel('app.xyndrome.lk/note_canvas_$id');
    ch.setMethodCallHandler(_onNativeCall);
    setState(() => _ch = ch);
    _initCanvas(ch, note, dark);
  }

  Future<void> _initCanvas(MethodChannel ch, NoteDoc note, bool dark) async {
    await ch.invokeMethod('loadNote', {
      'title':      note.title,
      'subtitle':   note.subtitle,
      'tags':       note.tags,
      'sections':   note.sections.map((s) => {
        'heading':     s.heading,
        'bullets':     s.bullets,
        'accentColor': s.accentColor ?? '',
        'callout':     s.callout,
        'span':        s.span,
      }).toList(),
      'keyPoints':  note.keyPoints,
      'summaryBox': note.summaryBox,
      'dark':       dark,
    });
    _syncToolOn(ch);

    // Restore saved ink from SharedPreferences.
    final prefs = await SharedPreferences.getInstance();
    final b64 = prefs.getString(_inkKey);
    if (b64 != null && b64.isNotEmpty) {
      final bytes = Uint8List.fromList(base64.decode(b64));
      await ch.invokeMethod('loadInk', bytes);
      if (mounted) setState(() => _hasInk = true);
    }
  }

  Future<dynamic> _onNativeCall(MethodCall call) async {
    if (call.method != 'onInkChanged') return;
    final bytes = call.arguments as Uint8List;
    final hasContent = bytes.isNotEmpty;
    if (mounted) setState(() => _hasInk = hasContent);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_inkKey, hasContent ? base64.encode(bytes) : '');
  }

  void _syncTool()            => _syncToolOn(_ch);
  void _undoNative()          => _ch?.invokeMethod('undo');
  void _clearNative() {
    setState(() => _hasInk = false);
    _ch?.invokeMethod('clear');
  }

  void _syncToolOn(MethodChannel? ch) {
    ch?.invokeMethod('setTool', {
      'tool':      _tool.name,
      'colorARGB': _color.toARGB32(),
      'width':     _activeSize,
    });
  }

  // ── Build ────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final c    = context.c;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final note = ref.watch(lessonNoteProvider(widget.lessonId));

    return Scaffold(
      backgroundColor: c.page,
      body: SafeArea(
        child: Column(children: [
          _header(c, note.asData?.value),
          _toolStrip(c),
          Expanded(
            child: note.when(
              loading: () => const NoteSkeleton(),
              error:   (e, _) => _error(c, e),
              data:    (n) => n.locked
                  ? LockedView(title: 'Lesson locked', reason: n.lockReason)
                  : n.isEmpty
                      ? _emptyNote(c)
                      : _canvas(n, dark),
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
      Expanded(
        child: Text(
          (note?.title.trim().isNotEmpty ?? false) ? note!.title : 'Lesson',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: c.inkStrong),
        ),
      ),
      if (note != null && !note.locked && note.noteId > 0)
        BookmarkButton(itemType: 'ai_note', itemId: note.noteId),
    ]),
  );

  // ── Tool strip ───────────────────────────────────────────────────────────────

  Widget _toolStrip(AppColors c) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
    decoration: BoxDecoration(border: Border(bottom: BorderSide(color: c.line))),
    child: Row(children: [
      Expanded(
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(children: [
            _toolBtn(c, Icons.edit_outlined, _tool == _Tool.pen, () {
              setState(() => _tool = _Tool.pen); _syncTool();
            }),
            const SizedBox(width: 6),
            _toolBtn(c, Icons.brush_outlined, _tool == _Tool.highlighter, () {
              setState(() => _tool = _Tool.highlighter); _syncTool();
            }),
            const SizedBox(width: 6),
            _toolBtn(c, Icons.cleaning_services_outlined, _tool == _Tool.eraser, () {
              setState(() => _tool = _Tool.eraser); _syncTool();
            }),
            _sep(c),
            if (_tool != _Tool.eraser) ...[
              for (var i = 0; i < 3; i++) ...[
                _favSlot(c, i), const SizedBox(width: 6),
              ],
              _sep(c),
            ],
            for (var i = 0; i < 3; i++) ...[
              _sizeSlot(c, i), const SizedBox(width: 6),
            ],
          ]),
        ),
      ),
      _sep(c),
      _toolBtn(c, Icons.undo_rounded, false,
          _ch != null ? _undoNative : null),
      const SizedBox(width: 6),
      _toolBtn(c, Icons.delete_outline_rounded, false,
          (_ch != null && _hasInk) ? _clearNative : null),
    ]),
  );

  Widget _sep(AppColors c) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 8),
    child: Container(width: 1, height: 24, color: c.line),
  );

  Widget _favSlot(AppColors c, int i) {
    final isHl  = _tool == _Tool.highlighter;
    final color = _favs[i];
    final on    = _sel == i;
    return GestureDetector(
      onTap: () => on ? _openColorPicker(c) : _selectFav(i),
      child: Container(
        width: 30, height: 30,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: on ? c.inkStrong : c.line, width: on ? 2.5 : 1),
        ),
        child: Container(
          width: 19, height: 19,
          decoration: BoxDecoration(
            color: isHl ? color.withValues(alpha: 0.6) : color,
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
        width: 32, height: 32,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(9),
          color: on ? c.primaryTint : Colors.transparent,
          border: Border.all(color: on ? c.primary : c.line, width: on ? 2 : 1),
        ),
        child: Container(
          width: dot, height: dot,
          decoration: BoxDecoration(
            color: on ? c.primary : c.inkMedium, shape: BoxShape.circle),
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

  // ── Native canvas (UiKitView) ────────────────────────────────────────────────

  Widget _canvas(NoteDoc note, bool dark) {
    const viewType = 'app.xyndrome.lk/note_canvas';
    final gr = <Factory<OneSequenceGestureRecognizer>>{
      Factory<OneSequenceGestureRecognizer>(() => EagerGestureRecognizer()),
    };
    if (defaultTargetPlatform == TargetPlatform.iOS) {
      return UiKitView(
        viewType: viewType,
        onPlatformViewCreated: (id) => _onViewCreated(id, note, dark),
        gestureRecognizers: gr,
      );
    }
    return Center(
      child: Text('AI Notes canvas requires iOS.',
          style: TextStyle(color: context.c.inkSoft, fontSize: 15)),
    );
  }

  // ── Bottom sheets ────────────────────────────────────────────────────────────

  void _openColorPicker(AppColors c) {
    final isHl   = _tool == _Tool.highlighter;
    final palette = isHl ? _hlPalette : _penPalette;
    showModalBottomSheet(
      context: context,
      backgroundColor: c.card,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(22))),
      builder: (_) => StatefulBuilder(builder: (_, setSheet) {
        final active = _color.toARGB32();
        return Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(isHl ? 'Highlighter colour' : 'Pen colour',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: c.inkStrong)),
            const SizedBox(height: 16),
            Wrap(
              spacing: 12, runSpacing: 12,
              children: [
                for (var i = 0; i < palette.length; i++)
                  GestureDetector(
                    onTap: () { _setColor(palette[i]); setSheet(() {}); },
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
              ],
            ),
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
      builder: (_) => StatefulBuilder(builder: (_, setSheet) {
        final (lo, hi) = _sizeRange;
        return Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Text('Size', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: c.inkStrong)),
              const Spacer(),
              Text('${_activeSize.round()}',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: c.inkMedium)),
            ]),
            const SizedBox(height: 14),
            Center(
              child: Container(
                height: _activeSize.clamp(lo, hi), width: 180,
                decoration: BoxDecoration(
                  color: _tool == _Tool.eraser
                      ? c.inkMuted
                      : isHl ? _color.withValues(alpha: 0.5) : _color,
                  borderRadius: BorderRadius.circular(40),
                ),
              ),
            ),
            Slider(
              min: lo, max: hi,
              value: _activeSize.clamp(lo, hi),
              onChanged: (v) { _setSizeValue(v); setSheet(() {}); },
            ),
          ]),
        );
      }),
    );
  }

  // ── Error / empty states ─────────────────────────────────────────────────────

  Widget _error(AppColors c, Object e) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Text('Could not load this note.\n$e',
          textAlign: TextAlign.center,
          style: TextStyle(color: c.inkSoft, fontSize: 15.5)),
    ),
  );

  Widget _emptyNote(AppColors c) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Icon(Icons.notes_outlined, size: 40, color: c.inkMuted),
        const SizedBox(height: 12),
        Text('No note for this lesson yet.',
            textAlign: TextAlign.center,
            style: TextStyle(color: c.inkSoft, fontSize: 15.5)),
      ]),
    ),
  );
}
