import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';
import '../../widgets/content_image.dart';
import 'ecg_repository.dart';

/// Topic detail — the topic's ECG image + explanation cards.
class EcgTopicPage extends ConsumerWidget {
  final int topicId;
  const EcgTopicPage({super.key, required this.topicId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final async = ref.watch(ecgTopicProvider(topicId));
    final isLandscape = MediaQuery.orientationOf(context) == Orientation.landscape;
    final hPad = isLandscape ? 24.0 : 16.0;

    return SafeArea(
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 820),
          child: RefreshIndicator(
            onRefresh: () async => ref.refresh(ecgTopicProvider(topicId).future),
            child: ListView(
              padding: EdgeInsets.fromLTRB(hPad, 8, hPad, 32),
              children: [
                // Back row + title
                _Header(c: c, detail: async.asData?.value),

                const SizedBox(height: 14),

                async.when(
                  loading: () => _CardSkeleton(c: c),
                  error: (e, _) => _ErrorBox(
                    c: c, onRetry: () => ref.refresh(ecgTopicProvider(topicId)),
                  ),
                  data: (detail) {
                    if (detail.topic == null) {
                      return _EmptyBox(c: c, text: 'This topic is unavailable.');
                    }
                    if (detail.cards.isEmpty) {
                      return _EmptyBox(c: c, text: 'No ECGs in this topic yet.');
                    }
                    return Column(
                      children: [
                        for (var i = 0; i < detail.cards.length; i++) ...[
                          _CardView(
                            index: i,
                            card: detail.cards[i],
                            c: c,
                            landscape: isLandscape,
                          ),
                          const SizedBox(height: AppSpace.x4),
                        ],
                      ],
                    );
                  },
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  final AppColors c;
  final EcgTopicDetail? detail;
  const _Header({required this.c, this.detail});

  @override
  Widget build(BuildContext context) {
    final title = detail?.topic?.title ?? 'ECG';
    final desc = detail?.topic?.description ?? '';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            IconButton(
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(minWidth: 40, minHeight: 40),
              icon: Icon(Icons.arrow_back_ios_new_rounded, size: 20, color: c.inkStrong),
              onPressed: () => context.pop(),
            ),
            const SizedBox(width: 4),
            Expanded(
              child: Text(title,
                  maxLines: 1, overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800,
                      letterSpacing: -0.4, color: c.inkStrong)),
            ),
          ],
        ),
        if (desc.isNotEmpty) ...[
          const SizedBox(height: 2),
          Padding(
            padding: const EdgeInsets.only(left: 4),
            child: Text(desc,
                style: TextStyle(fontSize: 14, height: 1.4, color: c.inkSoft)),
          ),
        ],
      ],
    );
  }
}

// ── One ECG card ──────────────────────────────────────────────────────────────

class _CardView extends StatelessWidget {
  final int index;
  final EcgCard card;
  final AppColors c;
  final bool landscape;
  const _CardView({
    required this.index, required this.card, required this.c, required this.landscape,
  });

  @override
  Widget build(BuildContext context) {
    final head = Row(
      children: [
        Container(
          width: 28, height: 28,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: c.primary.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(9),
          ),
          child: Text('${index + 1}',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: c.primary)),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(card.title,
              style: TextStyle(fontSize: 16.5, fontWeight: FontWeight.w800,
                  letterSpacing: -0.3, color: c.inkStrong)),
        ),
      ],
    );

    final image = card.imageUrl.isEmpty
        ? const SizedBox.shrink()
        : Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(AppRadius.inner),
              border: Border.all(color: c.line),
            ),
            padding: const EdgeInsets.all(8),
            child: ContentImage(card.imageUrl, fit: BoxFit.contain, borderRadius: 8),
          );

    final explanation = card.explanation.isEmpty
        ? const SizedBox.shrink()
        : Text(card.explanation,
            style: TextStyle(fontSize: 14.5, height: 1.6, color: c.inkSoft));

    // Landscape & wide → image left, explanation right; portrait → stacked.
    final body = landscape
        ? Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(flex: 5, child: image),
              const SizedBox(width: AppSpace.x4),
              Expanded(flex: 4, child: explanation),
            ],
          )
        : Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              image,
              if (card.imageUrl.isNotEmpty && card.explanation.isNotEmpty)
                const SizedBox(height: AppSpace.x3),
              explanation,
            ],
          );

    return GlassCard(
      padding: const EdgeInsets.all(AppSpace.x4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          head,
          const SizedBox(height: AppSpace.x3),
          body,
        ],
      ),
    );
  }
}

// ── States ────────────────────────────────────────────────────────────────────

class _CardSkeleton extends StatelessWidget {
  final AppColors c;
  const _CardSkeleton({required this.c});
  @override
  Widget build(BuildContext context) {
    return Column(
      children: List.generate(2, (_) => Padding(
        padding: const EdgeInsets.only(bottom: AppSpace.x4),
        child: Container(
          height: 260,
          decoration: BoxDecoration(
            color: c.card,
            borderRadius: BorderRadius.circular(AppRadius.card),
            border: Border.all(color: c.line),
          ),
        ),
      )),
    );
  }
}

class _EmptyBox extends StatelessWidget {
  final AppColors c;
  final String text;
  const _EmptyBox({required this.c, required this.text});
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 48),
      child: Center(
        child: Text(text, textAlign: TextAlign.center,
            style: TextStyle(fontSize: 14, color: c.inkSoft)),
      ),
    );
  }
}

class _ErrorBox extends StatelessWidget {
  final AppColors c;
  final VoidCallback onRetry;
  const _ErrorBox({required this.c, required this.onRetry});
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 40),
      child: Column(
        children: [
          Icon(Icons.cloud_off_rounded, size: 32, color: c.inkMuted),
          const SizedBox(height: 12),
          Text("Couldn't load this topic",
              style: TextStyle(fontSize: 14, color: c.inkSoft)),
          const SizedBox(height: 14),
          OutlinedButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    );
  }
}
