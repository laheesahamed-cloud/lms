import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';
import '../../widgets/app_button.dart';
import '../../widgets/profile_avatar.dart';
import '../../state/auth_controller.dart';
import '../../state/theme_mode.dart';

class ProfilePage extends ConsumerWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final user = ref.watch(authControllerProvider).user;
    final name = (user?.fullName.trim().isNotEmpty ?? false)
        ? user!.fullName
        : 'Medical Student';
    final email = user?.email ?? '';
    final plan = (user?.plan?.isNotEmpty ?? false) ? user!.plan! : 'Free';

    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
        children: [
          Text('Profile',
              style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w800,
                  color: c.inkStrong,
                  letterSpacing: -0.5)),
          const SizedBox(height: 18),
          GlassCard(
            padding: const EdgeInsets.all(18),
            child: Row(
              children: [
                ProfileAvatar.from(
                  avatarKey: user?.avatarKey,
                  seed: user?.id ?? user?.email ?? user?.fullName,
                  size: 60,
                  radius: 20,
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name,
                          style: TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.w800,
                              color: c.inkStrong)),
                      if (email.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 2),
                          child: Text(email,
                              style:
                                  TextStyle(fontSize: 13, color: c.inkSoft)),
                        ),
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: c.primaryTint,
                          borderRadius: BorderRadius.circular(99),
                        ),
                        child: Text('$plan plan',
                            style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w800,
                                color: c.primary)),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _Section(title: 'Account', rows: [
            _Row(Icons.person_outline, 'Edit profile',
                () => context.push('/app/profile/edit')),
            _Row(Icons.lock_outline, 'Change password',
                () => context.push('/app/profile/password')),
          ]),
          const SizedBox(height: 12),
          const _ThemeCard(),
          const SizedBox(height: 12),
          _Section(title: 'Study', rows: [
            _Row(Icons.notifications_none_rounded, 'Notifications',
                () => context.push('/app/notifications')),
            _Row(Icons.bookmark_border_rounded, 'Saved',
                () => context.push('/app/bookmarks')),
            _Row(Icons.workspace_premium_outlined, 'Subscription',
                () => context.push('/app/subscriptions')),
          ]),
          const SizedBox(height: 12),
          _Section(title: 'Support', rows: [
            _Row(Icons.mail_outline_rounded, 'Contact support',
                () => _contactSupport(context)),
          ]),
          const SizedBox(height: 20),
          AppButton('Log out',
              kind: AppButtonKind.soft,
              expand: true,
              onPressed: () => ref.read(authControllerProvider.notifier).logout()),
          const SizedBox(height: 8),
          Center(
            child: TextButton(
              onPressed: () => _confirmDeleteAccount(context, ref),
              child: Text('Delete account',
                  style: TextStyle(
                      color: c.error,
                      fontWeight: FontWeight.w700,
                      fontSize: 14)),
            ),
          ),
        ],
      ),
    );
  }
}

/// Support contact (Guideline 1.5 — easy access to customer support). Opens the
/// device mail composer; if no mail app is set up, the address is shown so the
/// user (or App Review) can still reach support. Change [_supportEmail] to your
/// real inbox.
const String _supportEmail = 'support@xyndrome.lk';

Future<void> _contactSupport(BuildContext context) async {
  final uri = Uri.parse(
      'mailto:$_supportEmail?subject=${Uri.encodeComponent('Xyndrome app support')}');
  final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
  if (!ok && context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Email us at $_supportEmail')),
    );
  }
}

/// Permanently delete the account after a confirmation. On success the auth
/// state clears and the router returns to login automatically.
Future<void> _confirmDeleteAccount(BuildContext context, WidgetRef ref) async {
  final ok = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('Delete account?'),
      content: const Text(
          "This permanently deletes your account and signs you out. "
          "This can't be undone."),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel')),
        FilledButton(
          style: FilledButton.styleFrom(backgroundColor: const Color(0xFFDC2626)),
          onPressed: () => Navigator.pop(ctx, true),
          child: const Text('Delete'),
        ),
      ],
    ),
  );
  if (ok != true) return;
  final err = await ref.read(authControllerProvider.notifier).deleteAccount();
  if (err != null && context.mounted) {
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(err)));
  }
}

class _ThemeCard extends ConsumerWidget {
  const _ThemeCard();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final mode = ref.watch(themeModeProvider);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 6, bottom: 8),
          child: Text('APPEARANCE',
              style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.2,
                  color: c.inkSoft)),
        ),
        GlassCard(
          padding: const EdgeInsets.all(8),
          child: SizedBox(
            width: double.infinity,
            child: SegmentedButton<ThemeMode>(
              segments: const [
                ButtonSegment(value: ThemeMode.system, label: Text('System')),
                ButtonSegment(value: ThemeMode.light, label: Text('Light')),
                ButtonSegment(value: ThemeMode.dark, label: Text('Dark')),
              ],
              selected: {mode},
              showSelectedIcon: false,
              style: const ButtonStyle(
                visualDensity: VisualDensity.compact,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              onSelectionChanged: (s) =>
                  ref.read(themeModeProvider.notifier).set(s.first),
            ),
          ),
        ),
      ],
    );
  }
}

class _Section extends StatelessWidget {
  final String title;
  final List<_Row> rows;
  const _Section({required this.title, required this.rows});
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 6, bottom: 8),
          child: Text(title.toUpperCase(),
              style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.2,
                  color: c.inkSoft)),
        ),
        GlassCard(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
          child: Column(
            children: [
              for (int i = 0; i < rows.length; i++) ...[
                if (i > 0) Divider(height: 1, color: c.line),
                rows[i],
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _Row extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  const _Row(this.icon, this.label, this.onTap);
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 13),
        child: Row(
          children: [
            Icon(icon, size: 20, color: c.inkMedium),
            const SizedBox(width: 13),
            Expanded(
                child: Text(label,
                    style: TextStyle(
                        fontSize: 15.5,
                        fontWeight: FontWeight.w600,
                        color: c.inkStrong))),
            Icon(Icons.chevron_right_rounded, size: 20, color: c.inkMuted),
          ],
        ),
      ),
    );
  }
}
