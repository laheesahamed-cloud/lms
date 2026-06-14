import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../theme/tokens.dart';
import '../../widgets/app_button.dart';
import '../../state/auth_controller.dart';
import 'auth_background.dart';
import 'auth_widgets.dart';

class RegisterPage extends ConsumerStatefulWidget {
  const RegisterPage({super.key});
  @override
  ConsumerState<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends ConsumerState<RegisterPage> {
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _obscure = true;
  bool _terms = false;
  bool _loading = false;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (!_terms) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Please accept the terms to continue.')));
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() => _loading = true);
    final ok = await ref.read(authControllerProvider.notifier).register(
          fullName: _name.text,
          email: _email.text,
          password: _password.text,
          confirmPassword: _confirm.text,
          acceptedTerms: _terms,
        );
    if (mounted) setState(() => _loading = false);
    if (ok && mounted) context.go('/app/dashboard');
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final error = ref.watch(authControllerProvider).error;
    return Scaffold(
      appBar: AppBar(
        leading: BackButton(onPressed: () => context.pop()),
      ),
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
                      Text('Create your account',
                          style: TextStyle(
                              fontSize: 23,
                              fontWeight: FontWeight.w800,
                              color: c.inkStrong)),
                      const SizedBox(height: 4),
                      Text('Start free — upgrade anytime.',
                          style: TextStyle(fontSize: 13, color: c.inkSoft)),
                      AuthField(
                        label: 'Full name',
                        controller: _name,
                        validator: (v) => (v == null || v.trim().isEmpty)
                            ? 'Enter your name'
                            : null,
                      ),
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
                        validator: (v) => (v == null || v.length < 10)
                            ? 'At least 10 characters'
                            : null,
                      ),
                      AuthField(
                        label: 'Confirm password',
                        controller: _confirm,
                        obscure: _obscure,
                        validator: (v) =>
                            v != _password.text ? 'Passwords don\'t match' : null,
                      ),
                      const SizedBox(height: 12),
                      _Terms(
                        value: _terms,
                        onChanged: (v) => setState(() => _terms = v),
                      ),
                      if (error != null) ...[
                        const SizedBox(height: 8),
                        Text(error,
                            style: TextStyle(color: c.error, fontSize: 12.5)),
                      ],
                      const SizedBox(height: 14),
                      AppButton('Create account',
                          expand: true,
                          loading: _loading,
                          onPressed: _submit),
                      const SizedBox(height: 16),
                      Center(
                        child: GestureDetector(
                          onTap: () => context.pop(),
                          child: RichText(
                            text: TextSpan(
                              style:
                                  TextStyle(fontSize: 12.5, color: c.inkSoft),
                              children: [
                                const TextSpan(
                                    text: 'Already have an account? '),
                                TextSpan(
                                    text: 'Log in',
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
    );
  }
}

class _Terms extends StatelessWidget {
  final bool value;
  final ValueChanged<bool> onChanged;
  const _Terms({required this.value, required this.onChanged});
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return GestureDetector(
      onTap: () => onChanged(!value),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AnimatedContainer(
            duration: AppDur.micro,
            width: 20,
            height: 20,
            decoration: BoxDecoration(
              color: value ? c.primaryTint : Colors.transparent,
              border: Border.all(
                  color: value ? c.primary : c.lineStrong, width: 1.5),
              borderRadius: BorderRadius.circular(6),
            ),
            child: value
                ? Icon(Icons.check, size: 13, color: c.primary)
                : null,
          ),
          const SizedBox(width: 9),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(top: 1),
              child: RichText(
                text: TextSpan(
                  style: TextStyle(
                      fontSize: 11.5, color: c.inkSoft, height: 1.4),
                  children: [
                    const TextSpan(text: 'I agree to the '),
                    TextSpan(
                        text: 'Terms',
                        style: TextStyle(
                            color: c.primary, fontWeight: FontWeight.w700)),
                    const TextSpan(text: ' & '),
                    TextSpan(
                        text: 'Privacy Policy',
                        style: TextStyle(
                            color: c.primary, fontWeight: FontWeight.w700)),
                    const TextSpan(text: '.'),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
