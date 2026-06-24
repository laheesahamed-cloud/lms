import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../theme/tokens.dart';
import 'notifications_repository.dart';

/// Opens the notifications popup (bottom sheet). Shows UNREAD items; tapping
/// one marks it read and it disappears from the popup.
void showNotificationsPopup(BuildContext context) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => const _NotificationsSheet(),
  );
}

class _NotificationsSheet extends ConsumerStatefulWidget {
  const _NotificationsSheet();
  @override
  ConsumerState<_NotificationsSheet> createState() => _NotificationsSheetState();
}

class _NotificationsSheetState extends ConsumerState<_NotificationsSheet> {
  final Set<String> _dismissed = {};

  Future<void> _markRead(AppNotification n) async {
    setState(() => _dismissed.add(n.id));
    try {
      await markNotificationRead(ref.read(notificationsApiProvider), n.id);
    } catch (_) {}
    ref.invalidate(notificationsProvider);
  }

  (IconData, Color) _visual(AppColors c, String kind) {
    switch (kind) {
      case 'subscription':
        return (Icons.workspace_premium_outlined, c.primary);
      case 'weak':
        return (Icons.trending_up_rounded, c.warning);
      default:
        return (Icons.campaign_outlined, c.accent);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final async = ref.watch(notificationsProvider);
    return SafeArea(
      child: Container(
        margin: const EdgeInsets.fromLTRB(10, 0, 10, 10),
        constraints: BoxConstraints(
            maxHeight: MediaQuery.of(context).size.height * 0.72),
        decoration: BoxDecoration(
          color: c.cardElevated,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: c.line),
        ),
        child: async.when(
          loading: () => const Padding(
            padding: EdgeInsets.all(40),
            child: Center(child: CircularProgressIndicator()),
          ),
          error: (e, _) => Padding(
            padding: const EdgeInsets.all(28),
            child: Text('Could not load notifications.',
                textAlign: TextAlign.center,
                style: TextStyle(color: c.inkSoft)),
          ),
          data: (items) {
            final unread = items
                .where((n) => !n.read && !_dismissed.contains(n.id))
                .toList();
            return Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const SizedBox(height: 8),
                Container(
                  width: 38,
                  height: 4,
                  decoration: BoxDecoration(
                      color: c.lineStrong,
                      borderRadius: BorderRadius.circular(99)),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(18, 12, 12, 6),
                  child: Row(
                    children: [
                      Text('Notifications',
                          style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                              color: c.inkStrong)),
                      const SizedBox(width: 8),
                      if (unread.isNotEmpty)
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: c.primary,
                            borderRadius: BorderRadius.circular(99),
                          ),
                          child: Text('${unread.length} unread',
                              style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w800,
                                  color: Colors.white)),
                        ),
                      const Spacer(),
                      TextButton(
                        onPressed: () {
                          Navigator.of(context).pop();
                          context.push('/app/notifications');
                        },
                        child: const Text('View all'),
                      ),
                    ],
                  ),
                ),
                if (unread.isEmpty)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(18, 12, 18, 28),
                    child: Column(
                      children: [
                        Icon(Icons.notifications_none_rounded,
                            size: 38, color: c.inkMuted),
                        const SizedBox(height: 8),
                        Text("You're all caught up.",
                            style: TextStyle(color: c.inkSoft)),
                      ],
                    ),
                  )
                else
                  Flexible(
                    child: ListView.separated(
                      shrinkWrap: true,
                      padding: const EdgeInsets.fromLTRB(8, 0, 8, 10),
                      itemCount: unread.length,
                      separatorBuilder: (_, _) =>
                          Divider(height: 1, color: c.line, indent: 64),
                      itemBuilder: (_, i) {
                        final n = unread[i];
                        final (icon, tint) = _visual(c, n.kind);
                        return InkWell(
                          borderRadius: BorderRadius.circular(14),
                          onTap: n.canMarkRead ? () => _markRead(n) : null,
                          child: Padding(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 12),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Container(
                                  width: 38,
                                  height: 38,
                                  decoration: BoxDecoration(
                                    color: tint.withValues(alpha: 0.16),
                                    borderRadius: BorderRadius.circular(11),
                                  ),
                                  child: Icon(icon, size: 19, color: tint),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(n.title,
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                          style: TextStyle(
                                              fontSize: 15.5,
                                              fontWeight: FontWeight.w800,
                                              color: c.inkStrong)),
                                      if (n.body.isNotEmpty) ...[
                                        const SizedBox(height: 2),
                                        Text(n.body,
                                            maxLines: 3,
                                            overflow: TextOverflow.ellipsis,
                                            style: TextStyle(
                                                fontSize: 13,
                                                height: 1.35,
                                                color: c.inkSoft)),
                                      ],
                                      if (n.ago.isNotEmpty) ...[
                                        const SizedBox(height: 4),
                                        Text(n.ago,
                                            style: TextStyle(
                                                fontSize: 12,
                                                fontWeight: FontWeight.w600,
                                                color: c.inkMuted)),
                                      ],
                                    ],
                                  ),
                                ),
                                if (n.canMarkRead)
                                  Padding(
                                    padding: const EdgeInsets.only(left: 6, top: 2),
                                    child: Icon(Icons.check_circle_outline_rounded,
                                        size: 20, color: c.inkMuted),
                                  ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                const SizedBox(height: 4),
              ],
            );
          },
        ),
      ),
    );
  }
}

/// Unread badge count for the bell.
final unreadCountProvider = Provider<int>((ref) {
  return ref.watch(notificationsProvider).maybeWhen(
        data: (items) => items.where((n) => !n.read).length,
        orElse: () => 0,
      );
});
