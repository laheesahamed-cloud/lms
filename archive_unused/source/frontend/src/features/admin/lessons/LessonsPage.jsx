import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { beautifyLessonNotes } from '../../../api/ai.api.js';
import {
  createLesson,
  deleteLesson,
  fetchAdminLessons,
  fetchLessonMeta,
  updateLesson,
} from '../../../api/lessons.api.js';
import { getErrorMessage } from '../../../api/client.js';
import { AppHeader } from '../../../components/layout/AppHeader.jsx';
import { DeleteActionIcon, EditActionIcon } from '../../../components/ui/ActionIcons.jsx';
import { cx, statusPill, ui } from '../../../styles/tailwindClasses.js';

const initialFilters = {
  search: '',
  courseId: '',
  topicId: '',
  subtopicId: '',
  status: '',
};

const emptyForm = {
  courseId: '',
  topicId: '',
  subtopicId: '',
  lessonTitle: '',
  lessonContent: '',
  videoUrl: '',
  isFree: false,
  status: 'active',
};

const lessonInlineNoteClass = 'mx-6 mt-5 rounded-lg border border-brand-primary/15 bg-brand-primary/5 px-4 py-3 text-[13px] leading-relaxed text-ink-soft max-[600px]:mx-4';
const lessonModalGridClass = 'grid grid-cols-[minmax(0,1fr)_minmax(300px,0.92fr)] max-[900px]:grid-cols-1';
const lessonPreviewPanelClass = 'border-l border-line-soft bg-surface-2/60 max-[900px]:border-l-0';
const lessonPreviewTopClass = 'px-6 pb-3 pt-[22px] max-[600px]:px-4';
const aiPreviewShellClass = 'grid gap-4 px-6 pb-6 max-[600px]:px-4';
const aiPreviewSummaryClass = 'rounded-lg border border-line-soft bg-surface-1 p-4 [&_h3]:m-0 [&_h3]:mt-1 [&_h3]:text-base [&_h3]:text-ink-strong [&_p]:m-0 [&_p]:mt-2 [&_p]:text-[13px] [&_p]:leading-relaxed [&_p]:text-ink-soft';
const aiPreviewBodyClass = 'max-h-[360px] overflow-auto whitespace-pre-wrap rounded-lg border border-line-soft bg-surface-1 p-4 text-[13px] leading-relaxed text-ink-strong';

