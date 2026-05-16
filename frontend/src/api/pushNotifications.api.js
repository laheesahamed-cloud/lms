import { apiClient } from './client.js';

export const fetchPushVapidPublicKey = () =>
  apiClient.get('/push/vapid-public-key', { __skipNetworkActivity: true }).then((response) => response.data);

export const fetchPushSettings = () =>
  apiClient.get('/push/settings').then((response) => response.data);

export const updatePushSettings = (payload) =>
  apiClient.put('/push/settings', payload).then((response) => response.data);

export const fetchAdminPushStatus = () =>
  apiClient.get('/admin/push/status').then((response) => response.data);

export const savePushSubscription = (payload) =>
  apiClient.post('/push/subscribe', payload).then((response) => response.data);

export const deletePushSubscription = (payload) =>
  apiClient.delete('/push/subscribe', { data: payload }).then((response) => response.data);

export const saveNativePushToken = (payload) =>
  apiClient.post('/push/native-token', payload).then((response) => response.data);

export const deleteNativePushToken = (payload = {}) =>
  apiClient.delete('/push/native-token', { data: payload }).then((response) => response.data);

export const sendAdminPushNotification = (payload) =>
  apiClient.post('/admin/push/send', payload).then((response) => response.data);
