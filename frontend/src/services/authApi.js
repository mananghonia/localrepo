const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:8000'

const defaultHeaders = {
  'Content-Type': 'application/json',
}

const request = async (path, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers || {}),
    },
  })

  const isJson = response.headers.get('content-type')?.includes('application/json')
  const payload = isJson ? await response.json() : null

  if (!response.ok) {
    const message = payload?.error || payload?.detail || 'Something went wrong'
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

export const refreshToken = (refresh) =>
  request('/api/users/token/refresh/', {
    method: 'POST',
    body: JSON.stringify({ refresh }),
  })
