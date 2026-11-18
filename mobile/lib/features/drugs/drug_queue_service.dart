import 'dart:convert';
import 'dart:math';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../state/content_files.dart';
import 'drug_randomizer_repository.dart';

/// Drug Randomizer state (OPTIMIZE 10.19).
///
///  - The light list of every drug (id, name, class) is asked when the Drugs
///    page opens and kept on the phone per content version; an unchanged
///    list isn't sent again (only the free-spin state, 1 statement).
///  - Spins and the 3 wrong classes are picked here, on the phone.
///  - A drug's full text downloads the first time it comes up, then stays.
///  - Free users' spins are counted here and sent in ONE request when the
///    student leaves the page (user, 10.19). Subscribers send nothing.
class DrugQueueState {
  final List<List<dynamic>> list; // [id, name, class]
  final int useCount; // free spins used, incl. this visit's
  final int freeLimit;
  final bool hasSub;
  final bool ready;
  final String? error;

  const DrugQueueState({
    this.list = const [],
    this.useCount = 0,
    this.freeLimit = 5,
    this.hasSub = false,
    this.ready = false,
    this.error,
  });

  DrugQueueState copyWith({
    List<List<dynamic>>? list,
    int? useCount,
    int? freeLimit,
    bool? hasSub,
    bool? ready,
    String? error,
  }) =>
      DrugQueueState(
        list: list ?? this.list,
        useCount: useCount ?? this.useCount,
        freeLimit: freeLimit ?? this.freeLimit,
        hasSub: hasSub ?? this.hasSub,
        ready: ready ?? this.ready,
        error: error,
      );
}

const _listFile = 'drug_list.json';
String _drugFile(int id) => 'drug_$id.json';

class DrugQueueNotifier extends Notifier<DrugQueueState> {
  final _random = Random();
  final _recent = <int>[]; // last drugs shown, not repeated soon
  int _version = 0;
  int _pending = 0; // this visit's free spins, not sent yet
  bool _opening = false;

  @override
  DrugQueueState build() => const DrugQueueState();

  DrugRandomizerRepository get _repo => ref.read(drugRandomizerRepositoryProvider);

  /// The Drugs page opened: the list (only when changed) + the spin state.
  Future<void> open() async {
    if (_opening) return;
    _opening = true;
    try {
      List<List<dynamic>>? saved;
      final raw = await ContentFiles.read(_listFile);
      if (raw != null) {
        try {
          final m = jsonDecode(raw) as Map;
          _version = (m['v'] as num?)?.toInt() ?? 0;
          saved = [for (final r in (m['drugs'] as List)) List<dynamic>.from(r as List)];
        } catch (_) {
          saved = null;
        }
      }
      final data = await _repo.list(have: saved != null && _version > 0 ? _version : null);
      if (data['blocked'] == true) {
        state = state.copyWith(ready: true, error: 'The Drug Randomizer is not available right now.');
        return;
      }
      var list = saved ?? const <List<dynamic>>[];
      if (data['unchanged'] != true && data['drugs'] is List) {
        list = [for (final r in (data['drugs'] as List)) List<dynamic>.from(r as List)];
        final v = (data['v'] as num?)?.toInt() ?? 0;
        if (v != _version) {
          // A new content version: drug texts saved for the old one are dropped.
          await ContentFiles.deleteStartingWith(const ['drug_']);
        }
        _version = v;
        await ContentFiles.write(_listFile, jsonEncode({'v': _version, 'drugs': list}));
      }
      final hasSub = data['hasSubscription'] == true;
      state = state.copyWith(
        list: list,
        useCount: ((data['useCount'] as num?)?.toInt() ?? 0) + (hasSub ? 0 : _pending),
        freeLimit: (data['freeLimit'] as num?)?.toInt() ?? 5,
        hasSub: hasSub,
        ready: true,
      );
    } catch (_) {
      state = state.copyWith(ready: true, error: 'Failed to load drugs');
    } finally {
      _opening = false;
    }
  }

  /// The next drug, picked on the phone. Null when the free spins are used up
  /// or nothing could be loaded.
  Future<DrugItem?> pop() async {
    final list = state.list;
    if (list.isEmpty) return null;
    if (!state.hasSub && state.useCount >= state.freeLimit) return null;

    // A drug not shown in the last few spins.
    var pick = list[_random.nextInt(list.length)];
    for (var tries = 0; tries < 8 && _recent.contains(pick[0]); tries++) {
      pick = list[_random.nextInt(list.length)];
    }
    final id = (pick[0] as num).toInt();
    _recent.add(id);
    if (_recent.length > min(20, list.length ~/ 2)) _recent.removeAt(0);

    final drug = await _drugText(id);
    if (drug == null) return null;

    // Three wrong classes from the list on the phone.
    final own = '${pick[2]}';
    final classes = {for (final r in list) '${r[2]}'}..remove(own);
    final wrong = classes.toList()..shuffle(_random);

    if (!state.hasSub) {
      _pending++;
      state = state.copyWith(useCount: state.useCount + 1);
    }
    return DrugItem(drug: drug, distractors: wrong.take(3).toList(), questionType: 'drug_class');
  }

  /// The drug's full text: from the phone, else downloaded once and kept.
  Future<Map<String, dynamic>?> _drugText(int id) async {
    final raw = await ContentFiles.read(_drugFile(id));
    if (raw != null) {
      try {
        return Map<String, dynamic>.from(jsonDecode(raw) as Map);
      } catch (_) {}
    }
    try {
      final drug = await _repo.item(id);
      await ContentFiles.write(_drugFile(id), jsonEncode(drug));
      return drug;
    } catch (_) {
      return null;
    }
  }

  /// The student left the Drugs page: this visit's free spins in one request.
  Future<void> flush() async {
    final n = _pending;
    if (n <= 0) return;
    _pending = 0;
    try {
      await _repo.recordSpins(n);
    } catch (_) {
      _pending += n; // sent next time
    }
  }
}

// Lives for the app lifetime — never auto-disposed
final drugQueueProvider = NotifierProvider<DrugQueueNotifier, DrugQueueState>(
  DrugQueueNotifier.new,
);
