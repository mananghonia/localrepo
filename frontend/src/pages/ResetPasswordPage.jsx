import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import AuthShell from '../components/AuthShell.jsx'
import TextField from '../components/TextField.jsx'
import { confirmPasswordReset } from '../services/usersApi.js'

const ResetPasswordPage = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' })
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!token) {
      setError('Your reset link is missing or has expired. Please request a new one from the profile screen.')
      return
    }

    if (!form.newPassword || !form.confirmPassword) {
      setError('Both password fields are required.')
      return
    }

    if (form.newPassword.length < 6) {
      setError('Password must be at least 6 characters long.')
      return
    }

    if (form.newPassword !== form.confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setPending(true)

    try {
      await confirmPasswordReset({
        token,
        new_password: form.newPassword,
        confirm_password: form.confirmPassword,
      })
      setSuccess('Password reset successfully! You can log in with your new password.')
      setForm({ newPassword: '', confirmPassword: '' })
      setTimeout(() => navigate('/login'), 2000)
    } catch (err) {
      setError(err.message || 'Failed to reset password. The link may have expired.')
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Choose a fresh password so you can jump back into your shared ledgers."
    >
      <form className="form-grid" onSubmit={handleSubmit}>
        {error ? <div className="error-banner">{error}</div> : null}
        {success ? <div className="success-banner">{success}</div> : null}

        {!token ? (
          <p className="info-banner">
            This reset link is invalid or missing. Go back to the <Link to="/login">login page</Link> and request a
            new password email from your profile.
          </p>
        ) : (
          <>
            <TextField
              label="New password"
              name="newPassword"
              type="password"
              placeholder="Enter a new password"
              value={form.newPassword}
              onChange={handleChange}
              autoComplete="new-password"
            />
            <TextField
              label="Confirm password"
              name="confirmPassword"
              type="password"
              placeholder="Re-enter your new password"
              value={form.confirmPassword}
              onChange={handleChange}
              autoComplete="new-password"
            />
            <button className="primary-btn" type="submit" disabled={pending}>
              {pending ? 'Updating…' : 'Reset password'}
            </button>
          </>
        )}
      </form>
      <div className="link-row" style={{ marginTop: '1rem' }}>
        <span>Remembered it?</span>
        <Link to="/login">Back to login</Link>
      </div>
    </AuthShell>
  )
}

export default ResetPasswordPage
