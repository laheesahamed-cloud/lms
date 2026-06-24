import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../theme/tokens.dart';
import '../../widgets/app_button.dart';
import '../../data/auth_repository.dart';
import 'auth_background.dart';
import 'auth_widgets.dart';
import 'auth_error.dart';

class ResetPasswordPage extends ConsumerStatefulWidget {
  final String token;
  const ResetPasswordPage({super.key, required this.token});
  @override
  ConsumerState<ResetPasswordPage> createState() => _ResetPasswordPageState();
}

class _ResetPasswordPageState extends ConsumerState<ResetPasswordPage> {
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _obscure = true;
  bool _loading = false;
  String? _error;

  // Mirrors the backend ResetPasswordDto rule: >=10 chars, upper+lower+digit.
  static final _strong = RegExp(r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$');

  @override
  void dispose() {
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await ref
          .read(authRepositoryProvider)
          .resetPassword(widget.token, _password.text, _confirm.text);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('Password updated — please log in.')));
        context.go('/auth/login');
      }
    } catch (e) {
      if (mounted) {
        setState(() => _error =
            authErrorMessage(e, 'This reset link is invalid or has expired.'));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Scaffold(
      appBar: AppBar(leading: BackButton(onPressed: () => context.pop())),
      extendBodyBehindAppBar: true,
      body: AuthBackground(
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text('Choose a new password',
                          style: TextStyle(
                              fontSize: 23,
                              fontWeight: FontWeight.w800,
                              color: c.inkStrong)),
                      const SizedBox(height: 4),
                      Text(
                          'At least 10 characters, with upper & lower case and a number.',
                          style: TextStyle(fontSize: 14, color: c.inkSoft)),
                      AuthField(
                        label: 'New password',
                        controller: _password,
                        obscure: _obscure,
                        autofillHints: const [AutofillHints.newPassword],
                        onToggleObscure: () =>
                            setState(() => _obscure = !_obscure),
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
                        label: 'Confirm password',
                        controller: _confirm,
                        obscure: _obscure,
                        autofillHints: const [AutofillHints.newPassword],
                        validator: (v) =>
                            v != _password.text ? 'Passwords don\'t match' : null,
                      ),
                      if (_error != null) ...[
                        const SizedBox(height: 10),
                        Text(_error!,
                            style: TextStyle(color: c.error, fontSize: 13)),
                      ],
                      const SizedBox(height: 18),
                      AppButton('Update password',
                          expand: true,
                          loading: _loading,
                          onPressed: _submit),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
