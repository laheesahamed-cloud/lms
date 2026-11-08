"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.splitLongBullet = splitLongBullet;
exports.calmTextForPhone = calmTextForPhone;
const mobile_table_layout_1 = require("./mobile-table-layout");
const LONG_BULLET = 110;
const MAX_LINES_PER_CARD = 8;
const CONTINUED_SUFFIX = ' (continued)';
const isSub = (line) => line.trimStart().startsWith('→');
const isParent = (line) => !isSub(line) && line.trimEnd().endsWith(':');
function splitLongBullet(bullet) {
    const line = String(bullet ?? '');
    if (isSub(line) || isParent(line) || line.length <= LONG_BULLET)
        return [line];
    const parts = (0, mobile_table_layout_1.splitValue)(line);
    if (parts.length < 2)
        return [line];
    return [parts[0], ...parts.slice(1).map((part) => `→ ${part}`)];
}
function toGroups(lines) {
    const groups = [];
    for (const line of lines) {
        if (isSub(line) && groups.length)
            groups[groups.length - 1].push(line);
        else
            groups.push([line]);
    }
    return groups;
}
function chunkGroups(groups) {
    const chunks = [];
    let current = [];
    for (const group of groups) {
        if (current.length && current.length + group.length > MAX_LINES_PER_CARD) {
            chunks.push(current);
            current = [];
        }
        current = current.concat(group);
    }
    if (current.length)
        chunks.push(current);
    return chunks;
}
function calmSection(section) {
    if (!section || typeof section !== 'object')
        return [section];
    const card = section;
    const type = card.type;
    if (type && type !== 'text' && type !== 'section')
        return [section];
    if (!Array.isArray(card.bullets) || !card.bullets.length)
        return [section];
    const lines = card.bullets.flatMap((bullet) => splitLongBullet(String(bullet ?? '')));
    const chunks = chunkGroups(toGroups(lines));
    if (chunks.length <= 1)
        return [{ ...card, bullets: lines }];
    const extras = ['callout', 'mnemonic', 'sticky_note', 'embeddedTable'];
    return chunks.map((bullets, index) => {
        const next = { ...card, bullets };
        if (index > 0) {
            next.heading = `${String(card.heading ?? '').trim()}${CONTINUED_SUFFIX}`;
            delete next.sectionImage;
        }
        if (index < chunks.length - 1) {
            extras.forEach((key) => { delete next[key]; });
        }
        return next;
    });
}
function calmSections(sections) {
    return Array.isArray(sections) ? sections.flatMap(calmSection) : sections;
}
function calmTextForPhone(noteData) {
    if (!noteData || typeof noteData !== 'object')
        return noteData;
    const data = noteData;
    const next = { ...data };
    if (Array.isArray(data.pages)) {
        next.pages = data.pages.map((page) => (page && typeof page === 'object' ? { ...page, sections: calmSections(page.sections) } : page));
    }
    if (Array.isArray(data.sections))
        next.sections = calmSections(data.sections);
    return next;
}
//# sourceMappingURL=mobile-text-layout.js.map