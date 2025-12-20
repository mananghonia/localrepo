export const FRIENDS_DATA_UPDATED_EVENT = 'balance:friends-data-updated'
export const ACTIVITY_UPDATED_EVENT = 'balance:activity-updated'

const emit = (eventName) => {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(eventName))
}

export const emitFriendsDataUpdated = () => emit(FRIENDS_DATA_UPDATED_EVENT)
export const emitActivityUpdated = () => emit(ACTIVITY_UPDATED_EVENT)
