export function formatPaymentStatus(value, fallback = '-') {
  const status = String(value || '').trim().toLowerCase();
  if (!status) return fallback;
  if (status === 'waived' || status === 'free' || status === 'free_plan') return 'Free Plan';

  return status
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
