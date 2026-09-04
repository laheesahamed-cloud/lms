import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';
import '../../services/flashcard_reminders.dart';
import 'flashcards_repository.dart';

/// Anki-style flashcards: a deck list with New / Learning / Due counts.
/// Tap a deck to start an FSRS review session.
class FlashcardsPage extends ConsumerStatefulWidget {
  const FlashcardsPage({super.key});

  static const _new = Color(0xFF2563EB);
  static const _learning = Color(0xFFDC2626);
  static const _due = Color(0xFF16A34A);

  @override
  ConsumerState<FlashcardsPage> createState() => _FlashcardsPageState();
}

class _FlashcardsPageState extends ConsumerState<FlashcardsPage> {
  int? _lastDueNow;

  /// Reconcile the due-cards reminder only when the due count actually
  /// changed (same page-open + data-changed pattern as the planner).
  void _maybeReconcile(int dueNow) {
    if (dueNow == _lastDueNow) return;
    _lastDueNow = dueNow;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      FlashcardReminders.reconcile(dueNow);
    });
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final decksAsync = ref.watch(flashDecksProvider);

    return SafeArea(
      child: decksAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text('Could not load flashcards.\n$e',
                textAlign: TextAlign.center,
                style: TextStyle(color: c.inkSoft, fontSize: 14)),
          ),
        ),
        data: (result) {
          final rows = <_FlatDeck>[];
          for (final d in result.decks) {
            _flatten(d, rows);
          }
          final allNotes = <int>{};
          for (final d in result.decks) {
            allNotes.addAll(d.noteIds);
          }
          final dueNow = result.totalLearning + result.totalDue;
          _maybeReconcile(dueNow);

          return RefreshIndicator(
            onRefresh: () async => ref.refresh(flashDecksProvider.future),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('SPACED REPETITION',
                              style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 1.4,
                                  color: c.accent)),
                          const SizedBox(height: 5),
                          Text('Flashcards',
                              style: TextStyle(
                                  fontSize: 28,
                                  fontWeight: FontWeight.w800,
                                  color: c.inkStrong,
                                  letterSpacing: -0.5)),
                        ],
                      ),
                    ),
                    IconButton(
                      tooltip: 'Reminders',
                      onPressed: _showReminderSettings,
                      icon: Icon(Icons.notifications_outlined,
                          color: c.inkMedium),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                _summary(c, result),
                const SizedBox(height: 12),
                if (allNotes.isNotEmpty)
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: dueNow + result.totalNew == 0
                          ? null
                          : () => _study(context, allNotes.join(','), 'All decks'),
                      icon: const Icon(Icons.play_arrow_rounded),
                      label: Text(dueNow + result.totalNew == 0
                          ? 'Nothing due today'
                          : 'Study ${dueNow + result.totalNew} card${dueNow + result.totalNew == 1 ? '' : 's'}'),
                    ),
                  ),
                const SizedBox(height: 18),
                Text('Decks',
                    style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                        color: c.inkStrong)),
                const SizedBox(height: 8),
                if (rows.isEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 20),
                    child: Text('No flashcard decks yet.',
                        style: TextStyle(color: c.inkSoft)),
                  ),
                for (final r in rows)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: _DeckRow(deck: r, onTap: () {
                      if (r.node.locked) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                              content: Text(
                                  'This deck is included with a subscription.')),
                        );
                        return;
                      }
                      _study(context, r.node.noteIds.join(','), r.node.label);
                    }),
                  ),
                const SizedBox(height: 24),
                const Divider(),
                const SizedBox(height: 14),
                GlassCard(
                  onTap: () => context.push('/app/my-flashcards'),
                  padding: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 14),
                  child: Row(
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: c.primary.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Icon(Icons.edit_note_rounded,
                            size: 22, color: c.primary),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('My Flashcards',
                                style: TextStyle(
                                    fontSize: 15.5,
                                    fontWeight: FontWeight.w700,
                                    color: c.inkStrong)),
                            Text('Create your own personal decks',
                                style: TextStyle(
                                    fontSize: 12, color: c.inkSoft)),
                          ],
                        ),
                      ),
                      Icon(Icons.chevron_right_rounded,
                          color: c.inkMuted, size: 22),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  void _study(BuildContext context, String notesCsv, String title) {
    if (notesCsv.isEmpty) return;
    context.push(
        '/app/flashcards/review?notes=$notesCsv&title=${Uri.encodeComponent(title)}');
  }

  Future<void> _showReminderSettings() async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: context.c.page,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => _FlashcardReminderSheet(dueNow: _lastDueNow ?? 0),
    );
  }

  Widget _summary(AppColors c, DecksResult r) {
    Widget pill(String label, int n, Color color) => Expanded(
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 12),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.10),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: color.withValues(alpha: 0.22)),
            ),
            child: Column(
              children: [
                Text('$n',
                    style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        color: color)),
                const SizedBox(height: 2),
                Text(label,
                    style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: c.inkSoft)),
              ],
            ),
          ),
        );
    return Row(
      children: [
        pill('New', r.totalNew, FlashcardsPage._new),
        const SizedBox(width: 10),
        pill('Learning', r.totalLearning, FlashcardsPage._learning),
        const SizedBox(width: 10),
        pill('Due', r.totalDue, FlashcardsPage._due),
      ],
    );
  }

  static void _flatten(DeckNode node, List<_FlatDeck> out) {
    if (node.cardCount > 0 || node.children.isNotEmpty) {
      out.add(_FlatDeck(node));
    }
    for (final child in node.children) {
      _flatten(child, out);
    }
  }
}

