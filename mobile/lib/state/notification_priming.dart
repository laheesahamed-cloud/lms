import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'onboarding.dart' show sharedPrefsProvider;

/// Tracks whether we've already shown the one-time notification priming sheet
/// (shown once after first login). We never ask again — the user can still
/// enable notifications later from the Planner reminder settings.
class NotificationPrimingController extends Notifier<bool> {
  static const _key = 'seenNotifPriming';

  @override
  bool build() => ref.read(sharedPrefsProvider).getBool(_key) ?? false;

  Future<void> complete() async {
    await ref.read(sharedPrefsProvider).setBool(_key, true);
    state = true;
  }
}

final notificationPrimingSeenProvider =
    NotifierProvider<NotificationPrimingController, bool>(
        NotificationPrimingController.new);
