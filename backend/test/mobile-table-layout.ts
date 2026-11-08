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
assert.deepEqual(sections[2].bullets, ['**Threshold:** >=140/90', '**Other:** Elevated', '**Target:** 120-129']);
assert.deepEqual(sections[4].bullets, ['**Threshold:** >=130/80', '**Target:** <130/80'], 'empty cells are skipped');
assert.equal(sections[2].accentColor, '#2563eb');
assert.deepEqual(sections[5], narrow, 'narrow tables are untouched');
assert.equal(sections[6].type, 'table');
assert.deepEqual(sections[6].headers, ['Guideline', 'A', 'B']);
assert.deepEqual(sections[6].rows, [['Threshold', '1', '4'], ['Other', '2', '5'], ['Target', '3', '6']]);
assert.deepEqual(reshapeTablesForPhone({ sections: [wide] }) && (reshapeTablesForPhone({ sections: [wide] }) as any).sections.length, 4);
assert.equal(reshapeTablesForPhone(null), null);
console.log('mobile table layout checks passed');
