import '../data/models.dart';
import 'notifications.dart';

/// Personal reminders scheduled on the phone (OPTIMIZE 10, step 4). The server
/// used to work these out on every notifications open (subscription rows and a
/// weak-topic average); now the phone schedules them from what it already has:
///
///  - plan ending: 3 days before and on the day, at 10 AM — not for a plan
///    Apple renews by itself;
///  - weak subject: once a week (Sunday 6 PM) naming the weakest subject from
///    the Study Hub data.
///
/// Same cancel-then-reschedule pattern as StreakReminders: calling reconcile
/// again never makes duplicates. It never asks for permission itself (that is
/// the priming sheet's job); without permission iOS simply shows nothing.
class PlanReminders {
  static String userId = 'anon';
  static const _before3Id = 696100001;
  static const _onDayId = 696100002;
  static const _weakId = 696100003;
  static const _hour = 10;

  static Future<void> cancelScheduled() async {
    for (final id in [_before3Id, _onDayId, _weakId]) {
      await Notifications.cancel(id);
    }
  }

  /// Plan-ending reminders from the account's end date.
  static Future<void> reconcile(AppUser user) async {
    await Notifications.cancel(_before3Id);
    await Notifications.cancel(_onDayId);
    final until = user.accessUntil;
    if (until == null || user.accessRenews || user.role != 'student') return;
    final plan = (user.plan ?? '').trim().isEmpty ? 'Your plan' : user.plan!.trim();
    final endDay = DateTime(until.year, until.month, until.day);
    final before = endDay.subtract(const Duration(days: 3)).add(const Duration(hours: _hour));
    final onDay = endDay.add(const Duration(hours: _hour));
    await Notifications.schedule(
      id: _before3Id,
      title: '$plan ends in 3 days',
      body: 'Renew to keep your lessons, exams and progress open.',
      when: before,
    );
    // On the last day; if the plan ends before 10 AM, an hour before it ends.
    final lastCall = onDay.isBefore(until) ? onDay : until.subtract(const Duration(hours: 1));
    await Notifications.schedule(
      id: _onDayId,
      title: '$plan ends today',
      body: 'Renew today so nothing gets locked.',
      when: lastCall,
    );
  }

  /// Weekly weak-subject reminder. [subject] empty = cancel.
  static Future<void> reconcileWeak({required String subject, required String course}) async {
    await Notifications.cancel(_weakId);
    if (subject.trim().isEmpty) return;
    final now = DateTime.now();
    var at = DateTime(now.year, now.month, now.day, 18)
        .add(Duration(days: (DateTime.sunday - now.weekday) % 7));
    if (!at.isAfter(now)) at = at.add(const Duration(days: 7));
    await Notifications.schedule(
      id: _weakId,
      title: 'Review $subject this week',
      body: course.trim().isEmpty
          ? 'It is your weakest subject right now. One short practice round helps.'
          : 'Your weakest subject in $course right now. One short practice round helps.',
      when: at,
    );
  }
}
