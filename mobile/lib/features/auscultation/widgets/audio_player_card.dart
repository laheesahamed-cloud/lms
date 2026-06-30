import 'dart:io';
import 'dart:math' as math;
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';

import '../../../theme/tokens.dart';
import '../auscultation_repository.dart';

String _extForMime(String mime) {
  switch (mime) {
    case 'audio/mp4':
    case 'audio/x-m4a':
    case 'audio/aac':
      return 'm4a';
    case 'audio/wav':
    case 'audio/x-wav':
      return 'wav';
    case 'audio/ogg':
      return 'ogg';
    case 'audio/webm':
      return 'webm';
    default:
      return 'mp3';
  }
}

const _heartAccent = Color(0xFFE0567B);
const _lungAccent = Color(0xFF2F9E8F);

String _fmt(Duration d) {
  final m = d.inMinutes;
  final s = d.inSeconds % 60;
  return '$m:${s.toString().padLeft(2, '0')}';
}

/// Authenticated audio player with a built-in playback visualizer.
class AudioPlayerCard extends ConsumerStatefulWidget {
  final String kind; // 'cards' | 'quiz'
  final int id;
  final String category; // 'heart' | 'lung'
  final String? title;
  const AudioPlayerCard({super.key, required this.kind, required this.id, required this.category, this.title});

  @override
  ConsumerState<AudioPlayerCard> createState() => _AudioPlayerCardState();
}

class _AudioPlayerCardState extends ConsumerState<AudioPlayerCard> {
  final AudioPlayer _player = AudioPlayer();
  String? _filePath;
  bool _loading = false;
  bool _playing = false;
  String? _error;
  Duration _pos = Duration.zero;
  Duration _dur = Duration.zero;

  Color get _accent => widget.category == 'lung' ? _lungAccent : _heartAccent;

  @override
  void initState() {
    super.initState();
    _player.onPlayerStateChanged.listen((s) {
      if (!mounted) return;
      setState(() => _playing = s == PlayerState.playing);
    });
    _player.onPositionChanged.listen((p) { if (mounted) setState(() => _pos = p); });
    _player.onDurationChanged.listen((d) { if (mounted) setState(() => _dur = d); });
    _player.onPlayerComplete.listen((_) { if (mounted) setState(() { _playing = false; _pos = Duration.zero; }); });
  }

  @override
  void dispose() {
    _player.dispose();
    super.dispose();
  }

