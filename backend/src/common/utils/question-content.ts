// OPTIMIZE 10.43: a question's options and theory recap live IN the question
// row (`questions.options_json`, `questions.recap_json`) instead of the old
// `question_options` / `question_theory_recaps` tables.
//
// The JSON keeps the old column names, so readers use the parsed rows exactly
// like the rows they used to SELECT:
//   options_json = [{"id":64331,"option_label":"A","option_text":"…","is_correct":1,"why_incorrect":null}, …]
//   recap_json   = {"id":12,"concept_name":"…","hierarchy_course":"…", …, "etiology":"[\"…\"]", …}
// Option ids never change: existing ones were kept when the data moved, and a
// new option gets 10,000,000 + question_id × 10 + label index (A=0 … E=4) —
// unique, and the same label keeps the same id across edits, so past exam
// answers (stored with each recent result) and saved practice sets still match.

export type QuestionOptionRow = {
  id: number;
  question_id: number;
  option_label: string;
  option_text: string;
  is_correct: number;
  why_incorrect: string | null;
};

export type QuestionRecapRow = {
  id: number;
  question_id: number;
  concept_name: string | null;
  hierarchy_course: string | null;
  hierarchy_subject: string | null;
  hierarchy_topic: string | null;
  hierarchy_lesson: string | null;
  etiology: string | null;
  pathophysiology: string | null;
  clinical_features: string | null;
  investigations: string | null;
  treatment: string | null;
  key_points: string | null;
  mnemonic: string | null;
  generated_by: 'ai' | 'manual';
  reviewed_status: 'pending' | 'approved' | 'rejected';
  created_at: string | null;
  updated_at: string | null;
};

const LABELS = ['A', 'B', 'C', 'D', 'E'];

export const RECAP_KEYS = [
  'concept_name', 'hierarchy_course', 'hierarchy_subject', 'hierarchy_topic', 'hierarchy_lesson',
  'etiology', 'pathophysiology', 'clinical_features', 'investigations', 'treatment', 'key_points',
  'mnemonic', 'generated_by', 'reviewed_status',
] as const;

export function newOptionId(questionId: number, label: string): number {
  const index = Math.max(0, LABELS.indexOf(String(label).toUpperCase()));
  return 10_000_000 + Number(questionId) * 10 + index;
}

/** Parsed option rows of one question, in label order (A–E). */
export function optionsOf(questionId: number, json: unknown): QuestionOptionRow[] {
  let list: unknown = json;
  if (typeof json === 'string') {
    try { list = JSON.parse(json); } catch { list = []; }
  }
  if (!Array.isArray(list)) return [];
  return list
    .filter((o): o is Record<string, unknown> => !!o && typeof o === 'object')
    .map((o) => ({
      id: Number(o.id),
      question_id: Number(questionId),
      option_label: String(o.option_label ?? ''),
      option_text: String(o.option_text ?? ''),
      is_correct: Number(o.is_correct) === 1 ? 1 : 0,
      why_incorrect: o.why_incorrect == null ? null : String(o.why_incorrect),
    }))
    .sort((a, b) => a.option_label.localeCompare(b.option_label) || a.id - b.id);
}

/**
 * The JSON to store for a question's options. Ids: an existing option with the
 * same label keeps its id; otherwise the stable new id.
 */
export function optionsJsonFor(
  questionId: number,
  options: Array<{ optionLabel: string; optionText: string; isCorrect: number; whyIncorrect: string | null }>,
  previousJson?: unknown,
): string {
  const previous = new Map(optionsOf(questionId, previousJson).map((o) => [o.option_label, o.id]));
  const rows = options
    .map((o) => {
      const label = String(o.optionLabel || '').trim().toUpperCase();
      return {
        id: previous.get(label) ?? newOptionId(questionId, label),
        option_label: label,
        option_text: o.optionText,
        is_correct: Number(o.isCorrect) === 1 ? 1 : 0,
        why_incorrect: o.whyIncorrect == null || o.whyIncorrect === '' ? null : o.whyIncorrect,
      };
    })
    .sort((a, b) => a.option_label.localeCompare(b.option_label));
  return JSON.stringify(rows);
}

/** Parsed recap of one question, or null. */
export function recapOf(questionId: number, json: unknown): QuestionRecapRow | null {
  let obj: unknown = json;
  if (typeof json === 'string') {
    try { obj = JSON.parse(json); } catch { obj = null; }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  return { ...(obj as QuestionRecapRow), question_id: Number(questionId) };
}

// ── SQL pieces (options are at most 5: labels A–E) ─────────────────────────

const each = (fn: (path: string) => string) => [0, 1, 2, 3, 4].map((i) => fn(`$[${i}]`));

/** SQL: number of options of the question in `alias`. */
export function sqlOptionCount(alias = 'q'): string {
  return `COALESCE(JSON_LENGTH(${alias}.options_json), 0)`;
}

/** SQL: number of correct options of the question in `alias`. */
export function sqlCorrectCount(alias = 'q'): string {
  return '(' + each((p) => `COALESCE(JSON_VALUE(${alias}.options_json, '${p}.is_correct') = 1, 0)`).join(' + ') + ')';
}

/** SQL: true when some WRONG option has no "why incorrect" text (alias '' = no table prefix). */
export function sqlWhyMissing(alias = 'q'): string {
  const col = alias ? `${alias}.options_json` : 'options_json';
  return '(' + each((p) =>
    `(JSON_VALUE(${col}, '${p}.is_correct') = 0 AND COALESCE(TRIM(JSON_VALUE(${col}, '${p}.why_incorrect')), '') = '')`,
  ).join(' OR ') + ')';
}

// ── "Missing content" flags (OPTIMIZE 10.47) ───────────────────────────────
// `questions.missing_mask` is a STORED generated column holding which pieces a
// question still lacks, kept up to date by MySQL on every write, with an index
// on (missing_mask, id): the admin "Missing content" filters read the index
// instead of parsing every question's options and recap.

export const MISSING_BITS = { explanation: 1, why_incorrect: 2, approach: 4, theory: 8 } as const;
export type MissingKey = keyof typeof MISSING_BITS | 'any';

/** The generated column's expression (no table prefix). */
export function sqlMissingMaskExpression(): string {
  return [
    `(CASE WHEN explanation IS NULL OR TRIM(explanation) = '' THEN ${MISSING_BITS.explanation} ELSE 0 END)`,
    `(CASE WHEN ${sqlWhyMissing('')} THEN ${MISSING_BITS.why_incorrect} ELSE 0 END)`,
    `(CASE WHEN question_approach IS NULL OR TRIM(question_approach) = '' THEN ${MISSING_BITS.approach} ELSE 0 END)`,
    `(CASE WHEN recap_json IS NULL THEN ${MISSING_BITS.theory} ELSE 0 END)`,
  ].join(' | ');
}

/**
 * SQL filter for one "missing" choice, as an index range: the masks that
 * contain the bit are listed (IN), so MySQL reads only matching index entries.
 */
export function sqlMissingFilter(alias: string, key: MissingKey): string {
  if (key === 'any') return `${alias}.missing_mask > 0`;
  const bit = MISSING_BITS[key];
  const masks = Array.from({ length: 16 }, (_, m) => m).filter((m) => (m & bit) !== 0);
  return `${alias}.missing_mask IN (${masks.join(', ')})`;
}
