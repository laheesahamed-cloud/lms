import 'package:flutter/material.dart';
import '../theme/tokens.dart';

/// Flat button hierarchy (§4.5): cta = blue→indigo gradient (hero only),
/// primary = solid flat brand blue, ghost = hairline, soft = tinted.
/// No glows, no 3D — press = subtle scale + opacity dip.
enum AppButtonKind { primary, cta, ghost, soft }

class AppButton extends StatefulWidget {
  final String label;
  final VoidCallback? onPressed;
  final AppButtonKind kind;
  final bool expand;
  final bool loading;
  final Widget? leading;

  const AppButton(
    this.label, {
    super.key,
    this.onPressed,
    this.kind = AppButtonKind.primary,
    this.expand = false,
    this.loading = false,
    this.leading,
  });

  @override
  State<AppButton> createState() => _AppButtonState();
}

class _AppButtonState extends State<AppButton> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final enabled = widget.onPressed != null && !widget.loading;

    Color fg;
    Color? bg;
    Gradient? grad;
    BoxBorder? border;
    switch (widget.kind) {
      case AppButtonKind.cta:
        grad = kHeroGradient;
        fg = Colors.white;
        break;
      case AppButtonKind.primary:
        bg = c.primary;
        fg = dark ? const Color(0xFF04121F) : Colors.white;
        break;
      case AppButtonKind.ghost:
        bg = c.cardElevated;
        fg = c.inkStrong;
        border = Border.all(color: c.line);
        break;
      case AppButtonKind.soft:
        bg = c.primaryTint;
        fg = c.primary;
        break;
    }

    final content = widget.loading
        ? SizedBox(
            height: 20,
            width: 20,
            child: CircularProgressIndicator(strokeWidth: 2.2, color: fg),
          )
        : Row(
            mainAxisSize: widget.expand ? MainAxisSize.max : MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (widget.leading != null) ...[
                widget.leading!,
                const SizedBox(width: 9),
              ],
              Flexible(
                child: Text(
                  widget.label,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: fg,
                    fontWeight: FontWeight.w700,
                    fontSize: 14.5,
                  ),
                ),
              ),
            ],
          );

    return GestureDetector(
      onTapDown: enabled ? (_) => setState(() => _down = true) : null,
      onTapCancel: () => setState(() => _down = false),
      onTapUp: (_) => setState(() => _down = false),
      onTap: enabled ? widget.onPressed : null,
      child: AnimatedScale(
        scale: _down ? 0.98 : 1,
        duration: AppDur.micro,
        curve: AppCurves.easeOut,
        child: AnimatedOpacity(
          opacity: enabled ? (_down ? 0.92 : 1) : 0.55,
          duration: AppDur.micro,
          child: Container(
            width: widget.expand ? double.infinity : null,
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
            decoration: BoxDecoration(
              color: bg,
              gradient: grad,
              border: border,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Center(widthFactor: widget.expand ? null : 1, child: content),
          ),
        ),
      ),
    );
  }
}
