import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthShell from '../components/AuthShell.jsx'
import GoogleAuthButton from '../components/GoogleAuthButton.jsx'
import TextField from '../components/TextField.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const LoginPage = () => {
  const navigate = useNavigate()
  const { login, googleLogin } = useAuth()
  const [form, setForm] = useState({ identifier: '', password: '' })
  const [pending, setPending] = useState(false)
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
      await login(form)
      navigate('/')
    } catch (err) {
      setError(err.message || 'Unable to log in')
    } finally {
      setPending(false)
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
      title="Welcome back"
      subtitle="Log into your Splitwise-style HQ to keep every balance transparent and fair."
    >
      <form className="form-grid" onSubmit={handleSubmit}>
        {error ? <div className="error-banner">{error}</div> : null}
        <TextField
          label="Email or username"
          name="identifier"
          placeholder="you@example.com or alexg"
          value={form.identifier}
          onChange={handleChange}
          autoComplete="username"
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          placeholder="••••••••"
          value={form.password}
          onChange={handleChange}
          autoComplete="current-password"
        />
        <div className="auth-inline-link">
          <Link to="/forgot-password">Forgot password?</Link>
        </div>
        <button className="primary-btn" type="submit" disabled={pending}>
          {pending ? 'Signing you in…' : 'Log in'}
        </button>
      </form>
      <div className="auth-google-stack">
        <GoogleAuthButton onCredential={handleGoogle} onError={setError} />
        <p className="auth-meta-note auth-create-note">If you don&apos;t have account create one.</p>
        <Link className="auth-create-link" to="/signup">
          Create an account
        </Link>
      </div>
    </AuthShell>
  )
}

export default LoginPage
