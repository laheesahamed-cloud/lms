import { apiClient } from './client.js';

export async function fetchAdminDashboard() {
  const response = await apiClient.get('/dashboard/admin');
  return response.data;
}

export async function fetchStudentDashboard() {
  const response = await apiClient.get('/dashboard/student');
  return response.data;
}

export async function recordStudyActivity(payload) {
  const response = await apiClient.post('/dashboard/student/activity', payload);
  return response.data;
}
