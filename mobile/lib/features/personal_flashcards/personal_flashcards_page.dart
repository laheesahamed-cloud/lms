import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../theme/tokens.dart';
import 'personal_flashcards_store.dart';

/// My Flashcards — an Anki-style deck browser. Decks are still stored flat
/// (one PersonalDeck per id/title), but a title containing "::" — e.g.
/// "Cardiology::1" — is treated as a nested deck the same way real Anki
/// parses deck names, so the list renders as an expandable/collapsible tree
/// instead of one row per deck.
class PersonalFlashcardsPage extends StatefulWidget {
  const PersonalFlashcardsPage({super.key});

  @override
  State<PersonalFlashcardsPage> createState() =>
      _PersonalFlashcardsPageState();
}

class _PersonalFlashcardsPageState extends State<PersonalFlashcardsPage> {
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

  Future<void> _createDeck() async {
    final title = await _promptTitle(context, 'New Deck', '',
        helperText: 'Use "::" to nest, e.g. "Cardiology::1"');
    if (title == null) return;
    HapticFeedback.mediumImpact();
    await PersonalFlashcardsStore.createDeck(title);
    _load();
  }

  Future<void> _renameDeck(_DeckEntry e) async {
    final title = await _promptTitle(context, 'Rename Deck', e.deck.title);
    if (title == null) return;
    await PersonalFlashcardsStore.renameDeck(e.deck.id, title);
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
    return SafeArea(
      child: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 100),
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('MY FLASHCARDS',
                                style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: 1.4,
                                    color: c.accent)),
                            const SizedBox(height: 4),
                            Text('My Decks',
                                style: TextStyle(
                                    fontSize: 28,
                                    fontWeight: FontWeight.w800,
                                    color: c.inkStrong,
                                    letterSpacing: -0.5)),
                          ],
                        ),
                      ),
                      _AddButton(onTap: _createDeck),
                    ],
                  ),
                  const SizedBox(height: 18),
                  if (_tree.isEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 40),
                      child: Column(
                        children: [
                          Icon(Icons.style_outlined,
                              size: 52, color: c.inkMuted),
                          const SizedBox(height: 12),
                          Text('No decks yet',
                              style: TextStyle(
                                  fontSize: 17,
                                  fontWeight: FontWeight.w700,
                                  color: c.inkStrong)),
                          const SizedBox(height: 6),
                          Text('Tap + to create your first deck',
                              style:
                                  TextStyle(fontSize: 14, color: c.inkSoft)),
                        ],
                      ),
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
                      child: Column(
                        children: _renderNodes(_tree, depth: 0),
                      ),
                    ),
                  ],
                ],
              ),
            ),
    );
  }

  List<Widget> _renderNodes(List<_DeckNode> nodes, {required int depth}) {
    final widgets = <Widget>[];
    for (final node in nodes) {
      widgets.add(_DeckRow(
        node: node,
        depth: depth,
        open: _expanded.contains(node.key),
        onToggle: () => _toggle(node.key),
        onOpen: node.entry != null ? () => _openDeck(node.entry!) : null,
        onRename: node.entry != null ? () => _renameDeck(node.entry!) : null,
        onDelete: node.entry != null ? () => _deleteDeck(node.entry!) : null,
      ));
      if (node.children.isNotEmpty && _expanded.contains(node.key)) {
        widgets.addAll(_renderNodes(node.children, depth: depth + 1));
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

/// Aggregated new/due/total across a node and every descendant — so a
/// collapsed "Cardiology" branch shows the combined counts of "1", "4", "5".
DeckStats _aggregateStats(_DeckNode node) {
  var total = 0, newCount = 0, dueCount = 0;
  void visit(_DeckNode n) {
    final entry = n.entry;
    if (entry != null) {
      total += entry.stats.total;
      newCount += entry.stats.newCount;
      dueCount += entry.stats.dueCount;
    }
    for (final child in n.children) {
      visit(child);
    }
  }

  visit(node);
  return DeckStats(total: total, newCount: newCount, dueCount: dueCount);
}

Future<String?> _promptTitle(
    BuildContext context, String dialogTitle, String initial,
    {String? helperText}) async {
  final ctrl = TextEditingController(text: initial);
  return showDialog<String>(
    useRootNavigator: true,
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(dialogTitle),
      content: TextField(
        controller: ctrl,
        autofocus: true,
        decoration: InputDecoration(
            hintText: 'Deck name', helperText: helperText),
        textCapitalization: TextCapitalization.sentences,
        // Dismiss the keyboard when tapping anywhere outside the field —
        // inside a dialog the app-level tap-to-unfocus never fires.
        onTapOutside: (_) => FocusManager.instance.primaryFocus?.unfocus(),
        onSubmitted: (v) => Navigator.pop(ctx, v),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel')),
        TextButton(
            onPressed: () => Navigator.pop(ctx, ctrl.text),
            child: const Text('Save')),
      ],
    ),
  );
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

class _AddButton extends StatelessWidget {
  final VoidCallback onTap;
  const _AddButton({required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    // Same foreground-on-primary logic as AppButton's primary kind — c.primary
    // is bright enough in dark mode to need a dark (not white) foreground for
    // real contrast; this was hardcoding white unconditionally.
    final dark = Theme.of(context).brightness == Brightness.dark;
    final fg = dark ? const Color(0xFF04121F) : Colors.white;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: c.primary,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.add_rounded, size: 16, color: fg),
            const SizedBox(width: 4),
            Text('New Deck',
                style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: fg)),
          ],
        ),
      ),
    );
  }
}

