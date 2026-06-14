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

  static const light = AppColors(
    page: Color(0xFFF7F9FC),
    surface1: Color(0xFFF3F6FA),
    surface2: Color(0xFFEEF2F8),
    card: Color(0xFFFBFCFF),
    cardElevated: Color(0xFFFDFEFF),
    inkStrong: Color(0xFF0F172A),
    inkMedium: Color(0xFF475569),
    inkSoft: Color(0xFF64748B),
    inkMuted: Color(0xFF64748B),
    line: Color(0xFFE7EDF5),
    lineMedium: Color(0xFFCBD8E8),
    lineStrong: Color(0xFF94A3B8),
    primary: Color(0xFF2563EB),
    primaryHover: Color(0xFF1D4ED8),
    primaryTint: Color(0x1A2563EB),
    accent: Color(0xFF7C3AED),
    success: Color(0xFF2E7D32),
    warning: Color(0xFFA16207),
    error: Color(0xFFB3261E),
  );
}

/// The blue→indigo gradient — reserved for the single hero CTA (no glow).
const kHeroGradient = LinearGradient(
  begin: Alignment.topLeft,
  end: Alignment.bottomRight,
  colors: [Color(0xFF3B82F6), Color(0xFF6366F1)],
);

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
