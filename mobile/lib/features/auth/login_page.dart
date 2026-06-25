import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../theme/tokens.dart';
import '../../widgets/app_button.dart';
import '../../widgets/brand_logo.dart';
import '../../state/auth_controller.dart';
import '../../data/apple_auth.dart';
import '../../data/google_auth.dart';
import 'auth_background.dart';
import 'auth_widgets.dart';

class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});
  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _obscure = true;
  bool _loading = false;
  bool _googleLoading = false;
  bool _appleLoading = false;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() => _loading = true);
    final res = await ref
        .read(authControllerProvider.notifier)
        .login(_email.text, _password.text);
    if (!mounted) return;
    setState(() => _loading = false);
    if (res.verifyEmail != null) {
      // Unverified student — go confirm the emailed 6-digit code first.
      context.push(
        '/auth/verify-email?email=${Uri.encodeComponent(res.verifyEmail!)}',
        extra: res.devCode,
      );
    } else if (res.signedIn) {
      context.go('/app/dashboard');
    }
  }

  Future<void> _google() async {
    setState(() => _googleLoading = true);
    final ok =
        await ref.read(authControllerProvider.notifier).loginWithGoogle();
    if (mounted) setState(() => _googleLoading = false);
    if (ok && mounted) context.go('/app/dashboard');
  }

  Future<void> _apple() async {
    setState(() => _appleLoading = true);
    final ok = await ref.read(authControllerProvider.notifier).loginWithApple();
    if (mounted) setState(() => _appleLoading = false);
    if (ok && mounted) context.go('/app/dashboard');
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final error = ref.watch(authControllerProvider).error;
    // Visible instantly from baked client ids — no wait on /settings/public.
    final googleOk = googleButtonVisible();
    final appleOk = appleButtonVisible();
    return Scaffold(
      body: AuthBackground(
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(24, 28, 24, 24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: AutofillGroup(
                  child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Center(child: BrandLogo(size: 52)),
                      const SizedBox(height: 12),
                      Text('Welcome back',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                              fontSize: 23,
                              fontWeight: FontWeight.w800,
                              color: c.inkStrong)),
                      const SizedBox(height: 4),
                      Text('Log in to continue studying.',
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 14, color: c.inkSoft)),
                      const SizedBox(height: 22),
                      AuthField(
                        label: 'Email',
                        controller: _email,
                        keyboardType: TextInputType.emailAddress,
                        autofillHints: const [
                          AutofillHints.username,
                          AutofillHints.email
                        ],
                        validator: (v) => (v == null || !v.contains('@'))
                            ? 'Enter a valid email'
                            : null,
                      ),
                      AuthField(
                        label: 'Password',
                        controller: _password,
                        obscure: _obscure,
                        autofillHints: const [AutofillHints.password],
                        onToggleObscure: () =>
                            setState(() => _obscure = !_obscure),
                        validator: (v) => (v == null || v.isEmpty)
                            ? 'Enter your password'
                            : null,
                      ),
                      Align(
                        alignment: Alignment.centerRight,
                        child: TextButton(
                          onPressed: () =>
                              context.push('/auth/forgot-password'),
                          child: Text('Forgot password?',
                              style: TextStyle(
                                  fontSize: 13,
                                  color: c.primary,
                                  fontWeight: FontWeight.w700)),
                        ),
                      ),
                      if (error != null) ...[
                        const SizedBox(height: 4),
                        Text(error,
                            style: TextStyle(color: c.error, fontSize: 13)),
                        const SizedBox(height: 8),
                      ],
                      const SizedBox(height: 6),
                      AppButton('Log in',
                          expand: true,
                          loading: _loading,
                          onPressed: _submit),
                      if (appleOk || googleOk) ...[
                        const SizedBox(height: 14),
                        const OrDivider(),
                        const SizedBox(height: 14),
                      ],
                      if (appleOk) ...[
                        AppButton(
                          'Sign in with Apple',
                          kind: AppButtonKind.ghost,
                          expand: true,
                          loading: _appleLoading,
                          leading: Icon(Icons.apple,
                              size: 20, color: c.inkStrong),
                          onPressed: _apple,
                        ),
                        if (googleOk) const SizedBox(height: 10),
                      ],
                      if (googleOk) ...[
                        AppButton(
                          'Continue with Google',
                          kind: AppButtonKind.ghost,
                          expand: true,
                          loading: _googleLoading,
                          leading: const Text('G',
                              style: TextStyle(
                                  fontWeight: FontWeight.w900,
                                  fontSize: 16,
                                  color: Color(0xFF4285F4))),
                          onPressed: _google,
                        ),
                      ],
                      const SizedBox(height: 18),
                      Center(
                        child: GestureDetector(
                          onTap: () => context.push('/auth/register'),
                          child: RichText(
                            text: TextSpan(
                              style:
                                  TextStyle(fontSize: 13, color: c.inkSoft),
                              children: [
                                const TextSpan(text: 'New here? '),
                                TextSpan(
                                    text: 'Create account',
                                    style: TextStyle(
                                        color: c.primary,
                                        fontWeight: FontWeight.w800)),
                              ],
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
    );
  }
}
