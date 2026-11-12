import 'package:flutter/foundation.dart' show listEquals;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../theme/tokens.dart';
import 'personal_flashcards_store.dart';
import 'personal_review_page.dart' show kPersonalSessionSize;
import '../../widgets/adaptive_sheet.dart';

/// My Flashcards — an Anki-style deck browser. Decks are still stored flat
/// (one PersonalDeck per id/title), but a title containing "::" — e.g.
/// "Cardiology::1" — is treated as a nested deck the same way real Anki
/// parses deck names, so the list renders as an expandable/collapsible tree
/// instead of one row per deck.
///
/// This is the BODY of the Flashcards page's "My Flashcards" side: the pills,
/// Study button, "Decks" row and table. The page around it (title, +, switch)
/// is shared with the course decks in flashcards_page.dart, so the two never
/// drift apart.
class PersonalDecksBody extends StatefulWidget {
  /// Draws the "Decks" row, shared with the course side.
  final Widget Function(AppColors c,
      {required bool canToggle,
      required bool allOpen,
      required VoidCallback onToggleAll}) decksRow;
  const PersonalDecksBody({super.key, required this.decksRow});

  @override
  State<PersonalDecksBody> createState() => PersonalDecksBodyState();
}

class PersonalDecksBodyState extends State<PersonalDecksBody> {
  /// Opens the new-deck sheet (the page's + calls this).
  Future<void> createDeck() => _createDeck();

  Future<void> reload() => _load();

