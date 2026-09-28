import 'dart:convert';

import 'package:flutter/material.dart';

import '../config/app_config.dart';

/// Renders an inline content image that may be an http(s) URL, a server-relative
/// path (`/uploads/...`), or a base64 `data:` URI (the web admin uploader
/// inline-encodes the picture). Image.network cannot decode data URIs, so we
/// branch on the scheme. `cacheWidth` downsamples on decode so a heavy image
/// never holds full-resolution bytes in memory on the device. Renders nothing
/// for a blank or unsupported value.
class ContentImage extends StatelessWidget {
  final String url;
  final BoxFit fit;
  final double borderRadius;
  final int decodeWidth;

  const ContentImage(
    this.url, {
    super.key,
    this.fit = BoxFit.contain,
    this.borderRadius = 12,
    this.decodeWidth = 1080,
  });

  @override
  Widget build(BuildContext context) {
    final value = url.trim();
    if (value.isEmpty) return const SizedBox.shrink();

    Widget? img;
    if (value.startsWith('data:image')) {
      final comma = value.indexOf(',');
      if (comma > 0 && value.substring(0, comma).contains('base64')) {
        try {
          img = Image.memory(base64Decode(value.substring(comma + 1)),
              fit: fit,
              cacheWidth: decodeWidth,
              errorBuilder: (_, _, _) => const SizedBox.shrink());
        } catch (_) {
          img = null;
        }
      }
    } else if (value.startsWith('http') || value.startsWith('/')) {
      img = Image.network(_absolute(value),
          fit: fit,
          cacheWidth: decodeWidth,
          errorBuilder: (_, _, _) => const SizedBox.shrink());
    }
    if (img == null) return const SizedBox.shrink();

    return ClipRRect(
      borderRadius: BorderRadius.circular(borderRadius),
      child: img,
    );
  }

  /// A server-relative path (`/uploads/osce/...`) has no host on a native
  /// device, so resolve it against the API origin — minus the trailing `/api`,
  /// since these paths are absolute from the site root.
  static String _absolute(String value) {
    if (value.startsWith('http')) return value;
    final origin = AppConfig.apiBaseUrl.replaceFirst(RegExp(r'/api/?$'), '');
    return '$origin$value';
  }
}