  Future<void> _toggle() async {
    if (_playing) { await _player.pause(); return; }
    if (_filePath == null) {
      setState(() { _loading = true; _error = null; });
      try {
        final res = await ref.read(auscultationRepositoryProvider).audioBytes(widget.kind, widget.id);
        final dir = await getTemporaryDirectory();
        final file = File('${dir.path}/ausc_${widget.kind}_${widget.id}.${_extForMime(res.mime)}');
        await file.writeAsBytes(res.bytes, flush: true);
        _filePath = file.path;
      } catch (_) {
        if (mounted) setState(() { _error = 'Could not load audio'; _loading = false; });
        return;
      }
      if (!mounted) return;
      setState(() => _loading = false);
    }
    try {
      if (_pos > Duration.zero && _pos < _dur) {
        await _player.resume();
      } else {
        await _player.play(DeviceFileSource(_filePath!));
      }
    } catch (_) {
      if (mounted) setState(() => _error = 'Playback failed');
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: c.surface2,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: c.line),
      ),
      child: Row(
        children: [
          // Play / pause
          GestureDetector(
            onTap: _loading ? null : _toggle,
            child: Container(
              width: 52, height: 52,
              decoration: BoxDecoration(
                color: _accent, shape: BoxShape.circle,
                boxShadow: [BoxShadow(color: _accent.withValues(alpha: 0.4), blurRadius: 14, offset: const Offset(0, 5))],
              ),
              child: _loading
                  ? const Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white))
                  : Icon(_playing ? Icons.pause_rounded : Icons.play_arrow_rounded, color: Colors.white, size: 28),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    if (widget.title != null)
                      Expanded(child: Text(widget.title!, maxLines: 1, overflow: TextOverflow.ellipsis,
                          style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: c.inkStrong))),
                    Icon(widget.category == 'lung' ? Icons.air_rounded : Icons.favorite_rounded, size: 13, color: _accent),
                    const SizedBox(width: 4),
                    Text(widget.category == 'lung' ? 'Lung' : 'Heart',
                        style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: c.inkSoft)),
                  ],
                ),
                const SizedBox(height: 8),
                _Visualizer(playing: _playing, category: widget.category, accent: _accent, idle: c.inkMuted.withValues(alpha: 0.3)),
                const SizedBox(height: 8),
                // Progress
                SizedBox(
                  height: 18,
                  child: SliderTheme(
                    data: SliderThemeData(
                      trackHeight: 3,
                      thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
                      overlayShape: const RoundSliderOverlayShape(overlayRadius: 12),
                      activeTrackColor: _accent,
                      inactiveTrackColor: c.lineMedium,
                      thumbColor: _accent,
                    ),
                    child: Slider(
                      value: _dur.inMilliseconds == 0 ? 0 : _pos.inMilliseconds.clamp(0, _dur.inMilliseconds).toDouble(),
                      max: _dur.inMilliseconds == 0 ? 1 : _dur.inMilliseconds.toDouble(),
                      onChanged: _dur.inMilliseconds == 0 ? null : (v) => _player.seek(Duration(milliseconds: v.round())),
                    ),
                  ),
                ),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(_fmt(_pos), style: TextStyle(fontSize: 11, color: c.inkMuted)),
                    Text(_dur == Duration.zero ? '--:--' : _fmt(_dur), style: TextStyle(fontSize: 11, color: c.inkMuted)),
                  ],
                ),
                if (_error != null) Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(_error!, style: const TextStyle(fontSize: 12, color: Colors.red)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Animated playback visualizer — heart = beat pulse, lung = breathing wave.
class _Visualizer extends StatefulWidget {
  final bool playing;
  final String category;
  final Color accent;
  final Color idle;
  const _Visualizer({required this.playing, required this.category, required this.accent, required this.idle});

  @override
  State<_Visualizer> createState() => _VisualizerState();
}

class _VisualizerState extends State<_Visualizer> with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    final period = widget.category == 'lung' ? 2600 : 850;
    _ctrl = AnimationController(vsync: this, duration: Duration(milliseconds: period));
    if (widget.playing) _ctrl.repeat();
  }

  @override
  void didUpdateWidget(covariant _Visualizer old) {
    super.didUpdateWidget(old);
    if (widget.playing && !_ctrl.isAnimating) _ctrl.repeat();
    if (!widget.playing && _ctrl.isAnimating) _ctrl.stop();
  }

  @override
  void dispose() { _ctrl.dispose(); super.dispose(); }

  double _bar(double t, int i, int n) {
    if (!widget.playing) return 0.18;
    final phase = i / n;
    if (widget.category == 'lung') {
      // smooth breathing swell
      return 0.22 + 0.58 * (0.5 - 0.5 * math.cos(2 * math.pi * ((t + phase * 0.12) % 1)));
    }
    // sharp heart beat
    final x = (t + phase * 0.06) % 1;
    if (x < 0.12) return 0.16 + (0.92 - 0.16) * (x / 0.12);
    if (x < 0.22) return 0.92 - (0.92 - 0.30) * ((x - 0.12) / 0.10);
    if (x < 0.34) return 0.30 + (0.64 - 0.30) * ((x - 0.22) / 0.12);
    if (x < 0.50) return 0.64 - (0.64 - 0.18) * ((x - 0.34) / 0.16);
    return 0.18;
  }

  @override
  Widget build(BuildContext context) {
    final n = widget.category == 'lung' ? 5 : 7;
    return SizedBox(
      height: 30,
      child: AnimatedBuilder(
        animation: _ctrl,
        builder: (context, _) {
          return Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: List.generate(n, (i) {
              final h = _bar(_ctrl.value, i, n) * 30;
              return Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 2),
                  child: Align(
                    alignment: Alignment.center,
                    child: Container(
                      height: h.clamp(3, 30),
                      decoration: BoxDecoration(
                        color: widget.playing ? widget.accent : widget.idle,
                        borderRadius: BorderRadius.circular(999),
                      ),
                    ),
                  ),
                ),
              );
            }),
          );
        },
      ),
    );
  }
}
