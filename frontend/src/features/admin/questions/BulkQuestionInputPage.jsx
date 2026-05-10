import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createQuestion, fetchQuestionsMeta, updateQuestion } from '../../../api/questions.api.js';
import {
  deleteTheoryRecap,
  fetchTheoryRecap,
  generateTheoryRecap,
  regenerateTheoryRecap,
  upsertTheoryRecap,
} from '../../../api/theoryRecap.api.js';
import { getErrorMessage } from '../../../api/client.js';
import {
  generateQuestionExplanation,
  generateWhyIncorrectExplanations,
} from '../../../api/ai.api.js';
import { AppHeader } from '../../../components/layout/AppHeader.jsx';
import { TheoryRecapAdminSection } from './QuestionsPage.jsx';
import { cx, ui } from '../../../styles/tailwindClasses.js';

const optionLabels = ['A', 'B', 'C', 'D', 'E'];
const draftStorageKey = 'lms.bulk-question-draft.v2';

const bq = {
  shell: 'grid gap-5',
  panel: 'grid gap-4 p-[22px]',
  resume: 'flex items-start justify-between gap-4 p-[22px] max-[720px]:flex-col max-[720px]:items-stretch',
  modeToggle: 'inline-flex w-fit rounded-lg border border-line-soft bg-surface-2 p-1 max-[720px]:grid max-[720px]:w-full max-[720px]:grid-cols-2',
  modeButton: 'min-h-9 rounded-md px-3.5 text-sm font-extrabold shadow-none max-[720px]:min-w-0',
  textareaLabel: 'grid gap-2 text-sm font-bold text-ink-strong',
  textarea: 'min-h-[320px] w-full resize-y rounded-lg border border-line-soft bg-surface-1 p-3 text-sm leading-relaxed text-ink-strong',
  helpGrid: 'grid grid-cols-2 gap-3 max-[1080px]:grid-cols-1',
  inlineNote: 'rounded-lg border border-line-soft bg-surface-2 px-4 py-3.5 text-[12.5px] text-ink-soft',
  gridTwo: 'grid grid-cols-2 gap-3.5 max-[900px]:grid-cols-1',
  gridFour: 'grid grid-cols-4 gap-3.5 max-[900px]:grid-cols-1',
  checkbox: `${ui.checkboxRow} min-h-full rounded-lg border border-line-soft bg-surface-2 px-4 py-3.5 [&>span]:grid [&>span]:gap-1`,
  fieldNote: 'mt-1.5 block text-[11.5px] leading-[1.45] text-ink-soft',
  progressCard: 'grid gap-1 rounded-lg border border-brand-primary/20 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--surface-2)_90%,var(--color-primary-light)),var(--surface-1))] px-4 py-3.5 dark:bg-[linear-gradient(180deg,color-mix(in_srgb,var(--surface-2)_90%,var(--color-primary-light)),var(--surface-1))]',
  workspace: 'grid gap-4 p-[22px]',
  aiPanel: 'mb-4 grid gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--color-primary)_18%,var(--line-soft))] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-primary)_5%,transparent),transparent_54%),var(--surface-2)] p-3.5',
  aiHead: 'flex items-start justify-between gap-3.5 max-[720px]:flex-col',
  aiOptions: 'grid grid-cols-4 gap-2.5 max-[1080px]:grid-cols-2 max-[720px]:grid-cols-1',
  aiOption: `${ui.checkboxRow} items-start rounded-xl border border-line-soft bg-surface-1 p-2.5`,
  aiProgress: 'grid gap-2.5',
  aiTop: 'flex items-center justify-between gap-3.5 text-xs text-ink-soft max-[720px]:flex-col max-[720px]:items-start',
  aiBar: 'h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--color-primary)_10%,var(--surface-1))]',
  aiStatusList: 'grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2',
  aiStatusItem: 'grid min-h-[38px] grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-xl border border-line-soft bg-surface-1 px-2.5 py-2 text-left text-ink-medium shadow-none',
  aiIcon: 'grid size-5 place-items-center rounded-full bg-surface-2 text-xs font-black text-ink-soft',
  layout: 'grid grid-cols-[minmax(260px,0.34fr)_minmax(0,1fr)] gap-5 max-[1080px]:grid-cols-1',
  sidebar: 'sticky top-[84px] grid content-start gap-3 rounded-xl border border-line-soft bg-surface-2 p-3.5 max-[1080px]:static',
  sidebarHead: 'flex items-center justify-between gap-2 rounded-lg border border-line-soft bg-surface-1 px-4 py-3',
  queueTools: 'grid gap-3 rounded-lg border border-line-soft bg-surface-1 px-[18px] py-4',
  queueList: 'flex max-h-[min(68vh,860px)] flex-col gap-2.5 overflow-y-auto pr-1 max-[1080px]:max-h-none',
  queueItem: 'grid w-full gap-2.5 rounded-lg border border-line-soft bg-surface-1 p-4 text-left shadow-xs transition hover:-translate-y-px hover:border-brand-primary/30 hover:shadow-md',
  queueItemActive: 'border-brand-primary/50 bg-[color-mix(in_srgb,var(--surface-1)_92%,var(--color-primary-light))] shadow-[var(--shadow-glow)]',
  queueTop: 'flex items-center justify-between gap-2.5',
  status: 'inline-flex min-h-7 items-center justify-center rounded-full border border-line-soft bg-surface-2 px-2.5 text-[11px] font-extrabold tracking-[0.02em] text-ink-soft',
  editor: 'min-w-0',
  card: 'grid gap-4 rounded-xl border border-brand-primary/25 bg-surface-1 p-6 shadow-md max-[720px]:p-[18px]',
  cardHead: 'flex flex-wrap items-start justify-between gap-4 max-[720px]:flex-col max-[720px]:items-stretch',
  eyebrow: 'inline-flex min-h-7 items-center rounded-full bg-[color-mix(in_srgb,var(--surface-2)_88%,var(--color-primary-light))] px-2.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-brand-primary',
  subsection: 'grid gap-3 rounded-lg border border-line-soft bg-[color-mix(in_srgb,var(--surface-2)_92%,transparent)] p-[18px]',
  note: 'grid gap-2 rounded-lg border px-4 py-3.5 leading-normal break-words',
  textareaSmall: 'w-full resize-y break-words leading-[1.65]',
  textareaQuestion: 'min-h-[120px]',
  textareaOption: 'min-h-[60px]',
  textareaExplanation: 'min-h-[120px]',
  optionCard: 'rounded-lg border border-line-soft bg-[color-mix(in_srgb,var(--surface-1)_90%,var(--surface-2))] p-4',
  tfToggle: 'inline-flex flex-wrap items-center gap-3',
  recap: 'mt-3.5',
  recapUnsaved: 'mt-3.5 flex items-center gap-2 rounded-lg border border-dashed border-line-soft bg-surface-1 px-3.5 py-3 text-[13px] text-ink-muted',
};

function queueStateClass(status = 'Needs Review') {
  const normalized = String(status || 'Needs Review').toLowerCase();
  return cx(
    bq.status,
    normalized === 'saved' && 'border-brand-success/25 bg-[var(--color-success-light)] text-brand-success',
    normalized === 'ready' && 'border-brand-primary/20 bg-brand-primary-light text-brand-primary',
    normalized === 'needs review' && 'border-brand-warning/25 bg-[var(--color-warning-light)] text-brand-warning',
    normalized === 'missing answer' && 'border-brand-error/25 bg-brand-error/10 text-brand-error'
  );
}
export const sampleJsonFormat = JSON.stringify([
  {
    question_number: 1,
    question_type: 'sba',
    question: 'A patient presents with exertional chest pain. What is the best initial diagnosis?',
    options: [
      { label: 'A', text: 'Pericarditis', is_correct: false, why_incorrect: 'Pain is typically pleuritic and positional.' },
      { label: 'B', text: 'Stable angina', is_correct: true, why_incorrect: null },
      { label: 'C', text: 'Pneumothorax', is_correct: false, why_incorrect: 'Usually causes acute pleuritic pain with breathlessness.' },
      { label: 'D', text: 'GORD', is_correct: false, why_incorrect: 'Symptoms are usually burning and related to meals or posture.' },
      { label: 'E', text: 'Costochondritis', is_correct: false, why_incorrect: 'Pain is usually reproducible with chest wall palpation.' },
    ],
    correct_answer: 'B',
    explanation: 'Exertional chest pain relieved by rest is typical of stable angina.',
  },
  {
    question_number: 2,
    question_type: 'true_false',
    topic: 'Epilepsy',
    question: 'Regarding epilepsy, mark each statement as true or false.',
    statements: [
      { label: 'a', text: 'A diagnosis of epilepsy can affect driving eligibility.', answer: 'True', explanation: 'Driving restrictions commonly apply after epileptic seizures and depend on local rules.' },
      { label: 'b', text: 'A normal EEG excludes epilepsy.', answer: 'False', explanation: 'EEG can be normal between seizures, so epilepsy remains a clinical diagnosis.' },
      { label: 'c', text: 'Epilepsy is defined by a recurrent tendency to seizures.', answer: 'True', explanation: 'Epilepsy implies an enduring tendency to recurrent unprovoked seizures.' },
      { label: 'd', text: 'All first seizures require lifelong antiseizure medication.', answer: 'False', explanation: 'Treatment depends on recurrence risk, cause, clinical context, and specialist assessment.' },
      { label: 'e', text: 'History from a witness can help classify the event.', answer: 'True', explanation: 'Witness history helps distinguish seizure type and mimics such as syncope.' },
    ],
    explanation: 'Epilepsy diagnosis depends on clinical history, recurrence risk, and supporting tests; a normal EEG does not exclude it.',
  },
], null, 2);

function buildOptions() {
  return optionLabels.map((label) => ({
    optionLabel: label,
    optionText: '',
    isCorrect: 0,
    optionExplanation: '',
    whyIncorrect: '',
  }));
}

