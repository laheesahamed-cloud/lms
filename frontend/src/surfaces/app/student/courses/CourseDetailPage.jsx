import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  fetchStudentCourseDetail,
  readStudentCourseDetailCache,
  updateStudentLessonProgress,
} from '../../../../shared/api/courses.api.js';
import { getLessonAiNote, listAiNotes } from '../../../../shared/api/aiNotes.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';
import { FeedbackNotice } from '../../../../shared/ui/FeedbackNotice.jsx';

const COURSE_SUBJECT_PALETTES = [
  { key: 'rose', group: 'warm', match: /(cardio|heart|coronar|arrhythm|myocard)/i, rgb: '214, 91, 145', bg: 'rgba(253, 242, 248, 0.86)', soft: 'rgba(214, 91, 145, 0.13)', border: 'rgba(214, 91, 145, 0.25)', text: '#d65b91' },
  { key: 'teal', group: 'cool', match: /(ha?emat|blood|transfusion|anaemia|anemia)/i, rgb: '43, 169, 155', bg: 'rgba(240, 253, 250, 0.86)', soft: 'rgba(43, 169, 155, 0.13)', border: 'rgba(43, 169, 155, 0.25)', text: '#2ba99b' },
  { key: 'sky', group: 'cool', match: /(resp|lung|pulmo|asthma|copd)/i, rgb: '58, 159, 205', bg: 'rgba(240, 249, 255, 0.86)', soft: 'rgba(58, 159, 205, 0.13)', border: 'rgba(58, 159, 205, 0.25)', text: '#3a9fcd' },
  { key: 'violet', group: 'violet', match: /(neuro|brain|stroke|seizure|parkinson)/i, rgb: '139, 107, 217', bg: 'rgba(245, 243, 255, 0.86)', soft: 'rgba(139, 107, 217, 0.13)', border: 'rgba(139, 107, 217, 0.25)', text: '#8b6bd9' },
  { key: 'green', group: 'green', match: /(rheum|joint|arthritis|ortho|anatomy|bone)/i, rgb: '53, 168, 107', bg: 'rgba(240, 253, 244, 0.86)', soft: 'rgba(53, 168, 107, 0.13)', border: 'rgba(53, 168, 107, 0.25)', text: '#35a86b' },
  { key: 'amber', group: 'warm', match: /(endocr|diabet|thyroid|micro|infect|physio)/i, rgb: '201, 151, 52', bg: 'rgba(254, 252, 232, 0.88)', soft: 'rgba(201, 151, 52, 0.14)', border: 'rgba(201, 151, 52, 0.25)', text: '#c99734' },
  { key: 'indigo', group: 'violet', match: /(renal|kidney|nephro|uro)/i, rgb: '102, 119, 216', bg: 'rgba(238, 242, 255, 0.88)', soft: 'rgba(102, 119, 216, 0.13)', border: 'rgba(102, 119, 216, 0.25)', text: '#6677d8' },
  { key: 'orange', group: 'warm', match: /(surg|path|trauma|emergency)/i, rgb: '207, 125, 60', bg: 'rgba(255, 247, 237, 0.9)', soft: 'rgba(207, 125, 60, 0.14)', border: 'rgba(207, 125, 60, 0.25)', text: '#cf7d3c' },
];

function hashSubjectPalette(label) {
  return [...String(label || 'subject')].reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0);
}

function getBaseSubjectPalette(label) {
  const text = String(label || '');
  return COURSE_SUBJECT_PALETTES.find((palette) => palette.match?.test(text)) ||
    COURSE_SUBJECT_PALETTES[Math.abs(hashSubjectPalette(text)) % COURSE_SUBJECT_PALETTES.length];
}

function buildSubjectPaletteMap(subjects) {
  const assigned = new Map();
  let previousGroup = '';
  let previousKey = '';

  subjects.forEach((subject, index) => {
    let palette = getBaseSubjectPalette(subject.subjectName);
    if ((palette.group === previousGroup || palette.key === previousKey) && COURSE_SUBJECT_PALETTES.length > 1) {
      const start = Math.abs(hashSubjectPalette(`${subject.subjectName}-${index}`)) % COURSE_SUBJECT_PALETTES.length;
      for (let offset = 0; offset < COURSE_SUBJECT_PALETTES.length; offset += 1) {
        const next = COURSE_SUBJECT_PALETTES[(start + offset) % COURSE_SUBJECT_PALETTES.length];
        if (next.group !== previousGroup && next.key !== previousKey) {
          palette = next;
          break;
        }
      }
    }
    assigned.set(subject.id, palette);
    previousGroup = palette.group;
    previousKey = palette.key;
  });

  return assigned;
}

