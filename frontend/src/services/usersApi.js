import { API_BASE_URL, baseHeaders } from './apiClient.js'

const publicRequest = async (path, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      ...baseHeaders,
      ...(options.headers || {}),
    },
    ...options,
  })

  const isJson = response.headers.get('content-type')?.includes('application/json')
  const payload = isJson ? await response.json() : null

  if (!response.ok) {
    const message = payload?.error || payload?.detail || 'Request failed'
    throw new Error(message)
  }

  return payload
}

export const updateProfile = (authorizedFetch, payload) =>
  authorizedFetch('/api/users/profile/', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })

export const changePassword = (authorizedFetch, payload) =>
  authorizedFetch('/api/users/password/change/', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const requestPasswordReset = (email) =>
  publicRequest('/api/users/password/reset/request/', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })

export const confirmPasswordReset = (payload) =>
  publicRequest('/api/users/password/reset/confirm/', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
