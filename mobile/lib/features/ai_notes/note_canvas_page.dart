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

/// AI-notes screen — native PencilKit (iOS) canvas + WKWebView note content.
/// Tool strip and header stay in Flutter; everything below is a native platform
/// view so ink is zero-latency and text stays crisp at any zoom level.
class NoteCanvasPage extends ConsumerStatefulWidget {
  final String lessonId;
  const NoteCanvasPage({super.key, required this.lessonId});
  @override
  ConsumerState<NoteCanvasPage> createState() => _NoteCanvasPageState();
}

enum _Tool { pen, highlighter, eraser }

class _NoteCanvasPageState extends ConsumerState<NoteCanvasPage> {
  _Tool _tool = _Tool.pen;
  MethodChannel? _nativeChannel;
  bool _hasInk = false;

  // Pen palette — dark ink colours.
  static const _penPalette = [
    Color(0xFF1F2937), Color(0xFF000000), Color(0xFF2563EB), Color(0xFF1D4ED8),
    Color(0xFF7C3AED), Color(0xFFDB2777), Color(0xFFDC2626), Color(0xFFEA580C),
    Color(0xFF059669), Color(0xFF0D9488), Color(0xFFB45309), Color(0xFF4B5563),
    Color(0xFFFFFFFF),
  ];
  // Highlighter palette — blended over the note paper (multiply / screen).
  static const _hlPalette = [
    Color(0xFFFBBF24), Color(0xFF60A5FA), Color(0xFF34D399), Color(0xFFF472B6),
    Color(0xFFA78BFA), Color(0xFF22D3EE), Color(0xFFFB7185), Color(0xFFFDBA74),
  ];

  List<Color> _penFavs = const [
    Color(0xFF1F2937),
    Color(0xFF2563EB),
    Color(0xFFDC2626),
  ];
  List<Color> _hlFavs = const [
    Color(0xFFFBBF24),
    Color(0xFF60A5FA),
    Color(0xFF34D399),
  ];
  int _penSel = 0;
  int _hlSel = 0;
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

  static const _toolsKey = 'lms.inktools.v4';
  String get _iosInkKey => 'lms.pkink.${widget.lessonId}';
  String get _androidInkKey => 'lms.ink.${widget.lessonId}';

  @override
  void initState() {
    super.initState();
    _loadTools();
  }

  void _selectFav(int i) {
    setState(() {
      if (_tool == _Tool.highlighter) {
        _hlSel = i;
      } else {
        _penSel = i;
      }
    });
    _saveTools();
    _syncTool();
  }

  void _setColor(Color color) {
    setState(() {
      if (_tool == _Tool.highlighter) {
        _hlFavs = [..._hlFavs]..[_hlSel] = color;
      } else {
        _penFavs = [..._penFavs]..[_penSel] = color;
      }
    });
    _saveTools();
    _syncTool();
  }

  void _selectSize(int i) {
    setState(() {
      switch (_tool) {
        case _Tool.pen:        _penSizeSel = i;
        case _Tool.highlighter: _hlSizeSel = i;
        case _Tool.eraser:     _erSizeSel = i;
      }
    });
    _saveTools();
    _syncTool();
  }