  List<_DeckNode> _tree = [];
  final Set<String> _expanded = {};
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final decks = await PersonalFlashcardsStore.loadDecks();
    final entries = await Future.wait(
      decks.map((d) async {
        final stats = await PersonalFlashcardsStore.deckStats(d.id);
        return _DeckEntry(deck: d, stats: stats);
      }),
    );
    if (!mounted) return;
    setState(() {
      _tree = _buildTree(entries);
      _loading = false;
    });
  }

  static List<String> _parts(String title) => title
      .split('::')
      .map((p) => p.trim())
      .where((p) => p.isNotEmpty)
      .toList();

  /// Every place a deck can go, as the "Inside" picker lists them: each path in
  /// the tree, indented by depth. [exclude] drops a path and everything under
  /// it (a deck cannot be moved into itself).
  List<_ParentOption> _parentOptions({String? exclude}) {
    final out = <_ParentOption>[];
    void walk(List<_DeckNode> nodes, int depth) {
      for (final n in nodes) {
        final skip = exclude != null && (n.key == exclude || n.key.startsWith('$exclude::'));
        if (skip) continue;
        out.add(_ParentOption(n.key, n.label, depth));
        walk(n.children, depth + 1);
      }
    }

    walk(_tree, 0);
    return out;
  }

  /// Opens every level above [path] so a new or moved deck is visible.
  void _reveal(String path) {
    final parts = path.split('::');
    for (var i = 1; i <= parts.length; i++) {
      _expanded.add(parts.sublist(0, i).join('::'));
    }
  }

  /// Every deck whose name starts with [oldPrefix] gets [newPrefix] in its
  /// place, so renaming or moving a folder takes everything inside it along.
  Future<void> _applyPrefix(List<String> oldPrefix, List<String> newPrefix) async {
    final decks = await PersonalFlashcardsStore.loadDecks();
    for (final d in decks) {
      final parts = _parts(d.title);
      if (parts.length >= oldPrefix.length &&
          listEquals(parts.sublist(0, oldPrefix.length), oldPrefix)) {
        final next = [...newPrefix, ...parts.sublist(oldPrefix.length)];
        await PersonalFlashcardsStore.renameDeck(d.id, next.join('::'));
      }
    }
  }

  Future<void> _createDeck({String parent = ''}) async {
    final r = await _showDeckSheet(
      context,
      heading: parent.isEmpty ? 'New deck' : 'New sub-deck',
      actionLabel: 'Create deck',
      parents: _parentOptions(),
      initialParent: parent,
      initialName: '',
    );
    if (r == null) return;
    HapticFeedback.mediumImpact();
    // Still saved as "Parent::Name", so every existing deck keeps working; the
    // sheet just writes the "::" so the student does not have to.
    await PersonalFlashcardsStore.createDeck(
        r.parent.isEmpty ? r.name : '${r.parent}::${r.name}');
    if (r.parent.isNotEmpty) _reveal(r.parent);
    _load();
  }

  Future<void> _renameNode(_DeckNode node) async {
    final oldParts = node.key.split('::');
    final parentPath = oldParts.sublist(0, oldParts.length - 1).join('::');
    final r = await _showDeckSheet(
      context,
      heading: 'Rename',
      actionLabel: 'Save',
      parents: const [],
      initialParent: parentPath,
      initialName: node.label,
      allowParent: false,
    );
    if (r == null) return;
    final newParts = [...oldParts.sublist(0, oldParts.length - 1), ..._parts(r.name)];
    if (listEquals(oldParts, newParts)) return;
    await _applyPrefix(oldParts, newParts);
    _load();
  }

  Future<void> _moveNode(_DeckNode node) async {
    final oldParts = node.key.split('::');
    final parentPath = oldParts.sublist(0, oldParts.length - 1).join('::');
    final r = await _showDeckSheet(
      context,
      heading: 'Move "${node.label}"',
      actionLabel: 'Move here',
      parents: _parentOptions(exclude: node.key),
      initialParent: parentPath,
    );
    if (r == null || r.parent == parentPath) return;
    await _applyPrefix(oldParts, [..._parts(r.parent), node.label]);
    if (r.parent.isNotEmpty) _reveal(r.parent);
    _load();
  }

  Future<void> _deleteDeck(_DeckEntry e) async {
    final ok = await showDialog<bool>(
      useRootNavigator: true,
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Deck?'),
        content: Text(
            'Delete "${e.deck.title}" and all its cards? This cannot be undone.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Delete',
                  style: TextStyle(color: Colors.red))),
        ],
      ),
    );
    if (ok != true) return;
    HapticFeedback.mediumImpact();
    await PersonalFlashcardsStore.deleteDeck(e.deck.id);
    _load();
  }

  void _toggle(String key) {
    setState(() {
      if (_expanded.contains(key)) {
        _expanded.remove(key);
      } else {
        _expanded.add(key);
      }
    });
  }

  Future<void> _openDeck(_DeckEntry e) async {
    await context.push(
        '/app/my-flashcards/${e.deck.id}?title=${Uri.encodeComponent(e.deck.title)}');
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    var tNew = 0, tLearn = 0, tDue = 0;
    for (final n in _tree) {
      final st = _aggregateStats(n);
      tNew += st.newCount;
      tLearn += st.learningCount;
      tDue += st.dueCount;
    }
    final folderKeys = <String>[];
    void collect(List<_DeckNode> nodes) {
      for (final n in nodes) {
        if (n.children.isNotEmpty) {
          folderKeys.add(n.key);
          collect(n.children);
        }
      }
    }
    collect(_tree);
    final allOpen = folderKeys.isNotEmpty && folderKeys.every(_expanded.contains);
    final all = tNew + tLearn + tDue;

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
                        fontSize: 22, fontWeight: FontWeight.w800, color: color)),
                const SizedBox(height: 2),
                Text(label,
                    style: TextStyle(
                        fontSize: 12, fontWeight: FontWeight.w700, color: c.inkSoft)),
              ],
            ),
          ),
        );

    if (_loading) {
      return const Padding(
        padding: EdgeInsets.only(top: 60),
        child: Center(child: CircularProgressIndicator()),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            pill('New', tNew, const Color(0xFF2563EB)),
            const SizedBox(width: 10),
            pill('Learning', tLearn, const Color(0xFFD97706)),
            const SizedBox(width: 10),
            pill('Due', tDue, const Color(0xFFDC2626)),
          ],
        ),
        const SizedBox(height: 12),
        if (_tree.isNotEmpty)
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: all == 0
                  ? null
                  : () => context.push(
                      '/app/my-flashcards/all/review?title=${Uri.encodeComponent('All my decks')}'),
              icon: const Icon(Icons.play_arrow_rounded),
              label: Text(() {
                if (all == 0) return 'Nothing due today';
                final n = all < kPersonalSessionSize ? all : kPersonalSessionSize;
                return 'Study $n card${n == 1 ? '' : 's'}'
                    '${all > n ? '  \u00B7  ${all - n} more' : ''}';
              }()),
            ),
          ),
        const SizedBox(height: 18),
        widget.decksRow(c,
            canToggle: folderKeys.isNotEmpty,
            allOpen: allOpen,
            onToggleAll: () => setState(() {
                  if (allOpen) {
                    _expanded.clear();
                  } else {
                    _expanded.addAll(folderKeys);
                  }
                })),
        const SizedBox(height: 4),
        if (_tree.isEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 16),
            child: Text('No decks yet. Tap + to create your first deck.',
                style: TextStyle(color: c.inkSoft)),
          )
        else ...[
          _DeckTableHead(c: c),
          Container(
            decoration: BoxDecoration(
              color: c.card,
              borderRadius: BorderRadius.circular(AppRadius.inner),
              border: Border.all(color: c.line),
            ),
            clipBehavior: Clip.antiAlias,
            child: Column(children: _renderNodes(_tree, depth: 0)),
          ),
        ],
      ],
    );
  }

  List<Widget> _renderNodes(List<_DeckNode> nodes, {required int depth, bool first = true}) {
    final widgets = <Widget>[];
    for (final node in nodes) {
      final isFirst = first && widgets.isEmpty;
      widgets.add(_DeckRow(
        divider: !isFirst,
        node: node,
        depth: depth,
        open: _expanded.contains(node.key),
        onToggle: () => _toggle(node.key),
        onOpen: node.entry != null ? () => _openDeck(node.entry!) : null,
        onAddSub: () => _createDeck(parent: node.key),
        onRename: () => _renameNode(node),
        onMove: () => _moveNode(node),
        onDelete: node.entry != null ? () => _deleteDeck(node.entry!) : null,
      ));
      if (node.children.isNotEmpty && _expanded.contains(node.key)) {
        widgets.addAll(_renderNodes(node.children, depth: depth + 1, first: false));
      }
    }
    return widgets;
  }
}

