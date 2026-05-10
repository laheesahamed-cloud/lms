export const PROFILE_AVATARS = [
  { key: 'blue-tie', skin: '#B77955', hair: '#111827', shirt: '#2563EB', accent: '#DBEAFE', feature: 'tie' },
  { key: 'teal-coat', skin: '#8D5524', hair: '#1F2937', shirt: '#0F766E', accent: '#CCFBF1', feature: 'coat' },
  { key: 'pink-necklace', skin: '#F1C27D', hair: '#4A2C2A', shirt: '#DB2777', accent: '#FCE7F3', feature: 'necklace' },
  { key: 'violet-scarf', skin: '#C68642', hair: '#171717', shirt: '#7C3AED', accent: '#EDE9FE', feature: 'scarf' },
  { key: 'amber-coat', skin: '#E0AC69', hair: '#78350F', shirt: '#D97706', accent: '#FEF3C7', feature: 'coat' },
  { key: 'cyan-necklace', skin: '#A47148', hair: '#0F172A', shirt: '#0891B2', accent: '#CFFAFE', feature: 'necklace' },
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

export function ProfileAvatar({ user, avatarKey = '', size = 'sm' }) {
  const avatar = getProfileAvatar(avatarKey || user);
  const isLongHair = avatar.feature === 'necklace' || avatar.feature === 'scarf';
  const sizeClass = size === 'xl' ? 'size-20 rounded-3xl' : size === 'lg' ? 'size-10 rounded-[14px]' : 'size-[34px] rounded-xl';

  return (
    <span className={`inline-grid shrink-0 place-items-center overflow-hidden bg-surface-2 shadow-[0_3px_8px_rgba(37,99,235,0.20)] ${sizeClass}`} aria-hidden="true">
      <svg className="block size-full" viewBox="0 0 48 48" focusable="false">
        <rect width="48" height="48" rx="16" fill={avatar.accent} />
        <circle cx="24" cy="18" r="10.5" fill={avatar.hair} />
        {isLongHair ? <path d="M12 29c1.2-10.8 6.2-17 12-17s10.8 6.2 12 17l-4 4H16l-4-4Z" fill={avatar.hair} /> : null}
        <circle cx="24" cy="21" r="8.3" fill={avatar.skin} />
        <path d="M11 42c2.2-8.1 7.1-12.1 13-12.1S34.8 33.9 37 42H11Z" fill={avatar.shirt} />
        <path d="M18 33.2c1.6 2 3.5 3 6 3s4.4-1 6-3" stroke="rgba(255,255,255,0.72)" strokeWidth="1.8" strokeLinecap="round" />
        {avatar.feature === 'tie' ? <path d="M24 32l2.4 4.2L24 42l-2.4-5.8L24 32Z" fill="#FFFFFF" opacity=".9" /> : null}
        {avatar.feature === 'coat' ? <path d="M17 34l7 8 7-8" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity=".85" /> : null}
        {avatar.feature === 'necklace' ? <path d="M20 35c1.2.8 2.5 1.2 4 1.2s2.8-.4 4-1.2" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" opacity=".9" /> : null}
        {avatar.feature === 'scarf' ? <path d="M18 33h12l-2 9h-8l-2-9Z" fill="#FFFFFF" opacity=".22" /> : null}
        <circle cx="20.6" cy="21.4" r="1" fill="#111827" opacity=".68" />
        <circle cx="27.4" cy="21.4" r="1" fill="#111827" opacity=".68" />
        <path d="M21.2 25.6c1.8 1.2 3.8 1.2 5.6 0" stroke="#7C2D12" strokeWidth="1.35" strokeLinecap="round" opacity=".62" />
      </svg>
    </span>
  );
}
