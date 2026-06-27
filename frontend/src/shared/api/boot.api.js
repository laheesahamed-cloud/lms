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
import { getTimedApiCacheEpoch } from './cache.js';
import { setBootPromise, resetBootChannel } from './bootChannel.js';

let primedForUser = null;

export function ensureStudentBoot(userId) {
  const userKey = String(userId ?? 'student');
  if (primedForUser === userKey) return;
  if (primedForUser !== null) resetBootChannel();
  primedForUser = userKey;

  const epochAtStart = getTimedApiCacheEpoch();
  const request = Promise.all([
    apiClient.get('/student/boot', { params: { engine: 'gemini' } }),
    import('./dashboard.api.js'),
    import('./workspace.api.js'),
    import('./quizAttempts.api.js'),
    import('./studyBookmarks.api.js'),
    import('./aiNotes.api.js'),
  ])
    .then(([{ data }, { seedStudentDashboard }, { seedNotifications, seedPlannerAgenda }, { seedStudentQuizzes }, { seedStudyBookmarks }, { seedStudentAiNotes }]) => {
      // a logout while the batch was in flight voids the payload
      if (epochAtStart !== getTimedApiCacheEpoch()) return null;
      seedStudentDashboard(data?.dashboard);
      seedNotifications(data?.notifications);
      seedPlannerAgenda(data?.agenda);
      seedStudentQuizzes(data?.quizzes);
      seedStudyBookmarks(data?.bookmarks);
      seedStudentAiNotes(data?.aiNotes, data?.aiNotesEngine || 'gemini');
      return data;
    })
    .catch(() => null);

  setBootPromise(request);
}

// next login starts a fresh batch (and forgets the old one's slices)
export function resetStudentBoot() {
  primedForUser = null;
  resetBootChannel();
}
