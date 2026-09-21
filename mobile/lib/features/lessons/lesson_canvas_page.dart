import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:flutter/gestures.dart';
import 'package:flutter/foundation.dart' show compute, listEquals;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter/scheduler.dart' show Ticker;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:path_provider/path_provider.dart';
import 'package:pdfrx/pdfrx.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../data/api_client.dart';
import '../../state/auth_controller.dart';
import '../../theme/tokens.dart';
import '../../widgets/content_image.dart';
import '../../widgets/locked_view.dart';
import '../bookmarks/bookmark_button.dart';
import 'lesson_models.dart';
import 'lessons_repository.dart';
import 'pdf_lesson_page.dart';
import 'topic_icons.dart';
import 'watch_video_modal.dart';
import '../personal_notes/personal_notes_store.dart';

// TEMPORARY: file-based tracing for diagnosing a writing-time jump/flicker
// that's specific to My Notes. Live device logging (both `flutter run
// --debug`'s VM-service connection and `devicectl --console`) failed
// repeatedly against this device, so this writes plain timestamped lines to
// a file in the app's documents directory instead — pulled off afterward
// with a one-shot file copy rather than a live stream. Fire-and-forget by
// design: never awaited from a hot path, and failures are swallowed so a
// full disk or a race never affects the app itself.
File? _traceFile;
void _trace(String msg) {
  () async {
    try {
      _traceFile ??= File('${(await getApplicationDocumentsDirectory()).path}/write_trace.log');
      await _traceFile!.writeAsString(
        '${DateTime.now().toIso8601String()} $msg\n',
        mode: FileMode.append,
        flush: false,
      );
    } catch (_) {}
  }();
}

/// Full AI-notes screen (100% Flutter).
/// Fixed chrome (header + tool strip) sits OUTSIDE the canvas; the warm "canvas"
/// (note widgets + ink) lives inside a manually-controlled Transform so zoom is
/// vector-crisp at every level and the header never moves. A single top-level
/// Listener routes pointers: Apple Pencil draws, fingers pan/zoom — they can
/// never happen at once, so the ink never drifts off the pen tip.
class LessonCanvasPage extends ConsumerStatefulWidget {
  final String lessonId;
  final bool isPersonal;
  final String? personalTitle;
  final Widget? pageNav; // widget shown in header (personal notes only)
  /// Number of pages in the personal note. Each page adds one A4-height section
  /// to the canvas; a page-break line is drawn between sections.
  final int personalPageCount;
  /// Paper per page (index 0 = first page).
  final List<PagePaper> paper;
  /// Fires when the page under the middle of the viewport changes, so the
  /// owner knows which page a paper change should apply to.
  final ValueChanged<int>? onVisiblePage;
  final PersonalPageOps? pageOps;
  const LessonCanvasPage({
    super.key,
    required this.lessonId,
    this.isPersonal = false,
    this.personalTitle,
    this.pageNav,
    this.personalPageCount = 1,
    this.paper = const <PagePaper>[],
    this.onVisiblePage,
    this.pageOps,
  });
  @override
  ConsumerState<LessonCanvasPage> createState() => _NoteCanvasPageState();
}

/// Lets the owner of a personal note act on a page's ink, which lives inside
/// this widget's state. Pass one to [LessonCanvasPage] and it wires itself up.
class PersonalPageOps {
  /// Erase every stroke on [pageIndex], keeping the page itself.
  void Function(int pageIndex)? clearPage;

  /// Erase [pageIndex] and pull everything below it up one page.
  void Function(int pageIndex)? deletePage;

  /// Push every stroke on page [pageIndex] and below down by one page, making
  /// room for a new page there. The mirror of [deletePage] — call this
  /// *before* the store adds the page, same as deletePage's caller removes
  /// the store's page first.
  void Function(int pageIndex)? insertPage;

  /// Same as [insertPage], but for several pages inserted together at once
  /// (importing every page of a PDF at a chosen position) — one shift by
  /// their combined size, not one shift per page.
  ///
  /// Takes the pages themselves, not their heights — only the canvas knows
  /// its own viewport width, which a PDF page's height is derived from
  /// (`viewport.width / pdfAspectRatio`); the wrapper that owns this callback
  /// has no viewport of its own to compute that with.
  void Function(int pageIndex, List<PagePaper> newPages)? insertPages;

  /// Page [pageIndex] is about to get [newPaper] (a size/orientation change,
  /// most likely) — shift every stroke from the *next* page onward by the
  /// resulting height delta, the same way [insertPage]/[deletePage] do for a
  /// page appearing/disappearing. Call *before* the store/paper-list update,
  /// same ordering as those two, so `_personalPageHeight(pageIndex)` here
  /// still reads the page's old paper.
  void Function(int pageIndex, PagePaper newPaper)? resizePage;
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

  // ── Live-render cache (transient; never serialized) ─────────────────────────
  // The in-flight stroke is re-drawn on every pointer move. Rebuilding the whole
  // smoothed cubic path each time makes per-move cost grow with stroke length
  // (the drag felt on long strokes). The binomial smoother is STABLE — a point
  // settles once its neighbours are in and never moves again — so all but the
  // last few segments are final. We bake those into [_liveFrozen] once and, each
  // move, only rebuild the short unsettled tail on top. Geometry is identical to
  // a full [_smoothPath] rebuild, so the committed bake on lift never shifts.
  Path? _liveFrozen; // cached cubic path for the settled leading segments
  int _liveFrozenSegs = 0; // how many segments are baked into _liveFrozen

  // Once a stroke is committed its points never change, so its full smoothed path
  // can be computed ONCE and reused on every re-bake (commit of a later stroke,
  // undo, dark-mode/size flip). Without this, each pen-lift re-smooths every
  // stroke on the page → a hitch that grows with ink. Only cached when committed;
  // the in-flight eraser (which mutates) recomputes fresh each frame.
  bool committed = false;
  Path? _baked;
  Path get bakedPath {
    final cached = _baked;
    if (committed && cached != null) return cached;
    final p = _smoothPath(_smoothN(points, 2));
    if (committed) _baked = p;
    return p;
  }

