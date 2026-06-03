import { apiClient } from './client.js';
import { createTimedApiCache } from './cache.js';

const studyBookmarksCache = createTimedApiCache({
  ttlMs: 30000,
  load: () => apiClient.get('/student/bookmarks').then((response) => response.data),
});

export const fetchStudyBookmarks = () => studyBookmarksCache.get();

export const readStudyBookmarksCache = () => studyBookmarksCache.peek();

export function clearStudyBookmarksCache() {
  studyBookmarksCache.clear();
}

export async function toggleStudyBookmark(payload) {
  const response = await apiClient.post('/student/bookmarks/toggle', payload);
  clearStudyBookmarksCache();
  return response.data;
}
