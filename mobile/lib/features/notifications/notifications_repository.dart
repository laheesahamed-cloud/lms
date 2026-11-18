import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/api_client.dart';
import '../../state/current_user.dart';
import '../../state/notice_store.dart';

String _s(dynamic v) => v == null ? '' : v.toString();
bool _b(dynamic v) => v == true || v == 1 || v == '1' || v == 'true';

/// An in-app notification: a notice from the server's feed (new content or an
/// admin message), kept in the phone's own inbox (see NoticeStore). Personal
/// reminders (plan ending, weak subject) are local notifications instead.
class AppNotification {
  final String id;
  final String title;
  final String body;
  final bool read;
  final String createdAt;
  final String kind; // announcement | new-content
  final String actionPath; // in-app path to open, '' = none

  AppNotification({
    required this.id,
    required this.title,
    required this.body,
    required this.read,
    required this.createdAt,
    required this.kind,
    this.actionPath = '',
  });

  bool get canMarkRead => !read;

  factory AppNotification.fromJson(dynamic raw) {
    final m = (raw is Map) ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    return AppNotification(
      id: _s(m['id']),
      title: _s(m['title']),
      body: _s(m['body'] ?? m['message']),
      read: _b(m['read']),
      createdAt: _s(m['createdAt'] ?? m['created_at']),
      kind: _s(m['kind'] ?? m['type']),
    );
  }

  /// Relative time like "2h ago" from the ISO createdAt.
  String get ago {
    final t = DateTime.tryParse(createdAt);
    if (t == null) return '';
    final d = DateTime.now().difference(t);
    if (d.inMinutes < 1) return 'Just now';
    if (d.inMinutes < 60) return '${d.inMinutes}m ago';
    if (d.inHours < 24) return '${d.inHours}h ago';
    if (d.inDays == 1) return 'Yesterday';
    if (d.inDays < 7) return '${d.inDays}d ago';
    return '${t.day}/${t.month}/${t.year}';
  }
}

/// The inbox, read from the phone (no request). New notices arrive with the
/// start-up reply; the page's pull-to-refresh asks for anything newer.
final notificationsProvider = FutureProvider.autoDispose<List<AppNotification>>((ref) async {
  ref.watch(userScopeProvider);
  final items = await NoticeStore.items();
  final read = await NoticeStore.readIds();
  return items.map((m) {
    final url = '${m['url'] ?? ''}';
    return AppNotification(
      id: '${m['id']}',
      title: '${m['title'] ?? ''}',
      body: '${m['body'] ?? ''}',
      read: read.contains('${m['id']}'),
      createdAt: '${m['createdAt'] ?? ''}',
      kind: m['kind'] == 'content' ? 'new-content' : 'announcement',
      actionPath: url == '/notifications' ? '' : url,
    );
  }).toList();
});

final notificationsApiProvider = Provider((ref) => ref.read(apiClientProvider));

// Read and cleared live on the phone; the server keeps nothing per student.
Future<void> markNotificationRead(ApiClient api, String id) => NoticeStore.markRead(id);

/// Marks every notice read — for the bell's badge. Separate from clearing.
Future<void> markAllNotificationsRead(ApiClient api) => NoticeStore.markAllRead();

/// Clears one notice from this phone's inbox.
Future<void> dismissNotification(ApiClient api, String id) => NoticeStore.clear(id);

/// Clears the inbox. Notices published afterwards still arrive.
Future<void> clearNotifications(ApiClient api) => NoticeStore.clearAll();

/// Pull-to-refresh: anything newer from the server's feed (no database).
Future<void> refreshNotices(ApiClient api) => NoticeStore.pull(api);

/// The one in-app announcement to show now (a centre card or a Study Hub
/// banner): active, in its time window, not yet seen on this device, highest
/// priority first. Read from the phone; null when there is none.
final currentPopupProvider = FutureProvider<Map<String, dynamic>?>((ref) async {
  ref.watch(userScopeProvider);
  return NoticeStore.currentPopup();
});

/// Marks the announcement seen on this device. Invalidate
/// [currentPopupProvider] afterwards and the next one (if any) follows.
Future<void> markPopupSeen(Object? id) => NoticeStore.markPopupSeen(id);
