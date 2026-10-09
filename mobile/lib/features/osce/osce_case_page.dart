import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../theme/tokens.dart';
import 'osce_repository.dart';
import 'osce_media_cache.dart';
import 'widgets/sign_detail_view.dart';
import 'widgets/sound_player_markers.dart';
import 'widgets/zoomable_hotspot_image.dart';
import 'widgets/osce_practice.dart';
import 'widgets/osce_media_view.dart';

enum _Stop { exam, chain, investigations, treatment, summary, practice }

const _stopLabels = {
  _Stop.exam: 'EXAM',
  _Stop.chain: 'MECHANISM',
  _Stop.investigations: 'IX',
  _Stop.treatment: 'TREAT',
  _Stop.summary: 'SUMMARY',
  _Stop.practice: 'OSCE',
};

/// A station is a walkthrough, not a set of tabs. Each step says what it is and
/// why you are there, so "where am I / what am I doing" is answered on screen.
const _stopTitles = {
  _Stop.exam: 'Examine the patient',
  _Stop.chain: 'How it happens',
  _Stop.investigations: 'Investigations',
  _Stop.treatment: 'What you do about it',
  _Stop.summary: 'Pull it together',
  _Stop.practice: 'Practise the station',
};

const _stopPurpose = {
  _Stop.exam: 'Work head to toe. Tap each finding to examine it properly.',
  _Stop.chain: 'Follow the mechanism from cause to the signs you just found.',
  _Stop.investigations: 'Read each investigation and name the findings.',
  _Stop.treatment: 'Now you know what it is — what you do, in the order you do it.',
  _Stop.summary: 'The points an examiner is listening for.',
  _Stop.practice: 'Tick off the examination, then answer the viva questions.',
};

class OsceCasePage extends ConsumerStatefulWidget {
  final String slug;
  const OsceCasePage({super.key, required this.slug});

  @override
  ConsumerState<OsceCasePage> createState() => _OsceCasePageState();
}

class _OsceCasePageState extends ConsumerState<OsceCasePage> {
  _Stop _stop = _Stop.exam;
  String? _sceneId;
  final Map<String, bool> _checked = {};

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final async = ref.watch(osceCaseProvider(widget.slug));

