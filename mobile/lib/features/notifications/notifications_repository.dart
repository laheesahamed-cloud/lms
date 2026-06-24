import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/api_client.dart';

String _s(dynamic v) => v == null ? '' : v.toString();
bool _b(dynamic v) => v == true || v == 1 || v == '1' || v == 'true';

/// An in-app notification — `GET /student/notifications` (announcements +
/// derived subscription/weak-topic items).
class AppNotification {
  final String id;
  final String title;
  final String body;
  final bool read;
  final String createdAt;
  final String kind; // announcement | subscription | weak | ''

  AppNotification({
    required this.id,
    required this.title,
    required this.body,
    required this.read,
    required this.createdAt,
    required this.kind,
  });

  /// Only real announcements (numeric id) can be marked read on the server.
  bool get canMarkRead => !read && int.tryParse(id) != null;

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

final notificationsProvider = FutureProvider<List<AppNotification>>((ref) async {
  final api = ref.read(apiClientProvider);
  final res = await api.dio.get('/student/notifications');
  final data = res.data;
  final rows = (data is List)
      ? data
      : (data is Map
          ? (data['notifications'] ?? data['items'] ?? data['data'] ?? const [])
          : const []);
  return (rows as List).map(AppNotification.fromJson).toList();
});

final notificationsApiProvider = Provider((ref) => ref.read(apiClientProvider));

Future<void> markNotificationRead(ApiClient api, String id) async {
  await api.dio.post('/student/notifications/$id/read');
}
