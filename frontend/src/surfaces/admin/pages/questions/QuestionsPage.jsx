import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  createQuestion,
  bulkDeleteQuestions,
  bulkUpdateQuestionKeywords,
  deleteQuestion,
  exportQuestions,
  fetchQuestion,
  fetchQuestions,
  fetchQuestionsMeta,
  importQuestions,
  updateQuestion,
} from '../../../../shared/api/questions.api.js';
import {
  deleteTheoryRecap,
  fetchTheoryRecap,
  generateTheoryRecap,
  regenerateTheoryRecap,
  upsertTheoryRecap,
} from '../../../../shared/api/theoryRecap.api.js';
import { hasUnsafeFileNameCharacters } from '../../../../shared/utils/fileValidation.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import {
  generateQuestionExplanation,
  generateQuestionTheoryCard,
  generateWhyIncorrectExplanations,
} from '../../../../shared/api/ai.api.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { MedicalText } from '../../../../shared/components/MedicalText.jsx';
import { DeleteActionIcon, EditActionIcon } from '../../../../shared/ui/ActionIcons.jsx';
import { FeedbackNotice } from '../../../../shared/ui/FeedbackNotice.jsx';
import { cx, statusPill, ui } from '../../../../shared/styles/tailwindClasses.js';

const recapAdminSectionClass = 'mt-1 overflow-hidden rounded-lg border border-line-soft bg-surface-1';
const recapToggleClass = 'flex w-full items-center gap-2.5 border-0 bg-transparent px-3.5 py-3 text-left font-inherit text-inherit transition hover:bg-surface-2';
const recapToggleIconClass = 'shrink-0 text-[15px]';
const recapToggleLabelClass = 'flex-1 text-[13.5px] font-semibold text-ink-strong';
const recapToggleChevronClass = 'shrink-0 text-[11px] text-ink-muted';
const recapBadgeClass = 'rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize';
const recapBadgeExistsClass = 'bg-brand-primary/15 text-brand-primary';
const recapBadgeNoneClass = 'border border-line-soft bg-surface-2 text-ink-muted';
const recapBodyClass = 'flex flex-col gap-3.5 border-t border-line-soft px-4 py-3.5';
const recapLoadingClass = 'm-0 text-[13px] text-ink-soft';
const recapHierarchyGridClass = 'grid grid-cols-2 gap-2.5 max-[600px]:grid-cols-1';
const recapHintClass = 'ml-1 text-[11px] font-normal text-ink-muted';
const questionModalInlineNoteClass = 'mx-6 mt-5 rounded-lg border border-brand-primary/15 bg-brand-primary/5 px-4 py-3 text-[13px] leading-relaxed text-ink-soft max-[600px]:mx-4';
const questionModalFormClass = 'gap-[18px] px-6 pb-6 max-[600px]:px-4';
const questionModalRecapPanelClass = 'px-6 pb-6 max-[600px]:px-4';
const bulkSelectBarClass =
  'mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line-soft bg-surface-2 px-4 py-3 text-sm text-ink-medium';
const tableCheckboxClass =
  'size-5 cursor-pointer rounded border-line-medium accent-brand-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-primary/20 max-[767px]:size-11 max-[767px]:rounded-lg';
const bulkWarningClass =
  'rounded-lg border border-brand-warning/25 bg-[var(--color-warning-light)] px-4 py-3 text-[13px] leading-relaxed text-ink-medium';
const bulkKeywordGridClass = 'grid gap-3 px-5 py-4';
const questionPreviewButtonClass =
  'block w-full rounded-lg border-0 bg-transparent p-0 text-left font-inherit text-inherit transition hover:text-brand-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-primary/20';
const detailMetaGridClass = 'grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3';
const detailMetaCardClass = 'rounded-lg border border-line-soft bg-surface-2 px-3.5 py-3';
const detailMetaLabelClass = 'block text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted';
const detailMetaValueClass = 'mt-1 block text-[13px] font-semibold text-ink-strong';
const detailPanelClass = 'rounded-xl border border-line-soft bg-surface-1 p-4';
const detailPanelTitleClass = 'mb-2 block text-sm font-extrabold text-ink-strong';
const detailOptionClass = 'rounded-lg border border-line-soft bg-surface-2 px-3.5 py-3';
const detailCorrectOptionClass = 'border-brand-success/35 bg-brand-success/10';
const detailIncorrectOptionClass = 'border-brand-error/25 bg-brand-error/10';
const detailRecapListClass = 'm-0 grid gap-1.5 pl-5 text-[13px] leading-relaxed text-ink-medium';

const optionLabels = ['A', 'B', 'C', 'D', 'E'];
const QUESTION_IMPORT_MAX_BYTES = 2 * 1024 * 1024;
const QUESTION_IMPORT_MIME_TYPES = new Set(['', 'text/csv', 'application/csv', 'application/vnd.ms-excel']);

function validateQuestionImportFile(file) {
  if (!file) return '';
  const name = String(file.name || '').trim();
  const type = String(file.type || '').toLowerCase();
  if (!name.toLowerCase().endsWith('.csv') || !QUESTION_IMPORT_MIME_TYPES.has(type)) {
    return 'Import a CSV file exported from the question bank.';
  }
  if (file.size > QUESTION_IMPORT_MAX_BYTES) {
    return 'Question CSV is too large. Upload a file under 2 MB.';
  }
  if (!name || name.length > 180 || hasUnsafeFileNameCharacters(name)) {
    return 'Rename the CSV without special path characters, then import again.';
  }
  return '';
}

function buildOptions(questionType = 'sba', incomingOptions = []) {
  const optionMap = new Map(
    incomingOptions.map((option) => [String(option.optionLabel || '').trim().toUpperCase(), option])
  );

  return optionLabels.map((label) => {
    const existing = optionMap.get(label);
    return {
      optionLabel: label,
      optionText: existing?.optionText || '',
      isCorrect:
        questionType === 'true_false'
          ? Number(existing?.isCorrect) === 1
            ? 1
            : 0
          : Number(existing?.isCorrect) === 1 && label === existing?.optionLabel
            ? 1
            : 0,
      whyIncorrect: existing?.whyIncorrect || existing?.why_incorrect || '',
    };
  });
}

function buildDefaultForm() {
  return {
    courseId: '',
    subjectId: '',
    topicId: '',
    lessonId: '',
    paperId: '',
    topicLabel: '',
    examSource: 'local',
    category: 'mock',
    questionType: 'sba',
    questionText: '',
    keywordsText: '',
    explanation: '',
    status: 'active',
    options: buildOptions('sba'),
  };
}

function mapQuestionToForm(question) {
  const questionType = question.questionType || 'sba';
  return {
    courseId: question.courseId ? String(question.courseId) : '',
    subjectId: question.subjectId ? String(question.subjectId) : '',
    topicId: question.topicId ? String(question.topicId) : '',
    lessonId: question.lessonId ? String(question.lessonId) : '',
    paperId: question.paperId ? String(question.paperId) : '',
    topicLabel: question.topicLabel || '',
    examSource: question.examSource || 'local',
    category: question.category || 'mock',
    questionType,
    questionText: question.questionText || '',
    keywordsText: question.keywordsText || '',
    explanation: question.explanation || '',
    status: question.status || 'active',
    options: buildOptions(questionType, question.options || []),
  };
}

