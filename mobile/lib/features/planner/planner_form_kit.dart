import 'package:flutter/material.dart';

import '../../theme/tokens.dart';

/// Shared chrome for the Planner's two full-screen forms — "New task" and
/// "Generate plan". Both were bottom sheets, which left no room for the work
/// and put a grabber where a title belongs.
///
/// Every colour here comes from [AppColors] or [kHeroGradient], so the forms
/// sit in the same world as the rest of the app in both themes rather than
/// introducing a palette of their own.

/// The page shell: a hero, a scrolling body, and one CTA pinned to the bottom
/// so the primary action never scrolls out of reach.
class PlannerFormPage extends StatelessWidget {
  /// First line of the title, in plain ink.
  final String titleTop;

  /// Second line, carrying the hero gradient.
  final String titleAccent;
  final String subtitle;

  /// The glyph echoed large and faint at the end of the hero.
  final IconData heroIcon;
  final List<Widget> children;
  final Widget cta;

  const PlannerFormPage({
    super.key,
    required this.titleTop,
    required this.titleAccent,
    required this.subtitle,
    required this.heroIcon,
    required this.children,
    required this.cta,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Scaffold(
      backgroundColor: c.page,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 20),
                children: [
                  _Hero(
                    titleTop: titleTop,
                    titleAccent: titleAccent,
                    subtitle: subtitle,
                    icon: heroIcon,
                  ),
                  const SizedBox(height: 18),
                  ...children,
                ],
              ),
            ),
            _CtaBar(child: cta),
          ],
        ),
      ),
    );
  }
}

class _Hero extends StatelessWidget {
  final String titleTop;
  final String titleAccent;
  final String subtitle;
  final IconData icon;
  const _Hero({
    required this.titleTop,
    required this.titleAccent,
    required this.subtitle,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Stack(
      clipBehavior: Clip.none,
      children: [
        // The artwork's stand-in: the section's own glyph, large and quiet, so
        // the hero has weight on the right without a bespoke asset.
        Positioned(
          right: -10,
          top: 6,
          child: IgnorePointer(
            child: ShaderMask(
              shaderCallback: (r) => kHeroGradient.createShader(r),
              child: Icon(icon,
                  size: 104, color: Colors.white.withValues(alpha: 0.16)),
            ),
          ),
        ),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _BackChip(),
            const SizedBox(height: 12),
            // Two lines, the second carrying the gradient — the hierarchy the
            // old sheet's single 18pt heading could not give.
            Text(titleTop,
                style: TextStyle(
                    fontSize: 30,
                    height: 1.05,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -1,
                    color: c.inkStrong)),
            ShaderMask(
              shaderCallback: (r) => kHeroGradient.createShader(r),
              child: Text(titleAccent,
                  style: const TextStyle(
                      fontSize: 30,
                      height: 1.12,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -1,
                      color: Colors.white)),
            ),
            const SizedBox(height: 6),
            // Held clear of the glyph so a long subtitle never runs under it.
            SizedBox(
              width: MediaQuery.of(context).size.width * 0.62,
              child: Text(subtitle,
                  style: TextStyle(fontSize: 13.5, height: 1.3, color: c.inkSoft)),
            ),
          ],
        ),
      ],
    );
  }
}

class _BackChip extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return GestureDetector(
      onTap: () => Navigator.of(context).maybePop(),
      behavior: HitTestBehavior.opaque,
      child: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: c.card,
          shape: BoxShape.circle,
          border: Border.all(color: c.line),
        ),
        child: Icon(Icons.arrow_back_rounded, size: 19, color: c.inkStrong),
      ),
    );
  }
}

class _CtaBar extends StatelessWidget {
  final Widget child;
  const _CtaBar({required this.child});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Container(
      padding: EdgeInsets.fromLTRB(
          16, 10, 16, MediaQuery.of(context).viewPadding.bottom + 10),
      decoration: BoxDecoration(
        color: c.page,
        border: Border(top: BorderSide(color: c.line)),
      ),
      child: child,
    );
  }
}

