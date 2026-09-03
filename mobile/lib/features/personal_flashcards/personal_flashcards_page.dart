import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';
import 'personal_flashcards_store.dart';

/// My Flashcards — list of user-created local decks.
class PersonalFlashcardsPage extends StatefulWidget {
  const PersonalFlashcardsPage({super.key});

  @override
  State<PersonalFlashcardsPage> createState() =>
      _PersonalFlashcardsPageState();
}

class _PersonalFlashcardsPageState extends State<PersonalFlashcardsPage> {
  List<_DeckEntry> _entries = [];
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
    if (mounted) setState(() { _entries = entries; _loading = false; });
  }

  Future<void> _createDeck() async {
    final title = await _promptTitle(context, 'New Deck', '');
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
                  if (_entries.isEmpty)
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
                  else
                    for (final e in _entries)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: _DeckTile(
                          entry: e,
                          onTap: () async {
                            await context.push(
                                '/app/my-flashcards/${e.deck.id}?title=${Uri.encodeComponent(e.deck.title)}');
                            _load();
                          },
                          onRename: () => _renameDeck(e),
                          onDelete: () => _deleteDeck(e),
                        ),
                      ),
                ],
              ),
            ),
    );
  }
}

Future<String?> _promptTitle(
    BuildContext context, String dialogTitle, String initial) async {
  final ctrl = TextEditingController(text: initial);
  return showDialog<String>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(dialogTitle),
      content: TextField(
        controller: ctrl,
        autofocus: true,
        decoration: const InputDecoration(hintText: 'Deck name'),
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

class _AddButton extends StatelessWidget {
  final VoidCallback onTap;
  const _AddButton({required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
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
            Icon(Icons.add_rounded, size: 16, color: Colors.white),
            const SizedBox(width: 4),
            Text('New Deck',
                style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: Colors.white)),
          ],
        ),
      ),
    );
  }
}

class _DeckTile extends StatelessWidget {
  final _DeckEntry entry;
  final VoidCallback onTap;
  final VoidCallback onRename;
  final VoidCallback onDelete;
  const _DeckTile({
    required this.entry,
    required this.onTap,
    required this.onRename,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final s = entry.stats;
    return GlassCard(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: c.primary.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(Icons.style_rounded, size: 20, color: c.primary),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(entry.deck.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                        fontSize: 15.5,
                        fontWeight: FontWeight.w700,
                        color: c.inkStrong)),
                const SizedBox(height: 3),
                Row(
                  children: [
                    if (s.newCount > 0)
                      _Chip('${s.newCount} new', const Color(0xFF2563EB)),
                    if (s.newCount > 0 && s.dueCount > 0)
                      const SizedBox(width: 6),
                    if (s.dueCount > 0)
                      _Chip('${s.dueCount} due', const Color(0xFFDC2626)),
                    if (s.newCount == 0 && s.dueCount == 0)
                      Text('${s.total} card${s.total == 1 ? '' : 's'}',
                          style: TextStyle(fontSize: 12, color: c.inkSoft)),
                  ],
                ),
              ],
            ),
          ),
          PopupMenuButton<String>(
            icon: Icon(Icons.more_vert_rounded, size: 20, color: c.inkMuted),
            onSelected: (v) {
              if (v == 'rename') onRename();
              if (v == 'delete') onDelete();
            },
            itemBuilder: (_) => [
              const PopupMenuItem(value: 'rename', child: Text('Rename')),
              const PopupMenuItem(
                  value: 'delete',
                  child: Text('Delete',
                      style: TextStyle(color: Colors.red))),
            ],
          ),
        ],
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  final String label;
  final Color color;
  const _Chip(this.label, this.color);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Text(label,
          style: TextStyle(
              fontSize: 11, fontWeight: FontWeight.w700, color: color)),
    );
  }
}
