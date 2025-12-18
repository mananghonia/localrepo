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

export const fetchFriendBreakdown = (auth, friendId) =>
  authorizedRequest(`/api/users/friends/${friendId}/ledger/`, auth)

export const settleFriendGroup = (auth, friendId, data) =>
  authorizedRequest(`/api/users/friends/${friendId}/settlements/`, auth, {
    method: 'POST',
    body: JSON.stringify(data),
  })

export const settleFriendAll = (auth, friendId) =>
  authorizedRequest(`/api/users/friends/${friendId}/settlements/all/`, auth, {
    method: 'POST',
  })
