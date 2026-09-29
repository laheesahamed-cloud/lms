import 'package:flutter/material.dart';

import '../osce_media_cache.dart';
import '../osce_repository.dart';

/// One slot's media, whichever kind it holds.
///
/// A still renders through the on-device cache as before. A clip renders as a
/// tappable panel that opens the app's existing video modal — the same one
/// lessons use, which already plays a direct MP4/WebM through a bare <video>
/// element. That's deliberate: adding a video plugin would mean a pubspec
/// change, and native plugin additions are what break the iOS build here.
class OsceMediaView extends StatelessWidget {
  final OsceImage media;
  final BoxFit fit;
  const OsceMediaView({
    super.key,
    required this.media,
    this.fit = BoxFit.cover,
  });

  @override
  Widget build(BuildContext context) {
    // Both branches live in OsceCachedImage now, which every OSCE screen uses —
    // this just adds the caption where there's room for one.
    if (media.isVideo) {
      return OsceVideoTile(url: media.full);
    }
    return OsceCachedImage(url: media.full, fit: fit);
  }
}
