import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/timezone.dart' as tz;
import 'package:timezone/data/latest.dart' as tzdata;

/// Thin wrapper around flutter_local_notifications for planner reminders.
/// iOS schedules these as local (UNUserNotificationCenter) notifications.
class Notifications {
  static final FlutterLocalNotificationsPlugin _plugin =
      FlutterLocalNotificationsPlugin();
  static bool _inited = false;

  static Future<void> init() async {
    if (_inited) return;
    tzdata.initializeTimeZones();
    // App audience is Sri Lanka; fall back silently if unavailable.
    try {
      tz.setLocalLocation(tz.getLocation('Asia/Colombo'));
    } catch (_) {}
    const settings = InitializationSettings(
      android: AndroidInitializationSettings('@mipmap/ic_launcher'),
      iOS: DarwinInitializationSettings(
        requestAlertPermission: false,
        requestBadgePermission: false,
        requestSoundPermission: false,
      ),
    );
    await _plugin.initialize(settings);
    _inited = true;
  }

  /// Ask the OS for permission (call once, e.g. when the user opens Planner).
  static Future<bool> requestPermission() async {
    await init();
    final ios = _plugin.resolvePlatformSpecificImplementation<
        IOSFlutterLocalNotificationsPlugin>();
    final iosGranted =
        await ios?.requestPermissions(alert: true, badge: true, sound: true);
    final android = _plugin.resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin>();
    final androidGranted = await android?.requestNotificationsPermission();
    return iosGranted ?? androidGranted ?? true;
  }

  static const NotificationDetails _details = NotificationDetails(
    android: AndroidNotificationDetails(
      'planner_reminders',
      'Planner reminders',
      channelDescription: 'Study planner task reminders',
      importance: Importance.max,
      priority: Priority.high,
    ),
    // present* = show the banner/sound even while the app is in the foreground.
    iOS: DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
      presentBanner: true,
    ),
  );

  /// Fire a notification immediately — used by the "Send test" button so the
  /// user can confirm permissions + delivery work (reminders fire later).
  static Future<void> testNow() async {
    await init();
    await _plugin.show(
      999000001,
      'Test reminder',
      'Local notifications are working ✅',
      _details,
    );
  }

  /// Schedule a one-off reminder. No-op if [when] is in the past.
  static Future<void> schedule({
    required int id,
    required String title,
    required String body,
    required DateTime when,
  }) async {
    await init();
    if (!when.isAfter(DateTime.now())) return;
    await _plugin.zonedSchedule(
      id,
      title,
      body,
      tz.TZDateTime.from(when, tz.local),
      _details,
      androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
    );
  }

  static Future<void> cancel(int id) => _plugin.cancel(id);
}
