import 'dart:async';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';

import '../../../theme/tokens.dart';
import '../osce_repository.dart';

/// Heart/lung sound with **labelled timing segments** — S1, S2, opening snap,
/// the murmur — that highlight as playback crosses them.
///
/// The existing auscultation player draws a decorative bar loop driven by a
/// clock, unrelated to the audio. These segments are real: they come from the
/// case document in milliseconds, so a student can see *when* in the cycle to
/// listen, and compare against normal with one tap.
class SoundPlayerMarkers extends StatefulWidget {
  final OsceSound sound;
  const SoundPlayerMarkers({super.key, required this.sound});

  @override
  State<SoundPlayerMarkers> createState() => _SoundPlayerMarkersState();
}

class _SoundPlayerMarkersState extends State<SoundPlayerMarkers> {
  final AudioPlayer _player = AudioPlayer();
  StreamSubscription<Duration>? _posSub;
  StreamSubscription<Duration>? _durSub;
  StreamSubscription<void>? _endSub;

  Duration _position = Duration.zero;
  Duration _duration = Duration.zero;
  bool _playing = false;
  /// Fetching the clip before the first note sounds. On a ward connection that
  /// is a few seconds of a button that looks like it did nothing, which reads
  /// as a broken app — so the button says it is working.
  bool _loading = false;
  bool _comparing = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _posSub = _player.onPositionChanged.listen((p) {
      if (mounted) setState(() => _position = p);
    });
    _durSub = _player.onDurationChanged.listen((d) {
      if (mounted) setState(() => _duration = d);
    });
    _endSub = _player.onPlayerComplete.listen((_) {
      if (mounted) setState(() { _playing = false; _position = Duration.zero; });
    });
  }

  @override
  void dispose() {
    _posSub?.cancel();
    _durSub?.cancel();
    _endSub?.cancel();
    _player.dispose();
    super.dispose();
  }

  String get _url => _comparing ? widget.sound.compareUrl : widget.sound.audioUrl;

  Future<void> _toggle() async {
    if (_url.isEmpty) {
      setState(() => _error = 'No recording is attached to this finding yet.');
      return;
    }
    try {
      if (_playing) {
        await _player.pause();
        if (mounted) setState(() => _playing = false);
      } else {
        setState(() { _loading = true; _error = null; });
        // play() does not return until the clip has been fetched and started.
        await _player.play(UrlSource(_url));
        if (mounted) setState(() { _playing = true; _loading = false; });
      }
    } catch (e) {
      if (mounted) setState(() { _error = 'Could not play this clip.'; _loading = false; });
    }
  }

  Future<void> _switchSource(bool compare) async {
    if (_comparing == compare) return;
    await _player.stop();
    if (!mounted) return;
    setState(() {
      _comparing = compare;
      _playing = false;
      _loading = false;
      _position = Duration.zero;
    });
  }

  /// Which segment the playhead is inside, so it can be highlighted.
  int get _activeMarker {
    final markers = widget.sound.markers;
    if (markers.isEmpty || _duration.inMilliseconds == 0) return -1;
    // Markers describe one cycle; the clip usually holds several.
    final cycle = markers.last.to;
    if (cycle <= 0) return -1;
    final within = _position.inMilliseconds % cycle;
    for (var i = 0; i < markers.length; i++) {
      if (within >= markers[i].from && within < markers[i].to) return i;
    }
    return -1;
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final markers = widget.sound.markers;
    final active = _activeMarker;
    final hasCompare = widget.sound.compareUrl.isNotEmpty;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: c.card,
        borderRadius: BorderRadius.circular(AppRadius.inner),
        border: Border.all(color: c.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (hasCompare)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(
                children: [
                  _Toggle(
                    label: widget.sound.title,
                    active: !_comparing,
                    onTap: () => _switchSource(false),
                  ),
                  const SizedBox(width: 6),
                  _Toggle(
                    label: 'Normal',
                    active: _comparing,
                    onTap: () => _switchSource(true),
                  ),
                ],
              ),
            ),

          // The cycle strip — proportional segments, highlighted as they play.
          if (markers.isNotEmpty)
            SizedBox(
              height: 42,
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final span = markers.last.to.toDouble();
                  if (span <= 0) return const SizedBox.shrink();
                  return Stack(
                    children: [
                      Positioned.fill(
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            color: c.surface2,
                            borderRadius: BorderRadius.circular(8),
                          ),
                        ),
                      ),
                      for (var i = 0; i < markers.length; i++)
                        Positioned(
                          left: (markers[i].from / span) * constraints.maxWidth,
                          width: ((markers[i].to - markers[i].from) / span) * constraints.maxWidth,
                          top: 0,
                          bottom: 0,
                          child: Container(
                            margin: const EdgeInsets.symmetric(horizontal: 1),
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: (i == active ? c.primary : c.inkMuted)
                                  .withValues(alpha: i == active ? 0.32 : 0.12),
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(
                                color: (i == active ? c.primary : c.inkMuted)
                                    .withValues(alpha: i == active ? 0.7 : 0.22),
                              ),
                            ),
                            child: FittedBox(
                              fit: BoxFit.scaleDown,
                              child: Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 3),
                                child: Text(
                                  markers[i].label,
                                  style: TextStyle(
                                    fontSize: 10.5,
                                    fontWeight: FontWeight.w800,
                                    color: i == active ? c.inkStrong : c.inkMuted,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                    ],
                  );
                },
              ),
            ),

          const SizedBox(height: 12),

          Row(
            children: [
              GestureDetector(
                onTap: _loading ? null : _toggle,
                child: Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(color: c.primary, shape: BoxShape.circle),
                  child: _loading
                      ? Center(
                          child: SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2.2,
                              color: Theme.of(context).brightness == Brightness.dark
                                  ? const Color(0xFF04121F)
                                  : Colors.white,
                            ),
                          ),
                        )
                      : Icon(
                          _playing ? Icons.pause_rounded : Icons.play_arrow_rounded,
                          color: Theme.of(context).brightness == Brightness.dark
                              ? const Color(0xFF04121F)
                              : Colors.white,
                          size: 24,
                        ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _comparing ? 'Normal heart sounds' : widget.sound.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                          fontSize: 13.5, fontWeight: FontWeight.w700, color: c.inkStrong),
                    ),
                    const SizedBox(height: 4),
                    SizedBox(
                      height: 18,
                      child: Slider(
                        value: _duration.inMilliseconds == 0
                            ? 0
                            : _position.inMilliseconds
                                .clamp(0, _duration.inMilliseconds)
                                .toDouble(),
                        max: _duration.inMilliseconds == 0
                            ? 1
                            : _duration.inMilliseconds.toDouble(),
                        onChanged: (v) =>
                            _player.seek(Duration(milliseconds: v.round())),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),

          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(_error!,
                  style: TextStyle(fontSize: 12, color: c.warning)),
            ),
        ],
      ),
    );
  }
}

class _Toggle extends StatelessWidget {
  final String label;
  final bool active;
  final VoidCallback onTap;
  const _Toggle({required this.label, required this.active, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 10),
          decoration: BoxDecoration(
            color: active ? c.primary.withValues(alpha: 0.16) : c.surface2,
            borderRadius: BorderRadius.circular(9),
            border: Border.all(color: active ? c.primary.withValues(alpha: 0.5) : c.line),
          ),
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: active ? c.inkStrong : c.inkMuted,
            ),
          ),
        ),
      ),
    );
  }
}
