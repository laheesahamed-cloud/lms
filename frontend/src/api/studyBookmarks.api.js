import { apiClient } from './client.js';

export async function fetchStudyBookmarks() {
  const response = await apiClient.get('/student/bookmarks');
  return response.data;
}

export async function toggleStudyBookmark(payload) {
  const response = await apiClient.post('/student/bookmarks/toggle', payload);
  return response.data;
}
