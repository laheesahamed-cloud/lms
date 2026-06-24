import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// The 6 selectable avatars — mirrored verbatim from the web app
/// (frontend/src/shared/ui/profileAvatarData.js). The `key` is what the
/// backend stores in `users.avatar_key` and validates against.
class AvatarSpec {
  final String key;
  final String skin;
  final String hair;
  final String shirt;
  final String accent;
  final String feature; // tie | coat | necklace | scarf
  const AvatarSpec(
      this.key, this.skin, this.hair, this.shirt, this.accent, this.feature);
}

const List<AvatarSpec> kProfileAvatars = [
  AvatarSpec('blue-tie', '#B77955', '#111827', '#2563EB', '#DBEAFE', 'tie'),
  AvatarSpec('teal-coat', '#8D5524', '#1F2937', '#2563EB', '#DBEAFE', 'coat'),
  AvatarSpec(
      'pink-necklace', '#F1C27D', '#4A2C2A', '#DB2777', '#FCE7F3', 'necklace'),
  AvatarSpec('violet-scarf', '#C68642', '#171717', '#7C3AED', '#EDE9FE', 'scarf'),
  AvatarSpec('amber-coat', '#E0AC69', '#78350F', '#D97706', '#FEF3C7', 'coat'),
  AvatarSpec(
      'cyan-necklace', '#A47148', '#0F172A', '#0EA5E9', '#DBEAFE', 'necklace'),
];

int _hashText(String value) {
  var hash = 0;
  for (final code in (value.isEmpty ? 'user' : value).codeUnits) {
    hash = ((hash << 5) - hash + code) & 0xFFFFFFFF;
  }
  // Emulate JS's 32-bit signed `| 0`.
  if (hash >= 0x80000000) hash -= 0x100000000;
  return hash;
}

/// Resolves an avatar by explicit key, else deterministically from a fallback
/// seed (id / email / name) — same logic as the web `getProfileAvatar`.
AvatarSpec resolveAvatar({String? avatarKey, String? seed}) {
  if (avatarKey != null && avatarKey.isNotEmpty) {
    for (final a in kProfileAvatars) {
      if (a.key == avatarKey) return a;
    }
  }
  final h = _hashText(seed ?? 'user').abs();
  return kProfileAvatars[h % kProfileAvatars.length];
}

/// Renders one avatar as an SVG — pixel-identical to the web `ProfileAvatar`.
class ProfileAvatar extends StatelessWidget {
  final AvatarSpec avatar;
  final double size;
  final double radius;

  const ProfileAvatar({
    super.key,
    required this.avatar,
    this.size = 38,
    this.radius = 14,
  });

  /// Convenience: build straight from a stored key + fallback seed.
  factory ProfileAvatar.from({
    Key? key,
    String? avatarKey,
    String? seed,
    double size = 38,
    double radius = 14,
  }) =>
      ProfileAvatar(
        key: key,
        avatar: resolveAvatar(avatarKey: avatarKey, seed: seed),
        size: size,
        radius: radius,
      );

  String _svg() {
    final isLongHair =
        avatar.feature == 'necklace' || avatar.feature == 'scarf';
    final hair = avatar.hair;
    final feature = avatar.feature;
    return '''
<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <rect width="48" height="48" rx="16" fill="${avatar.accent}" />
  <circle cx="24" cy="18" r="10.5" fill="$hair" />
  ${isLongHair ? '<path d="M12 29c1.2-10.8 6.2-17 12-17s10.8 6.2 12 17l-4 4H16l-4-4Z" fill="$hair" />' : ''}
  <circle cx="24" cy="21" r="8.3" fill="${avatar.skin}" />
  <path d="M11 42c2.2-8.1 7.1-12.1 13-12.1S34.8 33.9 37 42H11Z" fill="${avatar.shirt}" />
  <path d="M18 33.2c1.6 2 3.5 3 6 3s4.4-1 6-3" stroke="rgba(255,255,255,0.72)" stroke-width="1.8" stroke-linecap="round" fill="none" />
  ${feature == 'tie' ? '<path d="M24 32l2.4 4.2L24 42l-2.4-5.8L24 32Z" fill="#FFFFFF" opacity=".9" />' : ''}
  ${feature == 'coat' ? '<path d="M17 34l7 8 7-8" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity=".85" fill="none" />' : ''}
  ${feature == 'necklace' ? '<path d="M20 35c1.2.8 2.5 1.2 4 1.2s2.8-.4 4-1.2" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" opacity=".9" fill="none" />' : ''}
  ${feature == 'scarf' ? '<path d="M18 33h12l-2 9h-8l-2-9Z" fill="#FFFFFF" opacity=".22" />' : ''}
  <circle cx="20.6" cy="21.4" r="1" fill="#111827" opacity=".68" />
  <circle cx="27.4" cy="21.4" r="1" fill="#111827" opacity=".68" />
  <path d="M21.2 25.6c1.8 1.2 3.8 1.2 5.6 0" stroke="#7C2D12" stroke-width="1.35" stroke-linecap="round" opacity=".62" fill="none" />
</svg>''';
  }

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: SizedBox(
        width: size,
        height: size,
        child: SvgPicture.string(_svg(), fit: BoxFit.cover),
      ),
    );
  }
}
