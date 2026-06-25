import 'dart:io' show Platform;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../services/notifications.dart';
import '../../services/push.dart';
import '../../state/notification_priming.dart';
import '../../theme/tokens.dart';
import '../../widgets/app_button.dart';

/// Wraps the authenticated shell. On first mount after login it shows the
/// notification priming sheet exactly once, then never again. This replaces the
/// old cold-launch OS prompt (which fired before the user had any context).
class NotificationPrimingGate extends ConsumerStatefulWidget {
  final Widget child;
  const NotificationPrimingGate({super.key, required this.child});

  @override
  ConsumerState<NotificationPrimingGate> createState() =>
      _NotificationPrimingGateState();
}

class _NotificationPrimingGateState
    extends ConsumerState<NotificationPrimingGate> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _maybeShow());
  }

  Future<void> _maybeShow() async {
    if (!mounted) return;
    if (ref.read(notificationPrimingSeenProvider)) return;
    // Mark as seen up-front so it never reappears, even if the user dismisses
    // it by dragging the sheet down.
    await ref.read(notificationPrimingSeenProvider.notifier).complete();
    if (!mounted) return;
    await _showNotificationPrimingSheet(context);
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

Future<void> _showNotificationPrimingSheet(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    backgroundColor: context.c.card,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
    ),
    builder: (sheetCtx) {
      final c = sheetCtx.c;
      return SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 14, 24, 22),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                    color: c.line, borderRadius: BorderRadius.circular(99)),
              ),
              const SizedBox(height: 24),
              Container(
                width: 64,
                height: 64,
                decoration:
                    BoxDecoration(color: c.primaryTint, shape: BoxShape.circle),
                child: Icon(Icons.notifications_active_rounded,
                    color: c.primary, size: 30),
              ),
              const SizedBox(height: 18),
              Text('Stay on track',
                  style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: c.inkStrong)),
              const SizedBox(height: 8),
              Text(
                'Turn on notifications to get study reminders, exam results, and important updates.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 14, height: 1.5, color: c.inkSoft),
              ),
              const SizedBox(height: 22),
              AppButton(
                'Enable notifications',
                expand: true,
                onPressed: () async {
                  Navigator.of(sheetCtx).pop();
                  await _requestPermission();
                },
              ),
              const SizedBox(height: 4),
              TextButton(
                onPressed: () => Navigator.of(sheetCtx).pop(),
                child: Text('Not now',
                    style: TextStyle(
                        color: c.inkMuted, fontWeight: FontWeight.w600)),
              ),
            ],
          ),
        ),
      );
    },
  );
}

/// iOS goes through the native channel (authorize + APNs register); Android
/// uses the local-notifications POST_NOTIFICATIONS request.
Future<bool> _requestPermission() async {
  if (Platform.isIOS) {
    return Push.requestAuthorization();
  }
  return Notifications.requestPermission();
}