/// Column header above the deck table (Deck / New / Due), matching a real
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
      padding: const EdgeInsets.fromLTRB(12, 0, 10, 6),
      child: Row(
        children: [
          Expanded(child: Text('DECK', style: headStyle)),
          SizedBox(
              width: 44,
              child: Text('NEW', textAlign: TextAlign.center, style: headStyle)),
          SizedBox(
              width: 44,
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
  final VoidCallback? onRename;
  final VoidCallback? onDelete;

  const _DeckRow({
    required this.node,
    required this.depth,
    required this.open,
    required this.onToggle,
    this.onOpen,
    this.onRename,
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
        if (depth > 0)
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
                    width: 18,
                    child: hasChildren
                        ? Icon(
                            open
                                ? Icons.keyboard_arrow_down_rounded
                                : Icons.keyboard_arrow_right_rounded,
                            size: 18,
                            color: c.inkMuted,
                          )
                        : null,
                  ),
                  Expanded(
                    child: Text(
                      node.label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 14.5,
                        fontWeight: isBold ? FontWeight.w800 : FontWeight.w600,
                        color: c.inkStrong,
                      ),
                    ),
                  ),
                  SizedBox(
                    width: 44,
                    child: _CountBadge(
                        value: stats.newCount, color: const Color(0xFF2563EB)),
                  ),
                  SizedBox(
                    width: 44,
                    child: _CountBadge(
                        value: stats.dueCount, color: const Color(0xFFDC2626)),
                  ),
                  SizedBox(
                    width: 30,
                    child: onOpen == null
                        ? null
                        : PopupMenuButton<String>(
                            padding: EdgeInsets.zero,
                            icon: Icon(Icons.more_vert_rounded,
                                size: 18, color: c.inkMuted),
                            onSelected: (v) {
                              if (v == 'study') onOpen?.call();
                              if (v == 'rename') onRename?.call();
                              if (v == 'delete') onDelete?.call();
                            },
                            itemBuilder: (_) => [
                              const PopupMenuItem(
                                  value: 'study', child: Text('Study')),
                              const PopupMenuItem(
                                  value: 'rename', child: Text('Rename')),
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
                fontSize: 12.5,
                fontWeight: FontWeight.w700,
                color: c.inkMuted.withValues(alpha: 0.55))),
      );
    }
    return Center(
      child: Text('$value',
          style: TextStyle(
              fontSize: 12.5, fontWeight: FontWeight.w800, color: color)),
    );
  }
}
