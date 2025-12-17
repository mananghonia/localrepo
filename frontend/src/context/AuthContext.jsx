import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import * as authApi from '../services/authApi'

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
