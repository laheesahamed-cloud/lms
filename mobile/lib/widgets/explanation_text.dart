import 'package:flutter/material.dart';

import '../utils/paragraphs.dart';

/// An explanation split into 2–3 paragraphs (see [readableParagraphs]), each
/// with a dot in front (user, 2026-11-18). One paragraph = plain text, no dot.
class ExplanationText extends StatelessWidget {
  const ExplanationText(this.text, {super.key, required this.style, this.dotColor});

  final String text;
  final TextStyle style;
  final Color? dotColor;

  @override
  Widget build(BuildContext context) {
    final parts = readableParagraphs(text).split('\n\n').where((p) => p.trim().isNotEmpty).toList();
    if (parts.length < 2) return Text(text.trim(), style: style);
    final size = style.fontSize ?? 14;
    final lineHeight = size * (style.height ?? 1.4);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < parts.length; i++)
          Padding(
            padding: EdgeInsets.only(bottom: i == parts.length - 1 ? 0 : size * 0.3),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  height: lineHeight,
                  child: Center(
                    child: Container(
                      width: size * 0.36,
                      height: size * 0.36,
                      decoration: BoxDecoration(
                          color: dotColor ?? style.color, shape: BoxShape.circle),
                    ),
                  ),
                ),
                SizedBox(width: size * 0.6),
                Expanded(child: Text(parts[i], style: style)),
              ],
            ),
          ),
      ],
    );
  }
}
