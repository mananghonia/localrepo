import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import * as friendsApi from '../services/friendsApi'
import * as notificationsApi from '../services/notificationsApi'
import NotificationTray from './NotificationTray.jsx'
import { INVITES_UPDATED_EVENT } from '../utils/inviteEvents'
import { NOTIFICATIONS_UPDATED_EVENT } from '../utils/notificationEvents'

const BellIcon = () => (
  <svg
    className="app-nav__bell-svg"
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M12 4a4 4 0 0 1 4 4v2.2c0 .74.26 1.46.73 2.04l.97 1.17c.54.66.08 1.66-.77 1.66H7.07c-.85 0-1.32-1-.77-1.66l.97-1.17c.47-.58.73-1.3.73-2.04V8a4 4 0 0 1 4-4Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M14.5 17.5a2.5 2.5 0 0 1-5 0"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
)

const AppNav = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, accessToken, refreshAccessToken, logout } = useAuth()
  const [inviteCount, setInviteCount] = useState(0)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [notificationsError, setNotificationsError] = useState('')
  const [notificationUnread, setNotificationUnread] = useState(0)

  const navLinks = [
    { label: 'Dashboard', path: '/' },
    { label: 'Add expense', path: '/add-expense' },
    { label: 'Friends', path: '/friends' },
    { label: 'Activity', path: '/activity' },
    { label: 'Profile', path: '/profile' },
  ]

  const handleNavigate = (path) => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    navigate(path)
  }

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated || !accessToken) {
      setNotifications([])
      setNotificationUnread(0)
      setNotificationsError('')
      return
    }
    setNotificationsLoading(true)
    setNotificationsError('')
    try {
      const payload = await notificationsApi.fetchNotifications({ accessToken, refreshAccessToken }, { limit: 15 })
      const unreadNotifications = (payload?.results || []).filter((item) => !item.is_read)
      setNotifications(unreadNotifications)
      setNotificationUnread(typeof payload?.unread === 'number' ? payload.unread : unreadNotifications.length)
    } catch (error) {
      setNotifications([])
      setNotificationsError(error?.message || 'Unable to load notifications.')
    } finally {
      setNotificationsLoading(false)
    }
  }, [isAuthenticated, accessToken, refreshAccessToken])

  const handleLoginToggle = () => {
    if (isAuthenticated) {
      logout()
      navigate('/')
    } else {
      navigate('/login')
    }
  }

  useEffect(() => {
    let ignore = false
    if (typeof window === 'undefined') {
      return undefined
    }

    const fetchCount = async () => {
      if (!isAuthenticated || !accessToken) {
        setInviteCount(0)
        return
      }
      try {
        const data = await friendsApi.fetchInvites({ accessToken, refreshAccessToken })
        if (!ignore) {
          setInviteCount(data.count || 0)
        }
      } catch (error) {
        if (!ignore) {
          setInviteCount(0)
        }
      }
    }

    fetchCount()
    const refetch = () => fetchCount()
    window.addEventListener(INVITES_UPDATED_EVENT, refetch)
    return () => {
      ignore = true
      window.removeEventListener(INVITES_UPDATED_EVENT, refetch)
    }
  }, [isAuthenticated, accessToken, refreshAccessToken])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  useEffect(() => {
    if (!isAuthenticated) {
      setNotificationsOpen(false)
      setNotifications([])
      setNotificationUnread(0)
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }
    const handler = () => fetchNotifications()
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, handler)
    return () => {
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, handler)
    }
  }, [fetchNotifications])

  const handleNotificationsClick = () => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    setNotificationsOpen((prev) => {
      const next = !prev
      if (!prev) {
        fetchNotifications()
      }
      return next
    })
  }

  const handleMarkNotification = async (notificationId) => {
    try {
      const payload = await notificationsApi.markNotificationRead({ accessToken, refreshAccessToken }, notificationId)
      setNotifications((prev) => prev.filter((item) => item.id !== notificationId))
      if (typeof payload?.unread === 'number') {
        setNotificationUnread(payload.unread)
      }
    } catch (error) {
      console.warn('Unable to mark notification as read', error)
    }
  }

  const handleMarkAllNotifications = async () => {
    if (!notificationUnread) {
      setNotificationsOpen(false)
      return
    }
    try {
      await notificationsApi.markAllNotificationsRead({ accessToken, refreshAccessToken })
      setNotifications([])
      setNotificationUnread(0)
    } catch (error) {
      console.warn('Unable to mark notifications read', error)
    }
  }

  const handleViewInvites = () => {
    setNotificationsOpen(false)
    navigate('/friends?section=invites')
  }

  const goHome = () => navigate('/')

  return (
    <>
      <nav className="app-nav">
        <button type="button" className="app-nav__brand" onClick={goHome}>
          Balance Studio
        </button>
        <div className="app-nav__actions">
          {isAuthenticated ? (
            <div className="app-nav__notify">
              <button
                type="button"
                className={`app-nav__icon${notificationsOpen ? ' app-nav__icon--active' : ''}`}
                onClick={handleNotificationsClick}
                aria-label="View notifications"
              >
                <BellIcon />
                {notificationUnread + inviteCount > 0 ? (
                  <span className="app-nav__badge">{Math.min(notificationUnread + inviteCount, 99)}</span>
                ) : null}
              </button>
              {notificationsOpen ? (
                <NotificationTray
                  notifications={notifications}
                  unreadCount={notificationUnread}
                  inviteCount={inviteCount}
                  loading={notificationsLoading}
                  error={notificationsError}
                  onClose={() => setNotificationsOpen(false)}
                  onMarkRead={handleMarkNotification}
                  onMarkAll={handleMarkAllNotifications}
                  onViewInvites={handleViewInvites}
                />
              ) : null}
            </div>
          ) : null}
          {navLinks.map((link) => {
            const isActive = link.path === '/'
              ? location.pathname === '/' || location.pathname === '/dashboard'
              : location.pathname.startsWith(link.path)
            return (
              <button
                key={link.path}
                type="button"
                className={`app-nav__pill${link.accent ? ' app-nav__pill--accent' : ''}${
                  isActive ? ' app-nav__pill--active' : ''
                }`}
                onClick={() => handleNavigate(link.path)}
              >
                {link.label}
              </button>
            )
          })}
          <button type="button" className="app-nav__cta" onClick={handleLoginToggle}>
            {isAuthenticated ? 'Log out' : 'Log in'}
          </button>
        </div>
      </nav>
    </>
  )
}

export default AppNav
