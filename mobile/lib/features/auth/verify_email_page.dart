import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../theme/tokens.dart';
import '../../widgets/app_button.dart';
import '../../widgets/brand_logo.dart';
import '../../state/auth_controller.dart';
import 'auth_background.dart';

const _codeLength = 6;
const _resendCooldownSeconds = 60;

/// One-time onboarding email verification — mirrors the web VerifyEmailPage:
/// 6-digit code, auto-advance + paste, 60s resend cooldown. On success the
/// session is stored and the router sends the student to the dashboard.
class VerifyEmailPage extends ConsumerStatefulWidget {
  final String email;
  final String? devCode;
  const VerifyEmailPage({super.key, required this.email, this.devCode});

  @override
  ConsumerState<VerifyEmailPage> createState() => _VerifyEmailPageState();
}

class _VerifyEmailPageState extends ConsumerState<VerifyEmailPage> {
  late final List<TextEditingController> _ctrls =
      List.generate(_codeLength, (_) => TextEditingController());
  late final List<FocusNode> _nodes =
      List.generate(_codeLength, (_) => FocusNode());

  Timer? _timer;
  int _cooldown = _resendCooldownSeconds;
  bool _loading = false;
  String? _error;
  String? _success;

  String get _code => _ctrls.map((c) => c.text).join();
  bool get _complete => _code.length == _codeLength;

  @override
  void initState() {
    super.initState();
    // In dev / no-SMTP the backend echoes the code so it can be tested locally.
    final dev = widget.devCode ?? '';
    if (RegExp(r'^\d{6}$').hasMatch(dev)) {
      for (var i = 0; i < _codeLength; i++) {
        _ctrls[i].text = dev[i];
      }
    }
    // Select-all on focus so typing into a filled box replaces it (matches web).
    for (var i = 0; i < _codeLength; i++) {
      _nodes[i].addListener(() {
        if (_nodes[i].hasFocus) {
          _ctrls[i].selection = TextSelection(
              baseOffset: 0, extentOffset: _ctrls[i].text.length);
        }
      });
    }
    _startCooldown(_resendCooldownSeconds);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && widget.email.isEmpty) {
        context.go('/auth/login');
      } else if (mounted) {
        _nodes[0].requestFocus();
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    for (final c in _ctrls) {
      c.dispose();
    }
    for (final n in _nodes) {
      n.dispose();
    }
    super.dispose();
  }

