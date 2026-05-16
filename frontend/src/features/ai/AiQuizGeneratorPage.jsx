import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { generateAiQuiz, generateWhyIncorrectExplanations } from '../../api/ai.api.js';
import { getErrorMessage } from '../../api/client.js';
import { createQuestion, fetchQuestionsMeta } from '../../api/questions.api.js';
import { createQuiz } from '../../api/quizzes.api.js';
import { generateTheoryRecap } from '../../api/theoryRecap.api.js';
import { AiQuizGeneratorForm } from './components/AiQuizGeneratorForm.jsx';
import { AiQuizPreview } from './components/AiQuizPreview.jsx';
import { cx, ui } from '../../styles/tailwindClasses.js';

const defaultForm = {
  courseId: '',
  subjectId: '',
  topicId: '',
  lessonId: '',
  category: 'ai',
  questionType: 'sba',
  questionTypes: { sba: false, true_false: false },
  difficulty: 'medium',
  numberOfQuestions: 5,
  instruction: '',
  quizTitle: '',
  quizStatus: 'draft',
  quizMode: 'both',
  includeExplanations: true,
  includeWhyIncorrect: true,
  includeTheoryRecap: true,
};

const LESSON_CONTEXT_CHAR_LIMIT = 8000;
const MAX_QUESTIONS_PER_AI_CALL = 5;

const aiPageUi = {
  hero:
    'mb-1 rounded-xl border border-[color-mix(in_srgb,var(--color-primary)_18%,var(--line-soft))] bg-[linear-gradient(145deg,color-mix(in_srgb,var(--color-primary)_6%,var(--surface-1))_0%,var(--surface-1)_100%)] px-7 py-6 shadow-sm [&_h1]:m-0 [&_h1]:mt-2 [&_h1]:text-[clamp(24px,3vw,36px)] [&_h1]:font-extrabold [&_h1]:leading-tight [&_p]:m-0 [&_p]:mt-3 [&_p]:max-w-[760px] [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-ink-soft',
};

function getOptionText(option) {
  if (typeof option === 'object' && option !== null) {
    return String(option.text ?? option.option_text ?? option.optionText ?? '').trim();
  }
  return String(option || '').trim();
}

function getOptionReason(option) {
  if (typeof option === 'object' && option !== null) {
    return String(option.why_incorrect ?? option.whyIncorrect ?? option.reason ?? option.explanation ?? '').trim();
  }
  return '';
}

function getQuestionType(item) {
  return String(item?.question_type ?? item?.questionType ?? '').trim();
}

function getQuestionText(item) {
  return String(item?.question_text ?? item?.questionText ?? item?.question ?? '').trim();
}

function getOptionLabel(option, index) {
  if (typeof option === 'object' && option !== null && option.label) {
    return String(option.label).trim().toUpperCase();
  }
  return String.fromCharCode(65 + index);
}

function isOptionMarkedCorrect(option) {
  if (typeof option !== 'object' || option === null) return false;
  const value = option.is_correct ?? option.isCorrect ?? option.correct;
  return value === true || value === 1 || String(value).trim().toLowerCase() === 'true';
}

function getSelectedQuestionTypes(form) {
  if (!form.questionTypes?.sba && !form.questionTypes?.true_false) {
    return [form.questionType || 'sba'];
  }
  const selected = [];
  if (form.questionTypes?.sba) selected.push('sba');
  if (form.questionTypes?.true_false) selected.push('true_false');
  return Array.from(new Set(selected));
}

function splitQuestionCounts(total, selectedTypes) {
  const count = Math.max(1, Number(total) || 1);
  if (selectedTypes.length <= 1) return [{ type: selectedTypes[0] || 'sba', count }];
  const sbaCount = Math.ceil(count / 2);
  return [
    { type: 'sba', count: sbaCount },
    { type: 'true_false', count: count - sbaCount },
  ].filter((item) => item.count > 0 && selectedTypes.includes(item.type));
}

function buildQuestionBatches(total, selectedTypes) {
  return splitQuestionCounts(total, selectedTypes).flatMap((item) => {
    const batches = [];
    let remaining = item.count;
    while (remaining > 0) {
      const count = Math.min(MAX_QUESTIONS_PER_AI_CALL, remaining);
      batches.push({ type: item.type, count });
      remaining -= count;
    }
    return batches;
  });
}

