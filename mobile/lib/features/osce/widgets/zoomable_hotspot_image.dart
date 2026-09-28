import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../theme/tokens.dart';
import '../osce_media_cache.dart';

/// A point anchored to the image in 0–1 fraction space.
class HotspotMarker {
  final double x;
  final double y;
  final String label;
  final bool isZoom;
  final VoidCallback? onTap;
  const HotspotMarker({
    required this.x,
    required this.y,
    required this.label,
    this.isZoom = false,
    this.onTap,
  });
}

/// An image you can pinch-zoom and pan, with markers pinned to points on the
/// picture itself rather than to the screen.
///
/// Markers live inside the transformed child, so they scale and move with the
/// image for free — no inverse-matrix hit-testing needed, unlike the lesson
/// canvas, which has to map taps back into document space because it draws ink.
/// The labels are counter-scaled so text stays readable as you zoom in.
class ZoomableHotspotImage extends ConsumerStatefulWidget {
  final String imageUrl;
  final List<HotspotMarker> hotspots;
  final double aspectRatio;
  final bool showLabels;

  const ZoomableHotspotImage({
    super.key,
    required this.imageUrl,
    this.hotspots = const [],
    this.aspectRatio = 3 / 4,
    this.showLabels = true,
  });

  @override
  ConsumerState<ZoomableHotspotImage> createState() => _ZoomableHotspotImageState();
}

class _ZoomableHotspotImageState extends ConsumerState<ZoomableHotspotImage> {
  final TransformationController _controller = TransformationController();
  double _scale = 1;
  // The picture's real aspect ratio. Hotspots are fractions OF THE IMAGE, so the
  // box has to match the image exactly — forcing a fixed ratio and cropping with
  // BoxFit.cover moved every point by a different amount on every screen size.
  double? _imageRatio;
  ImageStream? _stream;
  ImageStreamListener? _listener;
  // ONE provider drives both the ratio measurement and what's drawn, so the
  // picture is fetched once. Null until the cache answers; a cache miss with no
  // network falls back to the URL so behaviour is never worse than before.
  ImageProvider? _provider;

  @override
  void initState() {
    super.initState();
    _controller.addListener(_onTransform);
    _loadProvider();
  }

  @override
  void didUpdateWidget(covariant ZoomableHotspotImage old) {
    super.didUpdateWidget(old);
    if (old.imageUrl != widget.imageUrl) {
      _imageRatio = null;
      _provider = null;
      _loadProvider();
    }
  }

  Future<void> _loadProvider() async {
    final url = widget.imageUrl;
    final file = await ref.read(osceMediaCacheProvider).file(url);
    if (!mounted || widget.imageUrl != url) return;
    setState(() {
      _provider = file != null ? FileImage(file) : NetworkImage(url);
    });
    _resolveImageRatio();
  }

  void _resolveImageRatio() {
    _detachStream();
    final provider = _provider;
    if (provider == null) return;
    final stream = provider.resolve(const ImageConfiguration());
    final listener = ImageStreamListener((info, _) {
      final ratio = info.image.width / info.image.height;
      if (mounted && ratio > 0 && _imageRatio != ratio) {
        setState(() => _imageRatio = ratio);
      }
    }, onError: (_, _) {});
    stream.addListener(listener);
    _stream = stream;
    _listener = listener;
  }

  void _detachStream() {
    if (_stream != null && _listener != null) _stream!.removeListener(_listener!);
    _stream = null;
    _listener = null;
  }

  void _onTransform() {
    final next = _controller.value.getMaxScaleOnAxis();
    // Only rebuild when the counter-scale would visibly change.
    if ((next - _scale).abs() > 0.02) setState(() => _scale = next);
  }

  @override
  void dispose() {
    _detachStream();
    _controller.removeListener(_onTransform);
    _controller.dispose();
    super.dispose();
  }

  void _reset() {
    _controller.value = Matrix4.identity();
    setState(() => _scale = 1);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;

    return Stack(
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(AppRadius.inner),
          child: AspectRatio(
            // Until the real ratio is known, fall back to the caller's hint.
            aspectRatio: _imageRatio ?? widget.aspectRatio,
            child: Container(
              color: c.surface2,
              child: InteractiveViewer(
                transformationController: _controller,
                minScale: 1,
                maxScale: 4,
                clipBehavior: Clip.hardEdge,
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    final w = constraints.maxWidth;
                    final h = constraints.maxHeight;
                    return Stack(
                      fit: StackFit.expand,
                      children: [
                        if (_provider == null)
                          Center(
                            child: SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2, color: c.inkMuted),
                            ),
                          )
                        else
                        Image(
                          image: _provider!,
                          // contain, not cover: a crop would shift every hotspot.
                          fit: BoxFit.contain,
                          errorBuilder: (_, _, _) => Center(
                            child: Icon(Icons.image_not_supported_outlined,
                                color: c.inkMuted, size: 32),
                          ),
                          loadingBuilder: (context, child, progress) => progress == null
                              ? child
                              : Center(
                                  child: SizedBox(
                                    width: 22,
                                    height: 22,
                                    child: CircularProgressIndicator(
                                        strokeWidth: 2, color: c.inkMuted),
                                  ),
                                ),
                        ),
                        for (final hotspot in widget.hotspots)
                          Positioned(
                            // Centre the DOT here. Translating a row that also
                            // contains the label pushed the dot sideways by half
                            // the label's width, so it never sat on its point.
                            left: hotspot.x * w - 16,
                            top: hotspot.y * h - 16,
                            width: 32,
                            height: 32,
                            child: _Marker(
                              marker: hotspot,
                              counterScale: 1 / _scale,
                              showLabel: widget.showLabels,
                            ),
                          ),
                      ],
                    );
                  },
                ),
              ),
            ),
          ),
        ),
        if (_scale > 1.02)
          Positioned(
            right: 10,
            bottom: 10,
            child: _ResetButton(onTap: _reset),
          ),
      ],
    );
  }
}

class _Marker extends StatelessWidget {
  final HotspotMarker marker;
  final double counterScale;
  final bool showLabel;
  const _Marker({
    required this.marker,
    required this.counterScale,
    required this.showLabel,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final tint = marker.isZoom ? c.primary : c.accent;

    return Transform.scale(
      scale: counterScale,
      child: GestureDetector(
        onTap: marker.onTap,
        behavior: HitTestBehavior.opaque,
        child: Stack(
          clipBehavior: Clip.none,
          alignment: Alignment.center,
          children: [
            Container(
              width: 16,
              height: 16,
              decoration: BoxDecoration(
                color: tint,
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white.withValues(alpha: 0.85), width: 2),
                boxShadow: [
                  BoxShadow(color: tint.withValues(alpha: 0.5), blurRadius: 10, spreadRadius: 1),
                ],
              ),
            ),
            if (showLabel && marker.label.isNotEmpty)
              Positioned(
                left: 22,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xE60B0D14),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.white.withValues(alpha: 0.14)),
                  ),
                  child: Text(
                    marker.label,
                    maxLines: 1,
                    style: const TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _ResetButton extends StatelessWidget {
  final VoidCallback onTap;
  const _ResetButton({required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
        decoration: BoxDecoration(
          color: c.card.withValues(alpha: 0.92),
          borderRadius: BorderRadius.circular(9),
          border: Border.all(color: c.line),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.zoom_out_map_rounded, size: 14, color: c.inkMedium),
            const SizedBox(width: 5),
            Text('Reset',
                style: TextStyle(
                    fontSize: 12, fontWeight: FontWeight.w700, color: c.inkMedium)),
          ],
        ),
      ),
    );
  }
}
