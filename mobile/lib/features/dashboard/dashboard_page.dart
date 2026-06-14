import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import 'package:go_router/go_router.dart';

import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';
import '../../widgets/app_button.dart';
import '../../widgets/score_ring.dart';
import '../../state/auth_controller.dart';

class DashboardPage extends ConsumerWidget {
  const DashboardPage({super.key});

  String _greeting() {
    final h = DateTime.now().hour;
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final user = ref.watch(authControllerProvider).user;
    final name = (user?.fullName.trim().isNotEmpty ?? false)
        ? user!.fullName.split(RegExp(r'\s+')).first
        : 'there';

    final initials = user?.initials ?? 'MS';
    final reduced = MediaQuery.of(context).disableAnimations;
    final kids = <Widget>[
              // Top bar: notifications + profile
              Row(
                children: [
                  const Spacer(),
                  IconButton(
                    onPressed: () => context.push('/app/notifications'),
                    icon: Icon(Icons.notifications_none_rounded,
                        color: c.inkMedium),
                  ),
                  GestureDetector(
                    onTap: () => context.push('/app/profile'),
                    child: Container(
                      width: 38,
                      height: 38,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: LinearGradient(colors: [
                          c.accent.withValues(alpha: 0.30),
                          c.primary.withValues(alpha: 0.24),
                        ]),
                      ),
                      child: Text(initials,
                          style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w800,
                              color: c.inkStrong)),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 2),
              // Hero
              Text('${_greeting()}, $name',
                  style: TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.4,
                      color: c.accent)),
              const SizedBox(height: 5),
              Text('Study Hub',
                  style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.w800,
                      color: c.inkStrong,
                      letterSpacing: -0.5)),
              const SizedBox(height: 4),
              Text("You're 2 quizzes from your daily goal.",
                  style: TextStyle(fontSize: 13.5, color: c.inkSoft)),
              const SizedBox(height: 14),
              const _MetricRow(),
              const SizedBox(height: 14),
              // The single hero CTA (gradient).
              AppButton('Start daily goal',
                  kind: AppButtonKind.cta,
                  expand: true,
                  leading: const Icon(Icons.play_arrow_rounded,
                      color: Colors.white, size: 20),
                  onPressed: () {}),
              const SizedBox(height: 14),
              const _MascotCard(),
              const SizedBox(height: 14),
              const _ResultCard(),
              const SizedBox(height: 14),
              const _WeakTopics(),
              const SizedBox(height: 14),
              const _RecentResults(),
    ];
    final list = ListView(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
      children: reduced
          ? kids
          : AnimationConfiguration.toStaggeredList(
              duration: const Duration(milliseconds: 380),
              childAnimationBuilder: (w) => SlideAnimation(
                verticalOffset: 22,
                curve: AppCurves.easeOut,
                child: FadeInAnimation(child: w),
              ),
              children: kids,
            ),
    );
    return SafeArea(child: reduced ? list : AnimationLimiter(child: list));
  }
}

class _MetricRow extends StatelessWidget {
  const _MetricRow();
  @override
  Widget build(BuildContext context) {
    return const Row(
      children: [
        Expanded(child: _MetricChip(value: '14', label: 'STREAK')),
        SizedBox(width: 8),
        Expanded(child: _MetricChip(value: '72%', label: 'GOAL')),
        SizedBox(width: 8),
        Expanded(child: _MetricChip(value: '126', label: 'TODAY')),
      ],
    );
  }
}

class _MetricChip extends StatelessWidget {
  final String value;
  final String label;
  const _MetricChip({required this.value, required this.label});
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(
        color: c.cardElevated,
        borderRadius: BorderRadius.circular(AppRadius.inner),
      ),
      child: Column(
        children: [
          Text(value,
              style: TextStyle(
                  fontSize: 19,
                  fontWeight: FontWeight.w800,
                  color: c.inkStrong)),
          const SizedBox(height: 2),
          Text(label,
              style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  color: c.inkSoft,
                  letterSpacing: 0.6)),
        ],
      ),
    );
  }
}

class _MascotCard extends StatelessWidget {
  const _MascotCard();
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return GlassCard(
      child: Row(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(18),
              gradient: LinearGradient(colors: [
                c.accent.withValues(alpha: 0.22),
                c.primary.withValues(alpha: 0.18),
              ]),
            ),
            child: Icon(Icons.psychology_alt_outlined, color: c.accent, size: 30),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Keep the streak alive!',
                    style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: c.inkStrong)),
                const SizedBox(height: 3),
                Text('Review 8 cards due in Pharmacology.',
                    style: TextStyle(fontSize: 12.5, color: c.inkSoft)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ResultCard extends StatelessWidget {
  const _ResultCard();
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return GlassCard(
      padding: const EdgeInsets.all(18),
      child: Row(
        children: [
          const ScoreRing(percent: 72, size: 120, label: 'Score'),
          const SizedBox(width: 18),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Latest exam result',
                    style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                        color: c.inkStrong)),
                const SizedBox(height: 6),
                Text('36 / 50 correct',
                    style: TextStyle(fontSize: 13, color: c.inkMedium)),
                const SizedBox(height: 2),
                Text('Renal mock exam · yesterday',
                    style: TextStyle(fontSize: 12, color: c.inkSoft)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _WeakTopics extends StatelessWidget {
  const _WeakTopics();
  static const _data = [
    ('Arrhythmias', 0.42),
    ('Acid–base', 0.55),
    ('Renal physiology', 0.63),
    ('Pharmacology', 0.71),
  ];
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return GlassCard(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Weak topics',
              style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  color: c.inkStrong)),
          const SizedBox(height: 10),
          for (final t in _data)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 5),
              child: Row(
                children: [
                  SizedBox(
                    width: 116,
                    child: Text(t.$1,
                        style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: c.inkMedium)),
                  ),
                  Expanded(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(99),
                      child: TweenAnimationBuilder<double>(
                        tween: Tween(begin: 0, end: t.$2),
                        duration: const Duration(milliseconds: 700),
                        curve: AppCurves.easeOut,
                        builder: (_, v, _) => LinearProgressIndicator(
                          value: v,
                          minHeight: 8,
                          backgroundColor: c.surface2,
                          valueColor: AlwaysStoppedAnimation(c.primary),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Text('${(t.$2 * 100).round()}%',
                      style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          color: c.inkSoft)),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _RecentResults extends StatelessWidget {
  const _RecentResults();
  static const _rows = [
    ('A', 'Renal mock exam', 'Yesterday', '88%'),
    ('B', 'Endocrine practice', '2 days ago', '64%'),
    ('A', 'Cardio Q-Bank set', '3 days ago', '91%'),
  ];
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return GlassCard(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Recent results',
              style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  color: c.inkStrong)),
          const SizedBox(height: 6),
          for (int i = 0; i < _rows.length; i++)
            Container(
              padding: const EdgeInsets.symmetric(vertical: 9),
              decoration: BoxDecoration(
                border: i == 0
                    ? null
                    : Border(top: BorderSide(color: c.line)),
              ),
              child: Row(
                children: [
                  Container(
                    width: 34,
                    height: 34,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: c.surface2,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(_rows[i].$1,
                        style: TextStyle(
                            fontWeight: FontWeight.w800,
                            color: c.accent,
                            fontSize: 13)),
                  ),
                  const SizedBox(width: 11),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(_rows[i].$2,
                            style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: c.inkStrong)),
                        Text(_rows[i].$3,
                            style:
                                TextStyle(fontSize: 11, color: c.inkSoft)),
                      ],
                    ),
                  ),
                  Text(_rows[i].$4,
                      style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          color: c.success)),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
