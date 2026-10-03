import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';

import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';
import 'notifications_repository.dart';
import '../../widgets/page_header.dart';

class NotificationsPage extends ConsumerStatefulWidget {
  const NotificationsPage({super.key});

  @override
  ConsumerState<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends ConsumerState<NotificationsPage> {
  bool _busy = false;

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

  Future<void> _tap(AppNotification n) async {
    if (!n.canMarkRead) return;
    try {
      await markNotificationRead(ref.read(notificationsApiProvider), n.id);
      ref.invalidate(notificationsProvider);
    } catch (_) {}
  }

  void _toast(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(msg)));
  }

  /// Swiping one away clears it for good — including the derived subscription
  /// and weak-topic items, which have no read state and could not be got rid
  /// of at all before.
  Future<void> _dismiss(AppNotification n) async {
    try {
      await dismissNotification(ref.read(notificationsApiProvider), n.id);
    } catch (_) {
      _toast('Could not clear that one.');
    }
    ref.invalidate(notificationsProvider);
  }

  Future<void> _markAllRead() async {
    setState(() => _busy = true);
    try {
      await markAllNotificationsRead(ref.read(notificationsApiProvider));
      ref.invalidate(notificationsProvider);
    } catch (_) {
      _toast('Could not mark them read.');
    }
    if (mounted) setState(() => _busy = false);
  }

  Future<void> _clearAll() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Clear all notifications?'),
        content: const Text(
            'They are removed from your list. Anything sent afterwards still arrives.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Clear all')),
        ],
      ),
    );
    if (ok != true) return;
    setState(() => _busy = true);
    try {
      await clearNotifications(ref.read(notificationsApiProvider));
      ref.invalidate(notificationsProvider);
    } catch (_) {
      _toast('Could not clear them.');
    }
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final notesAsync = ref.watch(notificationsProvider);

    return SafeArea(
      child: notesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text('Could not load notifications.\n$e',
                textAlign: TextAlign.center,
                style: TextStyle(color: c.inkSoft, fontSize: 14)),
          ),
        ),
        data: (items) => RefreshIndicator(
          onRefresh: () async => ref.refresh(notificationsProvider.future),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
            children: [
              PageHeader(
                title: 'Notifications',
                actions: [
                  if (_busy)
                    const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 12),
                      child: SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2)),
                    )
                  else if (items.isNotEmpty)
                    PopupMenuButton<String>(
                      tooltip: 'More',
                      icon: Icon(Icons.more_horiz_rounded, color: c.inkMedium),
                      onSelected: (v) =>
                          v == 'read' ? _markAllRead() : _clearAll(),
                      itemBuilder: (_) => [
                        if (items.any((n) => n.canMarkRead))
                          const PopupMenuItem(
                              value: 'read', child: Text('Mark all as read')),
                        const PopupMenuItem(
                            value: 'clear', child: Text('Clear all')),
                      ],
                    ),
                ],
              ),
              const SizedBox(height: 14),
              if (items.isEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 60),
                  child: Column(
                    children: [
                      Icon(Icons.notifications_none_rounded,
                          size: 42, color: c.inkMuted),
                      const SizedBox(height: 10),
                      Text("You're all caught up.",
                          style: TextStyle(color: c.inkSoft)),
                    ],
                  ),
                ),
              AnimationLimiter(
                child: Column(
                  children: AnimationConfiguration.toStaggeredList(
                    duration: const Duration(milliseconds: 360),
                    childAnimationBuilder: (w) => SlideAnimation(
                        verticalOffset: 20, child: FadeInAnimation(child: w)),
                    children: [
                      for (final n in items)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: Dismissible(
                            key: ValueKey(n.id),
                            direction: DismissDirection.endToStart,
                            onDismissed: (_) => _dismiss(n),
                            background: Container(
                              alignment: Alignment.centerRight,
                              padding: const EdgeInsets.only(right: 20),
                              decoration: BoxDecoration(
                                color: c.error.withValues(alpha: 0.16),
                                borderRadius: BorderRadius.circular(16),
                              ),
                              child: Icon(Icons.delete_outline_rounded,
                                  color: c.error),
                            ),
                            child: _NoteCard(
                              note: n,
                              visual: _visual(c, n.kind),
                              onTap: () => _tap(n),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NoteCard extends StatelessWidget {
  final AppNotification note;
  final (IconData, Color) visual;
  final VoidCallback onTap;
  const _NoteCard(
      {required this.note, required this.visual, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final (icon, tint) = visual;
    return GlassCard(
      onTap: onTap,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: tint.withValues(alpha: 0.16),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, size: 20, color: tint),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(note.title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                              fontSize: 15.5,
                              fontWeight:
                                  note.read ? FontWeight.w700 : FontWeight.w800,
                              color: c.inkStrong)),
                    ),
                    if (!note.read)
                      Container(
                        margin: const EdgeInsets.only(left: 8, top: 4),
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                            color: c.primary, shape: BoxShape.circle),
                      ),
                  ],
                ),
                if (note.body.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(note.body,
                      style: TextStyle(
                          fontSize: 13, height: 1.4, color: c.inkSoft)),
                ],
                if (note.ago.isNotEmpty) ...[
                  const SizedBox(height: 5),
                  Text(note.ago,
                      style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: c.inkMuted)),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
