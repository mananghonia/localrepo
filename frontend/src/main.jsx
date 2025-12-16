import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import './index.css'

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

if (!clientId) {
  // Surface a helpful warning without crashing the dev server.
  // eslint-disable-next-line no-console
  console.warn('VITE_GOOGLE_CLIENT_ID is missing. Google sign-in will be disabled.')
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={clientId || 'missing-client-id'}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </GoogleOAuthProvider>
  </StrictMode>,
)