  /// The smoothed cubic path for the current in-flight points — built
  /// incrementally. Byte-identical in shape to `_smoothPath(_smoothN(points,2))`.
  Path livePath() {
    final sm = _smoothN(points, 2);
    final n = sm.length;
    if (n < 3) {
      _liveFrozen = null;
      _liveFrozenSegs = 0;
      final p = Path()..moveTo(sm.first.dx, sm.first.dy);
      for (final o in sm.skip(1)) {
        p.lineTo(o.dx, o.dy);
      }
      return p;
    }
    // Segment i uses sm[i-1..i+2]; with two binomial passes sm[k] settles once
    // length >= k+3, so segment i is mathematically final at i <= n-5. We keep a
    // generous safety margin — the last [liveTail] segments stay live and are
    // rebuilt every move — so the frozen prefix is provably settled and can never
    // drift from the full bake. The tail is a small constant → per-move cost stays
    // flat regardless of stroke length.
    const liveTail = 12;
    final freezeCount = n - 1 - liveTail < 0 ? 0 : n - 1 - liveTail;
    _liveFrozen ??= Path()..moveTo(sm.first.dx, sm.first.dy);
    for (var i = _liveFrozenSegs; i < freezeCount; i++) {
      _crSegment(_liveFrozen!, sm, i, n);
    }
    if (freezeCount > _liveFrozenSegs) _liveFrozenSegs = freezeCount;
    // Frozen prefix (bulk-copied) + the live tail rebuilt from the settled edge.
    final path = Path.from(_liveFrozen!);
    for (var i = _liveFrozenSegs; i < n - 1; i++) {
      _crSegment(path, sm, i, n);
    }
    return path;
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

class _NoteCanvasPageState extends ConsumerState<LessonCanvasPage>
    with TickerProviderStateMixin, WidgetsBindingObserver {
  // "Reels" review mode — swaps the scrollable canvas for a full-screen,
  // swipe-up-through-cards view of the same sections (Ink tools make no
  // sense there, so the tool strip is hidden while this is on).
  bool _reelsMode = false;

  final List<_Stroke> _strokes = [];
  _Stroke? _active;
  _OneEuro? _euro; // per-stroke input filter (recreated on each pen-down)
  _Tool _tool = _Tool.pen;
  _Tool? _prevTool; // last non-eraser tool before pencil double-tap

  static const _pencilChannel = MethodChannel('app.xyndrome.lk/pencil');
  // Repaints the LIVE ink layer while drawing WITHOUT rebuilding anything (no
  // flicker). Bumped on every pointer move + on stroke start/commit so the live
  // layer clears the in-flight stroke the same frame the committed layer adopts it.
  final ValueNotifier<int> _tick = ValueNotifier<int>(0);
  // Persisting re-serializes the whole stroke list, so we don't write on every
  // pen-lift — a burst of strokes is coalesced into one save after writing stops.
  Timer? _saveTimer;
  bool _inkDirty = false;
  // Debounces didChangeMetrics — see its own doc comment for why.
  Timer? _metricsDebounce;
  // Bumped whenever the COMMITTED ink changes (commit/undo/clear/load). The
  // committed painters repaint via this listenable — no setState, so the note
  // tree is never rebuilt mid-stroke. `_strokes` is mutated in place, so its
  // identity/length can't tell the painter the ink changed.
  final ValueNotifier<int> _inkGen = ValueNotifier<int>(0);

  // Rendered PDF page images, for an imported PDF-backed personal-note page.
  // Rendering is async and CustomPainter.paint() is not, so this exists to let
  // the painter draw synchronously from whatever has already finished — a page
  // not yet in here just paints its plain background until the render lands.
  // Keyed by 'path#pageIndex'; a page is rendered once per note session, not
  // once per frame, since the key never changes for a given page.
  final Map<String, ui.Image> _pdfImageCache = {};
  final Set<String> _pdfImageLoading = {};
  // `_pdfImageCache` is mutated in place and handed to every painter instance
  // by the same reference, so comparing it for equality in shouldRepaint would
  // always see "unchanged" even right after a new image lands — this is what
  // actually changes value each time, so the painter can tell.
  int _pdfImageGen = 0;
  // Repaints ONLY the personal-notes paper layer when a PDF page image
  // finishes loading, instead of setState()-ing the whole page. A PDF image
  // can land at any time, including mid-stroke if you started writing before
  // it rendered — setState() there forced a full widget-tree rebuild right
  // then, which is exactly the kind of surprise mid-write hitch this avoids.
  final ValueNotifier<int> _paperTick = ValueNotifier(0);

  // ── Zoom / pan (manual transform — replaces InteractiveViewer) ──────────────
  // One top-level Listener routes pointers: Apple Pencil draws, fingers pan/zoom.
  // Because stylus events never feed the matrix and finger events never start a
  // stroke, drawing can NEVER pan the canvas (no gesture-arena race, no drift).
  Matrix4 _matrix = Matrix4.identity();
  Matrix4 _invMatrix = Matrix4.identity(); // cached inverse for screen→doc mapping
  bool _personalZoomInit = false; // initial zoom-out applied once
  // Bumped to rebuild ONLY the Transform subtree on pan/zoom (the painters and
  // note tree are passed as a const `child` and are not rebuilt).
  final ValueNotifier<int> _xform = ValueNotifier<int>(0);
  Size _viewport = Size.zero; // from LayoutBuilder
  // The page/canvas's own content width — 85% of the device's PORTRAIT
  // width (min(viewport.width, viewport.height), so it's the same number
  // whichever way the device is currently held) rather than the live
  // viewport. Ink and page size are only ever supposed to change via the
  // user's own pinch-zoom; before this, _viewport.width was used directly
  // as content width, so rotating the device resized/re-baked the whole
  // canvas out from under existing ink. `_viewport` itself keeps tracking
  // the live screen size — chrome (toolbar/header) and pan-clamp bounds
  // legitimately do respond to rotation, only the page's own width doesn't.
  double _pageRefWidth = 0;
  // Falls back to the live viewport only in the sliver of time before the
  // very first LayoutBuilder pass has run and set _pageRefWidth.
  double get _pageWidth => _pageRefWidth > 0 ? _pageRefWidth : _viewport.width;
  // A flat 85% of the short edge reads as deliberate page margins on a big
  // iPad screen, but on a phone (~360-430pt short edge) that same 7.5%
  // gutter on each side just looks like wasted space in an already-narrow
  // column. Scale the fraction up as the short edge shrinks: ~96% on a
  // typical phone, easing down to 85% by the time we're at tablet width.
  static double _pageWidthFraction(double shortEdge) {
    const phoneEdge = 430.0;
    const tabletEdge = 700.0;
    const phoneFraction = 0.96;
    const tabletFraction = 0.85;
    if (shortEdge <= phoneEdge) return phoneFraction;
    if (shortEdge >= tabletEdge) return tabletFraction;
    final t = (shortEdge - phoneEdge) / (tabletEdge - phoneEdge);
    return phoneFraction + (tabletFraction - phoneFraction) * t;
  }
  double _contentH = 0; // measured paper height (document space)
  Size _measuredAt = Size.zero; // viewport size at last measure (re-measure on rotate)
  final GlobalKey _paperKey = GlobalKey();
  // Active finger contacts (global/viewport coords). Stylus never appears here.
  final Map<int, Offset> _touches = {};
  // Palm rejection. `_active != null` (a stylus stroke literally in progress)
  // already keeps a finger from panning, but that only covers the instant a
  // stroke is being drawn — not the gaps between strokes, which is when a
  // resting palm/wrist most often sneaks a touch-down or nudge in and pans
  // or pinch-zooms the canvas out from under the person still writing. A
  // real two-finger pinch happening in the same breath as pencil contact is
  // effectively never intentional, so any finger activity within this grace
  // window of the last stylus contact is treated as palm, not gesture.
  DateTime? _lastStylusActivity;
  static const Duration _palmRejectionWindow = Duration(milliseconds: 800);
  bool get _palmRejectionActive =>
      _active != null ||
      (_lastStylusActivity != null &&
          DateTime.now().difference(_lastStylusActivity!) < _palmRejectionWindow);
  Matrix4 _startMatrix = Matrix4.identity();
  Offset _startFocal = Offset.zero;
  double _startDist = 1.0;
  // Axis lock for single-finger pan — determined once after a small movement
  // threshold and held for the entire gesture to prevent jumps on curves.
  String? _panAxis; // 'x', 'y', or null (undecided)

  // ── Inertial fling (native momentum scroll after a flick) ───────────────────
  // A single-finger pan tracks velocity; on lift, the canvas keeps gliding with
  // iOS-style exponential deceleration until it slows below a threshold or hits a
  // bound. Any new touch or pen-down cancels it.
  VelocityTracker? _vt;
  Ticker? _fling;
  Offset _flingVel = Offset.zero; // screen px/s
  Duration? _flingPrev;
  static const double _flingDecel = 2.0; // iOS's rate; 2.6 braked ~30% harder

  /// Below this the glide is finished. The old cut-off was 30px/s — still half
  /// a pixel per frame — so the canvas visibly halted mid-drift once the finger
  /// was gone. Ending near zero, with the tail eased out below [_flingTaper],
  /// lets it come to rest instead of being switched off.
  static const double _flingStop = 4.0;
  static const double _flingTaper = 90.0;

  // ── Animated zoom-to-fit (double-tap → smooth 250ms ease-out) ───────────────
  Ticker? _zoomAnim;
  Matrix4 _zoomFrom = Matrix4.identity();
  Matrix4 _zoomTo   = Matrix4.identity();
  Duration? _zoomStart;
  static const Duration _zoomDuration = Duration(milliseconds: 250);

  /// Coming back from an overscroll is a settle, not a zoom: slower, and eased
  /// like a critically damped spring so it decelerates into the stop instead
  /// of arriving and halting. Reusing the 250ms ease-out cubic above made the
  /// bounce feel abrupt.
  static const Duration _settleDuration = Duration(milliseconds: 1000);
  bool _settling = false;
  // Zoom-level overlay (briefly visible while zooming, like GoodNotes' % pill)
  final ValueNotifier<double?> _zoomIndicator = ValueNotifier(null);
  static const Duration _zoomIndicatorDuration = Duration(milliseconds: 1200);

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
  LessonDoc? _noteCacheKey;
  bool _noteCacheDark = false;
  Widget _noteContent(LessonDoc note, bool dark) {
    // Personal notes: continuous tall canvas — one section per page, page-break
    // lines between them, all on one scrollable white paper (GoodNotes style).
    if (widget.isPersonal) {
      // One height per page, not one shared constant — a page later backed by
      // an imported PDF gets its own aspect ratio here instead of forcing A4.
      final heights = [
        for (var i = 0; i < widget.personalPageCount; i++) _personalPageHeight(i)
      ];
      // Kick off rendering for every visible PDF-backed page. Cheap after the
      // first call per page — both the cache and the in-flight set dedupe it,
      // so this runs on every rebuild without re-fetching anything.
      for (var i = 0; i < widget.personalPageCount && i < widget.paper.length; i++) {
        final p = widget.paper[i];
        if (p.isPdfBacked) _ensurePdfImage(p.pdfPath!, p.pdfPageIndex!, _pageWidth);
      }
      return SizedBox(
        height: _personalContentHeight(widget.personalPageCount),
        child: CustomPaint(
          foregroundPainter: _PersonalPaperPainter(
            pageHeights: heights,
            paper: widget.paper,
            pdfImages: _pdfImageCache,
            pdfImageGen: _pdfImageGen,
            // The break between pages reads as the desk showing through.
            gapColor: dark ? const Color(0xFF2B2B2F) : const Color(0xFFE8E8EC),
            repaint: _paperTick,
          ),
          // The painter fills every page band with that page's own colour, so
          // this is only what shows through before it paints.
          child: const SizedBox.expand(),
        ),
      );
    }
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
        // Record lesson completion as activity so it counts toward streak + active days.
        ref.read(apiClientProvider).dio.post(
          '/dashboard/student/activity',
          data: {'activityType': 'ai_note_viewed', 'itemId': widget.lessonId},
        ).catchError((_) {});
        // Invalidate the notes list so the green tick shows when the user pops back.
        ref.invalidate(lessonsListProvider);
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
    WidgetsBinding.instance.addObserver(this);
    _uid = ref.read(authControllerProvider).user?.id ?? 'anon';
    _loadInk();
    widget.pageOps
      ?..clearPage = _clearPage
      ..deletePage = _deletePage
      ..insertPage = _insertPage
      ..insertPages = _insertPages
      ..resizePage = _resizePage;
    _loadTools();
    _pencilChannel.setMethodCallHandler(_onPencilEvent);
  }

  // TEMPORARY: catches EVERY setState call (from any of the ~25 call sites
  // in this file) that happens to land while a stroke is in flight, without
  // having to instrument each site individually. A full rebuild mid-stroke
  // recreates the whole widget subtree; whether that's visible as a jump/
  // flicker depends on what actually changed, but this tells us definitively
  // whether it's happening at all, and from where (via the stack trace).
  @override
  void setState(VoidCallback fn) {
    if (_active != null) {
      _trace('[MidStrokeTransform] setState() called isPersonal=${widget.isPersonal} tool=$_tool\n${StackTrace.current}');
    }
    super.setState(fn);
  }

  // The authoritative "the window's actual size/orientation changed" signal
  // — unlike inferring it from this LayoutBuilder's own constraints, which
  // can still be mid-transition (an intermediate width/height, not yet the
  // final rotated one) when its builder re-runs. Framework calls this only
  // once metrics genuinely changed, so re-centring here — via a real
  // setState, not a same-build field mutation something might not repaint
  // for — is what makes a rotation always land correctly, no dependence
  // on exactly which frame the LayoutBuilder's own rebuild happens to fire.
  //
  // Applies to BOTH personal notes and lesson/AI notes: `_contentH > 0` is
  // the "the page has been measured at least once" gate for either mode
  // (personal sets it synchronously in build; lesson sets it once
  // `_maybeMeasure`'s first post-frame callback runs) — this used to be
  // gated on `widget.isPersonal`, which left lesson notes recentring on
  // nothing after a rotation: their old translation, clamped against the
  // pre-rotation viewport, was never revisited.
  //
  // Debounced, and recomputes `_pageRefWidth`/`_contentH` itself rather than
  // trusting a single post-frame callback to land after the LayoutBuilder's
  // own rebuild has already refreshed them. A physical rotation can fire
  // this callback more than once (once per intermediate frame as the OS
  // animates the size change) before the layout truly settles; reacting to
  // each one individually risked clamping against a transient, not-yet-final
  // size. That was hard to notice on a single-page lesson card, but a
  // personal note's content height is the sum of every one of its pages —
  // the same small timing slip there produces a proportionally much bigger,
  // visible jump. Collapsing to the LAST metrics-changed event in a short
  // window, then recomputing fresh from MediaQuery right before clamping,
  // removes the "relayout already landed" assumption entirely.
  @override
  void didChangeMetrics() {
    super.didChangeMetrics();
    if (!mounted || _contentH <= 0) return;
    // TEMPORARY: same diagnostic as _setMatrix — did a metrics event
    // (window resize, e.g. Stage Manager on iPad, not necessarily a
    // physical rotation) fire while a stroke was in flight?
    if (_active != null) {
      _trace('[MidStrokeTransform] didChangeMetrics fired isPersonal=${widget.isPersonal} tool=$_tool');
    }
    _metricsDebounce?.cancel();
    _metricsDebounce = Timer(const Duration(milliseconds: 180), () {
      if (!mounted) return;
      if (_active != null) {
        _trace('[MidStrokeTransform] didChangeMetrics debounce fired isPersonal=${widget.isPersonal} tool=$_tool');
      }
      final win = MediaQuery.sizeOf(context);
      if (win.width > 0 && win.height > 0) {
        final shortEdge = math.min(win.width, win.height);
        _pageRefWidth = shortEdge * _pageWidthFraction(shortEdge);
      }
      if (widget.isPersonal) {
        _contentH = _personalContentHeight(widget.personalPageCount);
      }
      setState(() {
        _matrix = _clamp(_matrix);
        _reportVisiblePage();
        _invMatrix = Matrix4.inverted(_matrix);
      });
    });
  }

  @override
  void didUpdateWidget(LessonCanvasPage old) {
    super.didUpdateWidget(old);
    // When pages are added, force a re-measure on the next frame.
    if (old.personalPageCount != widget.personalPageCount) {
      _measuredAt = Size.zero;
      WidgetsBinding.instance.addPostFrameCallback((_) => _maybeMeasure());
    }
  }

  Future<void> _onPencilEvent(MethodCall call) async {
    if (!mounted) return;
    if (call.method == 'doubleTap') {
      setState(() {
        if (_tool == _Tool.eraser) {
          _tool = _prevTool ?? _Tool.pen;
          _prevTool = null;
        } else {
          _prevTool = _tool;
          _tool = _Tool.eraser;
        }
      });
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _pencilChannel.setMethodCallHandler(null);
    _saveTimer?.cancel();
    _metricsDebounce?.cancel();
    if (_inkDirty) _saveInk(); // flush any pending ink before leaving
    _tick.dispose();
    _inkGen.dispose();
    _xform.dispose();
    _paperTick.dispose();
    _stopFling();
    _fling?.dispose();
    _penPic?.dispose();
    _hlPic?.dispose();
    for (final img in _pdfImageCache.values) {
      img.dispose();
    }
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
    final (pageHeights, pageDark) = _highlighterSpans(dark, size.height);
    _paintHighlighterLayer(Canvas(hl), size, _strokes, null, pageHeights, pageDark);
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
          .map((m) => _Stroke.fromJson(Map<String, dynamic>.from(m as Map))
            ..committed = true) // loaded strokes are final → cache their paths
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
    final data = [for (final s in _strokes) s.toJson()];
    // jsonEncode of the whole stroke list is synchronous CPU work; on the
    // main isolate it stalls a frame right when the 1.2s debounce fires. A
    // My Notes page can carry far more cumulative ink than a single lesson's
    // annotations (it's one save per NOTE, but a note can span many
    // handwritten pages), so that stall scales with how much you've
    // written — off to a background isolate so it never blocks a frame
    // regardless of size.
    final json = await compute(jsonEncode, data);
    await prefs.setString(_inkKey, json);
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

  /// Height of page [i] in document space.
  ///
  /// A4 portrait by default. A page with its own [PagePaper.size] /
  /// [PagePaper.orientation] (or a PDF-imported page, which keeps its own
  /// scanned aspect ratio — captured once at import time, see
  /// PdfImportService) uses [PagePaper.aspectRatio] instead, so this stays
  /// synchronous either way: it never needs to open a file just to ask how
  /// tall page i is.
  double _personalPageHeight(int i) {
    final p = i >= 0 && i < widget.paper.length ? widget.paper[i] : null;
    return _heightForPaper(p);
  }

  /// The height any page with this [PagePaper] would occupy — shared by
  /// [_personalPageHeight] (an existing page, looked up by index) and
  /// [_insertPages] (a page about to exist, which has no index yet).
  double _heightForPaper(PagePaper? p) {
    final ratio = p?.aspectRatio ?? (210 / 297); // A4 portrait fallback
    return _pageWidth / ratio;
  }

  /// Y where page [i] begins, in document space. Sums every page above it —
  /// replaces the old `i * (pageH + gap)`, which only worked because every
  /// page was assumed to be the same height. Once pages can differ (a PDF
  /// import, or an inserted page pushing what follows by its own size rather
  /// than a constant), the offset of page i has to be an honest running sum.
  double _personalPageTop(int i) {
    var y = 0.0;
    for (var k = 0; k < i; k++) {
      y += _personalPageHeight(k) + _kPageGap;
    }
    return y;
  }

  /// Total document height for a note of [pageCount] pages.
  double _personalContentHeight(int pageCount) {
    if (pageCount <= 0) return 0;
    return _personalPageTop(pageCount - 1) + _personalPageHeight(pageCount - 1);
  }

  /// The (heights, isDark) pair [_paintHighlighterLayer] blends against.
  ///
  /// A lesson note is one span covering the whole canvas, coloured by the
  /// device's theme — unchanged from before. A My Notes page picks its own
  /// paper tint independently of the device theme (see [PaperTint]), so a
  /// single canvas-wide blend-mode choice can land on the WRONG side of a
  /// page's actual background — e.g. system Dark Mode + the default White
  /// paper meant `BlendMode.screen` against white, which saturates straight
  /// to white and made every highlighter stroke invisible the instant it
  /// committed. Splitting the blend by page, keyed to that page's own tint,
  /// fixes it regardless of the device theme.
  (List<double>, List<bool>) _highlighterSpans(bool themeDark, double totalHeight) {
    if (!widget.isPersonal) return ([totalHeight], [themeDark]);
    final heights = <double>[];
    final darks = <bool>[];
    for (var i = 0; i < widget.personalPageCount; i++) {
      heights.add(_personalPageHeight(i));
      final tint = i < widget.paper.length ? widget.paper[i].tint : PaperTint.white;
      darks.add(tint == PaperTint.dark);
    }
    return (heights, darks);
  }

  /// Whether the paper actually under document-space y-coordinate [y] is
  /// dark — the SAME per-page-tint-over-device-theme fix as
  /// [_highlighterSpans], applied to the eraser cursor ring. It picked its
  /// black/white tint from the device's theme, so a My Notes page whose own
  /// paper tint disagreed with the system theme (dark mode + the default
  /// White paper, say) got a white ring on white paper — invisible at any
  /// opacity, which is what looked like "no border at all".
  bool _isPaperDarkAt(double y, bool themeDark) {
    if (!widget.isPersonal) return themeDark;
    var top = 0.0;
    for (var i = 0; i < widget.personalPageCount; i++) {
      final h = _personalPageHeight(i);
      if (y < top + h) {
        final tint = i < widget.paper.length ? widget.paper[i].tint : PaperTint.white;
        return tint == PaperTint.dark;
      }
      top += h + _kPageGap;
    }
    return themeDark;
  }

  static String _pdfImageKey(String path, int pageIndex) => '$path#$pageIndex';

  /// Render page [pageIndex] of the PDF at [path] to a cached bitmap, if it
  /// isn't already there or already being fetched. Fire-and-forget: called
  /// once per visible PDF-backed page while building the note (cheap no-op on
  /// every rebuild after the first, since both the cache and the in-flight set
  /// dedupe it). Failures are swallowed — the page just keeps showing its
  /// plain paper background rather than crashing the note.
  void _ensurePdfImage(String path, int pageIndex, double targetWidth) {
    final key = _pdfImageKey(path, pageIndex);
    if (_pdfImageCache.containsKey(key) || _pdfImageLoading.contains(key)) {
      return;
    }
    if (targetWidth <= 0) return;
    _pdfImageLoading.add(key);
    () async {
      PdfDocument? doc;
      try {
        // `path` is what PagePaper.pdfPath stores, which — for anything
        // imported since the container-UUID fix — is relative to the app's
        // documents directory, not directly openable. Always resolve before
        // touching the filesystem; resolvePdfPath is a no-op passthrough for
        // legacy absolute paths from before that fix.
        final resolvedPath = await PersonalNotesStore.resolvePdfPath(path);
        doc = await PdfDocument.openFile(resolvedPath);
        if (pageIndex < 0 || pageIndex >= doc.pages.length) return;
        final page = doc.pages[pageIndex];
        // targetWidth is in LOGICAL pixels — the old flat *1.5 rendered at
        // roughly half the resolution an actual screen needs (devicePixelRatio
        // is 3.0 on most current iPhones), which is why the page looked soft
        // even before any pinch-zoom. Rendering at the real device pixel ratio
        // (plus a little headroom for zooming in further) is what a crisp 1:1
        // view actually requires. Capped so a huge logical width (an iPad in
        // landscape) can't demand an unreasonably large bitmap.
        final dpr = mounted ? MediaQuery.of(context).devicePixelRatio : 2.0;
        final w = (targetWidth * dpr * 1.3).round().clamp(1, 3200);
        final h = (w / (page.width / page.height)).round();
        final pdfImage =
            await page.render(fullWidth: w.toDouble(), fullHeight: h.toDouble());
        if (pdfImage == null) return;
        final image = await pdfImage.createImage();
        pdfImage.dispose();
        if (!mounted) {
          image.dispose();
          return;
        }
        _pdfImageCache[key] = image;
        _pdfImageGen++;
        // Repaint ONLY the paper layer (Listenable-driven, like the ink
        // painters) instead of setState()-ing the whole page — this can
        // land at any time, including mid-stroke, and a full rebuild right
        // then was a real source of an unpredictable write-time hitch.
        _paperTick.value++;
      } catch (_) {
        // Leave uncached — the page keeps its plain background.
      } finally {
        _pdfImageLoading.remove(key);
        await doc?.dispose();
      }
    }();
  }

  // Returns true if the pointer is outside the page's own writable area.
  //
  // Personal notes: past a page's left/right edge (drawn edge-to-edge, no
  // card inset — `_PersonalPaperPainter` fills the full width), a page-break
  // gap, above the first page, or below the last one.
  //
  // Lesson/AI notes: the visible "paper" is NOT the full outer content box —
  // it's the rounded card `_NoteContent` draws inset by `_kNoteCardMargin`
  // (see its Container), so the writable area has to be that same inset,
  // rounded rect, or a stroke can land in the margin gutter or a corner the
  // card's own rounding clips, which then renders past the card's border —
  // ink "slightly outside the canvas".
  bool _outsidePage(Offset localPos) {
    if (_pageWidth <= 0) return false;
    final doc = _toDoc(localPos);
    if (!widget.isPersonal) {
      if (_contentH <= 0) return false; // not yet measured — fail open
      final card = RRect.fromRectAndRadius(
        Rect.fromLTRB(_kNoteCardMargin, _kNoteCardMargin,
            _pageWidth - _kNoteCardMargin, _contentH - _kNoteCardMargin),
        const Radius.circular(_kNoteCardRadius),
      );
      return !card.contains(doc);
    }
    if (doc.dx < 0 || doc.dx > _pageWidth) return true;
    final docY = doc.dy;
    if (docY < 0) return true; // above the first page
    // Walk pages until docY falls at or before this page's bottom: either
    // inside it, or in the gap immediately below it.
    //
    // Tracks `top` as a running sum instead of calling _personalPageTop(i)
    // (itself an O(i) sum from page 0) on every iteration — that combination
    // made this whole function O(n²) in page count, and since this runs on
    // EVERY pointer-move sample while writing with a stylus, a note with many
    // pages made writing measurably laggier the deeper into the document you
    // wrote — with no equivalent in Lesson notes, which check a single fixed
    // rect regardless of length. This was very plausibly the real cause of
    // "writing feels different in My Notes vs Lessons".
    var top = 0.0;
    for (var i = 0; i < widget.personalPageCount; i++) {
      final bottom = top + _personalPageHeight(i);
      if (docY < bottom) return false; // inside page i
      if (docY < bottom + _kPageGap) return true; // in the gap after page i
      top = bottom + _kPageGap;
    }
    return true; // below the last page
  }

  // ── Pointer routing — ONE listener, pencil vs finger by kind ────────────────
  void _onPointerDown(PointerDownEvent e) {
    _stopFling(); // any new contact (or the pen) cancels an in-flight glide
    if (e.kind == PointerDeviceKind.stylus) {
      _lastStylusActivity = DateTime.now();
      // Stylus: reject outside the page's own area — finger pan must still work freely.
      if (_outsidePage(e.localPosition)) return;
      // Any finger already down when a stroke starts is, in practice, never
      // an intentional pinch/pan happening in the exact same instant as pen
      // contact — it's a palm/wrist that was already resting on the glass.
      // Drop it rather than let it keep panning once the stroke ends.
      if (_touches.isNotEmpty) {
        _touches.clear();
        _vt = null;
      }
      // A settle/spring-back/zoom animation left running past this point would
      // keep nudging `_matrix` for its remaining frames while the stroke below
      // is recording points against it — the pen tip doesn't move but the
      // screen-to-document mapping does, which reads as the ink jumping. My
      // Notes hits this far more than Lessons: it's the only mode with
      // rubber-band pinch-zoom and a canvas tall enough to need flinging
      // around, both of which leave this animation running. Snap straight to
      // wherever it was headed before the stroke starts.
      _finishTransformAnim();
      _startStroke(e);
      return;
    }
    if (_palmRejectionActive) return; // pen down, or was down within the grace window
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
      _lastStylusActivity = DateTime.now();
      _extendStroke(e);
      return;
    }
    if (_palmRejectionActive || !_touches.containsKey(e.pointer)) return;
    _touches[e.pointer] = e.localPosition;
    if (_touches.length == 1) _vt?.addPosition(e.timeStamp, e.localPosition);
    _applyTransform();
  }

  void _onPointerUp(PointerEvent e) {
    if (e.kind == PointerDeviceKind.stylus) {
      _lastStylusActivity = DateTime.now();
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
      _springBackIfNeeded();
    }
  }

  void _onPointerCancel(PointerEvent e) {
    if (e.kind == PointerDeviceKind.stylus) {
      _lastStylusActivity = DateTime.now();
      _endStroke(commit: false); // system stole the gesture → discard partial mark
      return;
    }
    _touches.remove(e.pointer);
    _vt = null;
    _snapshotGesture();
    _springBackIfNeeded();
  }

  // ── Inertial fling ──────────────────────────────────────────────────────────
  void _startFling(Offset velocity) {
    // Released while rubber-banded past a bound → spring back, never glide.
    //
    // This is the hole that left the canvas parked where the finger let go.
    // A one-finger release always comes here, and the only settle call lived
    // on the *other* branch of _onPointerUp; a gentle release then hit the
    // "too slow → just stop" return below and nothing brought it back. A fast
    // release was no better: the fling ticker hard-clamps every frame, so it
    // snapped home with no animation at all. Handling it here means all three
    // release paths end in the same spring.
    final settled = _clamp(_matrix);
    final now = _matrix.getTranslation(), rest = settled.getTranslation();
    if ((now.y - rest.y).abs() > 0.5 || (now.x - rest.x).abs() > 0.5) {
      _snapshotGesture();
      _settleOverscroll();
      return;
    }
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
    // Let the glide run past the bound, so reaching the end of a note bounces
    // instead of stopping dead. Previously this clamped hard and then deleted
    // the velocity on the blocked axis, leaving nothing to bounce with.
    _setMatrix(Matrix4.translationValues(delta.dx, delta.dy, 0)..multiply(_matrix),
        rubber: true);
    final after = _matrix.getTranslation();

    // Horizontal has no overscroll, so it still stops at its bound.
    if ((after.x - before.x).abs() < 0.01) _flingVel = Offset(0, _flingVel.dy);

    // Past the end, bleed speed off fast: a hard flick should peek over the
    // edge, not launch half a screen into empty space.
    final rest = _clamp(_matrix).getTranslation();
    final over = (after.y - rest.y).abs();
    if (over > 0.5) {
      _flingVel = _flingVel * math.exp(-_flingDecel * 6.0 * dt);
      if (_flingVel.dy.abs() < 260) {
        // Spent — hand the rest over to the spring.
        _stopFling();
        _settleOverscroll();
        return;
      }
    }

    // iOS-style exponential deceleration…
    _flingVel = _flingVel * math.exp(-_flingDecel * dt);
    // …with the last stretch pulled down harder, so the glide arrives at rest
    // rather than being cut off while still moving.
    final speed = _flingVel.distance;
    if (speed < _flingTaper && speed > 0) {
      final taper = math.exp(-_flingDecel * 2.2 * dt);
      _flingVel = _flingVel * taper;
    }
    if (_flingVel.distance < _flingStop) {
      _stopFling();
      _settleOverscroll(); // no-op unless it came to rest out of bounds
    }
  }

  void _stopFling() {
    if (_fling?.isActive ?? false) _fling!.stop();
    _flingPrev = null;
    _flingVel = Offset.zero;
  }

  // ── Stroke handlers (document space) ────────────────────────────────────────
  void _startStroke(PointerDownEvent e) {
    _trace('[MidStrokeTransform] === STROKE START === isPersonal=${widget.isPersonal} tool=$_tool');
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
    // Commit and stop the stroke if the pointer crosses outside the page.
    if (_outsidePage(e.localPosition)) {
      _endStroke(commit: true);
      return;
    }
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
    _trace('[MidStrokeTransform] === STROKE END === commit=$commit points=${s.points.length}');
    final wasEraser = s.tool == _Tool.eraser;
    _active = null;
    if (commit) {
      s.committed = true; // points are final now → cache its baked path
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

  // ── Transform math (finger pan + pinch zoom, clamp scale to [minScale,5]) ────
  int _lastReportedPage = -1;

  /// Which page sits under the middle of the viewport, in document space.
  void _reportVisiblePage() {
    final cb = widget.onVisiblePage;
    if (cb == null || !widget.isPersonal || _viewport.width <= 0) return;
    final s = _matrix.storage[0];
    if (s <= 0) return;
    final docY = (_viewport.height / 2 - _matrix.getTranslation().y) / s;
    // Walk pages until docY is above the bottom of one — matches how
    // _outsidePage and _pageBand read the same offsets, so all three agree
    // on where one page ends and the next begins. Running sum, not
    // _personalPageTop(i) per iteration — see _outsidePage for why that
    // combination is O(n²) in page count.
    var page = widget.personalPageCount - 1;
    var top = 0.0;
    for (var i = 0; i < widget.personalPageCount; i++) {
      final bottom = top + _personalPageHeight(i);
      if (docY < bottom + _kPageGap) {
        page = i;
        break;
      }
      top = bottom + _kPageGap;
    }
    page = page.clamp(0, widget.personalPageCount - 1);
    if (page == _lastReportedPage) return;
    _lastReportedPage = page;
    cb(page);
  }

  void _setMatrix(Matrix4 m, {bool showIndicator = false, bool rubber = false}) {
    // TEMPORARY: catching whether the transform moves WHILE a stroke is in
    // flight — that would shift the already-drawn part of the stroke on
    // screen out from under a physical pen tip that hasn't moved, which is
    // exactly what "ink jumps / doesn't stick" looks like.
    if (_active != null) {
      _trace('[MidStrokeTransform] _setMatrix isPersonal=${widget.isPersonal} tool=$_tool rubber=$rubber');
    }
    _matrix = _clamp(m, rubber: rubber);
    _reportVisiblePage();
    _invMatrix = Matrix4.inverted(_matrix);
    _xform.value++; // rebuild only the Transform subtree
    if (showIndicator) {
      final pct = _matrix.storage[0];
      _zoomIndicator.value = pct;
      Future.delayed(_zoomIndicatorDuration, () {
        if (_zoomIndicator.value == pct) _zoomIndicator.value = null;
      });
    }
  }

  Offset _centroid(List<Offset> p) =>
      p.fold(Offset.zero, (a, b) => a + b) / p.length.toDouble();

  void _snapshotGesture() {
    if (_zoomAnim?.isActive ?? false) _zoomAnim!.stop(); // cancel animated fit
    _startMatrix = _matrix.clone();
    _panAxis = null; // reset axis lock for new gesture
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

    // Use storage[0] (x-axis scale) not getMaxScaleOnAxis(): the latter returns
    // max(sx, sy, sz) which equals 1 (the z-scale) whenever sx=sy < 1, making
    // scale limits and centering completely wrong when zoomed below 100%.
    final startScale = _startMatrix.storage[0];
    double factor = (twoFinger && _startDist > 0) ? curDist / _startDist : 1.0;
    // Personal notes: min zoom 90%, rubber-band down to 85% then spring back.
    final minScale = widget.isPersonal ? 0.9 : 1.0;
    final rawTarget = startScale * factor;
    double target;
    if (widget.isPersonal && rawTarget < minScale) {
      // Rubber-band: apply 35% resistance below the minimum so it feels springy.
      final over = minScale - rawTarget;
      target = (minScale - over * 0.35).clamp(0.85, minScale);
    } else {
      target = rawTarget.clamp(minScale, 5.0);
    }
    factor = startScale == 0 ? 1.0 : target / startScale;

    var dFocal = focal - _startFocal;
    if (!twoFinger) {
      // Single-finger pan: lock to the dominant axis to prevent diagonal jitter.
      // The axis is decided ONCE after a threshold and held for the whole gesture
      // so circular/curved motions don't cause the canvas to jump mid-gesture.
      if (_panAxis == null && dFocal.distance > 6.0) {
        _panAxis = dFocal.dx.abs() > dFocal.dy.abs() ? 'x' : 'y';
      }
      if (_panAxis == 'x') {
        dFocal = Offset(dFocal.dx, 0);
      } else if (_panAxis == 'y') {
        dFocal = Offset(0, dFocal.dy);
      } else {
        dFocal = Offset.zero; // threshold not yet crossed — hold still
      }
    }

    // Apply, in screen space, about the focal point: scale-about-focal then pan,
    // composed on top of the gesture-start matrix (no incremental float drift).
    final m = Matrix4.translationValues(focal.dx, focal.dy, 0)
      ..multiply(Matrix4.diagonal3Values(factor, factor, 1))
      ..multiply(Matrix4.translationValues(-focal.dx, -focal.dy, 0))
      ..multiply(Matrix4.translationValues(dFocal.dx, dFocal.dy, 0))
      ..multiply(_startMatrix);
    _setMatrix(m, showIndicator: twoFinger, rubber: true);
  }

  // Clamp translation so content can't be dragged into empty space. Horizontal:
  // centred at 1× (no slack), pannable once wider than the viewport. Vertical:
  // free scroll over the note height with a small overscroll margin.
  /// UIScrollView's rubber-band curve, which is what GoodNotes inherits:
  ///
  ///     f(d) = d / (1 + d·c/dim)      c = 0.55
  ///
  /// 1:1 for the first few points, then progressively stiffer, with a ceiling
  /// of `dim/c` — roughly 1500pt on a phone. The first version of this used a
  /// flat 140pt ceiling, about a tenth of that, so the pull ran out almost
  /// immediately and felt stiff rather than elastic. Scaling by the viewport
  /// is what makes it feel the same on a phone and an iPad.
  /// Ceiling of the pull is `dim/_rubberC`. iOS uses 0.55 — about 1.8 screens
  /// of possible travel — which is more slack than this canvas wants; 2.0 caps
  /// it at half the viewport. The curve is still 1:1 for the first few points,
  /// so the start of the pull feels identical; it just saturates sooner.
  static const double _rubberC = 2.0;
  static double _resist(double over, double dim) =>
      (over <= 0 || dim <= 0) ? 0 : over / (1 + over * _rubberC / dim);

  /// [rubber] is on while a finger is down: the canvas may travel past its
  /// bounds with resistance instead of stopping dead, and [_settleOverscroll]
  /// springs it back on release. Everything else (flings, zoom, programmatic
  /// moves) clamps hard, so nothing can come to rest out of bounds.
  Matrix4 _clamp(Matrix4 m, {bool rubber = false}) {
    // storage[0] is the x-axis scale. getMaxScaleOnAxis() returns max(sx,sy,sz)
    // which returns 1 (z-scale) when sx=sy<1, breaking centering when zoomed out.
    final s = m.storage[0];
    final t = m.getTranslation();
    final viewW = _viewport.width, viewH = _viewport.height;
    // Content's own (frozen, rotation-proof) width, scaled — NOT the live
    // viewport width. They coincide until you rotate, at which point viewW
    // legitimately tracks the new screen size (it's what pan bounds/centring
    // below are computed against) while contentW must keep reflecting the
    // page's actual, unchanged rendered width, or the page would silently
    // resize to fill the new orientation instead of just recentring in it.
    final contentW = _pageWidth * s;
    final contentH = _contentH * s;
    const vMargin = 0.0;

    double x;
    if (contentW <= viewW) {
      x = (viewW - contentW) / 2; // centre
    } else {
      x = t.x.clamp(viewW - contentW, 0.0);
    }

    double y;
    if (_contentH <= 0) {
      y = t.y;
    } else if (contentH <= viewH) {
      y = rubber && t.y > vMargin
          ? vMargin + _resist(t.y - vMargin, viewH)
          : vMargin;
    } else {
      final lo = viewH - contentH - vMargin, hi = vMargin;
      if (!rubber) {
        y = t.y.clamp(lo, hi);
      } else if (t.y > hi) {
        y = hi + _resist(t.y - hi, viewH);
      } else if (t.y < lo) {
        y = lo - _resist(lo - t.y, viewH);
      } else {
        y = t.y;
      }
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

  /// Vertical band page [i] occupies in document space.
  (double, double) _pageBand(int i) {
    final top = _personalPageTop(i);
    return (top, top + _personalPageHeight(i));
  }

  /// A stroke can never span a page break — the canvas commits and ends it the
  /// moment the pen crosses into the gap — so its first point decides which
  /// page it belongs to.
  bool _strokeOnPage(_Stroke s, int i) {
    if (s.points.isEmpty) return false;
    final (top, bottom) = _pageBand(i);
    final y = s.points.first.dy;
    return y >= top && y < bottom;
  }

  void _clearPage(int i) {
    final before = _strokes.length;
    _strokes.removeWhere((s) => _strokeOnPage(s, i));
    if (_strokes.length == before) return;
    _inkGen.value++;
    setState(() {});
    _scheduleSaveInk();
  }

  void _deletePage(int i) {
    // The slot being removed: page i's own height plus the gap after it —
    // not a shared constant, since a later page can have a different height
    // (an imported PDF page's own aspect ratio) than the one being deleted.
    final shift = _personalPageHeight(i) + _kPageGap;
    final cut = _personalPageTop(i + 1);
    _strokes.removeWhere((s) => _strokeOnPage(s, i));
    // Everything below the deleted page moves up by exactly that slot's size.
    for (var k = 0; k < _strokes.length; k++) {
      final st = _strokes[k];
      if (st.points.isEmpty || st.points.first.dy < cut) continue;
      for (var j = 0; j < st.points.length; j++) {
        st.points[j] = st.points[j].translate(0, -shift);
      }
    }
    _inkGen.value++;
    setState(() {});
    _scheduleSaveInk();
  }

  /// Make room for a new page at index [i] (0-based; [i] equal to the current
  /// page count means "at the very end", which needs no shift since nothing
  /// exists past the last stroke). The mirror of [_deletePage]: that shifts
  /// everything below a removed page up by its height; this shifts everything
  /// from [i] down by the height the new page will occupy.
  ///
  /// Called before the store actually adds the page, same ordering
  /// [_deletePage]'s caller uses (ink surgery, then the store update) — the
  /// alternative order would mean this widget's `personalPageCount` briefly
  /// disagrees with what has already been drawn.
  void _insertPage(int i) {
    final shift = _personalPageHeight(i) + _kPageGap;
    final cut = _personalPageTop(i);
    var changed = false;
    for (var k = 0; k < _strokes.length; k++) {
      final st = _strokes[k];
      if (st.points.isEmpty || st.points.first.dy < cut) continue;
      changed = true;
      for (var j = 0; j < st.points.length; j++) {
        st.points[j] = st.points[j].translate(0, shift);
      }
    }
    if (!changed) return;
    _inkGen.value++;
    setState(() {});
    _scheduleSaveInk();
  }

  /// A page's own paper (size/orientation) changed, so its height did too —
  /// shift every page after it to match, the same as inserting/deleting a
  /// page. Ink already on page [i] itself is left where it is: a page made
  /// shorter can leave ink sitting past its new bottom edge (into the gap or
  /// the next page's band) rather than being cropped or lost — same
  /// trade-off GoodNotes-style apps make.
  void _resizePage(int i, PagePaper newPaper) {
    final oldHeight = _personalPageHeight(i);
    final newHeight = _heightForPaper(newPaper);
    final delta = newHeight - oldHeight;
    if (delta == 0) return;
    final cut = _personalPageTop(i + 1);
    var changed = false;
    for (var k = 0; k < _strokes.length; k++) {
      final st = _strokes[k];
      if (st.points.isEmpty || st.points.first.dy < cut) continue;
      changed = true;
      for (var j = 0; j < st.points.length; j++) {
        st.points[j] = st.points[j].translate(0, delta);
      }
    }
    if (!changed) return;
    _inkGen.value++;
    setState(() {});
    _scheduleSaveInk();
  }

  /// Same as [_insertPage], but for several pages inserted together —
  /// importing every page of a PDF at once. Takes [newPages] rather than
  /// reading `widget.paper[i]`, deliberately: this runs *before* the caller
  /// updates the paper list (same ordering as [_insertPage]), so at the
  /// moment this executes, `widget.paper[i]` still describes whatever page is
  /// about to be pushed down, not the new ones being inserted.
  void _insertPages(int i, List<PagePaper> newPages) {
    if (newPages.isEmpty) return;
    final shift = newPages.fold<double>(
        0, (sum, p) => sum + _heightForPaper(p) + _kPageGap);
    final cut = _personalPageTop(i);
    var changed = false;
    for (var k = 0; k < _strokes.length; k++) {
      final st = _strokes[k];
      if (st.points.isEmpty || st.points.first.dy < cut) continue;
      changed = true;
      for (var j = 0; j < st.points.length; j++) {
        st.points[j] = st.points[j].translate(0, shift);
      }
    }
    if (!changed) return;
    _inkGen.value++;
    setState(() {});
    _scheduleSaveInk();
  }

  void _clear() {
    if (_strokes.isEmpty) return;
    _strokes.clear();
    _inkGen.value++;
    setState(() {});
    _scheduleSaveInk();
  }

  /// A matrix at [scale] that keeps whatever is currently in the middle of the
  /// viewport in the middle afterwards.
  ///
  /// The zoom targets used to be `Matrix4.diagonal3Values(s, s, 1)`, which is
  /// scale-only — its translation is (0,0), so `_clamp` pinned it to the top of
  /// the document. Springing back from a pinch, or double-tapping to fit, threw
  /// the reader back to page one from wherever they were.
  Matrix4 _scaleAboutCentre(double scale) {
    final cur = _matrix.storage[0];
    final t = _matrix.getTranslation();
    // Document point under the centre of the viewport right now.
    final cx = _viewport.width / 2, cy = _viewport.height / 2;
    final docX = (cx - t.x) / cur, docY = (cy - t.y) / cur;
    // Put that same point back under the centre at the new scale.
    return Matrix4.identity()
      ..setTranslationRaw(cx - docX * scale, cy - docY * scale, 0)
      ..multiply(Matrix4.diagonal3Values(scale, scale, 1));
  }

  // Double-tap: animated zoom to fit-width (GoodNotes-style 250ms ease-out).
  void _fitToPage() {
    _settling = false;
    _zoomFrom = _matrix.clone();
    _zoomTo   = _clamp(_scaleAboutCentre(1.0));
    _zoomStart = null;
    _zoomAnim ??= createTicker(_onZoomTick);
    if (_zoomAnim!.isActive) _zoomAnim!.stop();
    _zoomAnim!.start();
  }

  /// Ease the canvas back inside its bounds after an overscroll.
  void _settleOverscroll() {
    final settled = _clamp(_matrix);
    final a = _matrix.getTranslation(), b = settled.getTranslation();
    if ((a.x - b.x).abs() < 0.5 && (a.y - b.y).abs() < 0.5) return;
    // TEMPORARY: same diagnostic as _setMatrix/didChangeMetrics.
    if (_active != null) {
      _trace('[MidStrokeTransform] _settleOverscroll animating isPersonal=${widget.isPersonal} tool=$_tool');
    }
    _settling = true;
    _zoomFrom = _matrix.clone();
    _zoomTo = settled;
    _zoomStart = null;
    _zoomAnim ??= createTicker(_onZoomTick);
    if (_zoomAnim!.isActive) _zoomAnim!.stop();
    _zoomAnim!.start();
  }

  // Spring all the way back to 100% if the user rubber-banded below the
  // minimum. Resting anywhere below 100% (it used to settle at 90%) meant
  // every subsequent stroke on that page got rasterized at a non-integer
  // zoom scale — nominal width is compensated correctly, but anti-aliasing
  // a stroke at a fractional scale reads subtly softer than at Lessons'
  // pinned 100% floor, which was the actual cause of ink "feeling
  // different" between My Notes and Lessons. The live rubber-band
  // resistance on the way down (in _applyTransform, still allowed to 85%)
  // is untouched — that's just pinch feel, and nobody is writing ink with
  // two fingers actively pinching — only the rest state changes here, so
  // writing is always at the same 100%-or-above floor Lessons has.
  void _springBackIfNeeded() {
    _settleOverscroll();
    if (!widget.isPersonal) return;
    if (_matrix.storage[0] >= 1.0) return;
    // TEMPORARY: same diagnostic as _setMatrix/didChangeMetrics.
    if (_active != null) {
      _trace('[MidStrokeTransform] _springBackIfNeeded animating tool=$_tool');
    }
    _settling = false;
    _zoomFrom = _matrix.clone();
    _zoomTo   = _clamp(_scaleAboutCentre(1.0));
    _zoomStart = null;
    _zoomAnim ??= createTicker(_onZoomTick);
    if (_zoomAnim!.isActive) _zoomAnim!.stop();
    _zoomAnim!.start();
  }

  // Stop an in-flight settle/spring-back/zoom-fit animation and jump straight
  // to wherever it was headed, instead of letting it keep animating. Called
  // right before a stroke starts recording points — see the call site.
  void _finishTransformAnim() {
    if (!(_zoomAnim?.isActive ?? false)) return;
    _zoomAnim!.stop();
    _settling = false;
    _setMatrix(_zoomTo);
  }

  void _onZoomTick(Duration elapsed) {
    // Belt-and-suspenders: a stroke starting in the same frame as a tick
    // (raced past the stop() in _finishTransformAnim) should still never let
    // the matrix move again once writing has begun.
    if (_active != null) {
      _trace('[MidStrokeTransform] _onZoomTick first-frame while stroke active isPersonal=${widget.isPersonal} tool=$_tool settling=$_settling');
      _finishTransformAnim();
      return;
    }
    _zoomStart ??= elapsed;
    final duration = _settling ? _settleDuration : _zoomDuration;
    final t = ((elapsed - _zoomStart!).inMicroseconds / duration.inMicroseconds)
        .clamp(0.0, 1.0);
    // Zoom: ease-out cubic, snappy like GoodNotes. Settle: critically damped
    // spring, 1 - (1 + kt)e^(-kt) — no overshoot, and it eases out far more
    // gently at the end than a cubic does.
    // Spring rate. This governs the *feel* far more than the duration does:
    // most of a damped spring's travel happens in its first third, so at 8.5
    // the canvas was 60% home within ~100ms and read as a snap however long
    // the tail ran. At 6 it leaves more of the motion visible.
    const double k = 6.5;
    // Normalised so the curve reaches exactly 1 at t=1. Without this the
    // spring is still ~2% short when the timer expires and the last step is a
    // visible jump — the opposite of the smooth finish we're after.
    const double kEnd = 1.0 - (1.0 + k) * 0.00150343919; // e^-6.5
    final ease = _settling
        ? (1.0 - (1.0 + k * t) * math.exp(-k * t)) / kEnd
        : 1.0 - (1.0 - t) * (1.0 - t) * (1.0 - t);
    // Lerp each matrix entry
    final from = _zoomFrom.storage;
    final to   = _zoomTo.storage;
    final lerped = Float64List(16);
    for (var i = 0; i < 16; i++) {
      lerped[i] = from[i] + (to[i] - from[i]) * ease;
    }
    _matrix = Matrix4.fromFloat64List(lerped);
    _invMatrix = Matrix4.inverted(_matrix);
    _xform.value++;
    if (t >= 1.0) _zoomAnim!.stop();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final dark = Theme.of(context).brightness == Brightness.dark;
    // Personal notes skip the API entirely — blank canvas only.
    if (widget.isPersonal) {
      // The desk behind the paper. This was a hardcoded dark grey, so My
      // Notes stayed dark in light mode while every other surface followed
      // the theme (the AI-notes branch below never uses this constant, which
      // is why only this screen looked wrong). Light keeps a soft grey rather
      // than white so the paper's edge stays visible against it.
      final desk = dark ? const Color(0xFF2B2B2F) : const Color(0xFFE8E8EC);
      return Scaffold(
        backgroundColor: c.page,
        body: SafeArea(
          child: Column(
            children: [
              _personalHeader(c),
              _toolStrip(c),
              Expanded(
                child: ColoredBox(
                  color: desk,
                  child: GestureDetector(
                    behavior: HitTestBehavior.translucent,
                    onDoubleTap: _fitToPage,
                    child: _canvas(c, dark, LessonDoc.empty()),
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    final noteAsync = ref.watch(lessonDocProvider(widget.lessonId));
    // Sync completed state from the server response (only once, before user acts).
    ref.listen(lessonDocProvider(widget.lessonId), (_, next) {
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
            if (!_reelsMode) _toolStrip(c),
            Expanded(
              child: noteAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => _error(c, e),
                data: (note) => note.locked
                    ? LockedView(
                        title: 'Lesson locked', reason: note.lockReason)
                    : note.pdfUrl.isNotEmpty
                        ? PdfLessonPage(
                            lessonId: widget.lessonId,
                            pdfUrl: note.pdfUrl,
                            toolIndex: _tool.index,
                            penColor: _penFavs[_penSel],
                            hlColor: _hlFavs[_hlSel],
                            penSize: _penSizes[_penSizeSel],
                            hlSize: _hlSizes[_hlSizeSel],
                            eraserSize: _erSizes[_erSizeSel],
                            uid: _uid,
                          )
                        : note.isEmpty
                            ? _emptyNote(c)
                            : (_reelsMode
                                ? _ReelsView(note: note, dark: dark)
                                : _canvas(c, dark, note)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // Header for personal notes — always white text on dark chrome.
  Widget _personalHeader(AppColors c) => Padding(
        padding: const EdgeInsets.fromLTRB(4, 4, 12, 4),
        child: Row(
          children: [
            IconButton(
              onPressed: () => Navigator.of(context).maybePop(),
              icon: Icon(Icons.arrow_back_ios_new_rounded, size: 18, color: c.inkStrong),
            ),
            Expanded(
              child: Text(
                widget.personalTitle?.trim().isNotEmpty == true
                    ? widget.personalTitle!
                    : 'My Note',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: c.inkStrong),
              ),
            ),
            if (widget.pageNav != null) widget.pageNav!,
          ],
        ),
      );

  Widget _header(AppColors c, LessonDoc? note) => Padding(
        padding: const EdgeInsets.fromLTRB(8, 6, 12, 6),
        child: Row(
          children: [
            IconButton(
              onPressed: () => Navigator.of(context).maybePop(),
              icon: Icon(Icons.arrow_back_ios_new_rounded, size: 18, color: c.inkMedium),
            ),
            Expanded(
              child: Text(
                  widget.isPersonal
                      ? (widget.personalTitle?.trim().isNotEmpty == true ? widget.personalTitle! : 'My Note')
                      : (note?.title.trim().isNotEmpty ?? false) ? note!.title : 'Lesson',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                      fontSize: 17, fontWeight: FontWeight.w800, color: c.inkStrong)),
            ),
            if (widget.isPersonal && widget.pageNav != null) widget.pageNav!,
            if (!widget.isPersonal && note != null && !note.locked &&
                note.pdfUrl.isEmpty && !note.isEmpty)
              IconButton(
                tooltip: _reelsMode ? 'Read mode' : 'Review mode',
                onPressed: () => setState(() => _reelsMode = !_reelsMode),
                icon: Icon(
                  _reelsMode
                      ? Icons.view_agenda_outlined
                      : Icons.auto_awesome_motion_outlined,
                  size: 20,
                  color: _reelsMode ? c.primary : c.inkMedium,
                ),
              ),
            if (!widget.isPersonal && note != null && !note.locked)
              _VideoButton(videoUrl: note.videoUrl, c: c),
            if (!widget.isPersonal && note != null && !note.locked && widget.lessonId.isNotEmpty)
              _CompleteButton(
                completed: _lessonCompleted,
                busy: _completionBusy,
                onTap: _markComplete,
                c: c,
              ),
            if (!widget.isPersonal && note != null && !note.locked && note.noteId > 0)
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

  Widget _canvas(AppColors c, bool dark, LessonDoc note) {
    // The eraser is the only tool that must mutate the committed ink live; pen
    // and highlighter draw their in-flight stroke on the cheap top layer only.
    final erasing = _active?.tool == _Tool.eraser;

    return LayoutBuilder(builder: (ctx, cons) {
      _viewport = cons.biggest;
      // 85% of the device's PORTRAIT width. Deliberately min(w,h) of the
      // WINDOW/device size (MediaQuery), NOT of `_viewport` — `_viewport` is
      // only the space this LayoutBuilder itself was given, i.e. whatever is
      // left after the toolbar/header around the canvas. If that chrome
      // claims a different amount of room in each orientation (a header of
      // fixed height, say), `_viewport`'s own min(w,h) can silently drift
      // between portrait and landscape even though the physical device
      // didn't change size — which is exactly what was still moving ink on
      // rotation. The window size's min(w,h) is the device's true short
      // edge, unaffected by how the surrounding UI happens to be laid out.
      final win = MediaQuery.sizeOf(ctx);
      if (win.width > 0 && win.height > 0) {
        final shortEdge = math.min(win.width, win.height);
        _pageRefWidth = shortEdge * _pageWidthFraction(shortEdge);
      }
      // For personal notes the height is deterministic — set it directly so
      // pan bounds are correct the instant a page is added (no frame delay).
      if (widget.isPersonal && _viewport.width > 0) {
        _contentH = _personalContentHeight(widget.personalPageCount);
        // Establish the initial (clamped, centred) matrix once — no extra
        // zoom factor here, the margin already comes from _pageRefWidth.
        // Re-centring after that (a physical rotation, chiefly — _viewport
        // changing how much room there is either side of the page, which
        // itself never resizes) is didChangeMetrics' job below, not this
        // build's: this LayoutBuilder can still rebuild mid-rotation with a
        // transient, not-yet-final size, and there's no reliable way to
        // tell that transient rebuild apart from the settled one from here.
        if (!_personalZoomInit) {
          _personalZoomInit = true;
          _measuredAt = _viewport;
          _matrix = _clamp(Matrix4.identity());
          _invMatrix = Matrix4.inverted(_matrix);
        }
      } else {
        _maybeMeasure();
      }
      // Content size in document space (width is fixed — _pageRefWidth, frozen
      // at first measure, NOT the live viewport, so rotating the device never
      // resizes/re-bakes it; height is the measured note height, or the
      // viewport until measured). Drives the committed-ink pictures' bounds
      // and is kept fresh for off-build refreshes.
      final contentSize = Size(
          _pageWidth, _contentH > 0 ? _contentH : _viewport.height);
      _ensurePics(dark, contentSize);
      final (hlPageHeights, hlPageDark) =
          _highlighterSpans(dark, contentSize.height);

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
          width: _pageWidth,
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
                      pageHeights: hlPageHeights,
                      pageDark: hlPageDark,
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
                        isPaperDarkAt: (y) => _isPaperDarkAt(y, dark),
                        repaint: _tick),
                  ),
                ),
              ),
            ],
          ),
        ),
      );

      return Stack(children: [
        Listener(
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
        ),
        // Zoom % indicator — brief pill at top-centre, like GoodNotes
        Positioned(
          top: 12,
          left: 0,
          right: 0,
          child: ValueListenableBuilder<double?>(
            valueListenable: _zoomIndicator,
            builder: (_, pct, __) => AnimatedOpacity(
              opacity: pct != null ? 1.0 : 0.0,
              duration: const Duration(milliseconds: 180),
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                  decoration: BoxDecoration(
                    color: dark
                        ? const Color(0xFF2A2A2E).withValues(alpha: 0.92)
                        : Colors.white.withValues(alpha: 0.92),
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.18), blurRadius: 8)],
                  ),
                  child: Text(
                    pct != null ? '${(pct * 100).round()}%' : '',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: dark ? Colors.white : const Color(0xFF1C1C1E),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ]);
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
  // Committed strokes reuse their cached [bakedPath] (computed once); the in-flight
  // eraser recomputes fresh each frame as it grows.
  canvas.drawPath(s.bakedPath, paint);
}

// Live-preview draw for the in-flight stroke — same result as [_drawStroke] but
// uses the stroke's INCREMENTAL [livePath] cache, so per-move cost stays flat as
// the stroke grows (only the unsettled tail is rebuilt). Geometry is identical to
// the full bake, so the stroke doesn't shift when it commits on lift.
void _drawLive(Canvas canvas, _Stroke s, Paint paint) {
  if (s.points.length == 1) {
    canvas.drawCircle(s.points.first, s.width / 2,
        Paint()..color = paint.color..blendMode = paint.blendMode);
    return;
  }
  canvas.drawPath(s.livePath(), paint);
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
  for (var i = 0; i < n - 1; i++) {
    _crSegment(path, pts, i, n);
  }
  return path;
}

// One CENTRIPETAL Catmull-Rom (alpha = 0.5) cubic segment pts[i]→pts[i+1],
// appended to [path] (continues from its current point == pts[i]). Unlike uniform
// CR (fixed /6 tangents), the tangent magnitude derives from actual knot spacing
// (dt = |Δp|^0.5), so the curve provably cannot overshoot or self-intersect
// (Yuksel 2011). Passes through every knot with C1 joins and emits a real cubicTo
// for analytic tessellation at any zoom. Shared by the full [_smoothPath] bake and
// the incremental live path so the two are byte-identical (no shift on commit).
// alpha is fixed 0.5, so |Δp|^0.5 is sqrt(|Δp|) — sqrt is far cheaper than pow.
void _crSegment(Path path, List<Offset> pts, int i, int n) {
  const eps = 1e-6;
  final p0 = pts[i == 0 ? 0 : i - 1];
  final p1 = pts[i];
  final p2 = pts[i + 1];
  final p3 = pts[i + 2 >= n ? n - 1 : i + 2];

  final t01 = math.sqrt((p0 - p1).distance) + eps;
  final t12 = math.sqrt((p1 - p2).distance) + eps;
  final t23 = math.sqrt((p2 - p3).distance) + eps;

  // Non-uniform CR tangents (Barry–Goldman), converted to Bézier handles (/3).
  final m1 = (p2 - p1) + ((p1 - p0) / t01 - (p2 - p0) / (t01 + t12)) * t12;
  final m2 = (p2 - p1) + ((p3 - p2) / t23 - (p3 - p1) / (t12 + t23)) * t12;
  final c1 = p1 + m1 / 3.0;
  final c2 = p2 - m2 / 3.0;
  path.cubicTo(c1.dx, c1.dy, c2.dx, c2.dy, p2.dx, p2.dy);
}

// ── Committed-layer drawing (shared by the picture recorder + eraser fallback) ──

/// Draws the committed HIGHLIGHTER layer: every highlighter (and any eraser cut)
/// inside one multiply/screen-blended layer, so text keeps its colour and only
/// the paper tints (the GoodNotes trick). [active] is a non-null in-flight eraser
/// during a live cut; null when recording the static picture.
///
/// Blends per PAGE, not once for the whole canvas: [pageHeights] gives each
/// page's height (in document order, gapped by [_kPageGap] the same way
/// [_PersonalPaperPainter] lays them out) and [pageDark] whether that page's
/// OWN paper is dark. A lesson note passes a single span covering the whole
/// canvas; a My Notes page's paper tint is a per-page user choice independent
/// of the device theme, so blending the whole document against one theme-
/// wide flag could pick screen/multiply against the wrong background and
/// wash the highlighter straight into invisibility on that page.
void _paintHighlighterLayer(Canvas canvas, Size size, List<_Stroke> strokes,
    _Stroke? active, List<double> pageHeights, List<bool> pageDark) {
  final all = active == null ? strokes : [...strokes, active];
  if (!all.any((s) => s.tool == _Tool.highlighter)) return;
  var top = 0.0;
  for (var i = 0; i < pageHeights.length; i++) {
    final h = pageHeights[i];
    if (top >= size.height) break;
    final bottom = math.min(top + h, size.height);
    final rect = Rect.fromLTWH(0, top, size.width, bottom - top);
    final dark = i < pageDark.length && pageDark[i];
    canvas.save();
    canvas.clipRect(rect);
    canvas.saveLayer(
        rect, Paint()..blendMode = dark ? BlendMode.screen : BlendMode.multiply);
    for (final s in all) {
      if (s.points.isEmpty) continue;
      if (s.tool == _Tool.highlighter) {
        _drawStroke(canvas, s, _linePaint(s.color.withValues(alpha: 0.4), s.width));
      } else if (s.tool == _Tool.eraser) {
        _drawStroke(canvas, s, _eraserPaint(s.width));
      }
    }
    canvas.restore(); // saveLayer
    canvas.restore(); // clipRect
    top += h + _kPageGap;
  }
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
  // Only used on the highlighter's live-eraser-cut fallback path — see
  // _highlighterSpans. Null on the pen instance, which never reads them.
  final List<double>? pageHeights;
  final List<bool>? pageDark;
  final List<_Stroke> strokes; // for the eraser fallback only
  final _Stroke? active; // in-flight eraser, or null
  final ui.Picture? Function() getPicture;
  _InkPainter({
    required this.highlighter,
    required this.dark,
    this.pageHeights,
    this.pageDark,
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
      _paintHighlighterLayer(canvas, size, strokes, active,
          pageHeights ?? [size.height], pageDark ?? [dark]);
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
  // Takes the eraser cursor's own document-space y so it can pick a tint
  // that contrasts with the ACTUAL paper there — see _isPaperDarkAt. Passing
  // a plain theme-wide `dark` bool (the old signature) was the real bug:
  // debug-device logs confirmed the ring WAS being drawn every frame with
  // correct position/radius, just in a colour picked from the device's
  // theme rather than the page's own paper — device Dark Mode + a My Notes
  // page still on its default White paper meant a white ring on white
  // paper, invisible regardless of width or opacity.
  final bool Function(double y) isPaperDarkAt;
  _LivePainter(this.getActive, {required this.isPaperDarkAt, super.repaint});

  @override
  void paint(Canvas canvas, Size size) {
    final s = getActive();
    if (s == null || s.points.isEmpty) return;
    switch (s.tool) {
      case _Tool.pen:
        _drawLive(canvas, s, _linePaint(s.color, s.width));
      case _Tool.highlighter:
        // "Wet" preview: a translucent marker while the stroke is in flight.
        // On release it commits to the multiply/screen layer and snaps to the
        // exact GoodNotes look (text crisp underneath).
        _drawLive(
            canvas, s, _linePaint(s.color.withValues(alpha: 0.4), s.width));
      case _Tool.eraser:
        // Brush cursor — a ringed circle at the tip showing the erase size.
        // The actual cut is done on the committed layers; this is just the
        // indicator.
        final c = s.points.last;
        final r = s.width / 2;
        final tint = isPaperDarkAt(c.dy) ? Colors.white : Colors.black;
        canvas.drawCircle(
            c, r, Paint()..color = tint.withValues(alpha: 0.08)); // faint area
        canvas.drawCircle(
            c,
            r,
            Paint()
              ..style = PaintingStyle.stroke
              ..strokeWidth = 2.2
              ..color = tint.withValues(alpha: 0.85)
              ..isAntiAlias = true); // edge ring
    }
  }

  @override
  bool shouldRepaint(_LivePainter old) => true;
}

/// Video pill button — opens WatchVideoModal on tap.
class _VideoButton extends StatelessWidget {
  final String videoUrl;
  final AppColors c;
  const _VideoButton({required this.videoUrl, required this.c});

  @override
  Widget build(BuildContext context) {
    final hasVideo = videoUrl.isNotEmpty;
    return Opacity(
      opacity: hasVideo ? 1.0 : 0.38,
      child: GestureDetector(
        onTap: hasVideo ? () => WatchVideoModal.show(context, videoUrl) : null,
        child: Container(
          margin: const EdgeInsets.only(right: 4),
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            border: Border.all(color: c.line),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.play_circle_outline_rounded, size: 14, color: c.primary),
              const SizedBox(width: 4),
              Text('Video',
                  style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: c.primary)),
            ],
          ),
        ),
      ),
    );
  }
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
  final LessonDoc note;
  final bool dark;
  const _NoteContent({required this.note, required this.dark});

  @override
  Widget build(BuildContext context) {
    final paper = dark ? const Color(0xFF161619) : const Color(0xFFFCFAF3); // light = whitish warm sheet
    final dot = dark ? Colors.white.withValues(alpha: 0.05) : const Color(0xFFECE8DB);
    final ink = dark ? const Color(0xFFDCE6FF) : const Color(0xFF2E2E33);
    final muted = dark ? const Color(0xFF9AA4BF) : const Color(0xFF6A6A70);
    // Warm caramel accent for the title header only — echoes the paper's own
    // warm palette rather than borrowing one of the cooler per-section colours.
    final titleAccent = dark ? const Color(0xFFE8B989) : const Color(0xFFB8763E);

    return MediaQuery(
      data: MediaQuery.of(context).copyWith(textScaler: const TextScaler.linear(1.12)),
      child: DefaultTextStyle.merge(
      style: const TextStyle(fontFamily: 'Plus Jakarta Sans'),
      child: CustomPaint(
      painter: _DotGridPainter(dot),
      child: Container(
        // Clips the dot layer below to the card's own rounded shape — without
        // this the dots would paint square-cornered, bleeding past the border.
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: paper,
          borderRadius: BorderRadius.circular(_kNoteCardRadius),
          border: Border.all(color: dark ? Colors.white12 : const Color(0xFFECDFC6)),
        ),
        margin: const EdgeInsets.all(_kNoteCardMargin),
        child: Stack(
          children: [
            // The writable paper itself, not just the gutter around it, now
            // carries the same subtle dot texture — it used to be a flat fill.
            Positioned.fill(child: CustomPaint(painter: _DotGridPainter(dot))),
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 16, 14, 28),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 12),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          titleAccent.withValues(alpha: dark ? 0.16 : 0.08),
                          titleAccent.withValues(alpha: 0),
                        ],
                      ),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Column(
                      children: [
                        Container(
                          width: 42,
                          height: 42,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: titleAccent.withValues(alpha: dark ? 0.22 : 0.13),
                          ),
                          child: Icon(Icons.menu_book_rounded,
                              size: 20,
                              color: dark ? titleAccent : _darken(titleAccent)),
                        ),
                        const SizedBox(height: 12),
                        Text(note.title.toUpperCase(),
                            textAlign: TextAlign.center,
                            style: TextStyle(
                                fontFamily: 'Plus Jakarta Sans',
                                fontSize: 23,
                                fontWeight: FontWeight.w800,
                                color: ink,
                                height: 1.22,
                                letterSpacing: 0.3)),
                        const SizedBox(height: 10),
                        Container(
                          width: 46,
                          height: 3,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(2),
                            gradient: LinearGradient(colors: [
                              titleAccent.withValues(alpha: 0),
                              titleAccent,
                              titleAccent.withValues(alpha: 0),
                            ]),
                          ),
                        ),
                      ],
                    ),
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
          ],
        ),
      ),
    )));
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

/// Height of the dark desk band between personal-note pages (coordinate space).
// Halved from 28. Note this also sets the width of the band where stylus
// input is rejected so a Pencil stroke can't run across a page break (see
// the `rem >= pageH` test) — that target is now narrower too.
const _kPageGap = 14.0;

/// The lesson/AI-notes card's own inset + corner rounding (see
/// `_NoteContent`'s Container below) — the visible paper is THIS rect, inset
/// from the outer content box `_outsidePage` otherwise measures against, not
/// the full box. Shared here so the writable-area check can match it exactly
/// instead of letting a stroke land in the margin gutter or a clipped corner
/// around the card, which reads as ink drawn "outside" the page.
const _kNoteCardMargin = 10.0;
const _kNoteCardRadius = 18.0;

/// Section accent palette (web NoteCanvas `PALETTE`) — cycled by section index
/// so each card gets a distinct colour, exactly like the web note.
// Cooler muted palette (reverted from the warmer pastel set). Darkened for text
// in light mode, lightened in dark, by _readableAccent.
const _kPalette = <Color>[
  Color(0xFF5E7CA6), Color(0xFFB0685F), Color(0xFF5B93A5), Color(0xFFA8895A),
  Color(0xFF8878A8), Color(0xFF7E9BC2), Color(0xFFB0728F), Color(0xFFBE7E5A),
  Color(0xFF6C9B77), Color(0xFF9E9057), Color(0xFFA9BFD6), Color(0xFFCFC59A),
  Color(0xFFC99089), Color(0xFF8CADA8), Color(0xFFAF97B8), Color(0xFFCBB088),
  Color(0xFFC295A5), Color(0xFF92B7BD), Color(0xFF9AB89B), Color(0xFFCFC0A0),
];

// Pastel rainbow highlighter — soft, distinct highlight tints cycled per mark.
const _kHighlightRainbow = <Color>[
  Color(0xFFF6D98A), Color(0xFFA9CBEE), Color(0xFFB3DDB0), Color(0xFFEFB6CD),
  Color(0xFFCDBCE8), Color(0xFFA9DCE0), Color(0xFFF2B39E), Color(0xFFF3CDA0),
];

// A pastel accent is too light to read as text; darken it in light mode and
// lighten it in dark mode so parent lines / labels stay legible.
Color _readableAccent(Color c, bool dark) {
  final hsl = HSLColor.fromColor(c);
  final l = dark
      ? (hsl.lightness + 0.14).clamp(0.0, 0.92)
      : (hsl.lightness * 0.5).clamp(0.0, 0.48);
  return hsl.withLightness(l).toColor();
}

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
  // A "parent" bullet introduces a list (ends with ':') — it becomes a scan anchor.
  final isParent = !isSub && raw.trimRight().endsWith(':');
  final text = isSub ? raw.replaceFirst(RegExp(r'^→\s*'), '') : raw;
  return Padding(
    padding: EdgeInsets.only(left: isSub ? 18 : 0, top: isParent ? 8 : 0),
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
            decoration: BoxDecoration(color: accent.withValues(alpha: (isParent || !dark) ? 1.0 : 0.65), shape: BoxShape.circle),
          ),
        Expanded(
          child: _inlineText(
            text,
            TextStyle(
                fontSize: isSub ? 13.5 : 14,
                height: isSub ? 1.5 : 1.45,
                fontFamily: isParent ? 'PatrickHand' : null,
                fontWeight: isParent ? FontWeight.w600 : FontWeight.w400,
                color: isParent
                    ? _readableAccent(accent, dark)
                    : (isSub ? ink.withValues(alpha: 0.90) : ink)),
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
  base = base.copyWith(fontFamily: base.fontFamily ?? 'Plus Jakarta Sans', fontSize: (base.fontSize ?? 14) * 1.12); // caller font (Patrick Hand for parent lines) else clean Plus Jakarta; bigger for readability
  final runs = parseInline(raw);
  // Pastel rainbow highlighter — soft multi-colour cycling (calm, not neon).
  final boldColor = dark ? const Color(0xFFB8CBFF) : const Color(0xFF1D4ED8);
  final hlText = dark ? const Color(0xFFFDF6E3) : const Color(0xFF3A342A);
  final muted = (base.color ?? const Color(0xFF6A6A70)).withValues(alpha: 0.6);
  final children = <TextSpan>[];
  var markIndex = 0;
  for (final r in runs) {
    if (r.highlight) {
      final hlBg = _kHighlightRainbow[(highlightIndex + markIndex) % _kHighlightRainbow.length];
      markIndex++;
      children.add(TextSpan(
        text: r.text,
        style: base.copyWith(
          color: hlText,
          fontWeight: FontWeight.w600,
          background: Paint()..color = hlBg.withValues(alpha: dark ? 0.26 : 0.34),
        ),
      ));
    } else if (r.bold) {
      children.add(TextSpan(
        text: r.text,
        style: base.copyWith(fontWeight: FontWeight.w800, color: boldColor),
      ));
    } else {
      // Grey parenthetical reasons like "(screens for anaemia)" — secondary info.
      final re = RegExp(r'\([^)]*\)');
      var last = 0;
      for (final m in re.allMatches(r.text)) {
        if (m.start > last) children.add(TextSpan(text: r.text.substring(last, m.start), style: base));
        children.add(TextSpan(text: m.group(0), style: base.copyWith(color: muted)));
        last = m.end;
      }
      if (last < r.text.length) children.add(TextSpan(text: r.text.substring(last), style: base));
    }
  }
  return RichText(text: TextSpan(style: base, children: children));
}

// ── Reels review mode — swipe-up-through-cards, one concept per screen ─────
//
// A completely separate, simple render path from the pan/zoom/ink canvas
// above: no Matrix4, no InteractiveViewer, no ink layers — just a vertical
// PageView. Each page fades + blurs + scales down slightly as it leaves
// centre, driven directly off the PageController's fractional `page` value
// (a parallax-style transition, not a hand-rolled gesture detector), which
// is what gives the "feel good" glide between concepts on drag as well as
// on a programmatic/animated page change.
class _ReelsView extends StatefulWidget {
  final LessonDoc note;
  final bool dark;
  const _ReelsView({required this.note, required this.dark});

  @override
  State<_ReelsView> createState() => _ReelsViewState();
}

class _ReelsViewState extends State<_ReelsView> {
  late final PageController _controller;
  // The settled index we last replayed for — NOT updated on every drag tick,
  // only once a scroll genuinely comes to rest. `onPageChanged` looked like
  // the obvious hook for this but fires as soon as the fractional page
  // crosses the halfway mark, including mid-fling and on any rubber-band
  // overshoot/settle-back — a single swipe could cross that line twice,
  // which is exactly what fired the reveal twice in a row.
  int _lastSettled = 0;
  // Bumped each time a page *settles* as the current one — used as that
  // page's content key, so the per-line reveal below replays fresh every
  // time you land on it, not just the first time.
  final Map<int, int> _visitGen = {0: 0};

  int get _sectionCount => widget.note.sections.length;
  bool get _hasClosing =>
      widget.note.keyPoints.isNotEmpty || widget.note.summaryBox.isNotEmpty;
  int get _pageCount => 1 + _sectionCount + (_hasClosing ? 1 : 0);

  // The actual bug: ScrollEndNotification is not one-shot the way it sounds.
  // A released fling on PageView commonly runs as *two* chained scroll
  // activities — the drag ending, then a separate ballistic/snap animation
  // to the exact page boundary — each firing its own ScrollEndNotification.
  // On a fast/energetic swipe that snap can also overshoot and spring back,
  // which can round to a different page index for an instant before
  // correcting. Comparing straight off each notification let that
  // temporary overshoot commit as a real "settle", so the reveal played
  // once for the bounce and once again for the correction. Debouncing to
  // the LAST notification in a short quiet window collapses that whole
  // chain into the one genuine settle.
  Timer? _settleDebounce;

  @override
  void initState() {
    super.initState();
    _controller = PageController();
  }

  void _onScrollEndNotification() {
    _settleDebounce?.cancel();
    _settleDebounce = Timer(const Duration(milliseconds: 200), _commitSettle);
  }

  void _commitSettle() {
    if (!mounted) return;
    final p = _controller.page;
    if (p == null) return;
    final index = p.round().clamp(0, _pageCount - 1);
    if (index == _lastSettled) return;
    setState(() {
      _lastSettled = index;
      _visitGen[index] = (_visitGen[index] ?? 0) + 1;
    });
  }

  @override
  void dispose() {
    _settleDebounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final dark = widget.dark;
    final ink = dark ? const Color(0xFFDCE6FF) : const Color(0xFF2E2E33);
    final muted = dark ? const Color(0xFF9AA4BF) : const Color(0xFF6A6A70);
    final bg = dark ? const Color(0xFF0A0A0F) : const Color(0xFFF7F6FB);
    final pageCount = _pageCount;

    return Container(
      color: bg,
      child: Stack(
        children: [
          // Settle detection lives on the SCROLL NOTIFICATION, not the
          // per-frame page value, and is debounced (see _onScrollEndNotification)
          // since a single swipe can fire more than one of these.
          NotificationListener<ScrollEndNotification>(
            onNotification: (n) {
              _onScrollEndNotification();
              return false;
            },
            child: PageView.builder(
              controller: _controller,
              scrollDirection: Axis.vertical,
              // Tried conditionally switching this to
              // NeverScrollableScrollPhysics while the current card still had
              // unscrolled content, to stop a fast swipe from winning the
              // PageView's own gesture arena outright — but NeverScrollable
              // on the ANCESTOR PageView turned out to swallow touches for
              // its entire subtree, not just decline to scroll itself: the
              // inner SingleChildScrollView went completely dead too, not
              // just the outer paging. Reverted; always normal physics here,
              // same as it's always been.
              physics: const PageScrollPhysics(),
              itemCount: pageCount,
              itemBuilder: (context, i) {
                // AnimatedBuilder's `child` (the actual page content — the
                // expensive part, section text/tables/images) is built ONCE
                // here and reused on every tick; only the cheap opacity/
                // scale/blur wrapper below re-runs per frame. The previous
                // version rebuilt the whole page tree via setState on every
                // scroll pixel, which combined with a per-frame blur filter
                // is exactly what was lagging on a fast swipe.
                return AnimatedBuilder(
                  animation: _controller,
                  child: _pageFor(c, dark, ink, muted, i),
                  builder: (context, child) {
                    var page = i.toDouble();
                    if (_controller.hasClients && _controller.position.haveDimensions) {
                      page = _controller.page ?? page;
                    }
                    final distance = (page - i).clamp(-1.0, 1.0).abs();
                    // Reaches full opacity a bit before the page actually
                    // settles at distance 0 (not exactly at 0), so this
                    // outer fade doesn't still be visibly finishing at the
                    // exact moment the per-line reveal below starts and the
                    // two read as one fade firing twice back to back — but
                    // wide enough (was 0.35, a much snappier fade that
                    // finished very early in the swipe/transition) that the
                    // fade itself reads as a slower, more gradual reveal.
                    const fadeSpan = 0.55;
                    final opacity = (1 - distance / fadeSpan).clamp(0.0, 1.0);
                    final scale = 1 - distance * 0.10;

                    Widget content = Transform.scale(scale: scale, child: child);
                    // Only the page(s) mostly out of view pay for the blur —
                    // skip it near the centre, where it wouldn't read anyway.
                    if (distance > fadeSpan) {
                      final blurSigma = (distance - fadeSpan) * 14;
                      content = ImageFiltered(
                        imageFilter:
                            ui.ImageFilter.blur(sigmaX: blurSigma, sigmaY: blurSigma),
                        child: content,
                      );
                    }
                    return Opacity(opacity: opacity, child: content);
                  },
                );
              },
            ),
          ),
          Positioned(
            top: 8,
            left: 0,
            right: 0,
            child: Center(
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                decoration: BoxDecoration(
                  color: (dark ? Colors.white : Colors.black)
                      .withValues(alpha: 0.06),
                  borderRadius: BorderRadius.circular(99),
                ),
                child: AnimatedBuilder(
                  animation: _controller,
                  builder: (context, _) {
                    var page = _lastSettled.toDouble();
                    if (_controller.hasClients && _controller.position.haveDimensions) {
                      page = _controller.page ?? page;
                    }
                    final shown = page.round().clamp(0, pageCount - 1) + 1;
                    return Text(
                      '$shown / $pageCount',
                      style: TextStyle(
                          fontSize: 12, fontWeight: FontWeight.w700, color: muted),
                    );
                  },
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _pageFor(
      AppColors c, bool dark, Color ink, Color muted, int i) {
    final note = widget.note;
    if (i == 0) return _introPage(c, dark, ink, muted, note);
    final sectionIndex = i - 1;
    if (sectionIndex < _sectionCount) {
      // Back to the plain section card for every type — the per-line
      // reveal experiment is gone; the outer swipe-driven fade/blur/scale
      // (still active below) is the only entrance effect a section page
      // gets now.
      return _reelsFrame(
        isLast: i >= _pageCount - 1,
        child: _SectionCard(
          section: note.sections[sectionIndex],
          index: sectionIndex,
          ink: ink,
          muted: muted,
          dark: dark,
        ),
      );
    }
    return _closingPage(c, dark, ink, muted, note, _visitGen[i] ?? 0);
  }

  Widget _introPage(
      AppColors c, bool dark, Color ink, Color muted, LessonDoc note) {
    final titleAccent = dark ? const Color(0xFFE8B989) : const Color(0xFFB8763E);
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: titleAccent.withValues(alpha: dark ? 0.22 : 0.13),
              ),
              child: Icon(Icons.menu_book_rounded,
                  size: 26, color: dark ? titleAccent : titleAccent),
            ),
            const SizedBox(height: 20),
            Text(note.title,
                textAlign: TextAlign.center,
                style: TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.w800,
                    height: 1.25,
                    color: ink)),
            if (note.subtitle.isNotEmpty) ...[
              const SizedBox(height: 10),
              Text(note.subtitle,
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 14.5, color: muted)),
            ],
            const SizedBox(height: 36),
            _BouncingChevron(color: muted),
            const SizedBox(height: 6),
            Text('Swipe up to begin',
                style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.3,
                    color: muted)),
          ],
        ),
      ),
    );
  }

  Widget _closingPage(AppColors c, bool dark, Color ink, Color muted,
      LessonDoc note, int gen) {
    final accent = dark ? const Color(0xFF34D399) : const Color(0xFF10B981);
    final lines = <Widget>[
      Row(
        children: [
          Icon(Icons.check_circle_rounded, color: accent, size: 22),
          const SizedBox(width: 8),
          Text('KEY TAKEAWAYS',
              style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.1,
                  color: accent)),
        ],
      ),
      for (var i = 0; i < note.keyPoints.length; i++)
        Padding(
          padding: EdgeInsets.only(top: i == 0 ? 22 : 18),
          child: _bullet(note.keyPoints[i], ink, accent, dark: dark),
        ),
      if (note.summaryBox.isNotEmpty)
        Padding(
          padding: const EdgeInsets.only(top: 20),
          child: Text(note.summaryBox,
              style: TextStyle(fontSize: 13.5, height: 1.5, color: muted)),
        ),
      Padding(
        padding: const EdgeInsets.only(top: 28),
        child: Center(
          child: Text("That's the whole lesson — swipe down to go again",
              textAlign: TextAlign.center,
              style: TextStyle(
                  fontSize: 12, fontWeight: FontWeight.w600, color: muted)),
        ),
      ),
    ];
    return _reelsFrame(
      isLast: true,
      child: AnimationLimiter(
        key: ValueKey('closing-$gen'),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: AnimationConfiguration.toStaggeredList(
            duration: const Duration(milliseconds: 560),
            delay: const Duration(milliseconds: 110),
            childAnimationBuilder: (w) => SlideAnimation(
              curve: Curves.easeOutCubic,
              verticalOffset: 8,
              child: FadeInAnimation(
                curve: Curves.easeOutCubic,
                child: w,
              ),
            ),
            children: lines,
          ),
        ),
      ),
    );
  }

  void _advanceReelsPage() {
    _controller.nextPage(
      duration: const Duration(milliseconds: 620),
      curve: Curves.easeOutCubic,
    );
  }

  Widget _reelsFrame({required Widget child, required bool isLast}) {
    return _ReelsFrame(
      isLast: isLast,
      onAdvance: _advanceReelsPage,
      child: child,
    );
  }
}

/// Wraps one reels-mode card's scrollable content. Several rounds of trying
/// to make a fast swipe on a long card behave (settle debounce, dragDetails
/// presence, overscroll magnitude, then conditionally disabling the outer
/// PageView's physics while the card had unscrolled content — see git
/// history on this file for all of them) each fixed one symptom and broke
/// another; the physics-toggling attempt in particular turned out to freeze
/// the whole card (NeverScrollableScrollPhysics on the ancestor PageView
/// swallowed touches for its entire subtree, not just decline to scroll
/// itself). Reverted to the simplest thing that reliably works: the outer
/// PageView always uses its normal, permanent `PageScrollPhysics` — same as
/// the intro/title page always has — and the only other way to advance is
/// tapping the `_ContinueButton`, which appears once the card has genuinely
/// been scrolled to its true bottom (tracked via `ScrollController`). A fast
/// swipe occasionally winning the gesture arena on a long, freshly-landed-on
/// card is a real but lesser imperfection than the card going dead entirely.
class _ReelsFrame extends StatefulWidget {
  final Widget child;
  final bool isLast;
  final VoidCallback onAdvance;
  const _ReelsFrame({required this.child, required this.isLast, required this.onAdvance});

  @override
  State<_ReelsFrame> createState() => _ReelsFrameState();
}

class _ReelsFrameState extends State<_ReelsFrame> {
  final ScrollController _scrollController = ScrollController();
  bool _overflows = false;
  bool _atBottom = false;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_syncScrollState);
    WidgetsBinding.instance.addPostFrameCallback((_) => _syncScrollState());
  }

  @override
  void dispose() {
    _scrollController.removeListener(_syncScrollState);
    _scrollController.dispose();
    super.dispose();
  }

  void _syncScrollState() {
    if (!mounted || !_scrollController.hasClients) return;
    final position = _scrollController.position;
    final overflows = position.maxScrollExtent > 4;
    final atBottom = position.maxScrollExtent <= 0 ||
        position.pixels >= position.maxScrollExtent - 12;
    if (overflows != _overflows || atBottom != _atBottom) {
      setState(() {
        _overflows = overflows;
        _atBottom = atBottom;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final showContinue = !widget.isLast && _overflows && _atBottom;
    return Stack(
      children: [
        // Keeps the platform's normal (bouncy, on iOS) inner scroll feel.
        //
        // The scroll view's own box used to be wrapped directly in a
        // `Center`, which — under Center's loose width constraint —
        // shrink-wraps SingleChildScrollView to its 520-wide ConstrainedBox
        // child. On a wide screen (iPad) that left genuine empty (non-
        // scrollable) margin on each side where a swipe fell straight
        // through to the outer PageView instead of scrolling the card. On a
        // phone the 520 cap rarely even applies, so no such margin existed.
        // Forcing the scroll view itself to full width — and doing the
        // 520-cap centering *inside* it — makes the whole card one
        // scrollable hit-test region on any screen size.
        SingleChildScrollView(
          controller: _scrollController,
          child: SizedBox(
            width: double.infinity,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 48),
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 520),
                  child: widget.child,
                ),
              ),
            ),
          ),
        ),
        if (showContinue)
          Positioned(
            left: 0,
            right: 0,
            bottom: 14,
            child: Center(child: _ContinueButton(color: c.primary, onTap: widget.onAdvance)),
          ),
      ],
    );
  }
}

class _ContinueButton extends StatelessWidget {
  final Color color;
  final VoidCallback onTap;
  const _ContinueButton({required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
        decoration: BoxDecoration(
          color: c.cardElevated,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: color.withValues(alpha: 0.35)),
          boxShadow: [
            BoxShadow(color: Colors.black.withValues(alpha: 0.14), blurRadius: 12, offset: const Offset(0, 4)),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Continue',
                style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: color)),
            const SizedBox(width: 6),
            Icon(Icons.keyboard_arrow_up_rounded, size: 19, color: color),
          ],
        ),
      ),
    );
  }
}

