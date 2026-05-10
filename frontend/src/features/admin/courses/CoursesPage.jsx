import { useEffect, useState } from 'react';
import { createCourse, deleteCourse, fetchCourses, updateCourse } from '../../../api/courses.api.js';
import { getErrorMessage } from '../../../api/client.js';
import { AppHeader } from '../../../components/layout/AppHeader.jsx';
import { DeleteActionIcon, EditActionIcon } from '../../../components/ui/ActionIcons.jsx';
import { cx, ui } from '../../../styles/tailwindClasses.js';

const emptyForm = {
  courseTitle: '',
  courseCode: '',
  description: '',
  examType: 'ERPM',
  status: 'active',
};

function CourseModal({ open, editingId, form, submitting, error, onClose, onChange, onSubmit, onReset }) {
  if (!open) {
    return null;
  }

  return (
    <div className={ui.modalBackdrop} onClick={onClose}>
      <div className={ui.entityModal} onClick={(event) => event.stopPropagation()}>
        <div className={ui.entityModalTop}>
          <div>
            <h2 className={ui.entityModalTitle}>{editingId ? 'Edit course' : 'Create course'}</h2>
            <p className={ui.entityModalText}>Manage title, code, exam type, description, and status.</p>
          </div>
          <button type="button" className={ui.subtleIconButton} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {error ? <div className={ui.feedbackError}>{error}</div> : null}

        <form className={ui.stackForm} onSubmit={onSubmit}>
          <label className={ui.formLabel}>
            Course title
            <input className={ui.input} name="courseTitle" value={form.courseTitle} onChange={onChange} required />
          </label>

          <label className={ui.formLabel}>
            Course code
            <input className={ui.input} name="courseCode" value={form.courseCode} onChange={onChange} required />
          </label>

          <label className={ui.formLabel}>
            Description
            <textarea className={ui.textarea} name="description" rows="4" value={form.description} onChange={onChange} />
          </label>

          <label className={ui.formLabel}>
            Exam type
            <input className={ui.input} name="examType" value={form.examType} onChange={onChange} required />
          </label>

          <label className={ui.formLabel}>
            Status
            <select className={ui.input} name="status" value={form.status} onChange={onChange}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>

          <div className={ui.buttonRow}>
            <button className={ui.primaryAction} type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : editingId ? 'Update course' : 'Create course'}
            </button>
            <button type="button" className={ui.secondaryAction} onClick={onReset}>
              {editingId ? 'Cancel edit' : 'Clear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function CoursesPage() {
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadCourses();
  }, []);

  async function loadCourses() {
    setLoading(true);
    setError('');

    try {
      const data = await fetchCourses();
      setCourses(data);
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Unable to load courses'));
    } finally {
      setLoading(false);
    }
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function startEdit(course) {
    setEditingId(course.id);
    setForm({
      courseTitle: course.courseTitle,
      courseCode: course.courseCode,
      description: course.description,
      examType: course.examType,
      status: course.status,
    });
    setModalOpen(true);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function openCreate() {
    resetForm();
    setModalOpen(true);
  }

  function closeModal() {
    if (submitting) {
      return;
    }
    setModalOpen(false);
    resetForm();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      if (editingId) {
        await updateCourse(editingId, form);
      } else {
        await createCourse(form);
      }

      setModalOpen(false);
      resetForm();
      await loadCourses();
    } catch (submitError) {
      setError(getErrorMessage(submitError, 'Unable to save course'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    const confirmed = window.confirm('Delete this course?');
    if (!confirmed) {
      return;
    }

    try {
      await deleteCourse(id);
      if (editingId === id) {
        resetForm();
      }
      await loadCourses();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, 'Unable to delete course'));
    }
  }

  return (
      <main className={ui.screenShell}>
        <section className={ui.managementLayout}>
        <AppHeader
          title="Courses"
          subtitle="Create, update, and organize the course catalog using the current LMS course structure."
        />

        <div className={ui.managementGrid}>
          <section className={ui.panelCard}>
            <div className={ui.panelTop}>
              <div>
                <h2>All courses</h2>
                <p>{loading ? 'Loading course list...' : `${courses.length} course(s) loaded`}</p>
              </div>
              <button className={ui.primaryAction} type="button" onClick={openCreate}>
                + Add course
              </button>
            </div>

            {error ? <div className={ui.feedbackError}>{error}</div> : null}

            <div className={ui.courseList}>
              {loading ? <div className={ui.emptyBox}>Loading courses...</div> : null}
              {!loading && courses.length === 0 ? <div className={ui.emptyBox}>No courses found yet.</div> : null}
              {!loading &&
                courses.map((course) => (
                  <article className={ui.courseRowCard} key={course.id}>
                    <div className={ui.courseRowMain}>
                      <div className={cx(ui.statusDot, course.status === 'active' ? 'bg-brand-success' : 'bg-brand-warning')} />
                      <div className={ui.courseRowCopy}>
                        <h3 className={ui.courseRowTitle}>{course.courseTitle}</h3>
                        <p className={ui.courseRowMeta}>
                          {course.examType} • {course.courseCode}
                        </p>
                        {course.description ? <span className={ui.courseRowText}>{course.description}</span> : null}
                      </div>
                    </div>
                    <div className={ui.iconRow}>
                      <button type="button" className={ui.iconButton} aria-label={`Edit ${course.courseTitle}`} title="Edit course" onClick={() => startEdit(course)}>
                        <EditActionIcon />
                      </button>
                      <button type="button" className={ui.dangerIconButton} aria-label={`Delete ${course.courseTitle}`} title="Delete course" onClick={() => handleDelete(course.id)}>
                        <DeleteActionIcon />
                      </button>
                    </div>
                  </article>
                ))}
            </div>
          </section>
        </div>
        <CourseModal
          open={modalOpen}
          editingId={editingId}
          form={form}
          submitting={submitting}
          error={error}
          onClose={closeModal}
          onChange={handleChange}
          onSubmit={handleSubmit}
          onReset={resetForm}
        />
        </section>
      </main>
  );
}