    return Scaffold(
      backgroundColor: c.page,
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('Could not open this station.',
                      style: TextStyle(fontSize: 15, color: c.inkMedium)),
                  const SizedBox(height: 10),
                  TextButton(
                    onPressed: () => ref.invalidate(osceCaseProvider(widget.slug)),
                    child: const Text('Try again'),
                  ),
                ],
              ),
            ),
          ),
        ),
        data: (kase) {
          // Warm the rest of the station's pictures in the background, so the
          // stops the student hasn't reached yet still open with no signal.
          _prefetch(kase);
          final stops = _availableStops(kase);
          final index = stops.indexOf(_stop);
          final step = index < 0 ? 0 : index;
          return SafeArea(
            child: Column(
              children: [
                _CaseHeader(
                  title: kase.title,
                  step: step + 1,
                  total: stops.length,
                  stopTitle: _stopTitles[_stop] ?? '',
                ),
                // The page chrome stays put — header, rail and the scroll area
                // never animate. Fading the whole page on every move is what made
                // each step feel like a different screen instead of one journey.
                Expanded(child: _buildStop(kase, stops, step)),
                _StopRail(
                  current: _stop,
                  available: stops,
                  onSelect: (s) => setState(() { _stop = s; _sceneId = null; }),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  List<_Stop> _availableStops(OsceCase kase) => [
        if (kase.scenes.isNotEmpty) _Stop.exam,
        if (kase.chain.isNotEmpty) _Stop.chain,
        if (kase.investigations.isNotEmpty) _Stop.investigations,
        if (kase.treatment.isNotEmpty) _Stop.treatment,
        if (kase.keyPoints.isNotEmpty || kase.osceTips.isNotEmpty || kase.related.isNotEmpty)
          _Stop.summary,
        if (kase.checklist.isNotEmpty || kase.questions.isNotEmpty) _Stop.practice,
      ];

  Widget _buildStop(OsceCase kase, List<_Stop> stops, int step) {
    final next = step + 1 < stops.length ? stops[step + 1] : null;
    final nextButton = next == null
        ? null
        : _NextStep(
            label: _stopTitles[next] ?? '',
            onTap: () => setState(() { _stop = next; _sceneId = null; }),
          );

    switch (_stop) {
      case _Stop.exam:
        return _ExamStop(
          kase: kase,
          sceneId: _sceneId ?? kase.rootScene?.id,
          onScene: (id) => setState(() => _sceneId = id),
          purpose: _stopPurpose[_Stop.exam]!,
          nextStep: nextButton,
        );
      case _Stop.chain:
        return _ChainStop(kase: kase, purpose: _stopPurpose[_Stop.chain]!, nextStep: nextButton);
      case _Stop.investigations:
        return _InvestigationsStop(
            kase: kase, purpose: _stopPurpose[_Stop.investigations]!, nextStep: nextButton);
      case _Stop.treatment:
        return _TreatmentStop(
            kase: kase, purpose: _stopPurpose[_Stop.treatment]!, nextStep: nextButton);
      case _Stop.summary:
        return _SummaryStop(
            kase: kase, purpose: _stopPurpose[_Stop.summary]!, nextStep: nextButton);
      case _Stop.practice:
        return _PracticeStop(
          kase: kase,
          purpose: _stopPurpose[_Stop.practice]!,
          checked: _checked,
          onToggle: (key) {
            setState(() => _checked[key] = !(_checked[key] ?? false));
            _persist(kase);
          },
        );
    }
  }

  // Prefetch once per station. Re-running it on every rebuild would queue the
  // same downloads repeatedly; the cache would dedupe them, but the wasted
  // futures are avoidable.
  String? _prefetched;
  void _prefetch(OsceCase kase) {
    if (_prefetched == kase.slug) return;
    _prefetched = kase.slug;
    ref.read(osceMediaCacheProvider).prefetch(kase.imageUrls);
  }

  void _persist(OsceCase kase) {
    // Fire-and-forget: a dropped tick isn't worth interrupting the student for.
    ref.read(osceRepositoryProvider)
        .saveProgress(kase.id, checklist: _checked, seen: const [])
        .catchError((_) {});
  }
}

/* ───────────────────────── chrome ───────────────────────── */

class _CaseHeader extends StatelessWidget {
  final String title;
  final int step;
  final int total;
  final String stopTitle;
  const _CaseHeader({
    required this.title,
    required this.step,
    required this.total,
    required this.stopTitle,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Padding(
      padding: const EdgeInsets.fromLTRB(6, 4, 16, 8),
      child: Row(
        children: [
          IconButton(
            onPressed: () => Navigator.of(context).maybePop(),
            icon: Icon(Icons.chevron_left_rounded, size: 30, color: c.inkStrong),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                        fontSize: 16, fontWeight: FontWeight.w800, color: c.inkStrong)),
                if (total > 0)
                  Text('Step $step of $total  ·  $stopTitle',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: c.inkMuted)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

enum _RailState { done, current, upcoming }

/// The rail doubles as a progress bar — passed steps read as done, so the
/// station feels like a sequence rather than five interchangeable tabs.
class _RailStep extends StatelessWidget {
  final String label;
  final int index;
  final _RailState state;
  const _RailStep({required this.label, required this.index, required this.state});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final current = state == _RailState.current;
    final done = state == _RailState.done;
    final onPrimary = Theme.of(context).brightness == Brightness.dark
        ? const Color(0xFF04121F)
        : Colors.white;

    return AnimatedContainer(
      duration: AppDur.hover,
      curve: AppCurves.standard,
      padding: const EdgeInsets.symmetric(vertical: 8),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: current
            ? c.primary
            : done
                ? c.primary.withValues(alpha: 0.14)
                : c.card,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
            color: current
                ? c.primary
                : done
                    ? c.primary.withValues(alpha: 0.4)
                    : c.line),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (done)
            Icon(Icons.check_rounded, size: 12, color: c.primary)
          else
            Text('${index + 1}',
                style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    color: current ? onPrimary : c.inkMuted)),
          const SizedBox(height: 1),
          Text(label,
              style: TextStyle(
                fontSize: 8.5,
                letterSpacing: 0.3,
                fontWeight: FontWeight.w800,
                color: current ? onPrimary : c.inkMuted,
              )),
        ],
      ),
    );
  }
}

/// The explicit way forward at the end of every step.
class _NextStep extends StatelessWidget {
  final String label;
  final VoidCallback onTap;
  const _NextStep({required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final onPrimary = Theme.of(context).brightness == Brightness.dark
        ? const Color(0xFF04121F)
        : Colors.white;
    return Padding(
      padding: const EdgeInsets.only(top: 22),
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
          decoration: BoxDecoration(
            color: c.primary,
            borderRadius: BorderRadius.circular(13),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text('Next: $label',
                  style: TextStyle(
                      fontSize: 14, fontWeight: FontWeight.w800, color: onPrimary)),
              const SizedBox(width: 4),
              Icon(Icons.chevron_right_rounded, size: 20, color: onPrimary),
            ],
          ),
        ),
      ),
    );
  }
}

/// One line saying why this step exists, shown at the top of each.
class _Purpose extends StatelessWidget {
  final String text;
  const _Purpose(this.text);

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Text(text,
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(fontSize: 13.5, height: 1.4, color: c.inkSoft));
  }
}

class _StopRail extends StatelessWidget {
  final _Stop current;
  final List<_Stop> available;
  final ValueChanged<_Stop> onSelect;
  const _StopRail({required this.current, required this.available, required this.onSelect});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    if (available.length < 2) return const SizedBox.shrink();
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
      decoration: BoxDecoration(border: Border(top: BorderSide(color: c.line))),
      child: Row(
        children: [
          for (final stop in available)
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 2),
                child: GestureDetector(
                  onTap: () => onSelect(stop),
                  child: _RailStep(
                    label: _stopLabels[stop] ?? '',
                    index: available.indexOf(stop),
                    state: stop == current
                        ? _RailState.current
                        : (available.indexOf(stop) < available.indexOf(current)
                            ? _RailState.done
                            : _RailState.upcoming),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/* ─────────────────────── exam (scenes) ─────────────────────── */

/// The examination step.
///
/// A dense case (heart failure has nine findings) turns into an unreadable wall
/// of labels, so: dots carry no label until tapped, findings can be filtered by
/// examination stage, and a list beneath the figure enumerates them — a picture
/// with nine dots does not tell a student there are nine things to find.
class _ExamStop extends StatefulWidget {
  final OsceCase kase;
  final String? sceneId;
  final ValueChanged<String> onScene;
  final String purpose;
  final Widget? nextStep;
  const _ExamStop({
    required this.kase,
    required this.sceneId,
    required this.onScene,
    required this.purpose,
    this.nextStep,
  });

  @override
  State<_ExamStop> createState() => _ExamStopState();
}

class _ExamStopState extends State<_ExamStop> {
  String _stage = 'all';
  OsceHotspot? _peek;
  /// Which way the last scene change travelled, so the transition can move the
  /// same way — pushing in when you zoom, pulling back when you go up.
  bool _zoomingIn = true;
  int _lastDepth = 0;

  int _depthOf(String? id) {
    var depth = 0;
    var node = id == null ? null : widget.kase.sceneById(id);
    var guard = 0;
    while (node?.parent != null && guard++ < 8) {
      depth++;
      node = widget.kase.sceneById(node!.parent!);
    }
    return depth;
  }

  void _goToScene(String id) {
    final next = _depthOf(id);
    setState(() {
      _zoomingIn = next >= _lastDepth;
      _lastDepth = next;
      _peek = null;
      _stage = 'all';
    });
    widget.onScene(id);
  }

  OsceScene? get _scene =>
      (widget.sceneId == null ? null : widget.kase.sceneById(widget.sceneId!))
      ?? widget.kase.rootScene;

  /// body › chest › apex — so depth is always visible and climbable.
  List<OsceScene> get _trail {
    final trail = <OsceScene>[];
    var node = _scene;
    var guard = 0;
    while (node != null && guard++ < 8) {
      trail.insert(0, node);
      node = node.parent == null ? null : widget.kase.sceneById(node.parent!);
    }
    return trail;
  }

  List<String> _stagesIn(List<OsceHotspot> spots) {
    final stages = <String>{};
    for (final h in spots) {
      if (h.actionType != 'sign') continue;
      final sign = widget.kase.signById(h.targetId);
      if (sign != null && sign.category.isNotEmpty) stages.add(sign.category);
    }
    const order = ['inspection', 'palpation', 'percussion', 'auscultation', 'symptom'];
    final list = stages.toList()
      ..sort((a, b) => order.indexOf(a).compareTo(order.indexOf(b)));
    return list;
  }

  bool _inStage(OsceHotspot h) {
    if (_stage == 'all') return true;
    if (h.actionType != 'sign') return true; // navigation dots always stay
    return widget.kase.signById(h.targetId)?.category == _stage;
  }

  void _openSign(List<OsceHotspot> signSpots, OsceHotspot hotspot) {
    final index = signSpots.indexOf(hotspot);
    setState(() => _peek = null);
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => SignDetailView(
        signs: widget.kase.signs,
        order: signSpots,
        initialIndex: index < 0 ? 0 : index,
        caseTitle: widget.kase.title,
        sound: widget.kase.sounds.isEmpty ? null : widget.kase.sounds.first,
      ),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final scene = _scene;
    if (scene == null) {
      return Center(
          child: Text('No examination views yet.', style: TextStyle(color: c.inkMuted)));
    }

    final visible = scene.hotspots.where(_inStage).toList();
    final signSpots = visible.where((h) => h.actionType == 'sign').toList();
    final stages = _stagesIn(scene.hotspots);

    return Stack(
      children: [
        ListView(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
          children: [
            // Everything above the picture is pinned to a constant height.
            // Letting this block grow or shrink — a second breadcrumb crumb, a
            // filter row present on some scenes and not others — moved where the
            // image started, so it read as sliding up or down no matter what the
            // transition itself was doing.
            SizedBox(
              height: 112,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(height: 38, child: _Purpose(widget.purpose)),
                  SizedBox(
                    height: 26,
                    child: _Breadcrumb(trail: _trail, onTap: _goToScene),
                  ),
                  const SizedBox(height: 10),
                  // Always rendered, even with a single stage, so the row can
                  // never appear and disappear between scenes.
                  SizedBox(
                    height: 32,
                    child: _StageFilter(
                      stages: stages,
                      value: _stage,
                      onChanged: (v) => setState(() { _stage = v; _peek = null; }),
                    ),
                  ),
                ],
              ),
            ),

            if (scene.image != null)
              // One continuous camera move: the old view keeps travelling in the
              // direction you went while the new one settles from the same
              // direction. Both parts move the same way, so going deeper reads as
              // pushing INTO the body rather than two images trading places.
              AnimatedSwitcher(
                duration: AppDur.route,
                switchInCurve: AppCurves.easeOut,
                switchOutCurve: AppCurves.easeOut,
                layoutBuilder: (current, previous) => Stack(
                  alignment: Alignment.topCenter,
                  children: [...previous, ?current],
                ),
                transitionBuilder: (child, anim) {
                  final incoming = child.key == ValueKey('${scene.id}_$_stage');
                  // Deeper: start large and settle. Shallower: start small and settle.
                  final from = _zoomingIn ? 1.18 : 0.86;
                  final scale = incoming
                      ? Tween<double>(begin: from, end: 1).animate(anim)
                      : Tween<double>(begin: 1, end: _zoomingIn ? 0.86 : 1.18).animate(
                          ReverseAnimation(anim));
                  return FadeTransition(
                    opacity: anim,
                    child: ScaleTransition(scale: scale, child: child),
                  );
                },
                child: KeyedSubtree(
                  key: ValueKey('${scene.id}_$_stage'),
                  child: ZoomableHotspotImage(
                    imageUrl: scene.image!.full,
                    // Portrait only for the whole patient; every region and
                    // organ view is landscape.
                    aspectRatio: scene.parent == null ? 3 / 4 : 4 / 3,
                    showLabels: false,
                    hotspots: [
                      for (final h in visible)
                        HotspotMarker(
                          x: h.x,
                          y: h.y,
                          label: h.label,
                          isZoom: h.actionType == 'scene',
                          onTap: () {
                            HapticFeedback.selectionClick();
                            if (h.actionType == 'scene' && h.targetId.isNotEmpty) {
                              _goToScene(h.targetId);
                            } else if (h.actionType == 'sign') {
                              setState(() => _peek = h);
                            }
                          },
                        ),
                    ],
                  ),
                ),
              )
            else
              Container(
                height: 180,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: c.surface2,
                  borderRadius: BorderRadius.circular(AppRadius.inner),
                  border: Border.all(color: c.line),
                ),
                child: Text('This view has no image yet.',
                    style: TextStyle(fontSize: 13, color: c.inkMuted)),
              ),

            const SizedBox(height: 12),
            Row(
              children: [
                _Legend(color: c.accent, label: 'finding'),
                const SizedBox(width: 14),
                _Legend(color: c.primary, label: 'zoom in'),
              ],
            ),

            // The figure shows where; the list says how many and what.
            if (signSpots.isNotEmpty) ...[
              const SizedBox(height: 18),
              Text('${signSpots.length} finding${signSpots.length == 1 ? '' : 's'} here',
                  style: TextStyle(
                      fontSize: 11,
                      letterSpacing: 1,
                      fontWeight: FontWeight.w800,
                      color: c.inkMuted)),
              const SizedBox(height: 8),
              for (final h in signSpots)
                _FindingRow(
                  hotspot: h,
                  sign: widget.kase.signById(h.targetId),
                  onTap: () => _openSign(signSpots, h),
                ),
            ],

            if (widget.kase.sounds.isNotEmpty) ...[
              const SizedBox(height: 18),
              Text('Auscultation',
                  style: TextStyle(
                      fontSize: 15, fontWeight: FontWeight.w800, color: c.inkStrong)),
              const SizedBox(height: 10),
              SoundPlayerMarkers(sound: widget.kase.sounds.first),
            ],

            ?widget.nextStep,
          ],
        ),

        // The peek: enough to triage a finding without leaving the patient.
        if (_peek != null)
          Positioned(
            left: 16,
            right: 16,
            bottom: 16,
            child: _PeekCard(
              sign: widget.kase.signById(_peek!.targetId),
              fallbackLabel: _peek!.label,
              onOpen: () => _openSign(signSpots, _peek!),
              onClose: () => setState(() => _peek = null),
            ),
          ),
      ],
    );
  }
}

/// Where you are in the zoom chain, and a way back up it.
class _Breadcrumb extends StatelessWidget {
  final List<OsceScene> trail;
  final ValueChanged<String> onTap;
  const _Breadcrumb({required this.trail, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    if (trail.length < 2) {
      return Align(
        alignment: Alignment.centerLeft,
        child: Text(trail.isEmpty ? '' : trail.first.title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
                fontSize: 17, fontWeight: FontWeight.w800, color: c.inkStrong)),
      );
    }
    // One line always — a wrapping trail would change this block's height.
    return ListView(
      scrollDirection: Axis.horizontal,
      children: [
        for (var i = 0; i < trail.length; i++) ...[
          GestureDetector(
            onTap: i == trail.length - 1 ? null : () => onTap(trail[i].id),
            child: Text(
              trail[i].title,
              style: TextStyle(
                fontSize: i == trail.length - 1 ? 17 : 13.5,
                fontWeight: i == trail.length - 1 ? FontWeight.w800 : FontWeight.w600,
                color: i == trail.length - 1 ? c.inkStrong : c.primary,
              ),
            ),
          ),
          if (i < trail.length - 1)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 6),
              child: Icon(Icons.chevron_right_rounded, size: 15, color: c.inkMuted),
            ),
        ],
      ],
    );
  }
}