export function LessonsPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState(initialFilters);
  const [meta, setMeta] = useState({ courses: [], topics: [], subtopics: [] });
  const [lessons, setLessons] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [beautifying, setBeautifying] = useState(false);
  const [aiPreview, setAiPreview] = useState(null);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function bootstrap() {
      setLoading(true);

      try {
        const [metaData, lessonData] = await Promise.all([fetchLessonMeta(), fetchAdminLessons()]);
        setMeta(metaData);
        setLessons(lessonData);
      } catch (loadError) {
        setError(getErrorMessage(loadError, 'Unable to load lessons'));
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
  }, []);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setToast(null);
    }, 3200);

    return () => window.clearTimeout(timeout);
  }, [toast]);

  const filteredTopics = useMemo(
    () => meta.topics.filter((topic) => !form.courseId || String(topic.courseId) === String(form.courseId)),
    [meta.topics, form.courseId]
  );
  const filteredSubtopics = useMemo(
    () => meta.subtopics.filter((subtopic) => !form.topicId || String(subtopic.topicId) === String(form.topicId)),
    [meta.subtopics, form.topicId]
  );
  const filterTopics = useMemo(
    () => meta.topics.filter((topic) => !filters.courseId || String(topic.courseId) === String(filters.courseId)),
    [meta.topics, filters.courseId]
  );
  const filterSubtopics = useMemo(
    () => meta.subtopics.filter((subtopic) => !filters.topicId || String(subtopic.topicId) === String(filters.topicId)),
    [meta.subtopics, filters.topicId]
  );

  async function loadLessons(nextFilters = filters) {
    setLoading(true);
    setError('');

    try {
      const params = Object.fromEntries(Object.entries(nextFilters).filter(([, value]) => value));
      const data = await fetchAdminLessons(params);
      setLessons(data);
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Unable to load lessons'));
    } finally {
      setLoading(false);
    }
  }

  function handleFilterChange(event) {
    const { name, value } = event.target;
    setFilters((current) => {
      if (name === 'courseId') {
        return { ...current, courseId: value, topicId: '', subtopicId: '' };
      }
      if (name === 'topicId') {
        return { ...current, topicId: value, subtopicId: '' };
      }
      return { ...current, [name]: value };
    });
  }

  function handleFormChange(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => {
      if (name === 'courseId') {
        return { ...current, courseId: value, topicId: '', subtopicId: '' };
      }
      if (name === 'topicId') {
        return { ...current, topicId: value, subtopicId: '' };
      }
      return { ...current, [name]: type === 'checkbox' ? checked : value };
    });
  }

  function resetForm() {
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setAiPreview(null);
  }

  function showToast(text, type = 'success') {
    setToast({ text, type });
  }

  function startEdit(lesson) {
    setEditingId(lesson.id);
    setModalOpen(true);
    setForm({
      courseId: String(lesson.courseId),
      topicId: String(lesson.topicId),
      subtopicId: String(lesson.subtopicId),
      lessonTitle: lesson.lessonTitle,
      lessonContent: lesson.lessonContent,
      videoUrl: lesson.videoUrl,
      isFree: lesson.isFree === 1,
      status: lesson.status,
    });
    setError('');
    setAiPreview(null);
  }

  function openCreateModal() {
    setError('');
    setEditingId(null);
    setForm(emptyForm);
    setAiPreview(null);
    setModalOpen(true);
  }

  async function handleFilterSubmit(event) {
    event.preventDefault();
    await loadLessons(filters);
  }

  async function handleResetFilters() {
    setFilters(initialFilters);
    await loadLessons(initialFilters);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    const payload = {
      ...form,
      courseId: Number(form.courseId),
      topicId: Number(form.topicId),
      subtopicId: Number(form.subtopicId),
      isFree: form.isFree ? 1 : 0,
    };

    try {
      if (editingId) {
        await updateLesson(editingId, payload);
        showToast('Lesson updated successfully.');
      } else {
        await createLesson(payload);
        showToast('Lesson created successfully.');
      }

      resetForm();
      await loadLessons();
    } catch (submitError) {
      setError(getErrorMessage(submitError, 'Unable to save lesson'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(lesson) {
    const confirmed = window.confirm(`Delete "${lesson.lessonTitle}"?`);
    if (!confirmed) {
      return;
    }

    try {
      await deleteLesson(lesson.id);
      if (editingId === lesson.id) {
        resetForm();
      }
      showToast('Lesson deleted successfully.');
      setError('');
      await loadLessons();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, 'Unable to delete lesson'));
    }
  }

  async function handleBeautifyLesson() {
    if (!form.lessonContent.trim()) {
      setError('Paste some lesson content first, then use AI to beautify it.');
      return;
    }

    const selectedCourse = meta.courses.find((item) => String(item.id) === String(form.courseId));
    const selectedTopic = filteredTopics.find((item) => String(item.id) === String(form.topicId));
    const selectedSubtopic = filteredSubtopics.find((item) => String(item.id) === String(form.subtopicId));

    setBeautifying(true);
    setError('');

    try {
      const result = await beautifyLessonNotes({
        lessonTitle: form.lessonTitle,
        course: selectedCourse?.courseTitle || '',
        subject: selectedTopic?.topicName || '',
        topic: selectedSubtopic?.subtopicName || '',
        subtopic: '',
        lessonContent: form.lessonContent,
      });

      setAiPreview(result);
      showToast('AI preview is ready. Review it in the popup before applying it.', 'success');
    } catch (beautifyError) {
      setError(getErrorMessage(beautifyError, 'Unable to beautify lesson notes'));
    } finally {
      setBeautifying(false);
    }
  }

  function handleApplyAiPreview() {
    if (!aiPreview) {
      return;
    }

    setForm((current) => ({
      ...current,
      lessonTitle: current.lessonTitle.trim() || aiPreview.suggestedTitle || current.lessonTitle,
      lessonContent: aiPreview.beautifiedContent || current.lessonContent,
    }));
    showToast('AI notes preview applied to the lesson form.');
    setError('');
  }

  return (
    <main className={ui.screenShell}>
      <section className={ui.managementLayout}>
        <AppHeader
          title="Lessons"
          subtitle="Manage lesson content using the same Course → Subject → Topic → Lesson hierarchy defined in the central Structure page."
        />

        {error ? <div className={ui.feedbackError}>{error}</div> : null}
        {toast && createPortal(
          <div className={cx(ui.toastContainer, ui.toastContainerCenter)} role="status" aria-live="polite">
            <div className={cx(ui.toast, toast.type === 'success' ? ui.toastSuccess : ui.toastError)}>
              <span className={ui.toastIcon} aria-hidden="true">
                {toast.type === 'success' ? '✓' : '⚠'}
              </span>
              <span>{toast.text}</span>
            </div>
          </div>,
          document.body
        )}

        <div className={ui.managementGrid}>
          <section className={ui.panelCard}>
            <div className={ui.panelTop}>
              <div>
                <h2>Lesson library</h2>
                <p>{loading ? 'Loading lessons...' : `${lessons.length} lesson(s) loaded`}</p>
              </div>
              <div className={ui.questionBankActions}>
                <span className={ui.tablePill}>{lessons.filter((lesson) => lesson.status === 'active').length} active</span>
                <span className={ui.tablePill}>{lessons.filter((lesson) => lesson.status === 'inactive').length} inactive</span>
                <button type="button" className={ui.secondaryAction} onClick={() => navigate('/structure')}>
                  Open Structure
                </button>
                <button className={ui.primaryAction} type="button" onClick={openCreateModal}>
                  Add lesson
                </button>
              </div>
            </div>

            <form className={ui.filterGrid} onSubmit={handleFilterSubmit}>
              <label className={ui.formLabel}>
                Search
                <input className={ui.input}
                  name="search"
                  value={filters.search}
                  onChange={handleFilterChange}
                  placeholder="Search by lesson title"
                />
              </label>

              <label className={ui.formLabel}>
                Course
                <select className={ui.input} name="courseId" value={filters.courseId} onChange={handleFilterChange}>
                  <option value="">All</option>
                  {meta.courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.courseTitle}
                    </option>
                  ))}
                </select>
              </label>

              <label className={ui.formLabel}>
                Subject
                <select className={ui.input} name="topicId" value={filters.topicId} onChange={handleFilterChange}>
                  <option value="">All</option>
                  {filterTopics.map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      {topic.topicName}
                    </option>
                  ))}
                </select>
              </label>

              <label className={ui.formLabel}>
                Topic
                <select className={ui.input} name="subtopicId" value={filters.subtopicId} onChange={handleFilterChange}>
                  <option value="">All</option>
                  {filterSubtopics.map((subtopic) => (
                    <option key={subtopic.id} value={subtopic.id}>
                      {subtopic.subtopicName}
                    </option>
                  ))}
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

              <div className={ui.buttonRow}>
                <button className={ui.primaryAction} type="submit">Apply</button>
                <button type="button" className={ui.secondaryAction} onClick={handleResetFilters}>
                  Reset
                </button>
              </div>
            </form>

            <div className={ui.tableShell}>
              <table className={ui.modernTable}>
                <thead>
                  <tr>
                    <th className={ui.tableHeadCell}>Lesson</th>
                    <th className={ui.tableHeadCell}>Structure</th>
                    <th className={ui.tableHeadCell}>Status</th>
                    <th className={ui.tableHeadCell}>Created</th>
                    <th className={ui.tableHeadCell}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="5" className={ui.tableEmpty}>Loading lessons...</td>
                    </tr>
                  ) : null}
                  {!loading && lessons.length === 0 ? (
                    <tr>
                      <td colSpan="5" className={ui.tableEmpty}>No lessons found.</td>
                    </tr>
                  ) : null}
                  {!loading &&
                    lessons.map((lesson) => (
                      <tr key={lesson.id}>
                        <td className={ui.tableCell}>
                          <strong>{lesson.lessonTitle}</strong>
                          <div className={cx(ui.tableSubtext, ui.lessonSnippet)}>
                            {lesson.lessonContent
                              ? lesson.lessonContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'No content'
                              : 'No content'}
                          </div>
                        </td>
                        <td className={ui.tableCell}>
                          <strong>{lesson.courseTitle || '-'}</strong>
                          <div className={ui.tableSubtext}>
                            {lesson.topicName || '-'}
                            {lesson.subtopicName ? ` • ${lesson.subtopicName}` : ''}
                          </div>
                        </td>
                        <td className={ui.tableCell}>
                          <span className={statusPill(lesson.status)}>{lesson.status}</span>
                        </td>
                        <td className={ui.tableCell}>{lesson.createdAt ? new Date(lesson.createdAt).toLocaleDateString() : '-'}</td>
                        <td className={ui.tableCell}>
                          <div className={ui.iconRow}>
                            <button type="button" className={ui.iconButton} aria-label={`Edit ${lesson.lessonTitle}`} title="Edit lesson" onClick={() => startEdit(lesson)}>
                              <EditActionIcon />
                            </button>
                            <button type="button" className={ui.dangerIconButton} aria-label={`Delete ${lesson.lessonTitle}`} title="Delete lesson" onClick={() => handleDelete(lesson)}>
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
        <LessonCrudModal
          open={modalOpen}
          editingId={editingId}
          form={form}
          meta={meta}
          filteredTopics={filteredTopics}
          filteredSubtopics={filteredSubtopics}
          submitting={submitting}
          beautifying={beautifying}
          aiPreview={aiPreview}
          onClose={resetForm}
          onSubmit={handleSubmit}
          onFormChange={handleFormChange}
          onBeautify={handleBeautifyLesson}
          onApplyAiPreview={handleApplyAiPreview}
          onClearPreview={() => setAiPreview(null)}
        />
      </section>
    </main>
  );
}

function LessonCrudModal({
  open,
  editingId,
  form,
  meta,
  filteredTopics,
  filteredSubtopics,
  submitting,
  beautifying,
  aiPreview,
  onClose,
  onSubmit,
  onFormChange,
  onBeautify,
  onApplyAiPreview,
  onClearPreview,
}) {
  if (!open) {
    return null;
  }

  return createPortal(
    <div className={ui.modalBackdrop} onClick={onClose}>
      <div className={cx(ui.entityModal, ui.lessonEditModal)} onClick={(event) => event.stopPropagation()}>
        <div className={ui.entityModalTop}>
          <div>
            <h2 className={ui.entityModalTitle}>{editingId ? 'Edit lesson' : 'Add lesson'}</h2>
            <p className={ui.entityModalText}>Manage the lesson structure, content, video link, and AI note cleanup using the same hierarchy from Admin Structure.</p>
          </div>
          <button type="button" className={ui.subtleIconButton} onClick={onClose} aria-label="Close">
            x
          </button>
        </div>

        <div className={lessonInlineNoteClass}>
          Need to add or reorganize Courses, Subjects, or Topics first? Use the central Structure page so every module stays aligned.
        </div>

        <div className={lessonModalGridClass}>
          <form className={cx(ui.stackForm, ui.modalForm, 'gap-4 border-r border-line-soft px-6 pb-6 pt-[22px] max-[900px]:border-b max-[900px]:border-r-0 max-[900px]:px-4')} onSubmit={onSubmit}>
            <label className={ui.formLabel}>
              Course
              <select className={ui.input} name="courseId" value={form.courseId} onChange={onFormChange} required>
                <option value="">Choose course</option>
                {meta.courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.courseTitle}
                  </option>
                ))}
              </select>
            </label>

            <label className={ui.formLabel}>
              Subject
              <select className={ui.input} name="topicId" value={form.topicId} onChange={onFormChange} required>
                <option value="">Choose subject</option>
                {filteredTopics.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.topicName}
                  </option>
                ))}
              </select>
            </label>

            <label className={ui.formLabel}>
              Topic
              <select className={ui.input} name="subtopicId" value={form.subtopicId} onChange={onFormChange} required>
                <option value="">Choose topic</option>
                {filteredSubtopics.map((subtopic) => (
                  <option key={subtopic.id} value={subtopic.id}>
                    {subtopic.subtopicName}
                  </option>
                ))}
              </select>
            </label>

            <label className={ui.formLabel}>
              Lesson title
              <input className={ui.input} name="lessonTitle" value={form.lessonTitle} onChange={onFormChange} required />
            </label>

            <label className={ui.formLabel}>
              Lesson content
              <textarea className={ui.textarea}
                name="lessonContent"
                rows="7"
                value={form.lessonContent}
                onChange={onFormChange}
                placeholder="Paste lesson notes, revision copy, or rich text content here."
              />
            </label>

            <div className="mb-3 flex flex-wrap items-center gap-2">
              <button type="button" className={ui.secondaryAction} onClick={onBeautify} disabled={beautifying || submitting}>
                {beautifying ? 'Generating Preview...' : 'Generate AI Notes Preview'}
              </button>
              <p>Generate a cleaner study-note version, review it, then apply it if you like it.</p>
            </div>

            <label className={ui.formLabel}>
              Video URL
              <input className={ui.input}
                name="videoUrl"
                value={form.videoUrl}
                onChange={onFormChange}
                placeholder="https://..."
              />
            </label>

            <label className={ui.formLabel}>
              Status
              <select className={ui.input} name="status" value={form.status} onChange={onFormChange}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>

            <label className={ui.checkboxRow}>
              <input className="shrink-0" type="checkbox" name="isFree" checked={form.isFree} onChange={onFormChange} />
              <span>Mark as free content</span>
            </label>

            <div className={ui.buttonRow}>
              <button className={ui.primaryAction} type="submit" disabled={submitting}>
                {submitting ? 'Saving...' : editingId ? 'Update lesson' : 'Save lesson'}
              </button>
              <button type="button" className={ui.secondaryAction} onClick={onClose} disabled={submitting}>
                Cancel
              </button>
            </div>
          </form>

          <section className={lessonPreviewPanelClass}>
            <div className={cx(ui.panelTop, lessonPreviewTopClass)}>
              <div>
                <h2>AI notes preview</h2>
                <p>Preview the beautified lesson before it touches your saved form.</p>
              </div>
            </div>

            {aiPreview ? (
              <div className={aiPreviewShellClass}>
                <div className={aiPreviewSummaryClass}>
                  <span className={ui.eyebrow}>Suggested title</span>
                  <h3>{aiPreview.suggestedTitle || form.lessonTitle || 'Untitled lesson'}</h3>
                  <p>{aiPreview.shortSummary || 'AI generated a cleaner study-note version of your lesson content.'}</p>
                </div>

                <div className={aiPreviewBodyClass}>{aiPreview.beautifiedContent}</div>

                <div className={ui.buttonRow}>
                  <button className={ui.primaryAction} type="button" onClick={onApplyAiPreview}>
                    Apply To Lesson
                  </button>
                  <button type="button" className={ui.secondaryAction} onClick={onClearPreview}>
                    Clear Preview
                  </button>
                </div>
              </div>
            ) : (
              <div className={ui.emptyBox}>
                Paste rough lesson notes, click `Generate AI Notes Preview`, and the beautified version will appear here.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>,
    document.body
  );
}
