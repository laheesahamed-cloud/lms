import { useAuthStore } from '../stores/authStore.js';

/**
 * Bookmarks live in this browser only (OPTIMIZE 10.25): reading, adding and
 * removing one makes no request. Kept per account in localStorage, with the
 * name, course and subject saved at bookmark time (from the lists the page
 * already holds), newest first — the same shape the server used to send.
 */
function storeKey() {
  const id = useAuthStore.getState()?.user?.id;
  return `lms.bookmarks.${id ?? 'guest'}`;
}

function readAll() {
  try {
    const rows = JSON.parse(window.localStorage.getItem(storeKey()) || '[]');
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function writeAll(rows) {
  try { window.localStorage.setItem(storeKey(), JSON.stringify(rows)); } catch { /* storage full or blocked */ }
}

/** Kept for the old start-up path; bookmarks no longer come from the server. */
export const seedStudyBookmarks = () => {};

export const fetchStudyBookmarks = async () => readAll();

export const readStudyBookmarksCache = () => readAll();

/** Names for a new bookmark from the list already loaded on this page. */
async function describe(itemType, itemId) {
  const id = Number(itemId);
  try {
    const { catalogueQuizzes, catalogueLessons } = await import('./catalogue.api.js');
    if (itemType === 'quiz') {
      const q = (await catalogueQuizzes()).find((x) => Number(x.id) === id);
      if (q) return { title: q.studentTitle || q.quizTitle || '', examModeOnly: Boolean(q.examModeOnly), courseTitle: q.courseTitle || '', topicName: q.subjectName || '' };
    }
    if (itemType === 'ai_note') {
      const l = (await catalogueLessons()).find((x) => Number(x.id) === id);
      if (l) return { title: l.lessonTitle || l.title || '', examModeOnly: false, courseTitle: l.courseTitle || '', topicName: l.topicName || '' };
    }
  } catch { /* names stay empty */ }
  return { title: '', examModeOnly: false, courseTitle: '', topicName: '' };
}

/** Add or remove one bookmark in this browser: `{ ok, saved }` as before. */
export async function toggleStudyBookmark({ itemType, itemId, quizId } = {}) {
  const rows = readAll();
  const at = rows.findIndex((b) => b.itemType === itemType && Number(b.itemId) === Number(itemId));
  if (at >= 0) {
    rows.splice(at, 1);
    writeAll(rows);
    return { ok: true, saved: false };
  }
  const names = await describe(itemType, itemId);
  rows.unshift({
    id: Date.now(), itemType, itemId: Number(itemId), quizId: quizId ? Number(quizId) : null,
    createdAt: new Date().toISOString(), ...names,
  });
  writeAll(rows);
  return { ok: true, saved: true };
}
