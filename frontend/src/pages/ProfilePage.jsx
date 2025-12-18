import AppNav from '../components/AppNav.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const ProfilePage = () => {
  const { user } = useAuth()
  const maskedPassword = '••••••••'

  return (
    <section className="workspace-screen profile-screen">
      <AppNav />
      <section className="glass-card profile-card">
        <header>
          <p className="tag-pill" style={{ width: 'fit-content', marginBottom: '0.5rem' }}>
            Your profile
          </p>
          <h2 style={{ margin: '0.25rem 0 0.5rem' }}>Account overview</h2>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.65)' }}>
            Keep your workspace identity and contact details handy.
          </p>
        </header>
        <div className="profile-grid">
          <div className="profile-field">
            <span>Full name</span>
            <strong>{user?.name || '—'}</strong>
          </div>
          <div className="profile-field">
            <span>Username</span>
            <strong>{user?.username || '—'}</strong>
          </div>
          <div className="profile-field">
            <span>Email</span>
            <strong>{user?.email || '—'}</strong>
          </div>
          <div className="profile-field">
            <span>Password</span>
            <strong>{maskedPassword}</strong>
          </div>
        </div>
        <p className="profile-hint">
          Need to update something? Tap the chat bubble in the footer or reach us at support@balance.studio.
        </p>
      </section>
    </section>
  )
}

export default ProfilePage
