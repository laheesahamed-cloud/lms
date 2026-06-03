export const PROFILE_AVATARS = [
  { key: 'blue-tie', skin: '#B77955', hair: '#111827', shirt: '#2563EB', accent: '#DBEAFE', feature: 'tie' },
  { key: 'teal-coat', skin: '#8D5524', hair: '#1F2937', shirt: '#2563EB', accent: '#DBEAFE', feature: 'coat' },
  { key: 'pink-necklace', skin: '#F1C27D', hair: '#4A2C2A', shirt: '#DB2777', accent: '#FCE7F3', feature: 'necklace' },
  { key: 'violet-scarf', skin: '#C68642', hair: '#171717', shirt: '#7C3AED', accent: '#EDE9FE', feature: 'scarf' },
  { key: 'amber-coat', skin: '#E0AC69', hair: '#78350F', shirt: '#D97706', accent: '#FEF3C7', feature: 'coat' },
  { key: 'cyan-necklace', skin: '#A47148', hair: '#0F172A', shirt: '#0EA5E9', accent: '#DBEAFE', feature: 'necklace' },
];

function hashText(value) {
  return String(value || 'user').split('').reduce((hash, char) => (
    ((hash << 5) - hash + char.charCodeAt(0)) | 0
  ), 0);
}

export function getProfileAvatar(userOrKey) {
  const avatarKey = typeof userOrKey === 'string' ? userOrKey : userOrKey?.avatarKey;
  const selected = PROFILE_AVATARS.find((avatar) => avatar.key === avatarKey);
  if (selected) return selected;

  const key = userOrKey?.id ?? userOrKey?.email ?? userOrKey?.fullName ?? userOrKey?.role ?? 'user';
  return PROFILE_AVATARS[Math.abs(hashText(key)) % PROFILE_AVATARS.length];
}
