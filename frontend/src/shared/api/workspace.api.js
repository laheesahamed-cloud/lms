import { apiClient } from './client.js';

export const fetchAdminAnnouncements = () => apiClient.get('/admin/announcements').then((r) => r.data);
export const createAnnouncement = (payload) => apiClient.post('/admin/announcements', payload).then((r) => r.data);
export const updateAnnouncement = (id, payload) => apiClient.patch(`/admin/announcements/${id}`, payload).then((r) => r.data);
export const deleteAnnouncement = (id) => apiClient.delete(`/admin/announcements/${id}`).then((r) => r.data);

export const fetchNotifications = () => apiClient.get('/student/notifications').then((r) => r.data);
export const markNotificationRead = (id) => apiClient.post(`/student/notifications/${id}/read`).then((r) => r.data);

export const fetchPlannerTasks = () => apiClient.get('/student/planner').then((r) => r.data);
export const fetchPlannerSuggestions = () => apiClient.get('/student/planner/suggestions').then((r) => r.data);
export const createPlannerTask = (payload) => apiClient.post('/student/planner', payload).then((r) => r.data);
export const updatePlannerTask = (id, payload) => apiClient.patch(`/student/planner/${id}`, payload).then((r) => r.data);
export const deletePlannerTask = (id) => apiClient.delete(`/student/planner/${id}`).then((r) => r.data);

export const fetchAdminReports = (params) => apiClient.get('/admin/reports', { params }).then((r) => r.data);

export const fetchStudentDoubts = () => apiClient.get('/student/doubts').then((r) => r.data);
export const createLessonDoubt = (payload) => apiClient.post('/student/doubts', payload).then((r) => r.data);
export const fetchAdminDoubts = (params) => apiClient.get('/admin/lesson-doubts', { params }).then((r) => r.data);
export const answerLessonDoubt = (id, payload) => apiClient.patch(`/admin/lesson-doubts/${id}`, payload).then((r) => r.data);
