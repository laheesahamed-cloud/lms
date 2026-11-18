import { apiClient } from './client.js';
import { createTimedApiCache } from './cache.js';
import { claimBootSlice } from './bootChannel.js';

// 50 per page, newest first: { items, next } (next = the id to continue after).
export const fetchAdminAnnouncements = (after) => apiClient.get('/admin/announcements', { params: after ? { after } : {} }).then((r) => r.data);
export const createAnnouncement = (payload) => apiClient.post('/admin/announcements', payload).then((r) => r.data);
export const updateAnnouncement = (id, payload) => apiClient.patch(`/admin/announcements/${id}`, payload).then((r) => r.data);
export const deleteAnnouncement = (id) => apiClient.delete(`/admin/announcements/${id}`).then((r) => r.data);

// Short-TTL cache: the header bell and the dashboard panel both fetch at
// boot (previously two identical requests); mutations clear it.
const notificationsCache = createTimedApiCache({
  ttlMs: 3600000,
  persistKey: 'student.notifications',
  load: async () =>
    (await claimBootSlice('notifications')) ??
    apiClient.get('/student/notifications').then((r) => r.data),
});

// Read state lives in this browser (OPTIMIZE 10 step 4): the server keeps no
// per-student notification rows, it only serves its small notices feed.
const READ_KEY = 'xyndrome.notices.read';
function readIds() {
  try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]').map(String)); } catch { return new Set(); }
}
function withReadState(list) {
  const read = readIds();
  return Array.isArray(list) ? list.map((item) => ({ ...item, read: Boolean(item?.read) || read.has(String(item?.id)) })) : list;
}

export const fetchNotifications = () => notificationsCache.get().then(withReadState);
export const seedNotifications = (data) => notificationsCache.seed(data);
export const markNotificationRead = async (id) => {
  const read = readIds();
  read.add(String(id));
  // Keep the newest 300 ids (the server's feed only ever holds its last 30).
  const keep = [...read].sort((a, b) => Number(b) - Number(a)).slice(0, 300);
  try { localStorage.setItem(READ_KEY, JSON.stringify(keep)); } catch { /* storage off: nothing to keep */ }
  return { ok: true, id };
};

export const fetchPlannerTasks = () => apiClient.get('/student/planner').then((r) => r.data);
const plannerAgendaCache = createTimedApiCache({
  ttlMs: 3600000,
  persistKey: 'student.agenda',
  load: async () =>
    (await claimBootSlice('agenda')) ??
    apiClient.get('/student/planner/agenda').then((r) => r.data),
});

export const seedPlannerAgenda = (data) => plannerAgendaCache.seed(data);

export const fetchPlannerAgenda = () => plannerAgendaCache.get();
export const readPlannerAgendaCache = () => plannerAgendaCache.peek();
export const createPlannerTask = (payload) => apiClient.post('/student/planner', payload).then((r) => {
  plannerAgendaCache.clear();
  return r.data;
});
export const updatePlannerTask = (id, payload) => apiClient.patch(`/student/planner/${id}`, payload).then((r) => {
  plannerAgendaCache.clear();
  return r.data;
});
export const deletePlannerTask = (id) => apiClient.delete(`/student/planner/${id}`).then((r) => {
  plannerAgendaCache.clear();
  return r.data;
});

export const fetchAdminReports = (params) => apiClient.get('/admin/reports', { params }).then((r) => r.data);

export const createQuestionReport = (payload) => apiClient.post('/student/question-reports', payload).then((r) => r.data);
export const fetchAdminQuestionReports = (params) => apiClient.get('/admin/question-reports', { params }).then((r) => r.data);
export const updateQuestionReport = (id, payload) => apiClient.patch(`/admin/question-reports/${id}`, payload).then((r) => r.data);
