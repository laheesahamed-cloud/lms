import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;
import 'dart:ui' as ui;
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart' show Ticker;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../data/api_client.dart';
import '../../state/auth_controller.dart';
import '../../theme/tokens.dart';
import '../../widgets/content_image.dart';
import '../../widgets/locked_view.dart';
import '../../widgets/skeletons.dart';
import '../bookmarks/bookmark_button.dart';
import 'note_models.dart';
import 'notes_repository.dart';

/// Full AI-notes screen (100% Flutter).
/// Fixed chrome (header + tool strip) sits OUTSIDE the canvas; the warm "canvas"
/// (note widgets + ink) lives inside a manually-controlled Transform so zoom is
/// vector-crisp at every level and the header never moves. A single top-level
/// Listener routes pointers: Apple Pencil draws, fingers pan/zoom — they can
/// never happen at once, so the ink never drifts off the pen tip.
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
  // The zoom level this stroke was DRAWN at. Captured once at pen-down and never
  // changed, so the stroke's resampled/smoothed curve is identical no matter what
  // zoom you're currently viewing/committing at — existing strokes never re-shift
  // when a new one commits at a different zoom (that was a flicker source), and
  // the quality is continuous across every zoom value (1.0, 1.1, 1.2, …).
  final double scale;

  _Stroke(this.tool, this.color, this.width,
      {this.scale = 1.0, List<Offset>? points, List<double>? pressures})
      : points = points ?? [],
        pressures = pressures ?? [];

  void add(Offset o, double pressure) {
    points.add(o);
    pressures.add(pressure);
  }

  Map<String, dynamic> toJson() => {
        't': tool.index,
        'c': color.toARGB32(),
        'w': width,
        'sc': scale,
        'p': [for (final o in points) [o.dx, o.dy]],
        if (pressures.isNotEmpty) 'pr': pressures,
      };

  factory _Stroke.fromJson(Map<String, dynamic> m) => _Stroke(
        _Tool.values[(m['t'] as num).toInt()],
        Color((m['c'] as num).toInt()),
        (m['w'] as num).toDouble(),
        scale: (m['sc'] as num?)?.toDouble() ?? 1.0,
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

// 1€ (one-euro) filter for 2D pen input. Smooths hand jitter at LOW speed while
// adding almost ZERO lag at WRITING speed: the smoothing cutoff rises with the
// pointer's speed, so fast moves pass through nearly unfiltered (the ink stays on
// the nib) and slow/resting moves are smoothed (no shaky edges). One instance per
// stroke. Operates in document space, before the zoom transform.
class _OneEuro {
  final double minCutoff; // Hz — smoothing floor when still
  final double beta; // how fast the cutoff opens up with speed
  final double dCutoff; // Hz — cutoff for the speed estimate itself
  Offset? _x; // last filtered position
  Offset _dx = Offset.zero; // last filtered speed (doc-px/s)
  Duration? _t;

  _OneEuro({this.minCutoff = 1.0, this.beta = 0.7, this.dCutoff = 1.0});

  static double _alpha(double cutoff, double dt) {
    final tau = 1.0 / (2 * math.pi * cutoff);
    return 1.0 / (1.0 + tau / dt);
  }

  // [x] is in document space; [scale] is the current zoom so the speed→cutoff
  // decision uses ON-SCREEN velocity → the smoothing/lag feel is identical at
  // every zoom level (at 5× a slow document motion is still judged by how fast it
  // actually moves on screen).
  Offset filter(Offset x, Duration t, {double scale = 1.0}) {
    if (_x == null) {
      _x = x;
      _t = t;
      return x;
    }
    var dt = (t - _t!).inMicroseconds / 1e6;
    if (dt <= 0 || dt > 0.1) dt = 1 / 120.0; // guard stale/zero timestamps
    _t = t;

    final dxRaw = (x - _x!) / dt;
    final aD = _alpha(dCutoff, dt);
    _dx = _dx + (dxRaw - _dx) * aD;

    final cutoff = minCutoff + beta * (_dx.distance * scale); // on-screen speed
    final a = _alpha(cutoff, dt);
    final xHat = _x! + (x - _x!) * a;
    _x = xHat;
    return xHat;
  }
}

class _NoteCanvasPageState extends ConsumerState<NoteCanvasPage>
    with SingleTickerProviderStateMixin {
  final List<_Stroke> _strokes = [];
  _Stroke? _active;
  _OneEuro? _euro; // per-stroke input filter (recreated on each pen-down)
  _Tool _tool = _Tool.pen;
  // Repaints the LIVE ink layer while drawing WITHOUT rebuilding anything (no
  // flicker). Bumped on every pointer move + on stroke start/commit so the live
  // layer clears the in-flight stroke the same frame the committed layer adopts it.
  final ValueNotifier<int> _tick = ValueNotifier<int>(0);
  // Persisting re-serializes the whole stroke list, so we don't write on every
  // pen-lift — a burst of strokes is coalesced into one save after writing stops.
  Timer? _saveTimer;
  bool _inkDirty = false;
  // Bumped whenever the COMMITTED ink changes (commit/undo/clear/load). The
  // committed painters repaint via this listenable — no setState, so the note
  // tree is never rebuilt mid-stroke. `_strokes` is mutated in place, so its
  // identity/length can't tell the painter the ink changed.
  final ValueNotifier<int> _inkGen = ValueNotifier<int>(0);

  // ── Zoom / pan (manual transform — replaces InteractiveViewer) ──────────────
  // One top-level Listener routes pointers: Apple Pencil draws, fingers pan/zoom.
  // Because stylus events never feed the matrix and finger events never start a
  // stroke, drawing can NEVER pan the canvas (no gesture-arena race, no drift).
  Matrix4 _matrix = Matrix4.identity();
  Matrix4 _invMatrix = Matrix4.identity(); // cached inverse for screen→doc mapping
  // Bumped to rebuild ONLY the Transform subtree on pan/zoom (the painters and
  // note tree are passed as a const `child` and are not rebuilt).
  final ValueNotifier<int> _xform = ValueNotifier<int>(0);
  Size _viewport = Size.zero; // from LayoutBuilder
  double _contentH = 0; // measured paper height (document space)
  Size _measuredAt = Size.zero; // viewport size at last measure (re-measure on rotate)
  final GlobalKey _paperKey = GlobalKey();
  // Active finger contacts (global/viewport coords). Stylus never appears here.
  final Map<int, Offset> _touches = {};
  Matrix4 _startMatrix = Matrix4.identity();
  Offset _startFocal = Offset.zero;
  double _startDist = 1.0;

  // ── Inertial fling (native momentum scroll after a flick) ───────────────────
  // A single-finger pan tracks velocity; on lift, the canvas keeps gliding with
  // iOS-style exponential deceleration until it slows below a threshold or hits a
  // bound. Any new touch or pen-down cancels it.
  VelocityTracker? _vt;
  Ticker? _fling;
  Offset _flingVel = Offset.zero; // screen px/s
  Duration? _flingPrev;
  static const double _flingDecel = 2.6; // higher = stops sooner (iOS ≈ 2.0)

  // ── Committed-ink picture cache (MECHANISM: replay, not re-run) ──────────────
  // All committed pen / highlighter strokes are recorded once into a vector
  // ui.Picture on commit/undo/clear. Replaying a Picture under the zoom Transform
  // re-tessellates it at screen resolution — crisp at EVERY zoom level — while
  // costing only a display-list replay (no per-frame Dart stroke loop), so zoom
  // and writing stay lag-free even with hundreds of strokes. The live in-flight
  // stroke draws on its own cheap layer; the eraser (which must cut committed ink
  // live) falls back to the direct loop only while a cut is in progress.
  ui.Picture? _penPic;
  ui.Picture? _hlPic;
  Size _picSize = Size.zero;
  bool _picDark = false;
  int _picInkGen = -1; // committed-ink generation baked into the current pictures
  bool _curDark = false; // dark mode from the last build (for off-build refreshes)
  Size _curSize = Size.zero; // content size from the last build

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

  // The signed-in user's id, captured once on entry. Ink is namespaced by user
  // so a different account on the same device never sees the previous user's
  // strokes — each user's drawings are kept and restored under their own key.
  String _uid = 'anon';
  String get _inkKey => 'lms.ink.$_uid.${widget.lessonId}';
  static const _toolsKey = 'lms.inktools.v4';

  // ── Lesson completion ────────────────────────────────────────────────────────
  bool _lessonCompleted = false;
  bool _completionBusy = false;

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

  Future<void> _markComplete() async {
    if (_completionBusy || _lessonCompleted) return;
    setState(() => _completionBusy = true);
    try {
      await markLessonComplete(ref.read(apiClientProvider), widget.lessonId);
      if (mounted) {
        setState(() { _lessonCompleted = true; _completionBusy = false; });
        // Invalidate the notes list so the green tick shows when the user pops back.
        ref.invalidate(notesListProvider);
      }
    } catch (_) {
      if (mounted) setState(() => _completionBusy = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not mark lesson complete'), duration: Duration(seconds: 2)),
        );
      }
    }
  }

  @override
  void initState() {
    super.initState();
    _uid = ref.read(authControllerProvider).user?.id ?? 'anon';
    _loadInk();
    _loadTools();
  }

  @override
  void dispose() {
    _saveTimer?.cancel();
    if (_inkDirty) _saveInk(); // flush any pending ink before leaving
    _tick.dispose();
    _inkGen.dispose();
    _xform.dispose();
    _stopFling();
    _fling?.dispose();
    _penPic?.dispose();
    _hlPic?.dispose();
    super.dispose();
  }

  // Record all committed strokes into vector pictures (pen layer + highlighter
  // layer). Called only when the committed set changes — commit/undo/clear/load —
  // or when dark mode / content size changes, NOT per zoom frame and NOT per draw
  // move. The painters then just replay these.
  void _rebuildPics(bool dark, Size size) {
    // Each stroke carries its own draw-time scale, so the baked curve is identical
    // regardless of the current zoom → existing strokes never re-shift on commit.
    final pen = ui.PictureRecorder();
    _paintPenLayer(Canvas(pen), size, _strokes, null, dark);
    final hl = ui.PictureRecorder();
    _paintHighlighterLayer(Canvas(hl), size, _strokes, null, dark);
    _penPic?.dispose();
    _hlPic?.dispose();
    _penPic = pen.endRecording();
    _hlPic = hl.endRecording();
    _picDark = dark;
    _picSize = size;
    _picInkGen = _inkGen.value;
  }

  // Rebuild only if the cached pictures are stale (set changed, dark/size flip).
  // Called from build, where the content size and dark mode are known.
  void _ensurePics(bool dark, Size size) {
    _curDark = dark;
    _curSize = size;
    if (_penPic == null ||
        _picInkGen != _inkGen.value ||
        _picDark != dark ||
        _picSize != size) {
      _rebuildPics(dark, size);
    }
  }

  // Rebuild immediately using the last-known build params — for commit/undo/clear,
  // which advance _inkGen WITHOUT a widget rebuild (so build's _ensurePics won't
  // run). Safe only after the first build has supplied a content size.
  void _refreshPics() {
    if (_curSize.isEmpty) return; // first build hasn't run yet → it will build them
    _rebuildPics(_curDark, _curSize);
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
        _strokes.addAll(list);
        _inkGen.value++; // repaint committed layers
        setState(() {}); // refresh undo/clear enabled state in the toolbar
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

  // Screen (viewport) point → document (canvas) point. The top-level Listener is
  // OUTSIDE the Transform, so `localPosition` is in viewport space; we invert the
  // current matrix to land the stroke in document space (zoom-independent, so it
  // stays glued to the pen tip and persists correctly).
  Offset _toDoc(Offset viewportPt) =>
      MatrixUtils.transformPoint(_invMatrix, viewportPt);

  // ── Pointer routing — ONE listener, pencil vs finger by kind ────────────────
  void _onPointerDown(PointerDownEvent e) {
    _stopFling(); // any new contact (or the pen) cancels an in-flight glide
    if (e.kind == PointerDeviceKind.stylus) {
      _startStroke(e);
      return;
    }
    if (_active != null) return; // fingers are inert while the pen is down
    // Local (Listener-space) coords: the Transform's matrix lives in this space,
    // so scale-about-focal pins the real finger centroid (global would be offset
    // by the header/toolbar height above the canvas).
    _touches[e.pointer] = e.localPosition;
    // Track velocity only for a clean single-finger pan; a pinch cancels it.
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
      _extendStroke(e);
      return;
    }
    if (_active != null || !_touches.containsKey(e.pointer)) return;
    _touches[e.pointer] = e.localPosition;
    if (_touches.length == 1) _vt?.addPosition(e.timeStamp, e.localPosition);
    _applyTransform();
  }

  void _onPointerUp(PointerEvent e) {
    if (e.kind == PointerDeviceKind.stylus) {
      _endStroke(commit: true);
      return;
    }
    final wasSinglePan = _touches.length == 1 && _vt != null;
    _touches.remove(e.pointer);
    if (wasSinglePan && _touches.isEmpty) {
      final v = _vt!.getVelocity().pixelsPerSecond; // screen px/s
      _vt = null;
      _startFling(v); // glide on after the flick
    } else {
      _vt = null;
      _snapshotGesture(); // re-baseline so a lifted finger doesn't jump the canvas
    }
  }

  void _onPointerCancel(PointerEvent e) {
    if (e.kind == PointerDeviceKind.stylus) {
      _endStroke(commit: false); // system stole the gesture → discard partial mark
      return;
    }
    _touches.remove(e.pointer);
    _vt = null;
    _snapshotGesture();
  }

  // ── Inertial fling ──────────────────────────────────────────────────────────
  void _startFling(Offset velocity) {
    // Match the single-finger pan's dominant-axis lock so a vertical flick glides
    // straight (no diagonal drift from a small cross-axis component).
    var v = velocity.dx.abs() > velocity.dy.abs()
        ? Offset(velocity.dx, 0)
        : Offset(0, velocity.dy);
    const maxV = 8000.0;
    if (v.distance > maxV) v = v * (maxV / v.distance);
    if (v.distance < 80) return; // too slow → just stop (no fling)
    _flingVel = v;
    _flingPrev = null;
    _fling ??= createTicker(_onFlingTick);
    _fling!.start();
  }

  void _onFlingTick(Duration elapsed) {
    final prev = _flingPrev;
    _flingPrev = elapsed;
    if (prev == null) return; // first frame just seeds the clock
    var dt = (elapsed - prev).inMicroseconds / 1e6;
    if (dt <= 0) return;
    if (dt > 0.05) dt = 0.05; // cap after a stall so we don't jump

    final before = _matrix.getTranslation();
    final delta = _flingVel * dt; // screen-space pan, like a finger drag
    _setMatrix(
        Matrix4.translationValues(delta.dx, delta.dy, 0)..multiply(_matrix));
    final after = _matrix.getTranslation();

    // Kill the velocity component on any axis that hit a clamp bound.
    if ((after.x - before.x).abs() < 0.01) _flingVel = Offset(0, _flingVel.dy);
    if ((after.y - before.y).abs() < 0.01) _flingVel = Offset(_flingVel.dx, 0);

    // iOS-style exponential deceleration.
    _flingVel = _flingVel * math.exp(-_flingDecel * dt);
    if (_flingVel.distance < 30) _stopFling();
  }

  void _stopFling() {
    if (_fling?.isActive ?? false) _fling!.stop();
    _flingPrev = null;
    _flingVel = Offset.zero;
  }

  // ── Stroke handlers (document space) ────────────────────────────────────────
  void _startStroke(PointerDownEvent e) {
    // Lighter filter (less lag), faster speed response → tighter fast-stroke
    // tracking (the part that reads worst at high zoom).
    _euro = _OneEuro(minCutoff: 3.0, beta: 1.4, dCutoff: 1.2);
    final scale = _matrix.getMaxScaleOnAxis();
    final p = _euro!.filter(_toDoc(e.localPosition), e.timeStamp, scale: scale);
    // ZOOM-COMPENSATED WIDTH: store the doc-space width as size ÷ current zoom, so
    // the ON-SCREEN thickness stays constant at the zoom you drew at — write fine
    // detail when zoomed in (thinner doc lines) without changing the pen size.
    // Stored per-stroke, so persistence and any later re-bake keep it fixed (it
    // does NOT change if you later zoom or toggle dark).
    _active = _Stroke(_tool, _activeColor, _activeSize / scale, scale: scale)
      ..add(p, _norm(e));
    // The eraser is the only tool that cuts into COMMITTED ink, so it needs the
    // committed painters wired to repaint live — that needs a one-off rebuild to
    // set the `erasing` flag. Pen/highlighter never setState during a stroke.
    if (_tool == _Tool.eraser) {
      setState(() {});
    } else {
      _tick.value++;
    }
  }

  void _extendStroke(PointerMoveEvent e) {
    final s = _active;
    if (s == null) return;
    // 1€-filter the RAW point first (kills slow-speed jitter with ~zero lag at
    // writing speed), THEN decimate the FILTERED output — never the other way, or
    // the filter's speed estimate starves at slow speed.
    final scale = _matrix.getMaxScaleOnAxis();
    final p = _euro!.filter(_toDoc(e.localPosition), e.timeStamp, scale: scale);
    final last = s.points.last;
    if ((p - last).distance * scale < 0.6) return; // constant on-screen density
    s.add(p, _norm(e));
    _tick.value++; // repaint the live layer only (pen/hl) or live eraser cut
  }

  void _endStroke({required bool commit}) {
    final s = _active;
    if (s == null) return;
    final wasEraser = s.tool == _Tool.eraser;
    _active = null;
    if (commit) {
      _strokes.add(s);
      _inkGen.value++; // advance generation (painters replay next frame)
      _refreshPics(); // rebuild the committed picture NOW (no setState on commit)
      _tick.value++; //  …and the live layer clears it — same frame, no flash
      _scheduleSaveInk();
    } else {
      _tick.value++; // discard: just clear the live layer
    }
    // Eraser: tear down the live-erase wiring. Pen/highlighter: a one-off rebuild
    // ONLY on the first committed stroke, to flip undo/clear from disabled→enabled
    // (no visual change, off the per-move hot path → no flicker).
    if (wasEraser || (commit && _strokes.length == 1)) setState(() {});
  }

  // ── Transform math (finger pan + pinch zoom, clamp scale to [1,5]) ───────────
  void _setMatrix(Matrix4 m) {
    _matrix = _clamp(m);
    _invMatrix = Matrix4.inverted(_matrix);
    _xform.value++; // rebuild only the Transform subtree
  }

  Offset _centroid(List<Offset> p) =>
      p.fold(Offset.zero, (a, b) => a + b) / p.length.toDouble();

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

    var dFocal = focal - _startFocal;
    if (!twoFinger) {
      // Single-finger pan: lock to the dominant axis (no diagonal jitter; matches
      // the old PanAxis.aligned feel). Horizontal slack only exists once zoomed.
      if (dFocal.dx.abs() > dFocal.dy.abs()) {
        dFocal = Offset(dFocal.dx, 0);
      } else {
        dFocal = Offset(0, dFocal.dy);
      }
    }

    // Apply, in screen space, about the focal point: scale-about-focal then pan,
    // composed on top of the gesture-start matrix (no incremental float drift).
    final m = Matrix4.translationValues(focal.dx, focal.dy, 0)
      ..multiply(Matrix4.diagonal3Values(factor, factor, 1))
      ..multiply(Matrix4.translationValues(-focal.dx, -focal.dy, 0))
      ..multiply(Matrix4.translationValues(dFocal.dx, dFocal.dy, 0))
      ..multiply(_startMatrix);
    _setMatrix(m);
  }

  // Clamp translation so content can't be dragged into empty space. Horizontal:
  // centred at 1× (no slack), pannable once wider than the viewport. Vertical:
  // free scroll over the note height with a small overscroll margin.
  Matrix4 _clamp(Matrix4 m) {
    final s = m.getMaxScaleOnAxis();
    final t = m.getTranslation();
    final viewW = _viewport.width, viewH = _viewport.height;
    final contentW = viewW * s; // content width == viewport width, scaled
    final contentH = _contentH * s;
    const vMargin = 48.0;

    double x;
    if (contentW <= viewW) {
      x = (viewW - contentW) / 2; // centre
    } else {
      x = t.x.clamp(viewW - contentW, 0.0);
    }

    double y = t.y;
    if (_contentH > 0) {
      final minY = (contentH <= viewH) ? 0.0 : (viewH - contentH);
      y = t.y.clamp(minY - vMargin, vMargin);
    }
    return m.clone()..setTranslationRaw(x, y, 0);
  }

  // Measure the note's intrinsic height once per viewport size (re-measures on
  // rotation) so the vertical clamp is correct. Until measured, vertical pan is
  // unclamped (guarded in _clamp by _contentH > 0).
  void _maybeMeasure() {
    if (_viewport == _measuredAt) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final h = _paperKey.currentContext?.size?.height;
      if (h != null && h > 0 && h != _contentH) {
        _contentH = h;
        _measuredAt = _viewport;
        _matrix = _clamp(_matrix); // re-clamp with the real height
        _invMatrix = Matrix4.inverted(_matrix);
        // Full rebuild so _ensurePics re-records the committed pictures with the
        // correct content-size bounds (and the Transform picks up the clamp).
        setState(() {});
      } else {
        _measuredAt = _viewport;
      }
    });
  }

  void _undo() {
    if (_strokes.isEmpty) return;
    _strokes.removeLast();
    _inkGen.value++; // repaint committed layers
    setState(() {}); // refresh undo/clear enabled state
    _scheduleSaveInk();
  }

  void _clear() {
    if (_strokes.isEmpty) return;
    _strokes.clear();
    _inkGen.value++;
    setState(() {});
    _scheduleSaveInk();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final noteAsync = ref.watch(lessonNoteProvider(widget.lessonId));
    // Sync completed state from the server response (only once, before user acts).
    ref.listen(lessonNoteProvider(widget.lessonId), (_, next) {
      final note = next.asData?.value;
      if (note != null && note.lessonCompleted && !_lessonCompleted) {
        setState(() => _lessonCompleted = true);
      }
    });
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
            if (note != null && !note.locked && widget.lessonId.isNotEmpty)
              _CompleteButton(
                completed: _lessonCompleted,
                busy: _completionBusy,
                onTap: _markComplete,
                c: c,
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

    return LayoutBuilder(builder: (ctx, cons) {
      _viewport = cons.biggest;
      _maybeMeasure();
      // Content size in document space (width is fixed; height is the measured
      // note height, or the viewport until measured). Drives the committed-ink
      // pictures' bounds and is kept fresh for off-build refreshes.
      final contentSize = Size(
          _viewport.width, _contentH > 0 ? _contentH : _viewport.height);
      _ensurePics(dark, contentSize);

      // Built ONCE per page-build and reused on every pan/zoom tick (passed as
      // the ValueListenableBuilder `child`), so finger gestures only re-evaluate
      // the Transform — never the note tree or the painters.
      final content = OverflowBox(
        alignment: Alignment.topLeft,
        minWidth: 0,
        maxWidth: double.infinity,
        minHeight: 0,
        maxHeight: double.infinity, // let the note be its full intrinsic height
        child: SizedBox(
          width: _viewport.width,
          child: Stack(
            children: [
              // PAPER — the lone non-positioned (sizing) child. NO RepaintBoundary:
              // the highlighter layer above blends (multiply/screen) against it, so
              // they must share one compositing layer. It is memoised via
              // `_noteContent`, so it doesn't rebuild when ink commits anyway.
              KeyedSubtree(key: _paperKey, child: _noteContent(note, dark)),

              // COMMITTED HIGHLIGHTER — replays the cached multiply/screen-blended
              // picture (or live-loops while erasing). No RepaintBoundary: the
              // blend must composite against the paper beneath in the same layer.
              Positioned.fill(
                child: CustomPaint(
                  painter: _InkPainter(
                      highlighter: true,
                      dark: dark,
                      strokes: _strokes,
                      active: erasing ? _active : null,
                      getPicture: () => _hlPic,
                      repaint: _inkGen,
                      eraseRepaint: erasing ? _tick : null),
                ),
              ),

              // COMMITTED PEN + ERASER — replays the cached vector picture, which is
              // re-tessellated crisp under the Transform at every zoom level (a
              // RepaintBoundary would instead cache a bitmap and scale it → blurry).
              // Cheap: a display-list replay, no per-frame stroke loop. Live-loops
              // only while an eraser cut is in flight.
              Positioned.fill(
                child: CustomPaint(
                  painter: _InkPainter(
                      highlighter: false,
                      dark: dark,
                      strokes: _strokes,
                      active: erasing ? _active : null,
                      getPicture: () => _penPic,
                      repaint: _inkGen,
                      eraseRepaint: erasing ? _tick : null),
                ),
              ),

              // LIVE layer — the in-flight pen/highlighter stroke, AND the eraser's
              // brush-size cursor. The ONLY thing that repaints per pointer move, so
              // ink stays glued to the tip. It reads `_active` through a closure so a
              // commit (which nulls _active without setState) clears it next _tick.
              Positioned.fill(
                child: RepaintBoundary(
                  child: CustomPaint(
                    painter: _LivePainter(() => _active,
                        dark: dark, repaint: _tick),
                  ),
                ),
              ),
            ],
          ),
        ),
      );

      return Listener(
        // translucent (not opaque) so taps can still reach note content later.
        behavior: HitTestBehavior.translucent,
        onPointerDown: _onPointerDown,
        onPointerMove: _onPointerMove,
        onPointerUp: _onPointerUp,
        onPointerCancel: _onPointerCancel,
        child: ClipRect(
          child: ValueListenableBuilder<int>(
            valueListenable: _xform,
            child: content,
            builder: (_, _, child) => Transform(
              transform: _matrix,
              alignment: Alignment.topLeft,
              child: child,
            ),
          ),
        ),
      );
    });
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
  // Weighted-neighbour (¼,½,¼) moving-average smoothing — the standard for
  // freehand handwriting. It irons out the hand-tremble jitter that makes fast,
  // curvy writing look rough (a single slow line has little jitter, which is why
  // that already looked clean). Crucially it is STABLE: each point's value depends
  // ONLY on its immediate neighbours, so a point settles ONCE and never moves
  // again as the stroke grows → no per-frame tip flicker (unlike resampling, which
  // repositions points every frame). Applied IDENTICALLY to the live preview and
  // the committed bake → no snap/drift on lift, at any ink size or zoom. The first
  // and last points are anchored, so the tip stays exactly on the pen (no lag).
  canvas.drawPath(_smoothPath(_smoothN(s.points, 2)), paint);
}

// Apply the (¼,½,¼) binomial smoother N times. Interior only; first + last points
// anchored every pass, so the tip never lags and a settled point's value can't
// drift across passes.
List<Offset> _smoothN(List<Offset> pts, int passes) {
  var cur = pts;
  for (var k = 0; k < passes; k++) {
    final n = cur.length;
    if (n < 3) return cur;
    final out = List<Offset>.of(cur); // copy → endpoints carried unchanged
    for (var i = 1; i < n - 1; i++) {
      final a = cur[i - 1], b = cur[i], c = cur[i + 1];
      out[i] = Offset(a.dx * 0.25 + b.dx * 0.5 + c.dx * 0.25,
          a.dy * 0.25 + b.dy * 0.5 + c.dy * 0.25);
    }
    cur = out;
  }
  return cur;
}

// Pen rendering uses the SAME method as the highlighter: one cubic-bézier stroked
// path (Catmull-Rom centreline, round cap + round join, anti-aliased). Width is
// CONSTANT (the selected size) — no pressure. Pressure-driven width was recomputed
// over the whole growing stroke every frame, so the in-flight line kept changing
// thickness as pen force varied → that read as a flickering/pulsing tip. A fixed
// width is rock-steady frame to frame and lump-free by construction.
void _drawPen(Canvas canvas, _Stroke s, Color color) {
  if (s.points.isEmpty) return;
  _drawStroke(canvas, s, _linePaint(color, s.width));
}

// Catmull-Rom → cubic-bézier centreline. The curve passes THROUGH every point
// with C1 (continuous-tangent) joins, so there are no kinks/bumps where segments
// meet — unlike quadratic-through-midpoints, which is only G1 and wiggles on
// noisy input. Emitting real cubicTo commands (not sampled line segments) lets
// the engine tessellate analytically at the current zoom → smooth at EVERY level.
Path _smoothPath(List<Offset> pts) {
  final path = Path()..moveTo(pts.first.dx, pts.first.dy);
  final n = pts.length;
  if (n < 3) {
    for (final o in pts.skip(1)) {
      path.lineTo(o.dx, o.dy);
    }
    return path;
  }
  // CENTRIPETAL Catmull-Rom (alpha = 0.5). Unlike uniform CR (fixed /6 tangents),
  // the tangent magnitude derives from actual knot spacing (dt = |Δp|^0.5), so the
  // curve provably cannot overshoot or self-intersect (Yuksel 2011) — removing the
  // sub-pixel outer-edge bulges uniform CR manufactures on sharp/uneven turns
  // (those are what a 2nd smoothing pass was hiding). Still passes through every
  // knot with C1 joins and emits real cubicTo for analytic tessellation at zoom.
  const alpha = 0.5;
  const eps = 1e-6;
  for (var i = 0; i < n - 1; i++) {
    final p0 = pts[i == 0 ? 0 : i - 1];
    final p1 = pts[i];
    final p2 = pts[i + 1];
    final p3 = pts[i + 2 >= n ? n - 1 : i + 2];

    final t01 = math.pow((p0 - p1).distance, alpha).toDouble() + eps;
    final t12 = math.pow((p1 - p2).distance, alpha).toDouble() + eps;
    final t23 = math.pow((p2 - p3).distance, alpha).toDouble() + eps;

    // Non-uniform CR tangents (Barry–Goldman), converted to Bézier handles (/3).
    final m1 = (p2 - p1) + ((p1 - p0) / t01 - (p2 - p0) / (t01 + t12)) * t12;
    final m2 = (p2 - p1) + ((p3 - p2) / t23 - (p3 - p1) / (t12 + t23)) * t12;
    final c1 = p1 + m1 / 3.0;
    final c2 = p2 - m2 / 3.0;
    path.cubicTo(c1.dx, c1.dy, c2.dx, c2.dy, p2.dx, p2.dy);
  }
  return path;
}

// ── Committed-layer drawing (shared by the picture recorder + eraser fallback) ──

/// Draws the committed HIGHLIGHTER layer: every highlighter (and any eraser cut)
/// inside one multiply/screen-blended layer, so text keeps its colour and only
/// the paper tints (the GoodNotes trick). [active] is a non-null in-flight eraser
/// during a live cut; null when recording the static picture.
void _paintHighlighterLayer(
    Canvas canvas, Size size, List<_Stroke> strokes, _Stroke? active, bool dark) {
  final all = active == null ? strokes : [...strokes, active];
  if (!all.any((s) => s.tool == _Tool.highlighter)) return;
  canvas.saveLayer(Offset.zero & size,
      Paint()..blendMode = dark ? BlendMode.screen : BlendMode.multiply);
  for (final s in all) {
    if (s.points.isEmpty) continue;
    if (s.tool == _Tool.highlighter) {
      _drawStroke(canvas, s, _linePaint(s.color.withValues(alpha: 0.4), s.width));
    } else if (s.tool == _Tool.eraser) {
      _drawStroke(canvas, s, _eraserPaint(s.width));
    }
  }
  canvas.restore();
}

/// Draws the committed PEN + ERASER ink on its own compositing layer, like the
/// highlighter. The layer is only materialised when an ERASER is present, because
/// that is the only case that needs it (BlendMode.clear must cut ONLY the ink, so
/// the paper shows back through). Opaque pen ink composites pixel-identically with
/// or without the layer, so for pen-only notes we skip the offscreen — otherwise a
/// full-note-height saveLayer would be allocated on every zoom frame (jank).
void _paintPenLayer(
    Canvas canvas, Size size, List<_Stroke> strokes, _Stroke? active, bool dark) {
  final all = active == null ? strokes : [...strokes, active];
  final hasPen = all.any((s) => s.tool == _Tool.pen);
  final hasEraser = all.any((s) => s.tool == _Tool.eraser);
  if (!hasPen && !hasEraser) return;
  final isolate = hasEraser;
  if (isolate) canvas.saveLayer(Offset.zero & size, Paint());
  for (final s in all) {
    if (s.points.isEmpty) continue;
    if (s.tool == _Tool.pen) {
      _drawPen(canvas, s, s.color);
    } else if (s.tool == _Tool.eraser) {
      _drawStroke(canvas, s, _eraserPaint(s.width));
    }
  }
  if (isolate) canvas.restore();
}

/// Paints the COMMITTED ink for one layer (pen or highlighter). Default path:
/// replay the cached vector [getPicture] — re-tessellated crisp under the zoom
/// Transform with no per-frame stroke loop (lag-free zoom). While an eraser cut
/// is in flight ([active] != null) it falls back to the live loop so the cut
/// follows the pen, driven by [eraseRepaint].
class _InkPainter extends CustomPainter {
  final bool highlighter;
  final bool dark;
  final List<_Stroke> strokes; // for the eraser fallback only
  final _Stroke? active; // in-flight eraser, or null
  final ui.Picture? Function() getPicture;
  _InkPainter({
    required this.highlighter,
    required this.dark,
    required this.strokes,
    required this.active,
    required this.getPicture,
    required Listenable repaint,
    Listenable? eraseRepaint,
  }) : super(
            repaint: eraseRepaint == null
                ? repaint
                : Listenable.merge([repaint, eraseRepaint]));

  @override
  void paint(Canvas canvas, Size size) {
    if (active == null) {
      final pic = getPicture();
      if (pic != null) canvas.drawPicture(pic);
      return;
    }
    // Live eraser cut: re-run the loop with the in-flight eraser.
    if (highlighter) {
      _paintHighlighterLayer(canvas, size, strokes, active, dark);
    } else {
      _paintPenLayer(canvas, size, strokes, active, dark);
    }
  }

  @override
  bool shouldRepaint(_InkPainter old) =>
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
  // Read through a closure so it always reflects the CURRENT in-flight stroke.
  // On commit, _active is nulled WITHOUT setState; bumping _tick then repaints
  // this layer, the closure returns null, and the live stroke clears the same
  // frame the committed layer adopts it — no double-draw, no flash.
  final _Stroke? Function() getActive;
  final bool dark;
  _LivePainter(this.getActive, {required this.dark, super.repaint});

  @override
  void paint(Canvas canvas, Size size) {
    final s = getActive();
    if (s == null || s.points.isEmpty) return;
    switch (s.tool) {
      case _Tool.pen:
        _drawPen(canvas, s, s.color);
      case _Tool.highlighter:
        // "Wet" preview: a translucent marker while the stroke is in flight.
        // On release it commits to the multiply/screen layer and snaps to the
        // exact GoodNotes look (text crisp underneath).
        _drawStroke(
            canvas, s, _linePaint(s.color.withValues(alpha: 0.4), s.width));
      case _Tool.eraser:
        // Brush cursor — a ringed circle at the tip showing the erase size. The
        // actual cut is done on the committed layers; this is just the indicator.
        final c = s.points.last;
        final r = s.width / 2;
        final tint = dark ? Colors.white : Colors.black;
        canvas.drawCircle(
            c, r, Paint()..color = tint.withValues(alpha: 0.06)); // faint area
        canvas.drawCircle(
            c,
            r,
            Paint()
              ..style = PaintingStyle.stroke
              ..strokeWidth = 1.5
              ..color = tint.withValues(alpha: 0.55)
              ..isAntiAlias = true); // edge ring
    }
  }

  @override
  bool shouldRepaint(_LivePainter old) => true;
}

/// Compact "Mark Complete" / "Done" pill button for the note header.
class _CompleteButton extends StatelessWidget {
  final bool completed;
  final bool busy;
  final VoidCallback onTap;
  final AppColors c;
  const _CompleteButton({required this.completed, required this.busy, required this.onTap, required this.c});

  @override
  Widget build(BuildContext context) {
    final color = completed ? const Color(0xFF10B981) : c.primary;
    return GestureDetector(
      onTap: (completed || busy) ? null : onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 220),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.13),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: color.withValues(alpha: 0.4)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (busy)
              SizedBox(
                width: 13, height: 13,
                child: CircularProgressIndicator(strokeWidth: 1.8, color: color),
              )
            else
              Icon(
                completed ? Icons.check_circle_rounded : Icons.check_circle_outline_rounded,
                size: 15, color: color,
              ),
            const SizedBox(width: 5),
            Text(
              completed ? 'Done' : 'Mark Complete',
              style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: color),
            ),
          ],
        ),
      ),
    );
  }
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

  Widget _summary(Color ink) {
    const cyan = Color(0xFF0891B2);
    final labelColor = dark
        ? const Color(0xFFB4C6FF)
        : const Color(0xFF1D4ED8).withValues(alpha: 0.65);
    // Web SummaryFragments split: on "·", "|", or "→ " (arrow + space).
    final frags = note.summaryBox
        .split(RegExp(r'\s*[·|]\s*|\s*→\s+'))
        .map((f) => f.trim())
        .where((f) => f.isNotEmpty)
        .toList();

    final chipBorder = dark
        ? Colors.white.withValues(alpha: 0.10)
        : const Color(0xFF1D4ED8).withValues(alpha: 0.15);
    final chipBg = dark
        ? Colors.white.withValues(alpha: 0.06)
        : const Color(0xFF1D4ED8).withValues(alpha: 0.08);
    final chipText = dark ? const Color(0xFFDCE6FF) : const Color(0xFF1E3A5F);

    Widget body;
    if (frags.length <= 1) {
      body = _inlineText(
          note.summaryBox,
          TextStyle(
              fontSize: 14, height: 1.4, color: ink, fontWeight: FontWeight.w600),
          accent: cyan,
          dark: dark);
    } else {
      body = Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          for (var i = 0; i < frags.length; i++)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: chipBg,
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: chipBorder),
              ),
              child: _inlineText(
                  frags[i],
                  TextStyle(
                      fontSize: 13,
                      height: 1.5,
                      color: chipText,
                      fontWeight: FontWeight.w600),
                  accent: cyan,
                  highlightIndex: i,
                  dark: dark),
            ),
        ],
      );
    }

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: dark
            ? Colors.white.withValues(alpha: 0.04)
            : const Color(0xFFECFEFF),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: cyan.withValues(alpha: 0.22)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.subject_rounded, size: 14, color: labelColor),
              const SizedBox(width: 6),
              Text('SUMMARY',
                  style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.8,
                      color: labelColor)),
            ],
          ),
          const SizedBox(height: 8),
          body,
        ],
      ),
    );
  }
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

