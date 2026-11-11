import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../state/auth_controller.dart';
import '../../theme/tokens.dart';
import 'dashboard_repository.dart';

/// Invisible widget placed on the dashboard. It shows the first-streak popup
/// only while the dashboard is the screen the student is actually looking at,
/// so finishing a quiz never triggers it on the results screen. If the streak
/// arrives while another screen is on top, it simply waits until the student
/// comes back to the dashboard.
class FirstStreakWatcher extends ConsumerStatefulWidget {
  const FirstStreakWatcher({super.key});

  @override
  ConsumerState<FirstStreakWatcher> createState() => _FirstStreakWatcherState();
}

class _FirstStreakWatcherState extends ConsumerState<FirstStreakWatcher> {
  Timer? _timer;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Fires when this route becomes/stops being the current one, and when the
    // tab becomes visible/hidden.
    _schedule();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  bool get _visible =>
      mounted && TickerMode.valuesOf(context).enabled && (ModalRoute.of(context)?.isCurrent ?? true);

  void _schedule() {
    _timer?.cancel();
    // Small delay so the screen has finished animating in before the popup.
    _timer = Timer(const Duration(milliseconds: 600), _check);
  }

  void _check() {
    if (!_visible) return;
    final streak = ref.read(studentDashboardProvider).value?.quizDayStreak ?? 0;
    FirstStreakPopup.maybeShow(
      context,
      streak: streak,
      userId: ref.read(authControllerProvider).user?.id,
    );
  }

  @override
  Widget build(BuildContext context) {
    // Re-check whenever fresh dashboard data arrives.
    ref.listen(studentDashboardProvider, (_, _) => _schedule());
    return const SizedBox.shrink();
  }
}

/// One-time "first streak" celebration. Shown the first time a student's
/// daily streak reaches 1 (which can happen the same day as their first quiz).
/// Remembered per user on this device, so it never shows twice.
class FirstStreakPopup {
  static bool _showing = false;

  static String _key(String uid) => 'first_streak_popup_v2_$uid';

  /// Call whenever fresh dashboard data arrives. Cheap and safe to call often.
  static Future<void> maybeShow(
    BuildContext context, {
    required int streak,
    required String? userId,
  }) async {
    if (streak != 1 || userId == null || userId.isEmpty || _showing) return;
    final sp = await SharedPreferences.getInstance();
    if (sp.getBool(_key(userId)) ?? false) return;
    if (!context.mounted) return;

    _showing = true;
    // Mark first so a crash or a quick dismiss can never make it repeat.
    await sp.setBool(_key(userId), true);
    if (!context.mounted) {
      _showing = false;
      return;
    }
    await showGeneralDialog<void>(
      context: context,
      barrierDismissible: true,
      barrierLabel: 'Close',
      barrierColor: Colors.black.withValues(alpha: 0.5),
      transitionDuration: const Duration(milliseconds: 260),
      pageBuilder: (_, _, _) => const _FirstStreakDialog(),
      transitionBuilder: (_, anim, _, child) {
        final curved = CurvedAnimation(parent: anim, curve: Curves.easeOutBack);
        return FadeTransition(
          opacity: anim,
          child: ScaleTransition(scale: Tween(begin: 0.85, end: 1.0).animate(curved), child: child),
        );
      },
    );
    _showing = false;
  }
}

class _FirstStreakDialog extends StatelessWidget {
  const _FirstStreakDialog();

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Center(
      child: Material(
        color: Colors.transparent,
        child: Container(
          width: 300,
          padding: const EdgeInsets.fromLTRB(22, 26, 22, 20),
          decoration: BoxDecoration(
            color: c.card,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: c.line),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const _AnimatedFlame(),
              const SizedBox(height: 16),
              Text('Congratulations!',
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: c.inkStrong)),
              const SizedBox(height: 6),
              Text('You got your first streak.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 15, color: c.inkSoft)),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: c.primary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('Keep going',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// A flame that breathes and flickers: pulsing glow, gentle scale, slight sway.
class _AnimatedFlame extends StatefulWidget {
  const _AnimatedFlame();

  @override
  State<_AnimatedFlame> createState() => _AnimatedFlameState();
}

class _AnimatedFlameState extends State<_AnimatedFlame> with SingleTickerProviderStateMixin {
  late final AnimationController _ctl =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 1100));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final reduced = MediaQuery.of(context).disableAnimations;
    if (reduced) {
      _ctl.stop();
      _ctl.value = 0.5;
    } else if (!_ctl.isAnimating) {
      _ctl.repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _ctl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctl,
      builder: (_, _) {
        final t = Curves.easeInOut.transform(_ctl.value);
        final scale = 0.94 + 0.12 * t;
        final sway = (t - 0.5) * 0.10;
        return SizedBox(
          width: 110,
          height: 110,
          child: Stack(
            alignment: Alignment.center,
            children: [
              Container(
                width: 96 + 14 * t,
                height: 96 + 14 * t,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFFFF6B35).withValues(alpha: 0.12 + 0.10 * t),
                ),
              ),
              Transform.rotate(
                angle: sway,
                alignment: Alignment.bottomCenter,
                child: Transform.scale(
                  scale: scale,
                  alignment: Alignment.bottomCenter,
                  child: ShaderMask(
                    blendMode: BlendMode.srcIn,
                    shaderCallback: (r) => const LinearGradient(
                      begin: Alignment.bottomCenter,
                      end: Alignment.topCenter,
                      colors: [Color(0xFFFF4D2E), Color(0xFFFF9A3C), Color(0xFFFFD25A)],
                    ).createShader(r),
                    child: const Icon(Icons.local_fire_department_rounded, size: 76, color: Colors.white),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
