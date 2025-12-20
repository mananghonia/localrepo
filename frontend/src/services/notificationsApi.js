import { authorizedRequest } from './apiClient'

export const fetchNotifications = (auth, { limit = 20, unreadOnly = false } = {}) =>
  authorizedRequest(
    `/api/users/notifications/?limit=${limit}${unreadOnly ? '&unread_only=1' : ''}`,
    auth,
  )

export const markNotificationRead = (auth, notificationId) =>
  authorizedRequest(`/api/users/notifications/${notificationId}/read/`, auth, {
    method: 'POST',
  })

export const markAllNotificationsRead = (auth) =>
  authorizedRequest('/api/users/notifications/read-all/', auth, {
    method: 'POST',
  })
