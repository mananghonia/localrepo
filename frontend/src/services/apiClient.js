const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:8000'

const baseHeaders = {
  'Content-Type': 'application/json',
}

export const authorizedRequest = async (path, auth, options = {}, attempt = 0) => {
  const authConfig = typeof auth === 'string' ? { accessToken: auth } : auth || {}

  const { accessToken, refreshAccessToken } = authConfig
  if (!accessToken) throw new Error('Missing auth token')

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...baseHeaders,
      ...(options.headers || {}),
      Authorization: `Bearer ${accessToken}`,
    },
  })

  const isJson = response.headers.get('content-type')?.includes('application/json')
  const payload = isJson ? await response.json() : null

  if (response.ok) {
    return payload
  }

  const tokenInvalid = response.status === 401 && payload?.code === 'token_not_valid'

  if (tokenInvalid && typeof refreshAccessToken === 'function' && attempt === 0) {
    try {
      const freshToken = await refreshAccessToken()
      return authorizedRequest(path, { ...authConfig, accessToken: freshToken }, options, attempt + 1)
    } catch (refreshError) {
      throw new Error(refreshError.message || 'Session expired. Please log in again.')
    }
  }

  const details =
    payload?.error ||
    payload?.detail ||
    (tokenInvalid ? 'Session expired. Please log in again.' : 'Request failed')
  throw new Error(details)
}

export { API_BASE_URL, baseHeaders }
