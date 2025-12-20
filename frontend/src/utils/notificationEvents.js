export const NOTIFICATIONS_UPDATED_EVENT = 'balance:notifications-updated'

export const emitNotificationsUpdated = () => {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_UPDATED_EVENT))
}
