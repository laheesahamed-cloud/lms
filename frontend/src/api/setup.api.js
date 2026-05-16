import { apiClient } from './client.js';

export async function fetchSetupStatus() {
  const response = await apiClient.get('/admin/setup');
  return response.data;
}
