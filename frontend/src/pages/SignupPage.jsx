import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthShell from '../components/AuthShell.jsx'
import GoogleAuthButton from '../components/GoogleAuthButton.jsx'
import TextField from '../components/TextField.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { requestSignupOtp } from '../services/authApi.js'

const SignupPage = () => {
  const navigate = useNavigate()
  const { signup, googleLogin } = useAuth()
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '', otp_code: '' })
  const [pending, setPending] = useState(false)
  const [otpPending, setOtpPending] = useState(false)
  const [otpFeedback, setOtpFeedback] = useState('')
  const [error, setError] = useState('')

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      await signup(form)
      navigate('/')
    } catch (err) {
      setError(err.message || 'Could not create an account')
    } finally {
      setPending(false)
    }
  }

  const handleOtpRequest = async () => {
    if (!form.email) {
      setError('Enter your email before requesting a verification code.')
      return
    }

    setOtpPending(true)
    setError('')
    setOtpFeedback('')
    try {
      await requestSignupOtp({ email: form.email, name: form.name })
      setOtpFeedback('Verification code sent to your inbox.')
    } catch (err) {
      setError(err.message || 'Unable to send verification code')
    } finally {
      setOtpPending(false)
    }
  }

  const handleGoogle = async (credential) => {
    setPending(true)
    setError('')
    try {
      await googleLogin(credential)
      navigate('/')
    } catch (err) {
      setError(err.message || 'Google authentication failed')
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthShell
      title="Create your collective"
      subtitle="Spin up a secure expense space, invite collaborators, and settle up in seconds."
    >
      <form className="form-grid" onSubmit={handleSubmit}>
        {error ? <div className="error-banner">{error}</div> : null}
        <TextField
          label="Full name"
          name="name"
          placeholder="Alex Garcia"
          value={form.name}
          onChange={handleChange}
          autoComplete="name"
        />
        <TextField
          label="Username"
          name="username"
          placeholder="alexg"
          value={form.username}
          onChange={handleChange}
          autoComplete="username"
        />
        <TextField
          label="Email"
          name="email"
          type="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={handleChange}
          autoComplete="email"
        />
        <button
          type="button"
          className="ghost-btn"
          onClick={handleOtpRequest}
          disabled={otpPending}
          style={{ justifySelf: 'flex-start', width: 'fit-content', minWidth: '0' }}
        >
          {otpPending ? 'Sending code…' : 'Send verification code'}
        </button>
        <TextField
          label="Password"
          name="password"
          type="password"
          placeholder="Create a secure password"
          value={form.password}
          onChange={handleChange}
          autoComplete="new-password"
        />
        <TextField
          label="Verification code"
          name="otp_code"
          placeholder="6-digit code"
          value={form.otp_code}
          onChange={handleChange}
          autoComplete="one-time-code"
        />
        {otpFeedback ? <div className="hint-text">{otpFeedback}</div> : null}

        <button className="primary-btn" type="submit" disabled={pending || !form.otp_code}>
          {pending ? 'Creating account…' : 'Sign up'}
        </button>
      </form>
      <div className="link-row" style={{ marginTop: '1rem' }}>
        <span>Already have a space?</span>
        <Link to="/login">Log in</Link>
      </div>
      <div style={{ marginTop: '1.25rem' }}>
        <GoogleAuthButton onCredential={handleGoogle} onError={setError} />
      </div>
    </AuthShell>
  )
}

export default SignupPage
