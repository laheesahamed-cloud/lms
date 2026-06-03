import { createQuestion, updateQuestion } from '../../../../shared/api/questions.api.js';

const optionLabels = ['A', 'B', 'C', 'D', 'E'];

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
    .replace(/^\s*(?:question|ques|q)\s*\d+\s*[.):_-]?\s*/i, '')
    .replace(/^\s*\d+\s*[.):_-]\s*/i, '')
    .trim();
}

function detectOptionLine(line) {
  return String(line || '').match(/^\s*([A-Ea-e])\s*[.)_: -]\s*(.*?)\s*$/);
}

function detectAnswerLine(line) {
  return String(line || '').match(/^\s*(?:correct\s*answer|answer)\s*[:-]?\s*([A-Ea-e]|true|false)\b/i);
}

function detectExplanationLine(line) {
  return String(line || '').match(/^\s*(?:answer\s+explanation|explanation)\s*[:-]?\s*(.*)$/i);
}

function detectWhyIncorrectHeader(line) {
  return String(line || '').match(/^\s*(?:why\s+(?:other\s+answers\s+are\s+)?incorrect|why\s+incorrect|incorrect\s+answers?)\s*[:-]?\s*(.*)$/i);
}

function detectWhyIncorrectLine(line) {
  return String(line || '').match(/^\s*([A-Ea-e])\s*[:-]\s*(.*?)\s*$/);
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
    throw new Error('This JSON could not be parsed. Check commas, quotes, and any extra pasted markup.', { cause: error });
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
    let options;

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

export function buildHierarchyCollections(meta, hierarchy) {
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
