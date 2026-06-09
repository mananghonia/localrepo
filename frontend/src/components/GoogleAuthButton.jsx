import { useState } from 'react'
import { useGoogleLogin } from '@react-oauth/google'

const GoogleAuthButton = ({ onCredential, onError }) => {
  const hasClient = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID)
  const [pending, setPending] = useState(false)
  const [status, setStatus] = useState('')

  const login = useGoogleLogin({
    flow: 'implicit',
    scope: 'openid email profile',
    onSuccess: (tokenResponse) => {
      if (!tokenResponse.access_token) {
        setStatus('Google did not return a token')
        onError?.('Google did not return a token')
        return
      }
      setPending(true)
      setStatus('Completing Google sign-in…')
      Promise.resolve(onCredential?.(tokenResponse.access_token))
        .then(() => setStatus(''))
        .catch((error) => {
          const message = error?.message || 'Unable to finish Google sign-in'
          setStatus(message)
          onError?.(message)
        })
        .finally(() => setPending(false))
    },
    onError: () => {
      const message = 'Google sign-in was cancelled'
      setStatus(message)
      onError?.(message)
    },
  })

  if (!hasClient) {
    return (
      <p className="inline-error">
        Add VITE_GOOGLE_CLIENT_ID to enable Google single sign-on.
      </p>
    )
  }

  return (
    <div className="google-zone">
      <button
        type="button"
        className={`google-faux${pending ? ' is-pending' : ''}`}
        onClick={() => login()}
        disabled={pending}
      >
        <span className="google-faux__icon">G</span>
        <span className="google-faux__text">
          {pending ? 'Signing in…' : 'Sign in with Google'}
        </span>
        <span className="google-badge">Beta</span>
      </button>
      {status ? (
        <p className="google-status" aria-live="polite">
          {status}
        </p>
      ) : null}
    </div>
  )
}

export default GoogleAuthButton