class _FlatDeck {
  final DeckNode node;
  _FlatDeck(this.node);
}

class _DeckRow extends StatelessWidget {
  final _FlatDeck deck;
  final VoidCallback onTap;
  const _DeckRow({required this.deck, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final n = deck.node;
    final indent = (n.depth.clamp(0, 4)) * 14.0;
    return GlassCard(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        children: [
          SizedBox(width: indent),
          Icon(
            n.depth == 0
                ? Icons.folder_rounded
                : Icons.style_outlined,
            size: 18,
            color: n.locked ? c.inkMuted : c.primary,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(n.label,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                    fontSize: 15.5,
                    fontWeight: FontWeight.w700,
                    color: n.locked ? c.inkSoft : c.inkStrong)),
          ),
          const SizedBox(width: 8),
          if (n.locked)
            Icon(Icons.lock_outline_rounded, size: 18, color: c.inkMuted)
          else
            _counts(n),
        ],
      ),
    );
  }

  Widget _counts(DeckNode n) {
    Widget num(int v, Color color) => Padding(
          padding: const EdgeInsets.only(left: 6),
          child: Text('$v',
              style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  color: v == 0 ? color.withValues(alpha: 0.35) : color)),
        );
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        num(n.newCount, FlashcardsPage._new),
        num(n.learningCount, FlashcardsPage._learning),
        num(n.dueCount, FlashcardsPage._due),
      ],
    );
  }
}

Widget _grabber(AppColors c) => Center(
      child: Container(
        width: 40,
        height: 4,
        margin: const EdgeInsets.only(bottom: 14),
        decoration:
            BoxDecoration(color: c.inkMuted, borderRadius: BorderRadius.circular(2)),
      ),
    );

// ── Reminder settings (mirrors the planner's _ReminderSettingsSheet) ──
class _FlashcardReminderSheet extends StatefulWidget {
  final int dueNow;
  const _FlashcardReminderSheet({required this.dueNow});
  @override
  State<_FlashcardReminderSheet> createState() =>
      _FlashcardReminderSheetState();
}

class _FlashcardReminderSheetState extends State<_FlashcardReminderSheet> {
  FlashcardReminderPrefs _prefs = const FlashcardReminderPrefs();
  bool _loaded = false;

  @override
  void initState() {
    super.initState();
    FlashcardReminders.getPrefs().then((p) {
      if (!mounted) return;
      setState(() {
        _prefs = p;
        _loaded = true;
      });
    });
  }

  Future<void> _apply(FlashcardReminderPrefs next) async {
    setState(() => _prefs = next);
    await FlashcardReminders.savePrefs(next);
    await FlashcardReminders.reconcile(widget.dueNow);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    if (!_loaded) {
      return const SizedBox(
          height: 160, child: Center(child: CircularProgressIndicator()));
    }
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _grabber(c),
          Text('Flashcard reminders',
              style: TextStyle(
                  fontSize: 18, fontWeight: FontWeight.w800, color: c.inkStrong)),
          const SizedBox(height: 4),
          Text('An on-device nudge when you have cards due for review.',
              style: TextStyle(fontSize: 13, color: c.inkSoft)),
          const SizedBox(height: 16),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            value: _prefs.enabled,
            onChanged: (v) => _apply(_prefs.copyWith(enabled: v)),
            title: Text('Due-cards reminder',
                style: TextStyle(
                    fontWeight: FontWeight.w700, color: c.inkStrong)),
            subtitle: Text('Only fires on days you actually have cards due',
                style: TextStyle(fontSize: 13, color: c.inkSoft)),
          ),
          if (_prefs.enabled)
            Align(
              alignment: Alignment.centerLeft,
              child: GestureDetector(
                onTap: _pickTime,
                child: Container(
                  margin: const EdgeInsets.only(top: 4),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                      color: c.surface2,
                      borderRadius: BorderRadius.circular(10)),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.alarm_outlined, size: 17, color: c.primary),
                      const SizedBox(width: 8),
                      Text('At ${_prefs.time}',
                          style: TextStyle(
                              fontWeight: FontWeight.w700, color: c.inkStrong)),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Future<void> _pickTime() async {
    final parts = _prefs.time.split(':');
    final init = TimeOfDay(
        hour: int.tryParse(parts[0]) ?? 19,
        minute: int.tryParse(parts.length > 1 ? parts[1] : '0') ?? 0);
    final picked = await showTimePicker(context: context, initialTime: init);
    if (picked != null) {
      final hh = picked.hour.toString().padLeft(2, '0');
      final mm = picked.minute.toString().padLeft(2, '0');
      await _apply(_prefs.copyWith(time: '$hh:$mm'));
    }
  }
}
