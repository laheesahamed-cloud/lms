import { apiClient } from './client.js';
import { getStudentProgress } from '../stores/studentAccess.js';
import { fetchSamplesIndex } from './samples.api.js';

/**
 * The same list the app uses (OPTIMIZE 10.23 L1 / L2 / W7): every lesson and
 * quiz title with course, subject and topic — no lesson text, no questions.
 * Built by the server once per content version; 0 database work per student.
 *
 *  - The small index (courses + one fingerprint per course part) is asked with
 *    its version; "unchanged" answers carry no body.
 *  - Each screen downloads only its kind: Lessons → lesson parts, Q-Bank →
 *    quiz parts — and only the courses whose fingerprint changed.
 *
 * Locked items are listed with a lock; opening one shows "Continue in the
 * app" with no request (the free files decide what opens here).
 */
// The index keeps format 4; the lessons / quizzes parts are format 5 (10.25).
const FORMAT = 4;
const PARTS_FORMAT = 5;
const STORE = `lms.catalogue.f${PARTS_FORMAT}`;
try { window.localStorage.removeItem(`lms.catalogue.f${FORMAT}`); } catch { /* storage blocked */ }

/**
 * A format-5 part as the rows this file reads (format 4): ids arrive as the
 * gap from the row before (added back up here), and quiz rows arrive with one
 * name and no number fields. A format-4 part (older server) is kept as it is.
 */
function widenPart(part, format) {
  if (format < PARTS_FORMAT) return part;
  const ungap = (rows) => {
    let id = 0;
    return (rows || []).map((r) => { id += Number(r[0]); return [id, ...r.slice(1)]; });
  };
  const quizzes = ungap(part.quizzes).map((q) => [q[0], q[1], q[2], q[3], q[4], q[5], q[6], q[7], q[8], q[8], 0, 0, q[9], q[10], q[11], q[12], q[13] ?? 1]);
  quizzes.sort((a, b) => b[0] - a[0]); // newest first, as the list shows them
  return { ...part, lessons: ungap(part.lessons), quizzes };
}
const memory = { index: null, parts: { lessons: new Map(), quizzes: new Map() } };
let indexRequest = null;

function readStore() {
  try { return JSON.parse(window.localStorage.getItem(STORE) || 'null') || {}; } catch { return {}; }
}
function writeStore(value) {
  try { window.localStorage.setItem(STORE, JSON.stringify(value)); } catch { /* storage full or blocked */ }
}

async function loadIndex() {
  if (memory.index) return memory.index;
  if (!indexRequest) {
    indexRequest = (async () => {
      const saved = readStore();
      const headers = saved.index ? { 'If-None-Match': `"catalogue-index-v${saved.index.v}-f${FORMAT}"` } : {};
      const response = await apiClient.get('/student/catalogue/index', {
        headers, validateStatus: (s) => s === 200 || s === 304, __skipNetworkActivity: true,
      });
      const index = response.status === 304 && saved.index ? saved.index : response.data;
      writeStore({ ...saved, index });
      memory.index = index;
      return index;
    })().finally(() => { indexRequest = null; });
  }
  return indexRequest;
}

/** The parts of one kind for every course, downloading only changed ones. */
async function loadKind(kind) {
  const index = await loadIndex();
  const hashes = (kind === 'lessons' ? index.lessonParts : index.quizParts) || {};
  const saved = readStore();
  const kept = saved[kind] || {};
  const out = memory.parts[kind];
  const need = [];
  for (const [id, hash] of Object.entries(hashes)) {
    if (out.get(id)?.hash === hash) continue;
    if (kept[id]?.hash === hash) { out.set(id, kept[id]); continue; }
    need.push(id);
  }
  if (need.length) {
    const response = await apiClient.get('/student/catalogue/parts', {
      params: { courses: need.join(','), kind }, __skipNetworkActivity: true,
    });
    const format = Number(response.data?.f || FORMAT);
    for (const raw of response.data?.parts || []) {
      const part = widenPart(raw, format);
      const id = String(part.course);
      const entry = { hash: hashes[id], part };
      out.set(id, entry);
      kept[id] = entry;
    }
    writeStore({ ...readStore(), [kind]: kept });
  }
  return { index, parts: [...out.values()].map((e) => e.part) };
}

