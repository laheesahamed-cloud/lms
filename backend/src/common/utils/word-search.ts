/**
 * Word-start search on FULLTEXT indexes (lessons, quizzes, users; schema
 * 2026-11-14.8). Every typed word must start a word in the columns.
 *
 * The index holds words of 3+ letters minus MariaDB/MySQL's stop words, so
 * those go to MATCH (reads only matching rows); 2-letter words ("MI", "TB")
 * and stop words are checked with a word-start pattern on the rows MATCH
 * found. A query made only of such words falls back to a limited scan.
 * One-letter pieces (the "s" of "cow's") are skipped.
 *
 * Returns null when there is nothing to search for.
 */
const STOP_WORDS = new Set(['about', 'are', 'com', 'for', 'from', 'how', 'that', 'the', 'this', 'was', 'what', 'when', 'where', 'who', 'will', 'with', 'und', 'www']);

export function searchWords(query: string): string[] {
  const pieces = String(query || '').toLowerCase().slice(0, 100).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  return (pieces.some((w) => w.length > 1) ? pieces.filter((w) => w.length > 1) : pieces).slice(0, 6);
}

export function wordSearchFilter(columns: string[], words: string[]): { sql: string; params: string[] } | null {
  if (!words.length) return null;
  const indexed = words.filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
  const patterned = words.filter((w) => w.length < 3 || STOP_WORDS.has(w));
  const parts: string[] = [];
  const params: string[] = [];
  if (indexed.length) {
    parts.push(`MATCH(${columns.join(', ')}) AGAINST (? IN BOOLEAN MODE)`);
    params.push(indexed.map((w) => `+${w}*`).join(' '));
  }
  for (const w of patterned) {
    // Word start, portable across MariaDB and MySQL regex engines.
    parts.push(`(${columns.map((c) => `${c} REGEXP ?`).join(' OR ')})`);
    for (let i = 0; i < columns.length; i += 1) params.push(`(^|[^[:alnum:]])${w}`);
  }
  return { sql: parts.join(' AND '), params };
}
