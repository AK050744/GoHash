import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './store/AuthContext'

// Pages
import HomePage     from './pages/HomePage'
import LoginPage    from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import NotarizePage from './pages/NotarizePage'
import VerifyPage   from './pages/VerifyPage'
import NotFoundPage from './pages/NotFoundPage'

// Layout
import Navbar from './components/layout/Navbar'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  if (isLoading) return <div className="loader">Loading…</div>
  return user ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <>
      <Navbar />
      <main>
        <Routes>
          <Route path="/"         element={<HomePage />} />
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify"   element={<VerifyPage />} />

          <Route
            path="/dashboard"
            element={<ProtectedRoute><DashboardPage /></ProtectedRoute>}
          />
          <Route
            path="/notarize"
            element={<ProtectedRoute><NotarizePage /></ProtectedRoute>}
          />

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
    </>
  )
}
