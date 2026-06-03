import { getProfileAvatar } from './profileAvatarData.js';

export function ProfileAvatar({ user, avatarKey = '', size = 'sm', className = '' }) {
  const avatar = getProfileAvatar(avatarKey || user);
  const isLongHair = avatar.feature === 'necklace' || avatar.feature === 'scarf';
  const sizeClass = size === 'xl' ? 'size-20 rounded-3xl' : size === 'lg' ? 'size-10 rounded-[14px]' : 'size-[34px] rounded-xl';

  return (
    <span className={`lms-profile-avatar inline-grid aspect-square shrink-0 place-items-center overflow-hidden border border-white/80 bg-surface-2 leading-none shadow-[0_3px_8px_rgba(37,99,235,0.20)] ring-1 ring-[rgba(37,99,235,0.16)] dark:border-white/10 dark:ring-white/10 ${sizeClass} ${className}`} aria-hidden="true">
      <svg className="block size-full shrink-0" viewBox="0 0 48 48" preserveAspectRatio="xMidYMid meet" focusable="false">
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
