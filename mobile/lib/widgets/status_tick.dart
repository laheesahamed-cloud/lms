import 'package:flutter/material.dart';

/// The app's one status mark for a set or task: a soft disc with an icon.
/// Green check = completed (passed); amber retry = attempted, not passed yet.
class StatusTick extends StatelessWidget {
  final bool retry;
  final double size;
  const StatusTick.done({super.key, this.size = 22}) : retry = false;
  const StatusTick.retry({super.key, this.size = 22}) : retry = true;

  static const green = Color(0xFF16A34A);
  static const amber = Color(0xFFD97706);

  @override
  Widget build(BuildContext context) {
    final color = retry ? amber : green;
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.16),
        shape: BoxShape.circle,
      ),
      child: Icon(retry ? Icons.refresh_rounded : Icons.check_rounded,
          size: size * 0.68, color: color),
    );
  }
}
