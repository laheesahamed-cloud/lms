const EMAIL_KEYS = ['email', 'email_address', 'emailAddress', 'studentEmail', 'userEmail', 'actorEmail', 'assignedByEmail', 'resolvedByEmail', 'billingEmail'];
const NAME_KEYS = ['fullName', 'full_name', 'studentName', 'student_name', 'userName', 'actorName', 'assignedByName', 'resolvedByName', 'name', 'billingName'];

function firstText(source, keys) {
  if (!source) return '';
  for (const key of keys) {
    const raw = source[key];
    const value = String(raw && typeof raw === 'object' ? raw.address || '' : raw || '').trim();
    if (value) return value;
  }
  return '';
}

export function getAdminUserEmail(source) {
  return firstText(source, EMAIL_KEYS);
}

export function getAdminUserName(source) {
  return firstText(source, NAME_KEYS);
}

export function getAdminUserIdentifier(source, fallback = 'User') {
  return getAdminUserEmail(source) || getAdminUserName(source) || fallback;
}

export function getAdminUserSecondaryIdentifier(source) {
  const primary = getAdminUserIdentifier(source, '');
  const name = getAdminUserName(source);
  return name && name !== primary ? name : '';
}

export function formatAdminUserIdentifier(source, fallback = 'User') {
  const primary = getAdminUserIdentifier(source, fallback);
  const secondary = getAdminUserSecondaryIdentifier(source);
  return secondary ? `${primary} (${secondary})` : primary;
}
