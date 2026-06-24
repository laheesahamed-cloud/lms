import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../theme/tokens.dart';
import '../../widgets/app_button.dart';
import '../../widgets/profile_avatar.dart';
import '../../state/auth_controller.dart';
import '../auth/auth_widgets.dart';

class EditProfilePage extends ConsumerStatefulWidget {
  const EditProfilePage({super.key});

  @override
  ConsumerState<EditProfilePage> createState() => _EditProfilePageState();
}

class _EditProfilePageState extends ConsumerState<EditProfilePage> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name;
  late String _avatarKey;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final user = ref.read(authControllerProvider).user;
    _name = TextEditingController(text: user?.fullName ?? '');
    // Pre-select the user's stored avatar, else the deterministic fallback.
    _avatarKey = (user?.avatarKey.isNotEmpty ?? false)
        ? user!.avatarKey
        : resolveAvatar(seed: user?.id ?? user?.email ?? user?.fullName).key;
  }

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _saving = true;
      _error = null;
    });
    final err = await ref.read(authControllerProvider.notifier).updateProfile(
          fullName: _name.text,
          avatarKey: _avatarKey,
        );
    if (!mounted) return;
    setState(() => _saving = false);
    if (err == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Profile updated')),
      );
      context.pop();
    } else {
      setState(() => _error = err);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final user = ref.watch(authControllerProvider).user;
    return SafeArea(
      child: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
          children: [
            _Header(title: 'Edit profile'),
            const SizedBox(height: 8),
            // Live preview of the selected avatar.
            Center(
              child: ProfileAvatar.from(
                avatarKey: _avatarKey,
                seed: user?.id ?? user?.email,
                size: 84,
                radius: 26,
              ),
            ),
            const SizedBox(height: 20),
            AuthField(
              label: 'Full name',
              controller: _name,
              keyboardType: TextInputType.name,
              validator: (v) =>
                  (v == null || v.trim().length < 2) ? 'Enter your name' : null,
            ),
            const SizedBox(height: 18),
            Text('AVATAR',
                style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.2,
                    color: c.inkSoft)),
            const SizedBox(height: 10),
            Wrap(
              spacing: 12,
              runSpacing: 12,
              children: [
                for (final a in kProfileAvatars)
                  _AvatarChoice(
                    avatar: a,
                    selected: a.key == _avatarKey,
                    onTap: () => setState(() => _avatarKey = a.key),
                  ),
              ],
            ),
            if (_error != null) ...[
              const SizedBox(height: 14),
              Text(_error!,
                  style: TextStyle(color: c.error, fontSize: 13)),
            ],
            const SizedBox(height: 24),
            AppButton('Save changes',
                kind: AppButtonKind.primary,
                expand: true,
                loading: _saving,
                onPressed: _save),
          ],
        ),
      ),
    );
  }
}

class _AvatarChoice extends StatelessWidget {
  final AvatarSpec avatar;
  final bool selected;
  final VoidCallback onTap;
  const _AvatarChoice({
    required this.avatar,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 140),
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: selected ? c.primary : c.line,
            width: selected ? 2 : 1,
          ),
        ),
        child: ProfileAvatar(avatar: avatar, size: 52, radius: 16),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  final String title;
  const _Header({required this.title});
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Row(
      children: [
        IconButton(
          padding: EdgeInsets.zero,
          constraints: const BoxConstraints(),
          onPressed: () => context.pop(),
          icon: Icon(Icons.arrow_back_rounded, color: c.inkStrong),
        ),
        const SizedBox(width: 8),
        Text(title,
            style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                color: c.inkStrong,
                letterSpacing: -0.4)),
      ],
    );
  }
}
