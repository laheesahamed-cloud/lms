import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../theme/tokens.dart';
import '../osce_repository.dart';
import '../osce_media_cache.dart';
import 'sound_player_markers.dart';

/// Tapping a finding fills the screen with it, rather than sliding a sheet over
/// the patient — for malar flush or ankle oedema the picture *is* the teaching,
/// and a thumbnail wastes it.
///
/// Zooming normally costs you your place and doubles your taps, so this carries
/// the two fixes: a mini-map showing where on the body you are, and sideways
/// stepping through every finding in the scene ("2 of 6") without going back.
class SignDetailView extends StatefulWidget {
  final List<OsceSign> signs;
  final List<OsceHotspot> order;
  final int initialIndex;
  final String caseTitle;
  final OsceSound? sound;

  const SignDetailView({
    super.key,
    required this.signs,
    required this.order,
    required this.initialIndex,
    required this.caseTitle,
    this.sound,
  });

  @override
  State<SignDetailView> createState() => _SignDetailViewState();
}

class _SignDetailViewState extends State<SignDetailView> {
  late int _index = widget.initialIndex;
  bool _comparing = false;

  OsceHotspot get _hotspot => widget.order[_index];

  OsceSign? get _sign {
    for (final s in widget.signs) {
      if (s.id == _hotspot.targetId) return s;
    }
    return null;
  }

