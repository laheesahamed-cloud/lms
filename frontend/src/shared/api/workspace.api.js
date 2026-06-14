import { apiClient } from './client.js';
import { createTimedApiCache } from './cache.js';
import { claimBootSlice } from './bootChannel.js';

export const fetchAdminAnnouncements = () => apiClient.get('/admin/announcements').then((r) => r.data);
export const createAnnouncement = (payload) => apiClient.post('/admin/announcements', payload).then((r) => r.data);
export const updateAnnouncement = (id, payload) => apiClient.patch(`/admin/announcements/${id}`, payload).then((r) => r.data);
export const deleteAnnouncement = (id) => apiClient.delete(`/admin/announcements/${id}`).then((r) => r.data);

// Short-TTL cache: the header bell and the dashboard panel both fetch at
// boot (previously two identical requests); mutations clear it.
const notificationsCache = createTimedApiCache({
  ttlMs: 15000,
  persistKey: 'student.notifications',
  load: async () =>
    (await claimBootSlice('notifications')) ??
    apiClient.get('/student/notifications').then((r) => r.data),
});

export const fetchNotifications = () => notificationsCache.get();
export const seedNotifications = (data) => notificationsCache.seed(data);
export const markNotificationRead = (id) => apiClient.post(`/student/notifications/${id}/read`).then((r) => {
  notificationsCache.clear();
  return r.data;
});

export const fetchPlannerTasks = () => apiClient.get('/student/planner').then((r) => r.data);
const plannerAgendaCache = createTimedApiCache({
  ttlMs: 15000,
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
