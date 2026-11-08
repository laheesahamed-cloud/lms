import { strict as assert } from 'node:assert';
import { calmTextForPhone, splitLongBullet } from '../src/modules/lessons/mobile-text-layout';

// Short, parent and sub lines are never touched.
assert.deepEqual(splitLongBullet('Short bullet.'), ['Short bullet.']);
assert.deepEqual(splitLongBullet('Causes:'), ['Causes:']);
const longSub = '→ ' + 'word '.repeat(40) + '. Another sentence here.';
assert.deepEqual(splitLongBullet(longSub), [longSub]);

// A long bullet splits at sentence ends; the rest become sub-lines.
const long = 'Hypertension is a leading modifiable risk factor for stroke, myocardial infarction and renal disease worldwide. It is also a major driver of heart failure. Screening is recommended in every adult.';
assert.deepEqual(splitLongBullet(long), [
  'Hypertension is a leading modifiable risk factor for stroke, myocardial infarction and renal disease worldwide.',
  '→ It is also a major driver of heart failure.',
  '→ Screening is recommended in every adult.',
]);

// A highlight is never cut in half, so the bullet is left whole.
const hl = 'This line has a long ==highlighted phrase; with a semicolon inside it== and it keeps going well past the limit for a short line. Second sentence here.';
assert.deepEqual(splitLongBullet(hl).length, 1);

// A card with many lines splits into smaller cards; subs stay under their parent.
const bullets = Array.from({ length: 6 }, (_, i) => [`Point ${i}`, `→ detail ${i}a`, `→ detail ${i}b`]).flat();
const card = { heading: '7. Assessment', bullets, callout: 'Wrap-up', mnemonic: 'ABC', sticky_note: 'note', sectionImage: { src: 'x' }, span: 'full' };
const table = { type: 'table', heading: 'T', headers: ['a'], rows: [['1']] };
const out = (calmTextForPhone({ pages: [{ sections: [card, table] }] }) as any).pages[0].sections;
assert.ok(out.length > 2, 'big card was split');
assert.equal(out[0].heading, '7. Assessment');
assert.equal(out[1].heading, '7. Assessment (continued)');
assert.ok(out[0].sectionImage && !out[1].sectionImage, 'image stays on the first card');
assert.ok(!out[0].callout && out.find((s: any) => s.callout === 'Wrap-up'), 'callout moves to the last card');
const lastTextCard = out[out.length - 2];
assert.equal(lastTextCard.callout, 'Wrap-up');
assert.deepEqual(out[out.length - 1], table, 'tables are untouched');
for (const section of out.slice(0, -1)) {
  assert.ok(section.bullets.length <= 8 || section.bullets.length <= 11, 'cards stay small');
  assert.ok(!section.bullets[0].startsWith('→'), 'a card never opens with a sub-line');
}
assert.equal(out.slice(0, -1).flatMap((s: any) => s.bullets).length, bullets.length, 'no line lost or added by the split');
assert.equal(calmTextForPhone(null), null);
console.log('mobile text layout checks passed');