function textToArray(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizeRecapArray(value) {
  if (Array.isArray(value)) {
    return value.map(String).map((line) => line.trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return textToArray(value);
  }
  return [];
}

function normalizeTheoryRecap(recap) {
  if (!recap) return null;
  return {
    ...recap,
    conceptName: recap.conceptName || recap.concept_name || '',
    hierarchy: {
      course: recap.hierarchy?.course || recap.hierarchyCourse || recap.hierarchy_course || '',
      subject: recap.hierarchy?.subject || recap.hierarchySubject || recap.hierarchy_subject || '',
      topic: recap.hierarchy?.topic || recap.hierarchyTopic || recap.hierarchy_topic || '',
      lesson: recap.hierarchy?.lesson || recap.hierarchyLesson || recap.hierarchy_lesson || '',
    },
    etiology: normalizeRecapArray(recap.etiology),
    pathophysiology: normalizeRecapArray(recap.pathophysiology),
    clinicalFeatures: normalizeRecapArray(recap.clinicalFeatures || recap.clinical_features),
    investigations: normalizeRecapArray(recap.investigations),
    treatment: normalizeRecapArray(recap.treatment),
    keyPoints: normalizeRecapArray(recap.keyPoints || recap.key_points),
    mnemonic: recap.mnemonic || '',
    reviewedStatus: recap.reviewedStatus || recap.reviewed_status || 'pending',
  };
}

function recapToUpsertPayload(recap) {
  const normalized = normalizeTheoryRecap(recap);
  if (!normalized) return null;
  return {
    conceptName: normalized.conceptName,
    hierarchyCourse: normalized.hierarchy.course,
    hierarchySubject: normalized.hierarchy.subject,
    hierarchyTopic: normalized.hierarchy.topic,
    hierarchyLesson: normalized.hierarchy.lesson,
    etiology: normalized.etiology,
    pathophysiology: normalized.pathophysiology,
    clinicalFeatures: normalized.clinicalFeatures,
    investigations: normalized.investigations,
    treatment: normalized.treatment,
    keyPoints: normalized.keyPoints,
    mnemonic: normalized.mnemonic,
    reviewedStatus: normalized.reviewedStatus,
  };
}

function adminFieldsToRecap(fields) {
  return {
    conceptName: fields.conceptName || '',
    hierarchy: {
      course: fields.hierarchyCourse || '',
      subject: fields.hierarchySubject || '',
      topic: fields.hierarchyTopic || '',
      lesson: fields.hierarchyLesson || '',
    },
    etiology: textToArray(fields.etiology || ''),
    pathophysiology: textToArray(fields.pathophysiology || ''),
    clinicalFeatures: textToArray(fields.clinicalFeatures || ''),
    investigations: textToArray(fields.investigations || ''),
    treatment: textToArray(fields.treatment || ''),
    keyPoints: textToArray(fields.keyPoints || ''),
    mnemonic: fields.mnemonic || '',
    reviewedStatus: fields.reviewedStatus || 'pending',
  };
}

const questionInitialFilters = { search: '', status: '', type: '', category: '', unclassified: '', usage: '', keywords: '', courseId: '', subjectId: '', topicId: '', lessonId: '', paperId: '' };

export function QuestionsPage() {
  const navigate = useNavigate();
  const importInputRef = useRef(null);
  const [questions, setQuestions] = useState([]);
  const [meta, setMeta] = useState({ courses: [], subjects: [], topics: [], lessons: [], papers: [], keywordSuggestions: [] });
  const [filters, setFilters] = useState(questionInitialFilters);
  const [form, setForm] = useState(buildDefaultForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingQuestionId, setLoadingQuestionId] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailQuestion, setDetailQuestion] = useState(null);
  const [detailRecap, setDetailRecap] = useState(null);
  const [detailLoadingId, setDetailLoadingId] = useState(null);
  const [detailError, setDetailError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkKeywordSaving, setBulkKeywordSaving] = useState(false);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState(() => new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkKeywordOpen, setBulkKeywordOpen] = useState(false);
  const [bulkKeywordForm, setBulkKeywordForm] = useState({ keywordsText: '', mode: 'append' });
  const [toast, setToast] = useState(null);
  const [error, setError] = useState('');
  const [recap, setRecap] = useState(null);
  const [recapLoading] = useState(false);
  const [recapSaving, setRecapSaving] = useState(false);
  const [recapGenerating, setRecapGenerating] = useState(false);
  const [whyGenerating, setWhyGenerating] = useState(false);
  const [explanationGenerating, setExplanationGenerating] = useState(false);
  const [learningContentGenerating, setLearningContentGenerating] = useState(false);
  const [recapError, setRecapError] = useState('');

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setToast(null);
    }, 3200);

    return () => window.clearTimeout(timeout);
  }, [toast]);

  const visibleSubjects = useMemo(
    () => meta.subjects.filter((subject) => String(subject.courseId) === String(form.courseId || '')),
    [meta.subjects, form.courseId]
  );

  const visibleTopics = useMemo(
    () => meta.topics.filter((topic) => String(topic.subjectId) === String(form.subjectId || '')),
    [meta.topics, form.subjectId]
  );

  const visibleLessons = useMemo(
    () =>
      meta.lessons.filter(
        (lesson) =>
          String(lesson.subjectId) === String(form.subjectId || '') &&
          (form.topicId ? String(lesson.topicId || '') === String(form.topicId) : true)
      ),
    [meta.lessons, form.subjectId, form.topicId]
  );
  const filterSubjects = useMemo(
    () => meta.subjects.filter((subject) => !filters.courseId || String(subject.courseId) === String(filters.courseId)),
    [meta.subjects, filters.courseId]
  );
  const filterTopics = useMemo(
    () => meta.topics.filter((topic) =>
      (!filters.courseId || String(topic.courseId) === String(filters.courseId)) &&
      (!filters.subjectId || String(topic.subjectId) === String(filters.subjectId))
    ),
    [meta.topics, filters.courseId, filters.subjectId]
  );
  const filterLessons = useMemo(
    () =>
      meta.lessons.filter(
        (lesson) =>
          (!filters.courseId || String(lesson.courseId) === String(filters.courseId)) &&
          (!filters.subjectId || String(lesson.subjectId) === String(filters.subjectId)) &&
          (!filters.topicId || String(lesson.topicId || '') === String(filters.topicId))
      ),
    [meta.lessons, filters.courseId, filters.subjectId, filters.topicId]
  );
  const selectedVisibleIds = useMemo(
    () => questions.filter((question) => selectedQuestionIds.has(question.id)).map((question) => question.id),
    [questions, selectedQuestionIds]
  );
  const selectedVisibleQuestions = useMemo(
    () => questions.filter((question) => selectedQuestionIds.has(question.id)),
    [questions, selectedQuestionIds]
  );
  const selectedKeywordPreview = useMemo(
    () => Array.from(new Set(
      selectedVisibleQuestions
        .flatMap((question) => String(question.keywordsText || '').split(','))
        .map((keyword) => keyword.trim())
        .filter(Boolean)
    )).slice(0, 8),
    [selectedVisibleQuestions]
  );
  const allVisibleSelected = questions.length > 0 && selectedVisibleIds.length === questions.length;
  const selectedLinkedQuestionCount = selectedVisibleQuestions.filter((question) => Number(question.quizCount || 0) > 0).length;
  const selectedLinkedQuizCount = selectedVisibleQuestions.reduce((total, question) => total + Number(question.quizCount || 0), 0);

  const loadQuestions = useCallback(async (nextFilters = questionInitialFilters) => {
    setLoading(true);

    try {
      const params = Object.fromEntries(Object.entries(nextFilters).filter(([, value]) => value));
      const data = await fetchQuestions(params);
      setQuestions(data);
      setSelectedQuestionIds((current) => {
        const visibleIds = new Set(data.map((question) => question.id));
        return new Set([...current].filter((id) => visibleIds.has(id)));
      });
      setError('');
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Unable to load questions'));
    } finally {
      setLoading(false);
    }
  }, []);

  function resetComposer() {
    setModalOpen(false);
    setEditingId(null);
    setLoadingQuestionId(null);
    setForm(buildDefaultForm());
    setRecap(null);
    setRecapError('');
  }

  function showToast(text, type = 'success') {
    setToast({ text, type });
  }

  const loadMeta = useCallback(async () => {
    try {
      const data = await fetchQuestionsMeta();
      setMeta(data);
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Unable to load question form metadata'));
    }
  }, []);

  useEffect(() => {
    Promise.all([loadQuestions(questionInitialFilters), loadMeta()]);
  }, [loadMeta, loadQuestions]);

  function handleFilterChange(event) {
    const { name, value } = event.target;
    setFilters((current) => {
      if (name === 'courseId') {
        return { ...current, courseId: value, subjectId: '', topicId: '', lessonId: '' };
      }
      if (name === 'subjectId') {
        return { ...current, subjectId: value, topicId: '', lessonId: '' };
      }
      if (name === 'topicId') {
        return { ...current, topicId: value, lessonId: '' };
      }
      return { ...current, [name]: value };
    });
  }

  function handleFormChange(event) {
    const { name, value } = event.target;

    setForm((current) => {
      const next = { ...current, [name]: value };
      if (name === 'courseId') {
        next.subjectId = '';
        next.topicId = '';
        next.lessonId = '';
        next.topicLabel = '';
      }
      if (name === 'subjectId') {
        next.topicId = '';
        next.lessonId = '';
        next.topicLabel = '';
      }
      if (name === 'topicId') {
        next.lessonId = '';
        next.topicLabel = '';
      }
      if (name === 'category' && value !== 'past_paper') {
        next.examSource = 'local';
        next.paperId = '';
      }
      if (name === 'questionType') {
        next.options = buildOptions(value, current.options);
      }
      return next;
    });
  }

  function handleOptionTextChange(index, value) {
    setForm((current) => ({
      ...current,
      options: current.options.map((option, optionIndex) =>
        optionIndex === index ? { ...option, optionText: value } : option
      ),
    }));
  }

  function handleSbaCorrect(label) {
    setForm((current) => ({
      ...current,
      options: current.options.map((option) => ({
        ...option,
        isCorrect: option.optionLabel === label ? 1 : 0,
        whyIncorrect: option.optionLabel === label ? '' : option.whyIncorrect,
      })),
    }));
  }

  function handleOptionWhyIncorrectChange(index, value) {
    setForm((current) => ({
      ...current,
      options: current.options.map((option, optionIndex) =>
        optionIndex === index ? { ...option, whyIncorrect: value } : option
      ),
    }));
  }

  async function handleGenerateWhyIncorrect() {
    const correctOption = form.options.find((option) => Number(option.isCorrect) === 1);
    if (!correctOption) {
      setError('Select the correct SBA answer before generating why-incorrect explanations.');
      return;
    }

    setWhyGenerating(true);
    setError('');
    try {
      const result = await generateWhyIncorrectExplanations({
        questionText: form.questionText,
        correctAnswerLabel: correctOption.optionLabel,
        explanation: form.explanation,
        options: form.options.map((option) => ({
          optionLabel: option.optionLabel,
          optionText: option.optionText,
          isCorrect: Number(option.isCorrect) === 1,
          whyIncorrect: option.whyIncorrect || '',
        })),
      });
      const generatedMap = new Map((result.items || []).map((item) => [String(item.optionLabel || '').toUpperCase(), item.whyIncorrect || '']));
      setForm((current) => ({
        ...current,
        options: current.options.map((option) => (
          Number(option.isCorrect) === 1 || option.whyIncorrect
            ? option
            : { ...option, whyIncorrect: generatedMap.get(option.optionLabel) || option.whyIncorrect || '' }
        )),
      }));
      showToast('AI drafted why-incorrect explanations. Review before saving.');
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to generate why-incorrect explanations'));
    } finally {
      setWhyGenerating(false);
    }
  }

  function buildAiLearningPayload(currentForm = form, explanationOverride = currentForm.explanation) {
    const correctOption = currentForm.options.find((option) => Number(option.isCorrect) === 1);
    const course = meta.courses.find((item) => String(item.id) === String(currentForm.courseId));
    const subject = meta.subjects.find((item) => String(item.id) === String(currentForm.subjectId));
    const topic = meta.topics.find((item) => String(item.id) === String(currentForm.topicId));
    const lesson = meta.lessons.find((item) => String(item.id) === String(currentForm.lessonId));

    return {
      questionText: currentForm.questionText,
      questionType: currentForm.questionType,
      correctAnswerLabel: correctOption?.optionLabel || '',
      explanation: explanationOverride || '',
      course: course?.courseTitle || '',
      subject: subject?.subjectName || '',
      topic: topic?.topicName || currentForm.topicLabel || '',
      lesson: lesson?.lessonTitle || '',
      options: currentForm.options.map((option) => ({
        optionLabel: option.optionLabel,
        optionText: option.optionText,
        isCorrect: Number(option.isCorrect) === 1,
        whyIncorrect: option.whyIncorrect || '',
      })),
    };
  }

  async function handleGenerateExplanation({ silent = false } = {}) {
    const correctOption = form.options.find((option) => Number(option.isCorrect) === 1);
    if (!form.questionText.trim() || !correctOption) {
      setError('Add question text and select the correct answer before generating an explanation.');
      return '';
    }

    setExplanationGenerating(true);
    setError('');
    try {
      const result = await generateQuestionExplanation(buildAiLearningPayload());
      const explanation = result.explanation || '';
      setForm((current) => ({
        ...current,
        explanation: current.explanation?.trim() ? current.explanation : explanation,
      }));
      if (!silent) {
        showToast('AI drafted the main explanation. Review before saving.');
      }
      return explanation;
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to generate explanation'));
      return '';
    } finally {
      setExplanationGenerating(false);
    }
  }

  async function handleGenerateLearningContent() {
    const correctOption = form.options.find((option) => Number(option.isCorrect) === 1);
    if (!form.questionText.trim() || !correctOption) {
      setError('Add question text and select the correct answer before generating learning content.');
      return;
    }

    setLearningContentGenerating(true);
    setError('');
    setRecapError('');
    try {
      let explanation = form.explanation;
      if (!String(explanation || '').trim()) {
        const result = await generateQuestionExplanation(buildAiLearningPayload());
        explanation = result.explanation || '';
        setForm((current) => ({ ...current, explanation: current.explanation?.trim() ? current.explanation : explanation }));
      }

      if (form.questionType === 'sba') {
        const whyResult = await generateWhyIncorrectExplanations(buildAiLearningPayload({ ...form, explanation }, explanation));
        const generatedMap = new Map((whyResult.items || []).map((item) => [String(item.optionLabel || '').toUpperCase(), item.whyIncorrect || '']));
        setForm((current) => ({
          ...current,
          options: current.options.map((option) => (
            Number(option.isCorrect) === 1 || option.whyIncorrect
              ? option
              : { ...option, whyIncorrect: generatedMap.get(option.optionLabel) || option.whyIncorrect || '' }
          )),
        }));
      }

      if (!recap) {
        const generatedRecap = editingId
          ? await generateTheoryRecap(editingId)
          : await generateQuestionTheoryCard(buildAiLearningPayload({ ...form, explanation }, explanation));
        setRecap(generatedRecap);
      }

      showToast('AI drafted missing learning content. Review before saving.');
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to generate missing learning content'));
    } finally {
      setLearningContentGenerating(false);
    }
  }

  function handleTfCorrect(index, value) {
    setForm((current) => ({
      ...current,
      options: current.options.map((option, optionIndex) =>
        optionIndex === index ? { ...option, isCorrect: Number(value) } : option
      ),
    }));
  }

  async function handleFilterSubmit(event) {
    event.preventDefault();
    await loadQuestions(filters);
  }

  async function handleExportQuestions() {
    setExporting(true);
    setError('');

    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
      const blob = await exportQuestions(params);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `questions-export-${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showToast('Question export downloaded successfully.');
    } catch (exportError) {
      setError(getErrorMessage(exportError, 'Unable to export questions'));
    } finally {
      setExporting(false);
    }
  }

  async function handleImportFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const validationError = validateQuestionImportFile(file);
    if (validationError) {
      setError(validationError);
      event.target.value = '';
      return;
    }

    setImporting(true);
    setError('');

    try {
      const result = await importQuestions(file);
      await Promise.all([loadQuestions(filters), loadMeta()]);

      if (result.failedCount > 0) {
        setError(result.errors.join(' | '));
      }

      showToast(
        result.failedCount > 0
          ? `${result.importedCount} question(s) imported with ${result.failedCount} issue(s).`
          : `${result.importedCount} question(s) imported successfully.`
      );
    } catch (importError) {
      setError(getErrorMessage(importError, 'Unable to import questions'));
    } finally {
      if (event.target) {
        event.target.value = '';
      }
      setImporting(false);
    }
  }

  async function handleSaveQuestion(event) {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const payload = {
        courseId: Number(form.courseId),
        subjectId: Number(form.subjectId),
        topicId: form.topicId ? Number(form.topicId) : null,
        lessonId: form.lessonId ? Number(form.lessonId) : null,
        paperId: form.paperId ? Number(form.paperId) : null,
        topicLabel: form.topicLabel,
        category: form.category,
        questionType: form.questionType,
        questionText: form.questionText,
        keywordsText: form.keywordsText,
        explanation: form.explanation,
        status: form.status,
        options: form.options,
      };

      if (editingId) {
        await updateQuestion(editingId, payload);
        showToast('Question updated successfully.');
        resetComposer();
      } else {
        const result = await createQuestion(payload);
        if (recap) {
          const recapPayload = recapToUpsertPayload(recap);
          if (recapPayload) {
            await upsertTheoryRecap(result.id, recapPayload);
          }
        }
        showToast(recap ? 'Question and AI learning content created.' : 'Question created. You can now add a Theory Recap below.');
        setEditingId(result.id);
        setRecap(null);
        setRecapError('');
      }

      await loadQuestions(filters);
    } catch (saveError) {
      setError(getErrorMessage(saveError, editingId ? 'Unable to update question' : 'Unable to create question'));
    } finally {
      setSaving(false);
    }
  }

  async function handleEditQuestion(questionId) {
    setLoadingQuestionId(questionId);
    setError('');
    setRecap(null);
    setRecapError('');

    try {
      const [data, recapData] = await Promise.allSettled([
        fetchQuestion(questionId),
        fetchTheoryRecap(questionId),
      ]);

      if (data.status === 'rejected') {
        throw data.reason;
      }

      setEditingId(questionId);
      setForm(mapQuestionToForm(data.value));
      setRecap(recapData.status === 'fulfilled' ? recapData.value : null);
      setModalOpen(true);
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Unable to load question details'));
    } finally {
      setLoadingQuestionId(null);
    }
  }

  async function handleViewQuestion(questionId) {
    setDetailModalOpen(true);
    setDetailQuestion(null);
    setDetailRecap(null);
    setDetailError('');
    setDetailLoadingId(questionId);

    try {
      const [data, recapData] = await Promise.allSettled([
        fetchQuestion(questionId),
        fetchTheoryRecap(questionId),
      ]);

      if (data.status === 'rejected') {
        throw data.reason;
      }

      setDetailQuestion(data.value);
      setDetailRecap(recapData.status === 'fulfilled' ? recapData.value : null);
    } catch (loadError) {
      setDetailError(getErrorMessage(loadError, 'Unable to load question details'));
    } finally {
      setDetailLoadingId(null);
    }
  }

  function closeDetailModal() {
    setDetailModalOpen(false);
    setDetailQuestion(null);
    setDetailRecap(null);
    setDetailError('');
    setDetailLoadingId(null);
  }

  async function handleRecapSave(fields) {
    if (!editingId) {
      setRecap(adminFieldsToRecap(fields));
      showToast('Draft theory card updated. It will be saved with the question.');
      return;
    }
    setRecapSaving(true);
    setRecapError('');
    try {
      const saved = await upsertTheoryRecap(editingId, fields);
      setRecap(saved);
      showToast('Theory recap saved.');
    } catch (err) {
      setRecapError(getErrorMessage(err, 'Unable to save theory recap'));
    } finally {
      setRecapSaving(false);
    }
  }

  async function handleRecapGenerate() {
    setRecapGenerating(true);
    setRecapError('');
    try {
      const generated = editingId
        ? (recap ? await regenerateTheoryRecap(editingId) : await generateTheoryRecap(editingId))
        : await generateQuestionTheoryCard(buildAiLearningPayload());
      setRecap(generated);
      showToast('Theory recap generated.');
    } catch (err) {
      setRecapError(getErrorMessage(err, 'Unable to generate theory recap'));
    } finally {
      setRecapGenerating(false);
    }
  }

  async function handleRecapDelete() {
    if (!window.confirm('Delete this theory recap?')) return;
    if (!editingId) {
      setRecap(null);
      showToast('Draft theory recap removed.');
      return;
    }
    setRecapSaving(true);
    setRecapError('');
    try {
      await deleteTheoryRecap(editingId);
      setRecap(null);
      showToast('Theory recap deleted.');
    } catch (err) {
      setRecapError(getErrorMessage(err, 'Unable to delete theory recap'));
    } finally {
      setRecapSaving(false);
    }
  }

  function handleOpenCreateModal() {
    setError('');
    setEditingId(null);
    setForm(buildDefaultForm());
    setModalOpen(true);
  }

  async function handleDeleteQuestion(questionId) {
    const confirmed = window.confirm('Delete this question permanently?');
    if (!confirmed) {
      return;
    }

    setDeletingId(questionId);
    setError('');

    try {
      await deleteQuestion(questionId);
      if (editingId === questionId) {
        resetComposer();
      }
      showToast('Question deleted successfully.');
      await loadQuestions(filters);
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, 'Unable to delete question'));
    } finally {
      setDeletingId(null);
    }
  }

  function toggleQuestionSelection(questionId) {
    setSelectedQuestionIds((current) => {
      const next = new Set(current);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  }

  function toggleAllVisibleQuestions() {
    setSelectedQuestionIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        questions.forEach((question) => next.delete(question.id));
      } else {
        questions.forEach((question) => next.add(question.id));
      }
      return next;
    });
  }

  async function handleBulkDeleteSelected() {
    if (selectedVisibleIds.length === 0) {
      return;
    }

    setBulkDeleting(true);
    setError('');
    try {
      const result = await bulkDeleteQuestions(selectedVisibleIds);
      setBulkDeleteOpen(false);
      setSelectedQuestionIds(new Set());
      showToast(
        result.linkedQuestionCount > 0
          ? `${result.deletedCount} question(s) deleted and removed from ${result.linkedQuizCount} quiz link(s).`
          : `${result.deletedCount} question(s) deleted successfully.`
      );
      await loadQuestions(filters);
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, 'Unable to delete selected questions'));
    } finally {
      setBulkDeleting(false);
    }
  }

  async function handleBulkKeywordSubmit(event) {
    event.preventDefault();
    if (selectedVisibleIds.length === 0) {
      return;
    }
    if (!bulkKeywordForm.keywordsText.trim()) {
      setError('Enter at least one keyword before updating selected questions.');
      return;
    }

    setBulkKeywordSaving(true);
    setError('');
    try {
      const result = await bulkUpdateQuestionKeywords({
        questionIds: selectedVisibleIds,
        keywordsText: bulkKeywordForm.keywordsText,
        mode: bulkKeywordForm.mode,
      });

      setBulkKeywordOpen(false);
      setBulkKeywordForm({ keywordsText: '', mode: 'append' });
      showToast(`${result.updatedCount ?? selectedVisibleIds.length} question(s) updated with ${result.keywords?.length || 0} keyword(s).`);
      await Promise.all([loadQuestions(filters), loadMeta()]);
    } catch (keywordError) {
      setError(getErrorMessage(keywordError, 'Unable to update selected question keywords'));
    } finally {
      setBulkKeywordSaving(false);
    }
  }

  return (
    <main className={ui.screenShell}>
      <section className={ui.managementLayout}>
        <AppHeader
          title="Questions"
          subtitle="Question Bank"
        />

        {error ? <div className={ui.feedbackError}>{error}</div> : null}
        {toast && createPortal(
          <div className={cx(ui.toastContainer, ui.toastContainerCenter)} role="status" aria-live="polite">
            <FeedbackNotice
              tone={toast.type === 'success' ? 'success' : 'error'}
              variant="toast"
              onDismiss={() => setToast(null)}
              resetKey={toast.text}
            >
              {toast.text}
            </FeedbackNotice>
          </div>,
          document.body
        )}

        <div className={ui.managementGrid}>
          <section className={ui.panelCard}>
            <div className={ui.panelTop}>
              <div>
                <h2>Question bank</h2>
                <p>{loading ? 'Loading questions...' : `${questions.length} question(s) loaded from the live course structure hierarchy`}</p>
              </div>
              <div className={ui.questionBankActions}>
                <span className={ui.tablePill}>{questions.filter((question) => question.questionType === 'sba').length} SBA</span>
                <span className={ui.tablePill}>{questions.filter((question) => question.questionType === 'true_false').length} T/F</span>
                <button type="button" className={ui.secondaryAction} onClick={handleExportQuestions} disabled={exporting || importing}>
                  {exporting ? 'Exporting...' : 'Export CSV'}
                </button>
                <button className={ui.secondaryAction}
                  type="button"
                 
                  onClick={() => importInputRef.current?.click()}
                  disabled={importing || exporting}
                >
                  {importing ? 'Importing...' : 'Import CSV'}
                </button>
                <button type="button" className={ui.secondaryAction} onClick={() => navigate('/questions/bulk')}>
                  Bulk Add Questions
                </button>
                <button type="button" className={ui.secondaryAction} onClick={() => navigate('/structure')}>
                  Open Structure
                </button>
                <button className={ui.primaryAction} type="button" onClick={handleOpenCreateModal}>
                  Add question
                </button>
                <input className="shrink-0"
                  ref={importInputRef}
                  type="file"
                  accept=".csv"
                  style={{ display: 'none' }}
                  onChange={handleImportFileChange}
                  aria-label="Import question CSV"
                />
              </div>
            </div>

            <form className={ui.questionFilterGrid} onSubmit={handleFilterSubmit}>
              <label className={ui.formLabel}>
                Search
                <input className={ui.input} name="search" value={filters.search} onChange={handleFilterChange} placeholder="Search question, paper, topic" />
              </label>
              <label className={ui.formLabel}>
                Keywords
                <input className={ui.input} list="question-filter-keyword-suggestions" name="keywords" value={filters.keywords} onChange={handleFilterChange} placeholder="Filter by keyword" />
              </label>
              <label className={ui.formLabel}>
                Course
                <select className={ui.input} name="courseId" value={filters.courseId} onChange={handleFilterChange}>
                  <option value="">All courses</option>
                  {meta.courses.map((course) => (
                    <option key={course.id} value={course.id}>{course.courseTitle}</option>
                  ))}
                </select>
              </label>
              <label className={ui.formLabel}>
                Subject
                <select className={ui.input} name="subjectId" value={filters.subjectId} onChange={handleFilterChange}>
                  <option value="">All subjects</option>
                  {filterSubjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>{subject.subjectName}</option>
                  ))}
                </select>
              </label>
              <label className={ui.formLabel}>
                Topic
                <select className={ui.input} name="topicId" value={filters.topicId} onChange={handleFilterChange}>
                  <option value="">All topics</option>
                  {filterTopics.map((topic) => (
                    <option key={topic.id} value={topic.id}>{topic.topicName}</option>
                  ))}
                </select>
              </label>
              <label className={ui.formLabel}>
                Lesson
                <select className={ui.input} name="lessonId" value={filters.lessonId} onChange={handleFilterChange}>
                  <option value="">All lessons</option>
                  {filterLessons.map((lesson) => (
                    <option key={lesson.id} value={lesson.id}>{lesson.lessonTitle}</option>
                  ))}
                </select>
              </label>
              <label className={ui.formLabel}>
                Type
                <select className={ui.input} name="type" value={filters.type} onChange={handleFilterChange}>
                  <option value="">All</option>
                  <option value="sba">SBA</option>
                  <option value="true_false">T/F</option>
                </select>
              </label>
              <label className={ui.formLabel}>
                Status
                <select className={ui.input} name="status" value={filters.status} onChange={handleFilterChange}>
                  <option value="">All</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
              <label className={ui.formLabel}>
                Category
                <select className={ui.input} name="category" value={filters.category} onChange={handleFilterChange}>
                  <option value="">All</option>
                  <option value="past_paper">Past Paper</option>
                  <option value="mock">Mock</option>
                  <option value="ai">AI</option>
                </select>
              </label>
              <label className={ui.formLabel}>
                Paper
                <select className={ui.input} name="paperId" value={filters.paperId} onChange={handleFilterChange}>
                  <option value="">All papers</option>
                  {meta.papers.map((paper) => (
                    <option key={paper.id} value={paper.id}>
                      {[paper.year || null, paper.paperTitle].filter(Boolean).join(' - ')}
                    </option>
                  ))}
                </select>
              </label>
              <label className={ui.formLabel}>
                Usage
                <select className={ui.input} name="usage" value={filters.usage} onChange={handleFilterChange}>
                  <option value="">All usage</option>
                  <option value="used">Used in quizzes</option>
                  <option value="unused">Unused</option>
                </select>
              </label>
              <label className={ui.formLabel}>
                Unclassified
                <select className={ui.input} name="unclassified" value={filters.unclassified} onChange={handleFilterChange}>
                  <option value="">All</option>
                  <option value="true">Needs topic / lesson</option>
                </select>
              </label>
              <div className={cx(ui.buttonRow, ui.filterActions)}>
                <button className={ui.primaryAction} type="submit">Filter</button>
                <button className={ui.secondaryAction}
                  type="button"
                 
                  onClick={() => {
                    const next = { search: '', status: '', type: '', category: '', unclassified: '', usage: '', keywords: '', courseId: '', subjectId: '', topicId: '', lessonId: '', paperId: '' };
                    setFilters(next);
                    loadQuestions(next);
                  }}
                >
                  Reset
                </button>
              </div>
            </form>
            <datalist id="question-filter-keyword-suggestions">
              {(meta.keywordSuggestions || []).map((keyword) => (
                <option key={keyword} value={keyword} />
              ))}
            </datalist>

            <div className={bulkSelectBarClass}>
              <label className={cx(ui.checkboxLabel, 'min-w-0')}>
                <input className={tableCheckboxClass}
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAllVisibleQuestions}
                  disabled={loading || questions.length === 0}
                />
                <span>{allVisibleSelected ? 'Clear visible selection' : 'Select all visible'}</span>
              </label>
              <div className={cx(ui.buttonRow, 'justify-end')}>
                <span className={ui.tablePill}>{selectedVisibleIds.length} selected</span>
                <button className={ui.secondaryAction}
                  type="button"
                  onClick={() => setBulkKeywordOpen(true)}
                  disabled={selectedVisibleIds.length === 0 || bulkKeywordSaving}
                >
                  Update keywords
                </button>
                <button className={ui.dangerAction}
                  type="button"
                  onClick={() => setBulkDeleteOpen(true)}
                  disabled={selectedVisibleIds.length === 0 || bulkDeleting}
                >
                  Delete selected
                </button>
              </div>
            </div>

            <div className={ui.tableShell}>
              <table className={cx(ui.modernTable, '!min-w-[1080px] max-[640px]:!min-w-[960px]')}>
                <thead>
                  <tr>
                    <th className={ui.tableHeadCell}>
                      <input className={tableCheckboxClass}
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleAllVisibleQuestions}
                        disabled={loading || questions.length === 0}
                        aria-label="Select all visible questions"
                      />
                    </th>
                    <th className={ui.tableHeadCell}>ID</th>
                    <th className={ui.tableHeadCell}>Question</th>
                    <th className={ui.tableHeadCell}>Course</th>
                    <th className={ui.tableHeadCell}>Hierarchy</th>
                    <th className={ui.tableHeadCell}>Source</th>
                    <th className={ui.tableHeadCell}>Type</th>
                    <th className={ui.tableHeadCell}>Usage</th>
                    <th className={ui.tableHeadCell}>Status</th>
                    <th className={ui.tableHeadCell}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="10" className={ui.tableEmpty}>Loading questions...</td>
                    </tr>
                  ) : null}
                  {!loading && questions.length === 0 ? (
                    <tr>
                      <td colSpan="10" className={ui.tableEmpty}>No questions found.</td>
                    </tr>
                  ) : null}
                  {!loading && questions.map((question) => (
                    <tr key={question.id} className="transition hover:bg-surface-2/70">
                      <td className={ui.tableCell}>
                        <input className={tableCheckboxClass}
                          type="checkbox"
                          checked={selectedQuestionIds.has(question.id)}
                          onChange={() => toggleQuestionSelection(question.id)}
                          aria-label={`Select question #${question.id}`}
                        />
                      </td>
                      <td className={ui.tableCell}>#{question.id}</td>
                      <td className={ui.tableCell}>
                        <button
                          className={questionPreviewButtonClass}
                          type="button"
                          onClick={() => handleViewQuestion(question.id)}
                          aria-label={`Open full details for question #${question.id}`}
                        >
                          <strong>{question.questionText.slice(0, 80)}{question.questionText.length > 80 ? '...' : ''}</strong>
                          <div className={ui.tableSubtext}>
                            {[question.topicLabel ? `Internal label: ${question.topicLabel}` : null, question.paperTitle ? `Paper: ${question.paperTitle}` : null, question.keywordsText ? `Keywords: ${question.keywordsText}` : null]
                              .filter(Boolean)
                              .join(' • ')}
                          </div>
                        </button>
                      </td>
                      <td className={ui.tableCell}>{question.courseTitle || '-'}</td>
                      <td className={ui.tableCell}>{[question.subjectName, question.topicName, question.lessonTitle].filter(Boolean).join(' / ') || '-'}</td>
                      <td className={ui.tableCell}>
                        <div className="grid gap-1">
                          <span className={ui.tablePill}>{question.category === 'ai' ? 'AI' : question.category === 'past_paper' ? 'Past Paper' : 'Mock'}</span>
                          {question.paperTitle ? <span className={ui.tableSubtext}>{question.paperTitle}</span> : null}
                        </div>
                      </td>
                      <td className={ui.tableCell}><span className={ui.tablePill}>{question.questionType === 'sba' ? 'SBA' : 'T/F'}</span></td>
                      <td className={ui.tableCell}>{Number(question.quizCount || 0) > 0 ? `${question.quizCount} quiz link${Number(question.quizCount) === 1 ? '' : 's'}` : 'Unused'}</td>
                      <td className={ui.tableCell}><span className={statusPill(question.status)}>{question.status}</span></td>
                      <td className={ui.tableCell}>
                        <div className={ui.buttonRow}>
                          <button className={cx(ui.iconButton, 'min-h-[38px] px-0')}
                            type="button"
                           
                            aria-label={`Edit question #${question.id}`}
                            title="Edit question"
                            onClick={() => handleEditQuestion(question.id)}
                            disabled={loadingQuestionId === question.id}
                          >
                            <EditActionIcon />
                          </button>
                          <button className={cx(ui.dangerIconButton, 'min-h-[38px] px-0')}
                            type="button"
                           
                            aria-label={`Delete question #${question.id}`}
                            title="Delete question"
                            onClick={() => handleDeleteQuestion(question.id)}
                            disabled={deletingId === question.id}
                          >
                            <DeleteActionIcon />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {bulkDeleteOpen && createPortal(
          <div className={ui.modalBackdrop} onClick={() => !bulkDeleting && setBulkDeleteOpen(false)}>
            <div className={ui.confirmModal} onClick={(event) => event.stopPropagation()}>
              <div className={ui.confirmModalHead}>
                <div>
                  <h2>Delete selected questions?</h2>
                  <p>This will permanently delete {selectedVisibleIds.length} selected question(s).</p>
                </div>
              </div>
              <div className={ui.confirmModalBody}>
                {selectedLinkedQuestionCount > 0 ? (
                  <div className={bulkWarningClass}>
                    {selectedLinkedQuestionCount} selected question(s) are linked to {selectedLinkedQuizCount} quiz link(s). Deleting them will remove those questions from affected quizzes.
                  </div>
                ) : (
                  <p className={ui.entityModalText}>No selected question appears to be linked to a quiz.</p>
                )}
              </div>
              <div className={ui.modalActions}>
                <button className={ui.secondaryAction}
                  type="button"
                  onClick={() => setBulkDeleteOpen(false)}
                  disabled={bulkDeleting}
                >
                  Cancel
                </button>
                <button className={ui.dangerAction}
                  type="button"
                  onClick={handleBulkDeleteSelected}
                  disabled={bulkDeleting || selectedVisibleIds.length === 0}
                >
                  {bulkDeleting ? 'Deleting...' : 'Delete selected'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {bulkKeywordOpen && createPortal(
          <div className={ui.modalBackdrop} onClick={() => !bulkKeywordSaving && setBulkKeywordOpen(false)}>
            <form className={ui.confirmModal} onSubmit={handleBulkKeywordSubmit} onClick={(event) => event.stopPropagation()}>
              <div className={ui.confirmModalHead}>
                <div>
                  <h2>Update selected keywords</h2>
                  <p>Apply keywords to {selectedVisibleIds.length} selected question(s).</p>
                </div>
              </div>
              <div className={bulkKeywordGridClass}>
                {selectedKeywordPreview.length ? (
                  <div className={bulkWarningClass}>
                    Current visible keywords include: {selectedKeywordPreview.join(', ')}
                    {selectedKeywordPreview.length >= 8 ? '...' : ''}
                  </div>
                ) : null}
                <label className={ui.formLabel}>
                  Mode
                  <select
                    className={ui.input}
                    value={bulkKeywordForm.mode}
                    onChange={(event) => setBulkKeywordForm((current) => ({ ...current, mode: event.target.value }))}
                    disabled={bulkKeywordSaving}
                  >
                    <option value="append">Append to existing keywords</option>
                    <option value="replace">Replace existing keywords</option>
                  </select>
                </label>
                <label className={ui.formLabel}>
                  Keywords
                  <input
                    className={ui.input}
                    list="question-filter-keyword-suggestions"
                    value={bulkKeywordForm.keywordsText}
                    onChange={(event) => setBulkKeywordForm((current) => ({ ...current, keywordsText: event.target.value }))}
                    placeholder="cardiology, murmurs, mock set 1"
                    disabled={bulkKeywordSaving}
                  />
                </label>
              </div>
              <div className={ui.modalActions}>
                <button className={ui.secondaryAction}
                  type="button"
                  onClick={() => setBulkKeywordOpen(false)}
                  disabled={bulkKeywordSaving}
                >
                  Cancel
                </button>
                <button className={ui.primaryAction}
                  type="submit"
                  disabled={bulkKeywordSaving || selectedVisibleIds.length === 0}
                >
                  {bulkKeywordSaving ? 'Updating...' : 'Update keywords'}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}

        <QuestionEditModal
          open={modalOpen}
          form={form}
          meta={meta}
          saving={saving}
          onClose={resetComposer}
          onSubmit={handleSaveQuestion}
          onFormChange={handleFormChange}
          onOptionTextChange={handleOptionTextChange}
          onSbaCorrect={handleSbaCorrect}
          onTfCorrect={handleTfCorrect}
          onOptionWhyIncorrectChange={handleOptionWhyIncorrectChange}
          onGenerateExplanation={handleGenerateExplanation}
          onGenerateWhyIncorrect={handleGenerateWhyIncorrect}
          onGenerateLearningContent={handleGenerateLearningContent}
          explanationGenerating={explanationGenerating}
          whyGenerating={whyGenerating}
          learningContentGenerating={learningContentGenerating}
          visibleSubjects={visibleSubjects}
          visibleTopics={visibleTopics}
          visibleLessons={visibleLessons}
          editingId={editingId}
          onOpenStructure={() => navigate('/structure')}
          recap={recap}
          recapLoading={recapLoading}
          recapSaving={recapSaving}
          recapGenerating={recapGenerating}
          recapError={recapError}
          onRecapSave={handleRecapSave}
          onRecapGenerate={handleRecapGenerate}
          onRecapDelete={handleRecapDelete}
        />
        <QuestionDetailModal
          open={detailModalOpen}
          question={detailQuestion}
          recap={detailRecap}
          loading={Boolean(detailLoadingId)}
          error={detailError}
          onClose={closeDetailModal}
          onEdit={(questionId) => {
            closeDetailModal();
            handleEditQuestion(questionId);
          }}
        />
      </section>
    </main>
  );
}

const RECAP_ARRAY_FIELDS = [
  { key: 'etiology', label: 'Etiology' },
  { key: 'pathophysiology', label: 'Pathophysiology' },
  { key: 'clinicalFeatures', label: 'Clinical Features' },
  { key: 'investigations', label: 'Investigations' },
  { key: 'treatment', label: 'Treatment' },
  { key: 'keyPoints', label: 'Key Points' },
];

function arrayToText(arr) {
  return Array.isArray(arr) ? arr.join('\n') : '';
}

function displayValue(value) {
  return value === null || value === undefined || value === '' ? '-' : String(value);
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function DetailMeta({ label, value }) {
  return (
    <div className={detailMetaCardClass}>
      <span className={detailMetaLabelClass}>{label}</span>
      <span className={detailMetaValueClass}>{displayValue(value)}</span>
    </div>
  );
}

function QuestionDetailModal({ open, question, recap, loading, error, onClose, onEdit }) {
  if (!open) {
    return null;
  }

  const normalizedRecap = normalizeTheoryRecap(recap);
  const options = buildOptions(question?.questionType || 'sba', question?.options || []);
  const visibleOptions = options.filter((option) => option.optionText || question?.questionType === 'true_false');
  const correctOption = options.find((option) => Number(option.isCorrect) === 1);
  const hierarchy = [question?.courseTitle, question?.subjectName, question?.topicName, question?.lessonTitle].filter(Boolean).join(' / ');
  const recapSections = normalizedRecap
    ? RECAP_ARRAY_FIELDS.map((field) => ({ ...field, items: normalizeRecapArray(normalizedRecap[field.key]) })).filter((field) => field.items.length > 0)
    : [];

  return createPortal(
    <div className={ui.modalBackdrop} onClick={onClose}>
      <div className={cx(ui.entityModal, 'w-[min(980px,100%)]')} onClick={(event) => event.stopPropagation()}>
        <div className={ui.entityModalTop}>
          <div>
            <h2 className={ui.entityModalTitle}>{question ? `Question #${question.id}` : 'Question details'}</h2>
            <p className={ui.entityModalText}>Full question view with answers, explanations, and learning notes.</p>
          </div>
          <button type="button" className={ui.subtleIconButton} onClick={onClose} aria-label="Close">
            x
          </button>
        </div>

        <div className={cx(ui.modalForm, 'px-6 pb-6 max-[600px]:px-4')}>
          {loading ? (
            <div className={ui.tableEmpty}>Loading question details...</div>
          ) : null}

          {error ? (
            <div className={ui.feedbackError}>{error}</div>
          ) : null}

          {!loading && question ? (
            <div className="grid gap-4">
              <div className={detailMetaGridClass}>
                <DetailMeta label="Course" value={question.courseTitle} />
                <DetailMeta label="Hierarchy" value={hierarchy} />
                <DetailMeta label="Type" value={question.questionType === 'sba' ? 'SBA' : 'True / False'} />
                <DetailMeta label="Category" value={question.category} />
                <DetailMeta label="Paper" value={question.paperTitle} />
                <DetailMeta label="Status" value={question.status} />
                <DetailMeta label="Linked quizzes" value={question.quizCount ?? 0} />
                <DetailMeta label="Created" value={formatDateTime(question.createdAt || question.created_at)} />
                <DetailMeta label="Updated" value={formatDateTime(question.updatedAt || question.updated_at)} />
              </div>

              <section className={detailPanelClass}>
                <strong className={detailPanelTitleClass}>Question</strong>
                <MedicalText as="p" className="m-0 whitespace-pre-wrap text-[15px] leading-relaxed text-ink-strong" text={question.questionText} />
                {(question.topicLabel || question.keywordsText) ? (
                  <p className="mb-0 mt-3 text-[13px] leading-relaxed text-ink-soft">
                    {[question.topicLabel ? `Internal label: ${question.topicLabel}` : null, question.keywordsText ? `Keywords: ${question.keywordsText}` : null]
                      .filter(Boolean)
                      .join(' • ')}
                  </p>
                ) : null}
              </section>

              <section className={detailPanelClass}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <strong className={detailPanelTitleClass}>Answers</strong>
                  {question.questionType === 'sba' && correctOption ? (
                    <span className={cx(ui.tablePill, 'bg-brand-success/15 text-brand-success')}>Correct answer: {correctOption.optionLabel}</span>
                  ) : null}
                </div>
                <div className="grid gap-2.5">
                  {visibleOptions.map((option) => {
                    const isCorrect = Number(option.isCorrect) === 1;
                    return (
                      <div
                        key={option.optionLabel}
                        className={cx(detailOptionClass, isCorrect ? detailCorrectOptionClass : detailIncorrectOptionClass)}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="text-sm text-ink-strong">{option.optionLabel}</strong>
                          <span className={cx(ui.tablePill, isCorrect ? 'bg-brand-success/15 text-brand-success' : 'bg-brand-error/15 text-brand-error')}>
                            {question.questionType === 'sba' ? (isCorrect ? 'Correct' : 'Incorrect') : `Answer: ${isCorrect ? 'True' : 'False'}`}
                          </span>
                        </div>
                        <MedicalText as="p" className="mb-0 mt-2 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink-medium" text={option.optionText || '-'} />
                        {option.whyIncorrect ? (
                          <p className="mb-0 mt-2 rounded-lg bg-surface-1 px-3 py-2 text-[13px] leading-relaxed text-ink-soft">
                            <strong className="text-ink-strong">Why incorrect: </strong><MedicalText text={option.whyIncorrect} />
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className={detailPanelClass}>
                <strong className={detailPanelTitleClass}>Explanation</strong>
                <MedicalText as="p" className="m-0 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink-medium" text={question.explanation || 'No explanation added yet.'} />
              </section>

              <section className={detailPanelClass}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <strong className={detailPanelTitleClass}>Theory recap</strong>
                  {normalizedRecap?.reviewedStatus ? (
                    <span className={cx(recapBadgeClass, recapBadgeExistsClass)}>{normalizedRecap.reviewedStatus}</span>
                  ) : null}
                </div>
                {normalizedRecap ? (
                  <div className="grid gap-3">
                    {normalizedRecap.conceptName ? (
                      <p className="m-0 text-[13.5px] font-semibold text-ink-strong">{normalizedRecap.conceptName}</p>
                    ) : null}
                    {recapSections.map((section) => (
                      <div key={section.key}>
                        <strong className="mb-1 block text-[12px] uppercase tracking-[0.08em] text-ink-muted">{section.label}</strong>
                        <ul className={detailRecapListClass}>
                          {section.items.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                    {normalizedRecap.mnemonic ? (
                      <p className="m-0 rounded-lg bg-brand-primary/10 px-3 py-2 text-[13px] leading-relaxed text-ink-medium">
                        <strong className="text-ink-strong">Mnemonic: </strong>{normalizedRecap.mnemonic}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="m-0 text-[13.5px] text-ink-soft">No theory recap added yet.</p>
                )}
              </section>

              <div className={ui.buttonRow}>
                <button className={ui.primaryAction} type="button" onClick={() => onEdit(question.id)}>
                  Edit question
                </button>
                <button className={ui.secondaryAction} type="button" onClick={onClose}>
                  Close
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}

export function TheoryRecapAdminSection({ recap, loading, saving, generating, error, onSave, onGenerate, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [fields, setFields] = useState({
    conceptName: '',
    hierarchyCourse: '',
    hierarchySubject: '',
    hierarchyTopic: '',
    hierarchyLesson: '',
    etiology: '',
    pathophysiology: '',
    clinicalFeatures: '',
    investigations: '',
    treatment: '',
    keyPoints: '',
    mnemonic: '',
    reviewedStatus: 'pending',
  });

  useEffect(() => {
    if (recap) {
      setFields({
        conceptName: recap.conceptName || '',
        hierarchyCourse: recap.hierarchy?.course || '',
        hierarchySubject: recap.hierarchy?.subject || '',
        hierarchyTopic: recap.hierarchy?.topic || '',
        hierarchyLesson: recap.hierarchy?.lesson || '',
        etiology: arrayToText(recap.etiology),
        pathophysiology: arrayToText(recap.pathophysiology),
        clinicalFeatures: arrayToText(recap.clinicalFeatures),
        investigations: arrayToText(recap.investigations),
        treatment: arrayToText(recap.treatment),
        keyPoints: arrayToText(recap.keyPoints),
        mnemonic: recap.mnemonic || '',
        reviewedStatus: recap.reviewedStatus || 'pending',
      });
    } else {
      setFields({
        conceptName: '',
        hierarchyCourse: '',
        hierarchySubject: '',
        hierarchyTopic: '',
        hierarchyLesson: '',
        etiology: '',
        pathophysiology: '',
        clinicalFeatures: '',
        investigations: '',
        treatment: '',
        keyPoints: '',
        mnemonic: '',
        reviewedStatus: 'pending',
      });
    }
  }, [recap]);

  function handleChange(event) {
    const { name, value } = event.target;
    setFields((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const payload = {
      conceptName: fields.conceptName || null,
      hierarchyCourse: fields.hierarchyCourse || null,
      hierarchySubject: fields.hierarchySubject || null,
      hierarchyTopic: fields.hierarchyTopic || null,
      hierarchyLesson: fields.hierarchyLesson || null,
      mnemonic: fields.mnemonic || null,
      reviewedStatus: fields.reviewedStatus,
    };
    for (const { key } of RECAP_ARRAY_FIELDS) {
      payload[key] = textToArray(fields[key]);
    }
    onSave(payload);
  }

  const busy = saving || generating;

  return (
    <div className={recapAdminSectionClass}>
      <button className={recapToggleClass}
        type="button"
       
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className={recapToggleIconClass} aria-hidden="true">⚡</span>
        <span className={recapToggleLabelClass}>Theory Recap</span>
        {recap ? (
          <span className={cx(recapBadgeClass, recapBadgeExistsClass)}>{recap.reviewedStatus || 'pending'}</span>
        ) : (
          <span className={cx(recapBadgeClass, recapBadgeNoneClass)}>none</span>
        )}
        <span className={recapToggleChevronClass} aria-hidden="true">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded ? (
        <div className={recapBodyClass}>
          {loading ? (
            <p className={recapLoadingClass}>Loading recap…</p>
          ) : (
            <>
              {error ? <div className={ui.feedbackError}>{error}</div> : null}

              <div className={ui.buttonRow}>
                <button className={ui.secondaryAction}
                  type="button"
                 
                  onClick={onGenerate}
                  disabled={busy}
                >
                  {generating ? 'Generating…' : recap ? 'Regenerate with AI' : 'Generate with AI'}
                </button>
                {recap ? (
                  <button className={ui.dangerAction}
                    type="button"
                   
                    onClick={onDelete}
                    disabled={busy}
                  >
                    Delete recap
                  </button>
                ) : null}
              </div>

              <form className={ui.stackForm} onSubmit={handleSubmit}>
                <label className={ui.formLabel}>
                  Concept Name
                  <input className={ui.input} name="conceptName" value={fields.conceptName} onChange={handleChange} placeholder="e.g. Aortic Stenosis" />
                </label>

                <div className={recapHierarchyGridClass}>
                  <label className={ui.formLabel}>
                    Course
                    <input className={ui.input} name="hierarchyCourse" value={fields.hierarchyCourse} onChange={handleChange} placeholder="Course" />
                  </label>
                  <label className={ui.formLabel}>
                    Subject
                    <input className={ui.input} name="hierarchySubject" value={fields.hierarchySubject} onChange={handleChange} placeholder="Subject" />
                  </label>
                  <label className={ui.formLabel}>
                    Topic
                    <input className={ui.input} name="hierarchyTopic" value={fields.hierarchyTopic} onChange={handleChange} placeholder="Topic" />
                  </label>
                  <label className={ui.formLabel}>
                    Lesson
                    <input className={ui.input} name="hierarchyLesson" value={fields.hierarchyLesson} onChange={handleChange} placeholder="Lesson" />
                  </label>
                </div>

                {RECAP_ARRAY_FIELDS.map(({ key, label }) => (
                  <label className={ui.formLabel} key={key}>
                    {label} <span className={recapHintClass}>(one item per line)</span>
                    <textarea className={ui.textarea}
                      name={key}
                      rows={3}
                      value={fields[key]}
                      onChange={handleChange}
                      placeholder={`Enter ${label.toLowerCase()} points, one per line`}
                    />
                  </label>
                ))}

                <label className={ui.formLabel}>
                  Mnemonic
                  <textarea className={ui.textarea} name="mnemonic" rows={2} value={fields.mnemonic} onChange={handleChange} placeholder="Optional mnemonic" />
                </label>

                <label className={ui.formLabel}>
                  Review Status
                  <select className={ui.input} name="reviewedStatus" value={fields.reviewedStatus} onChange={handleChange}>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </label>

                <div className={ui.buttonRow}>
                  <button className={ui.primaryAction} type="submit" disabled={busy}>
                    {saving ? 'Saving…' : 'Save recap'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function QuestionEditModal({
  open,
  form,
  meta,
  saving,
  onClose,
  onSubmit,
  onFormChange,
  onOptionTextChange,
  onSbaCorrect,
  onTfCorrect,
  onOptionWhyIncorrectChange,
  onGenerateExplanation,
  onGenerateWhyIncorrect,
  onGenerateLearningContent,
  explanationGenerating,
  whyGenerating,
  learningContentGenerating,
  visibleSubjects,
  visibleTopics,
  visibleLessons,
  editingId,
  onOpenStructure,
  recap,
  recapLoading,
  recapSaving,
  recapGenerating,
  recapError,
  onRecapSave,
  onRecapGenerate,
  onRecapDelete,
}) {
  if (!open) {
    return null;
  }

  const missingWhyIncorrectCount = form.questionType === 'sba'
    ? form.options.filter((option) => option.optionText && Number(option.isCorrect) !== 1 && !String(option.whyIncorrect || '').trim()).length
    : 0;

  return createPortal(
    <div className={ui.modalBackdrop} onClick={onClose}>
      <div className={cx(ui.entityModal, 'w-[min(1040px,100%)]')} onClick={(event) => event.stopPropagation()}>
        <div className={ui.entityModalTop}>
          <div>
            <h2 className={ui.entityModalTitle}>{editingId ? `Edit question #${editingId}` : 'Add question'}</h2>
            <p className={ui.entityModalText}>{editingId ? 'Update the selected question and keep it aligned with the live Course → Subject → Topic → Lesson structure.' : 'Create a new SBA or True / False question using the live Course → Subject → Topic → Lesson structure.'}</p>
          </div>
          <button type="button" className={ui.subtleIconButton} onClick={onClose} aria-label="Close">
            x
          </button>
        </div>

        <div className={questionModalInlineNoteClass}>
          This form uses the same hierarchy as the Structure page. Create or edit Courses, Subjects, Topics, and Lessons in the central structure manager first.
          <div className={cx(ui.buttonRow, 'mt-2.5')}>
            <button type="button" className={ui.secondaryAction} onClick={onOpenStructure}>Open Structure</button>
          </div>
        </div>

        <form className={cx(ui.stackForm, ui.modalForm, questionModalFormClass)} onSubmit={onSubmit}>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-x-4 gap-y-3.5">
            <label className={ui.formLabel}>
              Course
              <select className={ui.input} name="courseId" value={form.courseId} onChange={onFormChange} required>
                <option value="">Select course</option>
                {meta.courses.map((course) => (
                  <option key={course.id} value={course.id}>{course.courseTitle}</option>
                ))}
              </select>
            </label>

            <label className={ui.formLabel}>
              Subject
              <select className={ui.input} name="subjectId" value={form.subjectId} onChange={onFormChange} required>
                <option value="">Select subject</option>
                {visibleSubjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>{subject.subjectName}</option>
                ))}
              </select>
            </label>

            <label className={ui.formLabel}>
              Topic
              <select className={ui.input} name="topicId" value={form.topicId} onChange={onFormChange}>
                <option value="">All topics under subject</option>
                {visibleTopics.map((topic) => (
                  <option key={topic.id} value={topic.id}>{topic.topicName}</option>
                ))}
              </select>
            </label>

            <label className={ui.formLabel}>
              Lesson
              <select className={ui.input} name="lessonId" value={form.lessonId} onChange={onFormChange}>
                <option value="">All lessons under topic</option>
                {visibleLessons.map((lesson) => (
                  <option key={lesson.id} value={lesson.id}>{lesson.lessonTitle}</option>
                ))}
              </select>
            </label>

            <label className={ui.formLabel}>
              Category
              <select className={ui.input} name="category" value={form.category} onChange={onFormChange}>
                <option value="past_paper">Past Paper</option>
                <option value="mock">Mock</option>
                <option value="ai">AI</option>
              </select>
            </label>

            <label className={ui.formLabel}>
              Paper
              <select className={ui.input} name="paperId" value={form.paperId} onChange={onFormChange}>
                <option value="">No paper</option>
                {meta.papers.map((paper) => (
                  <option key={paper.id} value={paper.id}>
                    {[paper.year || null, paper.paperTitle].filter(Boolean).join(' - ')}
                  </option>
                ))}
              </select>
            </label>

            <label className={ui.formLabel}>
              Type
              <select className={ui.input} name="questionType" value={form.questionType} onChange={onFormChange}>
                <option value="sba">SBA</option>
                <option value="true_false">T/F</option>
              </select>
            </label>

            <label className={ui.formLabel}>
              Status
              <select className={ui.input} name="status" value={form.status} onChange={onFormChange}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          </div>

          <label className={ui.formLabel}>
            Internal Topic Label
            <input className={ui.input}
              name="topicLabel"
              value={form.topicLabel}
              onChange={onFormChange}
              placeholder="Optional internal label for extra grouping only"
            />
          </label>

          <label className={ui.formLabel}>
            Question text
            <textarea className={ui.textarea} name="questionText" rows="4" value={form.questionText} onChange={onFormChange} required />
          </label>

          <label className={ui.formLabel}>
            Keywords
            <input className={ui.input}
              list="question-keyword-suggestions"
              name="keywordsText"
              value={form.keywordsText}
              onChange={onFormChange}
              placeholder="Example: cardiology, murmur, valvular disease, cardiology_quiz_1"
            />
          </label>
          <datalist id="question-keyword-suggestions">
            {(meta.keywordSuggestions || []).map((keyword) => (
              <option key={keyword} value={keyword} />
            ))}
          </datalist>

          <label className={ui.formLabel}>
            Main explanation
            <textarea className={ui.textarea} name="explanation" rows="3" value={form.explanation} onChange={onFormChange} />
          </label>

          <div className="grid items-center gap-3 rounded-2xl border border-brand-primary/20 bg-[linear-gradient(135deg,rgba(37,99,235,0.05),transparent_54%),var(--surface-2)] p-3.5 min-[721px]:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <strong className="m-0 block text-sm font-extrabold text-ink-strong">AI learning content</strong>
              <span className="mt-1 block text-xs leading-snug text-ink-soft">Generate only missing study content. Question text, options, and correct answer stay unchanged.</span>
            </div>
            <div className={ui.buttonRow}>
              <button className={ui.secondaryAction}
                type="button"
               
                onClick={() => onGenerateExplanation()}
                disabled={explanationGenerating || learningContentGenerating || Boolean(form.explanation?.trim())}
              >
                {explanationGenerating ? 'Generating...' : 'Generate Explanation'}
              </button>
              {form.questionType === 'sba' ? (
                <button type="button" className={ui.secondaryAction} onClick={onGenerateWhyIncorrect} disabled={whyGenerating || learningContentGenerating}>
                  {whyGenerating ? 'Generating...' : 'Generate Why Incorrect'}
                </button>
              ) : null}
              <button className={ui.primaryAction}
                type="button"
                onClick={onGenerateLearningContent}
                disabled={learningContentGenerating || explanationGenerating || whyGenerating}
              >
                {learningContentGenerating ? 'Generating...' : 'Generate Explanation + Why Incorrect + Quick Theory'}
              </button>
            </div>
          </div>

          <div className={ui.questionBuilder}>
            <div className={cx(ui.questionBuilderHead, 'mb-1')}>
              <span>{form.questionType === 'sba' ? 'SBA options' : 'T/F statements'}</span>
              {form.questionType === 'sba' ? (
                <button type="button" className={ui.secondaryAction} onClick={onGenerateWhyIncorrect} disabled={whyGenerating}>
                  {whyGenerating ? 'Generating...' : 'Generate why incorrect explanations'}
                </button>
              ) : null}
            </div>
            {missingWhyIncorrectCount > 0 ? (
              <div className={cx(ui.warningFeedback, 'my-0.5 mb-2.5')}>
                {missingWhyIncorrectCount} incorrect option{missingWhyIncorrectCount === 1 ? '' : 's'} missing a why-incorrect explanation. You can save, but students will only see reasons for completed options.
              </div>
            ) : null}
            {form.options.map((option, index) => (
              <div className={ui.optionBuilderCard} key={option.optionLabel}>
                <div className={ui.optionBuilderTop}>
                  <strong>{option.optionLabel}</strong>
                  {form.questionType === 'sba' ? (
                    <label className={ui.inlineCheck}>
                      <input className="shrink-0"
                        type="radio"
                        name="editSbaCorrect"
                        checked={option.isCorrect === 1}
                        onChange={() => onSbaCorrect(option.optionLabel)}
                      />
                      Correct
                    </label>
                  ) : (
                    <select
                      className={ui.input}
                      value={option.isCorrect}
                      onChange={(event) => onTfCorrect(index, event.target.value)}
                      aria-label={`Correct answer for statement ${option.optionLabel}`}
                    >
                      <option value={0}>False</option>
                      <option value={1}>True</option>
                    </select>
                  )}
                </div>
                <input className={ui.input}
                  value={option.optionText}
                  onChange={(event) => onOptionTextChange(index, event.target.value)}
                  placeholder={form.questionType === 'sba' ? `Option ${option.optionLabel}` : `Statement ${option.optionLabel}`}
                  aria-label={form.questionType === 'sba' ? `Option ${option.optionLabel} text` : `Statement ${option.optionLabel} text`}
                />
                {form.questionType === 'sba' && Number(option.isCorrect) !== 1 ? (
                  <label className={ui.whyIncorrectField}>
                    Why option {option.optionLabel} is incorrect
                    <textarea className={ui.textarea}
                      rows={2}
                      value={option.whyIncorrect || ''}
                      onChange={(event) => onOptionWhyIncorrectChange(index, event.target.value)}
                      placeholder="Optional but recommended. Explain why this option is not the best answer."
                    />
                  </label>
                ) : null}
              </div>
            ))}
          </div>

          <div className={ui.buttonRow}>
            <button className={ui.primaryAction} type="submit" disabled={saving}>
              {saving ? 'Saving...' : editingId ? 'Update question' : 'Save question'}
            </button>
            <button type="button" className={ui.secondaryAction} onClick={onClose} disabled={saving}>
              Cancel
            </button>
          </div>
        </form>

        {editingId || recap ? (
          <div className={questionModalRecapPanelClass}>
            <TheoryRecapAdminSection
              recap={recap}
              loading={recapLoading}
              saving={recapSaving}
              generating={recapGenerating}
              error={recapError}
              onSave={onRecapSave}
              onGenerate={onRecapGenerate}
              onDelete={onRecapDelete}
            />
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
