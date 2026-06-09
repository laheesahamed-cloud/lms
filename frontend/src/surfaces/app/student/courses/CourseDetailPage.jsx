import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  fetchStudentCourseDetail,
  readStudentCourseDetailCache,
  updateStudentLessonProgress,
} from '../../../../shared/api/courses.api.js';
import { getLessonAiNote, listAiNotes } from '../../../../shared/api/aiNotes.api.js';
import {
  fetchStudentQuizzes,
  fetchStudentResults,
  readStudentQuizzesCache,
  readStudentResultsCache,
} from '../../../../shared/api/quizAttempts.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
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

function subjectAccentStyle(palette) {
  return {
    '--course-map-accent-rgb': palette.rgb,
    '--course-map-accent': palette.text,
    '--course-map-accent-bg': palette.bg,
    '--course-map-accent-soft': palette.soft,
    '--course-map-accent-border': palette.border,
  };
}

function clampPercent(value) {
  const numeric = Number(value || 0);
  return Math.max(0, Math.min(100, numeric));
}

function normalizeLookup(value) {
  return String(value || '').trim().toLowerCase();
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

function getLessonAccessMessage(lesson) {
  return lesson.accessMessage || 'Upgrade to access this lesson';
}

function getLessonProgressValue(lesson) {
  if (lesson.accessLocked) return 0;
  if (lesson.status === 'completed') return 100;
  return clampPercent(lesson.progressPercent);
}

function formatCountLabel(count, singular, plural = `${singular}s`) {
  const numeric = Number(count || 0);
  return `${numeric} ${numeric === 1 ? singular : plural}`;
}

function getAllLessons(subjects) {
  return subjects.flatMap((subject) =>
    (subject.topics || []).flatMap((topic) =>
      (topic.lessons || []).map((lesson) => ({
        ...lesson,
        subjectId: subject.id,
        topicId: topic.id,
        subjectName: subject.subjectName,
        topicName: topic.topicName,
      }))
    )
  );
}

function matchCourseRecord(row, course) {
  if (!course || !row) return false;
  const courseId = Number(course.id || course.courseId || 0);
  const rowCourseId = Number(row.courseId || row.course_id || 0);
  if (courseId && rowCourseId && courseId === rowCourseId) return true;
  const courseTitle = normalizeLookup(course.courseTitle);
  const rowCourseTitle = normalizeLookup(row.courseTitle || row.courseName || row.course);
  return Boolean(courseTitle && rowCourseTitle && courseTitle === rowCourseTitle);
}

function formatAttemptDate(value) {
  if (!value) return 'No attempts yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No attempts yet';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function getWeakExamAreas(results) {
  const groups = new Map();
  results.forEach((result) => {
    const score = Number(result.percentage || result.score || 0);
    const label = String(result.topicDisplay || result.topicName || result.sectionTitle || '').trim();
    if (!label || !Number.isFinite(score) || score >= 60) return;
    const current = groups.get(label) || { label, attempts: 0, total: 0 };
    current.attempts += 1;
    current.total += score;
    groups.set(label, current);
  });

  return [...groups.values()]
    .map((area) => ({
      ...area,
      average: Math.round(area.total / area.attempts),
    }))
    .sort((a, b) => a.average - b.average)
    .slice(0, 3);
}

function getTopicAnalytics(subjects) {
  return subjects.flatMap((subject) =>
    (subject.topics || []).map((topic) => {
      const lessons = topic.lessons || [];
      const totalLessons = Number(topic.totalLessonsCount || lessons.length || 0);
      const completedLessons = Number(topic.completedLessonsCount || lessons.filter((lesson) => lesson.status === 'completed').length || 0);
      const lockedLessons = lessons.filter((lesson) => lesson.accessLocked).length;
      const progress = clampPercent(topic.progressPercent ?? (totalLessons ? (completedLessons / totalLessons) * 100 : 0));
      const hasCurrent = lessons.some((lesson) => lesson.status === 'in_progress');
      const allLocked = totalLessons > 0 && lockedLessons >= totalLessons;
      const nextLesson =
        lessons.find((lesson) => !lesson.accessLocked && lesson.status === 'in_progress') ||
        lessons.find((lesson) => !lesson.accessLocked && lesson.status === 'not_started') ||
        lessons.find((lesson) => !lesson.accessLocked) ||
        lessons[0] ||
        null;
      const status = allLocked
        ? 'Locked'
        : hasCurrent
          ? 'Current'
          : progress >= 80 || (totalLessons > 0 && completedLessons >= totalLessons)
            ? 'Strong'
            : progress <= 35 || completedLessons === 0
              ? 'Needs work'
              : 'Developing';

      return {
        id: `${subject.id}:${topic.id}`,
        subjectId: subject.id,
        topicId: topic.id,
        subjectName: subject.subjectName,
        topicName: topic.topicName,
        totalLessons,
        completedLessons,
        lockedLessons,
        progress,
        status,
        nextLesson: nextLesson ? {
          ...nextLesson,
          subjectId: subject.id,
          topicId: topic.id,
          subjectName: subject.subjectName,
          topicName: topic.topicName,
        } : null,
      };
    })
  );
}

function buildCourseAnalytics(course, subjects, resources, quizzes = [], results = []) {
  const lessons = getAllLessons(subjects);
  const totalLessons = lessons.length || Number(course?.totalLessonsCount || 0);
  const completedLessons = lessons.filter((lesson) => lesson.status === 'completed').length || Number(course?.completedLessonsCount || 0);
  const activeLessons = lessons.filter((lesson) => lesson.status === 'in_progress').length;
  const lockedLessons = lessons.filter((lesson) => lesson.accessLocked).length;
  const freeLessons = lessons.filter((lesson) => lesson.isFree).length;
  const availableLessons = Math.max(0, totalLessons - lockedLessons);
  const notStartedLessons = lessons.filter((lesson) => !lesson.accessLocked && lesson.status === 'not_started').length;
  const startedLessons = lessons.filter((lesson) => lesson.status === 'completed' || lesson.status === 'in_progress').length;
  const examLikeLessons = lessons.filter((lesson) => {
    const haystack = `${lesson.lessonTitle || ''} ${lesson.lessonType || ''} ${lesson.actionLabel || ''}`;
    return /(exam|quiz|practice|assessment|mock|test)/i.test(haystack);
  });
  const linkedQuizzes = (Array.isArray(quizzes) ? quizzes : []).filter((quiz) => matchCourseRecord(quiz, course));
  const linkedQuizIds = new Set(linkedQuizzes.map((quiz) => Number(quiz.id || quiz.quizId || 0)).filter(Boolean));
  const courseResults = (Array.isArray(results) ? results : []).filter((result) => {
    const resultQuizId = Number(result.quizId || result.quiz_id || 0);
    return matchCourseRecord(result, course) || (resultQuizId && linkedQuizIds.has(resultQuizId));
  });
  const scores = courseResults
    .map((result) => Number(result.percentage || result.score || 0))
    .filter((score) => Number.isFinite(score) && score > 0);
  const averageScore = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null;
  const bestScore = scores.length ? Math.round(Math.max(...scores)) : null;
  const lastAttempt = [...courseResults].sort((a, b) =>
    new Date(b.submittedAt || b.createdAt || b.updatedAt || 0).getTime() -
    new Date(a.submittedAt || a.createdAt || a.updatedAt || 0).getTime()
  )[0] || null;
  const weakExamAreas = getWeakExamAreas(courseResults);
  const verifiedResources = resources.filter((resource) => !resource.disabled).length;
  const courseProgress = clampPercent(course?.progressPercent ?? (totalLessons ? (completedLessons / totalLessons) * 100 : 0));
  const accessLabel = lockedLessons > 0
    ? `${availableLessons}/${totalLessons || availableLessons} unlocked`
    : course?.isFree
      ? 'Free access'
      : 'Unlocked';
  const topicAnalytics = getTopicAnalytics(subjects);
  const strongTopics = topicAnalytics.filter((topic) => topic.status === 'Strong');
  const currentTopics = topicAnalytics.filter((topic) => topic.status === 'Current');
  const weakTopics = topicAnalytics
    .filter((topic) => topic.status === 'Needs work' || topic.status === 'Locked')
    .sort((a, b) => a.progress - b.progress)
    .slice(0, 6);
  const recommendationLesson =
    lessons.find((lesson) => !lesson.accessLocked && lesson.status === 'in_progress') ||
    lessons.find((lesson) => !lesson.accessLocked && lesson.status === 'not_started') ||
    lessons.find((lesson) => !lesson.accessLocked && lesson.status === 'completed') ||
    lessons.find((lesson) => lesson.accessLocked) ||
    null;
  const recommendation = recommendationLesson ? {
    lesson: recommendationLesson,
    label: recommendationLesson.accessLocked
      ? 'View Access Options'
      : recommendationLesson.status === 'completed'
        ? 'Review Finished Lesson'
        : recommendationLesson.status === 'in_progress'
          ? 'Continue Lesson'
          : 'Start Next Lesson',
    reason: recommendationLesson.accessLocked
      ? getLessonAccessMessage(recommendationLesson)
      : recommendationLesson.status === 'completed'
        ? 'Everything visible is finished. Review a completed lesson to keep it safe.'
        : recommendationLesson.status === 'in_progress'
          ? `You are ${getLessonProgressValue(recommendationLesson)}% into this lesson.`
          : 'This is the next available unfinished lesson.',
  } : null;

  return {
    totalLessons,
    completedLessons,
    activeLessons,
    lockedLessons,
    freeLessons,
    availableLessons,
    notStartedLessons,
    startedLessons,
    examLikeLessons,
    verifiedResources,
    resourceCount: resources.length,
    courseProgress,
    accessLabel,
    estimatedTime: estimateStudyTime(course),
    topicAnalytics,
    strongTopics,
    currentTopics,
    weakTopics,
    linkedQuizzes,
    courseResults,
    averageScore,
    bestScore,
    lastAttempt,
    weakExamAreas,
    recommendation,
  };
}

function describeStudyTime(lessonCount) {
  const minutes = Math.max(0, Number(lessonCount || 0)) * 15;
  if (!minutes) return null;
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours} hr${hours === 1 ? '' : 's'}` : `${hours.toFixed(1)} hrs`;
}

// Plain-English, one-line read on where the learner stands — built only from real data.
function buildCourseSummary(analytics) {
  const { totalLessons, completedLessons, courseProgress } = analytics;
  if (!totalLessons) return 'No lessons are published for this course yet.';

  const remaining = Math.max(0, totalLessons - completedLessons);
  if (remaining === 0) {
    return `All ${totalLessons} lessons are complete — revisit anything you'd like to keep sharp.`;
  }

  const remainingTime = describeStudyTime(remaining);
  const tail = remainingTime ? ` — about ${remainingTime} of study left` : '';

  if (completedLessons === 0) {
    return `A fresh start: ${totalLessons} lessons ahead${tail}.`;
  }
  return `You're ${courseProgress}% through — ${completedLessons} of ${totalLessons} lessons done, ${remaining} to go${tail}.`;
}

