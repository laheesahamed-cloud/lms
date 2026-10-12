import { createQuestion, updateQuestion } from '../../../../shared/api/questions.api.js';
import { upsertTheoryRecap } from '../../../../shared/api/theoryRecap.api.js';

const optionLabels = ['A', 'B', 'C', 'D', 'E'];

/// THE FULL FORMAT — the brief AND an example, because it is copied to the
/// clipboard to brief an author or an AI, not just to show a shape.
///
/// A SUPERSET of [sampleJsonFormat], never a replacement. `approach` and
/// `theory` are read when present and ignored when absent, so every file
/// written against the older shape keeps importing unchanged.
///
/// The rules below are not invented here. They are what the app's own
/// generators ask for — buildApproachPrompt and buildTheoryRecapPrompt in
/// ai.service.ts — so a hand-written or externally generated file produces the
/// same thing the Generate buttons would, and the two cannot drift.
///
/// The leading prose is safe: extractJsonPayload finds the first bracket, so
/// this whole block can be pasted straight back into the input box.
export const fullJsonFormat = `HOW TO WRITE THIS FILE
======================
Return a JSON array of question objects. Everything below is one object.

QUESTION
  question_type   "sba" or "true_false"
  options         SBA: A-E, each with is_correct and why_incorrect.
                  why_incorrect is required on every WRONG option - it is
                  what the student reads after answering.
  statements      true_false only: 5 statements, each with answer True/False
                  and its own explanation.
  explanation     Why the correct answer is correct, overall.

APPROACH  (how to read the stem - NOT why the options are right or wrong)
  approach              A NUMBERED LIST: "1. ...\\n2. ...\\n3. ..."
                        Walk the stem CLUE BY CLUE, in the order the details
                        appear in the question. For each clue say what it
                        signals and why the examiner put it there. Call out
                        anything that is a red herring or a distractor rather
                        than a real clue. Finish by chaining the clues to the
                        answer - do not restate the answer explanation.
  approach_highlights   3 to 8 short phrases copied VERBATIM from the question
                        text, as exact substrings. The app finds them in the
                        stem and highlights them, so a paraphrase is silently
                        dropped - it must match character for character.

QUICK THEORY  (the concept behind the question, not the question)
  theory.concept        The disease or concept being tested.
  theory lists          etiology, pathophysiology, clinical_features,
                        investigations, treatment, key_points.
                        3 to 6 bullets each. Short, exam-focused.
                        clinical_features covers symptoms, signs AND
                        examination findings.
  theory.mnemonic       One short memory aid, or omit it.
  Do NOT repeat the question or the options here - summarise the concept.

A list may be a JSON array or one item per line. Omit anything you have not
written; an empty theory block is ignored rather than saved as a blank card.

EXAMPLE
=======
${JSON.stringify([
  {
    question_number: 1,
    question_type: 'sba',
    topic: 'Acute coronary syndrome',
    question:
      'A 58-year-old man has 40 minutes of crushing central chest pain radiating '
      + 'to the jaw. His ECG shows ST elevation in leads II, III and aVF. He took '
      + 'sublingual GTN with no relief. He is otherwise well and the nearest PCI '
      + 'centre is 30 minutes away. What is the single best immediate management?',
    options: [
      { label: 'A', text: 'Primary percutaneous coronary intervention', is_correct: true, why_incorrect: null },
      { label: 'B', text: 'Thrombolysis', is_correct: false, why_incorrect: 'Only when primary PCI cannot be delivered within 120 minutes of diagnosis. Here it can.' },
      { label: 'C', text: 'Oral beta blocker and discharge', is_correct: false, why_incorrect: 'Does not reopen the occluded artery, and discharge in an evolving STEMI risks death.' },
      { label: 'D', text: 'Exercise tolerance test', is_correct: false, why_incorrect: 'Contraindicated in an acute coronary syndrome - it provokes ischaemia in an already occluded territory.' },
      { label: 'E', text: 'Repeat the ECG in 6 hours', is_correct: false, why_incorrect: 'ST elevation with ongoing pain is already diagnostic. Waiting loses viable myocardium.' },
    ],
    correct_answer: 'A',
    explanation:
      'Inferior ST elevation with ongoing ischaemic pain is a STEMI. Primary PCI '
      + 'is the reperfusion strategy of choice whenever it can be delivered within '
      + '120 minutes of diagnosis.',
    keywords: ['STEMI', 'reperfusion', 'inferior MI'],

    approach:
      '1. "A 58-year-old man" - age and sex put him in the group where '
      + 'atherosclerotic coronary disease is the first thing to consider, so the '
      + 'examiner is steering you towards an ischaemic cause from the first line.\n'
      + '2. "40 minutes of crushing central chest pain" - the character and the '
      + 'duration matter. Beyond about 20 minutes this is no longer stable angina; '
      + 'the examiner is telling you infarction is underway.\n'
      + '3. "ST elevation in leads II, III and aVF" - the single decisive clue. '
      + 'Those three leads are the inferior territory, so this is an inferior '
      + 'STEMI, usually a right coronary artery occlusion.\n'
      + '4. "sublingual GTN with no relief" - confirms it. Stable angina settles '
      + 'with GTN; an occluded artery does not.\n'
      + '5. "he is otherwise well" - a red herring. It tempts you towards a less '
      + 'urgent answer, but it changes nothing about an evolving infarct.\n'
      + '6. "the nearest PCI centre is 30 minutes away" - this is what the question '
      + 'is really testing. Thrombolysis is only for when PCI is out of reach '
      + 'within 120 minutes. It is reachable, so the chain ends at primary PCI.',
    approach_highlights: [
      '40 minutes of crushing central chest pain',
      'ST elevation in leads II, III and aVF',
      'sublingual GTN with no relief',
      'he is otherwise well',
      'nearest PCI centre is 30 minutes away',
    ],

    theory: {
      concept: 'ST-elevation myocardial infarction',
      course: 'Medicine',
      subject: 'Cardiology',
      topic: 'Acute coronary syndrome',
      lesson: 'STEMI',
      etiology: [
        'Atherosclerotic plaque rupture or erosion (the great majority)',
        'Coronary embolism, for example from atrial fibrillation or endocarditis',
        'Coronary dissection, including spontaneous dissection in younger women',
        'Coronary spasm, classically cocaine-related',
      ],
      pathophysiology: [
        'A vulnerable plaque ruptures and exposes its thrombogenic lipid core',
        'Platelets adhere and aggregate, and the clotting cascade is activated',
        'An occlusive thrombus forms and blood flow stops distally',
        'Ischaemia spreads from endocardium to epicardium, giving transmural injury',
        'Transmural injury produces ST elevation in the leads facing that territory',
        'Myocyte necrosis begins within 20-30 minutes and spreads with every minute',
      ],
      clinical_features: [
        'Crushing or heavy central chest pain, often radiating to jaw or left arm',
        'Lasting more than 20 minutes and not relieved by rest or GTN',
        'Autonomic features: sweating, nausea, vomiting, breathlessness',
        'Signs of failure: raised JVP, basal crackles, third heart sound',
        'Inferior infarcts may show bradycardia or hypotension from vagal tone or RV involvement',
      ],
      investigations: [
        '12-lead ECG within 10 minutes of arrival - the decision-making test',
        'Right-sided leads V4R in an inferior STEMI, to catch RV infarction',
        'High-sensitivity troponin, which confirms but must never delay reperfusion',
        'Bedside echocardiography for regional wall motion abnormality',
        'Coronary angiography, both diagnostic and the route to treatment',
      ],
      treatment: [
        'Primary PCI if it can be delivered within 120 minutes of diagnosis',
        'Thrombolysis if it cannot, followed by transfer for angiography',
        'Dual antiplatelet therapy: aspirin plus a P2Y12 inhibitor',
        'Anticoagulation during the procedure',
        'Secondary prevention: statin, ACE inhibitor, beta blocker, cardiac rehabilitation',
      ],
      key_points: [
        'Time is muscle - every minute of delay costs viable myocardium',
        'II, III and aVF means inferior, and inferior means check the right side',
        'Avoid nitrates and be careful with opiates if the right ventricle is involved',
        'A normal troponin early does not exclude a STEMI; the ECG decides',
      ],
      mnemonic: 'MONA-B is supportive, reperfusion is definitive',
    },
  },
], null, 2)}`;

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
    // "How to approach this question" — the student-facing reasoning
    // walkthrough, and the stem phrases it quotes. Blank until AI fills them,
    // but they have to exist on the object or the save payload silently drops
    // whatever gets generated.
    questionApproach: '',
    questionApproachHighlights: [],
    // Quick theory, when the JSON carried a `theory` block. Declared here for
    // the same reason as the two above: a field absent from the object is one
    // the save path cannot see.
    theoryRecap: null,
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
      questionApproach: normalizeWhitespace(
        source.questionApproach || source.approach || ''
      ),
      // snake_case too: the rest of this format is snake_case, so an author
      // writing approach_highlights alongside correct_answer and why_incorrect
      // is following the file's own convention, not getting it wrong.
      questionApproachHighlights: [
        source.questionApproachHighlights,
        source.approachHighlights,
        source.approach_highlights,
      ].reduce(
        (found, candidate) => (found.length || !Array.isArray(candidate)
          ? found
          : candidate.map(normalizeWhitespace).filter(Boolean)),
        [],
      ),
      options,
      parserConfidence: warnings.length ? 'medium' : 'high',
      parserWarnings: warnings,
      autoDetectedAnswer: questionType === 'true_false'
        ? (options.every((option) => option.optionText) ? 'JSON answer map loaded' : '')
        : (options.find((option) => Number(option.isCorrect) === 1)?.optionLabel || ''),
      sourceSnippet: JSON.stringify(source, null, 2),
      topicLabel: normalizeWhitespace(source.topic || ''),
      // Carried alongside the question, not merged into it: a recap lives in
      // its own table keyed by question_id, so it can only be written once the
      // question has been saved and has an id. Null when the JSON had none,
      // which is every file written against the older format.
      theoryRecap: parseTheoryBlock(source.theory || source.quickTheory || source.quick_theory),
      reviewed: false,
    });
  });
}

