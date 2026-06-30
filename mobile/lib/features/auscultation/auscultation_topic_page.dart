import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';
import 'auscultation_repository.dart';
import 'widgets/audio_player_card.dart';

class AuscultationTopicPage extends ConsumerWidget {
  final int topicId;
  const AuscultationTopicPage({super.key, required this.topicId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final async = ref.watch(auscTopicProvider(topicId));
    final isLandscape = MediaQuery.orientationOf(context) == Orientation.landscape;
    final hPad = isLandscape ? 24.0 : 16.0;
    final detail = async.asData?.value;
    final category = detail?.topic?.category == 'lung' ? 'lung' : 'heart';

    return SafeArea(
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 760),
          child: RefreshIndicator(
            onRefresh: () async => ref.refresh(auscTopicProvider(topicId).future),
            child: ListView(
              padding: EdgeInsets.fromLTRB(hPad, 8, hPad, 32),
              children: [
                Row(children: [
                  IconButton(
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(minWidth: 40, minHeight: 40),
                    icon: Icon(Icons.arrow_back_ios_new_rounded, size: 20, color: c.inkStrong),
                    onPressed: () => context.pop(),
                  ),
                  const SizedBox(width: 4),
                  Expanded(child: Text(detail?.topic?.title ?? 'Auscultation', maxLines: 1, overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, letterSpacing: -0.4, color: c.inkStrong))),
                ]),
                if ((detail?.topic?.description ?? '').isNotEmpty)
                  Padding(padding: const EdgeInsets.only(left: 4, bottom: 4),
                    child: Text(detail!.topic!.description, style: TextStyle(fontSize: 14, height: 1.4, color: c.inkSoft))),
                const SizedBox(height: 14),

                async.when(
                  loading: () => Column(children: List.generate(2, (_) => Padding(
                    padding: const EdgeInsets.only(bottom: AppSpace.x4),
                    child: Container(height: 170, decoration: BoxDecoration(color: c.card, borderRadius: BorderRadius.circular(AppRadius.card), border: Border.all(color: c.line))),
                  ))),
                  error: (e, _) => _msg(c, "Couldn't load this topic"),
                  data: (d) {
                    if (d.topic == null) return _msg(c, 'This topic is unavailable.');
                    if (d.cards.isEmpty) return _msg(c, 'No sounds in this topic yet.');
                    return Column(children: [
                      for (var i = 0; i < d.cards.length; i++) ...[
                        _SoundCard(index: i, card: d.cards[i], category: category, c: c),
                        const SizedBox(height: AppSpace.x4),
                      ],
                    ]);
                  },
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _msg(AppColors c, String t) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 44),
    child: Center(child: Text(t, textAlign: TextAlign.center, style: TextStyle(fontSize: 14, color: c.inkSoft))),
  );
}

class _SoundCard extends StatelessWidget {
  final int index;
  final AuscCard card;
  final String category;
  final AppColors c;
  const _SoundCard({required this.index, required this.card, required this.category, required this.c});

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      padding: const EdgeInsets.all(AppSpace.x4),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
            width: 28, height: 28, alignment: Alignment.center,
            decoration: BoxDecoration(color: c.primary.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(9)),
            child: Text('${index + 1}', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: c.primary)),
          ),
          const SizedBox(width: 10),
          Expanded(child: Text(card.title, style: TextStyle(fontSize: 16.5, fontWeight: FontWeight.w800, letterSpacing: -0.3, color: c.inkStrong))),
        ]),
        const SizedBox(height: AppSpace.x3),
        if (card.hasAudio)
          AudioPlayerCard(kind: 'cards', id: card.id, category: category, title: card.title),
        if (card.explanation.isNotEmpty) ...[
          const SizedBox(height: AppSpace.x3),
          Text(card.explanation, style: TextStyle(fontSize: 14.5, height: 1.6, color: c.inkSoft)),
        ],
      ]),
    );
  }
}