// A bullet row. Sub-bullets (web prefixes them with "→ ") render indented with an
// arrow marker (↳) instead of the round dot, matching the web's nested look.
Widget _bullet(String raw, Color ink, Color accent,
    {int index = 0, bool dark = false}) {
  final isSub = raw.startsWith('→');
  final text = isSub ? raw.replaceFirst(RegExp(r'^→\s*'), '') : raw;
  return Padding(
    padding: EdgeInsets.only(left: isSub ? 18 : 0),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (isSub)
          Padding(
            padding: const EdgeInsets.only(top: 1, right: 6),
            child: Text('↳',
                style: TextStyle(
                    fontSize: 12,
                    height: 1.0,
                    color: accent.withValues(alpha: dark ? 1.0 : 0.75))),
          )
        else
          Container(
            margin: const EdgeInsets.only(top: 7, right: 9),
            width: 7,
            height: 7,
            decoration: BoxDecoration(color: accent, shape: BoxShape.circle),
          ),
        Expanded(
          child: _inlineText(
            text,
            TextStyle(
                fontSize: isSub ? 13.5 : 14,
                height: isSub ? 1.5 : 1.45,
                color: isSub ? ink.withValues(alpha: 0.90) : ink),
            accent: accent,
            highlightIndex: index,
            dark: dark,
          ),
        ),
      ],
    ),
  );
}

