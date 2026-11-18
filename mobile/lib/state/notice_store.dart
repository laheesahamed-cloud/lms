import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../data/api_client.dart';
import 'local_scope.dart';
import 'saved_first.dart';

/// Notifications kept on the phone (OPTIMIZE 10, step 4). The server keeps no
/// per-student notification rows: it hands out its small notices feed (new
/// content, admin messages) inside the start-up reply, as "newer than the last
/// id you hold", and the active in-app announcements (popups).
///
///  - Inbox: up to [_keep] notices per account, newest first. Read and cleared
///    are decided here, on the phone; nothing is sent back.
///  - Popups: the active announcements, kept for offline use. Each is shown
///    once per device (the seen list is not per account).
class NoticeStore {
  NoticeStore._();

  static const _keep = 100;
  static String _k(String name) => 'xyndrome.notices.${LocalScope.uid}.$name';
  static const _seenPopupsKey = 'xyndrome.popups.seen';

  static Future<SharedPreferences> get _sp => SharedPreferences.getInstance();

  static const _accountKey = 'xyndrome.notices.account';
  static Future<String?> lastAccount() async => (await _sp).getString(_accountKey);
  static Future<void> rememberAccount(String uid) async => (await _sp).setString(_accountKey, uid);

  static List<Map<String, dynamic>> _list(String? raw) {
    if (raw == null || raw.isEmpty) return <Map<String, dynamic>>[];
    try {
      final v = jsonDecode(raw);
      return v is List ? v.whereType<Map>().map((m) => Map<String, dynamic>.from(m)).toList() : <Map<String, dynamic>>[];
    } catch (_) {
      return <Map<String, dynamic>>[];
    }
  }

  static Set<String> _set(List<String>? v) => (v ?? const <String>[]).toSet();

  // ── inbox ─────────────────────────────────────────────────────────────────

  static Future<int> lastId() async => (await _sp).getInt(_k('last')) ?? 0;

  static Future<int> lastIdForLastAccount() async {
    final sp = await _sp;
    final uid = sp.getString(_accountKey);
    return uid == null ? 0 : (sp.getInt('xyndrome.notices.$uid.last') ?? 0);
  }

  /// Stored notices, newest first.
  static Future<List<Map<String, dynamic>>> items() async => _list((await _sp).getString(_k('items')));

  static Future<Set<String>> readIds() async => _set((await _sp).getStringList(_k('read')));

  /// Takes a server `notices` block ({items, latestId}) and adds what is new.
  static Future<void> mergeNotices(Object? block) async {
    if (block is! Map) return;
    final sp = await _sp;
    final incoming = (block['items'] is List) ? (block['items'] as List).whereType<Map>() : const <Map>[];
    final latest = (block['latestId'] as num?)?.toInt() ?? 0;
    final current = _list(sp.getString(_k('items')));
    final cleared = _set(sp.getStringList(_k('cleared')));
    final have = current.map((m) => '${m['id']}').toSet();
    for (final m in incoming) {
      final id = '${m['id']}';
      if (have.contains(id) || cleared.contains(id)) continue;
      current.add(Map<String, dynamic>.from(m));
    }
    current.sort((a, b) => ((b['id'] as num?) ?? 0).compareTo((a['id'] as num?) ?? 0));
    if (current.length > _keep) current.removeRange(_keep, current.length);
    await sp.setString(_k('items'), jsonEncode(current));
    final last = sp.getInt(_k('last')) ?? 0;
    if (latest > last) await sp.setInt(_k('last'), latest);
  }

  static Future<void> markRead(String id) async {
    final sp = await _sp;
    final read = _set(sp.getStringList(_k('read')))..add(id);
    await sp.setStringList(_k('read'), read.toList());
  }

  static Future<void> markAllRead() async {
    final sp = await _sp;
    final read = _set(sp.getStringList(_k('read')))
      ..addAll(_list(sp.getString(_k('items'))).map((m) => '${m['id']}'));
    await sp.setStringList(_k('read'), read.toList());
  }

  static Future<void> clear(String id) async {
    final sp = await _sp;
    final items = _list(sp.getString(_k('items')))..removeWhere((m) => '${m['id']}' == id);
    await sp.setString(_k('items'), jsonEncode(items));
    final cleared = _set(sp.getStringList(_k('cleared')))..add(id);
    // Only ids the server could still send matter (it keeps its last 30).
    final keep = cleared.toList()..sort((a, b) => (int.tryParse(b) ?? 0).compareTo(int.tryParse(a) ?? 0));
    await sp.setStringList(_k('cleared'), keep.take(200).toList());
  }

  static Future<void> clearAll() async {
    for (final m in await items()) {
      await clear('${m['id']}');
    }
  }

  // ── popups ────────────────────────────────────────────────────────────────

  static Future<void> savePopups(Object? list) async {
    if (list is! List) return;
    await (await _sp).setString(_k('popups'), jsonEncode(list));
  }

  /// The one announcement to show now: active, inside its time window, not
  /// yet seen on this device, highest priority first.
  static Future<Map<String, dynamic>?> currentPopup() async {
    final sp = await _sp;
    final seen = _set(sp.getStringList(_seenPopupsKey));
    final now = DateTime.now();
    final open = _list(sp.getString(_k('popups'))).where((p) {
      if (seen.contains('${p['id']}')) return false;
      final start = DateTime.tryParse('${p['startAt'] ?? ''}');
      final end = DateTime.tryParse('${p['endAt'] ?? ''}');
      if (start != null && start.isAfter(now)) return false;
      if (end != null && !end.isAfter(now)) return false;
      return true;
    }).toList()
      ..sort((a, b) {
        final pa = (a['priority'] as num?) ?? 0, pb = (b['priority'] as num?) ?? 0;
        final byPriority = pb.compareTo(pa);
        return byPriority != 0 ? byPriority : ((b['id'] as num?) ?? 0).compareTo((a['id'] as num?) ?? 0);
      });
    return open.isEmpty ? null : open.first;
  }

  static Future<void> markPopupSeen(Object? id) async {
    final sp = await _sp;
    final seen = _set(sp.getStringList(_seenPopupsKey))..add('$id');
    await sp.setStringList(_seenPopupsKey, seen.toList());
  }

  /// Applies a server reply that carries `notices` and `popups` (start-up or GET /app/notices).
  static Future<void> applyServer(Object? reply) async {
    if (reply is! Map) return;
    // After a fresh sign-in this is where the catalogue version comes from, so
    // lists saved now carry it (else the next open downloads them again).
    final v = (reply['contentVersion'] as num?)?.toInt();
    if (v != null && catalogueVersion == null) catalogueVersion = v;
    await mergeNotices(reply['notices']);
    if (reply.containsKey('popups')) await savePopups(reply['popups']);
  }

  /// After a fresh sign-in or a pull-to-refresh: what is new since the last id
  /// (the server reads two small files, no database).
  static Future<void> pull(ApiClient api) async {
    try {
      final r = await api.dio.get('/app/notices', queryParameters: {'after': await lastId()});
      await applyServer(r.data);
    } catch (_) {
      // Offline: the inbox keeps what it has.
    }
  }
}
