import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../theme/tokens.dart';
import '../../widgets/glass_card.dart';
import '../../widgets/app_button.dart';
import '../../state/auth_controller.dart';

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
    final initials = user?.initials ?? 'MS';
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
                Container(
                  width: 60,
                  height: 60,
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
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                          color: c.inkStrong)),
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
                                  TextStyle(fontSize: 12.5, color: c.inkSoft)),
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
                                fontSize: 11,
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
            _Row(Icons.person_outline, 'Edit profile', () {}),
            _Row(Icons.lock_outline, 'Change password', () {}),
          ]),
          const SizedBox(height: 12),
          _Section(title: 'Study', rows: [
            _Row(Icons.notifications_none_rounded, 'Notifications',
                () => context.push('/app/notifications')),
            _Row(Icons.bookmark_border_rounded, 'Saved',
                () => context.push('/app/bookmarks')),
            _Row(Icons.workspace_premium_outlined, 'Subscription',
                () => context.push('/app/subscriptions')),
          ]),
          const SizedBox(height: 20),
          AppButton('Log out',
              kind: AppButtonKind.soft,
              expand: true,
              onPressed: () => ref.read(authControllerProvider.notifier).logout()),
        ],
      ),
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
                  fontSize: 11,
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
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: c.inkStrong))),
            Icon(Icons.chevron_right_rounded, size: 20, color: c.inkMuted),
          ],
        ),
      ),
    );
  }
}
