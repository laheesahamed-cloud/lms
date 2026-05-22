import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createCourse, deleteCourse, fetchCourses, updateCourse } from '../../../../shared/api/courses.api.js';
import { createTopic, deleteTopic, fetchTopic, fetchTopics, updateTopic } from '../../../../shared/api/topics.api.js';
import { createSubtopic, deleteSubtopic, fetchSubtopics, updateSubtopic } from '../../../../shared/api/subtopics.api.js';
import { adminDeleteAiNote, adminListAiNotes } from '../../../../shared/api/aiNotes.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';

const courseDefaults = {
  courseTitle: '',
  courseCode: '',
  description: '',
  examType: 'ERPM',
  status: 'active',
};

const subjectDefaults = {
  topicName: '',
  topicDescription: '',
  subtopics: [],
  status: 'active',
};

const topicDefaults = {
  subtopicName: '',
  status: 'active',
};

const structureUi = {
  modal: 'max-w-[760px]',
  hero:
    'grid grid-cols-[minmax(0,1fr)_minmax(280px,440px)] items-start gap-[18px] px-6 py-5 max-[1180px]:grid-cols-1',
  heroCopy:
    '[&_h2]:my-2 [&_h2]:mb-2 [&_h2]:text-[clamp(1.2rem,2vw,1.6rem)] [&_h2]:leading-[1.15] [&_p]:max-w-[640px] [&_p]:text-[0.92rem] [&_p]:leading-[1.55] [&_p]:text-ink-soft',
  heroStats:
    'flex max-w-[440px] flex-wrap items-start justify-end gap-2 justify-self-end overflow-y-hidden pb-0 max-[1180px]:max-w-none max-[1180px]:justify-start max-[1180px]:justify-self-stretch',
  miniStat:
    'min-h-[58px] min-w-[82px] flex-[0_0_82px] rounded-[14px] border border-line-soft bg-surface-glass-subtle px-2.5 py-2 [&_strong]:block [&_strong]:text-[0.95rem] [&_strong]:leading-[1.1] [&_span]:mt-[3px] [&_span]:block [&_span]:text-[0.68rem] [&_span]:leading-[1.15] [&_span]:text-ink-soft',
  levelOne: 'grid min-w-0 grid-cols-1 gap-4',
  gridThree:
    'grid min-w-0 grid-cols-3 items-stretch gap-6 max-[1180px]:grid-cols-2 max-[980px]:grid-cols-1',
  column:
    'flex min-h-[620px] min-w-0 flex-col gap-4 rounded-2xl p-6 max-[820px]:min-h-0 max-[820px]:p-5',
  levelOneColumn: 'min-h-0 gap-2.5 rounded-xl p-3',
  columnHead:
    'mb-0 flex min-h-[88px] items-start justify-between gap-4 max-[820px]:flex-wrap [&>div]:min-w-0 [&_h2]:my-2 [&_h2]:text-xl [&_h2]:leading-tight [&_p]:m-0 [&_p]:text-[0.92rem] [&_p]:leading-normal [&_p]:text-ink-soft',
  levelOneHead:
    'min-h-0 items-center gap-3 [&_h2]:my-0.5 [&_h2]:text-[1rem] [&_p]:text-[0.76rem] [&_p]:leading-snug',
  columnAddButton: 'shrink-0 self-start min-w-[88px] max-[820px]:w-full',
  levelOneAddButton: 'min-h-[30px] min-w-0 self-center rounded-[var(--radius-sm)] px-3 text-xs max-[820px]:w-auto',
  columnMeta:
    'rounded-[18px] border border-line-soft bg-surface-glass-subtle p-4 text-[0.92rem] leading-normal text-ink-soft',
  levelOneMeta:
    'w-fit rounded-full px-3 py-1 text-[0.72rem] font-semibold leading-tight',
  list: 'flex flex-1 flex-col content-start gap-4',
  levelOneList:
    'flex-row flex-nowrap gap-2 overflow-x-auto overflow-y-hidden pb-0.5 max-[820px]:flex-wrap max-[820px]:overflow-x-visible',
  node:
    'flex min-h-[88px] items-center gap-4 rounded-xl border border-line-soft bg-surface-glass-subtle p-4 shadow-[0_14px_30px_rgba(15,23,42,0.06)] transition max-[820px]:flex-wrap max-[820px]:items-start',
  nodeSelectable:
    'cursor-pointer hover:-translate-y-0.5 hover:shadow-md',
  nodeSelected:
    'border-brand-primary/35 bg-[linear-gradient(135deg,rgba(37,99,235,0.14),rgba(6,182,212,0.08))] shadow-[0_14px_30px_rgba(15,23,42,0.06),inset_0_0_0_1px_rgba(37,99,235,0.14)]',
  levelOneNode:
    'min-h-9 min-w-[152px] flex-none gap-2 rounded-full px-2.5 py-1.5 shadow-none max-[820px]:min-w-[min(100%,190px)]',
  status:
    'w-2.5 shrink-0 self-stretch rounded-full bg-slate-400/40',
  statusActive: 'bg-[linear-gradient(180deg,#06b6d4,#2563eb)]',
  statusInactive: 'bg-[linear-gradient(180deg,#94a3b8,#64748b)]',
  levelOneStatus: 'w-2',
  nodeBody:
    'grid min-w-0 flex-1 content-center gap-1 text-left [&_span]:text-[0.86rem] [&_span]:leading-normal [&_span]:text-ink-soft [&_strong]:text-base [&_strong]:font-bold [&_strong]:leading-snug',
  levelOneBody:
    'gap-0 [&_span]:truncate [&_span]:text-[0.68rem] [&_strong]:truncate [&_strong]:text-[0.76rem]',
  nodeActions:
    'flex shrink-0 items-center justify-end gap-2 max-[820px]:w-full',
  levelOneActions: 'hidden',
};

