import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../theme/tokens.dart';
import '../../widgets/app_button.dart';
import '../../state/auth_controller.dart';
import '../auth/auth_widgets.dart';

class ChangePasswordPage extends ConsumerStatefulWidget {
  const ChangePasswordPage({super.key});

  @override
  ConsumerState<ChangePasswordPage> createState() => _ChangePasswordPageState();
}

class _ChangePasswordPageState extends ConsumerState<ChangePasswordPage> {
  final _formKey = GlobalKey<FormState>();
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _confirm = TextEditingController();
  bool _obscureCurrent = true;
  bool _obscureNext = true;
  bool _obscureConfirm = true;
  bool _saving = false;
  String? _error;

  // Mirrors the backend ChangePasswordDto rule: >=10 chars, upper+lower+digit.
  static final _strong = RegExp(r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$');

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _saving = true;
      _error = null;
    });
    final err = await ref.read(authControllerProvider.notifier).changePassword(
          currentPassword: _current.text,
          newPassword: _next.text,
          confirmPassword: _confirm.text,
        );
    if (!mounted) return;
    setState(() => _saving = false);
    if (err == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Password changed')),
      );
      context.pop();
    } else {
      setState(() => _error = err);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return SafeArea(
      child: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
          children: [
            _Header(title: 'Change password'),
            const SizedBox(height: 6),
            AuthField(
              label: 'Current password',
              controller: _current,
              obscure: _obscureCurrent,
              autofillHints: const [AutofillHints.password],
              onToggleObscure: () =>
                  setState(() => _obscureCurrent = !_obscureCurrent),
              validator: (v) =>
                  (v == null || v.isEmpty) ? 'Enter your current password' : null,
            ),
            AuthField(
              label: 'New password',
              controller: _next,
              obscure: _obscureNext,
              autofillHints: const [AutofillHints.newPassword],
              onToggleObscure: () => setState(() => _obscureNext = !_obscureNext),
              validator: (v) {
                final s = v ?? '';
                if (s.length < 10) return 'At least 10 characters';
                if (!_strong.hasMatch(s)) {
                  return 'Include upper & lower case and a number';
                }
                return null;
              },
            ),
            AuthField(
              label: 'Confirm new password',
              controller: _confirm,
              obscure: _obscureConfirm,
              autofillHints: const [AutofillHints.newPassword],
              onToggleObscure: () =>
                  setState(() => _obscureConfirm = !_obscureConfirm),
              validator: (v) =>
                  (v != _next.text) ? 'Passwords do not match' : null,
            ),
            const SizedBox(height: 10),
            Text('Use at least 10 characters with a mix of upper & lower case '
                'letters and a number.',
                style: TextStyle(fontSize: 13, color: c.inkSoft)),
            if (_error != null) ...[
              const SizedBox(height: 14),
              Text(_error!, style: TextStyle(color: c.error, fontSize: 13)),
            ],
            const SizedBox(height: 22),
            AppButton('Update password',
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
