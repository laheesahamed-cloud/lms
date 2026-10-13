import 'package:flutter/material.dart';

/// What a SCREENSHOT sees while the capture shield is being rebuilt — never
/// what the student sees.
///
/// During the rebuild the protected snapshot window sits on top showing a
/// pixel-perfect still of the lesson, so the screen looks untouched. A capture
/// skips that protected layer and records whatever is behind it, which is this.
///
/// So it is written for the person who took the screenshot, not for the student
/// using the app — hence the explicit wording, which would be alarming if it
/// ever appeared on screen. If a student does see it, the shield failed to
/// raise and the fallback is doing its job.
class BlockedPlaceholder extends StatelessWidget {
  const BlockedPlaceholder({super.key});

  @override
  Widget build(BuildContext context) {
    // Material, not a bare ColoredBox: `Text` with no Material ancestor renders
    // with yellow debug double-underlines, which is exactly what a screenshot
    // would then carry. This project has hit that twice already.
    return const Material(
      color: Color(0xFF0B1220),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('xyndrome',
                style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFFBBECFF))),
            SizedBox(height: 12),
            Text('Screenshot blocked',
                style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.w700,
                    color: Colors.white)),
            SizedBox(height: 12),
            Text('This content is protected.',
                style: TextStyle(fontSize: 15, color: Color(0xB8FFFFFF))),
          ],
        ),
      ),
    );
  }
}
