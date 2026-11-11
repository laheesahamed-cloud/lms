import 'package:shared_preferences/shared_preferences.dart';

import 'notifications.dart';

/// One local reminder at 8 PM that carries the student's streak count, sent
/// only when the streak is alive but today's quiz isn't done yet. Nothing is
/// sent once the day's quiz is done.
///
/// Mirrors StudyReminders' cancel-then-reschedule pattern, so calling
/// reconcile() repeatedly (e.g. on every dashboard load) never produces
/// duplicates.
class StreakReminders {
  static String userId = 'anon';
  static String get _eveningKey => 'lms_streak_reminder_id.$userId';
  static String get _morningKey => 'lms_streak_morning_id.$userId';
  static const _eveningHour = 20; // 8 PM local: a real "last chance" nudge,
  // early enough to still act on it.
  static const _eveningId = 696000001;
  // An earlier build also scheduled a 9 AM "encouragement". It is gone, but a
  // copy may still be queued on a phone that ran that build, so it is cancelled.
  static const _morningId = 696000002;

  static Future<void> _cancelStored(SharedPreferences sp) async {
    for (final key in [_eveningKey, _morningKey]) {
      final id = sp.getInt(key);
      if (id != null) await Notifications.cancel(id);
      await sp.remove(key);
    }
    // An older build stored a day-of-month id under the evening key, which the
    // loop above has just cancelled. These two are the fixed ids used now.
    await Notifications.cancel(_eveningId);
    await Notifications.cancel(_morningId);
  }

  /// Cancel the current user's scheduled streak reminders, e.g. on sign-out,
  /// so they never fire for the next account on this device.
  static Future<void> cancelScheduled() async {
    final sp = await SharedPreferences.getInstance();
    await _cancelStored(sp);
  }

  /// Reconcile against the current streak state. Safe to call often.
  ///
  /// [graceActive] is true when yesterday was missed and a grace day is
  /// covering it, which makes tonight the real last chance.
  static Future<void> reconcile({
    required int streak,
    required bool doneToday,
    bool graceActive = false,
  }) async {
    final sp = await SharedPreferences.getInstance();
    await _cancelStored(sp);

    // No streak to protect, or today's quiz is already done: nothing to say.
    if (streak <= 0 || doneToday) return;

    final now = DateTime.now();
    final at = DateTime(now.year, now.month, now.day, _eveningHour);
    if (!at.isAfter(now)) return; // past 8 PM: too late to warn usefully today

    final granted = await Notifications.requestPermission();
    if (!granted) return;

    await Notifications.schedule(
      id: _eveningId,
      title: graceActive
          ? 'Last chance to keep your streak \u{1F525}'
          : 'Keep your streak consistent \u{1F525}',
      body: graceActive
          ? "You're on a $streak-day streak. Don't lose it, do one quick quiz or lesson to keep your studying consistent."
          : "You're on a $streak-day streak. Don't lose it.",
      when: at,
    );
    await sp.setInt(_eveningKey, _eveningId);
  }
}
