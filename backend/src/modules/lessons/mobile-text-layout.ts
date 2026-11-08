// The phone app draws every lesson card at one size, so dense notes feel crowded. Like the
// table reshaping, this runs on the copy sent to the phone app only (never on what is
// stored) and uses nothing the app can't already draw:
//   * a long bullet becomes a short line with indented "→" sub-lines (split at sentence
//     ends and semicolons, never through a **bold** / ==highlight== run);
//   * a card with many lines is split into several smaller cards, so a screenful carries
//     less. A line starting with "→" always stays under its parent line.

import { splitValue } from './mobile-table-layout';

type Json = Record<string, unknown>;

const LONG_BULLET = 110;
const MAX_LINES_PER_CARD = 8;
const CONTINUED_SUFFIX = ' (continued)';

const isSub = (line: string) => line.trimStart().startsWith('→');
const isParent = (line: string) => !isSub(line) && line.trimEnd().endsWith(':');

export function splitLongBullet(bullet: string): string[] {
  const line = String(bullet ?? '');
  if (isSub(line) || isParent(line) || line.length <= LONG_BULLET) return [line];
  const parts = splitValue(line);
  if (parts.length < 2) return [line];
  return [parts[0], ...parts.slice(1).map((part) => `→ ${part}`)];
}

// Groups = one top-level line plus the "→" lines under it, so a split never separates them.
function toGroups(lines: string[]): string[][] {
  const groups: string[][] = [];
  for (const line of lines) {
    if (isSub(line) && groups.length) groups[groups.length - 1].push(line);
    else groups.push([line]);
  }
  return groups;
}

function chunkGroups(groups: string[][]): string[][] {
  const chunks: string[][] = [];
  let current: string[] = [];
  for (const group of groups) {
    if (current.length && current.length + group.length > MAX_LINES_PER_CARD) {
      chunks.push(current);
      current = [];
    }
    current = current.concat(group);
  }
  if (current.length) chunks.push(current);
  return chunks;
}

function calmSection(section: unknown): unknown[] {
  if (!section || typeof section !== 'object') return [section];
  const card = section as Json;
  const type = card.type;
  if (type && type !== 'text' && type !== 'section') return [section]; // tables, flows, images ...
  if (!Array.isArray(card.bullets) || !card.bullets.length) return [section];

  const lines = (card.bullets as unknown[]).flatMap((bullet) => splitLongBullet(String(bullet ?? '')));
  const chunks = chunkGroups(toGroups(lines));
  if (chunks.length <= 1) return [{ ...card, bullets: lines }];

  // The first card keeps the heading and any image; the callout, mnemonic, sticky note and
  // embedded table stay with the LAST card, where they read as the wrap-up of the topic.
  const extras = ['callout', 'mnemonic', 'sticky_note', 'embeddedTable'];
  return chunks.map((bullets, index) => {
    const next: Json = { ...card, bullets };
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

function calmSections(sections: unknown): unknown {
  return Array.isArray(sections) ? sections.flatMap(calmSection) : sections;
}

export function calmTextForPhone(noteData: unknown): unknown {
  if (!noteData || typeof noteData !== 'object') return noteData;
  const data = noteData as Json;
  const next: Json = { ...data };
  if (Array.isArray(data.pages)) {
    next.pages = data.pages.map((page) => (
      page && typeof page === 'object' ? { ...(page as Json), sections: calmSections((page as Json).sections) } : page
    ));
  }
  if (Array.isArray(data.sections)) next.sections = calmSections(data.sections);
  return next;
}
