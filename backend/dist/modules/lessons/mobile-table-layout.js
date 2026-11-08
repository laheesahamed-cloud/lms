"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.splitValue = splitValue;
exports.reshapeTablesForPhone = reshapeTablesForPhone;
const WIDE_COLUMNS = 4;
const SIDEWAYS_MAX_ROWS = 2;
function text(value) {
    return value == null ? '' : String(value);
}
function stripMarkers(value) {
    return value.replace(/\*\*|==/g, '').trim();
}
const balanced = (piece) => (piece.match(/\*\*/g) || []).length % 2 === 0 && (piece.match(/==/g) || []).length % 2 === 0;
function splitValue(value) {
    const parts = value
        .split(/;\s+|(?<=[.!?])\s+(?=[A-Z0-9])/)
        .map((piece) => piece.trim())
        .filter(Boolean);
    return parts.length > 1 && parts.every(balanced) ? parts : [value.trim()];
}
function reshapeSection(section) {
    if (!section || typeof section !== 'object')
        return [section];
    const table = section;
    if (table.type !== 'table')
        return [section];
    const headers = Array.isArray(table.headers) ? table.headers.map(text) : [];
    const rows = Array.isArray(table.rows)
        ? table.rows.map((row) => (Array.isArray(row) ? row.map(text) : []))
        : [];
    if (headers.length < WIDE_COLUMNS || rows.length === 0)
        return [section];
    if (rows.length <= SIDEWAYS_MAX_ROWS) {
        return [{
                ...table,
                headers: [headers[0], ...rows.map((row) => row[0] || '')],
                rows: headers.slice(1).map((header, index) => [header, ...rows.map((row) => row[index + 1] || '')]),
            }];
    }
    const accentColor = table.accentColor;
    const cards = [];
    const tableHeading = stripMarkers(text(table.heading));
    if (tableHeading) {
        cards.push({ heading: tableHeading, bullets: [], span: 'full', ...(accentColor ? { accentColor } : {}) });
    }
    for (const row of rows) {
        const bullets = [];
        headers.slice(1).forEach((header, index) => {
            const value = (row[index + 1] || '').trim();
            if (!value)
                return;
            const label = stripMarkers(header) || `Column ${index + 2}`;
            bullets.push(`${label.replace(/:+$/, '')}:`);
            splitValue(value).forEach((piece) => bullets.push(`→ ${piece.replace(/\*\*/g, '')}`));
        });
        cards.push({
            heading: stripMarkers(row[0] || '') || tableHeading,
            bullets,
            span: 'full',
            ...(accentColor ? { accentColor } : {}),
        });
    }
    return cards;
}
function reshapeSections(sections) {
    return Array.isArray(sections) ? sections.flatMap(reshapeSection) : sections;
}
function reshapeTablesForPhone(noteData) {
    if (!noteData || typeof noteData !== 'object')
        return noteData;
    const data = noteData;
    const next = { ...data };
    if (Array.isArray(data.pages)) {
        next.pages = data.pages.map((page) => (page && typeof page === 'object' ? { ...page, sections: reshapeSections(page.sections) } : page));
    }
    if (Array.isArray(data.sections))
        next.sections = reshapeSections(data.sections);
    return next;
}
//# sourceMappingURL=mobile-table-layout.js.map