/// Inspection → palpation → auscultation. Cuts a crowded body down to the
/// findings of one examination stage, which is also the order you examine in.
class _StageFilter extends StatelessWidget {
  final List<String> stages;
  final String value;
  final ValueChanged<String> onChanged;
  const _StageFilter({
    required this.stages,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    Widget chip(String key, String label) {
      final on = value == key;
      return Padding(
        padding: const EdgeInsets.only(right: 6),
        child: GestureDetector(
          onTap: () => onChanged(key),
          child: AnimatedContainer(
            duration: AppDur.hover,
            curve: AppCurves.standard,
            padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
            decoration: BoxDecoration(
              color: on ? c.primary.withValues(alpha: 0.16) : c.card,
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: on ? c.primary.withValues(alpha: 0.5) : c.line),
            ),
            child: Text(label,
                style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: on ? c.inkStrong : c.inkMuted)),
          ),
        ),
      );
    }

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          chip('all', 'All'),
          for (final stage in stages)
            chip(stage, stage[0].toUpperCase() + stage.substring(1)),
        ],
      ),
    );
  }
}

/// A finding in the list under the figure.
class _FindingRow extends StatelessWidget {
  final OsceHotspot hotspot;
  final OsceSign? sign;
  final VoidCallback onTap;
  const _FindingRow({required this.hotspot, required this.sign, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Padding(
      padding: const EdgeInsets.only(bottom: 7),
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
          decoration: BoxDecoration(
            color: c.card,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: c.line),
          ),
          child: Row(
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(color: c.accent, shape: BoxShape.circle),
              ),
              const SizedBox(width: 11),
              Expanded(
                child: Text(sign?.name ?? hotspot.label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w600,
                        color: c.inkStrong)),
              ),
              if (sign != null && sign!.category.isNotEmpty)
                Text(sign!.category,
                    style: TextStyle(fontSize: 11, color: c.inkMuted)),
              const SizedBox(width: 6),
              Icon(Icons.chevron_right_rounded, size: 18, color: c.inkMuted),
            ],
          ),
        ),
      ),
    );
  }
}