/// Renders a note image at its natural aspect ratio so the laid-out height is
/// final BEFORE the bytes decode — this keeps the canvas content-height
/// measurement (and the committed-ink picture bounds) stable. [topOnly] rounds
/// only the top corners (image-explained, where the body sits flush below).
Widget _noteImage(String src,
    {required bool dark,
    double? w,
    double? h,
    String fit = 'contain',
    String caption = '',
    bool topOnly = false,
    Color muted = const Color(0xFF6B6155)}) {
  final radius = topOnly
      ? const BorderRadius.vertical(top: Radius.circular(8))
      : BorderRadius.circular(8);
  final ar = (w != null && h != null && w > 0 && h > 0) ? (w / h) : null;
  final boxFit = fit == 'cover' ? BoxFit.cover : BoxFit.contain;

  Widget pic = ContentImage(src, fit: boxFit, borderRadius: 0);
  if (ar != null) pic = AspectRatio(aspectRatio: ar, child: pic);

  return Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      ClipRRect(
        borderRadius: radius,
        child: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: dark
                  ? [
                      Colors.white.withValues(alpha: 0.055),
                      Colors.white.withValues(alpha: 0.02)
                    ]
                  : [const Color(0xFFF8FAFC), const Color(0xFFEFF6FF)],
            ),
          ),
          constraints:
              ar == null ? const BoxConstraints(minHeight: 120) : null,
          child: pic,
        ),
      ),
      if (caption.trim().isNotEmpty)
        Padding(
          padding: const EdgeInsets.fromLTRB(10, 6, 10, 4),
          child: Text(caption,
              textAlign: TextAlign.center,
              style: TextStyle(
                  fontSize: 12, fontStyle: FontStyle.italic, color: muted)),
        ),
    ],
  );
}

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

    // Image embedded inside a text section (renders before bullets when
    // position == 'top', otherwise after). Left/right collapse to stacked, which
    // is exactly what the web does on phone widths.
    final si = section.sectionImage;
    final siWidget = (si != null)
        ? Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: _noteImage(si.src,
                dark: dark,
                w: si.imageWidth,
                h: si.imageHeight,
                fit: si.imageFit,
                caption: si.caption,
                muted: muted),
          )
        : null;

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
          // Image / image-explained section: render the image (figure body below).
          if (section.isImage && section.imageSrc != null) ...[
            const SizedBox(height: 8),
            _noteImage(section.imageSrc!,
                dark: dark,
                w: section.imageWidth,
                h: section.imageHeight,
                fit: section.imageFit,
                caption: section.type == 'image' ? section.caption : '',
                topOnly: section.type == 'image-explained',
                muted: muted),
            if (section.type == 'image-explained') _imageExplainedBody(accent),
          ],
          if (siWidget != null && si!.position == 'top') siWidget,
          if (section.bullets.isNotEmpty) const SizedBox(height: 8),
          for (var i = 0; i < section.bullets.length; i++)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: _bullet(section.bullets[i], ink, accent,
                  index: i, dark: dark),
            ),
          if (section.callout.isNotEmpty) _callout(accent),
          if (siWidget != null && si!.position != 'top') siWidget,
        ],
      ),
    );
  }

  // Web `image-explained` figure body: accent top-border, a "FIGURE" pill, the
  // caption, then the \n-split explanation paragraphs (each inline-parsed).
  Widget _imageExplainedBody(Color accent) {
    final paras = section.explanation
        .split('\n')
        .map((p) => p.trim())
        .where((p) => p.isNotEmpty)
        .toList();
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
      decoration: BoxDecoration(
        border: Border(
            top: BorderSide(color: accent.withValues(alpha: 0.13), width: 2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: 8,
            runSpacing: 4,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: 0.13),
                  borderRadius: BorderRadius.circular(99),
                ),
                child: Text('FIGURE',
                    style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.6,
                        color: dark ? accent : _darken(accent))),
              ),
              if (section.caption.trim().isNotEmpty)
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 260),
                  child: Text(section.caption,
                      style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: ink)),
                ),
            ],
          ),
          if (paras.isNotEmpty) const SizedBox(height: 8),
          for (var i = 0; i < paras.length; i++)
            Padding(
              padding: EdgeInsets.only(bottom: i == paras.length - 1 ? 0 : 6),
              child: _inlineText(
                paras[i],
                TextStyle(fontSize: 13.5, height: 1.6, color: ink),
                accent: accent,
                dark: dark,
              ),
            ),
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
