import { useState } from 'react'
import { updateProfile, changePassword, requestPasswordReset } from '../services/usersApi.js'
import { useAuth } from '../context/AuthContext.jsx'

const EditProfileModal = ({ user, onClose }) => {
  const { authorizedFetch, setUser } = useAuth()
  const [activeTab, setActiveTab] = useState('info')
  const [infoLoading, setInfoLoading] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Info tab state
  const [name, setName] = useState(user?.name || '')
  const [username, setUsername] = useState(user?.username || '')

  // Password tab state
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const handleUpdateInfo = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setInfoLoading(true)

    try {
      const response = await updateProfile(authorizedFetch, { name, username })
      setUser(response.user)
      setSuccess('Profile updated successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message || 'Failed to update profile')
    } finally {
      setInfoLoading(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match')
      return
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setPasswordLoading(true)

    try {
      await changePassword(authorizedFetch, {
        old_password: oldPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      })
      setSuccess('Password changed successfully!')
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message || 'Failed to change password')
    } finally {
      setPasswordLoading(false)
    }
  }

  const handleRequestPasswordReset = async () => {
    setError('')
    setSuccess('')

    if (!user?.email) {
      setError('Email address unavailable for this account')
      return
    }

    setResetLoading(true)

    try {
      await requestPasswordReset(user.email)
      setSuccess('Password reset link sent to your email!')
      setTimeout(() => {
        setSuccess('')
        onClose()
      }, 3000)
    } catch (err) {
      setError(err.message || 'Failed to send reset link')
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Profile</h2>
          <button className="modal-close" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        <div className="modal-tabs">
          <button
            className={`tab-btn ${activeTab === 'info' ? 'active' : ''}`}
            onClick={() => setActiveTab('info')}
          >
            Profile Info
          </button>
          <button
            className={`tab-btn ${activeTab === 'password' ? 'active' : ''}`}
            onClick={() => setActiveTab('password')}
          >
            Password
          </button>
        </div>

        <div className="modal-body">
          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          {activeTab === 'info' && (
            <form onSubmit={handleUpdateInfo} className="edit-form">
              <div className="form-group">
                <label htmlFor="name">Full Name</label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your full name"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="username">Username</label>
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  required
                />
              </div>

              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="input-disabled"
                />
                <small className="form-hint">Email cannot be changed</small>
              </div>

              <button type="submit" className="btn-primary" disabled={infoLoading}>
                {infoLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          )}

          {activeTab === 'password' && (
            <div className="password-section">
              <div className="password-card">
                <div className="password-card__intro">
                  <p className="password-card__eyebrow">Secure update</p>
                  <h3>Change password with your current credentials</h3>
                  <p className="password-card__hint">
                    Use at least 6 characters and mix numbers or symbols for extra security.
                  </p>
                </div>

                <form onSubmit={handleChangePassword} className="edit-form">
                  <div className="form-group">
                    <label htmlFor="old-password">Current Password</label>
                    <input
                      type="password"
                      id="old-password"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      placeholder="Enter current password"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="new-password">New Password</label>
                    <input
                      type="password"
                      id="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      required
                    />
                    <small className="form-hint">At least 6 characters</small>
                  </div>

                  <div className="form-group">
                    <label htmlFor="confirm-password">Confirm New Password</label>
                    <input
                      type="password"
                      id="confirm-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      required
                    />
                  </div>

                  <button type="submit" className="btn-primary" disabled={passwordLoading}>
                    {passwordLoading ? 'Changing...' : 'Change Password'}
                  </button>
                </form>
              </div>

              <div className="forgot-password-card">
                <div className="forgot-password-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M3 5.5C3 4.67157 3.67157 4 4.5 4H19.5C20.3284 4 21 4.67157 21 5.5V18.5C21 19.3284 20.3284 20 19.5 20H4.5C3.67157 20 3 19.3284 3 18.5V5.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M21 6L12 12.5L3 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="forgot-password-copy">
                  <p className="forgot-password-label">Forgot password?</p>
                  <h3>Send yourself a secure reset link</h3>
                  <p>
                    We'll email the link to <strong>{user?.email || 'your account email'}</strong> so you can set a new password.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleRequestPasswordReset}
                  disabled={resetLoading}
                >
                  {resetLoading ? 'Sending...' : 'Email Reset Link'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default EditProfileModal