function names(index, parts) {
  const course = new Map((index.courses || []).map((c) => [Number(c[0]), { title: c[1], examType: c[3] }]));
  const subject = new Map(), topic = new Map();
  for (const p of parts) {
    for (const s of p.subjects || []) subject.set(Number(s[0]), s[2]);
    for (const t of p.topics || []) topic.set(Number(t[0]), t[2]);
  }
  return { course, subject, topic };
}

function lessonBits() {
  const raw = getStudentProgress()?.lessonsBits;
  if (!raw) return null;
  try { return Uint8Array.from(atob(raw), (c) => c.charCodeAt(0)); } catch { return null; }
}
function quizBytes() {
  const raw = getStudentProgress()?.quizMarks;
  if (!raw) return null;
  try { return Uint8Array.from(atob(raw), (c) => c.charCodeAt(0)); } catch { return null; }
}
function localDone() {
  try { return new Set((JSON.parse(window.localStorage.getItem('lms.sample.lessonsDone') || '[]') || []).map(Number)); } catch { return new Set(); }
}

const APP_ONLY_REASON = 'This lesson works in the Xyndrome app.';

/** Every ready lesson (website lessons list shape); locked ones carry a lock. */
export async function catalogueLessons() {
  const [{ index, parts }, samples] = await Promise.all([loadKind('lessons'), fetchSamplesIndex().catch(() => null)]);
  const free = new Set((samples?.courses || []).flatMap((c) => c.lessons || []).map((l) => Number(l.id)));
  const n = names(index, parts);
  const bits = lessonBits();
  const done = localDone();
  const out = [];
  for (const p of parts) {
    for (const l of p.lessons || []) {
      const [id, courseId, subjectId, topicId, title, , hasNote, hasPdf, hasVideo, cards] = l;
      if (!hasNote && !hasPdf) continue; // not ready to read yet
      const open = free.has(Number(id));
      const finished = done.has(Number(id)) || Boolean(bits && bits.length > (id >> 3) && (bits[id >> 3] & (1 << (id & 7))));
      const c = n.course.get(Number(courseId)) || {};
      out.push({
        id, title, lessonTitle: title, lessonId: id, engineKey: 'gemini',
        courseId, topicId: subjectId || null, subtopicId: topicId || null,
        courseTitle: c.title || null, examType: c.examType || null,
        topicName: n.subject.get(Number(subjectId)) || null, subtopicName: n.topic.get(Number(topicId)) || null,
        isFree: open, videoUrl: hasVideo ? 'video' : '', pdfUrl: hasPdf && !hasNote ? 'pdf' : '', lessonPdfUrl: hasPdf && !hasNote ? 'pdf' : '',
        approvedFlashcardCount: Number(cards || 0), cardCount: Number(cards || 0),
        lessonCompleted: finished, lessonProgressStatus: finished ? 'completed' : 'not_started', lessonProgressPercent: finished ? 100 : 0,
        canAccess: open, accessLocked: !open, showLock: !open, appOnly: !open,
        lockReason: open ? '' : APP_ONLY_REASON, upgradeLabel: open ? '' : 'Open in the app',
      });
    }
  }
  return out;
}

/**
 * Course progress the app's way (OPTIMIZE 10.49): each course's lessons from
 * the catalogue checked against the student's finished-lessons bitmap (from
 * the start-up progress) — no server work. Same shape the Study Hub used.
 */
