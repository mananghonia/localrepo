import { API_BASE_URL } from './apiClient'

const sanitizeBase = () => {
  const override = import.meta.env.VITE_WS_BASE_URL?.trim()
  if (override) {
    return override.replace(/\/+$/, '')
  }
  try {
    const apiUrl = new URL(API_BASE_URL)
    const protocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${apiUrl.host}`
  } catch (error) {
    console.warn('Unable to derive realtime base URL, falling back to ws://localhost:8000')
    return 'ws://localhost:8000'
  }
}

const buildRealtimeUrl = (token) => {
  const base = sanitizeBase()
  const url = new URL('/ws/live/', base)
  url.searchParams.set('token', token)
  return url.toString()
}

export const openRealtimeSocket = ({ token, onMessage, onOpen, onClose, onError }) => {
  if (!token) {
    throw new Error('Missing auth token for realtime connection')
  }
  if (typeof window === 'undefined') {
    return {
      close: () => {},
      send: () => {},
    }
  }
  const socket = new WebSocket(buildRealtimeUrl(token))

  socket.onopen = (event) => {
    if (typeof onOpen === 'function') {
      onOpen(event)
    }
  }

  socket.onmessage = (event) => {
    if (typeof onMessage !== 'function') {
      return
    }
    try {
      const payload = JSON.parse(event.data)
      onMessage(payload)
    } catch (error) {
      console.warn('Realtime payload parse error', error)
    }
  }

  socket.onerror = (event) => {
    if (typeof onError === 'function') {
      onError(event)
    }
  }

  socket.onclose = (event) => {
    if (typeof onClose === 'function') {
      onClose(event)
    }
  }

  return {
    close: () => {
      socket.close()
    },
    send: (data) => {
      if (socket.readyState !== WebSocket.OPEN) {
        return
      }
      try {
        const payload = typeof data === 'string' ? data : JSON.stringify(data)
        socket.send(payload)
      } catch (error) {
        console.warn('Realtime send failed', error)
      }
    },
  }
}
