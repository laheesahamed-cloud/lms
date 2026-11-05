import { MedicalText } from './MedicalText.jsx';

/**
 * "How to approach this question", shown the way the mobile app shows it
 * (take_quiz_page.dart `_ApproachFlow`) instead of as the raw stored text.
 *
 * The approach is stored as numbered lines, with the stem phrase each step is
 * about wrapped in quotes or bold markers:
 *   1. "A 62-year-old man" - the patient's age and sex increase the likelihood…
 * Printed as-is that reads as raw data: the "1." prefix, the quote marks and the
 * asterisks all show. Here each step becomes a numbered badge row, and the
 * quoted phrase is picked out (markers removed) in the accent colour.
 */

const BADGE_COLOURS = [
  'rgba(246, 217, 138, 0.55)',
  'rgba(169, 203, 238, 0.55)',
  'rgba(179, 221, 176, 0.55)',
  'rgba(239, 182, 205, 0.55)',
  'rgba(205, 188, 232, 0.55)',
  'rgba(169, 220, 224, 0.55)',
  'rgba(242, 179, 158, 0.55)',
  'rgba(243, 205, 160, 0.55)',
];

/** "1. …\n2. …" into its steps; the whole text as one step if it is not numbered. */
function splitApproachSteps(text) {
  const source = String(text || '');
  const markers = [...source.matchAll(/(?:^|\n)\s*\d+[.)]\s*/g)];
  if (!markers.length) {
    const trimmed = source.trim();
    return trimmed ? [trimmed] : [];
  }
  const steps = [];
  markers.forEach((marker, i) => {
    const start = marker.index + marker[0].length;
    const end = i + 1 < markers.length ? markers[i + 1].index : source.length;
    const step = source.slice(start, end).trim();
    if (step) steps.push(step);
  });
  return steps;
}

// The formats the model uses to wrap a quoted stem phrase, most specific first
// (same set as the app). The bare single-quote form must not sit between two
// letters, or the apostrophes in "patient's … doctor's" would match as a pair;
// JS lookbehind is avoided for older Safari, so that case captures the
// character before the quote instead.
const PHRASE_PATTERN = /\*\*["'](.+?)["']\*\*|\*\*([^*]+)\*\*|"(.+?)"|(^|[^A-Za-z0-9])'(.+?)'(?![A-Za-z0-9])/g;

/** Splits a step into plain and highlighted pieces. */
function splitStepPieces(step) {
  const pieces = [];
  let cursor = 0;
  for (const m of step.matchAll(PHRASE_PATTERN)) {
    const phrase = m[1] ?? m[2] ?? m[3] ?? m[5];
    if (!phrase || !phrase.trim()) continue;
    const lead = m[4] ? m[4].length : 0; // the character kept in front of a bare 'quote'
    const start = m.index + lead;
    if (start > cursor) pieces.push({ text: step.slice(cursor, start), phrase: false });
    pieces.push({ text: phrase, phrase: true });
    cursor = m.index + m[0].length;
  }
  if (cursor < step.length) pieces.push({ text: step.slice(cursor), phrase: false });
  return pieces;
}

function StepText({ step }) {
  return (
    <p>
      {splitStepPieces(step).map((piece, index) => (piece.phrase ? (
        <span
          key={index}
          className="font-extrabold text-brand-primary underline decoration-brand-primary/50 decoration-[1.5px] underline-offset-[3px]"
        >
          <MedicalText text={piece.text} />
        </span>
      ) : (
        <MedicalText key={index} text={piece.text} />
      )))}
    </p>
  );
}

export function ApproachSteps({ text }) {
  const steps = splitApproachSteps(text);
  if (!steps.length) return null;
  if (steps.length < 2) return <StepText step={steps[0]} />;

  return (
    <ol className="m-0 grid list-none gap-3 p-0">
      {steps.map((step, index) => (
        <li key={`${index}-${step.slice(0, 16)}`} className="grid grid-cols-[26px_minmax(0,1fr)] items-start gap-2.5">
          <span
            className="mt-[3px] grid size-[26px] place-items-center rounded-full text-[12.5px] font-extrabold text-ink-strong"
            style={{ background: BADGE_COLOURS[index % BADGE_COLOURS.length] }}
            aria-hidden="true"
          >
            {index + 1}
          </span>
          <StepText step={step} />
        </li>
      ))}
    </ol>
  );
}
