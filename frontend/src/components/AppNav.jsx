import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import * as friendsApi from '../services/friendsApi'
import { INVITES_UPDATED_EVENT } from '../utils/inviteEvents'

const AppNav = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, accessToken, refreshAccessToken, logout } = useAuth()
  const [inviteCount, setInviteCount] = useState(0)

  const navLinks = [
    { label: 'Add expense', path: '/add-expense', accent: true },
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

  const handleNotificationsClick = () => {
    navigate('/friends?section=invites')
  }

  const goHome = () => navigate('/')

  return (
    <nav className="app-nav">
      <button type="button" className="app-nav__brand" onClick={goHome}>
        Balance Studio
      </button>
      <div className="app-nav__actions">
        {isAuthenticated ? (
          <button
            type="button"
            className="app-nav__icon"
            onClick={handleNotificationsClick}
            aria-label="View invites"
          >
            <span className="app-nav__icon-bell" aria-hidden />
            {inviteCount > 0 ? <span className="app-nav__badge">{inviteCount}</span> : null}
          </button>
        ) : null}
        {navLinks.map((link) => {
          const isActive = location.pathname.startsWith(link.path)
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
  )
}

export default AppNav
