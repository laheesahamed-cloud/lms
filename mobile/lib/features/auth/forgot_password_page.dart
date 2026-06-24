import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../theme/tokens.dart';
import '../../widgets/app_button.dart';
import '../../data/auth_repository.dart';
import 'auth_background.dart';
import 'auth_widgets.dart';
import 'auth_error.dart';

class ForgotPasswordPage extends ConsumerStatefulWidget {
  const ForgotPasswordPage({super.key});
  @override
  ConsumerState<ForgotPasswordPage> createState() => _ForgotPasswordPageState();
}

class _ForgotPasswordPageState extends ConsumerState<ForgotPasswordPage> {
  final _email = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _loading = false;
  bool _sent = false;
  String _message = '';
  String? _error;

  @override
  void dispose() {
    _email.dispose();
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
      final message =
          await ref.read(authRepositoryProvider).forgotPassword(_email.text.trim());
      if (!mounted) return;
      setState(() {
        _loading = false;
        _sent = true;
        _message = message;
      });
    } catch (e) {
      if (!mounted) return;
      // A real failure (network / server) — surface it instead of faking success.
      setState(() {
        _loading = false;
        _error = authErrorMessage(e, "Couldn't send the reset link. Try again.");
      });
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
                child: _sent
                    ? Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.mark_email_read_outlined,
                              size: 54, color: c.success),
                          const SizedBox(height: 14),
                          Text('Check your email',
                              style: TextStyle(
                                  fontSize: 22,
                                  fontWeight: FontWeight.w800,
                                  color: c.inkStrong)),
                          const SizedBox(height: 8),
                          Text(
                              _message.isNotEmpty
                                  ? _message
                                  : 'If an account exists for ${_email.text.trim()}, we sent a reset link.',
                              textAlign: TextAlign.center,
                              style:
                                  TextStyle(fontSize: 14, color: c.inkSoft)),
                          const SizedBox(height: 22),
                          AppButton('Back to log in',
                              expand: true,
                              onPressed: () => context.go('/auth/login')),
                        ],
                      )
                    : Form(
                        key: _formKey,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text('Reset your password',
                                style: TextStyle(
                                    fontSize: 23,
                                    fontWeight: FontWeight.w800,
                                    color: c.inkStrong)),
                            const SizedBox(height: 4),
                            Text(
                                'Enter your email and we’ll send you a reset link.',
                                style:
                                    TextStyle(fontSize: 14, color: c.inkSoft)),
                            AuthField(
                              label: 'Email',
                              controller: _email,
                              keyboardType: TextInputType.emailAddress,
                              validator: (v) => (v == null || !v.contains('@'))
                                  ? 'Enter a valid email'
                                  : null,
                            ),
                            if (_error != null) ...[
                              const SizedBox(height: 10),
                              Text(_error!,
                                  style:
                                      TextStyle(color: c.error, fontSize: 13)),
                            ],
                            const SizedBox(height: 18),
                            AppButton('Send reset link',
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