class _BouncingChevron extends StatefulWidget {
  final Color color;
  const _BouncingChevron({required this.color});

  @override
  State<_BouncingChevron> createState() => _BouncingChevronState();
}

class _BouncingChevronState extends State<_BouncingChevron>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _c,
      builder: (context, child) {
        return Transform.translate(
          offset: Offset(0, -6 * Curves.easeInOut.transform(_c.value)),
          child: child,
        );
      },
      child: Icon(Icons.keyboard_arrow_up_rounded,
          size: 26, color: widget.color),
    );
  }
}

class _SectionCard extends StatelessWidget {
  final LessonSection section;
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
    // Light mode: a soft WHITE card on the grey page (like the exam-trap card),
    // with faint accent tints in the top-left + bottom-right corners.
    // Dark mode: transparent, so the card blends into the dark page (corners only).
    final ghsl = HSLColor.fromColor(accent);
    final glowAccent = ghsl.withSaturation((ghsl.saturation * 0.45).clamp(0.0, 1.0)).toColor();
    const lightCard = Color(0xFFFFFEF8); // whitish-warm card (barely yellow)
    final cardFill = dark ? Colors.transparent : lightCard;
    final glowTL = dark
        ? glowAccent.withValues(alpha: 0.16)
        : Color.alphaBlend(glowAccent.withValues(alpha: 0.045), lightCard);
    final glowBR = dark
        ? glowAccent.withValues(alpha: 0.20)
        : Color.alphaBlend(glowAccent.withValues(alpha: 0.06), lightCard);

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
          colors: [glowTL, cardFill, cardFill, glowBR],
          stops: const [0.0, 0.34, 0.66, 1.0],
        ),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: dark ? Colors.white.withValues(alpha: 0.06) : const Color(0xFFF1EEE4)),
        boxShadow: dark ? null : [BoxShadow(color: Colors.black.withValues(alpha: 0.022), blurRadius: 6, offset: const Offset(0, 1))],
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
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (_topicIconSvg(section.heading) != null) ...[
                    SvgPicture.string(
                      _topicIconSvg(section.heading)!,
                      width: 13,
                      height: 13,
                      colorFilter: ColorFilter.mode(
                        dark ? Color.lerp(accent, Colors.white, 0.4)! : _darken(accent),
                        BlendMode.srcIn,
                      ),
                    ),
                    const SizedBox(width: 5),
                  ],
                  Flexible(
                    child: Text(section.heading.toUpperCase(),
                        style: TextStyle(
                            fontFamily: 'Plus Jakarta Sans',
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.5,
                            color: dark ? Color.lerp(accent, Colors.white, 0.4)! : _darken(accent))),
                  ),
                ],
              ),
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
          if (section.isTable) _tableBlock(accent),
          if (section.isFlow) _flowBlock(accent),
          if (section.callout.isNotEmpty) _callout(accent),
          if (section.mnemonic.isNotEmpty) _mnemonic(accent),
          if (section.stickyNote.isNotEmpty) _stickyNote(accent),
          if (siWidget != null && si!.position != 'top') siWidget,
        ],
      ),
    );
  }

  String? _topicIconSvg(String heading) {
    final family = guessTopicFamily(heading);
    if (family == null) return null;
    return kTopicIconSvgs[family];
  }

  // Flow block: cause → effect chain rendered as full-sentence steps stacked
  // vertically, connected by centered down-arrows. No per-step cards.
  Widget _flowBlock(Color accent) {
    final steps = section.steps;
    if (steps.isEmpty) return const SizedBox.shrink();
    final arrowColor = accent.withValues(alpha: dark ? 0.55 : 0.6);
    final children = <Widget>[];
    for (var i = 0; i < steps.length; i++) {
      if (i > 0) {
        children.add(Padding(
          padding: const EdgeInsets.symmetric(vertical: 5),
          child: Center(
            child: Icon(Icons.arrow_downward_rounded, size: 20, color: arrowColor),
          ),
        ));
      }
      children.add(_inlineText(
        steps[i],
        TextStyle(fontSize: 14, height: 1.5, color: ink),
        accent: accent,
        dark: dark,
      ));
    }
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: children),
    );
  }

  Widget _tableBlock(Color accent) {
    final headers = section.tableHeaders;
    final rows = section.tableRows;
    if (headers.isEmpty) return const SizedBox.shrink();
    final dividerColor = accent.withValues(alpha: dark ? 0.18 : 0.12);
    final headerColor = dark ? Color.lerp(accent, Colors.white, 0.35)! : _darken(accent);

    // Fit the table to the screen. The canvas uses a manual pan gesture that
    // swallows any nested horizontal scroll, so a scrollable table can't slide —
    // instead columns share the width via Expanded and text wraps at word
    // boundaries. A smaller cell font (smaller still for 4+ columns) keeps words
    // from breaking mid-word.
    final wide = headers.length >= 4;
    final cellSize = wide ? 10.5 : 12.5;

    Widget buildRow(List<String> cells, {bool isHeader = false}) {
      return Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: List.generate(headers.length, (ci) {
          final text = ci < cells.length ? cells[ci] : '';
          return Expanded(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(5, 6, 5, 6),
              child: isHeader
                  ? Text(text.toUpperCase(),
                      style: TextStyle(
                          fontFamily: 'Plus Jakarta Sans',
                          fontSize: wide ? 9.0 : 10.0,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.2,
                          height: 1.3,
                          color: headerColor))
                  : _inlineText(
                      text,
                      TextStyle(fontSize: cellSize, height: 1.4, color: ink),
                      accent: accent,
                      dark: dark,
                    ),
            ),
          );
        }),
      );
    }

    return Container(
      margin: const EdgeInsets.only(top: 8),
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: accent.withValues(alpha: 0.25), width: 1.5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          buildRow(headers, isHeader: true),
          ...rows.asMap().entries.map((e) => Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Divider(height: 1, thickness: 0.8, color: dividerColor),
              buildRow(e.value),
            ],
          )),
        ],
      ),
    );
  }

  Widget _mnemonic(Color accent) {
    final amber = const Color(0xFFD97706);
    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
      decoration: BoxDecoration(
        color: dark ? const Color(0xFF1C1A10) : const Color(0xFFFFFBEB),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: amber.withValues(alpha: dark ? 0.30 : 0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('MNEMONIC',
              style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.1,
                  color: dark ? const Color(0xFFFFE57A) : amber)),
          const SizedBox(height: 5),
          _inlineText(
            section.mnemonic,
            TextStyle(fontSize: 13, height: 1.5, color: ink),
            accent: amber,
            dark: dark,
          ),
        ],
      ),
    );
  }

  Widget _stickyNote(Color accent) {
    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
      decoration: BoxDecoration(
        color: dark ? Colors.white.withValues(alpha: 0.04) : accent.withValues(alpha: 0.07),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: accent.withValues(alpha: dark ? 0.35 : 0.50)),
      ),
      child: _inlineText(
        section.stickyNote,
        TextStyle(fontSize: 13, height: 1.5, color: ink),
        accent: accent,
        dark: dark,
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
          const Icon(Icons.bolt_rounded, size: 16, color: Colors.amber),
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

}

