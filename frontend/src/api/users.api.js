import { apiClient } from './client.js';

export async function fetchUsers(params) {
  const response = await apiClient.get('/users', { params });
  return response.data;
}

export async function fetchUsersSummary() {
  const response = await apiClient.get('/users/summary');
  return response.data;
}

export async function createUser(payload) {
  const response = await apiClient.post('/users', payload);
  return response.data;
}

export async function updateUser(id, payload) {
  const response = await apiClient.patch(`/users/${id}`, payload);
  return response.data;
}

export async function deleteUser(id) {
  const response = await apiClient.delete(`/users/${id}`);
  return response.data;
}

export async function updateUserStatus(id, status) {
  const response = await apiClient.patch(`/users/${id}/status`, { status });
  return response.data;
}
