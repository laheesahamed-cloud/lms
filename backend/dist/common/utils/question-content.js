"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MISSING_BITS = exports.RECAP_KEYS = void 0;
exports.newOptionId = newOptionId;
exports.optionsOf = optionsOf;
exports.optionsJsonFor = optionsJsonFor;
exports.recapOf = recapOf;
exports.sqlOptionCount = sqlOptionCount;
exports.sqlCorrectCount = sqlCorrectCount;
exports.sqlWhyMissing = sqlWhyMissing;
exports.sqlMissingMaskExpression = sqlMissingMaskExpression;
exports.sqlMissingFilter = sqlMissingFilter;
const LABELS = ['A', 'B', 'C', 'D', 'E'];
exports.RECAP_KEYS = [
    'concept_name', 'hierarchy_course', 'hierarchy_subject', 'hierarchy_topic', 'hierarchy_lesson',
    'etiology', 'pathophysiology', 'clinical_features', 'investigations', 'treatment', 'key_points',
    'mnemonic', 'generated_by', 'reviewed_status',
];
function newOptionId(questionId, label) {
    const index = Math.max(0, LABELS.indexOf(String(label).toUpperCase()));
    return 10_000_000 + Number(questionId) * 10 + index;
}
function optionsOf(questionId, json) {
    let list = json;
    if (typeof json === 'string') {
        try {
            list = JSON.parse(json);
        }
        catch {
            list = [];
        }
    }
    if (!Array.isArray(list))
        return [];
    return list
        .filter((o) => !!o && typeof o === 'object')
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
function optionsJsonFor(questionId, options, previousJson) {
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
function recapOf(questionId, json) {
    let obj = json;
    if (typeof json === 'string') {
        try {
            obj = JSON.parse(json);
        }
        catch {
            obj = null;
        }
    }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj))
        return null;
    return { ...obj, question_id: Number(questionId) };
}
const each = (fn) => [0, 1, 2, 3, 4].map((i) => fn(`$[${i}]`));
function sqlOptionCount(alias = 'q') {
    return `COALESCE(JSON_LENGTH(${alias}.options_json), 0)`;
}
function sqlCorrectCount(alias = 'q') {
    return '(' + each((p) => `COALESCE(JSON_VALUE(${alias}.options_json, '${p}.is_correct') = 1, 0)`).join(' + ') + ')';
}
function sqlWhyMissing(alias = 'q') {
    const col = alias ? `${alias}.options_json` : 'options_json';
    return '(' + each((p) => `(JSON_VALUE(${col}, '${p}.is_correct') = 0 AND COALESCE(TRIM(JSON_VALUE(${col}, '${p}.why_incorrect')), '') = '')`).join(' OR ') + ')';
}
exports.MISSING_BITS = { explanation: 1, why_incorrect: 2, approach: 4, theory: 8 };
function sqlMissingMaskExpression() {
    return [
        `(CASE WHEN explanation IS NULL OR TRIM(explanation) = '' THEN ${exports.MISSING_BITS.explanation} ELSE 0 END)`,
        `(CASE WHEN ${sqlWhyMissing('')} THEN ${exports.MISSING_BITS.why_incorrect} ELSE 0 END)`,
        `(CASE WHEN question_approach IS NULL OR TRIM(question_approach) = '' THEN ${exports.MISSING_BITS.approach} ELSE 0 END)`,
        `(CASE WHEN recap_json IS NULL THEN ${exports.MISSING_BITS.theory} ELSE 0 END)`,
    ].join(' | ');
}
function sqlMissingFilter(alias, key) {
    if (key === 'any')
        return `${alias}.missing_mask > 0`;
    const bit = exports.MISSING_BITS[key];
    const masks = Array.from({ length: 16 }, (_, m) => m).filter((m) => (m & bit) !== 0);
    return `${alias}.missing_mask IN (${masks.join(', ')})`;
}
//# sourceMappingURL=question-content.js.map