function countActive(items) {
  return items.filter((item) => item.status === 'active').length;
}

function EntityModal({ open, title, subtitle, children, onClose }) {
  if (!open) {
    return null;
  }

  return (
    <div className={ui.modalBackdrop} onClick={onClose}>
      <div className={cx(ui.entityModal, structureUi.modal)} onClick={(event) => event.stopPropagation()}>
        <div className={ui.entityModalTop}>
          <div>
            <h2 className={ui.entityModalTitle}>{title}</h2>
            {subtitle ? <p className={ui.entityModalText}>{subtitle}</p> : null}
          </div>
          <button type="button" className={ui.subtleIconButton} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SparkleIcon() {
  return <svg width="11" height="11" viewBox="0 0 14 14" fill="none" style={{ display:'inline-block', verticalAlign:'middle' }}><path d="M7 1L8.5 5H13L9.5 7.5L11 12L7 9.5L3 12L4.5 7.5L1 5H5.5L7 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/></svg>;
}

function HierarchyColumn({
  eyebrow,
  title,
  description,
  countLabel,
  actionLabel,
  onAction,
  loading,
  emptyLabel,
  items,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
  getTitle,
  getMeta,
  getExtraAction,
  compact = false,
}) {
  return (
    <section className={cx(ui.panelCard, structureUi.column, compact && structureUi.levelOneColumn)}>
      <div className={cx(structureUi.columnHead, compact && structureUi.levelOneHead)}>
        <div>
          <span className={ui.eyebrow}>{eyebrow}</span>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <button type="button" className={cx(ui.panelAddButton, structureUi.columnAddButton, compact && structureUi.levelOneAddButton)} onClick={onAction}>
          {actionLabel}
        </button>
      </div>

      <div className={cx(structureUi.columnMeta, compact && structureUi.levelOneMeta)}>{countLabel}</div>

      <div className={cx(structureUi.list, compact && structureUi.levelOneList)}>
        {loading ? <div className={ui.emptyBox}>Loading {title.toLowerCase()}...</div> : null}
        {!loading && items.length === 0 ? <div className={ui.emptyBox}>{emptyLabel}</div> : null}
        {items.map((item) => (
          <article
            key={item.id}
            className={cx(
              structureUi.node,
              compact && structureUi.levelOneNode,
              selectedId === item.id && structureUi.nodeSelected,
              onSelect && structureUi.nodeSelectable
            )}
            onClick={onSelect ? () => onSelect(item.id) : undefined}
          >
            <div
              className={cx(
                structureUi.status,
                compact && structureUi.levelOneStatus,
                item.status === 'active' ? structureUi.statusActive : structureUi.statusInactive
              )}
            />
            <div className={cx(structureUi.nodeBody, compact && structureUi.levelOneBody)}>
              <strong>{getTitle(item)}</strong>
              <span>{getMeta(item)}</span>
            </div>
            <div className={cx(structureUi.nodeActions, compact && structureUi.levelOneActions)}>
              {getExtraAction ? getExtraAction(item) : null}
              <button type="button" className={ui.squareIconButton} onClick={(event) => onEdit(item, event)} aria-label={`Edit ${title}`}>
                E
              </button>
              <button type="button" className={ui.squareDangerIconButton} onClick={(event) => onDelete(item, event)} aria-label={`Delete ${title}`}>
                D
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function StructurePage() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [aiLessons, setAiLessons] = useState([]);

  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState(null);
  const [selectedTopicId, setSelectedTopicId] = useState(null);

  const [courseForm, setCourseForm] = useState(courseDefaults);
  const [subjectForm, setSubjectForm] = useState(subjectDefaults);
  const [topicForm, setTopicForm] = useState(topicDefaults);

  const [editingCourseId, setEditingCourseId] = useState(null);
  const [editingSubjectId, setEditingSubjectId] = useState(null);
  const [editingTopicId, setEditingTopicId] = useState(null);

  const [tagInput, setTagInput] = useState('');
  const [feedback, setFeedback] = useState({ error: '', success: '' });
  const [loading, setLoading] = useState({
    courses: true,
    subjects: false,
    topics: false,
    lessons: false,
  });
  const [modal, setModal] = useState(null);
  const [submitting, setSubmitting] = useState({
    course: false,
    subject: false,
    topic: false,
    lesson: false,
  });

  useEffect(() => {
    loadCourses();
    loadAiLessons();
  }, []);

  async function loadAiLessons() {
    setLoading((current) => ({ ...current, lessons: true }));
    try {
      const data = await adminListAiNotes();
      setAiLessons(data);
    } catch (error) {
      setFeedback({ error: getErrorMessage(error, 'Unable to load lessons'), success: '' });
    } finally {
      setLoading((current) => ({ ...current, lessons: false }));
    }
  }

  useEffect(() => {
    if (!selectedCourseId) {
      setSubjects([]);
      setSelectedSubjectId(null);
      return;
    }

    loadSubjects(selectedCourseId);
  }, [selectedCourseId]);

  useEffect(() => {
    if (!selectedSubjectId) {
      setTopics([]);
      setSelectedTopicId(null);
      return;
    }

    loadTopics(selectedSubjectId);
  }, [selectedSubjectId]);

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId) || null,
    [courses, selectedCourseId]
  );
  const selectedSubject = useMemo(
    () => subjects.find((subject) => subject.id === selectedSubjectId) || null,
    [subjects, selectedSubjectId]
  );
  const selectedTopic = useMemo(
    () => topics.find((topic) => topic.id === selectedTopicId) || null,
    [topics, selectedTopicId]
  );

  async function loadCourses() {
    setLoading((current) => ({ ...current, courses: true }));
    try {
      const data = await fetchCourses();
      setCourses(data);
      setSelectedCourseId((current) => (current && data.some((course) => course.id === current) ? current : data[0]?.id ?? null));
    } catch (error) {
      setFeedback({ error: getErrorMessage(error, 'Unable to load courses'), success: '' });
    } finally {
      setLoading((current) => ({ ...current, courses: false }));
    }
  }

  async function loadSubjects(courseId) {
    setLoading((current) => ({ ...current, subjects: true }));
    try {
      const data = await fetchTopics(courseId);
      setSubjects(data);
      setSelectedSubjectId((current) => (current && data.some((subject) => subject.id === current) ? current : data[0]?.id ?? null));
    } catch (error) {
      setFeedback({ error: getErrorMessage(error, 'Unable to load subjects'), success: '' });
    } finally {
      setLoading((current) => ({ ...current, subjects: false }));
    }
  }

  async function loadTopics(subjectId) {
    setLoading((current) => ({ ...current, topics: true }));
    try {
      const data = await fetchSubtopics(subjectId);
      setTopics(data);
      setSelectedTopicId((current) => (current && data.some((topic) => topic.id === current) ? current : data[0]?.id ?? null));
    } catch (error) {
      setFeedback({ error: getErrorMessage(error, 'Unable to load topics'), success: '' });
    } finally {
      setLoading((current) => ({ ...current, topics: false }));
    }
  }

  function flashMessage(next) {
    setFeedback(next);
    window.setTimeout(() => {
      setFeedback((current) => (current === next ? { error: '', success: '' } : current));
    }, 2400);
  }

  function resetCourseForm() {
    setEditingCourseId(null);
    setCourseForm(courseDefaults);
  }

  function resetSubjectForm() {
    setEditingSubjectId(null);
    setSubjectForm(subjectDefaults);
    setTagInput('');
  }

  function resetTopicForm() {
    setEditingTopicId(null);
    setTopicForm(topicDefaults);
  }

  function closeModal() {
    setModal(null);
    resetCourseForm();
    resetSubjectForm();
    resetTopicForm();
  }

  function openCourseCreate() {
    resetCourseForm();
    setModal('course');
  }

  function openSubjectCreate() {
    if (!selectedCourseId) {
      flashMessage({ error: 'Select a course first', success: '' });
      return;
    }

    resetSubjectForm();
    setModal('subject');
  }

  function openTopicCreate() {
    if (!selectedSubjectId) {
      flashMessage({ error: 'Select a subject first', success: '' });
      return;
    }

    resetTopicForm();
    setModal('topic');
  }

  function openCourseEdit(course, event) {
    event.stopPropagation();
    setEditingCourseId(course.id);
    setCourseForm({
      courseTitle: course.courseTitle,
      courseCode: course.courseCode,
      description: course.description,
      examType: course.examType,
      status: course.status,
    });
    setModal('course');
  }

  async function openSubjectEdit(subject, event) {
    event.stopPropagation();

    try {
      const fullSubject = await fetchTopic(subject.id);
      setEditingSubjectId(subject.id);
      setSubjectForm({
        topicName: fullSubject.topicName,
        topicDescription: fullSubject.topicDescription,
        subtopics: fullSubject.subtopics || [],
        status: fullSubject.status,
      });
      setModal('subject');
    } catch (error) {
      flashMessage({ error: getErrorMessage(error, 'Unable to load subject'), success: '' });
    }
  }

  function openTopicEdit(topic, event) {
    event.stopPropagation();
    setEditingTopicId(topic.id);
    setTopicForm({
      subtopicName: topic.subtopicName,
      status: topic.status,
    });
    setModal('topic');
  }

  function addTagFromInput() {
    const value = tagInput.trim();
    if (!value) {
      return;
    }

    setSubjectForm((current) => ({
      ...current,
      subtopics: current.subtopics.includes(value) ? current.subtopics : [...current.subtopics, value],
    }));
    setTagInput('');
  }

  function removeTag(name) {
    setSubjectForm((current) => ({
      ...current,
      subtopics: current.subtopics.filter((item) => item !== name),
    }));
  }

  async function handleCourseSubmit(event) {
    event.preventDefault();
    setSubmitting((current) => ({ ...current, course: true }));

    try {
      if (editingCourseId) {
        await updateCourse(editingCourseId, courseForm);
        flashMessage({ error: '', success: 'Course updated' });
      } else {
        await createCourse(courseForm);
        flashMessage({ error: '', success: 'Course created' });
      }

      closeModal();
      await loadCourses();
    } catch (error) {
      flashMessage({ error: getErrorMessage(error, 'Unable to save course'), success: '' });
    } finally {
      setSubmitting((current) => ({ ...current, course: false }));
    }
  }

  async function handleSubjectSubmit(event) {
    event.preventDefault();
    setSubmitting((current) => ({ ...current, subject: true }));

    try {
      const payload = { ...subjectForm, courseId: selectedCourseId };

      if (editingSubjectId) {
        await updateTopic(editingSubjectId, payload);
        flashMessage({ error: '', success: 'Subject updated' });
      } else {
        await createTopic(payload);
        flashMessage({ error: '', success: 'Subject created' });
      }

      closeModal();
      await loadSubjects(selectedCourseId);
    } catch (error) {
      flashMessage({ error: getErrorMessage(error, 'Unable to save subject'), success: '' });
    } finally {
      setSubmitting((current) => ({ ...current, subject: false }));
    }
  }

  async function handleTopicSubmit(event) {
    event.preventDefault();
    setSubmitting((current) => ({ ...current, topic: true }));

    try {
      const payload = { ...topicForm, topicId: selectedSubjectId };

      if (editingTopicId) {
        await updateSubtopic(editingTopicId, payload);
        flashMessage({ error: '', success: 'Topic updated' });
      } else {
        await createSubtopic(payload);
        flashMessage({ error: '', success: 'Topic created' });
      }

      closeModal();
      await loadTopics(selectedSubjectId);
      await loadSubjects(selectedCourseId);
    } catch (error) {
      flashMessage({ error: getErrorMessage(error, 'Unable to save topic'), success: '' });
    } finally {
      setSubmitting((current) => ({ ...current, topic: false }));
    }
  }

  async function handleCourseDelete(course, event) {
    event.stopPropagation();
    if (!window.confirm(`Delete "${course.courseTitle}"?`)) {
      return;
    }

    try {
      await deleteCourse(course.id);
      if (selectedCourseId === course.id) {
        setSelectedCourseId(null);
      }
      await loadCourses();
      flashMessage({ error: '', success: 'Course deleted' });
    } catch (error) {
      flashMessage({ error: getErrorMessage(error, 'Unable to delete course'), success: '' });
    }
  }

  async function handleSubjectDelete(subject, event) {
    event.stopPropagation();
    if (!window.confirm(`Delete "${subject.topicName}"?`)) {
      return;
    }

    try {
      await deleteTopic(subject.id);
      await loadSubjects(selectedCourseId);
      flashMessage({ error: '', success: 'Subject deleted' });
    } catch (error) {
      flashMessage({ error: getErrorMessage(error, 'Unable to delete subject'), success: '' });
    }
  }

  async function handleTopicDelete(topic, event) {
    event.stopPropagation();
    if (!window.confirm(`Delete "${topic.subtopicName}"?`)) {
      return;
    }

    try {
      await deleteSubtopic(topic.id);
      await loadTopics(selectedSubjectId);
      await loadSubjects(selectedCourseId);
      flashMessage({ error: '', success: 'Topic deleted' });
    } catch (error) {
      flashMessage({ error: getErrorMessage(error, 'Unable to delete topic'), success: '' });
    }
  }

  async function handleLessonDelete(lesson, event) {
    event.stopPropagation();
    if (!window.confirm(`Delete lesson "${lesson.title}"?`)) {
      return;
    }

    try {
      await adminDeleteAiNote(lesson.id);
      await loadAiLessons();
      flashMessage({ error: '', success: 'Lesson deleted' });
    } catch (error) {
      flashMessage({ error: getErrorMessage(error, 'Unable to delete lesson'), success: '' });
    }
  }

  const lessons = useMemo(
    () => aiLessons.filter((note) =>
      String(note.courseId || '') === String(selectedCourseId || '')
      && String(note.topicId || '') === String(selectedSubjectId || '')
      && String(note.subtopicId || '') === String(selectedTopicId || '')
    ),
    [aiLessons, selectedCourseId, selectedSubjectId, selectedTopicId]
  );

  return (
    <main className={ui.screenShell}>
      <section className={ui.managementLayout}>
        <AppHeader
          title="Academic structure"
          subtitle="Curriculum Builder"
        />

        {feedback.error ? <div className={ui.feedbackError}>{feedback.error}</div> : null}
        {feedback.success ? <div className={ui.feedbackSuccess}>{feedback.success}</div> : null}

        <section className={cx(ui.panelCard, structureUi.hero, 'animate-fadePop')}>
          <div className={structureUi.heroCopy}>
            <span className={ui.eyebrow}>Hierarchy Engine</span>
            <h2>Build the academic tree.</h2>
            <p>
              Select a course, then drill down into subjects, topics, and lessons.
            </p>
          </div>

          <div className={structureUi.heroStats}>
            <div className={structureUi.miniStat}>
              <strong>{courses.length}</strong>
              <span>Courses</span>
            </div>
            <div className={structureUi.miniStat}>
              <strong>{subjects.length}</strong>
              <span>Subjects</span>
            </div>
            <div className={structureUi.miniStat}>
              <strong>{topics.length}</strong>
              <span>Topics</span>
            </div>
            <div className={structureUi.miniStat}>
              <strong>{lessons.length}</strong>
              <span>Lessons</span>
            </div>
            <div className={structureUi.miniStat}>
              <strong>{countActive(courses)}</strong>
              <span>Active</span>
            </div>
          </div>
        </section>

        <div className={structureUi.levelOne}>
          <HierarchyColumn
            eyebrow="Level 1"
            title="Courses"
            description="Top-level medical programs and exam pathways."
            countLabel={loading.courses ? 'Loading...' : `${courses.length} total courses`}
            actionLabel="+ Add"
            onAction={openCourseCreate}
            loading={loading.courses}
            emptyLabel="No courses yet."
            items={courses}
            selectedId={selectedCourseId}
            onSelect={setSelectedCourseId}
            onEdit={openCourseEdit}
            onDelete={handleCourseDelete}
            getTitle={(course) => course.courseTitle}
            getMeta={(course) => `${course.examType} • ${course.courseCode}`}
            compact
          />
        </div>

        <div className={structureUi.gridThree}>
          <HierarchyColumn
            eyebrow="Level 2"
            title="Subjects"
            description={selectedCourse ? `Linked to ${selectedCourse.courseTitle}` : 'Choose a course first to manage subjects.'}
            countLabel={selectedCourse ? `${subjects.length} subjects in selected course` : 'No course selected'}
            actionLabel="+ Add"
            onAction={openSubjectCreate}
            loading={loading.subjects}
            emptyLabel="No subjects yet."
            items={subjects}
            selectedId={selectedSubjectId}
            onSelect={setSelectedSubjectId}
            onEdit={openSubjectEdit}
            onDelete={handleSubjectDelete}
            getTitle={(subject) => subject.topicName}
            getMeta={(subject) => `${subject.subtopicCount || 0} topics`}
          />

          <HierarchyColumn
            eyebrow="Level 3"
            title="Topics"
            description={selectedSubject ? `Linked to ${selectedSubject.topicName}` : 'Choose a subject first to manage topics.'}
            countLabel={selectedSubject ? `${topics.length} topics in selected subject` : 'No subject selected'}
            actionLabel="+ Add"
            onAction={openTopicCreate}
            loading={loading.topics}
            emptyLabel="No topics yet."
            items={topics}
            selectedId={selectedTopicId}
            onSelect={setSelectedTopicId}
            onEdit={openTopicEdit}
            onDelete={handleTopicDelete}
            getTitle={(topic) => topic.subtopicName}
            getMeta={() => 'Linked to selected subject'}
          />

          <HierarchyColumn
            eyebrow="Level 4"
            title="Lessons"
            description={selectedTopic ? `Lessons inside ${selectedTopic.subtopicName}` : 'Choose a topic first to manage lessons.'}
            countLabel={selectedTopic ? `${lessons.length} lesson${lessons.length === 1 ? '' : 's'} in selected topic` : 'No topic selected'}
            actionLabel="+ Lesson"
            onAction={() => navigate('/ai-notes')}
            loading={loading.lessons}
            emptyLabel="No lessons yet."
            items={lessons}
            selectedId={null}
            onSelect={null}
            onEdit={(lesson, event) => {
              event.stopPropagation();
              navigate(`/ai-notes/${lesson.id}`);
            }}
            onDelete={handleLessonDelete}
            getTitle={(lesson) => lesson.title}
            getMeta={(lesson) => lesson.status === 'active' ? 'Published' : 'Inactive'}
            getExtraAction={() => (
              <button className={cx(ui.squareIconButton, 'text-brand-primary border-brand-primary')}
                type="button"
               
                title="Open lesson"
              >
                <SparkleIcon/>
              </button>
            )}
          />
        </div>

        <EntityModal
          open={modal === 'course'}
          title={editingCourseId ? 'Edit course' : 'Create course'}
          subtitle="Program Details"
          onClose={closeModal}
        >
          <form className={cx(ui.stackForm, ui.modalForm)} onSubmit={handleCourseSubmit}>
            <label className={ui.formLabel}>
              Course title
              <input className={ui.input}
                name="courseTitle"
                value={courseForm.courseTitle}
                onChange={(event) => setCourseForm((current) => ({ ...current, [event.target.name]: event.target.value }))}
                required
              />
            </label>
            <label className={ui.formLabel}>
              Course code
              <input className={ui.input}
                name="courseCode"
                value={courseForm.courseCode}
                onChange={(event) => setCourseForm((current) => ({ ...current, [event.target.name]: event.target.value }))}
                required
              />
            </label>
            <label className={ui.formLabel}>
              Exam type
              <input className={ui.input}
                name="examType"
                value={courseForm.examType}
                onChange={(event) => setCourseForm((current) => ({ ...current, [event.target.name]: event.target.value }))}
                required
              />
            </label>
            <label className={ui.formLabel}>
              Status
              <select className={ui.input}
                name="status"
                value={courseForm.status}
                onChange={(event) => setCourseForm((current) => ({ ...current, [event.target.name]: event.target.value }))}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <label className={ui.formLabel}>
              Description
              <textarea className={ui.textarea}
                name="description"
                rows="4"
                value={courseForm.description}
                onChange={(event) => setCourseForm((current) => ({ ...current, [event.target.name]: event.target.value }))}
              />
            </label>
            <div className={ui.buttonRow}>
              <button className={ui.primaryAction} type="submit" disabled={submitting.course}>
                {submitting.course ? 'Saving...' : editingCourseId ? 'Update course' : 'Create course'}
              </button>
              <button type="button" className={ui.secondaryAction} onClick={closeModal}>Cancel</button>
            </div>
          </form>
        </EntityModal>

        <EntityModal
          open={modal === 'subject'}
          title={editingSubjectId ? 'Edit subject' : 'Create subject'}
          subtitle="Subject Setup"
          onClose={closeModal}
        >
          <form className={cx(ui.stackForm, ui.modalForm)} onSubmit={handleSubjectSubmit}>
            <label className={ui.formLabel}>
              Subject name
              <input className={ui.input}
                name="topicName"
                value={subjectForm.topicName}
                onChange={(event) => setSubjectForm((current) => ({ ...current, [event.target.name]: event.target.value }))}
                required
              />
            </label>
            <label className={ui.formLabel}>
              Description
              <textarea className={ui.textarea}
                name="topicDescription"
                rows="4"
                value={subjectForm.topicDescription}
                onChange={(event) => setSubjectForm((current) => ({ ...current, [event.target.name]: event.target.value }))}
              />
            </label>
            <label className={ui.formLabel}>
              Starter topics
              <div className={ui.tagInputShell}>
                <div className={ui.tagList}>
                  {subjectForm.subtopics.map((name) => (
                    <span className={ui.tagChip} key={name}>
                      {name}
                      <button className={ui.primaryAction} type="button" onClick={() => removeTag(name)}>x</button>
                    </span>
                  ))}
                  <input className={ui.input}
                    value={tagInput}
                    onChange={(event) => setTagInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addTagFromInput();
                      }
                    }}
                    placeholder="Type and press Enter"
                  />
                </div>
              </div>
            </label>
            <label className={ui.formLabel}>
              Status
              <select className={ui.input}
                name="status"
                value={subjectForm.status}
                onChange={(event) => setSubjectForm((current) => ({ ...current, [event.target.name]: event.target.value }))}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <div className={ui.buttonRow}>
              <button className={ui.primaryAction} type="submit" disabled={submitting.subject}>
                {submitting.subject ? 'Saving...' : editingSubjectId ? 'Update subject' : 'Create subject'}
              </button>
              <button type="button" className={ui.secondaryAction} onClick={closeModal}>Cancel</button>
            </div>
          </form>
        </EntityModal>

        <EntityModal
          open={modal === 'topic'}
          title={editingTopicId ? 'Edit topic' : 'Create topic'}
          subtitle="Topic Setup"
          onClose={closeModal}
        >
          <form className={cx(ui.stackForm, ui.modalForm)} onSubmit={handleTopicSubmit}>
            <label className={ui.formLabel}>
              Topic name
              <input className={ui.input}
                name="subtopicName"
                value={topicForm.subtopicName}
                onChange={(event) => setTopicForm((current) => ({ ...current, [event.target.name]: event.target.value }))}
                required
              />
            </label>
            <label className={ui.formLabel}>
              Status
              <select className={ui.input}
                name="status"
                value={topicForm.status}
                onChange={(event) => setTopicForm((current) => ({ ...current, [event.target.name]: event.target.value }))}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <div className={ui.buttonRow}>
              <button className={ui.primaryAction} type="submit" disabled={submitting.topic}>
                {submitting.topic ? 'Saving...' : editingTopicId ? 'Update topic' : 'Create topic'}
              </button>
              <button type="button" className={ui.secondaryAction} onClick={closeModal}>Cancel</button>
            </div>
          </form>
        </EntityModal>

      </section>
    </main>
  );
}
