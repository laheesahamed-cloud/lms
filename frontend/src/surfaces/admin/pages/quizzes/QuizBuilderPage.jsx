import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createQuiz, fetchQuiz, fetchQuizzesMeta, updateQuiz } from '../../../../shared/api/quizzes.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { bulkUpdateQuestionKeywords, fetchQuestionCounts, fetchQuestions } from '../../../../shared/api/questions.api.js';
import {
  generateQuestionExplanation,
  generateWhyIncorrectExplanations,
} from '../../../../shared/api/ai.api.js';
import { fetchTheoryRecap, generateTheoryRecap } from '../../../../shared/api/theoryRecap.api.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { hasUnsafeFileNameCharacters } from '../../../../shared/utils/fileValidation.js';
import {
  buildGlobalDefaults,
  createEmptyQuestion,
  normalizeWhitespace,
  parseJsonQuestions,
  parseRawQuestions,
  resolveQuestion,
  sampleJsonFormat,
  saveQuestionRecord,
  validateQuestion,
} from '../questions/bulkQuestionInputUtils.js';
import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';

const defaultForm = {
  adminName: '',
  studentTitle: '',
  displayTitleMode: 'number',
  quizNumber: null,
  quizDescription: '',
  courseId: '',
  subjectId: '',
  topicId: '',
  lessonId: '',
  paperId: '',
  category: '',
  collectionTags: '',
  isFree: false,
  quizMode: 'standard',
  timeLimit: 30,
  passingMarks: 45,
  status: 'draft',
  hideTimeLimit: false,
  hidePassingMarks: false,
  examModeOnly: false,
  isGeneral: false,
  subtopic: '',
  blueprint: { sections: [] },
  randomizationMode: 'static',
  questionIds: [],
};

const defaultFilters = {
  courseId: '',
  subjectId: '',
  topicId: '',
  lessonId: '',
  paperId: '',
  category: '',
  questionType: '',
  questionUsage: 'all',
  keywords: '',
  search: '',
};

const QUESTION_POOL_LIMIT = 120;
const QUESTION_RANDOM_DRAW_DEFAULT = 10;
const QUIZ_DRAFT_JSON_MAX_BYTES = 2 * 1024 * 1024;

function validateQuizDraftJsonFile(file) {
  if (!file) return '';
  const name = String(file.name || '').trim();
  const type = String(file.type || '').toLowerCase();
  if (!name.toLowerCase().endsWith('.json') || (type && type !== 'application/json')) {
    return 'Import a JSON draft file exported from the assessment bulk question tool.';
  }
  if (file.size > QUIZ_DRAFT_JSON_MAX_BYTES) {
    return 'Assessment draft JSON is too large. Upload a file under 2 MB.';
  }
  if (!name || name.length > 180 || hasUnsafeFileNameCharacters(name)) {
    return 'Rename the JSON file without special path characters, then import again.';
  }
  return '';
}

const bulkInputSample = `Question 1. A 45-year-old woman has exertional chest pain relieved by rest. What is the most likely diagnosis?
A. Pericarditis
B. Stable angina
C. Pneumothorax
D. GORD
E. Costochondritis
Answer: B
Explanation: Exertional chest pain relieved by rest is typical of stable angina.

Question 2. Regarding epilepsy, mark each statement as true or false.
A. A diagnosis of epilepsy can affect driving eligibility. True
B. A normal EEG excludes epilepsy. False
C. Epilepsy is defined by a recurrent tendency to seizures. True
D. All first seizures require lifelong antiseizure medication. False
E. History from a witness can help classify the event. True
Explanation: Epilepsy remains a clinical diagnosis supported by history and selected tests.`;

const quizQuestionTabs = [
  { id: 'existing', label: 'Question Bank' },
  { id: 'selected', label: 'Selected Paper' },
  { id: 'bulk', label: 'Add New Questions' },
];

const qb = {
  shell: 'grid grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)] items-start gap-5 max-[900px]:grid-cols-1',
  main: 'grid min-w-0 gap-[18px]',
  sidebar: 'sticky top-[84px] grid min-w-0 gap-[18px] max-[900px]:static',
  section: 'grid gap-4 p-[22px]',
  sectionHead: 'items-start',
  eyebrow: 'mb-1.5 inline-flex items-center text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink-soft',
  fieldNote: 'mt-1.5 block text-[11.5px] leading-[1.45] text-ink-soft',
  grid: 'grid gap-3.5',
  gridTwo: 'grid gap-3.5 grid-cols-2 max-[900px]:grid-cols-1',
  gridThree: 'grid gap-3.5 grid-cols-3 max-[900px]:grid-cols-1',
  gridFour: 'grid gap-3.5 grid-cols-4 max-[900px]:grid-cols-1',
  hierarchyNote: 'inline-flex items-center justify-center rounded-lg border border-line-soft bg-surface-2 px-3.5 py-2.5 text-xs font-bold text-ink-medium',
  checkbox: `${ui.checkboxRow} min-h-full rounded-lg border border-line-soft bg-surface-2 px-4 py-3.5 [&>span]:grid [&>span]:gap-1`,
  selectionLayout: 'grid grid-cols-2 items-start gap-[18px] max-[900px]:grid-cols-1',
  selectionPanel: 'grid min-w-0 gap-3.5',
  selectedPanel: 'sticky top-[84px] self-start max-[900px]:static',
  panelTop: 'flex items-start justify-between gap-3 max-[640px]:flex-col',
  panelTitle: 'm-0 mb-1 text-base text-ink-strong',
  panelText: 'm-0 text-[12.5px] text-ink-soft',
  list: 'flex max-h-[min(68vh,960px)] flex-col gap-2.5 overflow-y-auto pr-1.5',
  empty: 'rounded-lg border border-dashed border-line-medium bg-surface-2 p-4 text-center text-[13px] text-ink-soft',
  questionCard: 'flex items-start justify-between gap-3.5 rounded-lg border border-line-soft bg-surface-2 px-4 py-3.5 max-[900px]:flex-col max-[900px]:items-stretch',
  questionCardSelected: 'border-[color-mix(in_srgb,var(--accent-blue)_30%,var(--line-soft))] bg-[color-mix(in_srgb,var(--accent-blue)_8%,var(--surface-2))]',
  questionCopy: 'grid min-w-0 gap-1.5',
  questionStrong: 'text-[13px] leading-[1.55] text-ink-strong break-words',
  questionMeta: 'break-words text-[11.5px] leading-[1.55] text-ink-soft',
  usage: 'flex flex-wrap items-center gap-2',
  usageText: 'break-words text-[11.5px] leading-normal text-ink-soft',
  badge: 'inline-flex min-h-6 items-center rounded-full border border-line-soft bg-surface-1 px-2 text-[11px] font-extrabold tracking-[0.02em] text-ink-soft',
  badgeFresh: 'border-emerald-600/20 bg-[var(--color-success-light)] text-brand-success',
  badgeUsed: 'border-amber-600/20 bg-[var(--color-warning-light)] text-brand-warning',
  badgeCurrent: 'border-brand-primary/25 bg-brand-primary-light text-brand-primary',
  transfer: 'min-h-[38px] min-w-[88px] px-3.5 max-[900px]:w-full',
  transferSelected: 'border-[color-mix(in_srgb,var(--accent-blue)_32%,var(--line-soft))] bg-[color-mix(in_srgb,var(--accent-blue)_12%,var(--surface-2))] text-[var(--accent-blue)]',
  summary: 'grid grid-cols-2 gap-3 max-[640px]:grid-cols-1',
  summaryCard: 'grid gap-1 rounded-lg border border-line-soft bg-surface-2 px-4 py-3.5',
  summaryAccent: 'border-[color-mix(in_srgb,var(--accent-blue)_30%,var(--line-soft))] bg-[color-mix(in_srgb,var(--accent-blue)_8%,var(--surface-2))]',
  settingsGrid: 'grid grid-cols-2 gap-3 max-[900px]:grid-cols-1',
  modeGrid: 'grid grid-cols-2 gap-3 max-[900px]:grid-cols-1',
  modeOption: `${ui.checkboxRow} min-h-full rounded-lg border border-line-soft bg-surface-2 px-4 py-3.5 transition`,
  modeOptionActive: 'border-brand-primary/35 bg-[var(--color-primary-light)] text-brand-primary',
  infoBox: 'rounded-lg border border-line-soft bg-surface-2 px-4 py-3 text-[12.5px] leading-[1.55] text-ink-soft',
  sidebarCard: 'grid gap-4 p-[22px]',
  checklist: 'grid gap-3',
  checklistItem: 'grid gap-1 rounded-lg border border-line-soft bg-surface-2 px-3.5 py-3',
  sidebarActions: 'grid gap-2.5',
};

function normalizeStatusForApi(status) {
  return status === 'active' ? 'active' : 'inactive';
}

