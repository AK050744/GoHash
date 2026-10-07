import { Routes, Route } from 'react-router-dom'
import { PublicLayout }  from '../components/layout/PublicLayout'
import { AppLayout }     from '../components/layout/AppLayout'
import { ProtectedRoute, RoleRoute } from './guards'

// Public pages
import LandingPage           from '../pages/public/LandingPage'
import LoginPage             from '../pages/public/LoginPage'
import RegisterPage          from '../pages/public/RegisterPage'
import VerifyPage            from '../pages/public/VerifyPage'
import NotFoundPage          from '../pages/public/NotFoundPage'
import UnauthorizedPage      from '../pages/public/UnauthorizedPage'

// User pages
import DashboardPage         from '../pages/user/DashboardPage'
import DocumentsPage         from '../pages/user/DocumentsPage'
import UploadPage            from '../pages/user/UploadPage'
import ProfilePage           from '../pages/user/ProfilePage'
import DocumentDetailPage    from '../pages/user/DocumentDetailPage'

// Notary pages
import NotaryDashboardPage       from '../pages/notary/NotaryDashboardPage'
import NotaryRequestDetailPage   from '../pages/notary/NotaryRequestDetailPage'

// Admin pages
import AdminDashboardPage    from '../pages/admin/AdminDashboardPage'
import AdminNotariesPage     from '../pages/admin/AdminNotariesPage'

export default function AppRoutes() {
  return (
    <Routes>
      {/* ── Public ── */}
      <Route element={<PublicLayout />}>
        <Route path="/"            element={<LandingPage />} />
        <Route path="/login"       element={<LoginPage />} />
        <Route path="/register"    element={<RegisterPage />} />
        <Route path="/verify"      element={<VerifyPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route path="/403"          element={<UnauthorizedPage />} />
        <Route path="*"            element={<NotFoundPage />} />
      </Route>

      {/* ── App (requires auth) ── */}
      <Route element={
        <ProtectedRoute>
          <AppLayout />
        </ProtectedRoute>
      }>
        {/* USER */}
        <Route path="/dashboard"        element={<DashboardPage />} />
        <Route path="/documents"        element={<DocumentsPage />} />
        <Route path="/documents/:id"    element={<DocumentDetailPage />} />
        <Route path="/upload"           element={<UploadPage />} />
        <Route path="/profile"          element={<ProfilePage />} />

        {/* NOTARY */}
        <Route path="/notary/dashboard"       element={
          <RoleRoute roles={['NOTARY']}>
            <NotaryDashboardPage />
          </RoleRoute>
        } />
        <Route path="/notary/requests/:id"   element={
          <RoleRoute roles={['NOTARY']}>
            <NotaryRequestDetailPage />
          </RoleRoute>
        } />

        {/* ADMIN */}
        <Route path="/admin/dashboard"  element={
          <RoleRoute roles={['ADMIN']}>
            <AdminDashboardPage />
          </RoleRoute>
        } />
        <Route path="/admin/notaries"   element={
          <RoleRoute roles={['ADMIN']}>
            <AdminNotariesPage />
          </RoleRoute>
        } />
      </Route>
    </Routes>
  )
}