/// The `theory` block of a question, in the shape UpsertTheoryRecapDto wants.
///
/// Every field is optional and the whole block is optional. Returns null when
/// there is nothing usable, so the caller can simply skip the second request.
export function parseTheoryBlock(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  // Authors write these either as a JSON array or as one item per line — the
  // second is what you get pasting out of a document, and rejecting it would
  // fail a file for a reason that has nothing to do with its content.
  const list = (value) => {
    if (Array.isArray(value)) {
      return value.map((v) => normalizeWhitespace(String(v ?? ''))).filter(Boolean);
    }
    if (typeof value === 'string') {
      return value
          .split('\n')
          .map((line) => normalizeWhitespace(line.replace(/^[-*\u2022]\s*/, '')))
          .filter(Boolean);
    }
    return [];
  };

  const recap = {
    conceptName: normalizeWhitespace(raw.concept || raw.conceptName || raw.concept_name || ''),
    hierarchyCourse: normalizeWhitespace(raw.course || raw.hierarchyCourse || ''),
    hierarchySubject: normalizeWhitespace(raw.subject || raw.hierarchySubject || ''),
    hierarchyTopic: normalizeWhitespace(raw.topic || raw.hierarchyTopic || ''),
    hierarchyLesson: normalizeWhitespace(raw.lesson || raw.hierarchyLesson || ''),
    etiology: list(raw.etiology || raw.aetiology),
    pathophysiology: list(raw.pathophysiology),
    clinicalFeatures: list(raw.clinical_features || raw.clinicalFeatures),
    investigations: list(raw.investigations),
    treatment: list(raw.treatment || raw.management),
    keyPoints: list(raw.key_points || raw.keyPoints),
    mnemonic: normalizeWhitespace(raw.mnemonic || ''),
  };

  // A block of entirely empty fields is not a recap, and saving one would put
  // an empty card in front of a student.
  const hasContent = Object.values(recap)
      .some((v) => (Array.isArray(v) ? v.length > 0 : Boolean(v)));
  return hasContent ? recap : null;
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

/**
 * Whether a question has enough in it for the AI to write about.
 *
 * Deliberately NOT the same bar as saving. Drafting an explanation, a
 * why-incorrect or an approach needs the stem, the options and which one is
 * right — the course, subject and category are optional context the endpoint
 * does not require, and the five-option rule is a house style for the bank,
 * not something the model needs.
 *
 * Gating generation on save-validity meant most of a freshly pasted batch was
 * refused before a single call went out: the defaults hadn't been picked yet,
 * or the source had four options. Nothing was wrong with those questions that
 * the AI couldn't have worked with.
 *
 * Saving is still gated on validateQuestion — this only decides whether it is
 * worth asking the model.
 */
export function aiReadiness(question, resolved) {
  const missing = [];
  if (!normalizeWhitespace(question.questionText)) missing.push('question text');

  const filled = (question.options || []).filter((o) => normalizeWhitespace(o.optionText));
  if (filled.length < 2) missing.push('at least two options');

  const correct = filled.filter((o) => Number(o.isCorrect) === 1);
  if (resolved.questionType === 'sba' && correct.length !== 1) {
    missing.push('exactly one correct answer marked');
  } else if (resolved.questionType !== 'sba' && correct.length < 1) {
    missing.push('the correct answer marked');
  }

  return { ready: missing.length === 0, missing };
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

  // A past paper is sat across a WHOLE COURSE, not one subject, so its
  // questions do not have to belong to one — questions.topic_id is nullable in
  // the schema and always has been; only this check insisted. It stays
  // available for anyone who does want to file a paper question by subject.
  if (!resolved.subjectId && resolved.category !== 'past_paper') {
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
    questionApproach: normalizeWhitespace(question.questionApproach || ''),
    questionApproachHighlights: (question.questionApproachHighlights || []).join('|'),
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
    // null, not 0. Number('') is 0, and a past-paper question saved without a
    // subject would otherwise store topic_id = 0 — an id pointing at no row,
    // which reads as "has a subject" to every query that checks for one.
    subjectId: resolved.subjectId ? Number(resolved.subjectId) : null,
    topicId: resolved.topicId ? Number(resolved.topicId) : null,
    lessonId: resolved.lessonId ? Number(resolved.lessonId) : null,
    paperId: resolved.paperId ? Number(resolved.paperId) : null,
    topicLabel: question.topicLabel || '',
    category: resolved.category,
    questionType: resolved.questionType,
    questionText: question.questionText,
    keywordsText: resolved.keywordsText,
    explanation: buildCombinedExplanation(question),
    questionApproach: question.questionApproach || '',
    questionApproachHighlights: Array.isArray(question.questionApproachHighlights)
      ? question.questionApproachHighlights
      : [],
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
    const theoryWarning = await saveTheoryRecap(question.savedId, question.theoryRecap);
    return { savedId: question.savedId, signature, theoryWarning };
  }

  const result = await createQuestion(payload);
  const savedId = Number(result.id);
  const theoryWarning = await saveTheoryRecap(savedId, question.theoryRecap);
  return { savedId, signature, theoryWarning };
}

/// Writes the quick theory, if the JSON carried any.
///
/// A SECOND request, necessarily: question_theory_recaps is keyed by
/// question_id, so there is nothing to attach a recap to until the question
/// itself has been created.
///
/// A failure here returns a warning rather than throwing. The question is
/// already saved by this point, and turning that into an error would leave the
/// author believing nothing was written while the question sat in the bank —
/// far worse than telling them the recap needs a retry.
async function saveTheoryRecap(questionId, recap) {
  if (!questionId || !recap) return '';
  try {
    await upsertTheoryRecap(questionId, recap);
    return '';
  } catch (error) {
    const detail = error?.response?.data?.message || error?.message || '';
    return `The question saved, but its quick theory did not${detail ? `: ${detail}` : '.'}`;
  }
}
