import { API_BASE_URL, baseHeaders } from './apiClient.js'

const resolveErrorMessage = (payload) => {
  if (!payload) return null
  if (typeof payload === 'string') return payload
  if (typeof payload === 'object') {
    if (payload.error) { const n = resolveErrorMessage(payload.error); if (n) return n }
    if (payload.detail) { const n = resolveErrorMessage(payload.detail); if (n) return n }
    if (Array.isArray(payload)) {
      for (const item of payload) { const n = resolveErrorMessage(item); if (n) return n }
      return null
    }
    for (const value of Object.values(payload)) { const n = resolveErrorMessage(value); if (n) return n }
  }
  return null
}

const request = async (path, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...baseHeaders,
      ...(options.headers || {}),
    },
  })

  const isJson = response.headers.get('content-type')?.includes('application/json')
  const payload = isJson ? await response.json() : null

  if (!response.ok) {
    const message = resolveErrorMessage(payload) || 'Something went wrong'
    throw new Error(message)
  }

  return payload
}

export const signup = (data) =>
  request('/api/users/signup/', {
    method: 'POST',
    body: JSON.stringify(data),
  })

export const login = (data) =>
  request('/api/users/login/', {
    method: 'POST',
    body: JSON.stringify(data),
  })

export const googleAuth = (credential) =>
  request('/api/users/google/', {
    method: 'POST',
    body: JSON.stringify({ token: credential }),
  })

export const requestSignupOtp = (data) =>
  request('/api/users/request-otp/', {
    method: 'POST',
    body: JSON.stringify(data),
  })

let refreshInFlight = null
let refreshInFlightToken = null

export const refreshToken = (refresh) => {
  if (!refresh) {
    return Promise.reject(new Error('Missing refresh token'))
  }

  if (refreshInFlight && refreshInFlightToken === refresh) {
    return refreshInFlight
  }

  const promise = request('/api/users/token/refresh/', {
    method: 'POST',
    body: JSON.stringify({ refresh }),
  })

  refreshInFlight = promise
  refreshInFlightToken = refresh

  promise.finally(() => {
    if (refreshInFlight === promise) {
      refreshInFlight = null
      refreshInFlightToken = null
    }
  })

  return promise
}
