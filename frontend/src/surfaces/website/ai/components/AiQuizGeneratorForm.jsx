import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';

const questionTypeHints = {
  sba: 'Generates SBA questions with 5 options, 1 correct answer, and explanation.',
  true_false: 'Generates one stem with 5 True/False statements and explanation.',
};

const aiFormUi = {
  panel: 'grid gap-4',
  fieldGrid: 'grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4',
  tip:
    'rounded-md border border-[color-mix(in_srgb,var(--color-primary)_18%,var(--line-soft))] bg-[color-mix(in_srgb,var(--color-primary)_6%,var(--surface-1))] px-3.5 py-3 text-[13px] leading-relaxed text-ink-soft [&_p]:m-0 [&_strong]:mb-1 [&_strong]:block [&_strong]:text-ink-strong',
  autoPrompt:
    'flex flex-wrap gap-2 rounded-md border border-line-soft bg-surface-glass-subtle px-3.5 py-3 text-[13px] leading-relaxed text-ink-soft [&_p]:m-0 [&_p]:min-w-[240px] [&_p]:flex-1 [&_strong]:text-ink-strong',
  checkboxGrid: 'grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-2.5',
  checkboxCard:
    'flex min-h-[46px] items-start gap-2.5 rounded-md border border-line-soft bg-surface-glass-subtle px-3 py-2.5 text-[13px] font-semibold text-ink-medium',
  checkboxInput: 'mt-0.5 shrink-0',
};

