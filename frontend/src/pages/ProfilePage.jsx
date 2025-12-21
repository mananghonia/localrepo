import { useState } from 'react'
import AppNav from '../components/AppNav.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import EditProfileModal from '../components/EditProfileModal.jsx'

const ProfilePage = () => {
  const { user } = useAuth()
  const [showEditModal, setShowEditModal] = useState(false)
  const maskedPassword = '••••••••'

  return (
    <section className="workspace-screen profile-screen">
      <AppNav />
      <section className="glass-card profile-card-modern">
        <header className="profile-header">
          <div className="profile-avatar">
            <span className="avatar-text">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </span>
          </div>
          <div className="profile-info">
            <h1 className="profile-name">{user?.name || 'User'}</h1>
            <p className="profile-username">@{user?.username || 'username'}</p>
          </div>
          <button 
            className="edit-profile-btn"
            onClick={() => setShowEditModal(true)}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M11.334 2.00004C11.5091 1.82494 11.7169 1.68605 11.9457 1.59129C12.1745 1.49653 12.4197 1.44775 12.6673 1.44775C12.9149 1.44775 13.1601 1.49653 13.3889 1.59129C13.6177 1.68605 13.8256 1.82494 14.0007 2.00004C14.1758 2.17513 14.3147 2.383 14.4094 2.61178C14.5042 2.84055 14.553 3.08575 14.553 3.33337C14.553 3.58099 14.5042 3.82619 14.4094 4.05497C14.3147 4.28374 14.1758 4.49161 14.0007 4.66671L5.00065 13.6667L1.33398 14.6667L2.33398 11L11.334 2.00004Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Edit Profile
          </button>
        </header>

        <div className="profile-details">
          <div className="detail-row">
            <span className="detail-label">Full Name</span>
            <span className="detail-value">{user?.name || '—'}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Username</span>
            <span className="detail-value">@{user?.username || '—'}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Email</span>
            <span className="detail-value">{user?.email || '—'}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Password</span>
            <span className="detail-value">{maskedPassword}</span>
          </div>
        </div>

        <div className="profile-footer">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 14.6667C11.6819 14.6667 14.6667 11.6819 14.6667 8C14.6667 4.3181 11.6819 1.33333 8 1.33333C4.3181 1.33333 1.33333 4.3181 1.33333 8C1.33333 11.6819 4.3181 14.6667 8 14.6667Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M8 10.6667V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M8 5.33333H8.00667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <p>Your profile information is secure and only visible to you</p>
        </div>
      </section>

      {showEditModal && (
        <EditProfileModal
          user={user}
          onClose={() => setShowEditModal(false)}
        />
      )}
    </section>
  )
}

export default ProfilePage
