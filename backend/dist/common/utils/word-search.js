"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchWords = searchWords;
exports.wordSearchFilter = wordSearchFilter;
const STOP_WORDS = new Set(['about', 'are', 'com', 'for', 'from', 'how', 'that', 'the', 'this', 'was', 'what', 'when', 'where', 'who', 'will', 'with', 'und', 'www']);
function searchWords(query) {
    const pieces = String(query || '').toLowerCase().slice(0, 100).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    return (pieces.some((w) => w.length > 1) ? pieces.filter((w) => w.length > 1) : pieces).slice(0, 6);
}
function wordSearchFilter(columns, words) {
    if (!words.length)
        return null;
    const indexed = words.filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
    const patterned = words.filter((w) => w.length < 3 || STOP_WORDS.has(w));
    const parts = [];
    const params = [];
    if (indexed.length) {
        parts.push(`MATCH(${columns.join(', ')}) AGAINST (? IN BOOLEAN MODE)`);
        params.push(indexed.map((w) => `+${w}*`).join(' '));
    }
    for (const w of patterned) {
        parts.push(`(${columns.map((c) => `${c} REGEXP ?`).join(' OR ')})`);
        for (let i = 0; i < columns.length; i += 1)
            params.push(`(^|[^[:alnum:]])${w}`);
    }
    return { sql: parts.join(' AND '), params };
}
//# sourceMappingURL=word-search.js.map