export async function catalogueCourseProgress() {
  const { index, parts } = await loadKind('lessons');
  const bits = lessonBits();
  const done = localDone();
  const isDone = (id) => done.has(Number(id)) || Boolean(bits && bits.length > (id >> 3) && (bits[id >> 3] & (1 << (id & 7))));
  const lessonsByCourse = new Map();
  const subjectsByCourse = new Map();
  for (const p of parts) {
    for (const l of p.lessons || []) {
      const courseId = Number(l[1]);
      if (!lessonsByCourse.has(courseId)) lessonsByCourse.set(courseId, []);
      lessonsByCourse.get(courseId).push(Number(l[0]));
    }
    for (const sub of p.subjects || []) subjectsByCourse.set(Number(sub[1]), (subjectsByCourse.get(Number(sub[1])) || 0) + 1);
  }
  let completedLessons = 0;
  let totalLessons = 0;
  const courseProgress = (index.courses || []).map((c) => {
    const id = Number(c[0]);
    const lessons = lessonsByCourse.get(id) || [];
    const completed = lessons.filter(isDone).length;
    completedLessons += completed;
    totalLessons += lessons.length;
    const progressPercent = lessons.length ? Math.round((completed / lessons.length) * 100) : 0;
    return {
      id,
      courseTitle: String(c[1] || ''),
      courseCode: String(c[2] || ''),
      examType: String(c[3] || ''),
      subjectCount: subjectsByCourse.get(id) || 0,
      progressPercent,
      completedLessonsCount: completed,
      totalLessonsCount: lessons.length,
      actionLabel: progressPercent > 0 && progressPercent < 100 && lessons.length ? 'Continue' : 'View Course',
    };
  });
  return {
    totalCourses: courseProgress.length,
    courseProgress,
    courseProgressSummary: {
      visibleCourses: courseProgress.length,
      completedLessons,
      totalLessons,
      overallProgressPercent: totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0,
      sourceLabel: 'Course lesson progress',
    },
  };
}

/** Every active quiz (website Q-Bank list shape); locked ones carry a lock. */
export async function catalogueQuizzes() {
  const [{ index, parts }, samples] = await Promise.all([loadKind('quizzes'), fetchSamplesIndex().catch(() => null)]);
  const free = new Set((samples?.courses || []).flatMap((c) => c.quizzes || []).map((q) => Number(q.id)));
  const n = names(index, parts);
  const bytes = quizBytes();
  const out = [];
  for (const p of parts) {
    for (const q of p.quizzes || []) {
      const [id, courseId, subjectId, topicId, lessonId, isGeneral, examOnly, , studentTitle, quizTitle, , , total, timeLimit, passing, dynamic] = q;
      const open = free.has(Number(id));
      const byte = bytes && bytes.length > id ? bytes[id] : 0;
      const c = n.course.get(Number(courseId)) || {};
      const subjectName = n.subject.get(Number(subjectId)) || (isGeneral ? 'General / Full Course Revision' : '');
      out.push({
        id, courseId, topicId: subjectId || null, subtopicId: topicId || null, lessonId: lessonId || null,
        subtopic: '', isGeneral: Boolean(isGeneral), examModeOnly: Boolean(examOnly),
        // One name per quiz (10.25): no number display.
        quizTitle: studentTitle || quizTitle, studentTitle: studentTitle || quizTitle, displayTitleMode: 'title',
        quizNumber: null, quizDescription: '', totalQuestions: Number(total || 0), totalMarks: 100,
        timeLimit: Number(timeLimit || 0), hideTimeLimit: false, passingMarks: Number(passing || 45), hidePassingMarks: false,
        courseTitle: c.title || '', examType: c.examType || '',
        subjectName, topicName: n.topic.get(Number(topicId)) || '', subtopicName: n.topic.get(Number(topicId)) || '', lessonTitle: '',
        examAttemptCount: byte ? 1 : 0, latestAttemptId: null,
        bestPercentage: byte ? (byte & 127) - 1 : null, passed: Boolean(byte & 128), isCompleted: Boolean(byte),
        isFree: open, randomizationMode: dynamic ? 'dynamic' : 'static',
        canAccess: open, accessLocked: !open, accessMessage: open ? '' : 'This set works in the Xyndrome app.',
        canPracticeMode: open, canExamMode: open,
      });
    }
  }
  return out;
}