/// Tapping a dot peeks rather than leaving: enough to recognise the finding
/// with the patient still on screen, and one tap to examine it properly.
class _PeekCard extends StatelessWidget {
  final OsceSign? sign;
  final String fallbackLabel;
  final VoidCallback onOpen;
  final VoidCallback onClose;
  const _PeekCard({
    required this.sign,
    required this.fallbackLabel,
    required this.onOpen,
    required this.onClose,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: c.cardElevated,
        borderRadius: BorderRadius.circular(AppRadius.inner),
        border: Border.all(color: c.lineMedium),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withValues(alpha: 0.32),
              blurRadius: 24,
              offset: const Offset(0, 10)),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (sign?.image != null)
            ClipRRect(
              borderRadius: BorderRadius.circular(9),
              child: OsceCachedImage(
                  url: sign!.image!.thumb,
                  width: 54, height: 54, fit: BoxFit.cover,
                  placeholder: (_) => const SizedBox(width: 54, height: 54)),
            ),
          if (sign?.image != null) const SizedBox(width: 11),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(sign?.name ?? fallbackLabel,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.w800,
                        color: c.inkStrong)),
                if ((sign?.short ?? '').isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(sign!.short,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                          fontSize: 12.5, height: 1.4, color: c.inkMuted)),
                ],
                const SizedBox(height: 9),
                Row(
                  children: [
                    GestureDetector(
                      onTap: onOpen,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                        decoration: BoxDecoration(
                          color: c.primary.withValues(alpha: 0.16),
                          borderRadius: BorderRadius.circular(9),
                          border: Border.all(color: c.primary.withValues(alpha: 0.45)),
                        ),
                        child: Text('Examine ›',
                            style: TextStyle(
                                fontSize: 12.5,
                                fontWeight: FontWeight.w800,
                                color: c.primary)),
                      ),
                    ),
                    const SizedBox(width: 8),
                    GestureDetector(
                      onTap: onClose,
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 7),
                        child: Text('Close',
                            style: TextStyle(fontSize: 12.5, color: c.inkMuted)),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Legend extends StatelessWidget {
  final Color color;
  final String label;
  const _Legend({required this.color, required this.label});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(width: 8, height: 8,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 5),
        Text(label, style: TextStyle(fontSize: 11.5, color: c.inkMuted)),
      ],
    );
  }
}

