import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

const AppNav = () => {
  const navigate = useNavigate()
  const { isAuthenticated, logout, user } = useAuth()

  const handleProfile = () => {
    if (isAuthenticated) {
      navigate('/profile')
    } else {
      navigate('/login')
    }
  }

  const handleLoginToggle = () => {
    if (isAuthenticated) {
      logout()
      navigate('/')
    } else {
      navigate('/login')
    }
  }

  const goHome = () => navigate('/')

  return (
    <nav className="app-nav">
      <button type="button" className="app-nav__brand" onClick={goHome}>
        Balance Studio
      </button>
      <div className="app-nav__actions">
        <button type="button" className="app-nav__pill" onClick={handleProfile}>
          {isAuthenticated ? (user?.name || 'Profile') : 'Profile'}
        </button>
        <button type="button" className="app-nav__cta" onClick={handleLoginToggle}>
          {isAuthenticated ? 'Log out' : 'Log in'}
        </button>
      </div>
    </nav>
  )
}

export default AppNav
