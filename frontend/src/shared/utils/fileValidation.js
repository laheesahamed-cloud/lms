const RESERVED_FILENAME_CHARS = new Set(['\\', '/', '<', '>', ':', '"', '|', '?', '*']);

export function hasUnsafeFileNameCharacters(value) {
  return Array.from(String(value || '')).some((char) => (
    RESERVED_FILENAME_CHARS.has(char) || char.charCodeAt(0) <= 31
  ));
}