/* ────────────────────── pathophysiology ────────────────────── */

class _ChainStop extends StatelessWidget {
  final OsceCase kase;
  final String purpose;
  final Widget? nextStep;
  const _ChainStop({required this.kase, required this.purpose, this.nextStep});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
      children: [
        _Purpose(purpose),
        for (var i = 0; i < kase.chain.length; i++) ...[
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 26,
                height: 26,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: c.primary.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text('${kase.chain[i].step}',
                    style: TextStyle(
                        fontSize: 12, fontWeight: FontWeight.w800, color: c.primary)),
              ),
              const SizedBox(width: 11),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(kase.chain[i].title,
                        style: TextStyle(
                            fontSize: 15, fontWeight: FontWeight.w700, color: c.inkStrong)),
                    if (kase.chain[i].body.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(kase.chain[i].body,
                          style: TextStyle(fontSize: 13.5, height: 1.55, color: c.inkMedium)),
                    ],
                    if (kase.chain[i].image != null) ...[
                      const SizedBox(height: 10),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(12),
                        child: AspectRatio(
                          aspectRatio: 1,
                          child: OsceMediaView(
                              media: kase.chain[i].image!,
                              fit: BoxFit.cover),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          if (i < kase.chain.length - 1)
            Padding(
              padding: const EdgeInsets.only(left: 12, top: 8, bottom: 8),
              child: Icon(Icons.arrow_downward_rounded, size: 18, color: c.inkMuted),
            ),
        ],
        ?nextStep,
      ],
    );
  }
}