/// Darkens [c] for legible text/icons on light paper (shared by the note
/// title header and every _SectionCard heading).
Color _darken(Color c) {
  final hsl = HSLColor.fromColor(c);
  return hsl.withLightness((hsl.lightness * 0.55).clamp(0.0, 1.0)).toColor();
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

/// Dot grid + page-break bands for personal notes.
/// Layout: page 0 → gap → page 1 → gap → page 2 …
/// Gap bands are REAL dead space in the coordinate system (no writable area).
class _PersonalPaperPainter extends CustomPainter {
  /// One entry per page — was a single shared `pageH` + `pageCount`, which
  /// assumed every page the same height. A page backed by an imported PDF
  /// keeps its own aspect ratio instead of being forced to A4.
  final List<double> pageHeights;
  final List<PagePaper> paper;
  /// Rendered PDF page bitmaps, keyed 'path#pageIndex' — see
  /// _NoteCanvasPageState._ensurePdfImage. A PDF-backed page with no entry
  /// here yet just shows its plain paper fill until the render lands; there
  /// is no loading spinner, since it is expected to pop in within a frame or
  /// two of the page scrolling into view.
  final Map<String, ui.Image> pdfImages;
  /// Bumped every time [pdfImages] gains an entry. [pdfImages] itself is the
  /// same mutable Map instance on every rebuild (see
  /// _NoteCanvasPageState._pdfImageCache), so comparing it by equality in
  /// [shouldRepaint] would never detect a newly-landed image — this is what
  /// actually changes value when that happens.
  final int pdfImageGen;
  final Color gapColor;
  _PersonalPaperPainter({
    required this.pageHeights,
    required this.paper,
    required this.pdfImages,
    required this.pdfImageGen,
    required this.gapColor,
    super.repaint,
  });

  static Color paperColor(PaperTint t) => switch (t) {
        // Was literal Colors.white (#FFFFFF) — the one truly harsh extreme
        // in this whole palette. Pure white maximises screen brightness/
        // contrast, which is exactly what makes a moving pen stroke's
        // motion blur most visible — a real, well-documented "harsh on the
        // eyes" effect for note-taking apps generally, not something
        // specific to this one. A neutral, barely-tinted off-white keeps
        // this reading as "white" paper (no warmth, so it stays clearly
        // distinct from Cream) while dropping that one extreme.
        PaperTint.white => const Color(0xFFFAFAFA),
        PaperTint.cream => const Color(0xFFFAF4E6),
        // Was #1C1C20 — nearly indistinguishable from true black at a
        // glance, even though it's technically a soft dark rather than
        // literal #000000. Lightened to a proper charcoal so it reads as
        // "dark paper" rather than "black paper".
        PaperTint.dark => const Color(0xFF26262B),
      };

  /// Ruling has to sit on its own page's colour — one fixed light grey was
  /// invisible on dark paper and too cold on cream.
  static Color _rule(PaperTint t) => switch (t) {
        PaperTint.white => const Color(0xFFCECED6),
        PaperTint.cream => const Color(0xFFD8CFBC),
        PaperTint.dark => const Color(0xFF4A4A52),
      };

  PagePaper _page(int i) =>
      i >= 0 && i < paper.length ? paper[i] : const PagePaper();

  @override
  void paint(Canvas canvas, Size size) {
    const gap = _kPageGap;

    // Desk showing through between pages.
    canvas.drawRect(
        Rect.fromLTWH(0, 0, size.width, size.height), Paint()..color = gapColor);

    const cell = 18.0;      // dotted / grid pitch
    const lineStep = 26.0;  // ruled pitch

    // Prefix sum, computed once — reading `tops[i]` inside the loop instead
    // of mutating a running total keeps this correct across the `continue`
    // below (a `continue` skipping a mutation-at-the-bottom pattern is a
    // classic way to silently stop advancing).
    final tops = <double>[];
    var acc = 0.0;
    for (final h in pageHeights) {
      tops.add(acc);
      acc += h + gap;
    }

    for (var i = 0; i < pageHeights.length; i++) {
      final pageH = pageHeights[i];
      final top = tops[i];
      if (top >= size.height) break;
      final bottom = math.min(top + pageH, size.height);
      final rect = Rect.fromLTRB(0, top, size.width, bottom);

      final page = _page(i);
      // Dart privacy is per-library (file), not per-class, so this reaches
      // _NoteCanvasPageState's private key builder directly — keeping the key
      // format defined in exactly one place rather than duplicated here.
      final image = page.isPdfBacked
          ? pdfImages[_NoteCanvasPageState._pdfImageKey(
              page.pdfPath!, page.pdfPageIndex!)]
          : null;
      if (image != null) {
        canvas.drawImageRect(
          image,
          Rect.fromLTWH(0, 0, image.width.toDouble(), image.height.toDouble()),
          rect,
          // This is a whole-page image drawn once per repaint (not per pen
          // sample), so the highest filter quality costs nothing that matters
          // here — worth it given the source bitmap is now much closer to the
          // real screen resolution than before.
          Paint()..filterQuality = FilterQuality.high,
        );
      } else {
        // Either not PDF-backed, or the render hasn't landed yet — either
        // way, its own paper fill in the meantime.
        canvas.drawRect(rect, Paint()..color = paperColor(page.tint));
      }
      if (page.style == PaperStyle.plain) continue;

      final ruleColor = _rule(page.tint);
      final dp = Paint()..color = ruleColor;
      final lp = Paint()
        ..color = ruleColor
        ..strokeWidth = 0.9
        ..isAntiAlias = true;

      // Clip so no ruling can bleed into the page break below.
      canvas.save();
      canvas.clipRect(rect);
      switch (page.style) {
        case PaperStyle.dotted:
          for (var y = top + 10; y < bottom; y += cell) {
            for (var x = 10.0; x < size.width; x += cell) {
              canvas.drawCircle(Offset(x, y), 1.1, dp);
            }
          }
        case PaperStyle.ruled:
          for (var y = top + lineStep; y < bottom; y += lineStep) {
            canvas.drawLine(Offset(0, y), Offset(size.width, y), lp);
          }
        case PaperStyle.grid:
          for (var y = top; y < bottom; y += cell) {
            canvas.drawLine(Offset(0, y), Offset(size.width, y), lp);
          }
          for (var x = 0.0; x < size.width; x += cell) {
            canvas.drawLine(Offset(x, top), Offset(x, bottom), lp);
          }
        case PaperStyle.plain:
          break;
      }
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(_PersonalPaperPainter old) =>
      !listEquals(old.pageHeights, pageHeights) ||
      old.gapColor != gapColor ||
      old.pdfImageGen != pdfImageGen ||
      !listEquals(old.paper, paper);
}
