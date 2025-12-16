import { useId, useState } from 'react'
import { GoogleLogin } from '@react-oauth/google'

const GoogleAuthButton = ({ onCredential, onError }) => {
  const hasClient = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID)
  const [pending, setPending] = useState(false)
  const [status, setStatus] = useState('')
  const noteId = useId()

  if (!hasClient) {
    return (
      <p className="inline-error">
        Add VITE_GOOGLE_CLIENT_ID to enable Google single sign-on.
      </p>
    )
  }

  const handleSuccess = (response) => {
    if (!response.credential) {
      setStatus('Google did not return a credential')
      onError?.('Google did not return a credential')
      return
    }

    setPending(true)
    setStatus('Completing Google sign-in…')

    Promise.resolve(onCredential?.(response.credential))
      .then(() => setStatus(''))
      .catch((error) => {
        const message = error?.message || 'Unable to finish Google sign-in'
        setStatus(message)
        onError?.(message)
      })
      .finally(() => setPending(false))
  }

  const handleError = () => {
    const message = 'Google sign-in was cancelled'
    setStatus(message)
    onError?.(message)
  }

  return (
    <div className="google-zone">
      <div className={`google-button-shell${pending ? ' is-pending' : ''}`}>
        <div className="google-button-hitbox">
          <GoogleLogin
            width={340}
            text="signin_with"
            theme="filled_black"
            shape="pill"
            onSuccess={handleSuccess}
            onError={handleError}
          />
        </div>
        <div className="google-faux" aria-hidden="true">
          <span className="google-faux__icon">G</span>
          <span className="google-faux__text">Sign in with Google</span>
        </div>
        <span className="google-badge">Beta</span>
      </div>
      <p className="google-note" id={noteId}>
        Use Google only after completing email sign-up—
        <span className="google-note__accent">
          we match the Google email to an existing workspace member.
        </span>
      </p>
      {status ? (
        <p className="google-status" aria-live="polite">
          {status}
        </p>
      ) : 
        <p className="google-hint" aria-live="polite">
          Tap the button to reconnect instantly with an approved Google account.
        </p>
      }
    </div>
  )
}

export default GoogleAuthButton
