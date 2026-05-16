import { apiClient } from './client.js';

export async function fetchAdminDashboard() {
  const response = await apiClient.get('/admin/dashboard');
  return response.data;
}

export async function fetchStudentDashboard() {
  const response = await apiClient.get('/student/dashboard');
  return response.data;
}

export async function recordStudyActivity(payload) {
  const response = await apiClient.post('/student/dashboard/activity', payload);
  return response.data;
}