// Short, quiet second line that only appears when there is something worth flagging.
function buildCourseFootnote(analytics) {
  const notes = [];
  if (analytics.activeLessons > 0) {
    notes.push(`${formatCountLabel(analytics.activeLessons, 'lesson')} in progress`);
  }
  if (analytics.lockedLessons > 0) {
    notes.push(`${analytics.lockedLessons} locked behind your plan`);
  }
  if (analytics.averageScore !== null) {
    notes.push(`${analytics.averageScore}% average across ${formatCountLabel(analytics.courseResults.length, 'attempt')}`);
  }
  return notes.join('  ·  ');
}

function StatLine({ value, sub, label }) {
  return (
    <div className="csum-stat">
      <dt>{label}</dt>
      <dd>
        <span className="csum-stat-value">{value}</span>
        {sub ? <span className="csum-stat-sub">{sub}</span> : null}
      </dd>
    </div>
  );
}

function CourseSummaryHead({ course, analytics, eyebrow, onBack, onOpenLesson }) {
  const recommendation = analytics.recommendation;
  const summary = buildCourseSummary(analytics);
  const footnote = buildCourseFootnote(analytics);

  return (
    <header className="csum-head" aria-labelledby="csum-title">
      <span className="csum-eyebrow">{eyebrow}</span>
      <h1 id="csum-title" className="csum-title">{course.courseTitle}</h1>
      <p className="csum-lede">{summary}</p>
      {footnote ? <p className="csum-footnote">{footnote}</p> : null}

      <div className="csum-progress" aria-label={`${analytics.courseProgress} percent complete`}>
        <span
          className="csum-progress-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={analytics.courseProgress}
        >
          <span className="csum-progress-fill" style={{ transform: `scaleX(${analytics.courseProgress / 100})` }} />
        </span>
        <span className="csum-progress-meta">
          <b>{analytics.courseProgress}%</b> complete
        </span>
      </div>

      {recommendation ? (
        <p className="csum-next">
          <span className="csum-next-label">Next up</span>
          <span className="csum-next-title">{recommendation.lesson.lessonTitle}</span>
          <span className="csum-next-reason">{recommendation.reason}</span>
        </p>
      ) : null}

      <div className="csum-actions">
        {recommendation ? (
          <button type="button" className="csum-btn csum-btn--primary" onClick={() => onOpenLesson(recommendation.lesson)}>
            {recommendation.label}
          </button>
        ) : null}
        <button type="button" className="csum-btn csum-btn--ghost" onClick={onBack}>
          Back to courses
        </button>
      </div>
    </header>
  );
}

