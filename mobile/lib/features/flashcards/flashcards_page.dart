import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../theme/tokens.dart';
import '../../services/flashcard_reminders.dart';
import 'flashcards_repository.dart';
import '../../widgets/page_header.dart';
import '../../widgets/flashcards_switch.dart';
import '../personal_flashcards/personal_flashcards_page.dart';
import '../../widgets/shell_insets.dart';
import '../../data/app_error.dart';
import '../../widgets/adaptive_sheet.dart';

/// Anki-style flashcards: a deck list with New / Learning / Due counts.
/// Tap a deck to start an FSRS review session.
class FlashcardsPage extends ConsumerStatefulWidget {
  /// Open on My Flashcards instead of the course decks.
  final bool initialMine;
  const FlashcardsPage({super.key, this.initialMine = false});

  // Same colours as My Flashcards: New blue, Due red, Learning amber.
  static const _new = Color(0xFF2563EB);
  static const _learning = Color(0xFFD97706);
  static const _due = Color(0xFFDC2626);

  @override
  ConsumerState<FlashcardsPage> createState() => _FlashcardsPageState();
}

class _FlashcardsPageState extends ConsumerState<FlashcardsPage> {
  int? _lastDueNow;
  late bool _mine = widget.initialMine;
  final GlobalKey<PersonalDecksBodyState> _personalKey = GlobalKey();

  // Folder keys (deck nodes with children) that are currently collapsed.
  // Seeded once, the first time deck data arrives, so every folder starts
  // collapsed — keeps the initial list short and cheap to build no matter
  // how many courses/subtopics/decks exist; the user drills in from there.
  final Set<String> _collapsed = {};
  bool _collapseSeeded = false;

