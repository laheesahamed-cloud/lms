import { apiClient } from './client.js';
import { createTimedApiCache } from './cache.js';

const adminDashboardCache = createTimedApiCache({
  ttlMs: 10000,
  load: () => apiClient.get('/admin/dashboard').then((response) => response.data),
});

const studentDashboardCache = createTimedApiCache({
  ttlMs: 15000,
  load: () => apiClient.get('/student/dashboard').then((response) => response.data),
});

export const fetchAdminDashboard = () => adminDashboardCache.get();

export const fetchStudentDashboard = () => studentDashboardCache.get();

export function clearDashboardCache() {
  adminDashboardCache.clear();
  studentDashboardCache.clear();
}

export async function recordStudyActivity(payload) {
  const response = await apiClient.post('/student/dashboard/activity', payload);
  studentDashboardCache.clear();
  return response.data;
}
