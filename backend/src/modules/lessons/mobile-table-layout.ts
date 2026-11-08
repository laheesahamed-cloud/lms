// The phone app draws tables by splitting the screen width into equal columns, so a
// table with 4+ columns ends up with words snapped in half. The app can't be changed
// without a store build, so the lesson API reshapes WIDE tables for the phone app only
// (requests carrying the app client header). The stored lesson is never touched and the
// website keeps the real table.
//
//   3 columns or fewer      -> left alone (already fits)
//   4+ columns, 1-2 rows    -> turned on its side: the rows become the columns
//   4+ columns, 3+ rows     -> one small card per row (first column = card title; every
//                              other column = a label line with its value under it)
//
// Everything produced here uses section types the app already draws.

type Json = Record<string, unknown>;

const WIDE_COLUMNS = 4;
const SIDEWAYS_MAX_ROWS = 2;

function text(value: unknown): string {
  return value == null ? '' : String(value);
}

// Card headings and labels are drawn as plain text (no **bold** / ==highlight== parsing),
// so any marker left in them would show up literally on the phone.
function stripMarkers(value: string): string {
  return value.replace(/\*\*|==/g, '').trim();
}

const balanced = (piece: string) =>
  (piece.match(/\*\*/g) || []).length % 2 === 0 && (piece.match(/==/g) || []).length % 2 === 0;

// A long cell becomes several short lines instead of one dense paragraph. Split only at
// sentence ends and semicolons, and only when no **bold** / ==highlight== run is cut in half.
export function splitValue(value: string): string[] {
  const parts = value
    .split(/;\s+|(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((piece) => piece.trim())
    .filter(Boolean);
  return parts.length > 1 && parts.every(balanced) ? parts : [value.trim()];
}

function reshapeSection(section: unknown): unknown[] {
  if (!section || typeof section !== 'object') return [section];
  const table = section as Json;
  if (table.type !== 'table') return [section];

  const headers = Array.isArray(table.headers) ? table.headers.map(text) : [];
  const rows = Array.isArray(table.rows)
    ? table.rows.map((row) => (Array.isArray(row) ? row.map(text) : []))
    : [];
  if (headers.length < WIDE_COLUMNS || rows.length === 0) return [section];

  if (rows.length <= SIDEWAYS_MAX_ROWS) {
    return [{
      ...table,
      headers: [headers[0], ...rows.map((row) => row[0] || '')],
      rows: headers.slice(1).map((header, index) => [header, ...rows.map((row) => row[index + 1] || '')]),
    }];
  }

  const accentColor = table.accentColor;
  const cards: Json[] = [];
  const tableHeading = stripMarkers(text(table.heading));
  if (tableHeading) {
    cards.push({ heading: tableHeading, bullets: [], span: 'full', ...(accentColor ? { accentColor } : {}) });
  }
  for (const row of rows) {
    // The app styles a line ending in ":" as a label (accent colour, handwritten font, extra
    // space above) and a line starting with "→" as an indented sub-line — so each column
    // becomes a label with its value underneath, which scans far better than "Label: value".
    const bullets: string[] = [];
    headers.slice(1).forEach((header, index) => {
      const value = (row[index + 1] || '').trim();
      if (!value) return;
      const label = stripMarkers(header) || `Column ${index + 2}`;
      bullets.push(`${label.replace(/:+$/, '')}:`);
      // **bold** is dropped inside these cards (==highlights== stay): it adds little on a card
      // that is already label-and-value, and a build that can't draw it would print the asterisks.
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

function reshapeSections(sections: unknown): unknown {
  return Array.isArray(sections) ? sections.flatMap(reshapeSection) : sections;
}

export function reshapeTablesForPhone(noteData: unknown): unknown {
  if (!noteData || typeof noteData !== 'object') return noteData;
  const data = noteData as Json;
  const next: Json = { ...data };
  if (Array.isArray(data.pages)) {
    next.pages = data.pages.map((page) => (
      page && typeof page === 'object' ? { ...(page as Json), sections: reshapeSections((page as Json).sections) } : page
    ));
  }
  if (Array.isArray(data.sections)) next.sections = reshapeSections(data.sections);
  return next;
}