function createQuestionId() {
  return `bulk-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function buildGlobalDefaults() {
  return {
    courseId: '',
    subjectId: '',
    topicId: '',
    lessonId: '',
    category: 'mock',
    questionType: 'sba',
    paperId: '',
    keywordsText: '',
  };
}

export function createEmptyQuestion(seed = {}) {
  return {
    clientId: createQuestionId(),
    savedId: null,
    lastSavedHash: '',
    questionText: '',
    questionType: '',
    category: '',
    paperId: '',
    keywordsText: '',
    explanation: '',
    status: 'active',
    topicLabel: '',
    courseId: '',
    subjectId: '',
    topicId: '',
    lessonId: '',
    options: buildOptions(),
    parserConfidence: 'high',
    parserWarnings: [],
    autoDetectedAnswer: '',
    sourceSnippet: '',
    reviewed: false,
    ...seed,
  };
}

export function normalizeWhitespace(value) {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function stripQuestionPrefix(line) {
  return line
    .replace(/^\s*(?:question|ques|q)\s*\d+\s*[\.\):\-]?\s*/i, '')
    .replace(/^\s*\d+\s*[\.\):\-]\s*/i, '')
    .trim();
}

function detectOptionLine(line) {
  return String(line || '').match(/^\s*([A-Ea-e])\s*[\.\)\-:]\s*(.*?)\s*$/);
}

function detectAnswerLine(line) {
  return String(line || '').match(/^\s*(?:correct\s*answer|answer)\s*[:\-]?\s*([A-Ea-e]|true|false)\b/i);
}

function detectExplanationLine(line) {
  return String(line || '').match(/^\s*(?:answer\s+explanation|explanation)\s*[:\-]?\s*(.*)$/i);
}

function detectWhyIncorrectHeader(line) {
  return String(line || '').match(/^\s*(?:why\s+(?:other\s+answers\s+are\s+)?incorrect|why\s+incorrect|incorrect\s+answers?)\s*[:\-]?\s*(.*)$/i);
}

function detectWhyIncorrectLine(line) {
  return String(line || '').match(/^\s*([A-Ea-e])\s*[:\-]\s*(.*?)\s*$/);
}

function detectQuestionHeader(line) {
  const normalized = normalizeWhitespace(line);
  if (!normalized) return null;
  const stripped = stripQuestionPrefix(normalized);
  if (stripped !== normalized) return stripped;
  return null;
}

function looksLikeQuestionStart(line) {
  const normalized = normalizeWhitespace(line);
  if (!normalized) return false;
  if (detectOptionLine(normalized) || detectAnswerLine(normalized) || detectExplanationLine(normalized)) {
    return false;
  }
  if (detectQuestionHeader(normalized)) return true;
  if (/^[A-Z][^:]{8,}[?]$/.test(normalized)) return true;
  if (/^[A-Z][a-z].{10,}[?]$/.test(normalized)) return true;
  return false;
}

function looksLikeContinuation(line) {
  const normalized = normalizeWhitespace(line);
  if (!normalized) return false;
  return /^[a-z(]/.test(normalized) || normalized.length < 18;
}

function mapAnswerTokenToLabel(token) {
  const normalized = String(token || '').trim().toUpperCase();
  if (optionLabels.includes(normalized)) return normalized;
  return '';
}

function mergeKeywords(globalKeywords, localKeywords) {
  return Array.from(
    new Set(
      `${globalKeywords || ''},${localKeywords || ''}`
        .split(',')
        .map((keyword) => keyword.trim())
        .filter(Boolean)
    )
  ).join(', ');
}

function stripJsonArtifacts(value) {
  return String(value || '')
    .replace(/\[span_[^\]]+\]\((?:start_span|end_span)\)/g, '')
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .replace(/\r/g, '');
}

function extractJsonPayload(value) {
  const cleaned = stripJsonArtifacts(value).trim();
  if (!cleaned) {
    return '';
  }

  if ((cleaned.startsWith('[') && cleaned.endsWith(']')) || (cleaned.startsWith('{') && cleaned.endsWith('}'))) {
    return cleaned;
  }

  const arrayStart = cleaned.indexOf('[');
  const arrayEnd = cleaned.lastIndexOf(']');
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    return cleaned.slice(arrayStart, arrayEnd + 1).trim();
  }

  const objectStart = cleaned.indexOf('{');
  const objectEnd = cleaned.lastIndexOf('}');
  if (objectStart >= 0 && objectEnd > objectStart) {
    return cleaned.slice(objectStart, objectEnd + 1).trim();
  }

  return cleaned;
}

function parseBooleanAnswerToken(value) {
  const normalized = normalizeWhitespace(value).toLowerCase();
  if (!normalized) return null;
  if (normalized.startsWith('true')) return 1;
  if (normalized.startsWith('false')) return 0;
  return null;
}

function normalizeJsonQuestionType(value) {
  const normalized = normalizeWhitespace(value).toLowerCase();
  if (!normalized) return '';
  if (normalized === 'sba' || normalized === 'single best answer') return 'sba';
  if (
    normalized === 'true_false'
    || normalized === 'true false'
    || normalized === 'truefalse'
    || normalized === 'tf'
  ) {
    return 'true_false';
  }
  return normalized;
}

function normalizeLabeledEntries(value, answerMap = null) {
  if (Array.isArray(value)) {
    return value;
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  return Object.entries(value).map(([label, entry]) => {
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      return {
        label,
        ...entry,
        answer: entry.answer ?? entry.isCorrect ?? entry.correct ?? answerMap?.[label],
      };
    }

    return {
      label,
      text: entry,
      answer: answerMap?.[label],
    };
  });
}

function buildCombinedExplanation(question) {
  const baseExplanation = normalizeWhitespace(question.explanation);
  return baseExplanation;
}

function buildOptionExplanationSummary(options) {
  const lines = (options || [])
    .map((option) => {
      const explanation = normalizeWhitespace(option.whyIncorrect || option.optionExplanation);
      if (!explanation) return '';
      return `${option.optionLabel}. ${explanation}`;
    })
    .filter(Boolean);

  return lines.join('\n');
}

export function parseJsonQuestions(rawInput, defaults) {
  const cleaned = extractJsonPayload(rawInput);
  if (!cleaned) {
    return [];
  }

  let parsedRoot;
  try {
    parsedRoot = JSON.parse(cleaned);
  } catch (error) {
    throw new Error('This JSON could not be parsed. Check commas, quotes, and any extra pasted markup.');
  }

  const records = Array.isArray(parsedRoot)
    ? parsedRoot
    : Array.isArray(parsedRoot?.questions)
      ? parsedRoot.questions
      : Array.isArray(parsedRoot?.items)
        ? parsedRoot.items
        : parsedRoot && typeof parsedRoot === 'object'
          ? [parsedRoot]
          : [];

  return records.map((item, index) => {
    const source = item && typeof item === 'object' ? item : {};
    const statements = normalizeLabeledEntries(source.statements, source.answers);
    const rawOptions = normalizeLabeledEntries(source.options);
    const explicitType = normalizeJsonQuestionType(source.question_type || source.questionType || source.type);
    const isTrueFalse = explicitType === 'true_false'
      || (statements.length > 0 && rawOptions.length === 0);
    const warnings = [];

    let questionType = isTrueFalse ? 'true_false' : 'sba';
    let options = buildOptions();

    if (questionType === 'true_false') {
      if (!statements.length) {
        warnings.push('No statements were found in this JSON question.');
      }
      if (statements.length !== 5) {
        warnings.push('True / False JSON usually needs 5 statements.');
      }

      options = buildOptions().map((option, optionIndex) => {
        const matchingStatement = statements.find((statement) => (
          String(statement?.label || '').trim().toUpperCase() === option.optionLabel
        )) || statements[optionIndex] || {};

        const answerValue = parseBooleanAnswerToken(matchingStatement.answer);
        if (matchingStatement.answer != null && answerValue == null) {
          warnings.push(`Statement ${option.optionLabel} has an answer value that is not clearly True or False.`);
        }

        return {
          optionLabel: option.optionLabel,
          optionText: normalizeWhitespace(matchingStatement.text || ''),
          isCorrect: answerValue == null ? 0 : answerValue,
          optionExplanation: normalizeWhitespace(matchingStatement.explanation || ''),
          whyIncorrect: normalizeWhitespace(matchingStatement.why_incorrect || matchingStatement.whyIncorrect || matchingStatement.explanation || ''),
        };
      });

      if (options.some((option) => !option.optionText)) {
        warnings.push('One or more statement texts are missing and need review.');
      }
    } else {
      const correctAnswerLabel = mapAnswerTokenToLabel(
        source.correct_answer ||
        source.correctAnswer ||
        source.answer ||
        ''
      );
      if (!rawOptions.length) {
        warnings.push('No SBA options were found in this JSON question.');
      }

      options = buildOptions().map((option, optionIndex) => {
        const matchingOption = rawOptions.find((entry) => (
          String(entry?.label || entry?.optionLabel || '').trim().toUpperCase() === option.optionLabel
        )) || rawOptions[optionIndex] || source[`option_${option.optionLabel.toLowerCase()}`] || {};

        const booleanCorrect = parseBooleanAnswerToken(
          matchingOption.isCorrect ?? matchingOption.correct ?? matchingOption.answer
        );
        const explicitCorrect = Number(matchingOption.isCorrect) === 1 ? 1 : null;
        const inferredCorrect = explicitCorrect ?? booleanCorrect ?? (correctAnswerLabel === option.optionLabel ? 1 : 0);
        const optionText = typeof matchingOption === 'string'
          ? matchingOption
          : matchingOption.text || matchingOption.optionText || source[`option_${option.optionLabel.toLowerCase()}_text`] || '';

        return {
          optionLabel: option.optionLabel,
          optionText: normalizeWhitespace(optionText),
          isCorrect: inferredCorrect === 1 ? 1 : 0,
          optionExplanation: normalizeWhitespace(matchingOption.explanation || ''),
          whyIncorrect: normalizeWhitespace(matchingOption.why_incorrect || matchingOption.whyIncorrect || matchingOption.explanation || ''),
        };
      });

      const filledOptions = options.filter((option) => option.optionText);
      if (filledOptions.length < 2) {
        warnings.push('SBA JSON needs at least 2 answer options.');
      }
      if (!options.some((option) => Number(option.isCorrect) === 1)) {
        warnings.push('Correct SBA answer was not detected automatically.');
      }
    }

    const questionText = normalizeWhitespace(
      source.question_text ||
      source.question ||
      source.scenario ||
      source.stem ||
      source.topic ||
      source.title ||
      `Question ${source.question_number || index + 1}`
    );

    const topLevelExplanation = normalizeWhitespace(
      source.explanation || source.answer_explanation || source.answerExplanation || ''
    );
    const optionExplanationSummary = buildOptionExplanationSummary(options);

    return createEmptyQuestion({
      questionText,
      questionType,
      category: defaults.category || 'mock',
      paperId: defaults.paperId || '',
      keywordsText: normalizeWhitespace(
        Array.isArray(source.keywords)
          ? source.keywords.join(', ')
          : source.keywordsText || source.tags || ''
      ),
      explanation: topLevelExplanation || optionExplanationSummary,
      options,
      parserConfidence: warnings.length ? 'medium' : 'high',
      parserWarnings: warnings,
      autoDetectedAnswer: questionType === 'true_false'
        ? (options.every((option) => option.optionText) ? 'JSON answer map loaded' : '')
        : (options.find((option) => Number(option.isCorrect) === 1)?.optionLabel || ''),
      sourceSnippet: JSON.stringify(source, null, 2),
      topicLabel: normalizeWhitespace(source.topic || ''),
      reviewed: false,
    });
  });
}

function buildHierarchyCollections(meta, hierarchy) {
  const visibleSubjects = meta.subjects.filter((subject) => String(subject.courseId) === String(hierarchy.courseId || ''));
  const visibleTopics = meta.topics.filter((topic) => String(topic.subjectId) === String(hierarchy.subjectId || ''));
  const visibleLessons = meta.lessons.filter(
    (lesson) =>
      String(lesson.subjectId) === String(hierarchy.subjectId || '') &&
      (!hierarchy.topicId || String(lesson.topicId || '') === String(hierarchy.topicId))
  );

  return { visibleSubjects, visibleTopics, visibleLessons };
}

export function parseRawQuestions(rawInput, defaults) {
  const normalizedInput = String(rawInput || '')
    .replace(/\r/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ');
  const lines = normalizedInput.split('\n');
  const parsed = [];

  let current = {
    questionLines: [],
    options: new Map(),
    whyIncorrect: new Map(),
    explanationLines: [],
    answerLabel: '',
    warnings: [],
    sourceLines: [],
    mode: 'stem',
    lastOptionLabel: '',
  };

  function resetCurrent() {
    current = {
      questionLines: [],
      options: new Map(),
      whyIncorrect: new Map(),
      explanationLines: [],
      answerLabel: '',
      warnings: [],
      sourceLines: [],
      mode: 'stem',
      lastOptionLabel: '',
    };
  }

  function finalizeCurrent() {
    const questionText = normalizeWhitespace(current.questionLines.join(' '));
    const explanation = normalizeWhitespace(current.explanationLines.join(' '));
    const options = buildOptions().map((option) => ({
      ...option,
      optionText: normalizeWhitespace(current.options.get(option.optionLabel) || ''),
      isCorrect: current.answerLabel === option.optionLabel ? 1 : 0,
      whyIncorrect: normalizeWhitespace(current.whyIncorrect.get(option.optionLabel) || ''),
    }));
    const filledOptions = options.filter((option) => option.optionText);

    if (!questionText && filledOptions.length === 0) {
      resetCurrent();
      return;
    }

    const warnings = [...current.warnings];
    if (!questionText) {
      warnings.push('Question stem could not be detected clearly.');
    }
    if (filledOptions.length < 2) {
      warnings.push('Too few answer options were detected.');
    }
    if (!current.answerLabel) {
      warnings.push('Correct answer was not detected automatically.');
    }

    parsed.push(createEmptyQuestion({
      questionText,
      questionType: defaults.questionType || 'sba',
      category: defaults.category || 'mock',
      paperId: defaults.paperId || '',
      keywordsText: '',
      explanation,
      options,
      parserConfidence: warnings.length > 1 ? 'low' : warnings.length === 1 ? 'medium' : 'high',
      parserWarnings: warnings,
      autoDetectedAnswer: current.answerLabel,
      sourceSnippet: current.sourceLines.join('\n').trim(),
    }));

    resetCurrent();
  }

  lines.forEach((rawLine) => {
    const line = String(rawLine || '');
    const trimmed = normalizeWhitespace(line);

    if (!trimmed) {
      if (current.questionLines.length > 0 && current.options.size >= 2 && current.mode !== 'explanation' && current.mode !== 'whyIncorrect') {
        finalizeCurrent();
      }
      return;
    }

    const explanationMatch = detectExplanationLine(trimmed);
    if (explanationMatch) {
      current.mode = 'explanation';
      current.sourceLines.push(trimmed);
      if (explanationMatch[1]) {
        current.explanationLines.push(explanationMatch[1]);
      }
      return;
    }

    const whyHeaderMatch = detectWhyIncorrectHeader(trimmed);
    if (whyHeaderMatch) {
      current.mode = 'whyIncorrect';
      current.sourceLines.push(trimmed);
      const inline = normalizeWhitespace(whyHeaderMatch[1] || '');
      const inlineMatch = detectWhyIncorrectLine(inline);
      if (inlineMatch) {
        current.whyIncorrect.set(inlineMatch[1].toUpperCase(), normalizeWhitespace(inlineMatch[2]));
        current.lastOptionLabel = inlineMatch[1].toUpperCase();
      }
      return;
    }

    const answerMatch = detectAnswerLine(trimmed);
    if (answerMatch) {
      current.answerLabel = mapAnswerTokenToLabel(answerMatch[1]);
      current.sourceLines.push(trimmed);
      if (!current.answerLabel) {
        current.warnings.push('Detected an answer line, but could not map it to option A-E.');
      }
      return;
    }

    if (current.mode === 'whyIncorrect') {
      const whyLineMatch = detectWhyIncorrectLine(trimmed);
      if (whyLineMatch) {
        const label = whyLineMatch[1].toUpperCase();
        current.whyIncorrect.set(label, normalizeWhitespace(whyLineMatch[2]));
        current.lastOptionLabel = label;
      } else if (!looksLikeContinuation(trimmed) && looksLikeQuestionStart(trimmed)) {
        finalizeCurrent();
        current.questionLines.push(detectQuestionHeader(trimmed) || trimmed);
      } else if (current.lastOptionLabel) {
        const previous = current.whyIncorrect.get(current.lastOptionLabel) || '';
        current.whyIncorrect.set(current.lastOptionLabel, normalizeWhitespace(`${previous} ${trimmed}`));
      }
      current.sourceLines.push(trimmed);
      return;
    }

    const optionMatch = detectOptionLine(trimmed);
    if (optionMatch) {
      const optionLabel = optionMatch[1].toUpperCase();
      const optionText = normalizeWhitespace(optionMatch[2]);
      current.options.set(optionLabel, optionText);
      current.lastOptionLabel = optionLabel;
      current.mode = 'option';
      current.sourceLines.push(trimmed);
      return;
    }

    const explicitHeader = detectQuestionHeader(trimmed);
    if (explicitHeader && (current.questionLines.length > 0 || current.options.size > 0)) {
      finalizeCurrent();
      current.questionLines.push(explicitHeader);
      current.sourceLines.push(trimmed);
      return;
    }

    if (current.mode === 'explanation') {
      current.explanationLines.push(trimmed);
      current.sourceLines.push(trimmed);
      return;
    }

    if (current.options.size > 0) {
      if (!looksLikeContinuation(trimmed) && looksLikeQuestionStart(trimmed)) {
        finalizeCurrent();
        current.questionLines.push(explicitHeader || trimmed);
        current.sourceLines.push(trimmed);
        return;
      }

      if (current.lastOptionLabel) {
        const previous = current.options.get(current.lastOptionLabel) || '';
        current.options.set(current.lastOptionLabel, normalizeWhitespace(`${previous} ${trimmed}`));
        current.sourceLines.push(trimmed);
        return;
      }
    }

    current.questionLines.push(explicitHeader || trimmed);
    current.sourceLines.push(trimmed);
  });

  finalizeCurrent();
  return parsed;
}

export function resolveQuestion(question, defaults, usePerQuestionHierarchy) {
  return {
    courseId: usePerQuestionHierarchy ? question.courseId || defaults.courseId : defaults.courseId,
    subjectId: usePerQuestionHierarchy ? question.subjectId || defaults.subjectId : defaults.subjectId,
    topicId: usePerQuestionHierarchy ? question.topicId || defaults.topicId : defaults.topicId,
    lessonId: usePerQuestionHierarchy ? question.lessonId || defaults.lessonId : defaults.lessonId,
    category: question.category || defaults.category,
    questionType: question.questionType || defaults.questionType,
    paperId: question.paperId || defaults.paperId,
    keywordsText: mergeKeywords(defaults.keywordsText, question.keywordsText),
  };
}

export function validateQuestion(question, resolved, duplicateMap) {
  const errors = [];
  const warnings = [...(question.parserWarnings || [])];
  const normalizedQuestionText = normalizeWhitespace(question.questionText);

  if (!normalizedQuestionText) {
    errors.push('Question text is required.');
  }

  if (!resolved.courseId) {
    errors.push('Course is required.');
  }

  if (!resolved.subjectId) {
    errors.push('Subject is required.');
  }

  if (!resolved.category) {
    errors.push('Category is required.');
  }

  if (!resolved.questionType) {
    errors.push('Question type is required.');
  }

  const filledOptions = (question.options || []).filter((option) => normalizeWhitespace(option.optionText));
  if (resolved.questionType === 'sba') {
    if (filledOptions.length !== 5) {
      errors.push('SBA questions need exactly 5 options.');
    }

    const correctOptions = filledOptions.filter((option) => Number(option.isCorrect) === 1);
    if (correctOptions.length !== 1) {
      errors.push('SBA questions must have exactly one correct answer.');
    }

    const missingWhy = filledOptions.filter((option) => Number(option.isCorrect) !== 1 && !normalizeWhitespace(option.whyIncorrect || option.optionExplanation));
    if (missingWhy.length > 0) {
      warnings.push(`${missingWhy.length} incorrect option${missingWhy.length === 1 ? '' : 's'} missing why-incorrect explanations.`);
    }
  }

  if (resolved.questionType === 'true_false') {
    if (filledOptions.length !== 5) {
      errors.push('True / False questions need 5 statements.');
    }
  }

  const duplicateCount = duplicateMap.get(normalizedQuestionText.toLowerCase()) || 0;
  if (normalizedQuestionText && duplicateCount > 1) {
    warnings.push('Possible duplicate question text found in this batch.');
  }

  let queueStatus = 'Ready';
  if (question.savedId) {
    queueStatus = 'Saved';
  } else if (errors.some((error) => /correct answer|SBA/i.test(error))) {
    queueStatus = 'Missing Answer';
  } else if (errors.length > 0 || warnings.length > 0 || question.parserConfidence === 'low') {
    queueStatus = 'Needs Review';
  }

  return {
    errors,
    warnings,
    queueStatus,
    isReady: errors.length === 0 && queueStatus !== 'Needs Review',
    canSave: errors.length === 0,
  };
}

export function buildQuestionSignature(question, resolved) {
  return JSON.stringify({
    questionText: normalizeWhitespace(question.questionText),
    questionType: resolved.questionType,
    category: resolved.category,
    paperId: resolved.paperId || null,
    keywordsText: resolved.keywordsText,
    explanation: normalizeWhitespace(buildCombinedExplanation(question)),
    status: question.status,
    topicLabel: normalizeWhitespace(question.topicLabel),
    hierarchy: {
      courseId: resolved.courseId,
      subjectId: resolved.subjectId,
      topicId: resolved.topicId,
      lessonId: resolved.lessonId,
    },
    options: (question.options || []).map((option) => ({
      optionLabel: option.optionLabel,
      optionText: normalizeWhitespace(option.optionText),
      isCorrect: Number(option.isCorrect) === 1 ? 1 : 0,
      whyIncorrect: normalizeWhitespace(option.whyIncorrect || option.optionExplanation),
    })),
  });
}

export async function saveQuestionRecord({ question, resolved }) {
  const payload = {
    courseId: Number(resolved.courseId),
    subjectId: Number(resolved.subjectId),
    topicId: resolved.topicId ? Number(resolved.topicId) : null,
    lessonId: resolved.lessonId ? Number(resolved.lessonId) : null,
    paperId: resolved.paperId ? Number(resolved.paperId) : null,
    topicLabel: question.topicLabel || '',
    category: resolved.category,
    questionType: resolved.questionType,
    questionText: question.questionText,
    keywordsText: resolved.keywordsText,
    explanation: buildCombinedExplanation(question),
    status: question.status,
    options: (question.options || []).map((option) => ({
      optionLabel: option.optionLabel,
      optionText: normalizeWhitespace(option.optionText),
      isCorrect: Number(option.isCorrect) === 1 ? 1 : 0,
      whyIncorrect: normalizeWhitespace(option.whyIncorrect || option.optionExplanation),
    })),
  };

  const signature = buildQuestionSignature(question, resolved);
  if (question.savedId && question.lastSavedHash === signature) {
    return { savedId: question.savedId, signature, skipped: true };
  }

  if (question.savedId) {
    await updateQuestion(question.savedId, payload);
    return { savedId: question.savedId, signature };
  }

  const result = await createQuestion(payload);
  return { savedId: Number(result.id), signature };
}

function applyQuestionPatch(setQuestions, targetId, updater) {
  setQuestions((current) => current.map((question) => (
    question.clientId === targetId ? updater(question) : question
  )));
}

function HierarchySelectors({ meta, value, onChange, courseRequired = false }) {
  const { visibleSubjects, visibleTopics, visibleLessons } = buildHierarchyCollections(meta, value);

  return (
    <div className={bq.gridFour}>
      <label className={ui.formLabel}>
        Course
        <select className={ui.input} name="courseId" value={value.courseId} onChange={onChange} required={courseRequired}>
          <option value="">{courseRequired ? 'Select course' : 'All courses'}</option>
          {meta.courses.map((course) => (
            <option key={course.id} value={course.id}>{course.courseTitle}</option>
          ))}
        </select>
      </label>

      <label className={ui.formLabel}>
        Subject
        <select className={ui.input} name="subjectId" value={value.subjectId} onChange={onChange}>
          <option value="">{value.courseId ? 'Select subject' : 'Select course first'}</option>
          {visibleSubjects.map((subject) => (
            <option key={subject.id} value={subject.id}>{subject.subjectName}</option>
          ))}
        </select>
      </label>

      <label className={ui.formLabel}>
        Topic
        <select className={ui.input} name="topicId" value={value.topicId} onChange={onChange}>
          <option value="">{value.subjectId ? 'All topics' : 'Select subject first'}</option>
          {visibleTopics.map((topic) => (
            <option key={topic.id} value={topic.id}>{topic.topicName}</option>
          ))}
        </select>
      </label>

      <label className={ui.formLabel}>
        Lesson
        <select className={ui.input} name="lessonId" value={value.lessonId} onChange={onChange}>
          <option value="">{value.subjectId ? 'All lessons' : 'Select subject first'}</option>
          {visibleLessons.map((lesson) => (
            <option key={lesson.id} value={lesson.id}>{lesson.lessonTitle}</option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function BulkQuestionInputPage() {
  const navigate = useNavigate();
  const draftImportRef = useRef(null);
  const [meta, setMeta] = useState({ courses: [], subjects: [], topics: [], lessons: [], papers: [], keywordSuggestions: [] });
  const [rawInput, setRawInput] = useState('');
  const [inputMode, setInputMode] = useState('text');
  const [questions, setQuestions] = useState([]);
  const [globalDefaults, setGlobalDefaults] = useState(buildGlobalDefaults);
  const [applyPerQuestionHierarchy, setApplyPerQuestionHierarchy] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [queueSearch, setQueueSearch] = useState('');
  const [queueStatusFilter, setQueueStatusFilter] = useState('all');
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [savingCurrent, setSavingCurrent] = useState(false);
  const [savingReady, setSavingReady] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [draftSnapshot, setDraftSnapshot] = useState(null);
  const [recap, setRecap] = useState(null);
  const [recapLoading, setRecapLoading] = useState(false);
  const [recapSaving, setRecapSaving] = useState(false);
  const [recapGenerating, setRecapGenerating] = useState(false);
  const [recapError, setRecapError] = useState('');
  const [recapForId, setRecapForId] = useState(null);
  const [aiEnhanceOptions, setAiEnhanceOptions] = useState({
    explanations: true,
    whyIncorrect: true,
    theoryCards: false,
    regenerate: false,
  });
  const [aiEnhanceRunning, setAiEnhanceRunning] = useState(false);
  const [aiEnhanceProgress, setAiEnhanceProgress] = useState({
    total: 0,
    completed: 0,
    currentId: null,
    currentLabel: '',
    items: {},
  });

  useEffect(() => {
    async function loadMeta() {
      try {
        const data = await fetchQuestionsMeta();
        setMeta(data);
      } catch (loadError) {
        setError(getErrorMessage(loadError, 'Unable to load bulk input metadata'));
      } finally {
        setLoadingMeta(false);
      }
    }

    loadMeta();

    try {
      const stored = window.localStorage.getItem(draftStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.questions?.length || parsed?.rawInput) {
          setDraftSnapshot(parsed);
        }
      }
    } catch {
      window.localStorage.removeItem(draftStorageKey);
    }
  }, []);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }
    const timeout = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!questions.length && !rawInput.trim()) {
      return;
    }

    const payload = {
      rawInput,
      inputMode,
      questions,
      currentIndex,
      globalDefaults,
      applyPerQuestionHierarchy,
      queueSearch,
      queueStatusFilter,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(draftStorageKey, JSON.stringify(payload));
  }, [applyPerQuestionHierarchy, currentIndex, globalDefaults, inputMode, queueSearch, queueStatusFilter, questions, rawInput]);

  const duplicateMap = useMemo(() => {
    const map = new Map();
    questions.forEach((question) => {
      const key = normalizeWhitespace(question.questionText).toLowerCase();
      if (!key) return;
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }, [questions]);

  const questionDiagnostics = useMemo(() => {
    const next = new Map();
    questions.forEach((question) => {
      const resolved = resolveQuestion(question, globalDefaults, applyPerQuestionHierarchy);
      next.set(question.clientId, {
        resolved,
        validation: validateQuestion(question, resolved, duplicateMap),
      });
    });
    return next;
  }, [applyPerQuestionHierarchy, duplicateMap, globalDefaults, questions]);

  const queueCounts = useMemo(() => {
    const counts = {
      total: questions.length,
      saved: 0,
      ready: 0,
      needsReview: 0,
      missingAnswer: 0,
    };
    questions.forEach((question) => {
      const validation = questionDiagnostics.get(question.clientId)?.validation;
      if (!validation) return;
      if (validation.queueStatus === 'Saved') counts.saved += 1;
      if (validation.queueStatus === 'Ready') counts.ready += 1;
      if (validation.queueStatus === 'Needs Review') counts.needsReview += 1;
      if (validation.queueStatus === 'Missing Answer') counts.missingAnswer += 1;
    });
    return counts;
  }, [questionDiagnostics, questions]);

  const filteredQueue = useMemo(() => {
    const needle = queueSearch.trim().toLowerCase();
    return questions.filter((question) => {
      const validation = questionDiagnostics.get(question.clientId)?.validation;
      const status = validation?.queueStatus || 'Needs Review';
      if (queueStatusFilter !== 'all' && status !== queueStatusFilter) return false;
      if (!needle) return true;
      const haystack = [
        question.questionText,
        question.explanation,
        question.keywordsText,
        question.sourceSnippet,
      ].join(' ').toLowerCase();
      return haystack.includes(needle);
    });
  }, [queueSearch, queueStatusFilter, questions, questionDiagnostics]);

  const currentQuestion = questions[currentIndex] || null;
  const currentDiagnostics = currentQuestion ? questionDiagnostics.get(currentQuestion.clientId) : null;

  function buildBulkAiPayload(question, resolved, explanationOverride = question.explanation) {
    const correctOption = (question.options || []).find((option) => Number(option.isCorrect) === 1);
    const course = meta.courses.find((item) => String(item.id) === String(resolved.courseId));
    const subject = meta.subjects.find((item) => String(item.id) === String(resolved.subjectId));
    const topic = meta.topics.find((item) => String(item.id) === String(resolved.topicId));
    const lesson = meta.lessons.find((item) => String(item.id) === String(resolved.lessonId));

    return {
      questionText: question.questionText,
      questionType: resolved.questionType,
      correctAnswerLabel: correctOption?.optionLabel || '',
      explanation: explanationOverride || '',
      course: course?.courseTitle || '',
      subject: subject?.subjectName || '',
      topic: topic?.topicName || question.topicLabel || '',
      lesson: lesson?.lessonTitle || '',
      options: (question.options || []).map((option) => ({
        optionLabel: option.optionLabel,
        optionText: option.optionText,
        isCorrect: Number(option.isCorrect) === 1,
        whyIncorrect: option.whyIncorrect || option.optionExplanation || '',
      })),
    };
  }

  function patchQuestionById(clientId, updater) {
    applyQuestionPatch(setQuestions, clientId, updater);
  }

  function setAiItemStatus(clientId, patch) {
    setAiEnhanceProgress((current) => ({
      ...current,
      items: {
        ...current.items,
        [clientId]: {
          ...(current.items[clientId] || {}),
          ...patch,
        },
      },
    }));
  }

  async function enhanceOneQuestion(question, options = aiEnhanceOptions) {
    const diagnostics = questionDiagnostics.get(question.clientId);
    if (!diagnostics?.validation?.canSave) {
      throw new Error((diagnostics?.validation?.errors || ['Question is not valid enough for AI generation.']).join(' '));
    }

    const resolved = diagnostics.resolved;
    let workingQuestion = question;
    let explanation = workingQuestion.explanation || '';

    if (options.explanations && (options.regenerate || !normalizeWhitespace(explanation))) {
      const result = await generateQuestionExplanation(buildBulkAiPayload(workingQuestion, resolved));
      explanation = result.explanation || explanation;
      workingQuestion = { ...workingQuestion, explanation };
      patchQuestionById(question.clientId, (item) => ({
        ...item,
        explanation: options.regenerate || !normalizeWhitespace(item.explanation) ? explanation : item.explanation,
      }));
    }

    if (options.whyIncorrect && resolved.questionType === 'sba') {
      const missingWhy = (workingQuestion.options || []).some(
        (option) => Number(option.isCorrect) !== 1 && (options.regenerate || !normalizeWhitespace(option.whyIncorrect || option.optionExplanation))
      );
      if (missingWhy) {
        const result = await generateWhyIncorrectExplanations(buildBulkAiPayload(workingQuestion, resolved, explanation));
        const generatedMap = new Map((result.items || []).map((item) => [String(item.optionLabel || '').toUpperCase(), item.whyIncorrect || '']));
        workingQuestion = {
          ...workingQuestion,
          options: workingQuestion.options.map((option) => (
            Number(option.isCorrect) === 1
              ? { ...option, whyIncorrect: '', optionExplanation: '' }
              : {
                  ...option,
                  whyIncorrect: options.regenerate || !normalizeWhitespace(option.whyIncorrect || option.optionExplanation)
                    ? generatedMap.get(option.optionLabel) || option.whyIncorrect || option.optionExplanation || ''
                    : option.whyIncorrect,
                  optionExplanation: options.regenerate || !normalizeWhitespace(option.whyIncorrect || option.optionExplanation)
                    ? generatedMap.get(option.optionLabel) || option.optionExplanation || option.whyIncorrect || ''
                    : option.optionExplanation,
                }
          )),
        };
        patchQuestionById(question.clientId, () => workingQuestion);
      }
    }

    if (options.theoryCards) {
      let savedId = workingQuestion.savedId;
      if (!savedId) {
        const refreshedDiagnostics = questionDiagnostics.get(question.clientId) || diagnostics;
        const saveResult = await saveQuestionRecord({ question: workingQuestion, resolved: refreshedDiagnostics.resolved });
        savedId = saveResult.savedId;
        workingQuestion = {
          ...workingQuestion,
          savedId,
          lastSavedHash: saveResult.signature,
          reviewed: true,
        };
        patchQuestionById(question.clientId, () => workingQuestion);
      }

      const existingRecap = options.regenerate ? null : await fetchTheoryRecap(savedId).catch(() => null);
      if (options.regenerate || !existingRecap) {
        await generateTheoryRecap(savedId);
      }
    }
  }

  async function runAiEnhancement(targetQuestions = questions) {
    if (!targetQuestions.length) {
      setToast('No questions need AI enhancement with the current options.');
      return;
    }

    setAiEnhanceRunning(true);
    setError('');
    setAiEnhanceProgress({
      total: targetQuestions.length,
      completed: 0,
      currentId: null,
      currentLabel: '',
      items: Object.fromEntries(targetQuestions.map((question, index) => [
        question.clientId,
        { status: 'queued', label: `Question ${index + 1}` },
      ])),
    });

    for (let index = 0; index < targetQuestions.length; index += 1) {
      const question = targetQuestions[index];
      setAiEnhanceProgress((current) => ({
        ...current,
        currentId: question.clientId,
        currentLabel: `Question ${index + 1} processing...`,
      }));
      setAiItemStatus(question.clientId, { status: 'processing', error: '' });

      try {
        await enhanceOneQuestion(question);
        setAiItemStatus(question.clientId, { status: 'completed', error: '' });
      } catch (err) {
        setAiItemStatus(question.clientId, { status: 'failed', error: getErrorMessage(err, 'AI generation failed') });
      } finally {
        setAiEnhanceProgress((current) => ({
          ...current,
          completed: current.completed + 1,
        }));
      }
    }

    setAiEnhanceRunning(false);
    setAiEnhanceProgress((current) => ({
      ...current,
      currentId: null,
      currentLabel: 'AI enhancement completed',
    }));
    setToast('AI enhancement queue finished. Review generated content before final saving.');
  }

  function retryFailedAiEnhancement() {
    const failedIds = Object.entries(aiEnhanceProgress.items)
      .filter(([, item]) => item.status === 'failed')
      .map(([clientId]) => clientId);
    const failedQuestions = questions.filter((question) => failedIds.includes(question.clientId));
    runAiEnhancement(failedQuestions);
  }

  useEffect(() => {
    const savedId = currentQuestion?.savedId || null;
    if (!savedId || savedId === recapForId) return;
    setRecap(null);
    setRecapError('');
    setRecapForId(savedId);
    setRecapLoading(true);
    fetchTheoryRecap(savedId)
      .then((data) => setRecap(data))
      .catch(() => setRecap(null))
      .finally(() => setRecapLoading(false));
  }, [currentQuestion?.savedId]);

  async function handleBulkRecapSave(fields) {
    if (!currentQuestion?.savedId) return;
    setRecapSaving(true);
    setRecapError('');
    try {
      const saved = await upsertTheoryRecap(currentQuestion.savedId, fields);
      setRecap(saved);
      setToast('Theory recap saved.');
    } catch (err) {
      setRecapError(getErrorMessage(err, 'Unable to save theory recap'));
    } finally {
      setRecapSaving(false);
    }
  }

  async function handleBulkRecapGenerate() {
    if (!currentQuestion?.savedId) return;
    setRecapGenerating(true);
    setRecapError('');
    try {
      const generated = recap
        ? await regenerateTheoryRecap(currentQuestion.savedId)
        : await generateTheoryRecap(currentQuestion.savedId);
      setRecap(generated);
      setToast('Theory recap generated.');
    } catch (err) {
      setRecapError(getErrorMessage(err, 'Unable to generate theory recap'));
    } finally {
      setRecapGenerating(false);
    }
  }

  async function handleBulkRecapDelete() {
    if (!currentQuestion?.savedId || !window.confirm('Delete this theory recap?')) return;
    setRecapSaving(true);
    setRecapError('');
    try {
      await deleteTheoryRecap(currentQuestion.savedId);
      setRecap(null);
      setToast('Theory recap deleted.');
    } catch (err) {
      setRecapError(getErrorMessage(err, 'Unable to delete theory recap'));
    } finally {
      setRecapSaving(false);
    }
  }

  function saveDraftToStorage(showMessage = true) {
    const payload = {
      rawInput,
      inputMode,
      questions,
      currentIndex,
      globalDefaults,
      applyPerQuestionHierarchy,
      queueSearch,
      queueStatusFilter,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(draftStorageKey, JSON.stringify(payload));
    if (showMessage) {
      setToast('Bulk import draft saved.');
    }
  }

  function resetWorkspace(clearStoredDraft = false) {
    setRawInput('');
    setInputMode('text');
    setQuestions([]);
    setCurrentIndex(0);
    setQueueSearch('');
    setQueueStatusFilter('all');
    setGlobalDefaults(buildGlobalDefaults());
    setApplyPerQuestionHierarchy(false);
    setError('');
    if (clearStoredDraft) {
      window.localStorage.removeItem(draftStorageKey);
      setDraftSnapshot(null);
    }
  }

  function handleStartNewDraft() {
    resetWorkspace(true);
    setToast('Started a new bulk import workspace.');
  }

  function handleDeleteDraft() {
    window.localStorage.removeItem(draftStorageKey);
    setDraftSnapshot(null);
    setToast('Stored draft deleted.');
  }

  function handleResumeDraft() {
    if (!draftSnapshot) return;
    setRawInput(String(draftSnapshot.rawInput || ''));
    setInputMode(String(draftSnapshot.inputMode || 'text'));
    setQuestions(Array.isArray(draftSnapshot.questions) ? draftSnapshot.questions : []);
    setCurrentIndex(Math.max(0, Number(draftSnapshot.currentIndex) || 0));
    setGlobalDefaults(draftSnapshot.globalDefaults || buildGlobalDefaults());
    setApplyPerQuestionHierarchy(draftSnapshot.applyPerQuestionHierarchy === true);
    setQueueSearch(String(draftSnapshot.queueSearch || ''));
    setQueueStatusFilter(String(draftSnapshot.queueStatusFilter || 'all'));
    setDraftSnapshot(null);
    setToast('Bulk import draft restored.');
  }

  function handleGlobalDefaultChange(event) {
    const { name, value } = event.target;
    setGlobalDefaults((current) => {
      const next = { ...current, [name]: value };
      if (name === 'courseId') {
        next.subjectId = '';
        next.topicId = '';
        next.lessonId = '';
      }
      if (name === 'subjectId') {
        next.topicId = '';
        next.lessonId = '';
      }
      if (name === 'topicId') {
        next.lessonId = '';
      }
      return next;
    });
  }

  function handleQuestionHierarchyChange(event) {
    if (!currentQuestion) return;
    const { name, value } = event.target;
    applyQuestionPatch(setQuestions, currentQuestion.clientId, (question) => {
      const next = { ...question, [name]: value };
      if (name === 'courseId') {
        next.subjectId = '';
        next.topicId = '';
        next.lessonId = '';
      }
      if (name === 'subjectId') {
        next.topicId = '';
        next.lessonId = '';
      }
      if (name === 'topicId') {
        next.lessonId = '';
      }
      return next;
    });
  }

  function handleQuestionFieldChange(event) {
    if (!currentQuestion) return;
    const { name, value } = event.target;
    applyQuestionPatch(setQuestions, currentQuestion.clientId, (question) => ({
      ...question,
      [name]: value,
    }));
  }

  function handleOptionTextChange(optionIndex, value) {
    if (!currentQuestion) return;
    applyQuestionPatch(setQuestions, currentQuestion.clientId, (question) => ({
      ...question,
      options: question.options.map((option, currentOptionIndex) => (
        currentOptionIndex === optionIndex ? { ...option, optionText: value } : option
      )),
    }));
  }

  function handleOptionExplanationChange(optionIndex, value) {
    if (!currentQuestion) return;
    applyQuestionPatch(setQuestions, currentQuestion.clientId, (question) => ({
      ...question,
      options: question.options.map((option, currentOptionIndex) => (
        currentOptionIndex === optionIndex ? { ...option, optionExplanation: value, whyIncorrect: value } : option
      )),
    }));
  }

  function handleSbaCorrectChange(optionLabel) {
    if (!currentQuestion) return;
    applyQuestionPatch(setQuestions, currentQuestion.clientId, (question) => ({
      ...question,
      reviewed: true,
      options: question.options.map((option) => ({
        ...option,
        isCorrect: option.optionLabel === optionLabel ? 1 : 0,
        whyIncorrect: option.optionLabel === optionLabel ? '' : option.whyIncorrect,
        optionExplanation: option.optionLabel === optionLabel ? '' : option.optionExplanation,
      })),
    }));
  }

  function handleTrueFalseCorrectChange(optionIndex, value) {
    if (!currentQuestion) return;
    applyQuestionPatch(setQuestions, currentQuestion.clientId, (question) => ({
      ...question,
      reviewed: true,
      options: question.options.map((option, currentOptionIndex) => (
        currentOptionIndex === optionIndex ? { ...option, isCorrect: Number(value) } : option
      )),
    }));
  }

  function handleMarkAllReviewed() {
    setQuestions((current) => current.map((question) => ({ ...question, reviewed: true, parserWarnings: [] })));
    setToast('All parsed questions marked as reviewed.');
  }

  function handleAddBlankQuestion() {
    const blank = createEmptyQuestion({
      questionType: globalDefaults.questionType || 'sba',
      category: globalDefaults.category || 'mock',
      paperId: globalDefaults.paperId || '',
      courseId: applyPerQuestionHierarchy ? globalDefaults.courseId : '',
      subjectId: applyPerQuestionHierarchy ? globalDefaults.subjectId : '',
      topicId: applyPerQuestionHierarchy ? globalDefaults.topicId : '',
      lessonId: applyPerQuestionHierarchy ? globalDefaults.lessonId : '',
      reviewed: true,
      parserWarnings: ['Blank question added manually. Complete the fields before saving.'],
      parserConfidence: 'medium',
    });
    setQuestions((current) => [...current, blank]);
    setCurrentIndex(questions.length);
  }

  function handleParseQuestions() {
    let parsedQuestions = [];

    try {
      parsedQuestions = (inputMode === 'json' ? parseJsonQuestions(rawInput, globalDefaults) : parseRawQuestions(rawInput, globalDefaults)).map((question) => ({
        ...question,
        questionType: question.questionType || globalDefaults.questionType,
        category: question.category || globalDefaults.category,
        paperId: question.paperId || globalDefaults.paperId,
      }));
    } catch (parseError) {
      setError(getErrorMessage(parseError, 'Unable to parse this bulk input'));
      return;
    }

    if (!parsedQuestions.length) {
      setError(inputMode === 'json'
        ? 'No valid JSON question blocks were detected. Paste a JSON array or object with question data first.'
        : 'No valid question blocks were detected. Paste at least one question and its options first.');
      return;
    }

    setQuestions(parsedQuestions);
    setCurrentIndex(0);
    setError('');
    setToast(`${parsedQuestions.length} questions parsed from ${inputMode === 'json' ? 'JSON' : 'text'}. Review the queue and fix any items marked for review.`);
  }

  async function handleSaveCurrentQuestion() {
    if (!currentQuestion || !currentDiagnostics) {
      setError('Choose a question before saving.');
      return;
    }

    if (!currentDiagnostics.validation.canSave) {
      setError(currentDiagnostics.validation.errors.join(' '));
      return;
    }

    setSavingCurrent(true);
    setError('');

    try {
      const saveResult = await saveQuestionRecord({
        question: currentQuestion,
        resolved: currentDiagnostics.resolved,
      });
      applyQuestionPatch(setQuestions, currentQuestion.clientId, (question) => ({
        ...question,
        savedId: saveResult.savedId,
        lastSavedHash: saveResult.signature,
        reviewed: true,
      }));
      setToast(saveResult.skipped ? 'Current question was already up to date.' : 'Current question saved.');
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'Unable to save the current question'));
    } finally {
      setSavingCurrent(false);
    }
  }

  async function saveQuestionBatch(candidates, mode) {
    if (!candidates.length) {
      setToast(mode === 'ready' ? 'No ready questions found to save.' : 'No questions available to save.');
      return;
    }

    const invalid = candidates.filter((item) => !item.validation.canSave);
    if (mode === 'all') {
      const confirmAll = window.confirm(`Save ${candidates.length} question(s) from this bulk draft?`);
      if (!confirmAll) return;
    }
    if (invalid.length > 0) {
      const confirmSkip = window.confirm(
        `${invalid.length} question(s) still have missing required fields and will be skipped. Continue saving the remaining questions?`
      );
      if (!confirmSkip) return;
    }

    const validCandidates = candidates.filter((item) => item.validation.canSave);
    const nextQuestions = [...questions];
    const issues = [];
    let savedItems = 0;

    for (const item of validCandidates) {
      try {
        const saveResult = await saveQuestionRecord({
          question: item.question,
          resolved: item.resolved,
        });
        const targetIndex = nextQuestions.findIndex((question) => question.clientId === item.question.clientId);
        if (targetIndex >= 0) {
          nextQuestions[targetIndex] = {
            ...nextQuestions[targetIndex],
            savedId: saveResult.savedId,
            lastSavedHash: saveResult.signature,
            reviewed: true,
          };
        }
        if (!saveResult.skipped) {
          savedItems += 1;
        }
      } catch (saveError) {
        issues.push(`Question ${item.index + 1}: ${getErrorMessage(saveError, 'Unable to save this question')}`);
      }
    }

    setQuestions(nextQuestions);
    if (issues.length > 0) {
      setError(issues.join(' | '));
    }
    setToast(
      mode === 'ready'
        ? `${savedItems} ready question${savedItems === 1 ? '' : 's'} saved.`
        : `${savedItems} question${savedItems === 1 ? '' : 's'} saved from this draft.`
    );
  }

  async function handleSaveAllReadyQuestions() {
    setSavingReady(true);
    setError('');
    try {
      const candidates = questions
        .map((question, index) => ({
          question,
          index,
          resolved: questionDiagnostics.get(question.clientId)?.resolved,
          validation: questionDiagnostics.get(question.clientId)?.validation,
        }))
        .filter((item) => item.validation?.queueStatus === 'Ready');
      await saveQuestionBatch(candidates, 'ready');
    } finally {
      setSavingReady(false);
    }
  }

  async function handleSaveAllQuestions() {
    setSavingAll(true);
    setError('');
    try {
      const candidates = questions.map((question, index) => ({
        question,
        index,
        resolved: questionDiagnostics.get(question.clientId)?.resolved,
        validation: questionDiagnostics.get(question.clientId)?.validation,
      }));
      await saveQuestionBatch(candidates, 'all');
    } finally {
      setSavingAll(false);
    }
  }

  function handleExportDraftJson() {
    saveDraftToStorage(false);
    const payload = {
      rawInput,
      inputMode,
      questions,
      currentIndex,
      globalDefaults,
      applyPerQuestionHierarchy,
      queueSearch,
      queueStatusFilter,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bulk-question-draft-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    setToast('Draft JSON exported.');
  }

  async function handleCopySampleJson() {
    setError('');
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(sampleJsonFormat);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = sampleJsonFormat;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.top = '-1000px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
      }
      setToast('Sample JSON format copied.');
    } catch {
      setError('Could not copy the sample JSON format. You can still copy it from the placeholder text.');
    }
  }

  function handleImportDraftFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        setRawInput(String(parsed.rawInput || ''));
        setInputMode(String(parsed.inputMode || 'text'));
        setQuestions(Array.isArray(parsed.questions) ? parsed.questions : []);
        setCurrentIndex(Math.max(0, Number(parsed.currentIndex) || 0));
        setGlobalDefaults(parsed.globalDefaults || buildGlobalDefaults());
        setApplyPerQuestionHierarchy(parsed.applyPerQuestionHierarchy === true);
        setQueueSearch(String(parsed.queueSearch || ''));
        setQueueStatusFilter(String(parsed.queueStatusFilter || 'all'));
        window.localStorage.setItem(draftStorageKey, JSON.stringify(parsed));
        setDraftSnapshot(null);
        setToast('Draft JSON imported successfully.');
      } catch {
        setError('Could not import this draft JSON file.');
      }
    };
    reader.readAsText(file);
    if (event.target) {
      event.target.value = '';
    }
  }

  function handleSelectQuestion(clientId) {
    const index = questions.findIndex((question) => question.clientId === clientId);
    if (index >= 0) {
      setCurrentIndex(index);
    }
  }

  const currentHierarchyValue = currentQuestion ? {
    courseId: currentQuestion.courseId || '',
    subjectId: currentQuestion.subjectId || '',
    topicId: currentQuestion.topicId || '',
    lessonId: currentQuestion.lessonId || '',
  } : buildGlobalDefaults();

  return (
    <main className={ui.screenShell}>
      <section className={ui.managementLayout}>
        <AppHeader
          title="Bulk Question Input"
          subtitle="Paste raw questions, parse them into cards, review the queue, then save ready items now and continue the draft later."
          actions={(
            <div className={ui.buttonRow}>
              <button type="button" className={ui.secondaryAction} onClick={() => navigate('/questions')}>
                Back to Questions
              </button>
            </div>
          )}
        />

        {error ? <div className={ui.feedbackError}>{error}</div> : null}
        {toast ? <div className={ui.feedbackSuccess}>{toast}</div> : null}

        {draftSnapshot ? (
          <section className={cx(ui.panelCard, bq.resume)}>
            <div>
              <h2 className="m-0 text-ink-strong">You have an unfinished bulk import draft</h2>
              <p className="m-0 mt-1 text-[13px] text-ink-soft">Continue the last saved draft, start a new import workspace, or delete the stored draft completely.</p>
            </div>
            <div className={ui.buttonRow}>
              <button className={ui.primaryAction} type="button" onClick={handleResumeDraft}>Continue Draft</button>
              <button type="button" className={ui.secondaryAction} onClick={handleStartNewDraft}>Start New</button>
              <button type="button" className={ui.dangerAction} onClick={handleDeleteDraft}>Delete Draft</button>
            </div>
          </section>
        ) : null}

        <div className={bq.shell}>
          <section className={cx(ui.panelCard, bq.panel)}>
            <div className={ui.panelTop}>
              <div>
                <h2>Step 1: Paste and Parse</h2>
                <p>{inputMode === 'json'
                  ? 'Paste a JSON array or object and convert it into editable bulk question cards. The parser strips stray span markers, keeps per-statement explanations, and auto-detects True / False versus SBA when possible.'
                  : 'The parser detects question stems, options A-E, answer lines, explanations, extra blank lines, and common copied-PDF spacing issues.'}</p>
              </div>
              <div className={ui.buttonRow}>
                <button className={ui.primaryAction} type="button" onClick={handleParseQuestions}>Parse Questions</button>
                <button type="button" className={ui.secondaryAction} onClick={handleCopySampleJson}>Copy Sample JSON</button>
                <button type="button" className={ui.secondaryAction} onClick={handleAddBlankQuestion}>Add Blank Question</button>
              </div>
            </div>

            <div className={bq.modeToggle} role="tablist" aria-label="Bulk input mode">
              <button className={cx(bq.modeButton, inputMode === 'text' ? 'bg-brand-primary text-white' : 'bg-transparent text-ink-soft hover:bg-surface-3 hover:text-ink-strong')}
                type="button"
               
                onClick={() => setInputMode('text')}
              >
                Paste Text
              </button>
              <button className={cx(bq.modeButton, inputMode === 'json' ? 'bg-brand-primary text-white' : 'bg-transparent text-ink-soft hover:bg-surface-3 hover:text-ink-strong')}
                type="button"
               
                onClick={() => setInputMode('json')}
              >
                Paste JSON
              </button>
            </div>

            <label className={bq.textareaLabel}>
              {inputMode === 'json' ? 'Paste JSON Here' : 'Paste Questions Here'}
              <textarea className={bq.textarea}
               
                rows="16"
                value={rawInput}
                onChange={(event) => setRawInput(event.target.value)}
                placeholder={inputMode === 'json' ? sampleJsonFormat : `Question 1: What is heart failure?
A. Option 1
B. Option 2
C. Option 3
D. Option 4
E. Option 5
Answer: B
Explanation: Sample explanation
Why incorrect:
A: Reason why A is wrong.
C: Reason why C is wrong.
D: Reason why D is wrong.
E: Reason why E is wrong.

Q2. Another question
A) Option A
B) Option B
C) Option C
D) Option D
E) Option E`}
              />
            </label>

            <div className={bq.helpGrid}>
              <div className={bq.inlineNote}>
                {inputMode === 'json'
                  ? 'Supported JSON roots: an array, a single object, or an object with `questions` or `items`.'
                  : 'Supported option formats: `A.`, `A)`, `A -`, and lowercase `a.` forms.'}
              </div>
              <div className={bq.inlineNote}>
                {inputMode === 'json'
                  ? 'JSON can use `statements` for True / False, with optional `explanation` on each statement, or `options` plus `correct_answer` for SBA.'
                  : 'Supported question starts: `1.`, `Q1.`, `Question 1:` and standard sentence stems.'}
              </div>
            </div>
          </section>

          <section className={cx(ui.panelCard, bq.panel)}>
            <div className={ui.panelTop}>
              <div>
                <h2>Step 2: Global Defaults</h2>
                <p>Set the shared defaults once. They apply to the batch unless a question overrides them in the editor.</p>
              </div>
              <div className={ui.buttonRow}>
                <button type="button" className={ui.secondaryAction} onClick={() => saveDraftToStorage()}>Save Draft</button>
                <button type="button" className={ui.secondaryAction} onClick={handleExportDraftJson}>Export Draft JSON</button>
                <button type="button" className={ui.secondaryAction} onClick={() => draftImportRef.current?.click()}>Import Draft JSON</button>
                <button type="button" className={ui.dangerAction} onClick={() => resetWorkspace(true)}>Clear Draft</button>
                <input className="shrink-0"
                  ref={draftImportRef}
                  type="file"
                  accept=".json,application/json"
                  style={{ display: 'none' }}
                  onChange={handleImportDraftFile}
                />
              </div>
            </div>

            <HierarchySelectors
              meta={meta}
              value={globalDefaults}
              onChange={handleGlobalDefaultChange}
              courseRequired
            />

            <div className={bq.gridFour}>
              <label className={ui.formLabel}>
                Category
                <select className={ui.input} name="category" value={globalDefaults.category} onChange={handleGlobalDefaultChange}>
                  <option value="mock">Mock</option>
                  <option value="past_paper">Past Paper</option>
                </select>
              </label>

              <label className={ui.formLabel}>
                Question Type
                <select className={ui.input} name="questionType" value={globalDefaults.questionType} onChange={handleGlobalDefaultChange}>
                  <option value="sba">SBA</option>
                  <option value="true_false">True / False</option>
                </select>
              </label>

              <label className={ui.formLabel}>
                Paper / Source
                <select className={ui.input} name="paperId" value={globalDefaults.paperId} onChange={handleGlobalDefaultChange}>
                  <option value="">No paper selected</option>
                  {(meta.papers || []).map((paper) => (
                    <option key={paper.id} value={paper.id}>{paper.paperTitle}</option>
                  ))}
                </select>
              </label>

              <label className={ui.formLabel}>
                Global Keywords / Tags
                <input className={ui.input}
                  list="bulk-question-keywords"
                  name="keywordsText"
                  value={globalDefaults.keywordsText}
                  onChange={handleGlobalDefaultChange}
                  placeholder="cardiology, mock, revision"
                />
              </label>
            </div>

            <div className={bq.gridTwo}>
              <label className={bq.checkbox}>
                <input className="shrink-0"
                  type="checkbox"
                  checked={applyPerQuestionHierarchy}
                  onChange={(event) => setApplyPerQuestionHierarchy(event.target.checked)}
                />
                <span>
                  Allow per-question hierarchy overrides
                  <small className={bq.fieldNote}>Turn this on only when some questions need a different course, subject, topic, or lesson.</small>
                </span>
              </label>

              <div className={bq.progressCard}>
                <strong className="text-[22px] leading-none text-ink-strong">{questions.length ? `${currentIndex + 1} / ${questions.length}` : '0 / 0'}</strong>
                <span className="text-xs font-bold leading-normal text-ink-soft">{queueCounts.saved} saved • {queueCounts.ready} ready • {queueCounts.needsReview} review • {queueCounts.missingAnswer} missing answer</span>
              </div>
            </div>
          </section>

          <section className={cx(ui.panelCard, bq.workspace)}>
            {questions.length ? (
              <div className={bq.aiPanel}>
                <div className={bq.aiHead}>
                  <div>
                    <h3 className="m-0 text-sm font-extrabold text-ink-strong">Generate Missing AI Content</h3>
                    <p className="m-0 mt-1 text-xs leading-normal text-ink-soft">Process questions one by one. Existing fields are preserved unless regenerate is selected.</p>
                  </div>
                  <button className={ui.primaryAction} type="button" onClick={() => runAiEnhancement()} disabled={aiEnhanceRunning}>
                    {aiEnhanceRunning ? 'Generating...' : 'Generate Missing AI Content'}
                  </button>
                </div>
                <div className={bq.aiOptions}>
                  <label className={bq.aiOption}>
                    <input className="shrink-0"
                      type="checkbox"
                      checked={aiEnhanceOptions.explanations}
                      onChange={(event) => setAiEnhanceOptions((current) => ({ ...current, explanations: event.target.checked }))}
                    />
                    <span>Generate missing explanations</span>
                  </label>
                  <label className={bq.aiOption}>
                    <input className="shrink-0"
                      type="checkbox"
                      checked={aiEnhanceOptions.whyIncorrect}
                      onChange={(event) => setAiEnhanceOptions((current) => ({ ...current, whyIncorrect: event.target.checked }))}
                    />
                    <span>Generate missing why incorrect answers</span>
                  </label>
                  <label className={bq.aiOption}>
                    <input className="shrink-0"
                      type="checkbox"
                      checked={aiEnhanceOptions.theoryCards}
                      onChange={(event) => setAiEnhanceOptions((current) => ({ ...current, theoryCards: event.target.checked }))}
                    />
                    <span>Generate missing quick theory cards</span>
                  </label>
                  <label className={bq.aiOption}>
                    <input className="shrink-0"
                      type="checkbox"
                      checked={aiEnhanceOptions.regenerate}
                      onChange={(event) => setAiEnhanceOptions((current) => ({ ...current, regenerate: event.target.checked }))}
                    />
                    <span>Regenerate existing fields</span>
                  </label>
                </div>
                {aiEnhanceProgress.total > 0 ? (
                  <div className={bq.aiProgress}>
                    <div className={bq.aiTop}>
                      <strong className="text-ink-strong">{aiEnhanceProgress.completed} / {aiEnhanceProgress.total} completed</strong>
                      <span>{aiEnhanceProgress.currentLabel}</span>
                    </div>
                    <div className={bq.aiBar}>
                      <span className="block h-full rounded-full bg-[var(--brand-gradient-primary)] transition-[width] duration-200" style={{ width: `${Math.round((aiEnhanceProgress.completed / aiEnhanceProgress.total) * 100)}%` }} />
                    </div>
                    <div className={bq.aiStatusList}>
                      {Object.entries(aiEnhanceProgress.items).slice(0, 20).map(([clientId, item]) => (
                        <button className={cx(
                            bq.aiStatusItem,
                            item.status === 'failed' && 'border-brand-error/30 text-brand-error',
                            item.status === 'completed' && 'text-brand-success',
                            item.status === 'processing' && 'text-brand-primary'
                          )}
                          type="button"
                          key={clientId}
                         
                          onClick={() => handleSelectQuestion(clientId)}
                        >
                          <span className={cx(
                            bq.aiIcon,
                            item.status === 'completed' && 'bg-[var(--color-success-light)] text-brand-success',
                            item.status === 'failed' && 'bg-brand-error/10 text-brand-error',
                            item.status === 'processing' && 'animate-qtrSpin bg-brand-primary/10 text-brand-primary'
                          )} aria-hidden="true">
                            {item.status === 'completed' ? '✓' : item.status === 'failed' ? '!' : item.status === 'processing' ? '…' : '•'}
                          </span>
                          <span>{item.label}</span>
                          {item.error ? <small className="col-span-full text-[11px] leading-tight text-brand-error">{item.error}</small> : null}
                        </button>
                      ))}
                    </div>
                    {Object.values(aiEnhanceProgress.items).some((item) => item.status === 'failed') ? (
                      <button type="button" className={ui.secondaryAction} onClick={retryFailedAiEnhancement} disabled={aiEnhanceRunning}>
                        Retry failed questions
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className={ui.panelTop}>
              <div>
                <h2>Step 3: Review Queue and Save</h2>
                <p>Review large batches one question at a time. The queue shows what is ready, what needs review, and what is already saved.</p>
              </div>
              <div className={ui.buttonRow}>
                <button className={ui.primaryAction} type="button" onClick={handleSaveCurrentQuestion} disabled={savingCurrent || savingReady || savingAll || !currentQuestion}>
                  {savingCurrent ? 'Saving...' : 'Save Current Question'}
                </button>
                <button type="button" className={ui.secondaryAction} onClick={handleSaveAllReadyQuestions} disabled={savingReady || savingCurrent || savingAll || !questions.length}>
                  {savingReady ? 'Saving Ready...' : 'Save All Ready Questions'}
                </button>
                <button type="button" className={ui.secondaryAction} onClick={handleSaveAllQuestions} disabled={savingAll || savingCurrent || savingReady || !questions.length}>
                  {savingAll ? 'Saving All...' : 'Save All Questions'}
                </button>
                <button type="button" className={ui.secondaryAction} onClick={handleMarkAllReviewed} disabled={!questions.length}>
                  Mark All as Reviewed
                </button>
              </div>
            </div>

            {!loadingMeta && questions.length === 0 ? (
              <div className={ui.emptyBox}>Paste a raw batch, parse it, and the editor queue will appear here with draft recovery turned on.</div>
            ) : null}

            {questions.length > 0 ? (
              <div className={bq.layout}>
                <aside className={bq.sidebar}>
                  <div className={bq.sidebarHead}>
                    <strong className="text-sm text-ink-strong">Question Queue</strong>
                    <span className="text-xs font-bold text-ink-soft">{queueCounts.total} total</span>
                  </div>

                  <div className={bq.queueTools}>
                    <label className={ui.formLabel}>
                      Search Queue
                      <input className={ui.input}
                        value={queueSearch}
                        onChange={(event) => setQueueSearch(event.target.value)}
                        placeholder="Search question text"
                      />
                    </label>

                    <label className={ui.formLabel}>
                      Filter by Status
                      <select className={ui.input} value={queueStatusFilter} onChange={(event) => setQueueStatusFilter(event.target.value)}>
                        <option value="all">All statuses</option>
                        <option value="Ready">Ready</option>
                        <option value="Needs Review">Needs Review</option>
                        <option value="Missing Answer">Missing Answer</option>
                        <option value="Saved">Saved</option>
                      </select>
                    </label>
                  </div>

                  <div className={bq.queueList}>
                    {filteredQueue.map((question, filteredIndex) => {
                      const actualIndex = questions.findIndex((item) => item.clientId === question.clientId);
                      const validation = questionDiagnostics.get(question.clientId)?.validation;
                      const summary = normalizeWhitespace(question.questionText || `Question ${actualIndex + 1}`);
                      const isActive = actualIndex === currentIndex;

                      return (
                        <button className={cx(bq.queueItem, isActive && bq.queueItemActive)}
                          key={question.clientId}
                          type="button"
                         
                          onClick={() => handleSelectQuestion(question.clientId)}
                        >
                          <div className={bq.queueTop}>
                            <strong className="text-[13px] text-ink-strong">Q{actualIndex + 1}</strong>
                            <span className={queueStateClass(validation?.queueStatus)}>
                              {validation?.queueStatus || 'Needs Review'}
                            </span>
                          </div>
                          <p className="m-0 line-clamp-3 break-words text-[13px] leading-[1.55] text-ink-soft [-webkit-box-orient:vertical] [display:-webkit-box]">{summary || 'Untitled question'}</p>
                          <small className="text-[11px] leading-tight text-ink-muted">{question.autoDetectedAnswer ? `Detected answer: ${question.autoDetectedAnswer}` : 'Answer not detected'}</small>
                        </button>
                      );
                    })}
                  </div>

                  <div className={cx(ui.buttonRow, 'justify-between')}>
                    <button type="button" className={ui.secondaryAction} onClick={() => setCurrentIndex((value) => Math.max(value - 1, 0))} disabled={currentIndex === 0}>
                      Previous Question
                    </button>
                    <button type="button" className={ui.secondaryAction} onClick={() => setCurrentIndex((value) => Math.min(value + 1, questions.length - 1))} disabled={currentIndex >= questions.length - 1}>
                      Next Question
                    </button>
                  </div>
                </aside>

                {currentQuestion ? (
                  <div className={bq.editor}>
                    <article className={bq.card}>
                      <div className={bq.cardHead}>
                        <div>
                          <span className={bq.eyebrow}>Question {currentIndex + 1} of {questions.length}</span>
                          <h3 className="m-0 mt-1 text-[22px] text-ink-strong">Current Question Editor</h3>
                        </div>
                        <span className={queueStateClass(currentDiagnostics?.validation.queueStatus)}>
                          {currentDiagnostics?.validation.queueStatus || 'Needs Review'}
                        </span>
                      </div>

                      {currentDiagnostics?.validation.warnings?.length ? (
                        <div className={cx(bq.note, 'border-brand-warning/25 bg-[color-mix(in_srgb,var(--surface-1)_88%,var(--color-warning-light))] text-brand-warning')}>
                          {currentDiagnostics.validation.warnings.map((warning) => (
                            <div key={warning}>{warning}</div>
                          ))}
                        </div>
                      ) : null}

                      {currentDiagnostics?.validation.errors?.length ? (
                        <div className={cx(bq.note, 'border-brand-error/25 bg-[color-mix(in_srgb,var(--surface-1)_88%,var(--color-error-light))] text-brand-error')}>
                          {currentDiagnostics.validation.errors.map((validationError) => (
                            <div key={validationError}>{validationError}</div>
                          ))}
                        </div>
                      ) : null}

                      <label className={ui.formLabel}>
                        Question Text
                        <textarea className={cx(bq.textareaSmall, bq.textareaQuestion)}
                         
                          name="questionText"
                          value={currentQuestion.questionText}
                          onChange={handleQuestionFieldChange}
                        />
                      </label>

                      <div className={bq.gridFour}>
                        <label className={ui.formLabel}>
                          Question Type
                          <select className={ui.input} name="questionType" value={currentQuestion.questionType || globalDefaults.questionType} onChange={handleQuestionFieldChange}>
                            <option value="sba">SBA</option>
                            <option value="true_false">True / False</option>
                          </select>
                        </label>

                        <label className={ui.formLabel}>
                          Category
                          <select className={ui.input} name="category" value={currentQuestion.category || globalDefaults.category} onChange={handleQuestionFieldChange}>
                            <option value="mock">Mock</option>
                            <option value="past_paper">Past Paper</option>
                          </select>
                        </label>

                        <label className={ui.formLabel}>
                          Paper / Source
                          <select className={ui.input} name="paperId" value={currentQuestion.paperId || globalDefaults.paperId} onChange={handleQuestionFieldChange}>
                            <option value="">No paper selected</option>
                            {(meta.papers || []).map((paper) => (
                              <option key={paper.id} value={paper.id}>{paper.paperTitle}</option>
                            ))}
                          </select>
                        </label>

                        <label className={ui.formLabel}>
                          Status
                          <select className={ui.input} name="status" value={currentQuestion.status} onChange={handleQuestionFieldChange}>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        </label>
                      </div>

                      {applyPerQuestionHierarchy ? (
                        <div className={bq.subsection}>
                          <div className="mb-1">Per-question hierarchy override</div>
                          <HierarchySelectors
                            meta={meta}
                            value={currentHierarchyValue}
                            onChange={handleQuestionHierarchyChange}
                            courseRequired
                          />
                        </div>
                      ) : null}

                      <div className={bq.gridTwo}>
                        <label className={ui.formLabel}>
                          Per-question Keywords / Tags
                          <input className={ui.input}
                            list="bulk-question-keywords"
                            name="keywordsText"
                            value={currentQuestion.keywordsText}
                            onChange={handleQuestionFieldChange}
                            placeholder="extra tag, override, grouped-set"
                          />
                        </label>

                        <label className={ui.formLabel}>
                          Optional Internal Group Label
                          <input className={ui.input}
                            name="topicLabel"
                            value={currentQuestion.topicLabel}
                            onChange={handleQuestionFieldChange}
                            placeholder="Batch 01, PM session"
                          />
                        </label>
                      </div>

                      <label className={ui.formLabel}>
                        Explanation
                        <textarea className={cx(bq.textareaSmall, bq.textareaExplanation)}
                         
                          name="explanation"
                          value={currentQuestion.explanation}
                          onChange={handleQuestionFieldChange}
                        />
                      </label>

                      <div className={ui.questionBuilder}>
                        <div className="mb-1">Answer options</div>
                        {currentQuestion.options.map((option, optionIndex) => (
                          <div className={cx(ui.optionBuilderCard, bq.optionCard)} key={option.optionLabel}>
                            <div className={ui.optionBuilderTop}>
                              <strong>{option.optionLabel}</strong>
                              {currentDiagnostics?.resolved.questionType === 'sba' ? (
                                <label className={ui.inlineCheck}>
                                  <input className="shrink-0"
                                    type="radio"
                                    name={`bulk-sba-correct-${currentQuestion.clientId}`}
                                    checked={Number(option.isCorrect) === 1}
                                    onChange={() => handleSbaCorrectChange(option.optionLabel)}
                                  />
                                  Correct
                                </label>
                              ) : (
                                <div className={bq.tfToggle} role="radiogroup" aria-label={`Truth value for statement ${option.optionLabel}`}>
                                  <label className={ui.inlineCheck}>
                                    <input className="shrink-0"
                                      type="radio"
                                      name={`bulk-tf-${currentQuestion.clientId}-${option.optionLabel}`}
                                      checked={Number(option.isCorrect) === 1}
                                      onChange={() => handleTrueFalseCorrectChange(optionIndex, 1)}
                                    />
                                    True
                                  </label>
                                  <label className={ui.inlineCheck}>
                                    <input className="shrink-0"
                                      type="radio"
                                      name={`bulk-tf-${currentQuestion.clientId}-${option.optionLabel}`}
                                      checked={Number(option.isCorrect) === 0}
                                      onChange={() => handleTrueFalseCorrectChange(optionIndex, 0)}
                                    />
                                    False
                                  </label>
                                </div>
                              )}
                            </div>
                            <textarea className={cx(bq.textareaSmall, bq.textareaOption)}
                             
                              value={option.optionText}
                              onChange={(event) => handleOptionTextChange(optionIndex, event.target.value)}
                              placeholder={currentDiagnostics?.resolved.questionType === 'sba' ? `Option ${option.optionLabel}` : `Statement ${option.optionLabel}`}
                            />
                            <label className={ui.formLabel}>
                              {currentDiagnostics?.resolved.questionType === 'sba'
                                ? `Why option ${option.optionLabel} is incorrect`
                                : 'Statement Explanation'}
                              <textarea className={bq.textareaSmall}
                               
                                value={option.whyIncorrect || option.optionExplanation || ''}
                                onChange={(event) => handleOptionExplanationChange(optionIndex, event.target.value)}
                                placeholder={currentDiagnostics?.resolved.questionType === 'sba' && Number(option.isCorrect) === 1
                                  ? 'Correct option can be left blank'
                                  : 'Optional but recommended. Explain why this option is wrong.'}
                                disabled={currentDiagnostics?.resolved.questionType === 'sba' && Number(option.isCorrect) === 1}
                              />
                            </label>
                          </div>
                        ))}
                      </div>
                    </article>

                    {currentQuestion?.savedId ? (
                      <div className={bq.recap}>
                        <TheoryRecapAdminSection
                          recap={recap}
                          loading={recapLoading}
                          saving={recapSaving}
                          generating={recapGenerating}
                          error={recapError}
                          onSave={handleBulkRecapSave}
                          onGenerate={handleBulkRecapGenerate}
                          onDelete={handleBulkRecapDelete}
                        />
                      </div>
                    ) : (
                      <div className={bq.recapUnsaved}>
                        <span aria-hidden="true">⚡</span>
                        Save this question first to add a Theory Recap.
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>

        <datalist id="bulk-question-keywords">
          {(meta.keywordSuggestions || []).map((keyword) => (
            <option key={keyword} value={keyword} />
          ))}
        </datalist>
      </section>
    </main>
  );
}