  void _step(int by) {
    HapticFeedback.selectionClick();
    setState(() {
      _index = (_index + by + widget.order.length) % widget.order.length;
      _comparing = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final sign = _sign;

    return Scaffold(
      backgroundColor: c.page,
      body: SafeArea(
        child: GestureDetector(
          onHorizontalDragEnd: (details) {
            final v = details.primaryVelocity ?? 0;
            if (v.abs() < 220) return;
            _step(v < 0 ? 1 : -1);
          },
          child: Column(
            children: [
              _Header(
                caseTitle: widget.caseTitle,
                where: _whereLabel(sign),
                hotspot: _hotspot,
                onBack: () => Navigator.of(context).maybePop(),
              ),
              Expanded(
                child: sign == null
                    ? Center(
                        child: Text('This finding has no detail yet.',
                            style: TextStyle(color: c.inkMuted)),
                      )
                    : _Body(sign: sign, sound: widget.sound, comparing: _comparing,
                            onToggleCompare: () => setState(() => _comparing = !_comparing)),
              ),
              if (widget.order.length > 1) _Stepper(
                index: _index,
                total: widget.order.length,
                onPrev: () => _step(-1),
                onNext: () => _step(1),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _whereLabel(OsceSign? sign) {
    if (sign == null) return '';
    final region = sign.region.isEmpty ? '' : sign.region.toUpperCase();
    final category = sign.category.isEmpty ? '' : sign.category.toUpperCase();
    return [region, category].where((s) => s.isNotEmpty).join(' · ');
  }
}

class _Header extends StatelessWidget {
  final String caseTitle;
  final String where;
  final OsceHotspot hotspot;
  final VoidCallback onBack;
  const _Header({
    required this.caseTitle,
    required this.where,
    required this.hotspot,
    required this.onBack,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 6, 14, 10),
      child: Row(
        children: [
          IconButton(
            onPressed: onBack,
            icon: Icon(Icons.chevron_left_rounded, size: 30, color: c.inkStrong),
            tooltip: 'Back to the patient',
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(caseTitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                        fontSize: 15, fontWeight: FontWeight.w800, color: c.inkStrong)),
                if (where.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(where,
                        style: TextStyle(
                            fontSize: 10,
                            letterSpacing: 0.6,
                            fontWeight: FontWeight.w700,
                            color: c.inkMuted)),
                  ),
              ],
            ),
          ),
          _MiniMap(x: hotspot.x, y: hotspot.y),
        ],
      ),
    );
  }
}

/// Keeps your place on the body while you're zoomed into one finding.
class _MiniMap extends StatelessWidget {
  final double x;
  final double y;
  const _MiniMap({required this.x, required this.y});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Container(
      width: 34,
      height: 50,
      decoration: BoxDecoration(
        color: c.card,
        borderRadius: BorderRadius.circular(9),
        border: Border.all(color: c.line),
      ),
      child: Stack(
        children: [
          Center(
            child: Icon(Icons.accessibility_new_rounded,
                size: 30, color: c.inkMuted.withValues(alpha: 0.45)),
          ),
          Positioned(
            left: (x * 34) - 3.5,
            top: (y * 50) - 3.5,
            child: Container(
              width: 7,
              height: 7,
              decoration: BoxDecoration(
                color: c.accent,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(color: c.accent.withValues(alpha: 0.7), blurRadius: 7),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Body extends StatelessWidget {
  final OsceSign sign;
  final OsceSound? sound;
  final bool comparing;
  final VoidCallback onToggleCompare;

  const _Body({
    required this.sign,
    required this.sound,
    required this.comparing,
    required this.onToggleCompare,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final image = comparing && sign.compareImage != null ? sign.compareImage : sign.image;
    // A murmur has nothing to look at — lead with the sound instead of a photo
    // of a chest, which teaches nothing.
    final leadWithSound = sign.image == null && sound != null;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
      children: [
        if (image != null)
          ClipRRect(
            borderRadius: BorderRadius.circular(AppRadius.inner),
            child: AspectRatio(
              aspectRatio: 4 / 3,
              child: OsceCachedImage(
                url: image.full,
                fit: BoxFit.cover,
                placeholder: (_) => Container(color: c.surface2),
              ),
            ),
          ),
        if (image != null && sign.compareImage != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: GestureDetector(
              onTap: onToggleCompare,
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 9),
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: c.surface2,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: c.line),
                ),
                child: Text(
                  comparing
                      ? 'Showing ${sign.compareLabel.isEmpty ? 'normal' : sign.compareLabel} — tap for the finding'
                      : 'Compare with ${sign.compareLabel.isEmpty ? 'normal' : sign.compareLabel}',
                  style: TextStyle(
                      fontSize: 12.5, fontWeight: FontWeight.w700, color: c.inkMedium),
                ),
              ),
            ),
          ),

        if (leadWithSound) ...[
          SoundPlayerMarkers(sound: sound!),
          const SizedBox(height: 16),
        ],

        const SizedBox(height: 16),
        _CategoryPill(category: sign.category),
        const SizedBox(height: 10),
        Text(sign.name,
            style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.3,
                color: c.inkStrong)),
        if (sign.short.isNotEmpty) ...[
          const SizedBox(height: 8),
          Text(sign.short,
              style: TextStyle(
                  fontSize: 14.5, height: 1.5, fontWeight: FontWeight.w600, color: c.inkMedium)),
        ],
        if (sign.body.isNotEmpty) ...[
          const SizedBox(height: 10),
          Text(sign.body,
              style: TextStyle(fontSize: 14, height: 1.62, color: c.inkMedium)),
        ],

        if (!leadWithSound && sound != null) ...[
          const SizedBox(height: 18),
          SoundPlayerMarkers(sound: sound!),
        ],
      ],
    );
  }
}

class _CategoryPill extends StatelessWidget {
  final String category;
  const _CategoryPill({required this.category});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    if (category.isEmpty) return const SizedBox.shrink();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: c.accent.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: c.accent.withValues(alpha: 0.3)),
      ),
      child: Text(
        category[0].toUpperCase() + category.substring(1),
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: c.accent),
      ),
    );
  }
}

class _Stepper extends StatelessWidget {
  final int index;
  final int total;
  final VoidCallback onPrev;
  final VoidCallback onNext;
  const _Stepper({
    required this.index,
    required this.total,
    required this.onPrev,
    required this.onNext,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 14),
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: c.line)),
      ),
      child: Row(
        children: [
          Expanded(child: _NavButton(label: '‹ Previous', onTap: onPrev)),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10),
            child: Text('${index + 1} of $total',
                style: TextStyle(
                    fontSize: 11.5, fontWeight: FontWeight.w700, color: c.inkMuted)),
          ),
          Expanded(child: _NavButton(label: 'Next ›', onTap: onNext)),
        ],
      ),
    );
  }
}

class _NavButton extends StatelessWidget {
  final String label;
  final VoidCallback onTap;
  const _NavButton({required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: c.card,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: c.line),
        ),
        child: Text(label,
            style: TextStyle(
                fontSize: 12.5, fontWeight: FontWeight.w700, color: c.inkMedium)),
      ),
    );
  }
}