/* ─────────────────────── investigations ────────────────────── */

class _InvestigationsStop extends StatefulWidget {
  final OsceCase kase;
  final String purpose;
  final Widget? nextStep;
  const _InvestigationsStop({required this.kase, required this.purpose, this.nextStep});

  @override
  State<_InvestigationsStop> createState() => _InvestigationsStopState();
}

class _InvestigationsStopState extends State<_InvestigationsStop> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final list = widget.kase.investigations;
    if (list.isEmpty) {
      return Center(child: Text('No investigations yet.', style: TextStyle(color: c.inkMuted)));
    }
    final active = list[_index.clamp(0, list.length - 1)];

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
      children: [
        _Purpose(widget.purpose),
        Row(
          children: [
            for (var i = 0; i < list.length; i++)
              Padding(
                padding: const EdgeInsets.only(right: 6),
                child: GestureDetector(
                  onTap: () => setState(() => _index = i),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 8),
                    decoration: BoxDecoration(
                      color: i == _index ? c.primary.withValues(alpha: 0.16) : c.card,
                      borderRadius: BorderRadius.circular(9),
                      border: Border.all(
                          color: i == _index ? c.primary.withValues(alpha: 0.5) : c.line),
                    ),
                    child: Text(list[i].modality.toUpperCase(),
                        style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            color: i == _index ? c.inkStrong : c.inkMuted)),
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 14),
        Text(active.title,
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: c.inkStrong)),
        const SizedBox(height: 10),
        if (active.image != null)
          ClipRRect(
            borderRadius: BorderRadius.circular(AppRadius.inner),
            child: OsceCachedImage(
                url: active.image!.full,
                fit: BoxFit.contain,
                placeholder: (_) => Container(
                    height: 140, color: c.surface2)),
          )
        else
          Container(
            height: 120,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: c.surface2,
              borderRadius: BorderRadius.circular(AppRadius.inner),
              border: Border.all(color: c.line),
            ),
            child: Text('No image attached yet.',
                style: TextStyle(fontSize: 13, color: c.inkMuted)),
          ),
        const SizedBox(height: 14),
        for (final finding in active.findings)
          Padding(
            padding: const EdgeInsets.only(bottom: 9),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  margin: const EdgeInsets.only(top: 7),
                  width: 5, height: 5,
                  decoration: BoxDecoration(color: c.accent, shape: BoxShape.circle),
                ),
                const SizedBox(width: 9),
                Expanded(
                  child: Text(finding,
                      style: TextStyle(fontSize: 13.5, height: 1.5, color: c.inkMedium)),
                ),
              ],
            ),
          ),
        ?widget.nextStep,
      ],
    );
  }
}

