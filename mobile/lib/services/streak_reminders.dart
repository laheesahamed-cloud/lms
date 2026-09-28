import 'package:shared_preferences/shared_preferences.dart';

import 'notifications.dart';

/// Fires a single local reminder late in the day when the student's quiz
/// streak is still active but hasn't been extended today — i.e. it's about
/// to break at midnight unless they do one quiz. Mirrors StudyReminders'
/// cancel-then-reschedule pattern so calling reconcile() repeatedly (e.g.
/// every dashboard load) never produces duplicates.
class StreakReminders {
  static String userId = 'anon';
  static String get _idKeyName => 'lms_streak_reminder_id.$userId';
  static const _reminderHour = 20; // 8 PM local — late enough to be a real
  // "last chance today" nudge, early enough to still act on it.
  static const _idBase = 696000000;

  /// Cancel the current user's scheduled streak reminder, e.g. on sign-out,
  /// so it never fires for the next account on this device.
  static Future<void> cancelScheduled() async {
    final sp = await SharedPreferences.getInstance();
    final id = sp.getInt(_idKeyName);
    if (id != null) await Notifications.cancel(id);
    await sp.remove(_idKeyName);
  }

  /// Reconcile against the current streak state. Safe to call often (e.g.
  /// on every dashboard load) — it always cancels the previous one first.
  static Future<void> reconcile({required int streak, required bool doneToday}) async {
    final sp = await SharedPreferences.getInstance();
    final previousId = sp.getInt(_idKeyName);
    if (previousId != null) await Notifications.cancel(previousId);

    // Nothing at risk: no active streak, or today's quiz is already done.
    if (streak <= 0 || doneToday) {
      await sp.remove(_idKeyName);
      return;
    }

    final granted = await Notifications.requestPermission();
    if (!granted) return;

    final now = DateTime.now();
    var at = DateTime(now.year, now.month, now.day, _reminderHour);
    if (!at.isAfter(now)) return; // already past 8 PM — too late to warn usefully today

    final id = _idBase + (now.day % 1000);
    await Notifications.schedule(
      id: id,
      title: 'Your $streak-day streak ends tonight',
      body: 'Do one quick quiz before midnight to keep it going.',
      when: at,
    );
    await sp.setInt(_idKeyName, id);
  }
}
