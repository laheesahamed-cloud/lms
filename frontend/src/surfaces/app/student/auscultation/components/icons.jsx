/* Shared inline SVG icons for the Auscultation feature (no emojis). */

export function HeartIcon({ size = 16, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M10 16.5S3 12.4 3 7.8A3.3 3.3 0 0 1 10 5.7a3.3 3.3 0 0 1 7 2.1c0 4.6-7 8.7-7 8.7Z"
        stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  );
}

export function LungIcon({ size = 16, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M10 3v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M10 8c-.7 1.2-2.2 1.6-2.2 1.6S6 10 5 11.2c-1.2 1.5-1.4 4.2-.8 5.3.5.9 2.4.8 3.2 0 .9-.9 1.4-2.6 1.4-4.4V8Z"
        stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M10 8c.7 1.2 2.2 1.6 2.2 1.6S14 10 15 11.2c1.2 1.5 1.4 4.2.8 5.3-.5.9-2.4.8-3.2 0-.9-.9-1.4-2.6-1.4-4.4V8Z"
        stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  );
}

export function HeadphonesIcon({ size = 16, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M4 11v-1a6 6 0 0 1 12 0v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <rect x="2.5" y="11" width="3.5" height="5" rx="1.3" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="14" y="11" width="3.5" height="5" rx="1.3" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}

export function SpeakerIcon({ size = 16, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M4 8v4h2.5L10 15V5L6.5 8H4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M12.5 8a3 3 0 0 1 0 4M14.5 6.5a5.5 5.5 0 0 1 0 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

export function AlertIcon({ size = 16, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M10 3.5 17.5 16.5H2.5L10 3.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M10 8.5v3.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="10" cy="14" r="0.9" fill="currentColor"/>
    </svg>
  );
}
