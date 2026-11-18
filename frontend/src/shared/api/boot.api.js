// Student boot batch (R3 Task 26): one GET /student/boot replaces the six
// read-only requests every student session fires at boot (dashboard,
// notifications, planner agenda, quizzes, bookmarks, ai-notes). Two paths
// consume it:
//   1. in-flight: the per-module caches claim their slice via bootChannel
//      instead of fetching (covers loads that race the batch);
//   2. arrival: every slice is seeded into its module cache for pages
//      visited within the cache TTLs.
// Any null slice (a panel that errored server-side) simply isn't seeded and
// the standalone endpoint takes over — worst case is exactly the old
// behavior, plus one extra request.
import { apiClient } from './client.js';
import { setStudentAccess, setStudentProgress, takeStartPayload } from '../stores/studentAccess.js';
import { getTimedApiCacheEpoch } from './cache.js';
import { setBootPromise, resetBootChannel } from './bootChannel.js';

let primedForUser = null;

export function ensureStudentBoot(userId) {
  const userKey = String(userId ?? 'student');
  if (primedForUser === userKey) return;
  if (primedForUser !== null) resetBootChannel();
  primedForUser = userKey;

  // 10.22: the Study Hub the app's way — the start-up reply (already fetched
  // when the page loaded: account, token, Study Hub top with course cards,
  // progress, results) plus the light lower cards. The question of the day
  // comes from the free quiz file. The old GET /student/boot is not used.
  const epochAtStart = getTimedApiCacheEpoch();
  const request = (async () => {
    let start = takeStartPayload();
    if (!start) {
      const { fetchAppStart } = await import('./auth.api.js');
      start = await fetchAppStart({ silent: true }).catch(() => null);
      if (start?.user?.role === 'student' && start.accessToken) setStudentAccess(start.accessToken);
      if (start?.progress) setStudentProgress(start.progress);
    }
    const [{ seedStudentDashboard }, { seedStudentResults }, { pickQuestionOfDay }, { seedNotifications }] = await Promise.all([
      import('./dashboard.api.js'),
      import('./quizAttempts.api.js'),
      import('./samples.api.js'),
      import('./workspace.api.js'),
    ]);
    const [more, questionOfDay] = await Promise.all([
      apiClient.get('/student/dashboard/more', { params: { lite: 1 } }).then((r) => r.data).catch(() => ({})),
      pickQuestionOfDay(userId).catch(() => null),
    ]);
    if (epochAtStart !== getTimedApiCacheEpoch()) return null; // signed out meanwhile
    const results = seedStudentResults(Array.isArray(start?.results) ? start.results : []);
    const recentAttempts = results.slice(0, 5).map((r) => ({
      id: r.attemptId,
      quizTitle: r.quizTitle,
      quizNumber: r.quizNumber || 0,
      displayTitleMode: r.displayTitleMode || 'title',
      courseTitle: r.courseTitle || '',
      topicName: r.topicDisplay || '',
      score: r.score,
      totalQuestions: Number(r.correctAnswers || 0) + Number(r.wrongAnswers || 0) || null,
      percentage: Number(r.percentage || 0),
      passStatus: r.passStatus,
      submittedAt: r.submittedAt,
    }));
    const dashboard = start?.dashboard ? { ...start.dashboard, ...more, recentAttempts, questionOfDay } : null;
    if (dashboard) seedStudentDashboard(dashboard);
    // 10.48: the notices feed comes in the start-up reply; no separate
    // GET /student/notifications for the bell and the inbox.
    const notifications = Array.isArray(start?.notices?.items) ? start.notices.items : undefined;
    if (notifications) seedNotifications(notifications);
    return { dashboard, results: Array.isArray(start?.results) ? start.results : undefined, notifications };
  })().catch(() => null);

  setBootPromise(request);
}

// next login starts a fresh batch (and forgets the old one's slices)
export function resetStudentBoot() {
  primedForUser = null;
  resetBootChannel();
}
