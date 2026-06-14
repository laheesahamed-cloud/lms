import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'tokens.dart';

/// Builds light + dark [ThemeData] from the XYNDROME tokens.
/// Body/display font = Plus Jakarta Sans (via google_fonts).
class AppTheme {
  static ThemeData dark() => _build(AppColors.dark, Brightness.dark);
  static ThemeData light() => _build(AppColors.light, Brightness.light);

  static ThemeData _build(AppColors c, Brightness b) {
    final base = ThemeData(brightness: b, useMaterial3: true);
    final text = GoogleFonts.plusJakartaSansTextTheme(base.textTheme)
        .apply(bodyColor: c.inkStrong, displayColor: c.inkStrong);

    return base.copyWith(
      scaffoldBackgroundColor: c.page,
      canvasColor: c.page,
      textTheme: text,
      primaryColor: c.primary,
      dividerColor: c.line,
      iconTheme: IconThemeData(color: c.inkMedium, size: 22),
      splashColor: c.primaryTint,
      highlightColor: c.primaryTint,
      colorScheme: ColorScheme.fromSeed(
        seedColor: c.primary,
        brightness: b,
      ).copyWith(
        primary: c.primary,
        secondary: c.accent,
        surface: c.card,
        error: c.error,
        onPrimary: b == Brightness.dark ? const Color(0xFF04121F) : Colors.white,
        onSurface: c.inkStrong,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        foregroundColor: c.inkStrong,
        titleTextStyle: GoogleFonts.plusJakartaSans(
          fontSize: 18,
          fontWeight: FontWeight.w800,
          color: c.inkStrong,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: c.cardElevated,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        hintStyle: TextStyle(color: c.inkMuted),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: c.primary, width: 1.4),
        ),
      ),
    );
  }
}