/// Builds an Anki-style deck tree from flat deck titles by splitting on
/// "::" — "Cardiology::1" becomes a "1" leaf under a "Cardiology" branch.
/// A branch segment that isn't itself a real deck (no matching title) is
/// still shown as a plain expandable grouping row with aggregated counts.
List<_DeckNode> _buildTree(List<_DeckEntry> entries) {
  final byKey = <String, _DeckNode>{};
  final roots = <_DeckNode>[];

  _DeckNode nodeFor(List<String> parts) {
    final key = parts.join('::');
    final existing = byKey[key];
    if (existing != null) return existing;
    final created = _DeckNode(key: key, label: parts.last);
    byKey[key] = created;
    if (parts.length == 1) {
      roots.add(created);
    } else {
      final parent = nodeFor(parts.sublist(0, parts.length - 1));
      parent.children.add(created);
    }
    return created;
  }

  for (final e in entries) {
    final parts = e.deck.title
        .split('::')
        .map((p) => p.trim())
        .where((p) => p.isNotEmpty)
        .toList();
    nodeFor(parts.isEmpty ? [e.deck.title] : parts).entry = e;
  }

  void sortRec(List<_DeckNode> list) {
    list.sort(
        (a, b) => a.label.toLowerCase().compareTo(b.label.toLowerCase()));
    for (final n in list) {
      sortRec(n.children);
    }
  }

  sortRec(roots);
  return roots;
}

/// Aggregated new/learning/due/total across a node and every descendant — so a
/// collapsed "Cardiology" branch shows the combined counts of "1", "4", "5".
DeckStats _aggregateStats(_DeckNode node) {
  var total = 0, newCount = 0, learningCount = 0, dueCount = 0;
  void visit(_DeckNode n) {
    final entry = n.entry;
    if (entry != null) {
      total += entry.stats.total;
      newCount += entry.stats.newCount;
      learningCount += entry.stats.learningCount;
      dueCount += entry.stats.dueCount;
    }
    for (final child in n.children) {
      visit(child);
    }
  }

  visit(node);
  return DeckStats(
      total: total,
      newCount: newCount,
      learningCount: learningCount,
      dueCount: dueCount);
}