  /// Reconcile the due-cards reminder only when the due count actually
  /// changed (same page-open + data-changed pattern as the planner).
  void _maybeReconcile(int dueNow) {
    if (dueNow == _lastDueNow) return;
    _lastDueNow = dueNow;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      FlashcardReminders.reconcile(dueNow);
    });
  }

  void _seedCollapsed(List<DeckNode> decks) {
    void walk(DeckNode n) {
      if (n.children.isEmpty) return;
      _collapsed.add(n.key);
      for (final child in n.children) {
        walk(child);
      }
    }

    for (final d in decks) {
      walk(d);
    }
  }

  void _toggleCollapsed(String key) {
    setState(() {
      if (!_collapsed.remove(key)) _collapsed.add(key);
    });
  }

  /// The course decks' pills, Study button, "Decks" row and table, as plain
  /// children: the host scroll view supplies the skeleton around them.
  Widget _courseBody(AppColors c, DecksResult result) {
    if (!_collapseSeeded) {
      _seedCollapsed(result.decks);
      _collapseSeeded = true;
    }
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

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
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
              label: Text(() {
                final all = dueNow + result.totalNew;
                if (all == 0) return 'Nothing due today';
                final n = all < kFlashSessionSize ? all : kFlashSessionSize;
                return 'Study $n card${n == 1 ? '' : 's'}'
                    '${all > n ? '  \u00B7  ${all - n} more' : ''}';
              }()),
            ),
          ),
        const SizedBox(height: 18),
        _decksRow(
          c,
          canToggle: rows.any((r) => r.node.children.isNotEmpty),
          allOpen: _collapsed.isEmpty,
          onToggleAll: () => setState(() {
            if (_collapsed.isEmpty) {
              _seedCollapsed(result.decks);
            } else {
              _collapsed.clear();
            }
          }),
        ),
        const SizedBox(height: 4),
        if (rows.isEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 16),
            child: Text('No flashcard decks yet.', style: TextStyle(color: c.inkSoft)),
          )
        else ...[
          const _DeckTableHead(),
          Container(
            decoration: BoxDecoration(
              color: c.card,
              borderRadius: BorderRadius.circular(AppRadius.inner),
              border: Border.all(color: c.line),
            ),
            clipBehavior: Clip.antiAlias,
            child: Column(
              children: [
                for (var i = 0; i < rows.length; i++) ...[
                  if (i > 0)
                    Divider(height: 1, thickness: 1, color: c.line, indent: 12),
                  _DeckRow(
                    deck: rows[i],
                    expanded: !_collapsed.contains(rows[i].node.key),
                    onToggleExpand: rows[i].node.children.isNotEmpty
                        ? () => _toggleCollapsed(rows[i].node.key)
                        : null,
                    onTap: () {
                      final r = rows[i];
                      if (r.node.locked) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                              content: Text('This deck is included with a subscription.')),
                        );
                        return;
                      }
                      _study(context, r.node.noteIds.join(','), r.node.label);
                    },
                  ),
                ],
              ],
            ),
          ),
        ],
      ],
    );
  }

  /// "Decks" with Collapse all / Expand all, and the reminders bell. One
  /// widget so both sections draw it the same.
  Widget _decksRow(AppColors c,
      {required bool canToggle, required bool allOpen, required VoidCallback onToggleAll}) {
    return Row(
      children: [
        Text('Decks',
            style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: c.inkStrong)),
        const Spacer(),
        if (canToggle)
          TextButton(
            onPressed: onToggleAll,
            child: Text(allOpen ? 'Collapse all' : 'Expand all',
                style: const TextStyle(fontWeight: FontWeight.w700)),
          ),
        IconButton(
          tooltip: 'Reminders',
          visualDensity: VisualDensity.compact,
          onPressed: _showReminderSettings,
          icon: Icon(Icons.notifications_outlined, size: 20, color: c.inkMedium),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final decksAsync = _mine ? null : ref.watch(flashDecksProvider);

    Widget body;
    if (_mine) {
      body = PersonalDecksBody(
        key: _personalKey,
        decksRow: _decksRow,
      );
    } else {
      body = decksAsync!.when(
        loading: () => const Padding(
          padding: EdgeInsets.only(top: 60),
          child: Center(child: CircularProgressIndicator()),
        ),
        error: (e, _) => Padding(
          padding: const EdgeInsets.all(24),
          child: Text('Could not load flashcards.\n${appError(e).display}',
              textAlign: TextAlign.center,
              style: TextStyle(color: c.inkSoft, fontSize: 14)),
        ),
        data: (result) => _courseBody(c, result),
      );
    }

    // One skeleton for both sections: the title and + stay fixed, the switch
    // sits in the same place, and only the body under it changes.
    return SafeArea(
      bottom: false,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
            child: PageHeader(
              title: 'Flashcards',
              actions: [
                IconButton(
                  tooltip: 'New deck',
                  onPressed: _addDeck,
                  icon: Icon(Icons.add_rounded, color: c.primary),
                ),
              ],
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async {
                if (_mine) {
                  await _personalKey.currentState?.reload();
                } else {
                  ref.invalidate(flashDecksProvider);
                  await ref.read(flashDecksProvider.future);
                }
              },
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: EdgeInsets.fromLTRB(16, 0, 16, 28 + shellNavInset(context)),
                children: [
                  FlashcardsSwitch(
                    mine: _mine,
                    onChanged: (m) => setState(() => _mine = m),
                  ),
                  const SizedBox(height: 12),
                  body,
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// + creates a deck of your own, from either section.
  void _addDeck() {
    if (!_mine) {
      setState(() => _mine = true);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _personalKey.currentState?.createDeck();
      });
    } else {
      _personalKey.currentState?.createDeck();
    }
  }

  void _study(BuildContext context, String notesCsv, String title) {
    if (notesCsv.isEmpty) return;
    context.push(
        '/app/flashcards/review?notes=$notesCsv&title=${Uri.encodeComponent(title)}');
  }

  Future<void> _showReminderSettings() async {
    await showAdaptiveSheet<void>(
      useRootNavigator: true,
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

  // Instance method (not static): consults _collapsed so a collapsed folder
  // contributes its own row but none of its descendants' rows.
  void _flatten(DeckNode node, List<_FlatDeck> out) {
    final isFolder = node.children.isNotEmpty;
    if (node.cardCount > 0 || isFolder) {
      out.add(_FlatDeck(node));
    }
    if (isFolder && _collapsed.contains(node.key)) return;
    for (final child in node.children) {
      _flatten(child, out);
    }
  }
}

class _FlatDeck {
  final DeckNode node;
  _FlatDeck(this.node);
}

/// Column header above the deck table: DECK / NEW / LEARN / DUE.
class _DeckTableHead extends StatelessWidget {
  const _DeckTableHead();

  static const double col = 40;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final head = TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w800,
        letterSpacing: 0.4,
        color: c.inkMuted);
    Widget cell(String t) => SizedBox(
        width: col, child: Text(t, textAlign: TextAlign.center, style: head));
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 0, 6, 6),
      child: Row(
        children: [
          const Expanded(child: SizedBox.shrink()),
          cell('NEW'),
          cell('LEARN'),
          cell('DUE'),
          // Same width as the ⋮ menu on My Flashcards rows, so the columns line up.
          const SizedBox(width: 30),
        ],
      ),
    );
  }
}

/// One deck as a row of the table: arrow for folders, the name, then the New,
/// Learning and Due counts. Nested decks are indented.
class _DeckRow extends StatelessWidget {
  final _FlatDeck deck;
  final VoidCallback onTap;
  final bool expanded;
  final VoidCallback? onToggleExpand;
  const _DeckRow({
    required this.deck,
    required this.onTap,
    required this.expanded,
    this.onToggleExpand,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final n = deck.node;
    final depth = n.depth.clamp(0, 4);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: EdgeInsets.fromLTRB(12 + depth * 18.0, 11, 6, 11),
          child: Row(
            children: [
              SizedBox(
                width: 26,
                child: onToggleExpand == null
                    ? null
                    : GestureDetector(
                        onTap: onToggleExpand,
                        behavior: HitTestBehavior.opaque,
                        child: Icon(
                          expanded
                              ? Icons.keyboard_arrow_down_rounded
                              : Icons.keyboard_arrow_right_rounded,
                          size: 20,
                          color: c.inkMuted,
                        ),
                      ),
              ),
              Expanded(
                child: Text(n.label,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                        fontSize: 14.5,
                        fontWeight: depth == 0 ? FontWeight.w800 : FontWeight.w600,
                        color: n.locked ? c.inkSoft : c.inkStrong)),
              ),
              if (n.locked)
                SizedBox(
                  width: _DeckTableHead.col * 3,
                  child: Icon(Icons.lock_outline_rounded,
                      size: 18, color: c.inkMuted),
                )
              else ...[
                _CountCell(value: n.newCount, color: FlashcardsPage._new),
                _CountCell(value: n.learningCount, color: FlashcardsPage._learning),
                _CountCell(value: n.dueCount, color: FlashcardsPage._due),
              ],
              const SizedBox(width: 30),
            ],
          ),
        ),
      ),
    );
  }
}

class _CountCell extends StatelessWidget {
  final int value;
  final Color color;
  const _CountCell({required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return SizedBox(
      width: _DeckTableHead.col,
      child: Center(
        child: Text('$value',
            style: TextStyle(
                fontSize: 13.5,
                fontWeight: value > 0 ? FontWeight.w800 : FontWeight.w700,
                color: value > 0 ? color : c.inkMuted.withValues(alpha: 0.55))),
      ),
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