function normalizeCorrectAnswerLabel(item) {
  const raw = String(item.correct_answer ?? item.correctAnswer ?? '').trim();
  const direct = raw.match(/^[A-E]$/i)?.[0]?.toUpperCase();
  if (direct) return direct;
  const options = Array.isArray(item.options) ? item.options : [];
  const labeledIndex = options.findIndex((option, index) => getOptionLabel(option, index).toLowerCase() === raw.toLowerCase());
  if (labeledIndex >= 0) return getOptionLabel(options[labeledIndex], labeledIndex);
  const correctIndex = options.findIndex((option) => isOptionMarkedCorrect(option));
  if (correctIndex >= 0) return getOptionLabel(options[correctIndex], correctIndex);
  const matchIndex = options.findIndex((option) => getOptionText(option).toLowerCase() === raw.toLowerCase());
  return matchIndex >= 0 ? String.fromCharCode(65 + matchIndex) : '';
}

function lessonContextFromCanvas(noteData) {
  const pages = Array.isArray(noteData?.pages) ? noteData.pages : [];
  return pages.map((page) => {
    const sections = (page.sections || []).map((section) => {
      if (section.type === 'image-explained') {
        return [section.caption, section.explanation].filter(Boolean).join(': ');
      }
      if (section.type === 'image') {
        return section.caption || '';
      }
      return [
        section.heading,
        ...(section.bullets || []),
        section.callout,
        section.mnemonic,
        section.sticky_note,
      ].filter(Boolean).join('\n');
    }).filter(Boolean);
    return [page.title, page.subtitle, ...sections, ...(page.key_points || []), page.summary_box].filter(Boolean).join('\n');
  }).filter(Boolean).join('\n\n');
}

function normalizeAiBooleanValue(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    if (value === 1) {
      return true;
    }

    if (value === 0) {
      return false;
    }
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', 't', 'yes', 'y', '1'].includes(normalized)) {
      return true;
    }

    if (['false', 'f', 'no', 'n', '0'].includes(normalized)) {
      return false;
    }
  }

  return null;
}

function buildTrueFalseOptions(item) {
  const rawStatements = Array.isArray(item?.statements)
    ? item.statements
    : Array.isArray(item?.options)
      ? item.options
      : [];

  const normalized = rawStatements
    .map((statement, index) => {
      const optionText = String(
        statement?.text ?? statement?.statement ?? statement?.option_text ?? statement?.optionText ?? ''
      ).trim();
      const parsedAnswer = normalizeAiBooleanValue(
        statement?.answer ?? statement?.isTrue ?? statement?.is_true ?? statement?.isCorrect ?? statement?.is_correct
      );

      return {
        optionLabel: getOptionLabel(statement, index),
        optionText,
        isCorrect: parsedAnswer === null ? null : parsedAnswer ? 1 : 0,
        whyIncorrect: String(statement?.why_incorrect ?? statement?.whyIncorrect ?? statement?.reason ?? statement?.explanation ?? '').trim(),
      };
    })
    .filter((statement) => statement.optionText);

  if (normalized.length !== 5) {
    throw new Error('Generated True / False questions must contain exactly 5 statements before saving.');
  }

  const invalidStatement = normalized.find((statement) => statement.isCorrect === null);
  if (invalidStatement) {
    throw new Error(`Generated True / False statement ${invalidStatement.optionLabel} is missing a valid True/False answer.`);
  }

  return normalized;
}

async function fillMissingWhyIncorrect({ questionType, questionText, explanation, correctAnswerLabel = '', options }) {
  const missing = (options || []).filter((option) => {
    if (questionType === 'sba' && Number(option.isCorrect) === 1) return false;
    return !String(option.whyIncorrect || '').trim();
  });

  if (!missing.length) return options;

  try {
    const result = await generateWhyIncorrectExplanations({
      questionType,
      questionText,
      correctAnswerLabel,
      explanation,
      options,
    });
    const generatedMap = new Map(
      (result.items || []).map((item) => [
        String(item.optionLabel || '').toUpperCase(),
        String(item.whyIncorrect || '').trim(),
      ])
    );

    const completed = options.map((option) => ({
      ...option,
      whyIncorrect: option.whyIncorrect || generatedMap.get(String(option.optionLabel || '').toUpperCase()) || '',
    }));

    const stillMissing = completed.filter((option) => {
      if (questionType === 'sba' && Number(option.isCorrect) === 1) return false;
      return !String(option.whyIncorrect || '').trim();
    });

    if (stillMissing.length) {
      throw new Error('AI did not return all requested why-answer reasons. Try saving again or uncheck Why-answer reasoning.');
    }

    return completed;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to generate why-answer reasoning. Try saving again or uncheck Why-answer reasoning.'));
  }
}

