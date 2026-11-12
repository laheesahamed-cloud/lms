import 'package:flutter/painting.dart';

/// The one colour XP is always shown in (the dashboard's XP card gold).
const Color kXpGold = Color(0xFFF4B740);

/// What a quiz or lesson just paid in XP, so the screen that follows can say
/// so. The server decides the amount; this only carries it for display.
class XpGain {
  final int awarded;

  /// The daily limit trimmed or blocked some of it.
  final bool capped;
  const XpGain(this.awarded, this.capped);

  static XpGain? fromJson(dynamic raw) {
    if (raw is! Map) return null;
    final a = raw['awarded'];
    final awarded = a is num ? a.toInt() : int.tryParse('$a') ?? 0;
    return XpGain(awarded, raw['capped'] == true);
  }

  /// Worth telling the student about.
  bool get worthShowing => awarded > 0 || capped;

  /// "+16 XP", or the limit message when nothing could be added.
  String get label => awarded > 0 ? '+$awarded XP' : 'Daily XP limit reached';
}

/// The last exam submit's XP, by attempt id, read once by the result screen.
class XpGains {
  static final Map<int, XpGain> exams = <int, XpGain>{};
}
