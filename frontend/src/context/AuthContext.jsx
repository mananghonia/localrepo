import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import * as authApi from '../services/authApi'
import { openRealtimeSocket } from '../services/realtimeClient'
import { emitInvitesUpdated } from '../utils/inviteEvents'
import { emitNotificationsUpdated } from '../utils/notificationEvents'
import { emitActivityUpdated, emitFriendsDataUpdated } from '../utils/realtimeStreams'

const STORAGE_KEY = 'splitwise-auth-state'
const defaultAuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
}

const AuthContext = createContext(null)

const readPersistedState = () => {
  if (typeof window === 'undefined') {
    return defaultAuthState
  }

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : defaultAuthState
  } catch (error) {
    console.warn('Unable to restore auth state', error)
    return defaultAuthState
  }
}

export const AuthProvider = ({ children }) => {
  const [authState, setAuthState] = useState(() => readPersistedState())
  const realtimeRef = useRef({ socket: null, reconnectTimer: null, stopped: false })

  const persist = (payload) => {
    const normalized = {
      user: payload.user || null,
      accessToken: payload.access || null,
      refreshToken: payload.refresh || null,
    }

    setAuthState(normalized)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
    }
    return normalized
  }

  const signup = async (form) => {
    const data = await authApi.signup(form)
    return persist(data)
  }

  const login = async (form) => {
    const data = await authApi.login(form)
    return persist(data)
  }

  const googleLogin = async (credential) => {
    const data = await authApi.googleAuth(credential)
    return persist(data)
  }

  const refreshAccessToken = useCallback(async () => {
    if (!authState.refreshToken) {
      throw new Error('Missing refresh token')
    }
    const data = await authApi.refreshToken(authState.refreshToken)
    const updated = persist({
      user: authState.user,
      access: data.access,
      refresh: data.refresh || authState.refreshToken,
    })
    return updated.accessToken
  }, [authState.refreshToken, authState.user, persist])

  const logout = () => {
    setAuthState(defaultAuthState)
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY)
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const connection = realtimeRef.current || { socket: null, reconnectTimer: null, stopped: false }
    connection.stopped = false

    const clearReconnect = () => {
      if (connection.reconnectTimer) {
        clearTimeout(connection.reconnectTimer)
        connection.reconnectTimer = null
      }
    }

    const closeSocket = () => {
      if (connection.socket) {
        try {
          connection.socket.close()
        } catch (error) {
          console.warn('Error closing realtime socket', error)
        }
        connection.socket = null
      }
    }

    if (!authState.accessToken) {
      clearReconnect()
      closeSocket()
      realtimeRef.current = connection
      return undefined
    }

    let retryDelay = 2000

    const handleMessage = (payload) => {
      if (!payload || typeof payload !== 'object') return
      switch (payload.topic) {
        case 'notifications':
          emitNotificationsUpdated()
          break
        case 'invites':
          emitInvitesUpdated()
          break
        case 'friends':
          emitFriendsDataUpdated()
          break
        case 'activity':
          emitActivityUpdated()
          break
        default:
          break
      }
    }

    const scheduleReconnect = () => {
      clearReconnect()
      if (connection.stopped) return
      connection.reconnectTimer = window.setTimeout(() => {
        retryDelay = Math.min(retryDelay * 1.5, 15000)
        connect()
      }, retryDelay)
    }

    const connect = () => {
      if (connection.stopped) return
      clearReconnect()
      closeSocket()
      try {
        const socket = openRealtimeSocket({
          token: authState.accessToken,
          onMessage: handleMessage,
          onOpen: () => {
            retryDelay = 2000
          },
          onClose: () => {
            if (!connection.stopped) {
              scheduleReconnect()
            }
          },
          onError: () => {
            if (!connection.stopped) {
              scheduleReconnect()
            }
          },
        })
        connection.socket = socket
      } catch (error) {
        console.warn('Realtime connection failed', error)
        scheduleReconnect()
      }
    }

    connect()
    realtimeRef.current = connection

    return () => {
      connection.stopped = true
      clearReconnect()
      closeSocket()
    }
  }, [authState.accessToken])

  const value = useMemo(
    () => ({
      user: authState.user,
      accessToken: authState.accessToken,
      refreshToken: authState.refreshToken,
      isAuthenticated: Boolean(authState.accessToken),
      signup,
      login,
      googleLogin,
      refreshAccessToken,
      logout,
    }),
    [authState, refreshAccessToken],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider')
  }
  return context
}