async function generateRequiredTheoryRecaps(questionIds) {
  let generatedCount = 0;
  for (const questionId of questionIds) {
    try {
      await generateTheoryRecap(questionId);
      generatedCount += 1;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Questions were saved, but Quick Theory Recap generation failed. Try generating recaps from the question bank.'));
    }
  }
  return generatedCount;
}

function countStoredReasons(questionType, options) {
  return (options || []).filter((option) => {
    if (questionType === 'sba' && Number(option.isCorrect) === 1) return false;
    return String(option.whyIncorrect || '').trim();
  }).length;
}

export function AiQuizGeneratorPage({
  engineKey = 'gemini',
  generatorLabel = 'Gemini',
  heroEyebrow = 'Standalone Test Route',
  heroTitle = 'Gemini Quiz Generator',
  heroDescription = 'This route is separate from the live LMS quiz system. It lets you generate quiz drafts with a fixed provider before saving selected items to the question bank.',
}) {
  const location = useLocation();
  const lessonQuiz = location.state?.lessonQuiz || null;
  const isLessonQuizMode = Boolean(lessonQuiz?.lessonId);
  const [form, setForm] = useState(defaultForm);
  const [meta, setMeta] = useState({ courses: [], subjects: [], topics: [], lessons: [] });
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState({ loading: false, saving: false, error: '', success: '' });

  useEffect(() => {
    loadMeta();
  }, []);

  useEffect(() => {
    if (!lessonQuiz) return;
    const lessonTitle = lessonQuiz.title || 'Lesson';
    const canvasContext = lessonContextFromCanvas(lessonQuiz.noteData);
    const sourceContext = [lessonQuiz.rawText, canvasContext].filter(Boolean).join('\n\n').slice(0, LESSON_CONTEXT_CHAR_LIMIT);
    setForm((current) => ({
      ...current,
      courseId: lessonQuiz.courseId ? String(lessonQuiz.courseId) : '',
      subjectId: lessonQuiz.subjectId ? String(lessonQuiz.subjectId) : '',
      topicId: lessonQuiz.topicId ? String(lessonQuiz.topicId) : '',
      lessonId: lessonQuiz.lessonId ? String(lessonQuiz.lessonId) : '',
      category: 'ai',
      numberOfQuestions: 10,
      quizTitle: `${lessonTitle} - Practice`,
      quizStatus: 'draft',
      quizMode: 'both',
      questionTypes: { sba: true, true_false: false },
      includeExplanations: true,
      includeWhyIncorrect: true,
      includeTheoryRecap: true,
      instruction: sourceContext
        ? `Create questions directly from this lesson content. Prioritize the tested mechanisms, clinical clues, definitions, investigations, management, and exam traps.\n\nLesson content:\n${sourceContext}`
        : `Create questions directly from the lesson titled "${lessonTitle}".`,
    }));
  }, [lessonQuiz]);

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

  async function loadMeta() {
    try {
      const data = await fetchQuestionsMeta();
      setMeta({
        courses: data.courses || [],
        subjects: data.subjects || [],
        topics: data.topics || [],
        lessons: data.lessons || [],
      });
    } catch (error) {
      setStatus((current) => ({
        ...current,
        error: getErrorMessage(error, 'Unable to load LMS hierarchy for the AI page'),
      }));
    }
  }

  function handleChange(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => {
      if (name === 'questionTypes.sba' || name === 'questionTypes.true_false') {
        const key = name.split('.')[1];
        const nextTypes = { ...current.questionTypes, [key]: checked };
        if (!nextTypes.sba && !nextTypes.true_false) {
          nextTypes[key] = true;
        }
        return {
          ...current,
          questionTypes: nextTypes,
          questionType: nextTypes.sba ? 'sba' : 'true_false',
        };
      }

      const next = {
        ...current,
        [name]: name === 'numberOfQuestions' ? Number(value) : type === 'checkbox' ? checked : value,
      };

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

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus((current) => ({ ...current, loading: true, error: '', success: '' }));

    try {
      const selectedTypes = getSelectedQuestionTypes(form);
      if (selectedTypes.length === 0) {
        throw new Error('Select at least one question type.');
      }
      const selectedCourse = meta.courses.find((item) => String(item.id) === String(form.courseId));
      const selectedSubject = meta.subjects.find((item) => String(item.id) === String(form.subjectId));
      const selectedTopic = meta.topics.find((item) => String(item.id) === String(form.topicId));
      const selectedLesson = meta.lessons.find((item) => String(item.id) === String(form.lessonId));

      const chunks = [];
      for (const item of buildQuestionBatches(form.numberOfQuestions, selectedTypes)) {
        const data = await generateAiQuiz({
          courseId: form.courseId ? Number(form.courseId) : null,
          subjectId: form.subjectId ? Number(form.subjectId) : null,
          topicId: form.topicId ? Number(form.topicId) : null,
          lessonId: form.lessonId ? Number(form.lessonId) : null,
          course: selectedCourse?.courseTitle || '',
          subject: selectedSubject?.subjectName || '',
          topic: selectedTopic?.topicName || '',
          lesson: selectedLesson?.lessonTitle || '',
          category: form.category,
          questionType: item.type,
          difficulty: form.difficulty,
          numberOfQuestions: item.count,
          instruction: form.instruction,
          includeExplanations: Boolean(form.includeExplanations),
          includeWhyIncorrect: Boolean(form.includeWhyIncorrect),
        }, { engine: engineKey });
        chunks.push(data);
      }

      const data = {
        provider: chunks[0]?.provider,
        settings: {
          category: form.category,
          questionType: selectedTypes.length === 2 ? 'mixed' : selectedTypes[0],
          difficulty: form.difficulty,
          numberOfQuestions: form.numberOfQuestions,
        },
        items: chunks.flatMap((chunk) => chunk.items || []),
      };
      setResult(data);
      setStatus((current) => ({
        ...current,
        loading: false,
        error: '',
        success: `${generatorLabel} quiz generated successfully. Review it before saving.`,
      }));
    } catch (error) {
      setStatus((current) => ({
        ...current,
        loading: false,
        error: getErrorMessage(error, 'Unable to generate quiz content right now'),
        success: '',
      }));
    }
  }

  async function handleCopyJson() {
    if (!result) {
      return;
    }

    try {
      await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
      setStatus((current) => ({ ...current, success: 'JSON copied to clipboard.' }));
    } catch {
      setStatus((current) => ({ ...current, error: 'Unable to copy JSON from this browser context.' }));
    }
  }

  function handleDownloadJson() {
    if (!result) {
      return;
    }

    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `experimental-ai-quiz-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function saveGeneratedQuestions() {
    if (!result || !result.items?.length) {
      return {
        savedIds: [],
        storedWhyReasonCount: 0,
        generatedRecapCount: 0,
      };
    }

    if (!form.courseId || !form.subjectId) {
      throw new Error('Select at least a course and subject before saving generated questions.');
    }

    const savedIds = [];
    let storedWhyReasonCount = 0;

    for (const item of result.items) {
      const questionType = getQuestionType(item);
      const questionText = getQuestionText(item);
      if (!['sba', 'true_false'].includes(questionType)) {
        throw new Error('Generated question is missing a valid question type.');
      }
      if (!questionText) {
        throw new Error('Generated question is missing question text.');
      }

      const basePayload = {
        courseId: Number(form.courseId),
        subjectId: Number(form.subjectId),
        topicId: form.topicId ? Number(form.topicId) : null,
        lessonId: form.lessonId ? Number(form.lessonId) : null,
        category: form.category,
        questionType,
        questionText,
        explanation: form.includeExplanations ? item.explanation || '' : '',
        topicLabel: item.topic || '',
        status: 'active',
      };

      if (questionType === 'sba') {
        const correctLabel = normalizeCorrectAnswerLabel(item);
        let options = (item.options || []).map((option, index) => {
          const label = getOptionLabel(option, index);
          const isCorrect = label === correctLabel || isOptionMarkedCorrect(option) ? 1 : 0;
          return {
            optionLabel: label,
            optionText: getOptionText(option),
            isCorrect,
            whyIncorrect: form.includeWhyIncorrect && !isCorrect ? getOptionReason(option) : '',
          };
        });
        if (form.includeWhyIncorrect) {
          options = await fillMissingWhyIncorrect({
            questionType: 'sba',
            questionText,
            explanation: basePayload.explanation,
            correctAnswerLabel: correctLabel,
            options,
          });
        }
        storedWhyReasonCount += countStoredReasons('sba', options);
        const response = await createQuestion({ ...basePayload, options });
        savedIds.push(Number(response.id));
      } else {
        let options = buildTrueFalseOptions(item).map((option) => ({
          ...option,
          whyIncorrect: form.includeWhyIncorrect ? option.whyIncorrect : '',
        }));
        if (form.includeWhyIncorrect) {
          options = await fillMissingWhyIncorrect({
            questionType: 'true_false',
            questionText,
            explanation: basePayload.explanation,
            options,
          });
        }
        storedWhyReasonCount += countStoredReasons('true_false', options);
        const response = await createQuestion({
          ...basePayload,
          options,
        });
        savedIds.push(Number(response.id));
      }
    }

    let generatedRecapCount = 0;
    if (form.includeTheoryRecap) {
      generatedRecapCount = await generateRequiredTheoryRecaps(savedIds);
    }

    return {
      savedIds,
      storedWhyReasonCount,
      generatedRecapCount,
    };
  }

  async function handleSaveQuestions() {
    setStatus((current) => ({ ...current, saving: true, error: '', success: '' }));

    try {
      const { savedIds, storedWhyReasonCount, generatedRecapCount } = await saveGeneratedQuestions();
      setStatus((current) => ({
        ...current,
        saving: false,
        error: '',
        success: `${savedIds.length} question(s) saved. ${storedWhyReasonCount} why-answer reason(s) saved. ${generatedRecapCount} Quick Theory Recap(s) generated.`,
      }));
    } catch (error) {
      setStatus((current) => ({
        ...current,
        saving: false,
        error: getErrorMessage(error, 'Unable to save generated questions to the question bank'),
        success: '',
      }));
    }
  }

  async function handleSaveQuizAndQuestions() {
    setStatus((current) => ({ ...current, saving: true, error: '', success: '' }));

    try {
      const { savedIds, storedWhyReasonCount, generatedRecapCount } = await saveGeneratedQuestions();
      if (!savedIds.length) {
        throw new Error('Generate questions before saving the quiz.');
      }
      const quizTitle = String(form.quizTitle || '').trim() || `${lessonQuiz?.title || 'Lesson'} - Practice`;
      await createQuiz({
        courseId: Number(form.courseId),
        topicId: form.subjectId ? Number(form.subjectId) : null,
        subtopicId: form.topicId ? Number(form.topicId) : null,
        lessonId: form.lessonId ? Number(form.lessonId) : null,
        paperId: null,
        category: form.category,
        collectionTags: 'ai-generated, lesson-practice',
        isFree: 0,
        subtopic: '',
        isGeneral: 0,
        examModeOnly: form.quizMode === 'exam_only' ? 1 : 0,
        adminName: quizTitle,
        studentTitle: quizTitle,
        displayTitleMode: 'title',
        quizTitle,
        quizDescription: `AI-generated practice quiz for ${lessonQuiz?.title || form.lesson || 'this lesson'}.`,
        timeLimit: Math.max(10, Math.min(180, Number(form.numberOfQuestions || savedIds.length) * 2)),
        hideTimeLimit: 0,
        passingMarks: 45,
        hidePassingMarks: 0,
        status: form.quizStatus === 'active' ? 'active' : 'inactive',
        questionIds: savedIds,
      });
      setStatus((current) => ({
        ...current,
        saving: false,
        error: '',
        success: `Quiz "${quizTitle}" saved with ${savedIds.length} question(s), ${storedWhyReasonCount} why-answer reason(s), and ${generatedRecapCount} Quick Theory Recap(s).`,
      }));
    } catch (error) {
      setStatus((current) => ({
        ...current,
        saving: false,
        error: getErrorMessage(error, 'Unable to save generated quiz'),
        success: '',
      }));
    }
  }

  return (
    <main className={ui.screenShell}>
      <section className={ui.managementLayout}>
        <div className={aiPageUi.hero}>
          <span className={ui.eyebrow}>{heroEyebrow}</span>
          <h1>{heroTitle}</h1>
          <p>{heroDescription}</p>
        </div>

        {status.error ? <div className={ui.feedbackError}>{status.error}</div> : null}
        {status.success ? <div className={ui.feedbackSuccess}>{status.success}</div> : null}

        <div className={cx(ui.managementGrid, ui.aiGeneratorGrid)}>
          <AiQuizGeneratorForm
            form={form}
            meta={meta}
            visibleSubjects={visibleSubjects}
            visibleTopics={visibleTopics}
            visibleLessons={visibleLessons}
            onChange={handleChange}
            onSubmit={handleSubmit}
            isLoading={status.loading}
            generatorLabel={generatorLabel}
            generatorEyebrow={heroEyebrow}
            generatorDescription={heroDescription}
            lessonQuizMode={isLessonQuizMode}
          />
          <AiQuizPreview
            result={result}
            onCopyJson={handleCopyJson}
            onDownloadJson={handleDownloadJson}
            onSaveQuestions={handleSaveQuestions}
            onSaveQuiz={isLessonQuizMode ? handleSaveQuizAndQuestions : null}
            hideSaveQuestions={isLessonQuizMode}
            isSaving={status.saving}
            providerLabel={generatorLabel}
            saveQuizLabel="Save Quiz + Questions"
          />
        </div>
      </section>
    </main>
  );
}
