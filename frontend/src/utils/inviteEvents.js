export const INVITES_UPDATED_EVENT = 'friends:invites-updated'

export const emitInvitesUpdated = () => {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(INVITES_UPDATED_EVENT))
}