function CourseStatStrip({ analytics, subjectCount }) {
  const remaining = Math.max(0, analytics.totalLessons - analytics.completedLessons);
  const stats = [
    { label: 'Lessons done', value: analytics.completedLessons, sub: `of ${analytics.totalLessons}` },
    { label: 'In progress', value: analytics.activeLessons },
    { label: 'Left to do', value: remaining },
    { label: 'Locked', value: analytics.lockedLessons },
    { label: 'Subjects', value: subjectCount },
    { label: 'Study time', value: analytics.estimatedTime.replace('~', '') },
  ];
  return (
    <dl className="csum-stats" aria-label="Course at a glance">
      {stats.map((item) => (
        <StatLine key={item.label} value={item.value} sub={item.sub} label={item.label} />
      ))}
    </dl>
  );
}

function ProgressBreakdown({ analytics }) {
  const segments = [
    { key: 'finished', label: 'Finished', value: analytics.completedLessons, tone: 'done' },
    { key: 'active', label: 'In progress', value: analytics.activeLessons, tone: 'active' },
    { key: 'remaining', label: 'Not started', value: analytics.notStartedLessons, tone: 'remaining' },
    { key: 'locked', label: 'Locked', value: analytics.lockedLessons, tone: 'locked' },
  ];
  const total = Math.max(analytics.totalLessons, 1);

  return (
    <section className="csum-section" aria-labelledby="csum-breakdown-title">
      <div className="csum-section-head">
        <h2 id="csum-breakdown-title">Progress breakdown</h2>
      </div>
      <div className="csum-bar" aria-hidden="true">
        {segments.filter((segment) => segment.value > 0).map((segment) => (
          <span key={segment.key} className={`is-${segment.tone}`} style={{ flexGrow: segment.value / total }} />
        ))}
      </div>
      <ul className="csum-bar-legend">
        {segments.map((segment) => (
          <li key={segment.key}>
            <i className={`is-${segment.tone}`} aria-hidden="true" />
            <span>{segment.label}</span>
            <b>{segment.value}</b>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PracticeSection({ analytics }) {
  const hasQBank = analytics.linkedQuizzes.length || analytics.courseResults.length;
  return (
    <section className="csum-section" aria-labelledby="csum-practice-title">
      <div className="csum-section-head">
        <h2 id="csum-practice-title">Practice &amp; exams</h2>
        {hasQBank ? (
          <span className="csum-section-note">
            Last attempt {formatAttemptDate(analytics.lastAttempt?.submittedAt || analytics.lastAttempt?.createdAt)}
          </span>
        ) : null}
      </div>

      {hasQBank ? (
        <>
          <dl className="csum-stats csum-stats--inline">
            <StatLine label="Attempts" value={analytics.courseResults.length} />
            <StatLine label="Average" value={analytics.averageScore === null ? '—' : `${analytics.averageScore}%`} />
            <StatLine label="Best" value={analytics.bestScore === null ? '—' : `${analytics.bestScore}%`} />
            <StatLine label="Linked sets" value={analytics.linkedQuizzes.length} />
          </dl>
          {analytics.weakExamAreas.length ? (
            <ul className="csum-tags">
              {analytics.weakExamAreas.map((area) => (
                <li key={area.label} className="csum-tag is-weak">
                  <b>{area.average}%</b>
                  {area.label}
                </li>
              ))}
            </ul>
          ) : (
            <p className="csum-quiet">No weak exam areas yet — keep practising to surface them here.</p>
          )}
        </>
      ) : (
        <p className="csum-quiet">No quiz or exam data is linked to this course yet. Completed attempts will show your average, best score and weak areas here.</p>
      )}
    </section>
  );
}

function FocusTopics({ analytics, onOpenLesson }) {
  const rows = [
    ...analytics.currentTopics,
    ...analytics.weakTopics,
    ...analytics.strongTopics.slice(0, 3),
  ].filter((topic, index, list) => list.findIndex((item) => item.id === topic.id) === index).slice(0, 8);

  return (
    <section className="csum-section" aria-labelledby="csum-focus-title">
      <div className="csum-section-head">
        <h2 id="csum-focus-title">Where to focus</h2>
        <span className="csum-section-note">{formatCountLabel(rows.length, 'topic')}</span>
      </div>
      {rows.length ? (
        <ul className="csum-rows">
          {rows.map((topic) => (
            <li className={`csum-row is-${topic.status.toLowerCase().replace(/\s+/g, '-')}`} key={topic.id}>
              <span className="csum-row-dot" aria-hidden="true" />
              <span className="csum-row-copy">
                <strong>{topic.topicName}</strong>
                <small>{topic.subjectName} · {topic.completedLessons}/{topic.totalLessons} lessons</small>
              </span>
              <span className="csum-row-meter">
                <span className="csum-line"><span style={{ transform: `scaleX(${topic.progress / 100})` }} /></span>
                <span className="csum-row-figure"><b>{topic.progress}%</b><em>{topic.status}</em></span>
              </span>
              {topic.nextLesson ? (
                <button type="button" className="csum-open" onClick={() => onOpenLesson(topic.nextLesson)}>
                  Open
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="csum-quiet">No topic progress is available yet.</p>
      )}
    </section>
  );
}

function SubjectList({ subjects, analytics, onOpenLesson }) {
  return (
    <section className="csum-section" aria-labelledby="csum-subjects-title">
      <div className="csum-section-head">
        <h2 id="csum-subjects-title">Subjects</h2>
        <span className="csum-section-note">{formatCountLabel(subjects.length, 'subject')}</span>
      </div>
      <ul className="csum-rows">
        {subjects.map((subject) => {
          const topics = analytics.topicAnalytics.filter((topic) => topic.subjectId === subject.id);
          const nextTopic = topics.find((topic) => topic.nextLesson && topic.status === 'Current') ||
            topics.find((topic) => topic.nextLesson && topic.status === 'Needs work') ||
            topics.find((topic) => topic.nextLesson);
          const progress = clampPercent(subject.progressPercent);
          const status = progress >= 80 ? 'Strong' : progress <= 35 ? 'Needs work' : 'Developing';
          return (
            <li
              className="csum-row csum-row--subject"
              key={subject.id}
              style={subjectAccentStyle(getBaseSubjectPalette(subject.subjectName))}
            >
              <span className="csum-row-marker" aria-hidden="true" />
              <span className="csum-row-copy">
                <strong>{subject.subjectName}</strong>
                <small>{formatCountLabel(subject.totalTopicsCount || subject.topics?.length || 0, 'topic')} · {subject.completedLessonsCount || 0}/{subject.totalLessonsCount || 0} lessons</small>
              </span>
              <span className="csum-row-meter">
                <span className="csum-line is-accent"><span style={{ transform: `scaleX(${progress / 100})` }} /></span>
                <span className="csum-row-figure"><b>{progress}%</b><em>{status}</em></span>
              </span>
              {nextTopic?.nextLesson ? (
                <button type="button" className="csum-open" onClick={() => onOpenLesson(nextTopic.nextLesson)}>
                  Open
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
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

function ResourceList({ resources }) {
  return (
    <section className="csum-section" aria-labelledby="csum-resources-title">
      <div className="csum-section-head">
        <h2 id="csum-resources-title">Downloads</h2>
        <span className="csum-section-note">{formatCountLabel(resources.length, 'file')}</span>
      </div>

      {resources.length ? (
        <ul className="csum-rows csum-rows--resources" aria-label="Course downloads">
          {resources.map((resource) => (
            <li className="csum-row csum-row--resource" key={resource.id}>
              <span className="csum-row-type">{resource.type || 'file'}</span>
              <span className="csum-row-copy">
                <strong title={resource.name}>{resource.name}</strong>
                <small>{resource.statusLabel}</small>
              </span>
              {resource.disabled ? (
                <span className="csum-row-state" aria-label={`${resource.name} is not available`}>
                  Unavailable
                </span>
              ) : (
                <a
                  className="csum-open"
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
        </ul>
      ) : (
        <p className="csum-quiet">No course downloads are published for this course.</p>
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
  const [studentQuizzes, setStudentQuizzes] = useState(() => readStudentQuizzesCache() || []);
  const [studentResults, setStudentResults] = useState(() => readStudentResultsCache() || []);
  const courseAnalytics = useMemo(
    () => buildCourseAnalytics(course, subjects, courseResources, studentQuizzes, studentResults),
    [course, subjects, courseResources, studentQuizzes, studentResults]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadAssessmentData() {
      const [quizRows, resultRows] = await Promise.all([
        fetchStudentQuizzes().catch(() => readStudentQuizzesCache() || []),
        fetchStudentResults().catch(() => readStudentResultsCache() || []),
      ]);

      if (cancelled) return;
      setStudentQuizzes(Array.isArray(quizRows) ? quizRows : []);
      setStudentResults(Array.isArray(resultRows) ? resultRows : []);
    }

    loadAssessmentData();
    return () => {
      cancelled = true;
    };
  }, []);

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
    }
  }

  if (loading) {
    return (
      <main className="dashboard-page study-hub-page lms-course-detail-page lms-course-summary-page">
        <section className="study-hub-shell course-detail-shell">
          <AppHeader title="Course" subtitle="Summary" />
          <div className="csum-loading" aria-label="Loading course summary">
            <div className="csum-skeleton csum-skeleton--title" />
            <div className="csum-skeleton csum-skeleton--line" />
            <div className="csum-skeleton csum-skeleton--bar" />
            <div className="csum-skeleton csum-skeleton--rows" />
          </div>
        </section>
      </main>
    );
  }

  if (!course) {
    return (
      <main className="dashboard-page study-hub-page lms-course-detail-page lms-course-summary-page">
        <section className="study-hub-shell course-detail-shell">
          <AppHeader title="Course" subtitle="Summary" />
          <div className="csum-actions">
            <button type="button" className="csum-btn csum-btn--ghost" onClick={handleBackToCourses}>
              Back to courses
            </button>
          </div>
          <p className="csum-quiet">Course details are unavailable.</p>
        </section>
      </main>
    );
  }

  const eyebrow = subjects[0]?.subjectName
    ? `${subjects[0].subjectName}${subjects.length > 1 ? ` +${subjects.length - 1} more` : ''}`
    : 'Course summary';

  return (
    <main className="dashboard-page study-hub-page lms-course-detail-page lms-course-summary-page">
      <section className="study-hub-shell course-detail-shell csum-shell">
        <AppHeader title={course.courseTitle} subtitle="Summary" />

        {error ? <FeedbackNotice tone="error">{error}</FeedbackNotice> : null}

        <div className="csum-card">
          <CourseSummaryHead
            course={course}
            analytics={courseAnalytics}
            eyebrow={eyebrow}
            onBack={handleBackToCourses}
            onOpenLesson={handleOpenLesson}
          />

          <CourseStatStrip analytics={courseAnalytics} subjectCount={subjects.length} />
          <ProgressBreakdown analytics={courseAnalytics} />
          <PracticeSection analytics={courseAnalytics} />
          <FocusTopics analytics={courseAnalytics} onOpenLesson={handleOpenLesson} />
          <SubjectList subjects={subjects} analytics={courseAnalytics} onOpenLesson={handleOpenLesson} />
          <ResourceList resources={courseResources} />
        </div>
      </section>
    </main>
  );
}