export function AiQuizGeneratorForm({
  form,
  meta,
  visibleSubjects,
  visibleTopics,
  visibleLessons,
  onChange,
  onSubmit,
  isLoading,
  generatorLabel = 'AI',
  generatorEyebrow = 'AI Question Builder',
  generatorDescription = 'Generate draft medical questions, review the output, and save approved items into the LMS question bank.',
  lessonQuizMode = false,
}) {
  const selectedCourse = meta.courses.find((item) => String(item.id) === String(form.courseId));
  const selectedSubject = visibleSubjects.find((item) => String(item.id) === String(form.subjectId));
  const selectedTopic = visibleTopics.find((item) => String(item.id) === String(form.topicId));
  const selectedLesson = visibleLessons.find((item) => String(item.id) === String(form.lessonId));
  const isMixed = Boolean(form.questionTypes?.sba && form.questionTypes?.true_false);
  const automaticPrompt = [
    `Create ${isMixed ? 'mixed SBA and True/False' : form.questionType === 'sba' ? 'SBA' : 'True/False'} questions related to clinical and theoretical knowledge for a medical student.`,
    selectedCourse ? `Course: ${selectedCourse.courseTitle}.` : '',
    selectedSubject ? `Subject: ${selectedSubject.subjectName}.` : '',
    selectedTopic ? `Topic: ${selectedTopic.topicName}.` : '',
    selectedLesson ? `Lesson: ${selectedLesson.lessonTitle}.` : '',
    form.category === 'past_paper'
      ? 'Use a past paper style.'
      : form.category === 'ai'
        ? 'Tag the questions as AI-generated revision content.'
        : 'Use a mock exam revision style.',
    `Difficulty: ${form.difficulty}.`,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section className={cx(ui.panelCard, aiFormUi.panel)}>
      <div className={ui.panelTop}>
        <div>
          <span className={ui.eyebrow}>{generatorEyebrow}</span>
          <h2>{generatorLabel} Quiz Generator</h2>
          <p>{generatorDescription}</p>
        </div>
      </div>

      <form className={ui.stackForm} onSubmit={onSubmit}>
        <div className={aiFormUi.fieldGrid}>
          <label className={ui.formLabel}>
            Course
            <select className={ui.input} name="courseId" value={form.courseId} onChange={onChange}>
              <option value="">Select course</option>
              {meta.courses.map((course) => (
                <option key={course.id} value={course.id}>{course.courseTitle}</option>
              ))}
            </select>
          </label>
          <label className={ui.formLabel}>
            Subject
            <select className={ui.input} name="subjectId" value={form.subjectId} onChange={onChange}>
              <option value="">Select subject</option>
              {visibleSubjects.map((subject) => (
                <option key={subject.id} value={subject.id}>{subject.subjectName}</option>
              ))}
            </select>
          </label>
          <label className={ui.formLabel}>
            Topic
            <select className={ui.input} name="topicId" value={form.topicId} onChange={onChange}>
              <option value="">Optional topic</option>
              {visibleTopics.map((topic) => (
                <option key={topic.id} value={topic.id}>{topic.topicName}</option>
              ))}
            </select>
          </label>
          <label className={ui.formLabel}>
            Lesson
            <select className={ui.input} name="lessonId" value={form.lessonId} onChange={onChange}>
              <option value="">Optional lesson</option>
              {visibleLessons.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>{lesson.lessonTitle}</option>
              ))}
            </select>
          </label>
          <label className={ui.formLabel}>
            Category
            <select className={ui.input} name="category" value={form.category} onChange={onChange}>
              <option value="ai">AI</option>
              <option value="mock">Mock</option>
              <option value="past_paper">Past Paper</option>
            </select>
          </label>
          <label className={ui.formLabel}>
            Question Type
            {lessonQuizMode ? (
              <div className={aiFormUi.checkboxGrid}>
                <label className={aiFormUi.checkboxCard}>
                  <input className={aiFormUi.checkboxInput} type="checkbox" name="questionTypes.sba" checked={Boolean(form.questionTypes?.sba)} onChange={onChange} />
                  SBA
                </label>
                <label className={aiFormUi.checkboxCard}>
                  <input className={aiFormUi.checkboxInput} type="checkbox" name="questionTypes.true_false" checked={Boolean(form.questionTypes?.true_false)} onChange={onChange} />
                  True / False
                </label>
              </div>
            ) : (
              <select className={ui.input} name="questionType" value={form.questionType} onChange={onChange}>
                <option value="sba">SBA</option>
                <option value="true_false">True / False</option>
              </select>
            )}
          </label>
          <label className={ui.formLabel}>
            Difficulty
            <select className={ui.input} name="difficulty" value={form.difficulty} onChange={onChange}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </label>
          <label className={ui.formLabel}>
            Number of Questions
            <input className={ui.input}
             
              name="numberOfQuestions"
              type="number"
              min="1"
              max="20"
              value={form.numberOfQuestions}
              onChange={onChange}
            />
          </label>
        </div>

        {lessonQuizMode ? (
          <div className={aiFormUi.fieldGrid}>
            <label className={ui.formLabel}>
              Quiz Title
              <input className={ui.input} name="quizTitle" value={form.quizTitle || ''} onChange={onChange} placeholder="Lesson Title - Practice" />
            </label>
            <label className={ui.formLabel}>
              Publish Status
              <select className={ui.input} name="quizStatus" value={form.quizStatus || 'draft'} onChange={onChange}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
              </select>
            </label>
            <label className={ui.formLabel}>
              Availability
              <select className={ui.input} name="quizMode" value={form.quizMode || 'both'} onChange={onChange}>
                <option value="both">Both practice + exam</option>
                <option value="exam_only">Exam only</option>
              </select>
            </label>
          </div>
        ) : null}

        <div className={aiFormUi.checkboxGrid}>
          <label className={aiFormUi.checkboxCard}>
            <input className={aiFormUi.checkboxInput} type="checkbox" name="includeExplanations" checked={Boolean(form.includeExplanations)} onChange={onChange} />
            Main explanations
          </label>
          <label className={aiFormUi.checkboxCard}>
            <input className={aiFormUi.checkboxInput} type="checkbox" name="includeWhyIncorrect" checked={Boolean(form.includeWhyIncorrect)} onChange={onChange} />
            Why-answer reasoning
          </label>
          <label className={aiFormUi.checkboxCard}>
            <input className={aiFormUi.checkboxInput} type="checkbox" name="includeTheoryRecap" checked={Boolean(form.includeTheoryRecap)} onChange={onChange} />
            Quick Theory Recap
          </label>
        </div>

        <div className={aiFormUi.tip}>
          <strong>Current mode</strong>
          <p>{isMixed ? 'Generates a mixed quiz and splits the selected total between SBA and True/False.' : questionTypeHints[form.questionType]}</p>
        </div>

        <div className={aiFormUi.autoPrompt}>
          <strong>Automatic LMS prompt</strong>
          <p>{automaticPrompt}</p>
        </div>

        <label className={ui.formLabel}>
          Extra instruction
          <textarea className={ui.textarea}
           
            name="instruction"
            rows="5"
            value={form.instruction}
            onChange={onChange}
            placeholder="Optional: add any extra instruction to refine the automatically generated medical prompt."
          />
        </label>

        <div className={ui.buttonRow}>
          <button type="submit" className={ui.primaryAction} disabled={isLoading}>
            {isLoading ? 'Generating...' : `Generate with ${generatorLabel}`}
          </button>
        </div>
      </form>
    </section>
  );
}