function formatOptionLabel(value) {
  const label = String(value || '').trim();
  if (!label) return '';
  const known = {
    sba: 'SBA',
    true_false: 'True / False',
    past: 'Past',
    past_paper: 'Past Paper',
    mock: 'Mock',
    exam_only: 'Exam Mode Only',
    standard: 'Practice + Exam',
  };
  if (known[label]) return known[label];
  return label
    .split(/[_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function toId(value) {
  if (value === null || value === undefined || value === '') return null;
  const next = Number(value);
  return Number.isFinite(next) && next > 0 ? next : null;
}

function filterByCourse(items, courseId) {
  return items.filter((item) => !courseId || String(item.courseId) === String(courseId));
}

function normalizeQuizMeta(payload = {}) {
  const rawCourses = Array.isArray(payload.courses) ? payload.courses : [];
  const rawSubjects = Array.isArray(payload.subjects) ? payload.subjects : [];
  const rawTopics = Array.isArray(payload.topics) ? payload.topics : [];
  const rawLessons = Array.isArray(payload.lessons) ? payload.lessons : [];
  const rawPapers = Array.isArray(payload.papers) ? payload.papers : [];
  const rawQuestions = Array.isArray(payload.questions) ? payload.questions : [];
  const usedQuestionIds = new Set(
    (Array.isArray(payload.usedQuestionIds) ? payload.usedQuestionIds : [])
      .map((id) => toId(id))
      .filter(Boolean)
  );

  const topics = rawTopics.map((topic) => ({
    id: toId(topic.id),
    subjectId: toId(topic.subjectId ?? topic.subject_id ?? topic.topicId ?? topic.topic_id),
    courseId: toId(topic.courseId ?? topic.course_id),
    topicName: String(topic.topicName ?? topic.subtopic_name ?? topic.name ?? '').trim(),
  })).filter((topic) => topic.id);

  const topicCourseMap = new Map(
    topics
      .filter((topic) => topic.subjectId && topic.courseId)
      .map((topic) => [topic.subjectId, topic.courseId])
  );

  const subjects = rawSubjects.map((subject) => ({
    id: toId(subject.id),
    courseId: toId(subject.courseId ?? subject.course_id) ?? topicCourseMap.get(toId(subject.id)) ?? null,
    subjectName: String(subject.subjectName ?? subject.topic_name ?? subject.name ?? '').trim(),
  })).filter((subject) => subject.id);

  const subjectCourseMap = new Map(
    subjects
      .filter((subject) => subject.courseId)
      .map((subject) => [subject.id, subject.courseId])
  );

  const lessons = rawLessons.map((lesson) => ({
    id: toId(lesson.id),
    courseId:
      toId(lesson.courseId ?? lesson.course_id) ??
      subjectCourseMap.get(toId(lesson.subjectId ?? lesson.subject_id ?? lesson.topicId ?? lesson.topic_id)) ??
      null,
    subjectId: toId(lesson.subjectId ?? lesson.subject_id ?? lesson.topicId ?? lesson.topic_id),
    topicId: toId(lesson.topicId ?? lesson.topic_id ?? lesson.subtopicId ?? lesson.subtopic_id),
    lessonTitle: String(lesson.lessonTitle ?? lesson.lesson_title ?? lesson.name ?? '').trim(),
  })).filter((lesson) => lesson.id);

  return {
    courses: rawCourses.map((course) => ({
      id: toId(course.id),
      courseTitle: String(course.courseTitle ?? course.course_title ?? course.name ?? '').trim(),
    })).filter((course) => course.id),
    subjects,
    topics,
    lessons,
    papers: rawPapers.map((paper) => ({
      id: toId(paper.id),
      paperTitle: String(paper.paperTitle ?? paper.paper_title ?? paper.name ?? '').trim(),
      year: paper.year ?? null,
      examSource: String(paper.examSource ?? paper.exam_source ?? '').trim(),
      keywordsText: String(paper.keywordsText ?? paper.keywords_text ?? '').trim(),
    })).filter((paper) => paper.id),
    categories: Array.isArray(payload.categories) ? payload.categories : [],
    questionTypes: Array.isArray(payload.questionTypes) ? payload.questionTypes : [],
    keywordSuggestions: Array.isArray(payload.keywordSuggestions) ? payload.keywordSuggestions : [],
    questions: rawQuestions.map((question) => ({
      id: toId(question.id),
      courseId: toId(question.courseId ?? question.course_id),
      subjectId: toId(question.subjectId ?? question.subject_id ?? question.topicId ?? question.topic_id),
      topicId: toId(question.topicId ?? question.topic_id ?? question.subtopicId ?? question.subtopic_id),
      lessonId: toId(question.lessonId ?? question.lesson_id),
      paperId: toId(question.paperId ?? question.paper_id),
      subtopic: String(question.subtopic ?? '').trim(),
      category: String(question.category ?? question.question_category ?? '').trim(),
      questionType: String(question.questionType ?? question.question_type ?? '').trim(),
      questionText: String(question.questionText ?? question.question_text ?? '').trim(),
      keywordsText: String(question.keywordsText ?? question.keywords_text ?? '').trim(),
      usageCount: Number(question.usageCount ?? question.quizCount ?? question.quiz_count ?? question.usage_count ?? 0),
      usedInAnyQuiz:
        usedQuestionIds.has(toId(question.id)) ||
        Number(question.usageCount ?? question.quizCount ?? question.quiz_count ?? question.usage_count ?? 0) > 0 ||
        question.usedInAnyQuiz === true,
      courseTitle: String(question.courseTitle ?? question.course_title ?? '').trim(),
      subjectName: String(question.subjectName ?? question.subject_name ?? '').trim(),
      topicName: String(question.topicName ?? question.topic_name ?? '').trim(),
      lessonTitle: String(question.lessonTitle ?? question.lesson_title ?? '').trim(),
      paperTitle: String(question.paperTitle ?? question.paper_title ?? '').trim(),
    })).filter((question) => question.id),
  };
}

function normalizeQuestionRows(rows = []) {
  return normalizeQuizMeta({ questions: Array.isArray(rows) ? rows : [] }).questions;
}

function mergeQuestionRowsIntoMeta(current, rows = []) {
  const incoming = Array.isArray(rows) ? rows : [];
  const byId = new Map(current.questions.map((question) => [question.id, question]));
  incoming.forEach((question) => {
    if (question?.id) byId.set(question.id, question);
  });

  const categorySet = new Set(current.categories || []);
  const typeSet = new Set(current.questionTypes || []);
  const keywordSet = new Set(current.keywordSuggestions || []);

  incoming.forEach((question) => {
    if (question.category) categorySet.add(question.category);
    if (question.questionType) typeSet.add(question.questionType);
    String(question.keywordsText || '')
      .split(',')
      .map((keyword) => keyword.trim())
      .filter(Boolean)
      .forEach((keyword) => keywordSet.add(keyword));
  });

  return {
    ...current,
    categories: Array.from(categorySet).filter(Boolean).sort((left, right) => left.localeCompare(right)),
    questionTypes: Array.from(typeSet).filter(Boolean).sort((left, right) => left.localeCompare(right)),
    keywordSuggestions: Array.from(keywordSet).filter(Boolean).sort((left, right) => left.localeCompare(right)),
    questions: Array.from(byId.values()),
  };
}

function createBlueprintSection(overrides = {}) {
  return {
    id: overrides.id || `section-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: overrides.title || '',
    targetCount: Number(overrides.targetCount || 10),
    courseId: overrides.courseId ? String(overrides.courseId) : '',
    subjectId: overrides.subjectId ? String(overrides.subjectId) : '',
    topicId: overrides.topicId ? String(overrides.topicId) : '',
    lessonId: overrides.lessonId ? String(overrides.lessonId) : '',
    paperId: overrides.paperId ? String(overrides.paperId) : '',
    category: overrides.category ? String(overrides.category) : '',
    questionType: overrides.questionType ? String(overrides.questionType) : '',
  };
}

function normalizeBlueprint(raw = {}) {
  const sections = Array.isArray(raw?.sections) ? raw.sections : [];
  return {
    sections: sections.map((section, index) => createBlueprintSection({
      id: section.id || `section-${index + 1}`,
      title: section.title || `Section ${String.fromCharCode(65 + Math.min(index, 25))}`,
      targetCount: Math.min(Math.max(Number(section.targetCount || 0), 0), 500),
      courseId: section.courseId,
      subjectId: section.subjectId,
      topicId: section.topicId,
      lessonId: section.lessonId,
      paperId: section.paperId,
      category: section.category,
      questionType: section.questionType,
    })),
  };
}

function getBlueprintValue(section, key, fallback = '') {
  return section?.[key] ? String(section[key]) : String(fallback || '');
}

function buildBlueprintFilters(section, form) {
  return {
    ...defaultFilters,
    courseId: getBlueprintValue(section, 'courseId', form.courseId),
    subjectId: getBlueprintValue(section, 'subjectId', form.subjectId),
    topicId: getBlueprintValue(section, 'topicId', form.topicId),
    lessonId: getBlueprintValue(section, 'lessonId', form.lessonId),
    paperId: getBlueprintValue(section, 'paperId', form.paperId),
    category: getBlueprintValue(section, 'category'),
    questionType: getBlueprintValue(section, 'questionType'),
    questionUsage: 'all',
  };
}

function questionMatchesBlueprintSection(question, section, form) {
  const filters = buildBlueprintFilters(section, form);
  if (filters.courseId && String(question.courseId || '') !== String(filters.courseId)) return false;
  if (filters.subjectId && String(question.subjectId || '') !== String(filters.subjectId)) return false;
  if (filters.topicId && String(question.topicId || '') !== String(filters.topicId)) return false;
  if (filters.lessonId && String(question.lessonId || '') !== String(filters.lessonId)) return false;
  if (filters.paperId && String(question.paperId || '') !== String(filters.paperId)) return false;
  if (filters.category && String(question.category || '') !== String(filters.category)) return false;
  if (filters.questionType && String(question.questionType || '') !== String(filters.questionType)) return false;
  return true;
}

function buildQuestionPoolParams(filters, options = {}) {
  const loadingIds = Array.isArray(options.ids) && options.ids.length > 0;
  const params = {
    status: 'active',
    limit: options.limit || QUESTION_POOL_LIMIT,
  };

  if (!loadingIds && filters.search?.trim()) params.search = filters.search.trim();
  if (!loadingIds && filters.courseId) params.courseId = filters.courseId;
  if (!loadingIds && filters.subjectId) params.subjectId = filters.subjectId;
  if (!loadingIds && filters.topicId) params.topicId = filters.topicId;
  if (!loadingIds && filters.lessonId) params.lessonId = filters.lessonId;
  if (!loadingIds && filters.paperId) params.paperId = filters.paperId;
  if (!loadingIds && filters.category) params.category = filters.category;
  if (!loadingIds && filters.questionType) params.type = filters.questionType;
  if (!loadingIds && filters.keywords?.trim()) params.keywords = filters.keywords.trim();
  if (!loadingIds && (filters.questionUsage === 'unused' || filters.questionUsage === 'used')) params.usage = filters.questionUsage;
  if (options.random) params.random = '1';
  if (loadingIds) {
    params.ids = options.ids.join(',');
    params.limit = Math.min(Math.max(options.ids.length, 1), 200);
  }
  if (options.excludeIds?.length) params.excludeIds = options.excludeIds.join(',');

  return params;
}

function buildQuestionCountParams(filters) {
  const params = buildQuestionPoolParams(filters, { limit: 1 });
  delete params.limit;
  delete params.random;
  delete params.excludeIds;
  delete params.usage;
  return params;
}

function BuilderSection({ eyebrow, title, description, children, actions }) {
  return (
    <section className={cx(ui.panelCard, qb.section)}>
      <div className={cx(ui.panelTop, qb.sectionHead)}>
        <div>
          {eyebrow ? <span className={qb.eyebrow}>{eyebrow}</span> : null}
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {actions ? <div className={ui.buttonRow}>{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

function FieldNote({ children }) {
  return <small className={qb.fieldNote}>{children}</small>;
}

function buildQuestionPreview(text, wordLimit = 4) {
  const words = String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length <= wordLimit) {
    return words.join(' ');
  }

  return `${words.slice(0, wordLimit).join(' ')}...`;
}

const QuestionListCard = memo(function QuestionListCard({ question, selected, disabled = false, onToggle }) {
  const usageLabel = selected ? 'Used in this assessment' : question.usedInAnyQuiz ? 'Used' : 'Fresh';
  return (
    <article className={cx(qb.questionCard, selected && qb.questionCardSelected)}>
      <div className={qb.questionCopy}>
        <strong className={qb.questionStrong} title={question.questionText}>{buildQuestionPreview(question.questionText)}</strong>
        <div className={qb.questionMeta}>
          {[
            question.courseTitle,
            question.subjectName || 'No subject',
            question.topicName || 'All topics',
            question.lessonTitle || null,
            question.paperTitle || null,
            formatOptionLabel(question.category),
            formatOptionLabel(question.questionType),
          ]
            .filter(Boolean)
            .join(' • ')}
        </div>
        <div className={qb.usage}>
          <span className={cx(qb.badge, selected ? qb.badgeCurrent : question.usedInAnyQuiz ? qb.badgeUsed : qb.badgeFresh)}>
            {usageLabel}
          </span>
          {question.usageCount > 0 ? (
            <span className={qb.usageText}>
              Used in {question.usageCount} assessment{question.usageCount === 1 ? '' : 's'}
            </span>
          ) : (
            <span className={qb.usageText}>Not used in any assessment yet</span>
          )}
        </div>
        {question.keywordsText ? (
          <div className={qb.questionMeta}>Tags: {question.keywordsText}</div>
        ) : null}
      </div>
      <button className={cx(ui.secondaryButton, qb.transfer, selected && qb.transferSelected)}
        type="button"
       
        onClick={() => onToggle(question.id)}
        disabled={selected || disabled}
      >
        {disabled && !selected ? 'Rules' : selected ? 'Selected' : 'Add'}
      </button>
    </article>
  );
});

function buildDuplicateMap(questions) {
  const map = new Map();
  questions.forEach((question) => {
    const key = normalizeWhitespace(question.questionText).toLowerCase();
    if (!key) return;
    map.set(key, (map.get(key) || 0) + 1);
  });
  return map;
}

function resolveQuizBulkDefaults(form, fallbackType = '') {
  return {
    ...buildGlobalDefaults(),
    courseId: form.courseId || '',
    subjectId: form.isGeneral ? '' : form.subjectId || '',
    topicId: form.isGeneral ? '' : form.topicId || '',
    lessonId: form.isGeneral ? '' : form.lessonId || '',
    category: form.category || 'mock',
    questionType: fallbackType || '',
    paperId: form.paperId || '',
    keywordsText: form.collectionTags || '',
  };
}

function getHierarchyOptions(meta, question, defaults) {
  const courseId = question.courseId || defaults.courseId;
  const subjectId = question.subjectId || defaults.subjectId;
  const topicId = question.topicId || defaults.topicId;
  return {
    subjects: meta.subjects.filter((subject) => !courseId || String(subject.courseId) === String(courseId)),
    topics: meta.topics.filter((topic) =>
      (!courseId || String(topic.courseId) === String(courseId)) &&
      (!subjectId || String(topic.subjectId) === String(subjectId))
    ),
    lessons: meta.lessons.filter((lesson) =>
      (!courseId || String(lesson.courseId) === String(courseId)) &&
      (!subjectId || String(lesson.subjectId) === String(subjectId)) &&
      (!topicId || String(lesson.topicId || '') === String(topicId))
    ),
  };
}

function BulkAddQuestionsPanel({
  meta,
  form,
  defaults,
  onDefaultsChange,
  rawInput,
  inputMode,
  questions,
  currentIndex,
  queueSearch,
  queueStatusFilter,
  aiOptions,
  aiRunning,
  aiProgress,
  savingBulk,
  bulkToast,
  onRawInputChange,
  onInputModeChange,
  onParse,
  onCopySample,
  onAddBlank,
  onSaveCurrent,
  onSaveReady,
  onSaveAll,
  onSaveDraft,
  onExportDraft,
  onImportDraft,
  onClearDraft,
  onMarkAllReviewed,
  onRemoveQuestion,
  onRemoveUnsavedQuestions,
  onClearQueue,
  onDetachSavedQuestion,
  onQuestionPatch,
  onCurrentIndexChange,
  onQueueSearchChange,
  onQueueStatusFilterChange,
  onAiOptionsChange,
  onRunAi,
  onRetryFailedAi,
}) {
  const duplicateMap = useMemo(() => buildDuplicateMap(questions), [questions]);
  const diagnostics = useMemo(() => questions.map((question) => {
    const resolved = resolveQuestion(question, defaults, true);
    return {
      resolved,
      validation: validateQuestion(question, resolved, duplicateMap),
    };
  }), [defaults, duplicateMap, questions]);
  const currentQuestion = questions[currentIndex] || null;
  const currentDiagnostics = diagnostics[currentIndex] || null;
  const currentHierarchy = currentQuestion ? getHierarchyOptions(meta, currentQuestion, defaults) : { subjects: [], topics: [], lessons: [] };
  const readyCount = diagnostics.filter((item, index) => item.validation.canSave && !questions[index]?.savedId).length;
  const savedCount = questions.filter((question) => question.savedId).length;
  const filteredQueue = questions.filter((question, index) => {
    const status = diagnostics[index]?.validation.queueStatus || 'Needs Review';
    if (queueStatusFilter !== 'all' && status !== queueStatusFilter) return false;
    const needle = queueSearch.trim().toLowerCase();
    if (!needle) return true;
    return [
      question.questionText,
      question.explanation,
      question.keywordsText,
      question.sourceSnippet,
    ].join(' ').toLowerCase().includes(needle);
  });

  function handleDefaultChange(event) {
    const { name, value } = event.target;
    const next = { ...defaults, [name]: value };
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
    onDefaultsChange(next);
  }

  const defaultHierarchy = getHierarchyOptions(meta, {}, defaults);

  function patchCurrent(patch) {
    if (!currentQuestion) return;
    onQuestionPatch(currentQuestion.clientId, patch);
  }

  function patchOption(optionIndex, patch) {
    if (!currentQuestion) return;
    const nextOptions = currentQuestion.options.map((option, index) => (
      index === optionIndex ? { ...option, ...patch } : option
    ));
    patchCurrent({ options: nextOptions });
  }

  function markCorrect(optionIndex) {
    if (!currentQuestion) return;
    patchCurrent({
      options: currentQuestion.options.map((option, index) => ({
        ...option,
        isCorrect: index === optionIndex ? 1 : 0,
      })),
    });
  }

  return (
    <div className="grid gap-5">
      {bulkToast ? <div className={ui.feedbackSuccess}>{bulkToast}</div> : null}

      {questions.length ? (
        <div className="lms-card-compact grid gap-4 rounded-[var(--ds-card-radius-compact)] border border-line-soft bg-surface-1 p-4 shadow-[var(--ds-card-shadow)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="m-0 text-base font-extrabold text-ink-strong">Generate Missing AI Content</h3>
              <p className="m-0 mt-1 text-[13px] leading-relaxed text-ink-soft">
                Same helper as the main bulk question tool. Existing fields are preserved unless regenerate is enabled.
              </p>
            </div>
            <button type="button" className={ui.primaryAction} onClick={onRunAi} disabled={aiRunning}>
              {aiRunning ? 'Generating...' : 'Generate Missing AI Content'}
            </button>
          </div>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-3">
            <label className={qb.checkbox}>
              <input className="shrink-0"
                type="checkbox"
                checked={aiOptions.explanations}
                onChange={(event) => onAiOptionsChange({ explanations: event.target.checked })}
              />
              <span>Generate missing explanations</span>
            </label>
            <label className={qb.checkbox}>
              <input className="shrink-0"
                type="checkbox"
                checked={aiOptions.whyIncorrect}
                onChange={(event) => onAiOptionsChange({ whyIncorrect: event.target.checked })}
              />
              <span>Generate missing why incorrect answers</span>
            </label>
            <label className={qb.checkbox}>
              <input className="shrink-0"
                type="checkbox"
                checked={aiOptions.theoryCards}
                onChange={(event) => onAiOptionsChange({ theoryCards: event.target.checked })}
              />
              <span>Generate missing quick theory cards</span>
            </label>
            <label className={qb.checkbox}>
              <input className="shrink-0"
                type="checkbox"
                checked={aiOptions.regenerate}
                onChange={(event) => onAiOptionsChange({ regenerate: event.target.checked })}
              />
              <span>Regenerate existing fields</span>
            </label>
          </div>

          {aiProgress.total > 0 ? (
            <div className="grid gap-3 rounded-lg border border-line-soft bg-surface-2 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <strong className="text-ink-strong">{aiProgress.completed} / {aiProgress.total} completed</strong>
                <span className="text-ink-soft">{aiProgress.currentLabel}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-3">
                <span
                  className="block h-full w-full origin-left rounded-full bg-[var(--brand-gradient-primary)]"
                  style={{ transform: `scaleX(${aiProgress.total ? Math.round((aiProgress.completed / aiProgress.total) * 100) / 100 : 0})` }}
                />
              </div>
              <div className="grid max-h-44 gap-2 overflow-y-auto">
                {Object.entries(aiProgress.items).slice(0, 20).map(([clientId, item]) => (
                  <button className={cx(
                      'flex min-h-9 items-center gap-2 rounded-md border border-line-soft bg-surface-1 px-3 text-left text-xs font-bold text-ink-soft shadow-none',
                      item.status === 'completed' && 'border-brand-success/25 text-brand-success',
                      item.status === 'failed' && 'border-brand-error/25 text-brand-error',
                      item.status === 'processing' && 'border-brand-primary/25 text-brand-primary'
                    )}
                    key={clientId}
                    type="button"
                   
                    onClick={() => onCurrentIndexChange(questions.findIndex((question) => question.clientId === clientId))}
                  >
                    <span>{item.status === 'completed' ? 'Done' : item.status === 'failed' ? 'Failed' : item.status === 'processing' ? 'Working' : 'Queued'}</span>
                    <span className="truncate">{item.label}</span>
                    {item.error ? <small className="ml-auto truncate">{item.error}</small> : null}
                  </button>
                ))}
              </div>
              {Object.values(aiProgress.items).some((item) => item.status === 'failed') ? (
                <button type="button" className={ui.secondaryAction} onClick={onRetryFailedAi} disabled={aiRunning}>
                  Retry failed questions
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 rounded-lg border border-line-soft bg-surface-2 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="m-0 text-base font-extrabold text-ink-strong">Bulk Add Questions to This Assessment</h3>
            <p className="m-0 mt-1 text-[13px] leading-relaxed text-ink-soft">
              New items save into the main question bank first, then their question IDs are added to this assessment.
            </p>
          </div>
          <div className="flex rounded-md border border-line-soft bg-surface-1 p-1">
            {['text', 'json'].map((mode) => (
              <button className={cx(
                  'min-h-9 rounded px-3 text-xs font-extrabold shadow-none',
                  inputMode === mode ? 'border border-brand-primary/35 bg-[var(--color-primary-light)] text-brand-primary' : 'bg-transparent text-ink-soft'
                )}
                key={mode}
                type="button"
               
                onClick={() => onInputModeChange(mode)}
              >
                {mode === 'json' ? 'JSON' : 'Text'}
              </button>
            ))}
          </div>
        </div>

        <textarea className="min-h-[220px] resize-y rounded-lg border border-line-soft bg-surface-1 p-3 text-sm leading-relaxed text-ink-strong"
          aria-label="Bulk question input"
          value={rawInput}
          onChange={(event) => onRawInputChange(event.target.value)}
          placeholder={bulkInputSample}
        />

        <div className={ui.buttonRow}>
          <button type="button" className={ui.primaryAction} onClick={onParse}>
            Parse Questions
          </button>
          <button type="button" className={ui.secondaryAction} onClick={onCopySample}>
            Copy Sample JSON
          </button>
          <button type="button" className={ui.secondaryAction} onClick={onAddBlank}>
            Add Blank Question
          </button>
          <button type="button" className={ui.secondaryAction} onClick={onSaveDraft}>
            Save Draft
          </button>
        </div>
      </div>

      <div className="lms-card-compact grid gap-3 rounded-[var(--ds-card-radius-compact)] border border-line-soft bg-surface-1 p-4 shadow-[var(--ds-card-shadow)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="m-0 text-base font-extrabold text-ink-strong">Global Defaults</h3>
            <p className="m-0 mt-1 text-[13px] leading-relaxed text-ink-soft">
              These start from the assessment metadata. Change them here for the batch, then override individual questions on the right when needed.
            </p>
          </div>
          <div className={ui.buttonRow}>
            <button type="button" className={ui.secondaryAction} onClick={onExportDraft}>
              Export Draft JSON
            </button>
            <button type="button" className={ui.secondaryAction} onClick={onImportDraft}>
              Import Draft JSON
            </button>
            <button type="button" className={ui.dangerAction} onClick={onClearDraft}>
              Clear Draft
            </button>
          </div>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
          <label className={ui.formLabel}>
            Course
            <select className={ui.input} name="courseId" value={defaults.courseId} onChange={handleDefaultChange}>
              <option value="">Select course</option>
              {meta.courses.map((course) => <option key={course.id} value={course.id}>{course.courseTitle}</option>)}
            </select>
          </label>
          <label className={ui.formLabel}>
            Subject
            <select className={ui.input} name="subjectId" value={defaults.subjectId} onChange={handleDefaultChange}>
              <option value="">Select subject</option>
              {defaultHierarchy.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.subjectName}</option>)}
            </select>
          </label>
          <label className={ui.formLabel}>
            Topic
            <select className={ui.input} name="topicId" value={defaults.topicId} onChange={handleDefaultChange}>
              <option value="">All topics</option>
              {defaultHierarchy.topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.topicName}</option>)}
            </select>
          </label>
          <label className={ui.formLabel}>
            Lesson
            <select className={ui.input} name="lessonId" value={defaults.lessonId} onChange={handleDefaultChange}>
              <option value="">All lessons</option>
              {defaultHierarchy.lessons.map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.lessonTitle}</option>)}
            </select>
          </label>
          <label className={ui.formLabel}>
            Category
            <select className={ui.input} name="category" value={defaults.category} onChange={handleDefaultChange}>
              {Array.from(new Set(['mock', 'past_paper', ...meta.categories.filter(Boolean)])).map((category) => (
                <option key={category} value={category}>{formatOptionLabel(category)}</option>
              ))}
            </select>
          </label>
          <label className={ui.formLabel}>
            Question Type
            <select className={ui.input} name="questionType" value={defaults.questionType} onChange={handleDefaultChange}>
              {Array.from(new Set(['sba', 'true_false', ...meta.questionTypes.filter(Boolean)])).map((questionType) => (
                <option key={questionType} value={questionType}>{formatOptionLabel(questionType)}</option>
              ))}
            </select>
          </label>
          <label className={ui.formLabel}>
            Paper / Source
            <select className={ui.input} name="paperId" value={defaults.paperId} onChange={handleDefaultChange}>
              <option value="">No paper</option>
              {meta.papers.map((paper) => <option key={paper.id} value={paper.id}>{paper.paperTitle}</option>)}
            </select>
          </label>
          <label className={ui.formLabel}>
            Global Keywords / Tags
            <input className={ui.input}
              name="keywordsText"
              value={defaults.keywordsText}
              onChange={handleDefaultChange}
              placeholder={form.collectionTags || 'cardiology, revision'}
            />
          </label>
        </div>
      </div>

      {questions.length ? (
        <div className="grid grid-cols-[minmax(220px,300px)_minmax(0,1fr)] gap-4 max-[980px]:grid-cols-1">
          <aside className="lms-card-compact grid content-start gap-3 rounded-[var(--ds-card-radius-compact)] border border-line-soft bg-surface-1 p-4 shadow-[var(--ds-card-shadow)]">
            <div className="flex items-center justify-between gap-3">
              <h3 className="m-0 text-sm font-extrabold text-ink-strong">Question Queue</h3>
              <span className={ui.tablePill}>{savedCount} saved • {readyCount} ready</span>
            </div>
            <div className={ui.buttonRow}>
              <button type="button" className={cx(ui.secondaryButton, 'min-h-8 px-3 text-xs')} onClick={onRemoveUnsavedQuestions} disabled={savingBulk || !questions.some((question) => !question.savedId)}>
                Delete Unsaved
              </button>
              <button type="button" className={cx(ui.dangerAction, 'min-h-8 px-3 text-xs')} onClick={onClearQueue} disabled={savingBulk || !questions.length}>
                Clear Queue
              </button>
            </div>
            <div className="grid gap-2">
              <label className={ui.formLabel}>
                Search Queue
                <input className={ui.input} value={queueSearch} onChange={(event) => onQueueSearchChange(event.target.value)} placeholder="Search parsed questions" />
              </label>
              <label className={ui.formLabel}>
                Queue Status
                <select className={ui.input} value={queueStatusFilter} onChange={(event) => onQueueStatusFilterChange(event.target.value)}>
                  <option value="all">All statuses</option>
                  <option value="Ready">Ready</option>
                  <option value="Needs Review">Needs Review</option>
                  <option value="Missing Answer">Missing Answer</option>
                  <option value="Saved">Saved</option>
                </select>
              </label>
            </div>
            <div className="grid max-h-[560px] gap-2 overflow-y-auto pr-1">
              {filteredQueue.map((question) => {
                const index = questions.findIndex((item) => item.clientId === question.clientId);
                const validation = diagnostics[index]?.validation;
                return (
                  <article
                    key={question.clientId}
                    className={cx(
                      'grid gap-1 rounded-lg border border-line-soft bg-surface-2 p-3 text-left shadow-none transition hover:border-brand-primary/25',
                      index === currentIndex && 'border-brand-primary/35 bg-brand-primary-light'
                    )}
                  >
                    <button className="grid gap-1 border-0 bg-transparent p-0 text-left shadow-none"
                      type="button"
                     
                      onClick={() => onCurrentIndexChange(index)}
                    >
                      <span className="text-[11px] font-black uppercase tracking-[0.08em] text-brand-primary">
                        Q{index + 1} • {validation?.queueStatus || 'Review'}
                      </span>
                      <strong className="line-clamp-2 text-[13px] leading-snug text-ink-strong [-webkit-box-orient:vertical] [display:-webkit-box]">
                        {question.questionText || 'Untitled question'}
                      </strong>
                      {question.savedId ? <small className="text-[11px] font-bold text-brand-success">Saved as #{question.savedId}</small> : null}
                    </button>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <button className={cx(ui.secondaryButton, 'min-h-7 px-2.5 text-[11px]')}
                        type="button"
                       
                        onClick={() => onRemoveQuestion(question.clientId)}
                        disabled={savingBulk}
                      >
                        {question.savedId ? 'Remove Queue Item' : 'Delete Draft'}
                      </button>
                      {question.savedId ? (
                        <button className={cx(ui.dangerAction, 'min-h-7 px-2.5 text-[11px]')}
                          type="button"
                         
                          onClick={() => onDetachSavedQuestion(question.clientId)}
                          disabled={savingBulk}
                        >
                          Remove From Assessment
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
              {!filteredQueue.length ? <div className={ui.emptyBox}>No parsed questions match this queue filter.</div> : null}
            </div>
          </aside>

          <section className="lms-card-compact min-w-0 rounded-[var(--ds-card-radius-compact)] border border-line-soft bg-surface-1 p-4 shadow-[var(--ds-card-shadow)]">
            {!currentQuestion ? (
              <div className={ui.emptyBox}>Select a parsed question to review it.</div>
            ) : (
              <div className="grid min-w-0 gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="m-0 text-base font-extrabold text-ink-strong">Question {currentIndex + 1}</h3>
                    <p className="m-0 mt-1 text-xs text-ink-soft">
                      {currentDiagnostics?.validation.queueStatus || 'Needs Review'}
                    </p>
                  </div>
                  <div className={ui.buttonRow}>
                    <button type="button" className={ui.primaryAction} onClick={onSaveCurrent} disabled={savingBulk || !currentDiagnostics?.validation.canSave || currentQuestion.savedId}>
                      {savingBulk ? 'Saving...' : currentQuestion.savedId ? 'Saved' : 'Save Current Question to Assessment'}
                    </button>
                    <button type="button" className={ui.secondaryAction} onClick={onSaveReady} disabled={savingBulk || readyCount === 0}>
                      Save All Ready Questions to Assessment
                    </button>
                    <button type="button" className={ui.secondaryAction} onClick={onSaveAll} disabled={savingBulk || !questions.length}>
                      Save All Valid Questions to Assessment
                    </button>
                    <button type="button" className={ui.secondaryAction} onClick={onMarkAllReviewed} disabled={savingBulk || !questions.length}>
                      Mark All Reviewed
                    </button>
                    <button type="button" className={ui.dangerAction} onClick={() => (currentQuestion.savedId ? onDetachSavedQuestion(currentQuestion.clientId) : onRemoveQuestion(currentQuestion.clientId))} disabled={savingBulk}>
                      {currentQuestion.savedId ? 'Remove Saved From Assessment' : 'Delete Draft Question'}
                    </button>
                  </div>
                </div>

                {currentDiagnostics?.validation.errors.length ? (
                  <div className={ui.feedbackError}>{currentDiagnostics.validation.errors.join(' ')}</div>
                ) : null}
                {currentDiagnostics?.validation.warnings.length ? (
                  <div className={ui.warningFeedback}>
                    {currentDiagnostics.validation.warnings.join(' ')}
                  </div>
                ) : null}

                <label className={ui.formLabel}>
                  Question Text
                  <textarea className={ui.textarea}
                    rows="5"
                    value={currentQuestion.questionText}
                    onChange={(event) => patchCurrent({ questionText: event.target.value })}
                  />
                </label>

                <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
                  <label className={ui.formLabel}>
                    Course
                    <select className={ui.input}
                      value={currentQuestion.courseId}
                      onChange={(event) => patchCurrent({ courseId: event.target.value, subjectId: '', topicId: '', lessonId: '' })}
                    >
                      <option value="">{defaults.courseId ? 'Use assessment course' : 'Select course'}</option>
                      {meta.courses.map((course) => <option key={course.id} value={course.id}>{course.courseTitle}</option>)}
                    </select>
                  </label>
                  <label className={ui.formLabel}>
                    Subject
                    <select className={ui.input}
                      value={currentQuestion.subjectId}
                      onChange={(event) => patchCurrent({ subjectId: event.target.value, topicId: '', lessonId: '' })}
                    >
                      <option value="">{defaults.subjectId ? 'Use assessment subject' : 'Select subject'}</option>
                      {currentHierarchy.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.subjectName}</option>)}
                    </select>
                  </label>
                  <label className={ui.formLabel}>
                    Topic
                    <select className={ui.input} value={currentQuestion.topicId} onChange={(event) => patchCurrent({ topicId: event.target.value, lessonId: '' })}>
                      <option value="">{defaults.topicId ? 'Use assessment topic' : 'All topics'}</option>
                      {currentHierarchy.topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.topicName}</option>)}
                    </select>
                  </label>
                  <label className={ui.formLabel}>
                    Lesson
                    <select className={ui.input} value={currentQuestion.lessonId} onChange={(event) => patchCurrent({ lessonId: event.target.value })}>
                      <option value="">{defaults.lessonId ? 'Use assessment lesson' : 'All lessons'}</option>
                      {currentHierarchy.lessons.map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.lessonTitle}</option>)}
                    </select>
                  </label>
                  <label className={ui.formLabel}>
                    Category
                    <select className={ui.input} value={currentQuestion.category} onChange={(event) => patchCurrent({ category: event.target.value })}>
                      <option value="">{defaults.category ? `Use ${formatOptionLabel(defaults.category)}` : 'Select category'}</option>
                      {Array.from(new Set(['past_paper', 'mock', ...meta.categories.filter(Boolean)])).map((category) => (
                        <option key={category} value={category}>{formatOptionLabel(category)}</option>
                      ))}
                    </select>
                  </label>
                  <label className={ui.formLabel}>
                    Question Type
                    <select className={ui.input} value={currentQuestion.questionType} onChange={(event) => patchCurrent({ questionType: event.target.value })}>
                      <option value="">{defaults.questionType ? `Use ${formatOptionLabel(defaults.questionType)}` : 'Select type'}</option>
                      {Array.from(new Set(['sba', 'true_false', ...meta.questionTypes.filter(Boolean)])).map((questionType) => (
                        <option key={questionType} value={questionType}>{formatOptionLabel(questionType)}</option>
                      ))}
                    </select>
                  </label>
                  <label className={ui.formLabel}>
                    Paper / Source
                    <select className={ui.input} value={currentQuestion.paperId} onChange={(event) => patchCurrent({ paperId: event.target.value })}>
                      <option value="">{defaults.paperId ? 'Use assessment paper' : 'No paper'}</option>
                      {meta.papers.map((paper) => <option key={paper.id} value={paper.id}>{paper.paperTitle}</option>)}
                    </select>
                  </label>
                  <label className={ui.formLabel}>
                    Keywords / Tags
                    <input className={ui.input}
                      value={currentQuestion.keywordsText}
                      onChange={(event) => patchCurrent({ keywordsText: event.target.value })}
                      placeholder={defaults.keywordsText || 'cardiology, revision'}
                    />
                  </label>
                </div>

                <div className="grid gap-3">
                  {(currentQuestion.options || []).map((option, optionIndex) => (
                    <div key={option.optionLabel} className="grid gap-2 rounded-lg border border-line-soft bg-surface-2 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="text-sm text-ink-strong">{option.optionLabel}</strong>
                        {currentDiagnostics?.resolved.questionType === 'true_false' ? (
                          <div className="flex gap-1">
                            <button className={cx(ui.secondaryButton, 'min-h-8 px-3 text-xs', Number(option.isCorrect) === 1 && 'border-brand-success/30 bg-[var(--color-success-light)] text-brand-success')}
                              type="button"
                             
                              onClick={() => patchOption(optionIndex, { isCorrect: 1 })}
                            >
                              True
                            </button>
                            <button className={cx(ui.secondaryButton, 'min-h-8 px-3 text-xs', Number(option.isCorrect) !== 1 && 'border-brand-error/20 bg-brand-error/10 text-brand-error')}
                              type="button"
                             
                              onClick={() => patchOption(optionIndex, { isCorrect: 0 })}
                            >
                              False
                            </button>
                          </div>
                        ) : (
                          <button type="button" className={cx(ui.secondaryButton, 'min-h-8 px-3 text-xs', Number(option.isCorrect) === 1 && 'border-brand-success/30 bg-[var(--color-success-light)] text-brand-success')} onClick={() => markCorrect(optionIndex)}>
                            {Number(option.isCorrect) === 1 ? 'Correct' : 'Mark Correct'}
                          </button>
                        )}
                      </div>
                      <textarea className={ui.textarea}
                        rows="2"
                        value={option.optionText}
                        onChange={(event) => patchOption(optionIndex, { optionText: event.target.value })}
                        placeholder={currentDiagnostics?.resolved.questionType === 'true_false' ? 'Statement text' : `Option ${option.optionLabel}`}
                        aria-label={currentDiagnostics?.resolved.questionType === 'true_false' ? `Statement ${option.optionLabel} text` : `Option ${option.optionLabel} text`}
                      />
                      <textarea className={ui.textarea}
                        rows="2"
                        value={option.whyIncorrect || option.optionExplanation || ''}
                        onChange={(event) => patchOption(optionIndex, { whyIncorrect: event.target.value, optionExplanation: event.target.value })}
                        placeholder="Explanation / why incorrect"
                        aria-label={currentDiagnostics?.resolved.questionType === 'true_false' ? `Statement ${option.optionLabel} explanation` : `Why option ${option.optionLabel} is incorrect`}
                      />
                    </div>
                  ))}
                </div>

                <label className={ui.formLabel}>
                  Explanation
                  <textarea className={ui.textarea}
                    rows="5"
                    value={currentQuestion.explanation}
                    onChange={(event) => patchCurrent({ explanation: event.target.value })}
                  />
                </label>
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className={ui.emptyBox}>Paste a batch and parse it to start the assessment import queue.</div>
      )}
    </div>
  );
}

export function QuizBuilderPage() {
  const navigate = useNavigate();
  const { quizId } = useParams();
  const isEditing = Boolean(quizId);
  const bulkDraftImportRef = useRef(null);

  const [meta, setMeta] = useState({
    courses: [],
    subjects: [],
    topics: [],
    lessons: [],
    papers: [],
    categories: [],
    questionTypes: [],
    keywordSuggestions: [],
    questions: [],
  });
  const [form, setForm] = useState(defaultForm);
  const [filters, setFilters] = useState(defaultFilters);
  const [loading, setLoading] = useState(true);
  const [questionLoading, setQuestionLoading] = useState(false);
  const [visibleQuestionIds, setVisibleQuestionIds] = useState(null);
  const [randomDrawCount, setRandomDrawCount] = useState(QUESTION_RANDOM_DRAW_DEFAULT);
  const [saving, setSaving] = useState(false);
  const [drawingBlueprint, setDrawingBlueprint] = useState(false);
  const [blueprintCounts, setBlueprintCounts] = useState({});
  const [applyingTags, setApplyingTags] = useState(false);
  const [error, setError] = useState('');
  const [questionTab, setQuestionTab] = useState('existing');
  const [blueprintToast, setBlueprintToast] = useState('');
  const [bulkRawInput, setBulkRawInput] = useState('');
  const [bulkInputMode, setBulkInputMode] = useState('text');
  const [bulkQuestions, setBulkQuestions] = useState([]);
  const [bulkGlobalDefaults, setBulkGlobalDefaults] = useState(buildGlobalDefaults);
  const [bulkCurrentIndex, setBulkCurrentIndex] = useState(0);
  const [bulkQueueSearch, setBulkQueueSearch] = useState('');
  const [bulkQueueStatusFilter, setBulkQueueStatusFilter] = useState('all');
  const [savingBulk, setSavingBulk] = useState(false);
  const [bulkToast, setBulkToast] = useState('');
  const [bulkAiOptions, setBulkAiOptions] = useState({
    explanations: true,
    whyIncorrect: true,
    theoryCards: false,
    regenerate: false,
  });
  const [bulkAiRunning, setBulkAiRunning] = useState(false);
  const [bulkAiProgress, setBulkAiProgress] = useState({
    total: 0,
    completed: 0,
    currentId: null,
    currentLabel: '',
    items: {},
  });
  const formRef = useRef(defaultForm);
  const filtersRef = useRef(defaultFilters);
  const loadQuestionPoolRef = useRef(null);
  const saveBulkDraftRef = useRef(null);

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    async function load() {
      try {
        const [metaPayload, quizPayload] = await Promise.all([
          fetchQuizzesMeta(),
          isEditing ? fetchQuiz(Number(quizId)) : Promise.resolve(null),
        ]);

        setMeta(normalizeQuizMeta(metaPayload));
        let initialFilters = defaultFilters;

        if (quizPayload) {
          const nextForm = {
            adminName: quizPayload.adminName || quizPayload.quizTitle || '',
            studentTitle: quizPayload.studentTitle || quizPayload.quizTitle || '',
            displayTitleMode: quizPayload.displayTitleMode === 'title' ? 'title' : 'number',
            quizNumber: quizPayload.quizNumber ?? null,
            quizDescription: quizPayload.quizDescription || '',
            courseId: String(quizPayload.courseId || ''),
            subjectId: quizPayload.topicId ? String(quizPayload.topicId) : '',
            topicId: quizPayload.subtopicId ? String(quizPayload.subtopicId) : '',
            lessonId: quizPayload.lessonId ? String(quizPayload.lessonId) : '',
            paperId: quizPayload.paperId ? String(quizPayload.paperId) : '',
            category: quizPayload.category || '',
            collectionTags: quizPayload.collectionTags || '',
            isFree: quizPayload.isFree === 1,
            quizMode: quizPayload.examModeOnly === 1 ? 'exam_only' : 'standard',
            timeLimit: quizPayload.timeLimit || 30,
            passingMarks: quizPayload.passingMarks || 45,
            status: quizPayload.status === 'active' ? 'active' : 'draft',
            hideTimeLimit: quizPayload.hideTimeLimit === 1,
            hidePassingMarks: quizPayload.hidePassingMarks === 1,
            examModeOnly: quizPayload.examModeOnly === 1,
            isGeneral: quizPayload.isGeneral === 1,
            subtopic: quizPayload.subtopic || '',
            blueprint: normalizeBlueprint(quizPayload.blueprint),
            randomizationMode: quizPayload.randomizationMode === 'dynamic' ? 'dynamic' : 'static',
            questionIds: quizPayload.questionIds || [],
          };

          setForm(nextForm);
          initialFilters = {
            ...defaultFilters,
            courseId: nextForm.courseId,
            subjectId: nextForm.subjectId,
            topicId: nextForm.topicId,
            lessonId: nextForm.lessonId,
            paperId: nextForm.paperId,
            category: nextForm.category,
          };
          setFilters((current) => ({
            ...current,
            ...initialFilters,
          }));

          if (nextForm.questionIds.length > 0) {
            await loadQuestionPoolRef.current?.(defaultFilters, {
              ids: nextForm.questionIds,
              mergeOnly: true,
              silent: true,
            });
          }
        }

        await loadQuestionPoolRef.current?.(initialFilters, { silent: true });
      } catch (loadError) {
        setError(getErrorMessage(loadError, 'Unable to load assessment builder'));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [isEditing, quizId]);

  const bulkDraftKey = useMemo(() => `lms.quiz-builder.bulk-draft.${quizId || 'new'}`, [quizId]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(bulkDraftKey);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      setBulkRawInput(String(parsed.rawInput || ''));
      setBulkInputMode(String(parsed.inputMode || 'text'));
      setBulkQuestions(Array.isArray(parsed.questions) ? parsed.questions : []);
      setBulkGlobalDefaults(parsed.globalDefaults || resolveQuizBulkDefaults(formRef.current, filtersRef.current.questionType));
      setBulkCurrentIndex(Math.max(0, Number(parsed.currentIndex) || 0));
      setBulkQueueSearch(String(parsed.queueSearch || ''));
      setBulkQueueStatusFilter(String(parsed.queueStatusFilter || 'all'));
      if (parsed?.questions?.length || parsed?.rawInput) {
        setBulkToast('Recovered the saved bulk draft for this assessment.');
      }
    } catch {
      window.localStorage.removeItem(bulkDraftKey);
    }
  }, [bulkDraftKey]);

  useEffect(() => {
    if (!bulkToast) return undefined;
    const timeout = window.setTimeout(() => setBulkToast(''), 3200);
    return () => window.clearTimeout(timeout);
  }, [bulkToast]);

  useEffect(() => {
    if (!blueprintToast) return undefined;
    const timeout = window.setTimeout(() => setBlueprintToast(''), 3200);
    return () => window.clearTimeout(timeout);
  }, [blueprintToast]);

  useEffect(() => {
    if (!bulkRawInput.trim() && !bulkQuestions.length) return;
    saveBulkDraftRef.current?.({ quiet: true });
  }, [bulkCurrentIndex, bulkGlobalDefaults, bulkInputMode, bulkQueueSearch, bulkQueueStatusFilter, bulkQuestions, bulkRawInput]);

  useEffect(() => {
    if (bulkRawInput.trim() || bulkQuestions.length) return;
    setBulkGlobalDefaults(resolveQuizBulkDefaults(form, filters.questionType));
  }, [bulkQuestions.length, bulkRawInput, filters.questionType, form]);

  useEffect(() => {
    if (loading) return undefined;
    const timeout = window.setTimeout(() => {
      loadQuestionPoolRef.current?.({
        category: filters.category,
        courseId: filters.courseId,
        keywords: filters.keywords,
        lessonId: filters.lessonId,
        paperId: filters.paperId,
        questionType: filters.questionType,
        questionUsage: filters.questionUsage,
        search: filters.search,
        subjectId: filters.subjectId,
        topicId: filters.topicId,
      });
    }, 260);
    return () => window.clearTimeout(timeout);
  }, [
    filters.category,
    filters.courseId,
    filters.keywords,
    filters.lessonId,
    filters.paperId,
    filters.questionType,
    filters.questionUsage,
    filters.search,
    filters.subjectId,
    filters.topicId,
    loading,
  ]);

  const visibleSubjects = useMemo(
    () => filterByCourse(meta.subjects, form.courseId),
    [meta.subjects, form.courseId]
  );

  const visibleTopics = useMemo(
    () => meta.topics.filter((topic) =>
      (!form.courseId || String(topic.courseId) === String(form.courseId)) &&
      (!form.subjectId || String(topic.subjectId) === String(form.subjectId))
    ),
    [meta.topics, form.courseId, form.subjectId]
  );

  const visibleLessons = useMemo(
    () => meta.lessons.filter((lesson) =>
      (!form.courseId || String(lesson.courseId) === String(form.courseId)) &&
      (!form.subjectId || String(lesson.subjectId) === String(form.subjectId)) &&
      (!form.topicId || String(lesson.topicId || '') === String(form.topicId))
    ),
    [meta.lessons, form.courseId, form.subjectId, form.topicId]
  );

  const filterSubjects = useMemo(
    () => filterByCourse(meta.subjects, filters.courseId),
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
    () => meta.lessons.filter((lesson) =>
      (!filters.courseId || String(lesson.courseId) === String(filters.courseId)) &&
      (!filters.subjectId || String(lesson.subjectId) === String(filters.subjectId)) &&
      (!filters.topicId || String(lesson.topicId || '') === String(filters.topicId))
    ),
    [meta.lessons, filters.courseId, filters.subjectId, filters.topicId]
  );

  const quizCategoryOptions = useMemo(() => {
    const combined = new Set(['past_paper', 'mock', ...meta.categories.filter(Boolean)]);
    return Array.from(combined);
  }, [meta.categories]);

  const bulkDefaults = bulkGlobalDefaults;
  const selectedQuestionIdSet = useMemo(
    () => new Set(form.questionIds),
    [form.questionIds]
  );
  const questionById = useMemo(
    () => new Map(meta.questions.map((question) => [question.id, question])),
    [meta.questions]
  );
  const visibleQuestionIdSet = useMemo(
    () => (visibleQuestionIds ? new Set(visibleQuestionIds) : null),
    [visibleQuestionIds]
  );

  const filteredQuestions = useMemo(() => {
    const searchNeedle = filters.search.trim().toLowerCase();
    const keywordNeedle = filters.keywords.trim().toLowerCase();

    return meta.questions.filter((question) => {
      if (visibleQuestionIdSet && !visibleQuestionIdSet.has(question.id)) return false;

      const selectedInCurrentQuiz = selectedQuestionIdSet.has(question.id);
      const usedForUsageFilter = question.usedInAnyQuiz || selectedInCurrentQuiz;

      if (filters.courseId && String(question.courseId) !== String(filters.courseId)) return false;
      if (filters.subjectId && String(question.subjectId || '') !== String(filters.subjectId)) return false;
      if (filters.topicId && String(question.topicId || '') !== String(filters.topicId)) return false;
      if (filters.lessonId && String(question.lessonId || '') !== String(filters.lessonId)) return false;
      if (filters.paperId && String(question.paperId || '') !== String(filters.paperId)) return false;
      if (filters.category && String(question.category || '') !== String(filters.category)) return false;
      if (filters.questionType && String(question.questionType || '') !== String(filters.questionType)) return false;
      if (filters.questionUsage === 'unused' && usedForUsageFilter) return false;
      if (filters.questionUsage === 'used' && !usedForUsageFilter) return false;
      if (filters.questionUsage === 'used_in_this_quiz' && !selectedInCurrentQuiz) return false;
      if (filters.questionUsage === 'not_in_this_quiz' && selectedInCurrentQuiz) return false;
      if (keywordNeedle && !String(question.keywordsText || '').toLowerCase().includes(keywordNeedle)) return false;

      if (searchNeedle) {
        const haystack = [
          question.questionText,
          question.courseTitle,
          question.subjectName,
          question.topicName,
          question.lessonTitle,
          question.paperTitle,
          question.keywordsText,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (!haystack.includes(searchNeedle)) return false;
      }

      return true;
    });
  }, [filters, meta.questions, selectedQuestionIdSet, visibleQuestionIdSet]);

  const selectedQuestions = useMemo(() => {
    return form.questionIds.map((id) => questionById.get(id)).filter(Boolean);
  }, [form.questionIds, questionById]);

  const blueprintSections = useMemo(
    () => normalizeBlueprint(form.blueprint).sections,
    [form.blueprint]
  );

  const blueprintStats = useMemo(() => blueprintSections.map((section) => {
    const selectedCount = selectedQuestions.filter((question) => questionMatchesBlueprintSection(question, section, form)).length;
    const targetCount = Math.max(Number(section.targetCount || 0), 0);
    return {
      id: section.id,
      selectedCount,
      targetCount,
      missingCount: Math.max(targetCount - selectedCount, 0),
      overCount: Math.max(selectedCount - targetCount, 0),
    };
  }), [blueprintSections, form, selectedQuestions]);

  const blueprintTotals = useMemo(() => blueprintStats.reduce((total, item) => ({
    selectedCount: total.selectedCount + item.selectedCount,
    targetCount: total.targetCount + item.targetCount,
    missingCount: total.missingCount + item.missingCount,
  }), { selectedCount: 0, targetCount: 0, missingCount: 0 }), [blueprintStats]);

  useEffect(() => {
    if (loading || blueprintSections.length === 0) {
      setBlueprintCounts({});
      return undefined;
    }

    let cancelled = false;
	    async function loadBlueprintCounts() {
	      const blueprintFilterForm = {
	        category: form.category,
	        courseId: form.courseId,
	        isGeneral: form.isGeneral,
	        lessonId: form.lessonId,
	        paperId: form.paperId,
	        subjectId: form.subjectId,
	        topicId: form.topicId,
	      };
	      const entries = await Promise.all(
	        blueprintSections.map(async (section) => {
	          try {
	            const counts = await fetchQuestionCounts(buildQuestionCountParams(buildBlueprintFilters(section, blueprintFilterForm)));
            return [
              section.id,
              {
                total: Number(counts?.total || 0),
                unused: Number(counts?.unused || 0),
                used: Number(counts?.used || 0),
              },
            ];
          } catch {
            return [section.id, { total: null, unused: null, used: null }];
          }
        })
      );

      if (!cancelled) {
        setBlueprintCounts(Object.fromEntries(entries));
      }
    }

    loadBlueprintCounts();
    return () => {
      cancelled = true;
    };
  }, [
    blueprintSections,
    form.category,
    form.courseId,
    form.isGeneral,
    form.lessonId,
    form.paperId,
    form.subjectId,
    form.topicId,
    loading,
  ]);

  const isCourseWide = Boolean(form.courseId) && (!form.subjectId || form.isGeneral);
  const isDynamicQuiz = form.randomizationMode === 'dynamic';
  const visibleQuestionTabs = useMemo(
    () => (isDynamicQuiz ? quizQuestionTabs.filter((tab) => tab.id === 'bulk') : quizQuestionTabs),
    [isDynamicQuiz]
  );
  const effectiveQuestionCount = isDynamicQuiz ? blueprintTotals.targetCount : selectedQuestions.length;
  const totalMarks = effectiveQuestionCount;

  useEffect(() => {
    if (isDynamicQuiz && questionTab !== 'bulk') {
      setQuestionTab('bulk');
    }
  }, [isDynamicQuiz, questionTab]);

  function buildQuizPayload(nextForm = form) {
    const isGeneral = nextForm.isGeneral || !nextForm.subjectId;
    const randomizationMode = nextForm.randomizationMode === 'dynamic' ? 'dynamic' : 'static';
    return {
      courseId: Number(nextForm.courseId),
      topicId: isGeneral ? null : nextForm.subjectId ? Number(nextForm.subjectId) : null,
      subtopicId: isGeneral ? null : nextForm.topicId ? Number(nextForm.topicId) : null,
      lessonId: isGeneral ? null : nextForm.lessonId ? Number(nextForm.lessonId) : null,
      paperId: nextForm.paperId ? Number(nextForm.paperId) : null,
      category: nextForm.category || '',
      collectionTags: nextForm.collectionTags || '',
      isFree: nextForm.isFree ? 1 : 0,
      subtopic: nextForm.subtopic || '',
      isGeneral: isGeneral ? 1 : 0,
      examModeOnly: nextForm.examModeOnly ? 1 : 0,
      adminName: nextForm.adminName.trim(),
      studentTitle: nextForm.studentTitle.trim(),
      displayTitleMode: nextForm.displayTitleMode === 'title' ? 'title' : 'number',
      quizTitle: nextForm.studentTitle.trim(),
      quizDescription: nextForm.quizDescription,
      blueprint: normalizeBlueprint(nextForm.blueprint),
      randomizationMode,
      timeLimit: Number(nextForm.timeLimit),
      hideTimeLimit: nextForm.hideTimeLimit ? 1 : 0,
      passingMarks: Number(nextForm.passingMarks),
      hidePassingMarks: nextForm.hidePassingMarks ? 1 : 0,
      status: normalizeStatusForApi(nextForm.status),
      questionIds: randomizationMode === 'dynamic' ? [] : nextForm.questionIds,
    };
  }

  function getMetaLabel(collection, id, field) {
    return collection.find((item) => String(item.id) === String(id))?.[field] || '';
  }

  function buildBulkAiPayload(question, resolved, explanationOverride = question.explanation) {
    const correctOption = (question.options || []).find((option) => Number(option.isCorrect) === 1);
    return {
      questionText: question.questionText,
      questionType: resolved.questionType,
      correctAnswerLabel: correctOption?.optionLabel || '',
      explanation: explanationOverride || '',
      course: getMetaLabel(meta.courses, resolved.courseId, 'courseTitle'),
      subject: getMetaLabel(meta.subjects, resolved.subjectId, 'subjectName'),
      topic: getMetaLabel(meta.topics, resolved.topicId, 'topicName') || question.topicLabel || '',
      lesson: getMetaLabel(meta.lessons, resolved.lessonId, 'lessonTitle'),
      options: (question.options || []).map((option) => ({
        optionLabel: option.optionLabel,
        optionText: option.optionText,
        isCorrect: Number(option.isCorrect) === 1,
        whyIncorrect: option.whyIncorrect || option.optionExplanation || '',
      })),
    };
  }

  function toMetaQuestion(question, resolved, savedId) {
    return {
      id: Number(savedId),
      courseId: toId(resolved.courseId),
      subjectId: toId(resolved.subjectId),
      topicId: toId(resolved.topicId),
      lessonId: toId(resolved.lessonId),
      paperId: toId(resolved.paperId),
      subtopic: String(question.topicLabel || '').trim(),
      category: resolved.category || '',
      questionType: resolved.questionType || '',
      questionText: question.questionText || '',
      keywordsText: resolved.keywordsText || '',
      usageCount: isEditing ? 1 : 0,
      usedInAnyQuiz: isEditing,
      courseTitle: getMetaLabel(meta.courses, resolved.courseId, 'courseTitle'),
      subjectName: getMetaLabel(meta.subjects, resolved.subjectId, 'subjectName'),
      topicName: getMetaLabel(meta.topics, resolved.topicId, 'topicName'),
      lessonTitle: getMetaLabel(meta.lessons, resolved.lessonId, 'lessonTitle'),
      paperTitle: getMetaLabel(meta.papers, resolved.paperId, 'paperTitle'),
    };
  }

  function saveBulkDraft({ quiet = false } = {}) {
    const payload = {
      rawInput: bulkRawInput,
      inputMode: bulkInputMode,
      questions: bulkQuestions,
      globalDefaults: bulkGlobalDefaults,
      currentIndex: bulkCurrentIndex,
      queueSearch: bulkQueueSearch,
      queueStatusFilter: bulkQueueStatusFilter,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(bulkDraftKey, JSON.stringify(payload));
    if (!quiet) {
      setBulkToast('Bulk add draft saved for this assessment.');
    }
  }

  async function syncExistingQuizQuestionLinks(nextQuestionIds) {
    if (!isEditing) return;
    if (form.randomizationMode === 'dynamic') return;
    await updateQuiz(Number(quizId), buildQuizPayload({ ...form, questionIds: nextQuestionIds }));
  }

  async function loadQuestionPool(nextFilters = filters, options = {}) {
    if (!options.silent) {
      setQuestionLoading(true);
    }

    try {
      const rows = await fetchQuestions(buildQuestionPoolParams(nextFilters, options));
      const questions = normalizeQuestionRows(rows);
      setMeta((current) => mergeQuestionRowsIntoMeta(current, questions));

      if (!options.mergeOnly) {
        setVisibleQuestionIds(questions.map((question) => question.id));
      }

      return questions;
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Unable to load question pool'));
      return [];
    } finally {
      if (!options.silent) {
        setQuestionLoading(false);
      }
    }
  }

  saveBulkDraftRef.current = saveBulkDraft;
  loadQuestionPoolRef.current = loadQuestionPool;

  function syncHierarchyFilters(next) {
    setFilters((current) => ({
      ...current,
      courseId: next.courseId,
      subjectId: next.subjectId,
      topicId: next.topicId,
      lessonId: next.lessonId,
    }));
  }

  function handleFormChange(event) {
    const { name, value, type, checked } = event.target;
    const next = { ...form, [name]: type === 'checkbox' ? checked : value };

    if (name === 'courseId') {
      next.subjectId = '';
      next.topicId = '';
      next.lessonId = '';
      next.isGeneral = false;
    }
    if (name === 'subjectId') {
      next.topicId = '';
      next.lessonId = '';
    }
    if (name === 'topicId') {
      next.lessonId = '';
    }
    if (name === 'quizMode') {
      next.examModeOnly = value === 'exam_only';
    }
    if (name === 'examModeOnly') {
      next.quizMode = checked ? 'exam_only' : 'standard';
    }
    if (name === 'prioritizeQuizNumber') {
      next.displayTitleMode = checked ? 'number' : 'title';
      if (!checked && form.quizNumber) {
        next._quizNumberWarnOnUncheck = true;
      } else {
        next._quizNumberWarnOnUncheck = false;
      }
    }
    if (name === 'isGeneral' && checked) {
      next.subjectId = '';
      next.topicId = '';
      next.lessonId = '';
    }
    if (name === 'randomizationMode' && value === 'dynamic') {
      setFilters((current) => ({ ...current, questionUsage: 'all' }));
    }

    setForm(next);

    if (name === 'courseId' || name === 'subjectId' || name === 'topicId' || name === 'lessonId' || name === 'isGeneral') {
      syncHierarchyFilters(next);
    }
  }

  function handleFilterChange(event) {
    const { name, value } = event.target;
    setFilters((current) => {
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

  function getBlueprintHierarchyOptions(section) {
    const courseId = getBlueprintValue(section, 'courseId', form.courseId);
    const subjectId = getBlueprintValue(section, 'subjectId', form.subjectId);
    const topicId = getBlueprintValue(section, 'topicId', form.topicId);

    return {
      subjects: meta.subjects.filter((subject) => !courseId || String(subject.courseId) === String(courseId)),
      topics: meta.topics.filter((topic) =>
        (!courseId || String(topic.courseId) === String(courseId)) &&
        (!subjectId || String(topic.subjectId) === String(subjectId))
      ),
      lessons: meta.lessons.filter((lesson) =>
        (!courseId || String(lesson.courseId) === String(courseId)) &&
        (!subjectId || String(lesson.subjectId) === String(subjectId)) &&
        (!topicId || String(lesson.topicId || '') === String(topicId))
      ),
    };
  }

  function patchBlueprintSection(sectionId, patch) {
    setForm((current) => {
      const sections = normalizeBlueprint(current.blueprint).sections;
      return {
        ...current,
        blueprint: {
          sections: sections.map((section) => (
            section.id === sectionId ? { ...section, ...patch } : section
          )),
        },
      };
    });
  }

  function handleBlueprintSectionChange(sectionId, event) {
    const { name, value } = event.target;
    const patch = { [name]: name === 'targetCount' ? Math.min(Math.max(Number(value || 0), 0), 500) : value };

    if (name === 'courseId') {
      patch.subjectId = '';
      patch.topicId = '';
      patch.lessonId = '';
    }
    if (name === 'subjectId') {
      patch.topicId = '';
      patch.lessonId = '';
    }
    if (name === 'topicId') {
      patch.lessonId = '';
    }

    patchBlueprintSection(sectionId, patch);
  }

  function addBlueprintSection() {
    setForm((current) => {
      const sections = normalizeBlueprint(current.blueprint).sections;
      return {
        ...current,
        blueprint: {
          sections: [
            ...sections,
            createBlueprintSection({
              title: `Section ${String.fromCharCode(65 + Math.min(sections.length, 25))}`,
              targetCount: 10,
              courseId: current.courseId,
              subjectId: current.subjectId,
              topicId: current.topicId,
              lessonId: current.lessonId,
              paperId: current.paperId,
              category: current.category,
            }),
          ],
        },
      };
    });
  }

  function removeBlueprintSection(sectionId) {
    const section = blueprintSections.find((item) => item.id === sectionId);
    if (!window.confirm(`Remove ${section?.title || 'this paper section'}?`)) return;
    setForm((current) => ({
      ...current,
      blueprint: {
        sections: normalizeBlueprint(current.blueprint).sections.filter((section) => section.id !== sectionId),
      },
    }));
  }

  async function drawMissingForBlueprintSection(section) {
    const stats = blueprintStats.find((item) => item.id === section.id);
    const missingCount = Math.max(Number(stats?.missingCount || section.targetCount || 0), 0);

    if (missingCount <= 0) {
      setBlueprintToast(`${section.title || 'This section'} already meets its target.`);
      return;
    }

    setQuestionLoading(true);
    setError('');

    try {
      const sectionFilters = buildBlueprintFilters(section, form);
      const questions = await loadQuestionPool(sectionFilters, {
        random: true,
        limit: Math.min(missingCount * 3, 200),
        excludeIds: form.questionIds,
        mergeOnly: true,
        silent: true,
      });
      const selectedIds = new Set(form.questionIds);
      const candidates = questions
        .filter((question) => !selectedIds.has(question.id) && questionMatchesBlueprintSection(question, section, form))
        .slice(0, missingCount);

      if (candidates.length === 0) {
        setError(`No available questions matched ${section.title || 'this section'}'s blueprint filters.`);
        return;
      }

      setVisibleQuestionIds((current) => Array.from(new Set([...(current || []), ...candidates.map((question) => question.id)])));
      setForm((current) => ({
        ...current,
        questionIds: Array.from(new Set([...current.questionIds, ...candidates.map((question) => question.id)])),
      }));
      setBlueprintToast(`${candidates.length} question${candidates.length === 1 ? '' : 's'} added for ${section.title || 'section target'}.`);
    } catch (drawError) {
      setError(getErrorMessage(drawError, 'Unable to draw questions for this paper section'));
    } finally {
      setQuestionLoading(false);
    }
  }

  async function drawAllMissingBlueprintSections() {
    if (form.randomizationMode === 'dynamic') {
      setBlueprintToast('Dynamic mode saves paper rules. It does not attach a fixed question list.');
      return;
    }

    const drawableSections = blueprintSections.filter((section) => Number(section.targetCount || 0) > 0);
    if (!drawableSections.length) {
      setBlueprintToast('Add at least one paper section with a target count.');
      return;
    }

    setDrawingBlueprint(true);
    setQuestionLoading(true);
    setError('');

    const questionById = new Map(meta.questions.map((question) => [question.id, question]));
    const nextIds = [...form.questionIds];
    const selectedIdSet = new Set(nextIds);
    const loadedQuestions = [];
    let addedCount = 0;
    const shortSections = [];

    try {
      for (const section of drawableSections) {
        const selectedCount = nextIds
          .map((id) => questionById.get(id))
          .filter((question) => question && questionMatchesBlueprintSection(question, section, form))
          .length;
        const missingCount = Math.max(Number(section.targetCount || 0) - selectedCount, 0);
        if (missingCount <= 0) continue;

         
        const rows = await fetchQuestions(buildQuestionPoolParams(buildBlueprintFilters(section, form), {
          random: true,
          limit: Math.min(missingCount * 3, 200),
          excludeIds: nextIds,
        }));
        const questions = normalizeQuestionRows(rows);
        questions.forEach((question) => {
          questionById.set(question.id, question);
          loadedQuestions.push(question);
        });

        const candidates = questions
          .filter((question) => !selectedIdSet.has(question.id) && questionMatchesBlueprintSection(question, section, form))
          .slice(0, missingCount);

        candidates.forEach((question) => {
          selectedIdSet.add(question.id);
          nextIds.push(question.id);
        });
        addedCount += candidates.length;

        if (candidates.length < missingCount) {
          shortSections.push(`${section.title || 'Section'} (${candidates.length}/${missingCount})`);
        }
      }

      if (loadedQuestions.length) {
        setMeta((current) => mergeQuestionRowsIntoMeta(current, loadedQuestions));
        setVisibleQuestionIds((current) => Array.from(new Set([...(current || []), ...loadedQuestions.map((question) => question.id)])));
      }
      if (addedCount > 0) {
        setForm((current) => ({
          ...current,
          questionIds: Array.from(new Set([...current.questionIds, ...nextIds])),
        }));
      }

      if (shortSections.length) {
        setError(`Some sections still need more matching questions: ${shortSections.join(', ')}.`);
        return;
      }

      setBlueprintToast(addedCount > 0 ? `${addedCount} question${addedCount === 1 ? '' : 's'} added across the paper sections.` : 'All paper targets were already covered.');
    } catch (drawError) {
      setError(getErrorMessage(drawError, 'Unable to draw all paper sections'));
    } finally {
      setDrawingBlueprint(false);
      setQuestionLoading(false);
    }
  }

  function removeQuestion(questionId) {
    setForm((current) => ({
      ...current,
      questionIds: current.questionIds.filter((id) => id !== questionId),
    }));
  }

  function removeQuestionWithConfirmation(questionId) {
    if (!window.confirm('Remove this question from the assessment?')) return;
    removeQuestion(questionId);
  }

  const toggleQuestion = useCallback((questionId) => {
    setForm((current) => (
      current.questionIds.includes(questionId)
        ? { ...current, questionIds: current.questionIds.filter((id) => id !== questionId) }
        : { ...current, questionIds: [...current.questionIds, questionId] }
    ));
  }, []);

  function addAllFilteredQuestions() {
    setForm((current) => ({
      ...current,
      questionIds: Array.from(new Set([...current.questionIds, ...filteredQuestions.map((question) => question.id)])),
    }));
  }

  async function addRandomQuestionPool() {
    const drawCount = Math.min(Math.max(Number(randomDrawCount) || QUESTION_RANDOM_DRAW_DEFAULT, 1), 200);
    setQuestionLoading(true);
    setError('');

    try {
      const questions = await loadQuestionPool(filters, {
        random: true,
        limit: Math.min(drawCount * 3, 200),
        excludeIds: form.questionIds,
        mergeOnly: true,
        silent: true,
      });
      const selectedIds = new Set(form.questionIds);
      const candidates = questions.filter((question) => {
        const usedForUsageFilter = question.usedInAnyQuiz || selectedIds.has(question.id);
        if (selectedIds.has(question.id)) return false;
        if (filters.questionUsage === 'unused' && usedForUsageFilter) return false;
        if (filters.questionUsage === 'used' && !usedForUsageFilter) return false;
        if (filters.questionUsage === 'used_in_this_quiz') return false;
        return true;
      }).slice(0, drawCount);

      if (candidates.length === 0) {
        setError('No random questions matched the current pool filters.');
        return;
      }

      setVisibleQuestionIds((current) => Array.from(new Set([...(current || []), ...candidates.map((question) => question.id)])));
      setForm((current) => ({
        ...current,
        questionIds: Array.from(new Set([...current.questionIds, ...candidates.map((question) => question.id)])),
      }));
    } catch (randomError) {
      setError(getErrorMessage(randomError, 'Unable to draw random questions'));
    } finally {
      setQuestionLoading(false);
    }
  }

  function removeAllQuestions() {
    if (!form.questionIds.length) return;
    if (!window.confirm(`Remove all ${form.questionIds.length} selected question(s) from this assessment?`)) return;
    setForm((current) => ({ ...current, questionIds: [] }));
  }

  function patchBulkQuestion(clientId, patch) {
    setBulkQuestions((current) => current.map((question) => (
      question.clientId === clientId
        ? { ...question, ...patch, savedId: patch.savedId ?? question.savedId }
        : question
    )));
  }

  function setBulkAiItemStatus(clientId, patch) {
    setBulkAiProgress((current) => ({
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

  async function enhanceQuizBulkQuestion(question, options = bulkAiOptions) {
    const duplicateMap = buildDuplicateMap(bulkQuestions);
    const resolved = resolveQuestion(question, bulkDefaults, true);
    const validation = validateQuestion(question, resolved, duplicateMap);
    if (!validation.canSave) {
      throw new Error((validation.errors || ['Question is not valid enough for AI generation.']).join(' '));
    }

    let workingQuestion = question;
    let explanation = workingQuestion.explanation || '';

    if (options.explanations && (options.regenerate || !normalizeWhitespace(explanation))) {
      const result = await generateQuestionExplanation(buildBulkAiPayload(workingQuestion, resolved));
      explanation = result.explanation || explanation;
      workingQuestion = { ...workingQuestion, explanation };
      patchBulkQuestion(question.clientId, { explanation });
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
        patchBulkQuestion(question.clientId, { options: workingQuestion.options });
      }
    }

    if (options.theoryCards) {
      let savedId = workingQuestion.savedId;
      if (!savedId) {
        const saveResult = await saveQuestionRecord({ question: workingQuestion, resolved });
        savedId = Number(saveResult.savedId);
        patchBulkQuestion(question.clientId, { savedId, lastSavedHash: saveResult.signature, reviewed: true });
        setForm((current) => ({
          ...current,
          questionIds: Array.from(new Set([...current.questionIds, savedId])),
        }));
        setMeta((current) => ({
          ...current,
          questions: current.questions.some((item) => item.id === savedId)
            ? current.questions
            : [...current.questions, toMetaQuestion(workingQuestion, resolved, savedId)],
        }));
        await syncExistingQuizQuestionLinks(Array.from(new Set([...form.questionIds, savedId])));
      }

      const existingRecap = options.regenerate ? null : await fetchTheoryRecap(savedId).catch(() => null);
      if (options.regenerate || !existingRecap) {
        await generateTheoryRecap(savedId);
      }
    }
  }

  async function runQuizBulkAi(targetQuestions = bulkQuestions) {
    if (!targetQuestions.length) {
      setBulkToast('No questions available for AI enhancement.');
      return;
    }

    setBulkAiRunning(true);
    setError('');
    setBulkAiProgress({
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
      setBulkAiProgress((current) => ({
        ...current,
        currentId: question.clientId,
        currentLabel: `Question ${index + 1} processing...`,
      }));
      setBulkAiItemStatus(question.clientId, { status: 'processing', error: '' });

      try {
         
        await enhanceQuizBulkQuestion(question);
        setBulkAiItemStatus(question.clientId, { status: 'completed', error: '' });
      } catch (err) {
        setBulkAiItemStatus(question.clientId, { status: 'failed', error: getErrorMessage(err, 'AI generation failed') });
      } finally {
        setBulkAiProgress((current) => ({
          ...current,
          completed: current.completed + 1,
        }));
      }
    }

    setBulkAiRunning(false);
    setBulkAiProgress((current) => ({
      ...current,
      currentId: null,
      currentLabel: 'AI enhancement completed',
    }));
    setBulkToast('AI enhancement queue finished. Review generated content before final saving.');
  }

  function retryFailedQuizBulkAi() {
    const failedIds = Object.entries(bulkAiProgress.items)
      .filter(([, item]) => item.status === 'failed')
      .map(([clientId]) => clientId);
    const failedQuestions = bulkQuestions.filter((question) => failedIds.includes(question.clientId));
    runQuizBulkAi(failedQuestions);
  }

  function parseBulkQuestionsForQuiz() {
    setError('');
    try {
      const parsed = (bulkInputMode === 'json'
        ? parseJsonQuestions(bulkRawInput, bulkDefaults)
        : parseRawQuestions(bulkRawInput, bulkDefaults)
      ).map((question) => ({
        ...question,
        courseId: question.courseId || '',
        subjectId: question.subjectId || '',
        topicId: question.topicId || '',
        lessonId: question.lessonId || '',
        category: question.category || '',
        questionType: question.questionType || '',
        paperId: question.paperId || '',
        keywordsText: question.keywordsText || '',
      }));
      setBulkQuestions(parsed);
      setBulkCurrentIndex(0);
      setBulkQueueSearch('');
      setBulkQueueStatusFilter('all');
      setQuestionTab('bulk');
      setBulkToast(`${parsed.length} question${parsed.length === 1 ? '' : 's'} parsed. Review and save them into this assessment.`);
    } catch (parseError) {
      setError(getErrorMessage(parseError, 'Unable to parse this bulk input'));
    }
  }

  async function copyBulkSampleJson() {
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
      setBulkToast('Sample JSON format copied.');
    } catch {
      setError('Could not copy the sample JSON format.');
    }
  }

  function addBlankBulkQuestion() {
    const blank = createEmptyQuestion({
      questionType: bulkDefaults.questionType || 'sba',
      category: bulkDefaults.category || 'mock',
      paperId: bulkDefaults.paperId || '',
      courseId: '',
      subjectId: '',
      topicId: '',
      lessonId: '',
      reviewed: true,
      parserWarnings: ['Blank question added manually. Complete the fields before saving.'],
      parserConfidence: 'medium',
    });
    setBulkQuestions((current) => [...current, blank]);
    setBulkCurrentIndex(bulkQuestions.length);
    setQuestionTab('bulk');
    setBulkToast('Blank question added to the assessment bulk queue.');
  }

  function markAllBulkReviewed() {
    setBulkQuestions((current) => current.map((question) => ({ ...question, reviewed: true, parserWarnings: [] })));
    setBulkToast('All parsed questions marked as reviewed.');
  }

  function removeBulkAiProgressItem(clientId) {
    setBulkAiProgress((current) => {
      if (!current.items?.[clientId]) return current;
      const nextItems = { ...current.items };
      delete nextItems[clientId];
      return {
        ...current,
        total: Math.max(0, current.total - 1),
        completed: Math.min(current.completed, Math.max(0, current.total - 1)),
        items: nextItems,
      };
    });
  }

  function removeBulkQuestionFromQueue(clientId, { silent = false } = {}) {
    const question = bulkQuestions.find((item) => item.clientId === clientId);
    if (!question) return;

    if (!silent) {
      const message = question.savedId
        ? 'Remove this saved item from the bulk queue? The question will stay in the question bank and remain linked to the assessment.'
        : 'Delete this unsaved draft question from the bulk queue?';
      if (!window.confirm(message)) return;
    }

    const removeIndex = bulkQuestions.findIndex((item) => item.clientId === clientId);
    setBulkQuestions((current) => current.filter((item) => item.clientId !== clientId));
    setBulkCurrentIndex((current) => {
      const nextLength = Math.max(0, bulkQuestions.length - 1);
      if (!nextLength) return 0;
      if (current > removeIndex) return current - 1;
      return Math.min(current, nextLength - 1);
    });
    removeBulkAiProgressItem(clientId);
    if (!silent) {
      setBulkToast(question.savedId ? 'Saved question removed from the bulk queue only.' : 'Draft question deleted from the bulk queue.');
    }
  }

  async function detachSavedBulkQuestionFromQuiz(clientId) {
    const question = bulkQuestions.find((item) => item.clientId === clientId);
    const savedId = Number(question?.savedId || 0);
    if (!savedId) {
      removeBulkQuestionFromQueue(clientId);
      return;
    }

    const confirmed = window.confirm(
      'Remove this saved question from the assessment and from the bulk queue? It will stay in the main question bank.'
    );
    if (!confirmed) return;

    setSavingBulk(true);
    setError('');
    try {
      const nextQuestionIds = form.questionIds.filter((id) => Number(id) !== savedId);
      setForm((current) => ({
        ...current,
        questionIds: current.questionIds.filter((id) => Number(id) !== savedId),
      }));
      if (isEditing) {
        await syncExistingQuizQuestionLinks(nextQuestionIds);
      }
      removeBulkQuestionFromQueue(clientId, { silent: true });
      setBulkToast(`Question #${savedId} removed from this assessment. It remains in the question bank.`);
    } catch (detachError) {
      setError(getErrorMessage(detachError, 'Unable to remove this saved question from the assessment'));
    } finally {
      setSavingBulk(false);
    }
  }

  function removeUnsavedBulkQuestions() {
    const unsavedCount = bulkQuestions.filter((question) => !question.savedId).length;
    if (!unsavedCount) {
      setBulkToast('No unsaved draft questions to delete.');
      return;
    }

    if (!window.confirm(`Delete ${unsavedCount} unsaved draft question${unsavedCount === 1 ? '' : 's'} from the bulk queue?`)) {
      return;
    }

    const savedQuestions = bulkQuestions.filter((question) => question.savedId);
    const savedIds = new Set(savedQuestions.map((question) => question.clientId));
    setBulkQuestions(savedQuestions);
    setBulkCurrentIndex((current) => Math.min(current, Math.max(0, savedQuestions.length - 1)));
    setBulkAiProgress((current) => ({
      ...current,
      total: Math.min(current.total, savedQuestions.length),
      completed: Math.min(current.completed, savedQuestions.length),
      items: Object.fromEntries(
        Object.entries(current.items || {}).filter(([clientId]) => savedIds.has(clientId))
      ),
    }));
    setBulkToast(`${unsavedCount} draft question${unsavedCount === 1 ? '' : 's'} deleted from the bulk queue.`);
  }

  function clearBulkQuestionQueue() {
    if (!bulkQuestions.length) return;
    if (!window.confirm('Clear the whole bulk queue? Saved questions will stay in the question bank and any linked assessment questions will stay selected.')) {
      return;
    }
    setBulkQuestions([]);
    setBulkCurrentIndex(0);
    setBulkQueueSearch('');
    setBulkQueueStatusFilter('all');
    setBulkAiProgress({ total: 0, completed: 0, currentId: null, currentLabel: '', items: {} });
    setBulkToast('Bulk question queue cleared.');
  }

  function exportBulkDraftJson() {
    saveBulkDraft({ quiet: true });
    const payload = {
      rawInput: bulkRawInput,
      inputMode: bulkInputMode,
      questions: bulkQuestions,
      globalDefaults: bulkGlobalDefaults,
      currentIndex: bulkCurrentIndex,
      queueSearch: bulkQueueSearch,
      queueStatusFilter: bulkQueueStatusFilter,
      quizId: quizId || null,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `assessment-${quizId || 'new'}-bulk-question-draft-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    setBulkToast('Assessment bulk draft JSON exported.');
  }

  function importBulkDraftFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const validationError = validateQuizDraftJsonFile(file);
    if (validationError) {
      setBulkToast(validationError);
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        setBulkRawInput(String(parsed.rawInput || ''));
        setBulkInputMode(String(parsed.inputMode || 'text'));
        setBulkQuestions(Array.isArray(parsed.questions) ? parsed.questions : []);
        setBulkGlobalDefaults(parsed.globalDefaults || resolveQuizBulkDefaults(form, filters.questionType));
        setBulkCurrentIndex(Math.max(0, Number(parsed.currentIndex) || 0));
        setBulkQueueSearch(String(parsed.queueSearch || ''));
        setBulkQueueStatusFilter(String(parsed.queueStatusFilter || 'all'));
        window.localStorage.setItem(bulkDraftKey, JSON.stringify(parsed));
        setBulkToast('Assessment bulk draft imported successfully.');
      } catch {
        setError('Could not import this assessment bulk draft JSON file.');
      }
    };
    reader.readAsText(file);
    if (event.target) {
      event.target.value = '';
    }
  }

  function clearBulkDraft() {
    if (!window.confirm('Clear the assessment bulk draft?')) return;
    setBulkRawInput('');
    setBulkInputMode('text');
    setBulkQuestions([]);
    setBulkCurrentIndex(0);
    setBulkQueueSearch('');
    setBulkQueueStatusFilter('all');
    setBulkGlobalDefaults(resolveQuizBulkDefaults(form, filters.questionType));
    window.localStorage.removeItem(bulkDraftKey);
    setBulkToast('Assessment bulk draft cleared.');
  }

  async function saveBulkQuestionAtIndex(index) {
    const question = bulkQuestions[index];
    if (!question || question.savedId) {
      return null;
    }

    const duplicateMap = buildDuplicateMap(bulkQuestions);
    const resolved = resolveQuestion(question, bulkDefaults, true);
    const validation = validateQuestion(question, resolved, duplicateMap);
    if (!validation.canSave) {
      throw new Error(validation.errors.join(' '));
    }

    const saveResult = await saveQuestionRecord({ question, resolved });
    const savedId = Number(saveResult.savedId);
    const nextQuestionIds = Array.from(new Set([...form.questionIds, savedId]));

    setBulkQuestions((current) => current.map((item, itemIndex) => (
      itemIndex === index
        ? { ...item, savedId, lastSavedHash: saveResult.signature, reviewed: true }
        : item
    )));
    setForm((current) => ({
      ...current,
      questionIds: Array.from(new Set([...current.questionIds, savedId])),
    }));
    setMeta((current) => ({
      ...current,
      questions: current.questions.some((item) => item.id === savedId)
        ? current.questions
        : [...current.questions, toMetaQuestion(question, resolved, savedId)],
      keywordSuggestions: Array.from(new Set([
        ...current.keywordSuggestions,
        ...String(resolved.keywordsText || '').split(',').map((keyword) => keyword.trim()).filter(Boolean),
      ])).sort((left, right) => left.localeCompare(right)),
    }));

    await syncExistingQuizQuestionLinks(nextQuestionIds);
    return savedId;
  }

  async function saveCurrentBulkQuestionToQuiz() {
    setSavingBulk(true);
    setError('');
    try {
      const savedId = await saveBulkQuestionAtIndex(bulkCurrentIndex);
      setBulkToast(savedId ? `Saved question #${savedId} to the bank and attached it to this assessment.` : 'This question is already saved.');
      setQuestionTab('selected');
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'Unable to save this question to the assessment'));
    } finally {
      setSavingBulk(false);
    }
  }

  async function saveAllReadyBulkQuestionsToQuiz() {
    setSavingBulk(true);
    setError('');
    try {
      const duplicateMap = buildDuplicateMap(bulkQuestions);
      const readyIndexes = bulkQuestions
        .map((question, index) => {
          if (question.savedId) return null;
          const resolved = resolveQuestion(question, bulkDefaults, true);
          const validation = validateQuestion(question, resolved, duplicateMap);
          return validation.canSave ? index : null;
        })
        .filter((index) => index !== null);

      if (!readyIndexes.length) {
        setBulkToast('No ready unsaved questions found.');
        return;
      }

      let savedCount = 0;
      const savedIds = [];
      for (const index of readyIndexes) {
         
        const savedId = await saveBulkQuestionAtIndex(index);
        if (savedId) {
          savedIds.push(savedId);
          savedCount += 1;
        }
      }
      if (savedIds.length) {
        await syncExistingQuizQuestionLinks(Array.from(new Set([...form.questionIds, ...savedIds])));
      }
      setBulkToast(`${savedCount} ready question${savedCount === 1 ? '' : 's'} saved to the bank and attached to this assessment.`);
      setQuestionTab('selected');
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'Unable to save ready questions to this assessment'));
    } finally {
      setSavingBulk(false);
    }
  }

  async function saveAllValidBulkQuestionsToQuiz() {
    setSavingBulk(true);
    setError('');
    try {
      const duplicateMap = buildDuplicateMap(bulkQuestions);
      const validIndexes = bulkQuestions
        .map((question, index) => {
          if (question.savedId) return null;
          const resolved = resolveQuestion(question, bulkDefaults, true);
          const validation = validateQuestion(question, resolved, duplicateMap);
          return validation.canSave ? index : null;
        })
        .filter((index) => index !== null);

      if (!validIndexes.length) {
        setBulkToast('No valid unsaved questions found.');
        return;
      }

      let savedCount = 0;
      const savedIds = [];
      for (const index of validIndexes) {
         
        const savedId = await saveBulkQuestionAtIndex(index);
        if (savedId) {
          savedIds.push(savedId);
          savedCount += 1;
        }
      }
      if (savedIds.length) {
        await syncExistingQuizQuestionLinks(Array.from(new Set([...form.questionIds, ...savedIds])));
      }
      setBulkToast(`${savedCount} valid question${savedCount === 1 ? '' : 's'} saved to the bank and attached to this assessment.`);
      setQuestionTab('selected');
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'Unable to save valid questions to this assessment'));
    } finally {
      setSavingBulk(false);
    }
  }

  async function applyCollectionTagsToSelected() {
    if (form.questionIds.length === 0) {
      setError('Select at least one question before applying collection tags.');
      return;
    }

    if (!form.collectionTags.trim()) {
      setError('Enter at least one collection tag before applying it to selected questions.');
      return;
    }

    setApplyingTags(true);
    setError('');

    try {
      await bulkUpdateQuestionKeywords({
        questionIds: form.questionIds,
        keywordsText: form.collectionTags,
        mode: 'append',
      });

      setMeta((current) => ({
        ...current,
        keywordSuggestions: Array.from(new Set([
          ...current.keywordSuggestions,
          ...form.collectionTags
            .split(',')
            .map((keyword) => keyword.trim())
            .filter(Boolean),
        ])).sort((left, right) => left.localeCompare(right)),
        questions: current.questions.map((question) => {
          if (!form.questionIds.includes(question.id)) {
            return question;
          }

          const mergedKeywords = Array.from(new Set([
            ...String(question.keywordsText || '')
              .split(',')
              .map((keyword) => keyword.trim())
              .filter(Boolean),
            ...form.collectionTags
              .split(',')
              .map((keyword) => keyword.trim())
              .filter(Boolean),
          ]));

          return {
            ...question,
            keywordsText: mergedKeywords.join(', '),
          };
        }),
      }));
    } catch (applyError) {
      setError(getErrorMessage(applyError, 'Unable to apply collection tags'));
    } finally {
      setApplyingTags(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      if (form.randomizationMode === 'dynamic') {
        if (blueprintTotals.targetCount <= 0) {
          throw new Error('Dynamic randomized assessments need at least one paper section with a target count.');
        }
        const shortSection = blueprintSections.find((section) => {
          const counts = blueprintCounts[section.id];
          return counts && counts.total !== null && Number(counts.total || 0) < Number(section.targetCount || 0);
        });
        if (shortSection) {
          const counts = blueprintCounts[shortSection.id];
          throw new Error(`${shortSection.title || 'A paper section'} only has ${Number(counts?.total || 0)} matching active question(s). Increase the pool or lower the target.`);
        }
      } else if (form.questionIds.length === 0) {
        throw new Error('Static assessments need at least one selected question.');
      }

      const payload = buildQuizPayload();

      if (isEditing) {
        await updateQuiz(Number(quizId), payload);
      } else {
        await createQuiz(payload);
      }

      navigate('/quizzes');
    } catch (saveError) {
      setError(getErrorMessage(saveError, isEditing ? 'Unable to update assessment' : 'Unable to create assessment'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className={ui.screenShell}>
        <section className={ui.managementLayout}>
          <div className={ui.emptyBox}>Loading assessment builder...</div>
        </section>
      </main>
    );
  }

  return (
    <main className={ui.screenShell}>
      <section className={ui.managementLayout}>
        <AppHeader
          title={isEditing ? 'Edit Assessment' : 'Create Assessment'}
          subtitle="Assessment Builder"
        />

        {error ? <div className={ui.feedbackError}>{error}</div> : null}

        <form className={qb.shell} onSubmit={handleSubmit}>
          <div className={qb.main}>
            <BuilderSection
              eyebrow="Details"
              title="Assessment Details"
              description="Set the internal name, student-facing title, category, and publishing status."
              actions={(
                <button type="button" className={ui.secondaryAction} onClick={() => navigate('/quizzes')}>
                  Back to Library
                </button>
              )}
            >
              <div className={qb.gridTwo}>
                <label className={ui.formLabel}>
                  Admin Name
                  <input className={ui.input} name="adminName" value={form.adminName} onChange={handleFormChange} required />
                  <FieldNote>Only admins see this</FieldNote>
                </label>

                <label className={ui.formLabel}>
                  Student Title
                  <input className={ui.input} name="studentTitle" value={form.studentTitle} onChange={handleFormChange} required />
                  <FieldNote>Students see this title</FieldNote>
                </label>
              </div>

              <label className={qb.checkbox}>
                <input className="shrink-0" type="checkbox" name="prioritizeQuizNumber" checked={form.displayTitleMode !== 'title'} onChange={handleFormChange} />
                <span>
                  Prioritize Quiz number in the student list
                  <FieldNote>
                    {form.displayTitleMode !== 'title'
                      ? form.quizNumber
                        ? `Students see Quiz ${String(form.quizNumber).padStart(2, '0')} in the list. Number is locked.`
                        : 'A sequential number will be auto-assigned when saved.'
                      : 'Students see the assessment title as the main label.'}
                  </FieldNote>
                </span>
              </label>
              {form._quizNumberWarnOnUncheck ? (
                <div className="rounded-xl border border-brand-warning/34 bg-[var(--color-warning-light,#fffbeb)] px-4 py-3 text-sm text-brand-warning" role="alert">
                  This quiz was displayed as <strong>Quiz {String(form.quizNumber).padStart(2, '0')}</strong> to students. Update the <strong>Student Title</strong> above to describe the content before saving.
                </div>
              ) : null}

              <label className={ui.formLabel}>
                Description
                <textarea className={ui.textarea} name="quizDescription" rows="3" value={form.quizDescription} onChange={handleFormChange} />
              </label>

              <div className={qb.gridThree}>
                <label className={ui.formLabel}>
                  Status
                  <select className={ui.input} name="status" value={form.status} onChange={handleFormChange}>
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                  </select>
                </label>

                <label className={ui.formLabel}>
                  Category
                  <select className={ui.input} name="category" value={form.category} onChange={handleFormChange}>
                    <option value="">Select category</option>
                    {quizCategoryOptions.map((category) => (
                      <option key={category} value={category}>{formatOptionLabel(category)}</option>
                    ))}
                  </select>
                </label>

                <label className={ui.formLabel}>
                  Attempt Type
                  <select className={ui.input} name="quizMode" value={form.quizMode} onChange={handleFormChange}>
                    <option value="standard">Practice + Exam</option>
                    <option value="exam_only">Exam Mode Only</option>
                  </select>
                </label>
              </div>

              <div className={qb.gridTwo}>
                <label className={ui.formLabel}>
                  Paper
                  <select className={ui.input} name="paperId" value={form.paperId} onChange={handleFormChange}>
                    <option value="">All papers</option>
                    {meta.papers.map((paper) => (
                      <option key={paper.id} value={paper.id}>{paper.paperTitle}</option>
                    ))}
                  </select>
                </label>

                <label className={ui.formLabel}>
                  Collection Tags
                  <input className={ui.input}
                    list="quiz-keyword-suggestions"
                    name="collectionTags"
                    value={form.collectionTags}
                    onChange={handleFormChange}
                    placeholder="cardiology, practice-set-1"
                  />
                  <FieldNote>Optional tags to reuse across the question bank</FieldNote>
                </label>
              </div>
            </BuilderSection>

            <BuilderSection
              eyebrow="Scope"
              title="Course Scope"
              description="Choose the course, subject, topic, or lesson this assessment belongs to."
              actions={(
                <button type="button" className={ui.secondaryAction} onClick={() => navigate('/structure')}>
                  Open Structure
                </button>
              )}
            >
              <div className={qb.hierarchyNote}>
                Course → Subject → Topic → Lesson
              </div>

              <div className={qb.gridFour}>
                <label className={ui.formLabel}>
                  Course
                  <select className={ui.input} name="courseId" value={form.courseId} onChange={handleFormChange} required>
                    <option value="">Select course</option>
                    {meta.courses.map((course) => (
                      <option key={course.id} value={course.id}>{course.courseTitle}</option>
                    ))}
                  </select>
                </label>

                <label className={ui.formLabel}>
                  Subject
                  <select className={ui.input}
                    name="subjectId"
                    value={form.subjectId}
                    onChange={handleFormChange}
                    disabled={!form.courseId || form.isGeneral}
                  >
                    <option value="">{form.courseId ? 'All subjects in this course' : 'Select course first'}</option>
                    {visibleSubjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>{subject.subjectName}</option>
                    ))}
                  </select>
                </label>

                <label className={ui.formLabel}>
                  Topic
                  <select className={ui.input}
                    name="topicId"
                    value={form.topicId}
                    onChange={handleFormChange}
                    disabled={!form.subjectId || form.isGeneral}
                  >
                    <option value="">{form.subjectId ? 'All topics' : 'Select subject first'}</option>
                    {visibleTopics.map((topic) => (
                      <option key={topic.id} value={topic.id}>{topic.topicName}</option>
                    ))}
                  </select>
                </label>

                <label className={ui.formLabel}>
                  Lesson
                  <select className={ui.input}
                    name="lessonId"
                    value={form.lessonId}
                    onChange={handleFormChange}
                    disabled={!form.subjectId || form.isGeneral}
                  >
                    <option value="">{form.subjectId ? 'All lessons' : 'Select subject first'}</option>
                    {visibleLessons.map((lesson) => (
                      <option key={lesson.id} value={lesson.id}>{lesson.lessonTitle}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className={qb.gridTwo}>
                <label className={qb.checkbox}>
                  <input className="shrink-0" type="checkbox" name="isGeneral" checked={form.isGeneral} onChange={handleFormChange} />
                  <span>
                    Full course assessment
                    <FieldNote>Use this when the assessment should cover the entire course without a subject-specific label.</FieldNote>
                  </span>
                </label>

                <label className={ui.formLabel}>
                  Optional Internal Group Label
                  <input className={ui.input}
                    name="subtopic"
                    value={form.subtopic}
                    onChange={handleFormChange}
                    placeholder="Batch 01, Revision Set A"
                  />
                  <FieldNote>Admin-only grouping label for extra organization</FieldNote>
                </label>
              </div>
            </BuilderSection>

            <BuilderSection
              eyebrow="Paper Type"
              title="Question Delivery"
              description="Choose whether this assessment saves one fixed paper or generates a randomized paper at start."
            >
              <div className={qb.modeGrid}>
                <label className={cx(qb.modeOption, form.randomizationMode !== 'dynamic' && qb.modeOptionActive)}>
                  <input
                    className="shrink-0"
                    type="radio"
                    name="randomizationMode"
                    value="static"
                    checked={form.randomizationMode !== 'dynamic'}
                    onChange={handleFormChange}
                  />
                  <span>
                    Static fixed paper
                    <FieldNote>Admin draws or selects the exact questions now. Every student receives the same saved question list.</FieldNote>
                  </span>
                </label>

                <label className={cx(qb.modeOption, form.randomizationMode === 'dynamic' && qb.modeOptionActive)}>
                  <input
                    className="shrink-0"
                    type="radio"
                    name="randomizationMode"
                    value="dynamic"
                    checked={form.randomizationMode === 'dynamic'}
                    onChange={handleFormChange}
                  />
                  <span>
                    Dynamic randomized paper
                    <FieldNote>Premium feature. The blueprint is saved, then each student gets a frozen random set at start.</FieldNote>
                  </span>
                </label>
              </div>

              <div className={qb.infoBox}>
                {isDynamicQuiz
                  ? 'Dynamic mode saves section targets only. A frozen random paper is generated when the student starts.'
                  : 'Static mode saves the exact selected question IDs. Every student receives the same paper.'}
              </div>
            </BuilderSection>

            {visibleQuestionTabs.length > 1 ? (
            <div className="lms-card-compact flex flex-wrap gap-2 rounded-[var(--ds-card-radius-compact)] border border-line-soft bg-surface-1 p-2 shadow-[var(--ds-card-shadow)]" role="tablist" aria-label="Assessment question workflow">
              {visibleQuestionTabs.map((tab) => (
                <button className={cx(
                    'min-h-10 rounded-md px-4 text-sm font-extrabold shadow-none',
                    questionTab === tab.id
                      ? 'border border-brand-primary/35 bg-[var(--color-primary-light)] text-brand-primary'
                      : 'border border-line-soft bg-surface-2 text-ink-soft hover:bg-surface-3 hover:text-ink-strong'
                  )}
                  key={tab.id}
                  type="button"
                 
                  onClick={() => setQuestionTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            ) : null}

            <BuilderSection
              eyebrow="Paper Rules"
              title="Paper Sections"
              description={isDynamicQuiz
                ? 'Create the randomized mix that will be used when each student starts.'
                : 'Create a target mix, then draw matching questions into the fixed paper.'}
              actions={(
                <>
                  {!isDynamicQuiz ? (
                    <button
                      type="button"
                      className={ui.secondaryAction}
                      onClick={drawAllMissingBlueprintSections}
                      disabled={drawingBlueprint || questionLoading || blueprintSections.length === 0}
                    >
                      {drawingBlueprint ? 'Drawing...' : 'Draw Missing'}
                    </button>
                  ) : null}
                  <button type="button" className={ui.primaryAction} onClick={addBlueprintSection}>
                    Add Paper Section
                  </button>
                </>
              )}
            >
              {blueprintToast ? <div className={ui.feedbackSuccess}>{blueprintToast}</div> : null}

              <div className={qb.summary}>
                <article className={qb.summaryCard}>
                  <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink-soft">Sections</span>
                  <strong className="text-[22px] leading-none text-ink-strong">{blueprintSections.length}</strong>
                  <p className="m-0 text-[12.5px] text-ink-soft">Saved with this assessment.</p>
                </article>
                <article className={cx(qb.summaryCard, qb.summaryAccent)}>
                  <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink-soft">
                    {isDynamicQuiz ? 'Paper size' : 'Target coverage'}
                  </span>
                  <strong className="text-[22px] leading-none text-ink-strong">
                    {isDynamicQuiz ? blueprintTotals.targetCount : `${blueprintTotals.selectedCount}/${blueprintTotals.targetCount}`}
                  </strong>
                  <p className="m-0 text-[12.5px] text-ink-soft">
                    {isDynamicQuiz
                      ? 'Questions are drawn when the student starts.'
                      : blueprintTotals.missingCount > 0
                        ? `${blueprintTotals.missingCount} question(s) still missing.`
                        : 'All targets covered.'}
                  </p>
                </article>
              </div>

              {blueprintSections.length === 0 ? (
                <div className={qb.empty}>No paper sections yet. Add sections like Cardiology SBA, Neurology T/F, or Past Paper Review.</div>
              ) : (
                <div className={qb.checklist}>
                  {blueprintSections.map((section, index) => {
                    const options = getBlueprintHierarchyOptions(section);
                    const stats = blueprintStats.find((item) => item.id === section.id) || { selectedCount: 0, targetCount: 0, missingCount: 0 };
                    const counts = blueprintCounts[section.id];
                    const poolLabel = counts
                      ? counts.total === null
                        ? 'Pool count unavailable'
                        : `${counts.total} active in pool (${counts.unused} unused, ${counts.used} reused)`
                      : 'Checking pool...';

                    return (
                      <article key={section.id} className={cx(qb.checklistItem, 'gap-3')}>
                        <div className={qb.panelTop}>
                          <div>
                            <h3 className={qb.panelTitle}>Section {index + 1}</h3>
                            <p className={qb.panelText}>
                              {isDynamicQuiz
                                ? `${stats.targetCount} target question(s) • ${poolLabel}`
                                : `${stats.selectedCount}/${stats.targetCount} matched selected questions${stats.missingCount > 0 ? ` • ${stats.missingCount} missing` : ' • target covered'} • ${poolLabel}`}
                            </p>
                          </div>
                          <div className={ui.buttonRow}>
                            {!isDynamicQuiz ? (
                              <button
                                type="button"
                                className={ui.secondaryAction}
                                onClick={() => drawMissingForBlueprintSection(section)}
                                disabled={questionLoading || stats.missingCount <= 0}
                              >
                                Draw Missing
                              </button>
                            ) : null}
                            <button type="button" className={ui.dangerAction} onClick={() => removeBlueprintSection(section.id)}>
                              Remove
                            </button>
                          </div>
                        </div>

                        <div className={qb.gridFour}>
                          <label className={ui.formLabel}>
                            Section title
                            <input
                              className={ui.input}
                              name="title"
                              value={section.title}
                              onChange={(event) => handleBlueprintSectionChange(section.id, event)}
                              placeholder="Section A"
                            />
                          </label>

                          <label className={ui.formLabel}>
                            Target questions
                            <input
                              className={ui.input}
                              type="number"
                              min="0"
                              max="500"
                              name="targetCount"
                              value={section.targetCount}
                              onChange={(event) => handleBlueprintSectionChange(section.id, event)}
                            />
                          </label>

                          <label className={ui.formLabel}>
                            Course
                            <select className={ui.input} name="courseId" value={section.courseId} onChange={(event) => handleBlueprintSectionChange(section.id, event)}>
                              <option value="">Use assessment course</option>
                              {meta.courses.map((course) => (
                                <option key={course.id} value={course.id}>{course.courseTitle}</option>
                              ))}
                            </select>
                          </label>

                          <label className={ui.formLabel}>
                            Subject
                            <select className={ui.input} name="subjectId" value={section.subjectId} onChange={(event) => handleBlueprintSectionChange(section.id, event)}>
                              <option value="">Any subject</option>
                              {options.subjects.map((subject) => (
                                <option key={subject.id} value={subject.id}>{subject.subjectName}</option>
                              ))}
                            </select>
                          </label>

                          <label className={ui.formLabel}>
                            Topic
                            <select className={ui.input} name="topicId" value={section.topicId} onChange={(event) => handleBlueprintSectionChange(section.id, event)}>
                              <option value="">Any topic</option>
                              {options.topics.map((topic) => (
                                <option key={topic.id} value={topic.id}>{topic.topicName}</option>
                              ))}
                            </select>
                          </label>

                          <label className={ui.formLabel}>
                            Lesson
                            <select className={ui.input} name="lessonId" value={section.lessonId} onChange={(event) => handleBlueprintSectionChange(section.id, event)}>
                              <option value="">Any lesson</option>
                              {options.lessons.map((lesson) => (
                                <option key={lesson.id} value={lesson.id}>{lesson.lessonTitle}</option>
                              ))}
                            </select>
                          </label>

                          <label className={ui.formLabel}>
                            Category
                            <select className={ui.input} name="category" value={section.category} onChange={(event) => handleBlueprintSectionChange(section.id, event)}>
                              <option value="">Any category</option>
                              {quizCategoryOptions.map((category) => (
                                <option key={category} value={category}>{formatOptionLabel(category)}</option>
                              ))}
                            </select>
                          </label>

                          <label className={ui.formLabel}>
                            Question Type
                            <select className={ui.input} name="questionType" value={section.questionType} onChange={(event) => handleBlueprintSectionChange(section.id, event)}>
                              <option value="">Any type</option>
                              {meta.questionTypes.map((questionType) => (
                                <option key={questionType} value={questionType}>{formatOptionLabel(questionType)}</option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </BuilderSection>

            {questionTab === 'existing' ? (
            <BuilderSection
              eyebrow="Question Bank"
              title="Find Questions"
              description="Filter the bank by hierarchy, category, type, paper, tags, or text."
            >
              <div className={qb.gridFour}>
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
                  Category
                  <select className={ui.input} name="category" value={filters.category} onChange={handleFilterChange}>
                    <option value="">All categories</option>
                    {quizCategoryOptions.map((category) => (
                      <option key={category} value={category}>{formatOptionLabel(category)}</option>
                    ))}
                  </select>
                </label>

                <label className={ui.formLabel}>
                  Question Type
                  <select className={ui.input} name="questionType" value={filters.questionType} onChange={handleFilterChange}>
                    <option value="">All question types</option>
                    {meta.questionTypes.map((questionType) => (
                      <option key={questionType} value={questionType}>{formatOptionLabel(questionType)}</option>
                    ))}
                  </select>
                </label>

                <label className={ui.formLabel}>
                  Question Usage
                  <select className={ui.input} name="questionUsage" value={filters.questionUsage} onChange={handleFilterChange}>
                    <option value="all">Allow Reuse / All Questions</option>
                    <option value="unused">New / Unused Questions</option>
                    <option value="used">Already Used Questions</option>
                    <option value="used_in_this_quiz">Used in This Quiz</option>
                    <option value="not_in_this_quiz">Not in This Quiz</option>
                  </select>
                </label>

                <label className={ui.formLabel}>
                  Paper
                  <select className={ui.input} name="paperId" value={filters.paperId} onChange={handleFilterChange}>
                    <option value="">All papers</option>
                    {meta.papers.map((paper) => (
                      <option key={paper.id} value={paper.id}>{paper.paperTitle}</option>
                    ))}
                  </select>
                </label>

                <label className={ui.formLabel}>
                  Keyword / Tag
                  <input className={ui.input}
                    list="quiz-keyword-suggestions"
                    name="keywords"
                    value={filters.keywords}
                    onChange={handleFilterChange}
                    placeholder="cardiology"
                  />
                </label>
              </div>

              <label className={ui.formLabel}>
                Search
                <input className={ui.input}
                  name="search"
                  value={filters.search}
                  onChange={handleFilterChange}
                  placeholder="Search question text, hierarchy, or paper"
                />
              </label>
            </BuilderSection>
            ) : null}

            {questionTab === 'existing' ? (
            <BuilderSection
              eyebrow="Fixed Paper"
              title="Select Questions"
              description={isDynamicQuiz
                ? 'Dynamic mode uses paper sections instead of a fixed selected-question list.'
                : 'Add questions from the bank and build the final assessment paper.'}
            >
              {isDynamicQuiz ? (
                <div className={qb.infoBox}>
                  Manual add is disabled for randomized papers. Switch to Static fixed paper to save an exact question list.
                </div>
              ) : null}

              <div className={qb.selectionLayout}>
                <div className={qb.selectionPanel}>
                  <div className={qb.panelTop}>
                    <div>
                      <h3 className={qb.panelTitle}>Available Questions</h3>
                      <p className={qb.panelText}>
                        {questionLoading
                          ? 'Loading question pool...'
                          : `${filteredQuestions.length} visible from ${visibleQuestionIds?.length ?? meta.questions.length} server-loaded question(s). ${meta.questions.length} cached.`}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <label className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-line-soft bg-surface-2 px-3 text-xs font-extrabold text-ink-medium">
                        Draw
                        <input
                          className="w-16 rounded-md border border-line-soft bg-surface-1 px-2 py-1 text-xs text-ink-strong"
                          type="number"
                          min="1"
                          max="200"
                          value={randomDrawCount}
                          onChange={(event) => setRandomDrawCount(event.target.value)}
                        />
                      </label>
                      <button
                        className={ui.secondaryAction}
                        type="button"
                        onClick={addRandomQuestionPool}
                        disabled={questionLoading || isDynamicQuiz}
                      >
                        Random Draw
                      </button>
                      <button
                        className={ui.secondaryAction}
                        type="button"
                        onClick={addAllFilteredQuestions}
                        disabled={filteredQuestions.length === 0 || isDynamicQuiz}
                      >
                        Add All Filtered
                      </button>
                    </div>
                  </div>

                  <div className={qb.list}>
                    {questionLoading ? (
                      <div className={qb.empty}>Loading matching questions from the server...</div>
                    ) : filteredQuestions.length === 0 ? (
                      <div className={qb.empty}>No questions match the current filters.</div>
                    ) : (
                      filteredQuestions.map((question) => (
                        <QuestionListCard
                          key={question.id}
                          question={question}
                          selected={selectedQuestionIdSet.has(question.id)}
                          disabled={isDynamicQuiz}
                          onToggle={toggleQuestion}
                        />
                      ))
                    )}
                  </div>
                </div>

                <div className={cx(qb.selectionPanel, qb.selectedPanel)}>
                  <div className={qb.panelTop}>
                    <div>
                      <h3 className={qb.panelTitle}>Selected Paper</h3>
                      <p className={qb.panelText}>
                        {isDynamicQuiz
                          ? `${selectedQuestions.length} remembered locally, ignored when dynamic mode saves.`
                          : `${selectedQuestions.length} question(s) currently included in this assessment.`}
                      </p>
                    </div>
                    <div className={ui.buttonRow}>
                      <button className={ui.secondaryAction}
                        type="button"
                       
                        onClick={applyCollectionTagsToSelected}
                        disabled={selectedQuestions.length === 0 || !form.collectionTags.trim() || applyingTags}
                      >
                        {applyingTags ? 'Applying Tags...' : 'Apply Tags'}
                      </button>
                      <button className={ui.dangerAction}
                        type="button"
                       
                        onClick={removeAllQuestions}
                        disabled={selectedQuestions.length === 0}
                      >
                        Remove All
                      </button>
                    </div>
                  </div>

                  <div className={qb.summary}>
                    <article className={qb.summaryCard}>
                      <span className="text-xs text-ink-soft">Available</span>
                      <strong className="text-[22px] leading-none text-ink-strong">{filteredQuestions.length}</strong>
                    </article>
                    <article className={cx(qb.summaryCard, qb.summaryAccent)}>
                      <span className="text-xs text-ink-soft">Selected</span>
                      <strong className="text-[22px] leading-none text-ink-strong">{selectedQuestions.length}</strong>
                    </article>
                  </div>

                  <div className={qb.list}>
                    {selectedQuestions.length === 0 ? (
                      <div className={qb.empty}>No questions selected yet.</div>
                    ) : (
                      selectedQuestions.map((question, index) => (
                        <article className={qb.questionCard} key={question.id}>
                          <div className={qb.questionCopy}>
                            <strong className={qb.questionStrong}>Q{index + 1}</strong>
                            <span className="break-words text-[13px] leading-[1.55] text-ink-medium" title={question.questionText}>{buildQuestionPreview(question.questionText)}</span>
                            <small className={qb.questionMeta}>
                              {[
                                question.courseTitle,
                                question.subjectName || 'No subject',
                                question.topicName || 'All topics',
                                question.lessonTitle || null,
                                question.paperTitle || null,
                              ]
                                .filter(Boolean)
                                .join(' • ')}
                            </small>
                          </div>
                          <button type="button" className={ui.dangerAction} onClick={() => removeQuestionWithConfirmation(question.id)}>
                            Remove
                          </button>
                        </article>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </BuilderSection>
            ) : null}

            {questionTab === 'selected' ? (
              <BuilderSection
                eyebrow="Fixed Paper"
                title="Selected Paper"
                description={isDynamicQuiz
                  ? 'Dynamic mode uses paper section targets instead of fixed selected questions.'
                  : 'Review the questions currently linked to this assessment.'}
                actions={(
                  <>
                    <button className={ui.secondaryAction}
                      type="button"
                     
                      onClick={applyCollectionTagsToSelected}
                      disabled={selectedQuestions.length === 0 || !form.collectionTags.trim() || applyingTags}
                    >
                      {applyingTags ? 'Applying Tags...' : 'Apply Tags'}
                    </button>
                    <button className={ui.dangerAction}
                      type="button"
                     
                      onClick={removeAllQuestions}
                      disabled={selectedQuestions.length === 0}
                    >
                      Remove All
                    </button>
                  </>
                )}
              >
                <div className="grid gap-3">
                  {isDynamicQuiz ? (
                    <div className={qb.infoBox}>
                      Randomized assessments save zero fixed question IDs. The paper size comes from section targets.
                    </div>
                  ) : null}
                  <div className={qb.summary}>
                    <article className={cx(qb.summaryCard, qb.summaryAccent)}>
                      <span className="text-xs text-ink-soft">Selected</span>
                      <strong className="text-[22px] leading-none text-ink-strong">{selectedQuestions.length}</strong>
                    </article>
                    <article className={qb.summaryCard}>
                      <span className="text-xs text-ink-soft">{isDynamicQuiz ? 'Paper target' : 'Total marks'}</span>
                      <strong className="text-[22px] leading-none text-ink-strong">{totalMarks}</strong>
                    </article>
                  </div>

                  <div className={qb.list}>
                    {selectedQuestions.length === 0 ? (
                      <div className={qb.empty}>No questions selected yet.</div>
                    ) : (
                      selectedQuestions.map((question, index) => (
                        <article className={qb.questionCard} key={question.id}>
                          <div className={qb.questionCopy}>
                            <strong className={qb.questionStrong}>Q{index + 1}</strong>
                            <span className="break-words text-[13px] leading-[1.55] text-ink-medium" title={question.questionText}>{buildQuestionPreview(question.questionText)}</span>
                            <small className={qb.questionMeta}>
                              {[
                                question.courseTitle,
                                question.subjectName || 'No subject',
                                question.topicName || 'All topics',
                                question.lessonTitle || null,
                                question.paperTitle || null,
                              ]
                                .filter(Boolean)
                                .join(' • ')}
                            </small>
                          </div>
                          <button type="button" className={ui.dangerAction} onClick={() => removeQuestionWithConfirmation(question.id)}>
                            Remove
                          </button>
                        </article>
                      ))
                    )}
                  </div>
                </div>
              </BuilderSection>
            ) : null}

            {questionTab === 'bulk' ? (
              <BuilderSection
                eyebrow="Question Creation"
                title="Add New Questions"
                description={isDynamicQuiz
                  ? 'Paste, parse, review, and save new questions to the bank. Randomized papers include them when they match the paper rules.'
                  : 'Paste, parse, review, save to the main question bank, and attach the new question IDs to this assessment.'}
              >
                <BulkAddQuestionsPanel
                  meta={meta}
                  form={form}
                  defaults={bulkDefaults}
                  onDefaultsChange={setBulkGlobalDefaults}
                  rawInput={bulkRawInput}
                  inputMode={bulkInputMode}
                  questions={bulkQuestions}
                  currentIndex={bulkCurrentIndex}
                  queueSearch={bulkQueueSearch}
                  queueStatusFilter={bulkQueueStatusFilter}
                  aiOptions={bulkAiOptions}
                  aiRunning={bulkAiRunning}
                  aiProgress={bulkAiProgress}
                  savingBulk={savingBulk}
                  bulkToast={bulkToast}
                  onRawInputChange={setBulkRawInput}
                  onInputModeChange={setBulkInputMode}
                  onParse={parseBulkQuestionsForQuiz}
                  onCopySample={copyBulkSampleJson}
                  onAddBlank={addBlankBulkQuestion}
                  onSaveCurrent={saveCurrentBulkQuestionToQuiz}
                  onSaveReady={saveAllReadyBulkQuestionsToQuiz}
                  onSaveAll={saveAllValidBulkQuestionsToQuiz}
                  onSaveDraft={() => saveBulkDraft()}
                  onExportDraft={exportBulkDraftJson}
                  onImportDraft={() => bulkDraftImportRef.current?.click()}
                  onClearDraft={clearBulkDraft}
                  onMarkAllReviewed={markAllBulkReviewed}
                  onRemoveQuestion={removeBulkQuestionFromQueue}
                  onRemoveUnsavedQuestions={removeUnsavedBulkQuestions}
                  onClearQueue={clearBulkQuestionQueue}
                  onDetachSavedQuestion={detachSavedBulkQuestionFromQuiz}
                  onQuestionPatch={patchBulkQuestion}
                  onCurrentIndexChange={setBulkCurrentIndex}
                  onQueueSearchChange={setBulkQueueSearch}
                  onQueueStatusFilterChange={setBulkQueueStatusFilter}
                  onAiOptionsChange={(patch) => setBulkAiOptions((current) => ({ ...current, ...patch }))}
                  onRunAi={() => runQuizBulkAi()}
                  onRetryFailedAi={retryFailedQuizBulkAi}
                />
                <input className="hidden"
                  ref={bulkDraftImportRef}
                  type="file"
                  accept=".json,application/json"
                  aria-label="Import quiz bulk draft JSON"
                  onChange={importBulkDraftFile}
                />
              </BuilderSection>
            ) : null}

            <BuilderSection
              eyebrow="Settings"
              title="Timing and Access"
              description="Finalize timing, scoring, and visibility before saving."
            >
              <div className={qb.gridThree}>
                <label className={ui.formLabel}>
                  Time Limit (minutes)
                  <input className={ui.input} type="number" name="timeLimit" min="1" value={form.timeLimit} onChange={handleFormChange} />
                </label>

                <label className={ui.formLabel}>
                  Passing Marks (%)
                  <input className={ui.input} type="number" name="passingMarks" min="0" max="100" value={form.passingMarks} onChange={handleFormChange} />
                </label>

                <label className={ui.formLabel}>
                  Total Marks
                  <input className={ui.input} type="number" value={totalMarks} readOnly />
                  <FieldNote>{isDynamicQuiz ? 'Calculated from paper targets' : 'Calculated automatically from the selected question count'}</FieldNote>
                </label>
              </div>

              <div className={qb.settingsGrid}>
                <label className={qb.checkbox}>
                  <input className="shrink-0" type="checkbox" name="hideTimeLimit" checked={form.hideTimeLimit} onChange={handleFormChange} />
                  <span>
                    Hide time limit
                    <FieldNote>Students can attempt the quiz without seeing the timer value in advance.</FieldNote>
                  </span>
                </label>

                <label className={qb.checkbox}>
                  <input className="shrink-0" type="checkbox" name="hidePassingMarks" checked={form.hidePassingMarks} onChange={handleFormChange} />
                  <span>
                    Hide passing marks
                    <FieldNote>Use this if you want the threshold hidden before the attempt begins.</FieldNote>
                  </span>
                </label>

                <label className={qb.checkbox}>
                  <input className="shrink-0" type="checkbox" name="examModeOnly" checked={form.examModeOnly} onChange={handleFormChange} />
                  <span>
                    Exam mode only
                    <FieldNote>Students will not see the practice-mode option for this assessment.</FieldNote>
                  </span>
                </label>

                <label className={qb.checkbox}>
                  <input className="shrink-0" type="checkbox" name="isFree" checked={form.isFree} onChange={handleFormChange} />
                  <span>
                    Free access
                    <FieldNote>Allow students to open this assessment without a paid plan.</FieldNote>
                  </span>
                </label>
              </div>
            </BuilderSection>
          </div>

          <aside className={qb.sidebar}>
            <div className={cx(ui.panelCard, qb.sidebarCard)}>
              <span className={qb.eyebrow}>Save</span>
              <h2 className="m-0 text-ink-strong">Save Assessment</h2>
              <p className="m-0 text-[13px] text-ink-soft">Review the structure, then save when the assessment is ready for the library or student dashboard.</p>

              <div className={qb.checklist}>
                <div className={qb.checklistItem}>
                  <strong className="text-xs text-ink-strong">Internal name</strong>
                  <span className="break-words text-xs leading-normal text-ink-soft">{form.adminName || 'Add an admin name'}</span>
                </div>
                <div className={qb.checklistItem}>
                  <strong className="text-xs text-ink-strong">Student title</strong>
                  <span className="break-words text-xs leading-normal text-ink-soft">{form.studentTitle || 'Add a student title'}</span>
                </div>
                <div className={qb.checklistItem}>
                  <strong className="text-xs text-ink-strong">Student list priority</strong>
                  <span className="break-words text-xs leading-normal text-ink-soft">
                    {form.displayTitleMode === 'title'
                      ? 'Assessment title'
                      : form.quizNumber
                        ? `Quiz ${String(form.quizNumber).padStart(2, '0')} (assigned)`
                        : 'Quiz N (auto on save)'}
                  </span>
                </div>
                <div className={qb.checklistItem}>
                  <strong className="text-xs text-ink-strong">Hierarchy</strong>
                  <span className="break-words text-xs leading-normal text-ink-soft">
                    {[
                      meta.courses.find((course) => String(course.id) === String(form.courseId))?.courseTitle,
                      isCourseWide ? 'Full course scope' : null,
                      !isCourseWide ? visibleSubjects.find((subject) => String(subject.id) === String(form.subjectId))?.subjectName : null,
                      !isCourseWide ? visibleTopics.find((topic) => String(topic.id) === String(form.topicId))?.topicName || 'All topics' : null,
                      !isCourseWide && form.lessonId ? visibleLessons.find((lesson) => String(lesson.id) === String(form.lessonId))?.lessonTitle : 'All lessons',
                    ]
                      .filter(Boolean)
                      .join(' • ') || 'Select a course'
                    }
                  </span>
                </div>
                <div className={qb.checklistItem}>
                  <strong className="text-xs text-ink-strong">Delivery mode</strong>
                  <span className="break-words text-xs leading-normal text-ink-soft">
                    {isDynamicQuiz ? 'Dynamic randomized paper' : 'Static fixed paper'}
                  </span>
                </div>
                <div className={qb.checklistItem}>
                  <strong className="text-xs text-ink-strong">Questions selected</strong>
                  <span className="break-words text-xs leading-normal text-ink-soft">
                    {isDynamicQuiz
                      ? `${blueprintTotals.targetCount} generated question target(s)`
                      : `${selectedQuestions.length} question(s)`}
                  </span>
                </div>
                <div className={qb.checklistItem}>
                  <strong className="text-xs text-ink-strong">Status</strong>
                  <span className="break-words text-xs leading-normal text-ink-soft">{form.status === 'active' ? 'Active' : 'Draft'}</span>
                </div>
              </div>

              <div className={cx(ui.buttonRow, qb.sidebarActions)}>
                <button className={ui.primaryAction} type="submit" disabled={saving}>
                  {saving ? 'Saving...' : isEditing ? 'Update Assessment' : 'Save Assessment'}
                </button>
                <button type="button" className={ui.secondaryAction} onClick={() => navigate('/quizzes')} disabled={saving}>
                  Cancel
                </button>
              </div>
            </div>
          </aside>
        </form>

        <datalist id="quiz-keyword-suggestions">
          {meta.keywordSuggestions.map((keyword) => (
            <option key={keyword} value={keyword} />
          ))}
        </datalist>
      </section>
    </main>
  );
}
