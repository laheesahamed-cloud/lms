import { apiClient } from './client.js';

export async function fetchUsers(params) {
  const requestParams = { ...(params || {}) };
  if (!requestParams.limit) requestParams.limit = 100;
  const response = await apiClient.get('/admin/users', { params: requestParams });
  return response.data;
}

export async function fetchUsersSummary() {
  const response = await apiClient.get('/admin/users/summary');
  return response.data;
}

export async function fetchUserDetail(id) {
  const response = await apiClient.get(`/admin/users/${id}/detail`);
  return response.data;
}

export async function createUser(payload) {
  const response = await apiClient.post('/admin/users', payload);
  return response.data;
}

export async function updateUser(id, payload) {
  const response = await apiClient.patch(`/admin/users/${id}`, payload);
  return response.data;
}

export async function deleteUser(id) {
  const response = await apiClient.delete(`/admin/users/${id}`);
  return response.data;
}

export async function updateUserStatus(id, status) {
  const response = await apiClient.patch(`/admin/users/${id}/status`, { status });
  return response.data;
}
