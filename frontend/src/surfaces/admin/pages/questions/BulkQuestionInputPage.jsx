import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchQuestionsMeta } from '../../../../shared/api/questions.api.js';
import {
  deleteTheoryRecap,
  fetchTheoryRecap,
  generateTheoryRecap,
  regenerateTheoryRecap,
  upsertTheoryRecap,
} from '../../../../shared/api/theoryRecap.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import {
  generateQuestionExplanation,
  generateWhyIncorrectExplanations,
} from '../../../../shared/api/ai.api.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { TheoryRecapAdminSection } from './QuestionsPage.jsx';
import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';
import { hasUnsafeFileNameCharacters } from '../../../../shared/utils/fileValidation.js';
import {
  buildGlobalDefaults,
  buildHierarchyCollections,
  createEmptyQuestion,
  normalizeWhitespace,
  parseJsonQuestions,
  parseRawQuestions,
  resolveQuestion,
  sampleJsonFormat,
  saveQuestionRecord,
  validateQuestion,
} from './bulkQuestionInputUtils.js';

const draftStorageKey = 'lms.bulk-question-draft.v2';
const DRAFT_JSON_MAX_BYTES = 2 * 1024 * 1024;

function validateDraftJsonFile(file) {
  if (!file) return '';
  const name = String(file.name || '').trim();
  const type = String(file.type || '').toLowerCase();
  if (!name.toLowerCase().endsWith('.json') || (type && type !== 'application/json')) {
    return 'Import a JSON draft file exported from this bulk question tool.';
  }
  if (file.size > DRAFT_JSON_MAX_BYTES) {
    return 'Draft JSON is too large. Upload a file under 2 MB.';
  }
  if (!name || name.length > 180 || hasUnsafeFileNameCharacters(name)) {
    return 'Rename the JSON file without special path characters, then import again.';
  }
  return '';
}

function persistBulkQuestionDraft(payload) {
  try {
    window.localStorage.setItem(draftStorageKey, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

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
  const draftSaveTimerRef = useRef(null);
  const draftPayloadRef = useRef(null);
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
    if (draftSaveTimerRef.current) {
      window.clearTimeout(draftSaveTimerRef.current);
      draftSaveTimerRef.current = null;
    }

    if (!questions.length && !rawInput.trim()) {
      draftPayloadRef.current = null;
      return undefined;
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
    draftPayloadRef.current = payload;

    draftSaveTimerRef.current = window.setTimeout(() => {
      persistBulkQuestionDraft(payload);
      draftSaveTimerRef.current = null;
    }, 350);

    return undefined;
  }, [applyPerQuestionHierarchy, currentIndex, globalDefaults, inputMode, queueSearch, queueStatusFilter, questions, rawInput]);

  useEffect(() => () => {
    if (draftSaveTimerRef.current && draftPayloadRef.current) {
      window.clearTimeout(draftSaveTimerRef.current);
      draftSaveTimerRef.current = null;
      persistBulkQuestionDraft(draftPayloadRef.current);
    }
  }, []);

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
  }, [currentQuestion?.savedId, recapForId]);

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
    persistBulkQuestionDraft(payload);
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
    if (!window.confirm('Start a new bulk import workspace and clear the current draft?')) return;
    resetWorkspace(true);
    setToast('Started a new bulk import workspace.');
  }

  function handleDeleteDraft() {
    if (!window.confirm('Delete the stored bulk import draft?')) return;
    window.localStorage.removeItem(draftStorageKey);
    setDraftSnapshot(null);
    setToast('Stored draft deleted.');
  }

  function handleClearDraft() {
    if (!window.confirm('Clear the current bulk import draft?')) return;
    resetWorkspace(true);
    setToast('Current bulk import draft cleared.');
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
    let parsedQuestions;

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
    const validationError = validateDraftJsonFile(file);
    if (validationError) {
      setError(validationError);
      event.target.value = '';
      return;
    }

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
          subtitle="Question Import"
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
              <button className={cx(bq.modeButton, inputMode === 'text' ? 'border border-brand-primary/35 bg-[var(--color-primary-light)] text-brand-primary' : 'bg-transparent text-ink-soft hover:bg-surface-3 hover:text-ink-strong')}
                type="button"
               
                onClick={() => setInputMode('text')}
              >
                Paste Text
              </button>
              <button className={cx(bq.modeButton, inputMode === 'json' ? 'border border-brand-primary/35 bg-[var(--color-primary-light)] text-brand-primary' : 'bg-transparent text-ink-soft hover:bg-surface-3 hover:text-ink-strong')}
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
                <button type="button" className={ui.dangerAction} onClick={handleClearDraft}>Clear Draft</button>
                <input className="shrink-0"
                  ref={draftImportRef}
                  type="file"
                  accept=".json,application/json"
                  style={{ display: 'none' }}
                  onChange={handleImportDraftFile}
                  aria-label="Import bulk question draft JSON"
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
                      <span className="block h-full w-full origin-left rounded-full bg-[var(--brand-gradient-primary)] transition-transform duration-200" style={{ transform: `scaleX(${Math.round((aiEnhanceProgress.completed / aiEnhanceProgress.total) * 100) / 100})` }} />
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
                <h2>Step 3: Check and Save</h2>
                <p>Check large batches one question at a time. The list shows what is ready, what needs fixing, and what is already saved.</p>
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
                    {filteredQueue.map((question) => {
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
                              aria-label={currentDiagnostics?.resolved.questionType === 'sba' ? `Option ${option.optionLabel} text` : `Statement ${option.optionLabel} text`}
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