  void _setSizeValue(double v) {
    setState(() => _sizes[_sizeSel] = v);
    _saveTools();
    _syncTool();
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

  // ---- Native canvas ----

  void _onViewCreated(int id, NoteDoc note, bool dark) {
    final ch = MethodChannel('app.xyndrome.lk/note_canvas_$id');
    ch.setMethodCallHandler(_onNativeCall);
    setState(() => _nativeChannel = ch);
    _initNativeCanvas(ch, note, dark);
  }

  Future<void> _initNativeCanvas(MethodChannel ch, NoteDoc note, bool dark) async {
    await ch.invokeMethod('loadHTML', {'html': _buildNoteHtml(note, dark)});
    _syncToolOn(ch);
    final prefs = await SharedPreferences.getInstance();
    if (defaultTargetPlatform == TargetPlatform.iOS) {
      final b64 = prefs.getString(_iosInkKey);
      if (b64 != null && b64.isNotEmpty) {
        final bytes = Uint8List.fromList(base64.decode(b64));
        await ch.invokeMethod('loadInk', bytes);
        if (mounted) setState(() => _hasInk = true);
      }
    } else {
      final json = prefs.getString(_androidInkKey);
      if (json != null && json.isNotEmpty && json != '[]') {
        await ch.invokeMethod('loadInk', json);
        if (mounted) setState(() => _hasInk = true);
      }
    }
  }

  Future<dynamic> _onNativeCall(MethodCall call) async {
    if (call.method != 'onInkChanged') return;
    final prefs = await SharedPreferences.getInstance();
    if (defaultTargetPlatform == TargetPlatform.iOS) {
      final bytes = call.arguments as Uint8List;
      final hasContent = bytes.isNotEmpty;
      if (mounted) setState(() => _hasInk = hasContent);
      await prefs.setString(_iosInkKey, hasContent ? base64.encode(bytes) : '');
    } else {
      final json = call.arguments as String;
      final hasContent = json.isNotEmpty && json != '[]';
      if (mounted) setState(() => _hasInk = hasContent);
      await prefs.setString(_androidInkKey, json);
    }
  }

  void _syncTool() => _syncToolOn(_nativeChannel);

  void _syncToolOn(MethodChannel? ch) {
    ch?.invokeMethod('setTool', {
      'tool': _tool.name,
      'colorARGB': _activeColor.toARGB32(),
      'width': _activeSize,
    });
  }

  void _undoNative() => _nativeChannel?.invokeMethod('undo');

  void _clearNative() {
    setState(() => _hasInk = false);
    _nativeChannel?.invokeMethod('clear');
  }

  // ---- Build ----

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
                    ? LockedView(title: 'Lesson locked', reason: note.lockReason)
                    : note.isEmpty
                        ? _emptyNote(c)
                        : _nativeCanvas(note, dark),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _nativeCanvas(NoteDoc note, bool dark) {
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
    return AndroidView(
      viewType: viewType,
      onPlatformViewCreated: (id) => _onViewCreated(id, note, dark),
      gestureRecognizers: gr,
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
                    _toolBtn(c, Icons.edit_outlined, _tool == _Tool.pen, () {
                      setState(() => _tool = _Tool.pen);
                      _syncTool();
                    }),
                    const SizedBox(width: 6),
                    _toolBtn(c, Icons.brush_outlined, _tool == _Tool.highlighter, () {
                      setState(() => _tool = _Tool.highlighter);
                      _syncTool();
                    }),
                    const SizedBox(width: 6),
                    _toolBtn(c, Icons.cleaning_services_outlined, _tool == _Tool.eraser, () {
                      setState(() => _tool = _Tool.eraser);
                      _syncTool();
                    }),
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
                _nativeChannel != null ? _undoNative : null),
            const SizedBox(width: 6),
            _toolBtn(c, Icons.delete_outline_rounded, false,
                (_nativeChannel != null && _hasInk) ? _clearNative : null),
          ],
        ),
      );

  Widget _sep(AppColors c) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8),
        child: Container(width: 1, height: 24, color: c.line),
      );

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
          border: Border.all(color: on ? c.inkStrong : c.line, width: on ? 2.5 : 1),
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
                        fontSize: 16, fontWeight: FontWeight.w800, color: c.inkStrong)),
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

  // ---- HTML generator ----

  static const _htmlPalette = [
    '#2563EB', '#DC2626', '#0EA5E9', '#D97706', '#7C3AED', '#60A5FA',
    '#DB2777', '#EA580C', '#16A34A', '#CA8A04', '#A7D8FF', '#FFE082',
    '#FF8A80', '#80CBC4', '#CE93D8', '#FFCC80', '#F48FB1', '#80DEEA',
    '#A5D6A7', '#FFE0B2',
  ];

  static const _htmlHighlightColors = [
    '#FBBF24', '#60A5FA', '#34D399', '#F472B6',
    '#A78BFA', '#22D3EE', '#FB7185', '#FDBA74',
  ];

  String _buildNoteHtml(NoteDoc note, bool dark) {
    final paper = dark ? '#17150F' : '#FAF3E6';
    final dot = dark ? 'rgba(255,255,255,0.05)' : '#E7DABF';
    final fg = dark ? '#DCE6FF' : '#322F29';
    final muted = dark ? '#9AA4BF' : '#6B6155';
    final border = dark ? 'rgba(255,255,255,0.12)' : '#ECE0C6';
    final kpBg = dark ? 'rgba(255,255,255,0.03)' : '#FFFDF6';
    final sumBg = dark ? '#12233A' : '#ECF2FD';
    final sumBorder = dark ? 'rgba(255,255,255,0.12)' : '#CFE0F8';

    final css = '''
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,'Helvetica Neue',sans-serif;font-size:16px;line-height:1.6;background:$paper;color:$fg;padding:12px 10px 80px;min-height:100vh;background-image:radial-gradient(circle,$dot 1.1px,transparent 1.1px);background-size:18px 18px}
.w{border:1px solid $border;border-radius:16px;background:$paper;padding:12px 14px 24px;position:relative}
.title{text-align:center;border:1px solid $border;border-radius:12px;padding:12px;font-size:22px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;margin-bottom:6px}
.sub{text-align:center;font-size:14px;color:$muted;margin-bottom:14px}
.sec{border-radius:12px;padding:12px;margin-bottom:12px}
.htag{display:inline-block;font-size:12px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;padding:4px 10px;border-radius:8px;margin-bottom:8px}
.bul{display:flex;align-items:flex-start;margin-bottom:6px}
.dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;margin-top:8px;margin-right:9px}
.bt{font-size:14px;line-height:1.45;flex:1}
.callout{margin-top:6px;padding:10px;border-radius:10px}
.exbadge{display:inline-block;font-size:11px;font-weight:800;letter-spacing:.6px;padding:2px 8px;border-radius:99px;margin-bottom:5px}
.kp{padding:14px;border:1px solid $border;border-radius:12px;margin-bottom:12px;background:$kpBg}
.kphd{font-size:13px;font-weight:800;letter-spacing:.6px;color:$fg;margin-bottom:8px}
.sum{padding:12px;border-radius:12px;background:$sumBg;border:1px solid $sumBorder;font-size:14px;line-height:1.4;font-weight:600;color:$fg}
mark{border-radius:3px;padding:1px 2px}
''';

    final sb = StringBuffer()
      ..write('<!DOCTYPE html><html><head>')
      ..write('<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=5,user-scalable=yes">')
      ..write('<style>$css</style>')
      ..write('</head><body><div class="w">');

    sb.write('<div class="title">${_esc(note.title)}</div>');
    if (note.subtitle.isNotEmpty) {
      sb.write('<div class="sub">${_esc(note.subtitle)}</div>');
    }

    for (var i = 0; i < note.sections.length; i++) {
      _writeSectionHtml(sb, note.sections[i], i, dark, fg);
    }

    if (note.keyPoints.isNotEmpty) {
      sb.write('<div class="kp"><div class="kphd">KEY POINTS</div>');
      for (var i = 0; i < note.keyPoints.length; i++) {
        final accent = _htmlPalette[i % _htmlPalette.length];
        sb.write('<div class="bul">');
        sb.write('<div class="dot" style="background:$accent"></div>');
        sb.write('<div class="bt">');
        _writeInlineHtml(sb, note.keyPoints[i], accent, i, dark);
        sb.write('</div></div>');
      }
      sb.write('</div>');
    }

    if (note.summaryBox.isNotEmpty) {
      sb.write('<div class="sum">');
      _writeInlineHtml(sb, note.summaryBox, '#0EA5E9', 0, dark);
      sb.write('</div>');
    }

    sb.write('</div></body></html>');
    return sb.toString();
  }

  void _writeSectionHtml(
      StringBuffer sb, NoteSection s, int i, bool dark, String fg) {
    final accent = _validHex(s.accentColor) ?? _htmlPalette[i % _htmlPalette.length];
    final surface = dark ? '#1C1B16' : '#FFFFFF';
    final cornerTint = _blendHex(accent, dark ? 0.22 : 0.13, surface);
    final borderColor = _alphaHex(accent, 0.30);

    sb.write(
        '<div class="sec" style="background:linear-gradient(135deg,$cornerTint 0%,$surface 62%);border:1px solid $borderColor">');

    if (s.heading.isNotEmpty) {
      final hc = dark ? accent : _darkenHex(accent);
      final hbg = _alphaHex(accent, 0.094);
      final hb = _alphaHex(accent, 0.22);
      sb.write(
          '<div class="htag" style="background:$hbg;border:1px solid $hb;color:$hc">'
          '${_esc(s.heading)}'
          '</div>');
    }

    for (var j = 0; j < s.bullets.length; j++) {
      sb.write('<div class="bul">');
      sb.write('<div class="dot" style="background:$accent"></div>');
      sb.write('<div class="bt">');
      _writeInlineHtml(sb, s.bullets[j], accent, j, dark);
      sb.write('</div></div>');
    }

    if (s.callout.isNotEmpty) {
      _writeCalloutHtml(sb, s.callout, accent, i, dark, fg);
    }

    sb.write('</div>');
  }

  void _writeCalloutHtml(
      StringBuffer sb, String callout, String accent, int i, bool dark, String fg) {
    final trapRx = RegExp(
        r'^\[?\s*(exam\s*trap|trap|warning)\s*\]?\s*[:-]?\s*',
        caseSensitive: false);
    final isTrap = trapRx.hasMatch(callout);
    final text = isTrap ? callout.replaceFirst(trapRx, '') : callout;

    final cbg = dark ? 'rgba(255,255,255,0.05)' : '#FFFBEB';
    final border = _alphaHex(accent, 0.8);
    sb.write(
        '<div class="callout" style="background:$cbg;border:1px solid $border">');
    sb.write('<span>⚡</span>&nbsp;');

    if (isTrap) {
      final trapBg = dark ? 'rgba(220,38,38,0.18)' : 'rgba(220,38,38,0.12)';
      final trapBorder = 'rgba(220,38,38,0.30)';
      final trapColor = dark ? '#FCA5A5' : '#DC2626';
      sb.write(
          '<div class="exbadge" style="background:$trapBg;border:1px solid $trapBorder;color:$trapColor">EXAM TRAP</div>');
    }

    sb.write('<div style="font-size:13px;line-height:1.42;color:$fg">');
    _writeInlineHtml(sb, text, accent, i, dark);
    sb.write('</div></div>');
  }

  void _writeInlineHtml(
      StringBuffer sb, String raw, String accent, int baseIdx, bool dark) {
    final palette = [accent, ..._htmlHighlightColors];
    final hlText = dark ? '#F8FBFF' : '#334155';
    final boldColor = dark ? '#FF8A80' : '#1D4ED8';
    var markIdx = 0;
    for (final r in parseInline(raw)) {
      if (r.highlight) {
        final col = palette[(baseIdx + markIdx) % palette.length];
        final bg = _alphaHex(col, dark ? 0.34 : 0.23);
        markIdx++;
        sb.write('<mark style="background:$bg;color:$hlText;font-weight:600">'
            '${_esc(r.text)}</mark>');
      } else if (r.bold) {
        sb.write('<strong style="font-weight:800;color:$boldColor">'
            '${_esc(r.text)}</strong>');
      } else {
        sb.write(_esc(r.text));
      }
    }
  }
}

