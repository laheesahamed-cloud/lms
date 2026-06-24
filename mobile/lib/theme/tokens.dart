import 'package:flutter/material.dart';

/// XYNDROME v2 design tokens — mirrored verbatim from the web app
/// (frontend/src/shared/styles/00-tokens). Student default = dark.
class AppColors {
  final Color page;
  final Color surface1;
  final Color surface2;
  final Color card;
  final Color cardElevated;
  final Color inkStrong;
  final Color inkMedium;
  final Color inkSoft;
  final Color inkMuted;
  final Color line;
  final Color lineMedium;
  final Color lineStrong;
  final Color primary;
  final Color primaryHover;
  final Color primaryTint;
  final Color accent;
  final Color success;
  final Color warning;
  final Color error;

  const AppColors({
    required this.page,
    required this.surface1,
    required this.surface2,
    required this.card,
    required this.cardElevated,
    required this.inkStrong,
    required this.inkMedium,
    required this.inkSoft,
    required this.inkMuted,
    required this.line,
    required this.lineMedium,
    required this.lineStrong,
    required this.primary,
    required this.primaryHover,
    required this.primaryTint,
    required this.accent,
    required this.success,
    required this.warning,
    required this.error,
  });

  static const dark = AppColors(
    page: Color(0xFF0A0A0F),
    surface1: Color(0xFF111117),
    surface2: Color(0xFF14141B),
    card: Color(0xFF16181F),
    cardElevated: Color(0xFF1C1F27),
    inkStrong: Color(0xFFF8FAFC),
    inkMedium: Color(0xFFCBD5E1),
    inkSoft: Color(0xFF94A3B8),
    inkMuted: Color(0xFF8294AE),
    line: Color(0x21CBD5E1), // rgba(203,213,225,.13)
    lineMedium: Color(0x33CBD5E1), // .20
    lineStrong: Color(0x47CBD5E1), // .28
    primary: Color(0xFF60A5FA),
    primaryHover: Color(0xFF93C5FD),
    primaryTint: Color(0x1F60A5FA), // .12
    accent: Color(0xFF38BDF8),
    success: Color(0xFF34D399),
    warning: Color(0xFFFBBF24),
    error: Color(0xFFF87171),
  );

  // Apple HIG "grouped" light surfaces: a light-gray page with pure-white cards
  // raised by a soft shadow, so content never blends into the background.
  static const light = AppColors(
    page: Color(0xFFF2F2F7), // systemGroupedBackground (gray page)
    surface1: Color(0xFFFFFFFF), // primary surface (white)
    surface2: Color(0xFFEAEAEF), // grouped inset / chip gray
    card: Color(0xFFFFFFFF), // white cards
    cardElevated: Color(0xFFFFFFFF),
    inkStrong: Color(0xFF1C1C1E), // Apple primary label
    inkMedium: Color(0xFF3A3A3C),
    inkSoft: Color(0xFF6C6C70), // secondary label
    inkMuted: Color(0xFF8E8E93), // tertiary label / placeholder
    line: Color(0xFFE5E5EA), // separator
    lineMedium: Color(0xFFD1D1D6),
    lineStrong: Color(0xFFC6C6C8), // opaque separator
    primary: Color(0xFF2563EB), // XYNDROME brand blue (kept)
    primaryHover: Color(0xFF1D4ED8),
    primaryTint: Color(0x142563EB),
    accent: Color(0xFF7C3AED),
    success: Color(0xFF2E7D32),
    warning: Color(0xFFA16207),
    error: Color(0xFFB3261E),
  );
}

/// The blue→indigo gradient — used for the dashboard hero card + the hero CTA.
const kHeroGradient = LinearGradient(
  begin: Alignment.topLeft,
  end: Alignment.bottomRight,
  colors: [Color(0xFF3B82F6), Color(0xFF6366F1)],
);

/// Per-section colour identity for the "Tasteful Vibrant" dashboard.
/// [color] is the solid accent (eyebrows, icon, tinted chip text + wash);
/// [grad] is the full-fill gradient (Quick Action tiles use this — the one
/// "bold" element on the dashboard).
class SectionAccent {
  final Color color;
  final List<Color> grad;
  const SectionAccent(this.color, this.grad);

  LinearGradient get gradient => LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: grad,
      );

  /// Tint background for a chip/wash on the given brightness.
  Color tint(bool dark) => color.withValues(alpha: dark ? 0.14 : 0.12);

  /// Accent text that stays readable on the tint in both modes.
  Color textOn(bool dark) =>
      dark ? color : Color.lerp(color, Colors.black, 0.42)!;
}

/// Curated dashboard accent palette (cool→warm, no rainbow cycling).
class DashAccents {
  static const violet = SectionAccent(
      Color(0xFF8B5CF6), [Color(0xFF8B5CF6), Color(0xFF6366F1)]);
  static const cyan = SectionAccent(
      Color(0xFF38BDF8), [Color(0xFF38BDF8), Color(0xFF0EA5E9)]);
  static const amber = SectionAccent(
      Color(0xFFFBBF24), [Color(0xFFFBBF24), Color(0xFFF59E0B)]);
  static const rose = SectionAccent(
      Color(0xFFFB7185), [Color(0xFFFB7185), Color(0xFFF43F5E)]);
  static const green = SectionAccent(
      Color(0xFF34D399), [Color(0xFF34D399), Color(0xFF10B981)]);
  static const blue = SectionAccent(
      Color(0xFF60A5FA), [Color(0xFF60A5FA), Color(0xFF3B82F6)]);
  static const gold = SectionAccent(
      Color(0xFFF4B740), [Color(0xFFF4B740), Color(0xFFD97706)]);
}

/// 4px spacing grid.
class AppSpace {
  static const x1 = 4.0;
  static const x2 = 8.0;
  static const x3 = 12.0;
  static const x4 = 16.0;
  static const x5 = 24.0;
  static const x6 = 32.0;
  static const pagePadX = 20.0;
  static const sectionGap = 24.0;
  static const touch = 44.0;
}

class AppRadius {
  static const card = 22.0;
  static const compact = 18.0;
  static const inner = 14.0;
  static const nav = 14.0;
  static const pill = 999.0;
}

/// Motion durations + curves (mirrors tokens/motion.css).
class AppDur {
  static const micro = Duration(milliseconds: 140);
  static const hover = Duration(milliseconds: 150);
  static const dropdown = Duration(milliseconds: 180);
  static const modal = Duration(milliseconds: 220);
  static const route = Duration(milliseconds: 240);
  static const card = Duration(milliseconds: 220);
}

class AppCurves {
  static const easeOut = Cubic(0.16, 1, 0.3, 1);
  static const easeIn = Cubic(0.4, 0, 1, 1);
  static const standard = Cubic(0.23, 1, 0.32, 1);
}

/// Responsive breakpoints (px).
class Breakpoints {
  static const tightPhone = 380.0;
  static const phoneTablet = 900.0; // <=900 bottom tabs, >=901 sidebar
  static const desktop = 901.0;
}

extension ColorsX on BuildContext {
  AppColors get c =>
      Theme.of(this).brightness == Brightness.dark ? AppColors.dark : AppColors.light;
}
