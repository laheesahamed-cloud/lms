import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../theme/tokens.dart';
import '../../lessons/watch_video_modal.dart';
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
  final String? caption;
  const OsceMediaView({
    super.key,
    required this.media,
    this.fit = BoxFit.cover,
    this.caption,
  });

  @override
  Widget build(BuildContext context) {
    if (!media.isVideo) {
      return OsceCachedImage(url: media.full, fit: fit);
    }

    final c = context.c;
    return GestureDetector(
      onTap: () {
        HapticFeedback.selectionClick();
        WatchVideoModal.show(context, media.full);
      },
      child: Container(
        color: c.surface2,
        alignment: Alignment.center,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: c.primary.withValues(alpha: 0.16),
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.play_arrow_rounded, size: 30, color: c.primary),
            ),
            const SizedBox(height: 8),
            Text(caption?.isNotEmpty == true ? caption! : 'Play clip',
                style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                    color: c.inkMedium)),
          ],
        ),
      ),
    );
  }
}