// ---- HTML colour helpers ----

String _esc(String s) => s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

List<int>? _hexToRgb(String hex) {
  hex = hex.replaceAll('#', '').trim();
  if (hex.length == 8) hex = hex.substring(2);
  if (hex.length != 6) return null;
  try {
    return [
      int.parse(hex.substring(0, 2), radix: 16),
      int.parse(hex.substring(2, 4), radix: 16),
      int.parse(hex.substring(4, 6), radix: 16),
    ];
  } catch (_) {
    return null;
  }
}

String _hex2(int v) => v.clamp(0, 255).toRadixString(16).padLeft(2, '0');

String? _validHex(String? hex) {
  if (hex == null || hex.trim().isEmpty) return null;
  final rgb = _hexToRgb(hex);
  if (rgb == null) return null;
  return '#${_hex2(rgb[0])}${_hex2(rgb[1])}${_hex2(rgb[2])}';
}

String _alphaHex(String hex, double alpha) {
  final rgb = _hexToRgb(hex);
  if (rgb == null) return 'rgba(0,0,0,$alpha)';
  final a = (alpha * 100).round() / 100;
  return 'rgba(${rgb[0]},${rgb[1]},${rgb[2]},$a)';
}

String _darkenHex(String hex) {
  final rgb = _hexToRgb(hex);
  if (rgb == null) return hex;
  final r = (rgb[0] * 0.55).round();
  final g = (rgb[1] * 0.55).round();
  final b = (rgb[2] * 0.55).round();
  return '#${_hex2(r)}${_hex2(g)}${_hex2(b)}';
}

String _blendHex(String accent, double alpha, String surface) {
  final a = _hexToRgb(accent);
  final s = _hexToRgb(surface);
  if (a == null || s == null) return surface;
  final r = (a[0] * alpha + s[0] * (1 - alpha)).round();
  final g = (a[1] * alpha + s[1] * (1 - alpha)).round();
  final b = (a[2] * alpha + s[2] * (1 - alpha)).round();
  return '#${_hex2(r)}${_hex2(g)}${_hex2(b)}';
}
