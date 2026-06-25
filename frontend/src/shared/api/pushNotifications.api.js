import { apiClient } from './client.js';

export const fetchAdminPushStatus = () =>
  apiClient.get('/admin/push/status').then((response) => response.data);

export const saveNativePushToken = (payload) =>
  apiClient.post('/push/native-token', payload).then((response) => response.data);

export const deleteNativePushToken = (payload = {}) =>
  apiClient.delete('/push/native-token', { data: payload }).then((response) => response.data);

export const sendAdminPushNotification = (payload) =>
  apiClient.post('/admin/push/send', payload).then((response) => response.data);