/* ────────────────────────── summary ────────────────────────── */


/// Open a finding straight from the Summary & Connect graph.
///
/// `SignDetailView` steps sideways through an ordered list, so the order here is
/// built from the graph itself — every finding the mechanism explains, in the
/// order it's read. Synthetic hotspots because that viewer is hotspot-ordered;
/// their coordinates are never used off the scene image.
void _openConnectSign(BuildContext context, OsceCase kase, String signId) {
  final ids = <String>[
    for (final step in kase.connect)
      for (final sign in step.signs) sign.id,
  ];
  final order = [
    for (final id in ids)
      OsceHotspot(x: 0, y: 0, label: '', actionType: 'sign', targetId: id),
  ];
  final index = ids.indexOf(signId);
  Navigator.of(context).push(MaterialPageRoute(
    builder: (_) => SignDetailView(
      signs: kase.signs,
      order: order,
      initialIndex: index < 0 ? 0 : index,
      caseTitle: kase.title,
      sound: kase.sounds.isEmpty ? null : kase.sounds.first,
    ),
  ));
}

/// Management, one panel per phase, in the order the author wrote them.
///
/// Grouped rather than one long list because the phase IS the teaching point:
/// what you do in the first five minutes is not what you do on discharge, and
/// an examiner asks for them in that order.
class _TreatmentStop extends StatelessWidget {
  final OsceCase kase;
  final String purpose;
  final Widget? nextStep;
  const _TreatmentStop({required this.kase, required this.purpose, this.nextStep});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final groups = kase.treatment.where((g) => g.items.isNotEmpty).toList();
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
      children: [
        _Purpose(purpose),
        for (var i = 0; i < groups.length; i++) ...[
          _Panel(
            // An unnamed group still needs a heading, or its steps read as a
            // continuation of the panel above.
            title: groups[i].group.isNotEmpty ? groups[i].group : 'Management',
            tint: c.primary,
            items: groups[i].items,
          ),
          if (i < groups.length - 1) const SizedBox(height: 12),
        ],
        ?nextStep,
      ],
    );
  }
}

