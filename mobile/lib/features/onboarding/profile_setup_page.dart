import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../state/auth_controller.dart';
import '../../state/onboarding.dart';
import '../../theme/motion.dart';
import '../../theme/tokens.dart';
import '../../widgets/app_button.dart';
import '../../widgets/profile_avatar.dart';

/// Shown once, after a first sign-in that left us without a name to greet
/// anyone by — see [needsProfileSetup]. Asks for a nickname and an avatar, and
/// can be skipped: it is a courtesy, not a gate, and a wall in front of a new
/// account costs sign-ups.
class ProfileSetupPage extends ConsumerStatefulWidget {
  const ProfileSetupPage({super.key});

  @override
  ConsumerState<ProfileSetupPage> createState() => _ProfileSetupPageState();
}

class _ProfileSetupPageState extends ConsumerState<ProfileSetupPage>
    with SingleTickerProviderStateMixin {
  late final AnimationController _intro;
  final _name = TextEditingController();
  late String _avatarKey;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _intro = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1150),
    );
    // Started after the first frame so the curve is not eaten by the route's
    // own transition.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _intro.forward();
    });
    final user = ref.read(authControllerProvider).user;
    // Start on the avatar their account already resolves to, so Get started
    // works without touching anything and nobody sees an empty circle.
    _avatarKey = (user?.avatarKey.isNotEmpty ?? false)
        ? user!.avatarKey
        : resolveAvatar(seed: user?.id ?? user?.email ?? user?.fullName).key;
    // Deliberately NOT prefilled: the only reason this screen is up is that
    // the stored name is junk — usually an Apple relay address's prefix — and
    // putting that in the field reads as the app getting it wrong.
    _name.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _intro.dispose();
    _name.dispose();
    super.dispose();
  }

  Future<void> _finish({required bool save}) async {
    if (_saving) return;
    setState(() {
      _saving = true;
      _error = null;
    });

    if (save) {
      final err = await ref
          .read(authControllerProvider.notifier)
          .updateProfile(fullName: _name.text.trim(), avatarKey: _avatarKey);
      if (!mounted) return;
      if (err != null) {
        setState(() {
          _saving = false;
          _error = err;
        });
        return;
      }
    }

    // Marked seen either way — someone who skipped has answered the question.
    await ref.read(profileSetupSeenProvider.notifier).complete();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final ready = _name.text.trim().length >= 2;
    // Honours the OS setting: with Reduce Motion on, everything is simply
    // already in place.
    final reduced = Motion.reduced(context);

    final arc = CurvedAnimation(
      parent: _intro,
      curve: const Interval(0, 0.72, curve: Curves.easeOutCubic),
    );
    final body = CurvedAnimation(
      parent: _intro,
      curve: const Interval(0.22, 1, curve: Curves.easeOutCubic),
    );

    return Scaffold(
      backgroundColor: c.page,
      body: Stack(
        children: [
          // The arc: a dome in the CTA's own gradient that sweeps in from off
          // the right edge and comes to rest centred behind the greeting.
          if (!reduced)
            Positioned.fill(
              child: IgnorePointer(
                child: AnimatedBuilder(
                  animation: arc,
                  builder: (_, _) => Align(
                    // Ends centred; starts a screen and a half to the right.
                    alignment: Alignment(1.6 - 1.6 * arc.value, -0.56),
                    child: Opacity(
                      opacity: (arc.value * 1.6).clamp(0.0, 1.0) * 0.55,
                      child: ImageFiltered(
                        imageFilter: ImageFilter.blur(sigmaX: 34, sigmaY: 34),
                        child: Container(
                          width: 300,
                          height: 150,
                          decoration: const BoxDecoration(
                            gradient: kHeroGradient,
                            borderRadius: BorderRadius.vertical(
                              top: Radius.circular(150),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          SafeArea(
            child: LayoutBuilder(
              builder: (context, box) => SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(26, 8, 26, 24),
                // Centred in the viewport rather than stacked at the top, which
                // left the screen bottom-heavy with empty space — and still
                // scrolls once the keyboard takes half the height.
                child: ConstrainedBox(
                  constraints: BoxConstraints(minHeight: box.maxHeight - 32),
                  child: IntrinsicHeight(
                    child: FadeTransition(
                      opacity: reduced
                          ? const AlwaysStoppedAnimation(1.0)
                          : body,
                      child: SlideTransition(
                        position: reduced
                            ? const AlwaysStoppedAnimation(Offset.zero)
                            : Tween(
                                begin: const Offset(0, 0.06),
                                end: Offset.zero,
                              ).animate(body),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Center(
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(16),
                                child: ProfileAvatar.from(
                                  avatarKey: _avatarKey,
                                  size: 48,
                                  radius: 0,
                                ),
                              ),
                            ),
                            const SizedBox(height: 14),
                            Text(
                              'Hi, future doctor',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 23,
                                height: 1.15,
                                fontWeight: FontWeight.w900,
                                letterSpacing: -0.6,
                                color: c.inkStrong,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Xyndrome is here for every step from here to your final exam.',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 13,
                                height: 1.45,
                                color: c.inkSoft,
                              ),
                            ),
                            const SizedBox(height: 22),

                            Text(
                              'What should we call you?',
                              style: TextStyle(
                                fontSize: 13.5,
                                fontWeight: FontWeight.w700,
                                color: c.inkStrong,
                              ),
                            ),
                            const SizedBox(height: 8),
                            TextField(
                              controller: _name,
                              autofocus: true,
                              textCapitalization: TextCapitalization.words,
                              textInputAction: TextInputAction.done,
                              onSubmitted: (_) =>
                                  ready ? _finish(save: true) : null,
                              onTapOutside: (_) =>
                                  FocusManager.instance.primaryFocus?.unfocus(),
                              style: TextStyle(
                                color: c.inkStrong,
                                fontSize: 14.5,
                                fontWeight: FontWeight.w600,
                              ),
                              decoration: InputDecoration(
                                hintText: 'Nickname',
                                hintStyle: TextStyle(
                                  color: c.inkMuted,
                                  fontSize: 14.5,
                                ),
                                filled: true,
                                fillColor: c.surface2,
                                isDense: true,
                                contentPadding: const EdgeInsets.symmetric(
                                  horizontal: 14,
                                  vertical: 14,
                                ),
                                enabledBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(13),
                                  borderSide: BorderSide(color: c.line),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(13),
                                  borderSide: BorderSide(
                                    color: c.primary,
                                    width: 1.4,
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(height: 7),
                            Text(
                              "This is how we'll greet you in the app.",
                              style: TextStyle(fontSize: 11, color: c.inkMuted),
                            ),
                            const SizedBox(height: 20),

                            Text(
                              'Pick your avatar',
                              style: TextStyle(
                                fontSize: 13.5,
                                fontWeight: FontWeight.w700,
                                color: c.inkStrong,
                              ),
                            ),
                            const SizedBox(height: 10),
                            Row(
                              children: [
                                for (final a in kProfileAvatars) ...[
                                  Expanded(
                                    child: GestureDetector(
                                      onTap: () =>
                                          setState(() => _avatarKey = a.key),
                                      child: AnimatedContainer(
                                        duration: AppDur.micro,
                                        padding: const EdgeInsets.all(2),
                                        decoration: BoxDecoration(
                                          borderRadius: BorderRadius.circular(
                                            15,
                                          ),
                                          border: Border.all(
                                            color: _avatarKey == a.key
                                                ? c.primary
                                                : Colors.transparent,
                                            width: 2,
                                          ),
                                        ),
                                        child: ClipRRect(
                                          borderRadius: BorderRadius.circular(
                                            11,
                                          ),
                                          child: ProfileAvatar(
                                            avatar: a,
                                            size: 44,
                                            radius: 0,
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                                  if (a != kProfileAvatars.last)
                                    const SizedBox(width: 5),
                                ],
                              ],
                            ),

                            if (_error != null) ...[
                              const SizedBox(height: 14),
                              Text(
                                _error!,
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 12.5,
                                  color: c.error,
                                ),
                              ),
                            ],

                            const SizedBox(height: 24),
                            Center(
                              child: AppButton(
                                'Get started',
                                kind: AppButtonKind.cta,
                                loading: _saving,
                                onPressed: ready
                                    ? () => _finish(save: true)
                                    : null,
                              ),
                            ),
                            const SizedBox(height: 10),
                            Center(
                              child: TextButton(
                                onPressed: _saving
                                    ? null
                                    : () => _finish(save: false),
                                child: Text(
                                  'Skip for now',
                                  style: TextStyle(
                                    fontSize: 13.5,
                                    fontWeight: FontWeight.w600,
                                    color: c.inkMuted,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
