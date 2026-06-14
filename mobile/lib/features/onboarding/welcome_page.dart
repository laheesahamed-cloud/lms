import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../theme/tokens.dart';
import '../../widgets/app_button.dart';
import '../../widgets/brand_logo.dart';
import '../../state/onboarding.dart';
import '../auth/auth_background.dart';

class _Slide {
  final IconData icon;
  final String title;
  final String body;
  const _Slide(this.icon, this.title, this.body);
}

const _slides = [
  _Slide(Icons.fact_check_outlined, 'Master medicine, faster',
      'Thousands of Q-Bank questions and timed exams — built for how you actually study.'),
  _Slide(Icons.auto_stories_outlined, 'AI notes & flashcards',
      'Generate lessons, write your own notes offline, and revise with spaced-repetition flashcards.'),
  _Slide(Icons.insights_rounded, 'Track every win',
      'See weak topics, daily goals and progress at a glance, and keep your streak alive.'),
];

class WelcomePage extends ConsumerStatefulWidget {
  const WelcomePage({super.key});
  @override
  ConsumerState<WelcomePage> createState() => _WelcomePageState();
}

class _WelcomePageState extends ConsumerState<WelcomePage> {
  final _pc = PageController();
  int _i = 0;

  @override
  void dispose() {
    _pc.dispose();
    super.dispose();
  }

  Future<void> _start() async {
    await ref.read(onboardingSeenProvider.notifier).complete();
    if (mounted) context.go('/auth/login');
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Scaffold(
      body: AuthBackground(
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 16, 24, 20),
            child: Column(
              children: [
                const Align(
                    alignment: Alignment.centerLeft, child: BrandWordmark()),
                Expanded(
                  child: PageView.builder(
                    controller: _pc,
                    onPageChanged: (i) => setState(() => _i = i),
                    itemCount: _slides.length,
                    itemBuilder: (_, i) {
                      final s = _slides[i];
                      return Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            width: 168,
                            height: 168,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(34),
                              gradient: LinearGradient(
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                                colors: [
                                  c.accent.withValues(alpha: 0.20),
                                  c.primary.withValues(alpha: 0.16),
                                ],
                              ),
                            ),
                            child: Icon(s.icon, size: 78, color: c.accent),
                          ),
                          const SizedBox(height: 28),
                          Text(s.title,
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                  fontSize: 26,
                                  fontWeight: FontWeight.w800,
                                  color: c.inkStrong,
                                  letterSpacing: -0.5)),
                          const SizedBox(height: 10),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 8),
                            child: Text(s.body,
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                    fontSize: 14.5,
                                    height: 1.5,
                                    color: c.inkSoft)),
                          ),
                        ],
                      );
                    },
                  ),
                ),
                _Dots(count: _slides.length, index: _i),
                const SizedBox(height: 20),
                AppButton('Get started',
                    expand: true,
                    kind: AppButtonKind.primary,
                    onPressed: _start),
                const SizedBox(height: 14),
                GestureDetector(
                  onTap: _start,
                  child: RichText(
                    text: TextSpan(
                      style: TextStyle(fontSize: 12.5, color: c.inkSoft),
                      children: [
                        const TextSpan(text: 'Already have an account? '),
                        TextSpan(
                            text: 'Log in',
                            style: TextStyle(
                                color: c.primary, fontWeight: FontWeight.w800)),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Dots extends StatelessWidget {
  final int count;
  final int index;
  const _Dots({required this.count, required this.index});
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(count, (i) {
        final on = i == index;
        return AnimatedContainer(
          duration: AppDur.dropdown,
          curve: AppCurves.easeOut,
          margin: const EdgeInsets.symmetric(horizontal: 3.5),
          width: on ? 22 : 7,
          height: 7,
          decoration: BoxDecoration(
            color: on ? c.primary : c.lineStrong,
            borderRadius: BorderRadius.circular(99),
          ),
        );
      }),
    );
  }
}
