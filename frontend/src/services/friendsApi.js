import { authorizedRequest } from './apiClient'

export const fetchFriends = (auth) => authorizedRequest('/api/users/friends/', auth)

export const fetchInvites = (auth) => authorizedRequest('/api/users/friends/invites/', auth)

export const sendInvite = (auth, data) =>
  authorizedRequest('/api/users/friends/invite/', auth, {
    method: 'POST',
    body: JSON.stringify(data),
  })

export const respondToInvite = (auth, inviteId, action) =>
  authorizedRequest(`/api/users/friends/invites/${inviteId}/${action}/`, auth, {
    method: 'POST',
  })
