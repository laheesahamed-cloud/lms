import { strict as assert } from 'node:assert';
import { reshapeTablesForPhone } from '../src/modules/lessons/mobile-table-layout';

const wide = {
  type: 'table', heading: 'BP guidelines', accentColor: '#2563eb', span: 'full',
  headers: ['Guideline', 'Threshold', 'Other', 'Target'],
  rows: [
    ['2024 ESC', '>=140/90', 'Elevated', '120-129'],
    ['2023 ESH', '>=140/90', 'Optimal', '<140/90'],
    ['ACC/AHA', '>=130/80', '', '<130/80'],
  ],
};
const narrow = { type: 'table', heading: 'NICE', headers: ['Stage', 'Clinic', 'ABPM'], rows: [['1', 'a', 'b']] };
const short = { type: 'table', heading: 'Two rows', headers: ['Guideline', 'Threshold', 'Other', 'Target'], rows: [['A', '1', '2', '3'], ['B', '4', '5', '6']] };
const text = { heading: 'Text card', bullets: ['x'] };
const input = { pages: [{ sections: [text, wide, narrow, short] }] };
const frozen = JSON.stringify(input);

const out = reshapeTablesForPhone(input) as any;
const sections = out.pages[0].sections;
assert.equal(JSON.stringify(input), frozen, 'input must not be mutated');
assert.deepEqual(sections[0], text);
assert.equal(sections[1].heading, 'BP guidelines');
assert.deepEqual(sections[1].bullets, []);
assert.equal(sections[2].heading, '2024 ESC');
assert.deepEqual(sections[2].bullets, ['Threshold:', '→ >=140/90', 'Other:', '→ Elevated', 'Target:', '→ 120-129']);
assert.deepEqual(sections[4].bullets, ['Threshold:', '→ >=130/80', 'Target:', '→ <130/80'], 'empty cells are skipped');
assert.equal(sections[2].accentColor, '#2563eb');
assert.deepEqual(sections[5], narrow, 'narrow tables are untouched');
assert.equal(sections[6].type, 'table');
assert.deepEqual(sections[6].headers, ['Guideline', 'A', 'B']);
assert.deepEqual(sections[6].rows, [['Threshold', '1', '4'], ['Other', '2', '5'], ['Target', '3', '6']]);
assert.deepEqual(reshapeTablesForPhone({ sections: [wide] }) && (reshapeTablesForPhone({ sections: [wide] }) as any).sections.length, 4);
assert.equal(reshapeTablesForPhone(null), null);

// Markers must never reach plain-text headings; long cells split into short lines.
const marked = { type: 'table', heading: '**Bold** title', headers: ['**Guideline**', '**Threshold**', 'Plan', 'Note'], rows: [
  ['**2024 ESC**', 'Do this; then that. And more.', '==a; b==', 'x'],
  ['2023', 'one', 'two', 'three'],
  ['2022', 'one', 'two', 'three'],
] };
const m = (reshapeTablesForPhone({ sections: [marked] }) as any).sections;
assert.equal(m[0].heading, 'Bold title');
assert.equal(m[1].heading, '2024 ESC');
assert.deepEqual(m[1].bullets.slice(0, 4), ['Threshold:', '→ Do this', '→ then that.', '→ And more.']);
assert.deepEqual(m[1].bullets.slice(4, 6), ['Plan:', '→ ==a; b=='], 'a highlight is never cut in half');
assert.ok(!m[1].bullets.some((line: string) => line.includes('**')), 'no ** inside card lines');
assert.ok(m.every((card: any) => !JSON.stringify(card.heading).includes('*')), 'no markers in headings');
console.log('mobile table layout checks passed');
