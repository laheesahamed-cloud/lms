import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import 'package:go_router/go_router.dart';

import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';
import 'auscultation_repository.dart';

class AuscultationPage extends ConsumerStatefulWidget {
  const AuscultationPage({super.key});
  @override
  ConsumerState<AuscultationPage> createState() => _AuscultationPageState();
}

class _AuscultationPageState extends ConsumerState<AuscultationPage> {
  String _category = 'heart';

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final topicsAsync = ref.watch(auscTopicsProvider(_category));
    final isLandscape = MediaQuery.orientationOf(context) == Orientation.landscape;
    final hPad = isLandscape ? 24.0 : 16.0;
    final accent = _category == 'lung' ? const Color(0xFF2F9E8F) : const Color(0xFFE0567B);

    return SafeArea(
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 760),
          child: RefreshIndicator(
            onRefresh: () async => ref.refresh(auscTopicsProvider(_category).future),
            child: ListView(
              padding: EdgeInsets.fromLTRB(hPad, 14, hPad, 32),
              children: [
                if (!isLandscape) ...[
                  Text('STUDY TOOL', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, letterSpacing: 1.4, color: c.accent)),
                  const SizedBox(height: 5),
                  Text('Auscultation', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, letterSpacing: -0.5, color: c.inkStrong)),
                  const SizedBox(height: 4),
                  Text('Heart & lung sounds', style: TextStyle(fontSize: 14, color: c.inkSoft)),
                  const SizedBox(height: 14),
                ] else ...[
                  Row(children: [
                    Text('Auscultation', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, letterSpacing: -0.4, color: c.inkStrong)),
                    const SizedBox(width: 12),
                    Expanded(child: Text('Heart & lung sounds', maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13, color: c.inkSoft))),
                  ]),
                  const SizedBox(height: 12),
                ],

                // Heart / Lung tabs
                _CategoryTabs(value: _category, onChange: (v) => setState(() => _category = v), c: c),
                const SizedBox(height: 16),

                // Quiz banner
                GlassCard(
                  onTap: () => context.push('/app/auscultation/quiz?category=$_category'),
                  padding: const EdgeInsets.all(AppSpace.x4),
                  child: Row(children: [
                    Container(
                      width: 48, height: 48,
                      decoration: BoxDecoration(borderRadius: BorderRadius.circular(AppRadius.inner), color: accent.withValues(alpha: 0.14)),
                      child: Icon(Icons.headphones_rounded, size: 24, color: accent),
                    ),
                    const SizedBox(width: AppSpace.x4),
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                      Text('${_category == 'lung' ? 'Lung' : 'Heart'} Sounds Quiz', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, letterSpacing: -0.2, color: c.inkStrong)),
                      const SizedBox(height: AppSpace.x1),
                      Text('Listen and identify the sound', maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 14, height: 1.3, color: c.inkSoft)),
                    ])),
                    Icon(Icons.chevron_right_rounded, size: 22, color: c.inkMuted),
                  ]),
                ),
                const SizedBox(height: AppSpace.x4),

                topicsAsync.when(
                  loading: () => const Center(child: CircularProgressIndicator()),
                  error: (e, _) => _errorBox(c, () => ref.refresh(auscTopicsProvider(_category))),
                  data: (topics) {
                    if (topics.isEmpty) {
                      return Padding(padding: const EdgeInsets.symmetric(vertical: 40),
                        child: Center(child: Text('No $_category sound topics yet.', style: TextStyle(fontSize: 14, color: c.inkSoft))));
                    }
                    return AnimationLimiter(
                      child: Column(
                        children: AnimationConfiguration.toStaggeredList(
                          duration: const Duration(milliseconds: 375),
                          childAnimationBuilder: (w) => SlideAnimation(
                            verticalOffset: 22,
                            child: FadeInAnimation(child: w),
                          ),
                          children: [
                            for (var i = 0; i < topics.length; i++)
                              Padding(
                                padding: const EdgeInsets.only(bottom: AppSpace.x3),
                                child: _TopicTile(index: i, topic: topics[i], c: c, onTap: () => context.push('/app/auscultation/topic/${topics[i].id}')),
                              ),
                          ],
                        ),
                      ),
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

  Widget _errorBox(AppColors c, VoidCallback onRetry) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 40),
    child: Column(children: [
      Icon(Icons.cloud_off_rounded, size: 32, color: c.inkMuted),
      const SizedBox(height: 12),
      Text("Couldn't load topics", style: TextStyle(fontSize: 14, color: c.inkSoft)),
      const SizedBox(height: 14),
      OutlinedButton(onPressed: onRetry, child: const Text('Retry')),
    ]),
  );
}

class _CategoryTabs extends StatelessWidget {
  final String value;
  final ValueChanged<String> onChange;
  final AppColors c;
  const _CategoryTabs({required this.value, required this.onChange, required this.c});

  @override
  Widget build(BuildContext context) {
    Widget tab(String key, IconData icon, String label) {
      final active = value == key;
      return GestureDetector(
        onTap: () => onChange(key),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 9),
          decoration: BoxDecoration(
            color: active ? c.card : Colors.transparent,
            borderRadius: BorderRadius.circular(9),
            boxShadow: active ? [BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 8, offset: const Offset(0, 2))] : null,
          ),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Icon(icon, size: 16, color: active ? c.inkStrong : c.inkSoft),
            const SizedBox(width: 7),
            Text(label, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: active ? c.inkStrong : c.inkSoft)),
          ]),
        ),
      );
    }

    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(color: c.surface2, borderRadius: BorderRadius.circular(12)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          tab('heart', Icons.favorite_rounded, 'Heart'),
          const SizedBox(width: 4),
          tab('lung', Icons.air_rounded, 'Lung'),
        ]),
      ),
    );
  }
}

class _TopicTile extends StatelessWidget {
  final int index;
  final AuscTopic topic;
  final AppColors c;
  final VoidCallback onTap;
  const _TopicTile({required this.index, required this.topic, required this.c, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final num = (index + 1).toString().padLeft(2, '0');
    return GlassCard(
      onTap: onTap,
      padding: const EdgeInsets.all(AppSpace.x4),
      child: Row(children: [
        SizedBox(width: 38, child: Text(num, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, letterSpacing: -0.5, color: c.primary))),
        const SizedBox(width: AppSpace.x3),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
          Text(topic.title, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, letterSpacing: -0.2, color: c.inkStrong)),
          if (topic.description.isNotEmpty) ...[
            const SizedBox(height: 3),
            Text(topic.description, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13, height: 1.35, color: c.inkSoft)),
          ],
          const SizedBox(height: 6),
          Text('${topic.cardCount} sound${topic.cardCount == 1 ? '' : 's'}', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, letterSpacing: 0.3, color: c.primary)),
        ])),
        const SizedBox(width: AppSpace.x2),
        Icon(Icons.chevron_right_rounded, size: 22, color: c.inkMuted),
      ]),
    );
  }
}
