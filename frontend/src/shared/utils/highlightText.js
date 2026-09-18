// Splits `text` into segments around each (case-insensitive, exact-substring)
// occurrence of the phrases in `highlights`, so callers can render the
// matched segments differently (e.g. wrapped in <mark>).
// Returns an array of { text: string, highlighted: boolean }.
export function splitTextForHighlights(text, highlights) {
  const source = String(text || '');
  const phrases = (Array.isArray(highlights) ? highlights : [])
    .map((phrase) => String(phrase || '').trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  if (!source || phrases.length === 0) {
    return [{ text: source, highlighted: false }];
  }

  const ranges = [];
  for (const phrase of phrases) {
    const lowerSource = source.toLowerCase();
    const lowerPhrase = phrase.toLowerCase();
    let fromIndex = 0;
    while (fromIndex <= lowerSource.length) {
      const matchIndex = lowerSource.indexOf(lowerPhrase, fromIndex);
      if (matchIndex === -1) break;
      const end = matchIndex + phrase.length;
      const overlaps = ranges.some((range) => matchIndex < range.end && end > range.start);
      if (!overlaps) ranges.push({ start: matchIndex, end });
      fromIndex = matchIndex + phrase.length;
    }
  }

  if (ranges.length === 0) {
    return [{ text: source, highlighted: false }];
  }

  ranges.sort((a, b) => a.start - b.start);

  const segments = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor) {
      segments.push({ text: source.slice(cursor, range.start), highlighted: false });
    }
    segments.push({ text: source.slice(range.start, range.end), highlighted: true });
    cursor = range.end;
  }
  if (cursor < source.length) {
    segments.push({ text: source.slice(cursor), highlighted: false });
  }

  return segments;
}