class _DeckEntry {
  final PersonalDeck deck;
  final DeckStats stats;
  const _DeckEntry({required this.deck, required this.stats});
}

/// One point in the deck tree. [entry] is non-null only when this exact path
/// is a real created deck (as opposed to a pure grouping segment implied by
/// a child's "::" name, e.g. "Cardiology" when only "Cardiology::1" exists).
class _DeckNode {
  final String key;
  final String label;
  _DeckEntry? entry;
  final List<_DeckNode> children = [];
  _DeckNode({required this.key, required this.label});
}


/// Column header above the deck table (Deck / New / Learn / Due), matching a real
/// Anki deck browser's column layout.
class _DeckTableHead extends StatelessWidget {
  final AppColors c;
  const _DeckTableHead({required this.c});

  @override
  Widget build(BuildContext context) {
    final headStyle = TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w800,
        letterSpacing: 0.4,
        color: c.inkMuted);
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 0, 6, 6),
      child: Row(
        children: [
          const Expanded(child: SizedBox.shrink()),
          SizedBox(
              width: 40,
              child: Text('NEW', textAlign: TextAlign.center, style: headStyle)),
          SizedBox(
              width: 40,
              child: Text('LEARN', textAlign: TextAlign.center, style: headStyle)),
          SizedBox(
              width: 40,
              child: Text('DUE', textAlign: TextAlign.center, style: headStyle)),
          const SizedBox(width: 30),
        ],
      ),
    );
  }
}

class _DeckRow extends StatelessWidget {
  final _DeckNode node;
  final int depth;
  final bool open;
  final VoidCallback onToggle;
  final VoidCallback? onOpen;
  final VoidCallback onAddSub;
  final VoidCallback onRename;
  final VoidCallback onMove;
  final VoidCallback? onDelete;
  final bool divider;

