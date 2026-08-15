import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../../state/local_scope.dart';

class PersonalNote {
  final String id;
  final String title;
  final int pageCount;
  final DateTime createdAt;

  const PersonalNote({
    required this.id,
    required this.title,
    required this.pageCount,
    required this.createdAt,
  });

  PersonalNote copyWith({String? title, int? pageCount}) => PersonalNote(
        id: id,
        title: title ?? this.title,
        pageCount: pageCount ?? this.pageCount,
        createdAt: createdAt,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'pageCount': pageCount,
        'createdAt': createdAt.toIso8601String(),
      };

  factory PersonalNote.fromJson(Map<String, dynamic> j) => PersonalNote(
        id: j['id'] as String,
        title: j['title'] as String? ?? 'Untitled',
        pageCount: j['pageCount'] as int? ?? 1,
        createdAt: DateTime.tryParse(j['createdAt'] as String? ?? '') ??
            DateTime.now(),
      );
}

class PersonalNotesStore {
  // Per-user key so a different account on the same device gets its own notes.
  static String get _key => 'xyndrome.personal_notes.${LocalScope.uid}';

  static Future<List<PersonalNote>> load() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key);
    if (raw == null) return [];
    final list = jsonDecode(raw) as List<dynamic>;
    return list
        .map((e) => PersonalNote.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
  }

  static Future<void> _save(List<PersonalNote> notes) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, jsonEncode(notes.map((n) => n.toJson()).toList()));
  }

  static Future<PersonalNote> create(String title) async {
    final notes = await load();
    final note = PersonalNote(
      id: DateTime.now().millisecondsSinceEpoch.toRadixString(36),
      title: title.trim().isEmpty ? 'Untitled' : title.trim(),
      pageCount: 1,
      createdAt: DateTime.now(),
    );
    notes.insert(0, note);
    await _save(notes);
    return note;
  }

  static Future<void> rename(String id, String title) async {
    final notes = await load();
    final idx = notes.indexWhere((n) => n.id == id);
    if (idx == -1) return;
    notes[idx] = notes[idx].copyWith(title: title.trim().isEmpty ? 'Untitled' : title.trim());
    await _save(notes);
  }

  static Future<void> delete(String id) async {
    final notes = await load();
    notes.removeWhere((n) => n.id == id);
    await _save(notes);
    // Remove ink for all pages of this note
    final prefs = await SharedPreferences.getInstance();
    final keys = prefs.getKeys().where((k) => k.contains('pnote-$id-page-'));
    for (final k in keys) { await prefs.remove(k); }
  }

  static Future<int> addPage(String id) async {
    final notes = await load();
    final idx = notes.indexWhere((n) => n.id == id);
    if (idx == -1) return 1;
    final updated = notes[idx].copyWith(pageCount: notes[idx].pageCount + 1);
    notes[idx] = updated;
    await _save(notes);
    return updated.pageCount;
  }
}