function subjectAccentStyle(palette) {
  return {
    '--course-map-accent-rgb': palette.rgb,
    '--course-map-accent': palette.text,
    '--course-map-accent-bg': palette.bg,
    '--course-map-accent-soft': palette.soft,
    '--course-map-accent-border': palette.border,
  };
}

function LessonGlyph({ lesson }) {
  if (lesson.accessLocked) {
    return (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M6.5 8V6.6a3.5 3.5 0 0 1 7 0V8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <rect x="4.5" y="8" width="11" height="8" rx="2" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }

  if (lesson.status === 'completed') {
    return (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="m5 10 3 3 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (lesson.status === 'in_progress') {
    return (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M4 10h4l2-5 3 10 2-5h1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M6 4.5h8M7 4.5v4.2a4 4 0 1 0 6 0V4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function clampPercent(value) {
  const numeric = Number(value || 0);
  return Math.max(0, Math.min(100, numeric));
}

function formatStatus(status) {
  if (status === 'completed') return '';
  if (status === 'in_progress') return 'In Progress';
  return 'Not Started';
}

function normalizeLookup(value) {
  return String(value || '').trim().toLowerCase();
}

function statusTone(status) {
  if (status === 'completed') return 'border-brand-primary/24 bg-[var(--color-primary-light)] text-brand-primary dark:border-sky-300/22 dark:bg-sky-400/10 dark:text-sky-100';
  if (status === 'in_progress') return 'border-brand-primary/24 bg-[var(--color-primary-light)] text-brand-primary dark:border-cyan-300/24 dark:bg-cyan-300/10 dark:text-cyan-100';
  return 'border-line-medium bg-surface-2 text-ink-soft dark:border-slate-300/14 dark:bg-slate-300/7 dark:text-slate-300';
}

function estimateStudyTime(course) {
  const explicit = Number(course?.totalStudyHours || course?.studyHours || course?.durationHours || 0);
  if (explicit > 0) {
    const minutes = Math.round(explicit * 60);
    return minutes < 60 ? `~${minutes} min` : `~${Math.round(minutes / 60)} hrs`;
  }
  const lessonCount = Number(course?.totalLessonsCount || 0);
  const minutes = lessonCount * 15;
  if (!minutes) return '~0 min';
  if (minutes < 60) return `~${minutes} min`;
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `~${hours} hr${hours === 1 ? '' : 's'}` : `~${hours.toFixed(1)} hrs`;
}

function resolveLessonCanvas(notes, course, lessonContext) {
  const lessonId = String(lessonContext.id);
  const courseTitle = normalizeLookup(course?.courseTitle);
  const subjectName = normalizeLookup(lessonContext.subjectName);
  const topicName = normalizeLookup(lessonContext.topicName);
  const lessonTitle = normalizeLookup(lessonContext.lessonTitle);

  return (
    notes.find((note) => String(note.lessonId || '') === lessonId) ||
    notes.find((note) =>
      normalizeLookup(note.courseTitle) === courseTitle &&
      normalizeLookup(note.topicName) === subjectName &&
      normalizeLookup(note.subtopicName) === topicName &&
      normalizeLookup(note.lessonTitle || note.title) === lessonTitle
    ) ||
    null
  );
}

function noteMatchesCourse(note, course) {
  const noteCourse = normalizeLookup(note?.courseTitle);
  return !noteCourse || noteCourse === normalizeLookup(course?.courseTitle);
}

function findContinueLesson(subjects) {
  const lessons = subjects.flatMap((subject) =>
    subject.topics.flatMap((topic) =>
      topic.lessons.map((lesson) => ({
        lesson,
        subjectId: subject.id,
        topicId: topic.id,
        subjectName: subject.subjectName,
        topicName: topic.topicName,
      }))
    )
  );

  return (
    lessons.find(({ lesson }) => !lesson.accessLocked && lesson.status === 'in_progress') ||
    lessons.find(({ lesson }) => !lesson.accessLocked && lesson.status === 'not_started') ||
    lessons[0] ||
    null
  );
}

function ProgressBar({
  value,
  label = 'Progress',
  className = '',
  fillClassName = 'bg-[var(--brand-gradient-primary)] dark:bg-[linear-gradient(90deg,#6d7cff,#22d3ee)] dark:shadow-none',
}) {
  const progress = clampPercent(value);
  return (
    <div
      className={cx('h-1.5 overflow-hidden rounded-full bg-surface-3 dark:bg-white/[0.09]', className)}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress}
    >
      <span
        className={cx('block h-full rounded-full', fillClassName)}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

function getLessonActionLabel(lesson) {
  if (lesson.accessLocked) return 'View Plans';
  if (lesson.status === 'completed') return 'Review';
  if (lesson.status === 'in_progress') return 'Continue';
  return lesson.actionLabel || 'Start';
}

function getLessonStateLabel(lesson) {
  if (lesson.accessLocked) return 'Locked';
  if (lesson.status === 'completed') return '';
  if (lesson.status === 'in_progress') return 'Current';
  return 'Available';
}

function getLessonAccessMessage(lesson) {
  return lesson.accessMessage || 'Upgrade to access this lesson';
}

function getLessonProgressValue(lesson) {
  if (lesson.accessLocked) return 0;
  if (lesson.status === 'completed') return 100;
  return clampPercent(lesson.progressPercent);
}

function getLessonMetaItems(lesson) {
  const items = [];
  const progress = getLessonProgressValue(lesson);

  if (lesson.accessLocked) {
    items.push(getLessonAccessMessage(lesson));
  } else if (lesson.status === 'completed') {
    items.push('Ready to review');
  } else if (progress > 0) {
    items.push(`${progress}% complete`);
  } else {
    items.push(lesson.duration || '~15 min');
  }

  if (lesson.lessonType) items.push(lesson.lessonType);
  if (lesson.isFree) items.push('Free access');

  return items.slice(0, 2);
}

function getContinueTargetLabel(target) {
  if (!target?.lesson) return '';
  if (target.lesson.accessLocked) return 'View Access Options';
  return target.lesson.status === 'in_progress' ? 'Continue Lesson' : 'Start Next Lesson';
}

function formatCountLabel(count, singular, plural = `${singular}s`) {
  const numeric = Number(count || 0);
  return `${numeric} ${numeric === 1 ? singular : plural}`;
}

const COURSE_RESOURCE_TYPES = new Set(['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'csv', 'txt', 'jpg', 'jpeg', 'png', 'webp', 'mp4', 'webm']);
const ALLOWED_RESOURCE_SCAN_STATES = new Set(['clean', 'verified', 'passed', 'approved']);
const BLOCKED_RESOURCE_SCAN_STATES = new Set(['blocked', 'failed', 'infected', 'unsafe', 'rejected']);

function getSafeCourseResourceUrl(value) {
  const raw = String(value || '').trim();
  if (!raw || raw.includes('\\')) return '';
  if (raw.startsWith('/') && !raw.startsWith('//') && !raw.includes('..')) return raw;

  try {
    const parsed = new URL(raw);
    const isLocalHttp = parsed.protocol === 'http:' && /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(parsed.hostname);
    return parsed.protocol === 'https:' || isLocalHttp ? parsed.toString() : '';
  } catch {
    return '';
  }
}

function toResourceArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getResourceType(resource, url) {
  const explicit = String(resource.fileType || resource.file_type || resource.mimeType || resource.type || '').trim().toLowerCase();
  if (explicit.includes('/')) return explicit.split('/').pop();
  if (explicit) return explicit.replace(/^\./, '');
  const cleanUrl = String(url || '').split('?')[0].split('#')[0];
  const extension = cleanUrl.includes('.') ? cleanUrl.split('.').pop() : '';
  return String(extension || '').toLowerCase();
}

function normalizeCourseResource(resource, index) {
  if (!resource || typeof resource !== 'object') return null;
  const url = getSafeCourseResourceUrl(resource.url || resource.href || resource.fileUrl || resource.downloadUrl || resource.path);
  const name = String(resource.name || resource.title || resource.fileName || resource.filename || `Course resource ${index + 1}`).trim();
  const type = getResourceType(resource, url);
  const scanStatus = String(resource.scanStatus || resource.virusScanStatus || resource.securityStatus || '').trim().toLowerCase();
  const accessAllowed =
    resource.canAccess !== false &&
    resource.accessAllowed !== false &&
    resource.authorized !== false &&
    resource.accessLocked !== true;
  const allowedType = COURSE_RESOURCE_TYPES.has(type);
  const scanAllowed =
    ALLOWED_RESOURCE_SCAN_STATES.has(scanStatus) ||
    (scanStatus && !BLOCKED_RESOURCE_SCAN_STATES.has(scanStatus) && resource.virusScanned === true) ||
    resource.scanned === true;

  return {
    id: resource.id || `${name}-${index}`,
    name,
    url,
    type,
    allowedType,
    accessAllowed,
    scanAllowed,
    disabled: !url || !allowedType || !accessAllowed || !scanAllowed,
    statusLabel: !accessAllowed
      ? 'No access'
      : !allowedType
        ? 'Unsupported'
        : !scanAllowed
          ? 'Scan needed'
          : 'Verified',
  };
}

function getCourseResources(data) {
  const rawResources = [
    data?.resources,
    data?.courseResources,
    data?.downloads,
    data?.attachments,
    data?.course?.resources,
    data?.course?.courseResources,
    data?.course?.downloads,
    data?.course?.attachments,
  ].flatMap(toResourceArray);

  return rawResources
    .map(normalizeCourseResource)
    .filter(Boolean);
}

function CourseResourcesPanel({ resources }) {
  return (
    <section className="course-map-resources" aria-labelledby="course-map-resources-heading">
      <div className="course-map-resources__head">
        <div>
          <span className="course-map-eyebrow">Resources</span>
          <h2 id="course-map-resources-heading">Course Downloads</h2>
        </div>
        <span className="course-map-count">{formatCountLabel(resources.length, 'file')}</span>
      </div>

      {resources.length ? (
        <ol className="course-map-resource-list" aria-label="Course downloads">
          {resources.map((resource) => (
            <li className="course-map-resource-row" key={resource.id}>
              <span className="course-map-resource-type">{resource.type || 'file'}</span>
              <span className="course-map-resource-copy">
                <strong title={resource.name}>{resource.name}</strong>
                <em>{resource.statusLabel}</em>
              </span>
              {resource.disabled ? (
                <span className="course-map-resource-state" aria-label={`${resource.name} is not available`}>
                  Unavailable
                </span>
              ) : (
                <a
                  className="course-map-resource-action"
                  href={resource.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Download ${resource.name}`}
                >
                  Download
                </a>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <div className="course-map-resources__empty">
          No course downloads are published for this course.
        </div>
      )}
    </section>
  );
}

export function CourseDetailPage({
  courseId: courseIdProp,
  initialData = null,
  onBack,
  onDataChange,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const courseId = courseIdProp ?? params.courseId;
  const coursesPath = location.pathname.startsWith('/app') ? '/app/courses' : '/courses';
  const [data, setData] = useState(() => initialData || readStudentCourseDetailCache(courseId) || null);
  const [loading, setLoading] = useState(() => !(initialData || readStudentCourseDetailCache(courseId)));
  const [error, setError] = useState('');
  const [busyLessonId, setBusyLessonId] = useState(null);

  const handleBackToCourses = useCallback(() => {
    if (typeof onBack === 'function') {
      onBack();
      return;
    }

    navigate(coursesPath);
  }, [coursesPath, navigate, onBack]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!courseId) {
        setData(null);
        setLoading(false);
        return;
      }

      const cachedData = initialData || readStudentCourseDetailCache(courseId);
      if (cachedData) {
        setData(cachedData);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      try {
        const response = await fetchStudentCourseDetail(courseId);

        if (cancelled) return;
        setData(response);
      } catch (loadError) {
        if (!cancelled) setError(getErrorMessage(loadError, 'Unable to load course details'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [courseId, initialData]);

  useEffect(() => {
    if (courseId && data) {
      onDataChange?.(courseId, data);
    }
  }, [courseId, data, onDataChange]);

  const course = data?.course || null;
  const subjects = useMemo(() => data?.subjects || [], [data?.subjects]);
  const courseResources = useMemo(() => getCourseResources(data), [data]);
  const continueTarget = useMemo(() => findContinueLesson(subjects), [subjects]);
  const subjectPalettes = useMemo(() => buildSubjectPaletteMap(subjects), [subjects]);

  const overviewStats = useMemo(() => {
    if (!course) return [];
    return [
      { label: 'Subjects', value: course.totalSubjectsCount ?? subjects.length, icon: 'subject' },
      { label: 'Lessons', value: course.totalLessonsCount ?? 0, icon: 'lesson' },
      { label: 'Study Time', value: estimateStudyTime(course), icon: 'time' },
    ];
  }, [course, subjects.length]);

  const applyLessonProgressUpdate = useCallback((targetLessonId, payload) => {
    setData((current) => {
      if (!current) return current;

      const nextSubjects = current.subjects.map((subject) => {
        const nextTopics = subject.topics.map((topic) => {
          const nextLessons = topic.lessons.map((lesson) => {
            if (lesson.id !== targetLessonId) return lesson;

            const progressPercent = clampPercent(payload.progressPercent ?? lesson.progressPercent);
            const status = payload.status || (progressPercent >= 100 ? 'completed' : progressPercent > 0 ? 'in_progress' : lesson.status);
            return {
              ...lesson,
              status,
              progressPercent,
              actionLabel: status === 'completed' ? 'Review' : status === 'in_progress' ? 'Continue' : 'Start',
            };
          });

          const completedLessonsCount = nextLessons.filter((lesson) => lesson.status === 'completed').length;
          const totalLessonsCount = nextLessons.length;
          const progressPercent = totalLessonsCount ? Math.round((completedLessonsCount / totalLessonsCount) * 100) : 0;
          const status =
            totalLessonsCount > 0 && completedLessonsCount === totalLessonsCount
              ? 'completed'
              : nextLessons.some((lesson) => lesson.status !== 'not_started')
                ? 'in_progress'
                : 'not_started';

          return {
            ...topic,
            lessons: nextLessons,
            completedLessonsCount,
            totalLessonsCount,
            progressPercent,
            status,
          };
        });

        const completedLessonsCount = nextTopics.reduce((sum, topic) => sum + topic.completedLessonsCount, 0);
        const totalLessonsCount = nextTopics.reduce((sum, topic) => sum + topic.totalLessonsCount, 0);
        const completedTopicsCount = nextTopics.filter((topic) => topic.totalLessonsCount > 0 && topic.completedLessonsCount === topic.totalLessonsCount).length;
        const totalTopicsCount = nextTopics.length;
        const progressPercent = totalLessonsCount ? Math.round((completedLessonsCount / totalLessonsCount) * 100) : 0;
        const status =
          totalLessonsCount > 0 && completedLessonsCount === totalLessonsCount
            ? 'completed'
            : nextTopics.some((topic) => topic.status !== 'not_started')
              ? 'in_progress'
              : 'not_started';

        return {
          ...subject,
          topics: nextTopics,
          completedLessonsCount,
          totalLessonsCount,
          completedTopicsCount,
          totalTopicsCount,
          progressPercent,
          status,
        };
      });

      const completedLessonsCount = nextSubjects.reduce((sum, subject) => sum + subject.completedLessonsCount, 0);
      const totalLessonsCount = nextSubjects.reduce((sum, subject) => sum + subject.totalLessonsCount, 0);
      const completedSubjectsCount = nextSubjects.filter((subject) => subject.totalLessonsCount > 0 && subject.completedLessonsCount === subject.totalLessonsCount).length;
      const totalSubjectsCount = nextSubjects.length;
      const progressPercent = totalLessonsCount ? Math.round((completedLessonsCount / totalLessonsCount) * 100) : 0;

      return {
        ...current,
        course: {
          ...current.course,
          completedLessonsCount,
          totalLessonsCount,
          completedSubjectsCount,
          totalSubjectsCount,
          progressPercent,
        },
        subjects: nextSubjects,
      };
    });
  }, []);

  useEffect(() => {
    function handleLessonProgress(event) {
      const lessonId = Number(event?.detail?.lessonId || 0);
      if (!lessonId) return;
      applyLessonProgressUpdate(lessonId, {
        status: event.detail?.status,
        progressPercent: event.detail?.progressPercent,
      });
    }

    window.addEventListener('lms:lesson-progress-updated', handleLessonProgress);
    return () => window.removeEventListener('lms:lesson-progress-updated', handleLessonProgress);
  }, [applyLessonProgressUpdate]);

  async function handleOpenLesson(lesson) {
    setBusyLessonId(lesson.id);
    setError('');
    try {
      if (lesson.accessLocked) {
        navigate('/subscriptions', {
          state: {
            lockedFeature: 'lessonsAccess',
            from: coursesPath,
            accessScope: 'lessons',
            lessonIds: [lesson.id],
            selectedCourseId: Number(courseId),
            customSelectionNote: `Selected lesson: ${lesson.lessonTitle}`,
          },
        });
        return;
      }

      let matchingNote = null;
      try {
        matchingNote = await getLessonAiNote(lesson.id);
        if (!noteMatchesCourse(matchingNote, course)) {
          matchingNote = null;
        }
      } catch {
        const noteRows = await listAiNotes().catch(() => []);
        matchingNote = resolveLessonCanvas(noteRows, course, lesson);
      }
      if (!matchingNote) throw new Error('This lesson is being prepared.');

      if (lesson.status === 'not_started') {
        const result = await updateStudentLessonProgress(lesson.id, { status: 'in_progress', progressPercent: 15 });
        applyLessonProgressUpdate(lesson.id, result);
      }

      navigate(`/ai-notes/${matchingNote.id}?view=study`, {
        state: {
          returnToPath: coursesPath,
          returnState: { selectedCourseId: Number(courseId) },
          returnLabel: course?.courseTitle || 'Course',
          courseId: Number(courseId),
          sourceCourse: course?.courseTitle || null,
          sourceSubject: lesson.subjectName || null,
          sourceTopic: lesson.topicName || null,
          lessonId: lesson.id,
        },
      });
    } catch (openError) {
      setError(getErrorMessage(openError, 'Unable to open lesson'));
    } finally {
      setBusyLessonId(null);
    }
  }

  if (loading) {
    return (
      <main className="dashboard-page study-hub-page student-notes-page lms-course-detail-page lms-course-map-page">
        <section className="study-hub-shell course-detail-shell">
          <AppHeader title="Course" subtitle="Lesson Map" />
          <section className="course-map-overview course-map-overview--loading" aria-label="Loading course lesson map">
            <div className="course-map-skeleton course-map-skeleton--title" />
            <div className="course-map-skeleton course-map-skeleton--line" />
            <div className="course-map-skeleton course-map-skeleton--stats" />
          </section>
          <section className="course-map-shell course-map-shell--loading" aria-label="Loading lessons">
            <div className="course-map-skeleton course-map-skeleton--heading" />
            <div className="course-map-skeleton course-map-skeleton--rows" />
          </section>
        </section>
      </main>
    );
  }

  if (!course) {
    return (
      <main className="dashboard-page study-hub-page student-notes-page lms-course-detail-page lms-course-map-page">
        <section className="study-hub-shell course-detail-shell">
          <AppHeader title="Course" subtitle="Lesson Map" />
          <div className="course-map-page-actions">
            <button type="button" className={ui.secondaryAction} onClick={handleBackToCourses}>
              Back to Courses
            </button>
          </div>
          <div className={ui.emptyBox}>Course details are unavailable.</div>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard-page study-hub-page student-notes-page lms-course-detail-page lms-course-map-page">
      <section className="study-hub-shell course-detail-shell">
        <AppHeader title={course.courseTitle} subtitle="Course lesson map" />

        {error ? <FeedbackNotice tone="error">{error}</FeedbackNotice> : null}

        <section className="course-map-overview" aria-labelledby="course-map-title">
          <div className="course-map-overview__copy">
            <span className="course-map-eyebrow">Course</span>
            <h1 id="course-map-title">{course.courseTitle}</h1>
            <p className="course-map-context">
              Course
              <span aria-hidden="true">/</span>
              <strong>{course.courseTitle}</strong>
            </p>
          </div>

          <div className="course-map-progress" aria-label={`${clampPercent(course.progressPercent)} percent complete`}>
            <strong>{clampPercent(course.progressPercent)}%</strong>
            <span>Complete</span>
            <ProgressBar value={course.progressPercent} label={`${course.courseTitle} completion`} className="h-2" />
          </div>

          <div className="course-map-overview__actions">
            <button type="button" className={ui.secondaryAction} onClick={handleBackToCourses}>
              Back to Courses
            </button>
            {continueTarget ? (
              <button
                type="button"
                className={ui.primaryAction}
                onClick={() =>
                  handleOpenLesson({
                    ...continueTarget.lesson,
                    subjectId: continueTarget.subjectId,
                    topicId: continueTarget.topicId,
                    subjectName: continueTarget.subjectName,
                    topicName: continueTarget.topicName,
                  })
                }
                aria-label={
                  continueTarget.lesson.accessLocked
                    ? `${getLessonAccessMessage(continueTarget.lesson)} for ${continueTarget.lesson.lessonTitle}`
                    : `${getContinueTargetLabel(continueTarget)}: ${continueTarget.lesson.lessonTitle}`
                }
              >
                {getContinueTargetLabel(continueTarget)}
              </button>
            ) : null}
          </div>

          <dl className="course-map-stats" aria-label="Course overview">
            {overviewStats.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="course-map-shell" aria-labelledby="course-map-heading">
          <div className="course-map-shell__head">
            <div>
              <span className="course-map-eyebrow">Learning Path</span>
              <h2 id="course-map-heading">Lesson Map</h2>
              <p>
                {formatCountLabel(subjects.length, 'subject')} · {formatCountLabel(course.totalLessonsCount || 0, 'lesson')}
              </p>
            </div>
            <span className="course-map-count">{course.completedLessonsCount || 0} / {course.totalLessonsCount || 0} lessons</span>
          </div>

	          <ol className="course-map-units" aria-label="Course subjects and lesson hierarchy">
            {subjects.map((subject, subjectIndex) => {
              const subjectStatusLabel = formatStatus(subject.status);

              return (
	                <li
	                  className="course-map-unit course-map-unit--simple"
	                  key={subject.id}
	                  aria-labelledby={`course-subject-${subject.id}`}
	                  style={subjectAccentStyle(subjectPalettes.get(subject.id) || COURSE_SUBJECT_PALETTES[0])}
	                >
                <header className="course-map-unit__head">
                  <div className="course-map-unit__title">
                    <span>{subjectIndex + 1}</span>
                    <div>
	                      <h3 id={`course-subject-${subject.id}`}>{subject.subjectName}</h3>
                      <p>{formatCountLabel(subject.totalTopicsCount || subject.topics.length, 'topic')} · {formatCountLabel(subject.totalLessonsCount || 0, 'lesson')}</p>
                    </div>
                  </div>
                  <div className="course-map-unit__progress">
                    {subjectStatusLabel ? <span className={cx('course-map-status', statusTone(subject.status))}>{subjectStatusLabel}</span> : null}
                    <strong>{subject.progressPercent}%</strong>
                    <ProgressBar value={subject.progressPercent} label={`${subject.subjectName} completion`} />
                  </div>
                </header>

                <ol className="course-map-topics" aria-label={`${subject.subjectName} topics`}>
                  {subject.topics.map((topic, topicIndex) => {
                    const topicStatusLabel = formatStatus(topic.status);

                    return (
	                      <li className="course-map-topic" key={`${subject.id}:${topic.id}`} aria-labelledby={`course-topic-${topic.id}`}>
                        <header className="course-map-topic__head">
                          <div>
                            <span>{subjectIndex + 1}.{topicIndex + 1}</span>
	                            <h4 id={`course-topic-${topic.id}`}>{topic.topicName}</h4>
                          </div>
                          <div>
                            {topicStatusLabel ? <span className={cx('course-map-status', statusTone(topic.status))}>{topicStatusLabel}</span> : null}
                            <small>{topic.completedLessonsCount || 0}/{topic.totalLessonsCount || 0} lessons</small>
                          </div>
                        </header>

	                        <ol className="course-map-lessons" aria-label={`${topic.topicName} lessons`}>
                          {topic.lessons.map((lesson, lessonIndex) => {
                            const lessonContext = {
                              ...lesson,
                              subjectId: subject.id,
                              topicId: topic.id,
                              subjectName: subject.subjectName,
                              topicName: topic.topicName,
                            };
                            const stateLabel = getLessonStateLabel(lesson);
                            const lessonProgress = getLessonProgressValue(lesson);
                            const lessonMetaItems = getLessonMetaItems(lesson);
                            const lessonStateId = `lesson-${lesson.id}-state`;
                            const lessonLockReasonId = `lesson-${lesson.id}-lock-reason`;
                            const lessonDescription = [
                              stateLabel ? lessonStateId : '',
                              lesson.accessLocked ? lessonLockReasonId : '',
                            ].filter(Boolean).join(' ') || undefined;

                            return (
                              <li
                                className={cx(
                                  'course-map-lesson-row',
                                  lesson.status === 'completed' && 'is-done',
                                  lesson.status === 'in_progress' && 'is-active',
                                  !lesson.accessLocked && lesson.status === 'not_started' && 'is-available',
                                  lesson.accessLocked && 'is-locked'
                                )}
                                key={lesson.id}
                                aria-current={lesson.status === 'in_progress' ? 'step' : undefined}
                                style={{ '--course-map-lesson-delay': `${Math.min(lessonIndex, 8) * 90}ms` }}
                              >
                                {lesson.accessLocked ? (
                                  <span id={lessonLockReasonId} className="sr-only">
                                    {getLessonAccessMessage(lesson)}
                                  </span>
                                ) : null}
                                <button
                                  type="button"
                                  className="course-map-lesson-title"
                                  onClick={() => handleOpenLesson(lessonContext)}
                                  disabled={busyLessonId === lesson.id || lesson.accessLocked}
                                  aria-describedby={lessonDescription}
                                  aria-label={`${lesson.lessonTitle}. ${stateLabel || 'Completed'}. ${lessonProgress} percent complete.${lesson.accessLocked ? ` ${getLessonAccessMessage(lesson)}` : ''}`}
                                >
                                  <span className="course-map-lesson-order">{subjectIndex + 1}.{topicIndex + 1}.{lessonIndex + 1}</span>
                                  <span className="course-map-lesson-glyph">
                                    <LessonGlyph lesson={lesson} />
                                  </span>
                                  <span className="course-map-lesson-copy">
                                    <strong>{lesson.lessonTitle}</strong>
                                    <span className="course-map-lesson-meta">
                                      {lessonMetaItems.map((item) => (
                                        <em key={item}>{item}</em>
                                      ))}
                                    </span>
                                  </span>
                                </button>

                                {stateLabel ? (
                                  <span id={lessonStateId} className={cx('course-map-status', statusTone(lesson.status))}>{stateLabel}</span>
                                ) : null}

                                <button
                                  type="button"
                                  className="course-map-lesson-action"
                                  onClick={() => handleOpenLesson(lessonContext)}
                                  disabled={busyLessonId === lesson.id}
                                  aria-describedby={lessonDescription}
                                  aria-label={
                                    lesson.accessLocked
                                      ? `${getLessonAccessMessage(lesson)}. View access options for ${lesson.lessonTitle}`
                                      : `${getLessonActionLabel(lesson)} ${lesson.lessonTitle}`
                                  }
                                  title={lesson.accessLocked ? getLessonAccessMessage(lesson) : undefined}
                                >
                                  {busyLessonId === lesson.id ? 'Opening...' : getLessonActionLabel(lesson)}
                                </button>

                                <div
                                  className="course-map-lesson-progress"
                                  role="progressbar"
                                  aria-label={`${lesson.lessonTitle} completion`}
                                  aria-valuemin={0}
                                  aria-valuemax={100}
                                  aria-valuenow={lessonProgress}
                                >
                                  <span style={{ width: `${lessonProgress}%` }} />
                                </div>
                              </li>
                            );
                          })}
                        </ol>
                      </li>
                    );
                  })}
                </ol>
                </li>
              );
            })}
          </ol>
	        </section>
	        <CourseResourcesPanel resources={courseResources} />
	      </section>
	    </main>
  );
}
