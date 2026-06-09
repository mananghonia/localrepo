import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthShell from '../components/AuthShell.jsx'
import TextField from '../components/TextField.jsx'
import { requestPasswordReset } from '../services/usersApi.js'

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!email.trim()) {
      setError('Please enter the email tied to your account.')
      return
    }
    setPending(true)
    setError('')
    setSuccess('')
    try {
      await requestPasswordReset(email.trim())
      setSuccess('Reset link sent! Check your inbox and follow the link to set a new password.')
    } catch (err) {
      setError(err.message || 'Unable to send reset link')
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthShell
      title="Forgot your password?"
      subtitle="Enter the exact email you used when creating your account. We will send a secure reset link to that address."
    >
      <form className="form-grid" onSubmit={handleSubmit}>
        {error ? <div className="error-banner">{error}</div> : null}
        {success ? <div className="success-banner">{success}</div> : null}
        <TextField
          label="Account email"
          name="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
        />
        <button className="primary-btn" type="submit" disabled={pending}>
          {pending ? 'Sending reset link…' : 'Send reset link'}
        </button>
      </form>
      <p className="auth-meta-note">
        If an account with that email exists, the link arrives within a minute. Check your spam folder too.
        Click the link on the same device to set a new password.
      </p>
      <Link className="btn-secondary auth-link-btn" to="/login">
        Back to login
      </Link>
    </AuthShell>
  )
}

export default ForgotPasswordPage
