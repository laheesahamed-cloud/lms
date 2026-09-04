import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

import 'notifications.dart';

/// On-device "flashcards due" reminder — same on-device model as
/// [StudyReminders]' daily reminder, but reused for spaced-repetition
/// flashcards: a chosen daily time, only actually scheduled when there are
/// cards due (FSRS due-state is server-authoritative — the app only ever
/// sees a *count*, never per-card due timestamps, so this can't be scheduled
/// exactly like planner due-dates). Prefs live in SharedPreferences,
/// namespaced per signed-in user exactly like StudyReminders.
class FlashcardReminderPrefs {
  final bool enabled;
  final String time; // 'HH:MM'

  const FlashcardReminderPrefs({
    this.enabled = false,
    this.time = '19:00',
  });

  FlashcardReminderPrefs copyWith({bool? enabled, String? time}) =>
      FlashcardReminderPrefs(
        enabled: enabled ?? this.enabled,
        time: time ?? this.time,
      );

  Map<String, dynamic> toJson() => {'enabled': enabled, 'time': time};

  factory FlashcardReminderPrefs.fromJson(Map<String, dynamic> m) =>
      FlashcardReminderPrefs(
        enabled: m['enabled'] == true,
        time: (m['time'] is String) ? m['time'] : '19:00',
      );
}

class FlashcardReminders {
  // Set/cleared alongside StudyReminders.userId by the auth controller so
  // reminders never leak across accounts on a shared device.
  static String userId = 'anon';
  static String get _prefsKey => 'lms_flashcard_reminder_prefs.$userId';
  static String get _idKey => 'lms_flashcard_reminder_id.$userId';
  static const _reminderId = 691000001;

  static Future<FlashcardReminderPrefs> getPrefs() async {
    final sp = await SharedPreferences.getInstance();
    try {
      final raw = sp.getString(_prefsKey);
      if (raw == null) return const FlashcardReminderPrefs();
      return FlashcardReminderPrefs.fromJson(
          jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return const FlashcardReminderPrefs();
    }
  }

  static Future<void> savePrefs(FlashcardReminderPrefs p) async {
    final sp = await SharedPreferences.getInstance();
    await sp.setString(_prefsKey, jsonEncode(p.toJson()));
  }

  /// Cancel on sign-out so nothing fires for the next account on this
  /// device. Saved prefs are kept (namespaced) so they return on next login.
  static Future<void> cancelScheduled() async {
    final sp = await SharedPreferences.getInstance();
    if (sp.getBool(_idKey) == true) {
      await Notifications.cancel(_reminderId);
      await sp.remove(_idKey);
    }
  }

  static DateTime? _nextDaily(String time) {
    final parts = time.split(':');
    if (parts.length != 2) return null;
    final h = int.tryParse(parts[0]), m = int.tryParse(parts[1]);
    if (h == null || m == null) return null;
    final now = DateTime.now();
    var next = DateTime(now.year, now.month, now.day, h, m);
    if (!next.isAfter(now)) next = next.add(const Duration(days: 1));
    return next;
  }

  /// Reconcile against the current due count. Safe to call often (e.g. every
  /// time the Flashcards page rebuilds with fresh data).
  static Future<void> reconcile(int dueCount) async {
    final sp = await SharedPreferences.getInstance();
    // Always cancel the previous schedule first — avoids a stale "N due"
    // notification once the count has changed or cards are cleared.
    await Notifications.cancel(_reminderId);
    await sp.remove(_idKey);

    final prefs = await getPrefs();
    if (!prefs.enabled || dueCount <= 0) return;

    final granted = await Notifications.requestPermission();
    if (!granted) return;

    final at = _nextDaily(prefs.time);
    if (at == null) return;

    await Notifications.schedule(
      id: _reminderId,
      title: 'Flashcards due',
      body: dueCount == 1
          ? 'You have 1 card due for review.'
          : 'You have $dueCount cards due for review.',
      when: at,
    );
    await sp.setBool(_idKey, true);
  }
}