class _SummaryStop extends StatelessWidget {
  final OsceCase kase;
  final String purpose;
  final Widget? nextStep;
  const _SummaryStop({required this.kase, required this.purpose, this.nextStep});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
      children: [
        _Purpose(purpose),
        if (kase.keyPoints.isNotEmpty) ...[
          _Panel(
            title: 'Key points',
            tint: c.primary,
            items: kase.keyPoints,
          ),
          const SizedBox(height: 12),
        ],
        if (kase.osceTips.isNotEmpty)
          _Panel(
            title: 'OSCE tips',
            tint: c.success,
            items: kase.osceTips,
          ),

        OsceConnectGraph(
          steps: kase.connect,
          onOpenSign: (signId) => _openConnectSign(context, kase, signId),
        ),

        OsceRelatedStations(
          related: kase.related,
          onOpen: (rel) => context.push(osceCaseRoute(rel)),
        ),
        ?nextStep,
      ],
    );
  }
}

class _Panel extends StatelessWidget {
  final String title;
  final Color tint;
  final List<String> items;
  const _Panel({required this.title, required this.tint, required this.items});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: tint.withValues(alpha: 0.07),
        borderRadius: BorderRadius.circular(AppRadius.inner),
        border: Border.all(color: tint.withValues(alpha: 0.22)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800, color: c.inkStrong)),
          const SizedBox(height: 10),
          for (final item in items)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    margin: const EdgeInsets.only(top: 7),
                    width: 5, height: 5,
                    decoration: BoxDecoration(color: tint, shape: BoxShape.circle),
                  ),
                  const SizedBox(width: 9),
                  Expanded(
                    child: Text(item,
                        style: TextStyle(fontSize: 13.5, height: 1.5, color: c.inkMedium)),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/* ────────────────────────── practice ───────────────────────── */

class _PracticeStop extends StatelessWidget {
  final OsceCase kase;
  final String purpose;
  final Map<String, bool> checked;
  final ValueChanged<String> onToggle;
  const _PracticeStop({
    required this.kase,
    required this.purpose,
    required this.checked,
    required this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
      children: [
        _Purpose(purpose),
        OscePracticeBlock(
          checklist: kase.checklist,
          questions: kase.questions,
          checked: checked,
          onToggle: onToggle,
        ),
      ],
    );
  }
}

