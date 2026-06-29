import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'drug_randomizer_repository.dart';

const _batchSize   = 10;
const _refillAt    = 3;
const _refillCount = 7;

class DrugQueueState {
  final List<DrugItem> queue;
  final int useCount;
  final int freeLimit;
  final bool hasSub;
  final bool ready;
  final String? error;

  const DrugQueueState({
    this.queue = const [],
    this.useCount = 0,
    this.freeLimit = 5,
    this.hasSub = false,
    this.ready = false,
    this.error,
  });

  DrugQueueState copyWith({
    List<DrugItem>? queue,
    int? useCount,
    int? freeLimit,
    bool? hasSub,
    bool? ready,
    String? error,
  }) => DrugQueueState(
    queue:     queue     ?? this.queue,
    useCount:  useCount  ?? this.useCount,
    freeLimit: freeLimit ?? this.freeLimit,
    hasSub:    hasSub    ?? this.hasSub,
    ready:     ready     ?? this.ready,
    error:     error     ?? this.error,
  );
}

class DrugQueueNotifier extends Notifier<DrugQueueState> {
  bool _fetching = false;

  @override
  DrugQueueState build() {
    // Kick off first batch immediately — non-blocking
    Future.microtask(() => _fetchBatch(_batchSize, isInit: true));
    return const DrugQueueState();
  }

  Future<void> _fetchBatch(int count, {bool isInit = false}) async {
    if (_fetching || count <= 0) return;
    _fetching = true;
    try {
      final data = await ref.read(drugRandomizerRepositoryProvider).batch(count);
      if (data.blocked) {
        if (isInit) state = state.copyWith(ready: true);
        return;
      }
      // Always trust server for hasSub — stale state from a different user can bypass the limit
      final serverCount = data.useCount;
      state = state.copyWith(
        queue:     [...state.queue, ...data.drugs],
        useCount:  serverCount > state.useCount ? serverCount : state.useCount,
        freeLimit: isInit ? data.freeLimit : state.freeLimit,
        hasSub:    data.hasSubscription,
        ready:     true,
      );
    } catch (_) {
      if (isInit) state = state.copyWith(ready: true, error: 'Failed to load drugs');
    } finally {
      _fetching = false;
    }
  }

  // Returns next drug instantly from queue, triggers refill if low
  DrugItem? pop() {
    if (state.queue.isEmpty) return null;

    final item     = state.queue.first;
    final newQueue = state.queue.sublist(1);
    state = state.copyWith(queue: newQueue, useCount: state.useCount + 1);

    // Record on server and sync authoritative count back
    ref.read(drugRandomizerRepositoryProvider).recordSpin().then((res) {
      if (res == null) return;
      if (res['ok'] == false && res['reason'] == 'limit_reached') {
        final cap = (res['freeLimit'] as num?)?.toInt() ?? state.freeLimit;
        state = state.copyWith(useCount: cap, hasSub: false);
      } else {
        final serverCount = (res['useCount'] as num?)?.toInt();
        if (serverCount != null && serverCount > state.useCount) {
          state = state.copyWith(useCount: serverCount);
        }
      }
    });

    // Silently refill when low
    if (newQueue.length <= _refillAt && !_fetching) {
      Future.microtask(() => _fetchBatch(_refillCount));
    }

    return item;
  }
}

// Lives for the app lifetime — never auto-disposed
final drugQueueProvider = NotifierProvider<DrugQueueNotifier, DrugQueueState>(
  DrugQueueNotifier.new,
);
