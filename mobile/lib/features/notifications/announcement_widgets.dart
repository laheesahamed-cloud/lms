import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';

import '../../theme/tokens.dart';
import 'notifications_repository.dart';

/// In-app announcements (OPTIMIZE 10 step 4, design picked 2026-11-15): the
/// admin chooses per announcement between a centre card (A, optional picture)
/// and a Study Hub banner (C). One is shown at a time, highest priority first,
/// once per device; closing it lets the next one through. Data comes from the
/// phone (saved from the start-up reply), so this works offline too.

String _s(Object? v) => v == null ? '' : '$v';

/// Opens an announcement's in-app link (only app paths are allowed).
void _openAction(BuildContext context, String path) {
  if (path.startsWith('/app/')) context.push(path);
}

/// The Study Hub banner (style C). Nothing when the current announcement is
/// a centre card, or there is none.
class AnnouncementBanner extends ConsumerWidget {
  const AnnouncementBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = ref.watch(currentPopupProvider).asData?.value;
    if (p == null || p['style'] != 'banner') return const SizedBox.shrink();
    final c = context.c;
    final action = _s(p['actionPath']);
    Future<void> close() async {
      await markPopupSeen(p['id']);
      ref.invalidate(currentPopupProvider);
    }

    // 2026-11-18 redesign: no side bar, gold megaphone and gold label, icon
    // and X centred vertically; the whole banner opens the link (no link text).
    final opens = action.startsWith('/app/');
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Material(
        color: c.card,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: BorderSide(color: Color.alphaBlend(_gold.withValues(alpha: 0.35), c.line)),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: opens
              ? () {
                  close();
                  _openAction(context, action);
                }
              : null,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 4, 12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                      color: _gold.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(12)),
                  padding: const EdgeInsets.all(8),
                  child: SvgPicture.string(_megaphoneSvg),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text('ANNOUNCEMENT',
                          style: TextStyle(
                              fontSize: 10.5, fontWeight: FontWeight.w800, letterSpacing: 1.1, color: _gold)),
                      const SizedBox(height: 3),
                      Text(_s(p['title']),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800, color: c.inkStrong)),
                      if (_s(p['body']).isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(_s(p['body']),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(fontSize: 13, height: 1.45, color: c.inkMedium)),
                      ],
                    ],
                  ),
                ),
                IconButton(
                  tooltip: 'Close',
                  visualDensity: VisualDensity.compact,
                  onPressed: close,
                  icon: Icon(Icons.close_rounded, size: 18, color: c.inkSoft),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Shows the centre card (style A) once, over the Study Hub, when the current
/// announcement is one. Put it anywhere in the Study Hub tree; it draws nothing.
class AnnouncementCardHost extends ConsumerStatefulWidget {
  const AnnouncementCardHost({super.key});
  @override
  ConsumerState<AnnouncementCardHost> createState() => _AnnouncementCardHostState();
}

class _AnnouncementCardHostState extends ConsumerState<AnnouncementCardHost> {
  // One centre card per app session at most; the next waits for the next open.
  static bool _shownThisSession = false;

  @override
  Widget build(BuildContext context) {
    ref.listen(currentPopupProvider, (_, next) => _maybeShow(next.asData?.value));
    final now = ref.read(currentPopupProvider).asData?.value;
    if (now != null) WidgetsBinding.instance.addPostFrameCallback((_) => _maybeShow(now));
    return const SizedBox.shrink();
  }

  Future<void> _maybeShow(Map<String, dynamic>? p) async {
    if (p == null || p['style'] != 'card' || _shownThisSession || !mounted) return;
    _shownThisSession = true;
    final action = await showDialog<String>(
      context: context,
      barrierColor: Colors.black.withValues(alpha: 0.55),
      builder: (_) => _AnnouncementCard(p: p),
    );
    await markPopupSeen(p['id']);
    if (!mounted) return;
    ref.invalidate(currentPopupProvider);
    if (action != null) _openAction(context, action);
  }
}

/// The announcement mark: a small gold megaphone (2026-11-18 design).
const _gold = Color(0xFFE8B54A);
const _megaphoneSvg = '''<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
<path d="M16 28v8a3 3 0 0 0 3 3h4l12 8V17l-12 8h-4a3 3 0 0 0-3 3z" fill="#E8B54A"/>
<path d="M23 39l2.5 8.5a2 2 0 0 0 3.8-1.1L27.5 41" fill="none" stroke="#E8B54A" stroke-width="3" stroke-linecap="round"/>
<path d="M41 26a8 8 0 0 1 0 12M45.5 22a14 14 0 0 1 0 20" fill="none" stroke="#E8B54A" stroke-width="3.5" stroke-linecap="round"/>
</svg>''';

/// Centre announcement (style A), redesigned 2026-11-18: portrait card, a
/// small gold megaphone with "Announcement" on one row, an X to close, and a
/// single full-width button only when the announcement links somewhere.
class _AnnouncementCard extends StatelessWidget {
  final Map<String, dynamic> p;
  const _AnnouncementCard({required this.p});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final image = _s(p['imageUrl']);
    final hasImage = image.startsWith('https://');
    final action = _s(p['actionPath']);
    final hasAction = action.startsWith('/app/');
    final label = _s(p['actionLabel']).isEmpty ? 'Open' : _s(p['actionLabel']);
    final screen = MediaQuery.of(context).size;
    final width = (screen.width - 64).clamp(240.0, 340.0);
    // Portrait (3:4), never taller than the screen; content centred inside.
    final height = (width * 4 / 3).clamp(300.0, screen.height * 0.8);

    Widget closeButton({required bool onImage}) => Positioned(
          top: 10,
          right: 10,
          child: Material(
            color: onImage ? Colors.black.withValues(alpha: 0.45) : c.surface2,
            shape: const CircleBorder(),
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: () => Navigator.of(context).pop(),
              child: Padding(
                padding: const EdgeInsets.all(6),
                child: Icon(Icons.close_rounded, size: 18, color: onImage ? Colors.white : c.inkMedium),
              ),
            ),
          ),
        );

    // Megaphone on the first row, "ANNOUNCEMENT" under it, all centred (user, 2026-11-18).
    final kicker = Column(
      children: [
        SvgPicture.string(_megaphoneSvg, width: hasImage ? 30 : 44, height: hasImage ? 30 : 44),
        const SizedBox(height: 5),
        const Text('ANNOUNCEMENT',
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, letterSpacing: 1.3, color: _gold)),
      ],
    );

    final content = Padding(
      padding: EdgeInsets.fromLTRB(22, hasImage ? 16 : 24, 22, 22),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          kicker,
          const SizedBox(height: 8),
          Text(_s(p['title']),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 20, height: 1.25, fontWeight: FontWeight.w800, color: c.inkStrong)),
          const SizedBox(height: 5),
          Text(_s(p['body']),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 14.5, height: 1.55, color: c.inkMedium)),
          if (hasAction) ...[
            const SizedBox(height: 6),
            // A plain text link, not a big button (user, 2026-11-18).
            TextButton(
              onPressed: () => Navigator.of(context).pop(action),
              style: TextButton.styleFrom(
                foregroundColor: c.primary,
                padding: const EdgeInsets.symmetric(horizontal: 8),
                minimumSize: const Size(0, 36),
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: Text('$label →', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
            ),
          ],
        ],
      ),
    );

    return Dialog(
      backgroundColor: c.cardElevated,
      insetPadding: const EdgeInsets.symmetric(horizontal: 32),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(26), side: BorderSide(color: c.line)),
      clipBehavior: Clip.antiAlias,
      child: SizedBox(
        width: width,
        height: height,
        child: Stack(
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (hasImage)
                  SizedBox(
                    height: height * 0.42,
                    child: Image.network(image,
                        fit: BoxFit.cover, errorBuilder: (_, _, _) => Container(color: c.primaryTint)),
                  ),
                Expanded(child: content),
              ],
            ),
            closeButton(onImage: hasImage),
          ],
        ),
      ),
    );
  }
}
