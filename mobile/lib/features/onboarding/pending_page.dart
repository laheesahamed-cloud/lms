import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../theme/tokens.dart';
import '../../widgets/app_button.dart';
import '../../widgets/brand_logo.dart';
import '../../state/auth_controller.dart';

class PendingPage extends ConsumerWidget {
  const PendingPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const BrandLogo(size: 64),
                const SizedBox(height: 24),
                Icon(Icons.hourglass_top_rounded, size: 44, color: c.warning),
                const SizedBox(height: 16),
                Text('Account pending approval',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        color: c.inkStrong)),
                const SizedBox(height: 8),
                Text(
                    'Your account is being reviewed. You’ll get a notification as soon as it’s approved.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                        fontSize: 14, height: 1.5, color: c.inkSoft)),
                const SizedBox(height: 26),
                AppButton('Check again',
                    expand: true,
                    onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                            content: Text('Still pending — we’ll let you know.')))),
                const SizedBox(height: 10),
                AppButton('Log out',
                    kind: AppButtonKind.ghost,
                    expand: true,
                    onPressed: () =>
                        ref.read(authControllerProvider.notifier).logout()),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
