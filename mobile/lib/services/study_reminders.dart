import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

import '../features/planner/planner_repository.dart';
import 'notifications.dart';

/// On-device study reminders — mirrors the web LMS `studyReminders.js` workflow:
///   1. Planner due-dates → remind N lead-hours before each open task.
///   2. An optional daily reminder at a chosen HH:MM.
/// Prefs live in SharedPreferences. Reminder ids are deterministic so each
/// reconcile cancels the previous batch and reschedules cleanly (no duplicates).
class StudyReminderPrefs {
  final bool plannerEnabled;
  final int plannerLeadHours;
  final bool customEnabled;
  final String customTime; // 'HH:MM'

  const StudyReminderPrefs({
    this.plannerEnabled = true,
    this.plannerLeadHours = 3,
    this.customEnabled = false,
    this.customTime = '18:00',
  });

  StudyReminderPrefs copyWith({
    bool? plannerEnabled,
    int? plannerLeadHours,
    bool? customEnabled,
    String? customTime,
  }) =>
      StudyReminderPrefs(
        plannerEnabled: plannerEnabled ?? this.plannerEnabled,
        plannerLeadHours: plannerLeadHours ?? this.plannerLeadHours,
        customEnabled: customEnabled ?? this.customEnabled,
        customTime: customTime ?? this.customTime,
      );

  Map<String, dynamic> toJson() => {
        'plannerEnabled': plannerEnabled,
        'plannerLeadHours': plannerLeadHours,
        'customEnabled': customEnabled,
        'customTime': customTime,
      };

  factory StudyReminderPrefs.fromJson(Map<String, dynamic> m) =>
      StudyReminderPrefs(
        plannerEnabled: m['plannerEnabled'] != false,
        plannerLeadHours: (m['plannerLeadHours'] is num)
            ? (m['plannerLeadHours'] as num).toInt()
            : 3,
        customEnabled: m['customEnabled'] == true,
        customTime: (m['customTime'] is String) ? m['customTime'] : '18:00',
      );
}

class StudyReminders {
  static const _prefsKey = 'lms_study_reminder_prefs';
  static const _idsKey = 'lms_study_reminder_ids';
  static const _plannerIdBase = 700000000;
  static const _plannerIdSpan = 100000;
  static const _customId = 690000001;

  static Future<StudyReminderPrefs> getPrefs() async {
    final sp = await SharedPreferences.getInstance();
    try {
      final raw = sp.getString(_prefsKey);
      if (raw == null) return const StudyReminderPrefs();
      return StudyReminderPrefs.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return const StudyReminderPrefs();
    }
  }

  static Future<void> savePrefs(StudyReminderPrefs p) async {
    final sp = await SharedPreferences.getInstance();
    await sp.setString(_prefsKey, jsonEncode(p.toJson()));
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

  /// Reconcile all reminders against current prefs + tasks. Safe to call often.
  static Future<int> reconcile(List<PlannerTask> tasks) async {
    final granted = await Notifications.requestPermission();
    if (!granted) return 0;
    final prefs = await getPrefs();
    final sp = await SharedPreferences.getInstance();

    // Cancel only the batch we scheduled last time.
    for (final s in sp.getStringList(_idsKey) ?? const <String>[]) {
      final id = int.tryParse(s);
      if (id != null) await Notifications.cancel(id);
    }

    final scheduled = <int>[];

    // 1. Daily custom reminder.
    if (prefs.customEnabled) {
      final at = _nextDaily(prefs.customTime);
      if (at != null) {
        await Notifications.schedule(
          id: _customId,
          title: 'Study time',
          body: 'Time for your study session — open your planner to get started.',
          when: at,
        );
        scheduled.add(_customId);
      }
    }

    // 2. Planner due-date reminders (lead-hours before end of the due day).
    if (prefs.plannerEnabled) {
      final lead = Duration(hours: prefs.plannerLeadHours.clamp(0, 72));
      final now = DateTime.now();
      final upcoming = tasks
          .where((t) => !t.done && t.due != null)
          .map((t) {
            final d = t.due!;
            final endOfDay = DateTime(d.year, d.month, d.day, 23, 59);
            return (task: t, at: endOfDay.subtract(lead));
          })
          .where((e) => e.at.isAfter(now))
          .toList()
        ..sort((a, b) => a.at.compareTo(b.at));

      var index = 0;
      for (final e in upcoming.take(32)) {
        final id = _plannerIdBase + (index % _plannerIdSpan);
        await Notifications.schedule(
          id: id,
          title: 'Upcoming: ${e.task.title}',
          body: 'This task is due soon. Tap to review it in your planner.',
          when: e.at,
        );
        scheduled.add(id);
        index++;
      }
    }

    await sp.setStringList(_idsKey, scheduled.map((e) => '$e').toList());
    return scheduled.length;
  }
}
