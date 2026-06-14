import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../theme/tokens.dart';
import '../../widgets/app_button.dart';
import '../../widgets/brand_logo.dart';
import '../../state/auth_controller.dart';
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
    final ok = await ref
        .read(authControllerProvider.notifier)
        .login(_email.text, _password.text);
    if (mounted) setState(() => _loading = false);
    // success → router redirect handles navigation
    if (ok && mounted) context.go('/app/dashboard');
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final error = ref.watch(authControllerProvider).error;
    return Scaffold(
      body: AuthBackground(
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(24, 28, 24, 24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
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
                          style: TextStyle(fontSize: 13, color: c.inkSoft)),
                      const SizedBox(height: 22),
                      AuthField(
                        label: 'Email',
                        controller: _email,
                        keyboardType: TextInputType.emailAddress,
                        validator: (v) => (v == null || !v.contains('@'))
                            ? 'Enter a valid email'
                            : null,
                      ),
                      AuthField(
                        label: 'Password',
                        controller: _password,
                        obscure: _obscure,
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
                                  fontSize: 12,
                                  color: c.primary,
                                  fontWeight: FontWeight.w700)),
                        ),
                      ),
                      if (error != null) ...[
                        const SizedBox(height: 4),
                        Text(error,
                            style: TextStyle(color: c.error, fontSize: 12.5)),
                        const SizedBox(height: 8),
                      ],
                      const SizedBox(height: 6),
                      AppButton('Log in',
                          expand: true,
                          loading: _loading,
                          onPressed: _submit),
                      const SizedBox(height: 14),
                      const OrDivider(),
                      const SizedBox(height: 14),
                      AppButton(
                        'Continue with Google',
                        kind: AppButtonKind.ghost,
                        expand: true,
                        leading: const Text('G',
                            style: TextStyle(
                                fontWeight: FontWeight.w900,
                                fontSize: 15,
                                color: Color(0xFF4285F4))),
                        onPressed: () => ScaffoldMessenger.of(context)
                            .showSnackBar(const SnackBar(
                                content: Text(
                                    'Google sign-in needs OAuth client IDs (see plan §18).'))),
                      ),
                      const SizedBox(height: 18),
                      Center(
                        child: GestureDetector(
                          onTap: () => context.push('/auth/register'),
                          child: RichText(
                            text: TextSpan(
                              style:
                                  TextStyle(fontSize: 12.5, color: c.inkSoft),
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
                      Center(
                        child: TextButton(
                          onPressed: () {
                            ref
                                .read(authControllerProvider.notifier)
                                .enterDemo();
                            context.go('/app/dashboard');
                          },
                          child: Text('Explore the demo (no account)',
                              style: TextStyle(
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w700,
                                  color: c.inkSoft)),
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
    );
  }
}
