import { useEffect, useMemo, useState } from 'react';
import { generateAiQuiz } from '../../api/ai.api.js';
import { getErrorMessage } from '../../api/client.js';
import { createQuestion, fetchQuestionsMeta } from '../../api/questions.api.js';
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
  difficulty: 'medium',
  numberOfQuestions: 3,
  instruction: '',
};

const aiPageUi = {
  hero:
    'mb-1 rounded-xl border border-[color-mix(in_srgb,var(--color-primary)_18%,var(--line-soft))] bg-[linear-gradient(145deg,color-mix(in_srgb,var(--color-primary)_6%,var(--surface-1))_0%,var(--surface-1)_100%)] px-7 py-6 shadow-sm [&_h1]:m-0 [&_h1]:mt-2 [&_h1]:text-[clamp(24px,3vw,36px)] [&_h1]:font-extrabold [&_h1]:leading-tight [&_p]:m-0 [&_p]:mt-3 [&_p]:max-w-[760px] [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-ink-soft',
};

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
        optionLabel: String.fromCharCode(65 + index),
        optionText,
        isCorrect: parsedAnswer === null ? null : parsedAnswer ? 1 : 0,
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

export function AiQuizGeneratorPage({
  engineKey = 'gemini',
  generatorLabel = 'Gemini',
  heroEyebrow = 'Standalone Test Route',
  heroTitle = 'Gemini Quiz Generator',
  heroDescription = 'This route is separate from the live LMS quiz system. It lets you generate quiz drafts with a fixed provider before saving selected items to the question bank.',
}) {
  const [form, setForm] = useState(defaultForm);
  const [meta, setMeta] = useState({ courses: [], subjects: [], topics: [], lessons: [] });
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState({ loading: false, saving: false, error: '', success: '' });

  useEffect(() => {
    loadMeta();
  }, []);

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
    const { name, value } = event.target;
    setForm((current) => {
      const next = {
        ...current,
        [name]: name === 'numberOfQuestions' ? Number(value) : value,
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
      const selectedCourse = meta.courses.find((item) => String(item.id) === String(form.courseId));
      const selectedSubject = meta.subjects.find((item) => String(item.id) === String(form.subjectId));
      const selectedTopic = meta.topics.find((item) => String(item.id) === String(form.topicId));
      const selectedLesson = meta.lessons.find((item) => String(item.id) === String(form.lessonId));

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
        questionType: form.questionType,
        difficulty: form.difficulty,
        numberOfQuestions: form.numberOfQuestions,
        instruction: form.instruction,
      }, { engine: engineKey });
      setResult(data);
      setStatus((current) => ({
        ...current,
        loading: false,
        error: '',
        success: `${generatorLabel} quiz generated successfully. Review it and save it to Questions when ready.`,
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

  async function handleSaveQuestions() {
    if (!result || !result.items?.length) {
      return;
    }

    if (!form.courseId || !form.subjectId) {
      setStatus((current) => ({
        ...current,
        error: 'Select at least a course and subject before saving generated questions.',
      }));
      return;
    }

    setStatus((current) => ({ ...current, saving: true, error: '', success: '' }));

    try {
      for (const item of result.items) {
        const basePayload = {
          courseId: Number(form.courseId),
          subjectId: Number(form.subjectId),
          topicId: form.topicId ? Number(form.topicId) : null,
          lessonId: form.lessonId ? Number(form.lessonId) : null,
          category: form.category,
          questionType: item.question_type,
          questionText: item.question_text,
          explanation: item.explanation || '',
          topicLabel: item.topic || '',
          status: 'active',
        };

        if (item.question_type === 'sba') {
          const normalizedCorrectAnswer = String(item.correct_answer || '').trim().toLowerCase();
          await createQuestion({
            ...basePayload,
            options: item.options.map((option, index) => ({
              optionLabel: String.fromCharCode(65 + index),
              optionText: option,
              isCorrect:
                option.trim().toLowerCase() === normalizedCorrectAnswer ||
                String.fromCharCode(65 + index).toLowerCase() === normalizedCorrectAnswer
                  ? 1
                  : 0,
            })),
          });
        } else {
          await createQuestion({
            ...basePayload,
            options: buildTrueFalseOptions(item),
          });
        }
      }

      setStatus((current) => ({
        ...current,
        saving: false,
        error: '',
        success: `${result.items.length} generated question(s) were saved to the LMS question bank.`,
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
          />
          <AiQuizPreview
            result={result}
            onCopyJson={handleCopyJson}
            onDownloadJson={handleDownloadJson}
            onSaveQuestions={handleSaveQuestions}
            isSaving={status.saving}
            providerLabel={generatorLabel}
          />
        </div>
      </section>
    </main>
  );
}
