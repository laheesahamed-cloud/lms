import { apiClient } from './client.js';

export async function fetchStudyBookmarks() {
  const response = await apiClient.get('/study-bookmarks');
  return response.data;
}

export async function toggleStudyBookmark(payload) {
  const response = await apiClient.post('/study-bookmarks/toggle', payload);
  return response.data;
}