  void _startCooldown(int seconds) {
    _timer?.cancel();
    setState(() => _cooldown = seconds);
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return t.cancel();
      if (_cooldown <= 1) {
        t.cancel();
        setState(() => _cooldown = 0);
      } else {
        setState(() => _cooldown--);
      }
    });
  }

  void _setDigit(int index, String digit) {
    _ctrls[index].text = digit;
    _ctrls[index].selection =
        TextSelection.collapsed(offset: _ctrls[index].text.length);
  }

  void _onChanged(int index, String value) {
    if (_error != null) setState(() => _error = null);
    final digits = value.replaceAll(RegExp(r'\D'), '');
    if (digits.length > 1) {
      // Paste / multi-char: distribute from this box onward.
      for (var i = 0; i + index < _codeLength && i < digits.length; i++) {
        _setDigit(index + i, digits[i]);
      }
      final next = (index + digits.length).clamp(0, _codeLength - 1);
      _nodes[next].requestFocus();
    } else {
      _setDigit(index, digits);
      if (digits.isNotEmpty && index < _codeLength - 1) {
        _nodes[index + 1].requestFocus();
      }
    }
    setState(() {});
  }

  KeyEventResult _onKey(int index, KeyEvent event) {
    if (event is KeyDownEvent &&
        event.logicalKey == LogicalKeyboardKey.backspace &&
        _ctrls[index].text.isEmpty &&
        index > 0) {
      _setDigit(index - 1, '');
      _nodes[index - 1].requestFocus();
      setState(() {});
      return KeyEventResult.handled;
    }
    return KeyEventResult.ignored;
  }

  Future<void> _verify() async {
    if (!_complete || _loading) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _loading = true;
      _error = null;
      _success = null;
    });
    final err = await ref
        .read(authControllerProvider.notifier)
        .verifyEmail(email: widget.email, code: _code);
    if (!mounted) return;
    if (err == null) {
      context.go('/app/dashboard');
    } else {
      for (final c in _ctrls) {
        c.clear();
      }
      _nodes[0].requestFocus();
      setState(() {
        _loading = false;
        _error = err;
      });
    }
  }

  Future<void> _resend() async {
    if (_cooldown > 0) return;
    setState(() {
      _error = null;
      _success = null;
    });
    final res =
        await ref.read(authControllerProvider.notifier).resendEmail(widget.email);
    if (!mounted) return;
    if (res.error != null) {
      setState(() => _error = res.error);
    } else {
      setState(() => _success = 'A new code is on its way to ${widget.email}.');
      _startCooldown(res.retryAfter ?? _resendCooldownSeconds);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Scaffold(
      appBar: AppBar(
        leading: BackButton(onPressed: () => context.go('/auth/login')),
      ),
      extendBodyBehindAppBar: true,
      body: AuthBackground(
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Center(child: BrandLogo(size: 52)),
                    const SizedBox(height: 14),
                    Text('Verify your email',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                            fontSize: 23,
                            fontWeight: FontWeight.w800,
                            color: c.inkStrong)),
                    const SizedBox(height: 6),
                    Text.rich(
                      TextSpan(
                        style: TextStyle(
                            fontSize: 14, color: c.inkSoft, height: 1.5),
                        children: [
                          const TextSpan(text: 'Enter the 6-digit code we sent to '),
                          TextSpan(
                              text: widget.email,
                              style: TextStyle(
                                  color: c.inkStrong,
                                  fontWeight: FontWeight.w700)),
                          const TextSpan(text: '. It expires in 10 minutes.'),
                        ],
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 24),
                    Row(
                      children: [
                        for (var i = 0; i < _codeLength; i++)
                          Expanded(
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 4),
                              child: _OtpBox(
                                controller: _ctrls[i],
                                focusNode: _nodes[i],
                                hasError: _error != null,
                                onChanged: (v) => _onChanged(i, v),
                                onKey: (e) => _onKey(i, e),
                              ),
                            ),
                          ),
                      ],
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: 14),
                      Text(_error!,
                          textAlign: TextAlign.center,
                          style: TextStyle(color: c.error, fontSize: 13)),
                    ],
                    if (_success != null) ...[
                      const SizedBox(height: 14),
                      Text(_success!,
                          textAlign: TextAlign.center,
                          style: TextStyle(color: c.primary, fontSize: 13)),
                    ],
                    const SizedBox(height: 22),
                    AppButton('Verify and continue',
                        expand: true,
                        loading: _loading,
                        onPressed: _complete ? _verify : null),
                    const SizedBox(height: 14),
                    Center(
                      child: TextButton(
                        onPressed: _cooldown > 0 ? null : _resend,
                        child: Text(
                          _cooldown > 0
                              ? 'Resend code in ${_cooldown}s'
                              : 'Resend code',
                          style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: _cooldown > 0 ? c.inkMuted : c.primary),
                        ),
                      ),
                    ),
                    Center(
                      child: TextButton(
                        onPressed: () => context.go('/auth/login'),
                        child: Text('Back to sign in',
                            style: TextStyle(
                                fontSize: 13,
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
    );
  }
}

class _OtpBox extends StatelessWidget {
  final TextEditingController controller;
  final FocusNode focusNode;
  final bool hasError;
  final ValueChanged<String> onChanged;
  final KeyEventResult Function(KeyEvent) onKey;
  const _OtpBox({
    required this.controller,
    required this.focusNode,
    required this.hasError,
    required this.onChanged,
    required this.onKey,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Focus(
      onKeyEvent: (_, e) => onKey(e),
      child: TextField(
        controller: controller,
        focusNode: focusNode,
        onTapOutside: (_) => FocusManager.instance.primaryFocus?.unfocus(),
        keyboardType: TextInputType.number,
        textAlign: TextAlign.center,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        style: TextStyle(
            fontSize: 22, fontWeight: FontWeight.w800, color: c.inkStrong),
        decoration: InputDecoration(
          counterText: '',
          contentPadding: const EdgeInsets.symmetric(vertical: 14),
          filled: true,
          fillColor: c.card,
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide:
                BorderSide(color: hasError ? c.error : c.line, width: 1),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: BorderSide(color: c.primary, width: 1.6),
          ),
        ),
        onChanged: onChanged,
      ),
    );
  }
}