/// One titled group: an icon chip, a label, an optional trailing widget, and
/// the controls beneath. Replaces the old bare uppercase labels.
class PlannerSection extends StatelessWidget {
  final IconData icon;
  final String label;
  final Widget? trailing;
  final Widget child;
  const PlannerSection({
    super.key,
    required this.icon,
    required this.label,
    this.trailing,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
      decoration: BoxDecoration(
        color: c.card,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: c.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: c.primaryTint,
                  borderRadius: BorderRadius.circular(11),
                ),
                child: Icon(icon, size: 17, color: c.primary),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(label,
                    style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: c.inkStrong)),
              ),
              ?trailing,
            ],
          ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}

/// A selectable tile. Selected fills with the hero gradient and carries a
/// check badge; an [accent] overrides that with a tinted, outlined treatment,
/// which is what the priorities use so their own colours survive.
class PlannerChoice extends StatelessWidget {
  final IconData? icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;
  final Color? accent;
  const PlannerChoice({
    super.key,
    this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
    this.accent,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final tinted = accent != null;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          AnimatedContainer(
            duration: const Duration(milliseconds: 140),
            padding: EdgeInsets.symmetric(
                horizontal: icon == null ? 14 : 11, vertical: 11),
            decoration: BoxDecoration(
              gradient: selected && !tinted ? kHeroGradient : null,
              color: selected
                  ? (tinted ? accent!.withValues(alpha: 0.14) : null)
                  : c.surface2,
              borderRadius: BorderRadius.circular(13),
              border: Border.all(
                color: selected
                    ? (tinted ? accent! : Colors.transparent)
                    : c.line,
                width: 1.2,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (icon != null) ...[
                  Icon(icon,
                      size: 17,
                      color: selected
                          ? (tinted ? accent! : Colors.white)
                          : c.inkMuted),
                  const SizedBox(width: 7),
                ],
                Text(label,
                    style: TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w700,
                        color: selected
                            ? (tinted ? c.inkStrong : Colors.white)
                            : c.inkMedium)),
              ],
            ),
          ),
          if (selected)
            Positioned(
              top: -5,
              right: -5,
              child: Container(
                width: 19,
                height: 19,
                decoration: BoxDecoration(
                  gradient: tinted ? null : kHeroGradient,
                  color: tinted ? accent! : null,
                  shape: BoxShape.circle,
                  border: Border.all(color: c.card, width: 2),
                ),
                child: const Icon(Icons.check_rounded,
                    size: 10, color: Colors.white),
              ),
            ),
        ],
      ),
    );
  }
}

/// A tappable row that opens a picker — dates, times. Reads as a field, not a
/// button, which is what it stands in for.
class PlannerFieldRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool placeholder;
  final VoidCallback onTap;
  final Widget? trailing;
  const PlannerFieldRow({
    super.key,
    required this.icon,
    required this.label,
    this.placeholder = false,
    required this.onTap,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 13),
        decoration: BoxDecoration(
          color: c.surface2,
          borderRadius: BorderRadius.circular(13),
          border: Border.all(color: c.line),
        ),
        child: Row(
          children: [
            Icon(icon, size: 18, color: c.primary),
            const SizedBox(width: 10),
            Expanded(
              child: Text(label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: placeholder ? c.inkMuted : c.inkStrong)),
            ),
            trailing ??
                Icon(Icons.chevron_right_rounded, size: 20, color: c.inkMuted),
          ],
        ),
      ),
    );
  }
}

/// The glyph for each planner category, shared by the form and anywhere else
/// that needs to name one.
IconData plannerCategoryIcon(String category) {
  switch (category) {
    case 'lesson':
      return Icons.menu_book_rounded;
    case 'quiz':
      return Icons.help_outline_rounded;
    case 'exam':
      return Icons.school_outlined;
    case 'review':
      return Icons.autorenew_rounded;
    case 'flashcards':
      return Icons.style_outlined;
    case 'class':
      return Icons.groups_outlined;
    default:
      return Icons.dashboard_outlined;
  }
}

String plannerTitleCase(String s) =>
    s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);