  const _DeckRow({
    this.divider = true,
    required this.node,
    required this.depth,
    required this.open,
    required this.onToggle,
    this.onOpen,
    required this.onAddSub,
    required this.onRename,
    required this.onMove,
    this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final hasChildren = node.children.isNotEmpty;
    final stats = _aggregateStats(node);
    final isBold = depth == 0;

    return Column(
      children: [
        if (divider)
          Divider(height: 1, thickness: 1, color: c.line, indent: 12),
        Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: hasChildren ? onToggle : onOpen,
            child: Padding(
              padding: EdgeInsets.fromLTRB(
                  12 + depth * 18, 11, 6, 11),
              child: Row(
                children: [
                  SizedBox(
                    width: 26,
                    child: hasChildren
                        ? Icon(
                            open
                                ? Icons.keyboard_arrow_down_rounded
                                : Icons.keyboard_arrow_right_rounded,
                            size: 20,
                            color: c.inkMuted,
                          )
                        : null,
                  ),
                  Expanded(
                    child: Text(
                      node.label,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 14.5,
                        fontWeight: isBold ? FontWeight.w800 : FontWeight.w600,
                        color: c.inkStrong,
                      ),
                    ),
                  ),
                  SizedBox(
                    width: 40,
                    child: _CountBadge(
                        value: stats.newCount, color: const Color(0xFF2563EB)),
                  ),
                  SizedBox(
                    width: 40,
                    child: _CountBadge(
                        value: stats.learningCount, color: const Color(0xFFD97706)),
                  ),
                  SizedBox(
                    width: 40,
                    child: _CountBadge(
                        value: stats.dueCount, color: const Color(0xFFDC2626)),
                  ),
                  SizedBox(
                    width: 30,
                    child: PopupMenuButton<String>(
                      padding: EdgeInsets.zero,
                      // A child, not an icon: the icon form wraps itself in a
                      // 48px-tall button, which made every row taller than the
                      // Flashcards table's.
                      child: SizedBox(
                        width: 30,
                        height: 20,
                        child: Icon(Icons.more_vert_rounded,
                            size: 18, color: c.inkMuted),
                      ),
                      onSelected: (v) {
                        if (v == 'study') onOpen?.call();
                        if (v == 'sub') onAddSub();
                        if (v == 'rename') onRename();
                        if (v == 'move') onMove();
                        if (v == 'delete') onDelete?.call();
                      },
                      itemBuilder: (_) => [
                        // A grouping row with no deck of its own cannot be
                        // studied or deleted here; everything else works.
                        if (onOpen != null)
                          const PopupMenuItem(value: 'study', child: Text('Study')),
                        const PopupMenuItem(value: 'sub', child: Text('Add sub-deck')),
                        const PopupMenuItem(value: 'rename', child: Text('Rename')),
                        const PopupMenuItem(value: 'move', child: Text('Move to...')),
                        if (onDelete != null)
                          const PopupMenuItem(
                              value: 'delete',
                              child: Text('Delete',
                                  style: TextStyle(color: Colors.red))),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _CountBadge extends StatelessWidget {
  final int value;
  final Color color;
  const _CountBadge({required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    if (value <= 0) {
      final c = context.c;
      return Center(
        child: Text('0',
            style: TextStyle(
                fontSize: 13.5,
                fontWeight: FontWeight.w700,
                color: c.inkMuted.withValues(alpha: 0.55))),
      );
    }
    return Center(
      child: Text('$value',
          style: TextStyle(
              fontSize: 13.5, fontWeight: FontWeight.w800, color: color)),
    );
  }
}

// ---------------------------------------------------------------------------
// The deck sheet: create, create inside another deck, rename, or move.
//
// Nesting used to mean typing "Parent::Child" into a name box. The sheet lets
// the student pick where a deck goes from a list instead; underneath it still
// saves the same "Parent::Child" name, so no existing deck changes.
// ---------------------------------------------------------------------------

/// One place a deck can go in the "Inside" list.
class _ParentOption {
  final String path; // "Cardiology::Valves"
  final String label; // "Valves"
  final int depth;
  const _ParentOption(this.path, this.label, this.depth);
}

class _DeckSheetResult {
  /// "" = top level, otherwise a path like "Cardiology::Valves".
  final String parent;
  final String name;
  const _DeckSheetResult(this.parent, this.name);
}

String _pathLabel(String path) =>
    path.isEmpty ? 'None (top level)' : path.split('::').join(' › ');

/// [initialName] null means there is no name box (moving a deck).
/// [allowParent] false shows where the deck sits but does not let it change
/// (renaming).
Future<_DeckSheetResult?> _showDeckSheet(
  BuildContext context, {
  required String heading,
  required String actionLabel,
  required List<_ParentOption> parents,
  required String initialParent,
  String? initialName,
  bool allowParent = true,
}) {
  return showAdaptiveSheet<_DeckSheetResult>(
    context: context,
    useRootNavigator: true,
    isScrollControlled: true,
    backgroundColor: context.c.page,
    shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(22))),
    builder: (_) => _DeckSheet(
      heading: heading,
      actionLabel: actionLabel,
      parents: parents,
      initialParent: initialParent,
      initialName: initialName,
      allowParent: allowParent,
    ),
  );
}

class _DeckSheet extends StatefulWidget {
  final String heading;
  final String actionLabel;
  final List<_ParentOption> parents;
  final String initialParent;
  final String? initialName;
  final bool allowParent;
  const _DeckSheet({
    required this.heading,
    required this.actionLabel,
    required this.parents,
    required this.initialParent,
    required this.initialName,
    required this.allowParent,
  });

  @override
  State<_DeckSheet> createState() => _DeckSheetState();
}

class _DeckSheetState extends State<_DeckSheet> {
  late final TextEditingController _name =
      TextEditingController(text: widget.initialName ?? '');
  late String _parent = widget.initialParent;
  bool _open = false;
  bool _error = false;

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  void _save() {
    final name = _name.text.trim();
    if (widget.initialName != null && name.isEmpty) {
      setState(() => _error = true);
      return;
    }
    Navigator.of(context).pop(_DeckSheetResult(_parent, name));
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final hasName = widget.initialName != null;
    final name = _name.text.trim();
    final preview = [if (_parent.isNotEmpty) ..._parent.split('::'), if (name.isNotEmpty) name]
        .join(' › ');

    Widget label(String t) => Padding(
          padding: const EdgeInsets.only(top: 14, bottom: 6),
          child: Text(t,
              style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: c.inkSoft)),
        );

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(18, 10, 18, 18),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 38,
                  height: 4,
                  decoration: BoxDecoration(
                      color: c.lineStrong,
                      borderRadius: BorderRadius.circular(2)),
                ),
              ),
              const SizedBox(height: 14),
              Text(widget.heading,
                  style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: c.inkStrong)),
              if (hasName) ...[
                label('Name'),
                TextField(
                  controller: _name,
                  autofocus: true,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: InputDecoration(
                    hintText: 'Deck name',
                    errorText: _error ? 'Enter a name' : null,
                    isDense: true,
                    filled: true,
                    fillColor: c.surface2,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: c.line),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: c.line),
                    ),
                  ),
                  onChanged: (_) => setState(() => _error = false),
                  onTapOutside: (_) => FocusManager.instance.primaryFocus?.unfocus(),
                  onSubmitted: (_) => _save(),
                ),
              ],
              label('Inside'),
              GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: widget.allowParent
                    ? () {
                        FocusManager.instance.primaryFocus?.unfocus();
                        setState(() => _open = !_open);
                      }
                    : null,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                  decoration: BoxDecoration(
                    color: c.surface2,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: c.line),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(_pathLabel(_parent),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                                fontSize: 14.5,
                                color: widget.allowParent ? c.inkStrong : c.inkSoft)),
                      ),
                      if (widget.allowParent)
                        Icon(
                            _open
                                ? Icons.keyboard_arrow_up_rounded
                                : Icons.keyboard_arrow_down_rounded,
                            color: c.inkMuted),
                    ],
                  ),
                ),
              ),
              if (_open)
                Container(
                  margin: const EdgeInsets.only(top: 6),
                  constraints: const BoxConstraints(maxHeight: 220),
                  decoration: BoxDecoration(
                    color: c.card,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: c.line),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: ListView(
                    shrinkWrap: true,
                    padding: EdgeInsets.zero,
                    children: [
                      _option('', 'None (top level)', 0),
                      for (final p in widget.parents) _option(p.path, p.label, p.depth + 1),
                    ],
                  ),
                ),
              if (hasName && preview.isNotEmpty) ...[
                const SizedBox(height: 10),
                Text.rich(TextSpan(
                  style: TextStyle(fontSize: 12.5, color: c.inkSoft),
                  children: [
                    const TextSpan(text: 'Will be saved as '),
                    TextSpan(
                        text: preview,
                        style: TextStyle(
                            fontWeight: FontWeight.w700, color: c.inkStrong)),
                  ],
                )),
              ],
              const SizedBox(height: 18),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: c.primary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                  ),
                  onPressed: _save,
                  child: Text(widget.actionLabel,
                      style: const TextStyle(
                          fontSize: 15.5, fontWeight: FontWeight.w800)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _option(String path, String text, int depth) {
    final c = context.c;
    final on = path == _parent;
    return InkWell(
      onTap: () => setState(() {
        _parent = path;
        _open = false;
      }),
      child: Container(
        color: on ? c.primary.withValues(alpha: 0.10) : null,
        padding: EdgeInsets.fromLTRB(12 + depth * 16.0, 11, 12, 11),
        child: Row(
          children: [
            Expanded(
              child: Text(text,
                  style: TextStyle(
                      fontSize: 14,
                      fontWeight: on ? FontWeight.w800 : FontWeight.w600,
                      color: on ? c.primary : c.inkStrong)),
            ),
            if (on) Icon(Icons.check_rounded, size: 18, color: c.primary),
          ],
        ),
      ),
    );
  }
}
