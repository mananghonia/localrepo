import { Navigate, Route, Routes } from 'react-router-dom'
import DashboardPage from './pages/DashboardPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import SignupPage from './pages/SignupPage.jsx'
import ProfilePage from './pages/ProfilePage.jsx'
import AddExpensePage from './pages/AddExpensePage.jsx'
import FriendsPage from './pages/FriendsPage.jsx'
import ActivityPage from './pages/ActivityPage.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'

function App() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route
        path="/add-expense"
        element={(
          <ProtectedRoute>
            <AddExpensePage />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/friends"
        element={(
          <ProtectedRoute>
            <FriendsPage />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/activity"
        element={(
          <ProtectedRoute>
            <ActivityPage />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/profile"
        element={(
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/dashboard"
        element={<Navigate to="/" replace />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
