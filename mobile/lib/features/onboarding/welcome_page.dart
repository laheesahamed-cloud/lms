import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../theme/tokens.dart';
import '../../theme/motion.dart';
import '../../state/onboarding.dart';

/// First-run welcome: "Welcome to xyndrome" types in and stays, while a
/// single motivation line below it cycles — each fades out before the next
/// fades in — then it advances to login (tap to skip).
class WelcomePage extends ConsumerStatefulWidget {
  const WelcomePage({super.key});
  @override
  ConsumerState<WelcomePage> createState() => _WelcomePageState();
}

class _WelcomePageState extends ConsumerState<WelcomePage>
    with TickerProviderStateMixin {
  static const _line1 = 'Welcome to';

  // The cycling motivation lines — short and simple, one row each.
  static const _motivations = [
    'Your journey starts here.',
    'Study smart, learn faster.',
    'Wishing you all the best.',
  ];

  static const _fade = Duration(milliseconds: 1400);
  static const _hold = Duration(milliseconds: 1300);

  late final AnimationController _type; // types the welcome line
  late final Animation<int> _chars;
  late final AnimationController _caret; // blinking cursor while typing
  late final AnimationController _word; // fades "xyndrome" in

  int _motIndex = 0; // which motivation is showing
  bool _motVisible = false; // current motivation shown / hidden
  bool _leaving = false;

  @override
  void initState() {
    super.initState();
    _type = AnimationController(
      vsync: this,
      duration: Motion.of(context, Duration(milliseconds: _line1.length * 150)),
    );
    _chars = StepTween(begin: 0, end: _line1.length).animate(
      CurvedAnimation(parent: _type, curve: Curves.linear),
    );
    _caret = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 560),
    )..repeat(reverse: true);
    _word = AnimationController(
      vsync: this,
      duration: Motion.of(context, const Duration(milliseconds: 1500)),
    );

    _type.addStatusListener((s) {
      if (s == AnimationStatus.completed) {
        _caret.stop();
        Future.delayed(const Duration(milliseconds: 650), () {
          if (mounted) _word.forward();
        });
      }
    });
    _word.addStatusListener((s) {
      if (s == AnimationStatus.completed) _cycleMotivations();
    });
    _type.forward();
  }

  /// "Welcome to xyndrome" stays; cycle each motivation below it.
  Future<void> _cycleMotivations() async {
    if (!await _wait(const Duration(milliseconds: 300))) return;
    for (var i = 0; i < _motivations.length; i++) {
      setState(() {
        _motIndex = i;
        _motVisible = false;
      });
      if (!await _wait(const Duration(milliseconds: 60))) return;
      setState(() => _motVisible = true); // fade in
      if (!await _wait(_fade + _hold)) return;
      setState(() => _motVisible = false); // fade out
      if (!await _wait(_fade)) return;
    }
    _start();
  }

  /// Delay helper that aborts the sequence if the widget is gone.
  Future<bool> _wait(Duration d) async {
    await Future.delayed(d);
    return mounted && !_leaving;
  }

  @override
  void dispose() {
    _type.dispose();
    _caret.dispose();
    _word.dispose();
    super.dispose();
  }

  Future<void> _start() async {
    if (_leaving || !mounted) return;
    _leaving = true;
    await ref.read(onboardingSeenProvider.notifier).complete();
    if (mounted) context.go('/auth/login');
  }

  @override
  Widget build(BuildContext context) {
    const style = TextStyle(
      color: Colors.white,
      fontSize: 32,
      fontWeight: FontWeight.w700,
      letterSpacing: -0.6,
      height: 1.15,
    );
    return Scaffold(
      backgroundColor: AppColors.dark.page,
      body: GestureDetector(
        onTap: _start,
        behavior: HitTestBehavior.opaque,
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Row 1 — "Welcome to" types in with a caret.
              AnimatedBuilder(
                animation: Listenable.merge([_chars, _caret]),
                builder: (_, _) {
                  final shown = _line1.substring(0, _chars.value);
                  final typing = _type.status != AnimationStatus.completed;
                  final caretOpacity = typing ? _caret.value : 0.0;
                  return RichText(
                    textAlign: TextAlign.center,
                    text: TextSpan(
                      style: style,
                      children: [
                        TextSpan(text: shown),
                        TextSpan(
                          text: '|',
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: caretOpacity),
                            fontWeight: FontWeight.w400,
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
              // Row 2 — "xyndrome" fades + lifts in, then stays.
              FadeTransition(
                opacity: CurvedAnimation(parent: _word, curve: AppCurves.easeOut),
                child: AnimatedBuilder(
                  animation: _word,
                  builder: (_, child) => Transform.translate(
                    offset: Offset(0, (1 - _word.value) * 10),
                    child: child,
                  ),
                  child: ShaderMask(
                    shaderCallback: (bounds) => kHeroGradient.createShader(
                      Rect.fromLTWH(0, 0, bounds.width, bounds.height),
                    ),
                    blendMode: BlendMode.srcIn,
                    child: const Text('xyndrome', style: style),
                  ),
                ),
              ),
              const SizedBox(height: 40),
              // The cycling motivation line (fixed height so nothing jumps).
              SizedBox(
                height: 44,
                child: Center(child: _motivation()),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// The current motivation — fades + lifts in, then out, on each cycle.
  Widget _motivation() {
    return AnimatedSlide(
      offset: _motVisible ? Offset.zero : const Offset(0, 0.25),
      duration: _fade,
      curve: AppCurves.easeOut,
      child: AnimatedOpacity(
        opacity: _motVisible ? 1 : 0,
        duration: _fade,
        curve: AppCurves.easeOut,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              _motivations[_motIndex],
              maxLines: 1,
              softWrap: false,
              style: TextStyle(
                color: AppColors.dark.inkSoft,
                fontSize: 16,
                height: 1.4,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
