import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';
import 'personal_flashcards_store.dart';

/// Cards inside one personal deck. Add / edit / delete cards, start review.
class PersonalDeckPage extends StatefulWidget {
  final String deckId;
  final String title;

  const PersonalDeckPage({
    super.key,
    required this.deckId,
    required this.title,
  });

  @override
  State<PersonalDeckPage> createState() => _PersonalDeckPageState();
}

class _PersonalDeckPageState extends State<PersonalDeckPage> {
  List<PersonalCard> _cards = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final cards = await PersonalFlashcardsStore.loadCards(widget.deckId);
    if (mounted) setState(() { _cards = cards; _loading = false; });
  }

  Future<void> _addCard() async {
    final result = await _showCardEditor(context, '', '');
    if (result == null) return;
    HapticFeedback.mediumImpact();
    await PersonalFlashcardsStore.addCard(widget.deckId, result.$1, result.$2);
    _load();
  }

  Future<void> _editCard(PersonalCard card) async {
    final result = await _showCardEditor(context, card.front, card.back);
    if (result == null) return;
    await PersonalFlashcardsStore.updateCard(
        widget.deckId, card.id, result.$1, result.$2);
    _load();
  }

  Future<void> _deleteCard(PersonalCard card) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Card?'),
        content: const Text('This card will be removed permanently.'),
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
    await PersonalFlashcardsStore.deleteCard(widget.deckId, card.id);
    _load();
  }

  Future<void> _startReview() async {
    final due = _cards.where((c) => c.isDue).toList();
    if (due.isEmpty) return;
    await context.push(
      '/app/my-flashcards/${widget.deckId}/review?title=${Uri.encodeComponent(widget.title)}',
    );
    // Refresh due counts / card states after the review session ends.
    if (mounted) _load();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final dueCount = _cards.where((c) => c.isDue).length;

    return Scaffold(
      backgroundColor: c.page,
      body: SafeArea(
        child: Column(
          children: [
            // ── Header ──
            Padding(
              padding: const EdgeInsets.fromLTRB(4, 8, 8, 0),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back_ios_new_rounded),
                    onPressed: () => context.pop(),
                    color: c.inkStrong,
                  ),
                  Expanded(
                    child: Text(widget.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            color: c.inkStrong)),
                  ),
                  IconButton(
                    icon: const Icon(Icons.add_rounded),
                    onPressed: _addCard,
                    color: c.primary,
                    tooltip: 'Add card',
                  ),
                ],
              ),
            ),

            // ── Study button ──
            if (!_loading && dueCount > 0)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
                child: SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: _startReview,
                    icon: const Icon(Icons.play_arrow_rounded),
                    label: Text('Study $dueCount card${dueCount == 1 ? '' : 's'}'),
                  ),
                ),
              ),

            const SizedBox(height: 10),

            // ── Card list ──
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _cards.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.credit_card_off_outlined,
                                  size: 52, color: c.inkMuted),
                              const SizedBox(height: 12),
                              Text('No cards yet',
                                  style: TextStyle(
                                      fontSize: 17,
                                      fontWeight: FontWeight.w700,
                                      color: c.inkStrong)),
                              const SizedBox(height: 6),
                              Text('Tap + to add your first card',
                                  style: TextStyle(
                                      fontSize: 14, color: c.inkSoft)),
                            ],
                          ),
                        )
                      : ListView.separated(
                          padding:
                              const EdgeInsets.fromLTRB(16, 4, 16, 100),
                          itemCount: _cards.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 8),
                          itemBuilder: (ctx, i) {
                            final card = _cards[i];
                            return _CardTile(
                              card: card,
                              onEdit: () => _editCard(card),
                              onDelete: () => _deleteCard(card),
                            );
                          },
                        ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Returns (front, back) or null if cancelled.
Future<(String, String)?> _showCardEditor(
    BuildContext context, String initFront, String initBack) async {
  final frontCtrl = TextEditingController(text: initFront);
  final backCtrl = TextEditingController(text: initBack);

  return showModalBottomSheet<(String, String)>(
    context: context,
    isScrollControlled: true,
    backgroundColor: context.c.page,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (ctx) {
      return Padding(
        padding: EdgeInsets.only(
          left: 20,
          right: 20,
          top: 20,
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(initFront.isEmpty ? 'New Card' : 'Edit Card',
                style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: ctx.c.inkStrong)),
            const SizedBox(height: 16),
            TextField(
              controller: frontCtrl,
              autofocus: true,
              textCapitalization: TextCapitalization.sentences,
              minLines: 2,
              maxLines: 4,
              decoration: const InputDecoration(
                labelText: 'Front (question)',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: backCtrl,
              textCapitalization: TextCapitalization.sentences,
              minLines: 2,
              maxLines: 4,
              decoration: const InputDecoration(
                labelText: 'Back (answer)',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(ctx),
                    child: const Text('Cancel'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton(
                    onPressed: () {
                      final f = frontCtrl.text.trim();
                      final b = backCtrl.text.trim();
                      if (f.isEmpty || b.isEmpty) return;
                      Navigator.pop(ctx, (f, b));
                    },
                    child: const Text('Save'),
                  ),
                ),
              ],
            ),
          ],
        ),
      );
    },
  );
}

class _CardTile extends StatelessWidget {
  final PersonalCard card;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  const _CardTile(
      {required this.card, required this.onEdit, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final isDue = card.isDue;
    return GlassCard(
      onTap: onEdit,
      padding: const EdgeInsets.fromLTRB(14, 12, 8, 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(card.front,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.w700,
                        color: c.inkStrong)),
                const SizedBox(height: 4),
                Text(card.back,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 13, color: c.inkSoft)),
                if (card.reviewCount > 0) ...[
                  const SizedBox(height: 5),
                  Text(
                    isDue
                        ? 'Due now'
                        : 'Next: ${_fmtDate(card.nextReview!)}',
                    style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: isDue
                            ? const Color(0xFFDC2626)
                            : c.inkMuted),
                  ),
                ],
              ],
            ),
          ),
          PopupMenuButton<String>(
            icon: Icon(Icons.more_vert_rounded, size: 20, color: c.inkMuted),
            onSelected: (v) {
              if (v == 'edit') onEdit();
              if (v == 'delete') onDelete();
            },
            itemBuilder: (_) => [
              const PopupMenuItem(value: 'edit', child: Text('Edit')),
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

  String _fmtDate(DateTime d) {
    final now = DateTime.now();
    final diff = d.difference(now);
    if (diff.inDays < 1) return 'Today';
    if (diff.inDays == 1) return 'Tomorrow';
    if (diff.inDays < 7) return 'in ${diff.inDays}d';
    if (diff.inDays < 30) return 'in ${(diff.inDays / 7).round()}w';
    return 'in ${(diff.inDays / 30).round()}mo';
  }
}
