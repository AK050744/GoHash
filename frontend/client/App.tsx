import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Routes, Route, useLocation } from "react-router-dom";
import { AppBackground } from "@/components/layout/app-background";
import { AppLayout, PublicLayout } from "@/components/layout/site-layout";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { GoogleAuthProvider } from "@/context/GoogleAuthContext";
import { MetaMaskProvider } from "@/context/MetaMaskContext";
import AdminDashboard from "./pages/AdminDashboard";
import AdminNotaries from "./pages/AdminNotaries";
import Certificate from "./pages/Certificate";
import Dashboard from "./pages/Dashboard";
import DocumentDetails from "./pages/DocumentDetails";
import Forbidden from "./pages/Forbidden";
import Index from "./pages/Index";
import Login from "./pages/Login";
import MyDocuments from "./pages/MyDocuments";
import NotaryDashboard from "./pages/NotaryDashboard";
import NotFound from "./pages/NotFound";
import Profile from "./pages/Profile";
import Register from "./pages/Register";
import RequestReview from "./pages/RequestReview";
import Upload from "./pages/Upload";
import Verify from "./pages/Verify";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

/** Guard: redirects to /login if no user, or /403 if wrong role */
function RequireAuth({
  role,
  children,
}: {
  role?: "USER" | "NOTARY" | "ADMIN" | ("USER" | "NOTARY" | "ADMIN")[];
  children: JSX.Element;
}) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null; // or a spinner
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (role) {
    const allowed = Array.isArray(role) ? role : [role];
    if (!allowed.includes(user.role)) {
      return (
        <Navigate
          to="/403"
          state={{
            requiredRoles: allowed,
            currentRole: user.role,
            from: location.pathname,
          }}
          replace
        />
      );
    }
  }
  return children;
}

function DashboardRedirect() {
  const { user } = useAuth();
  if (user?.role === "ADMIN") return <Navigate to="/admin/dashboard" replace />;
  if (user?.role === "NOTARY") return <Navigate to="/notary/dashboard" replace />;
  return <Dashboard />;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  // Derive nav role from the authenticated user (undefined = public)
  const navRole = user?.role ?? undefined;

  // While restoring session, render nothing to avoid layout flicker
  if (loading) return null;

  return (
    <Routes>
      {/* ── Public routes ── */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Index />} />
        <Route
          path="/login"
          element={
            user ? (
              <Navigate
                to={
                  user.role === "ADMIN"
                    ? "/admin/dashboard"
                    : user.role === "NOTARY"
                      ? "/notary/dashboard"
                      : "/dashboard"
                }
                replace
              />
            ) : (
              <Login />
            )
          }
        />
        <Route
          path="/register"
          element={user ? <Navigate to="/dashboard" replace /> : <Register />}
        />
        <Route path="/verify" element={<Verify />} />
        <Route path="/403" element={<Forbidden />} />
      </Route>

      {/* ── Authenticated routes ── */}
      <Route element={<AppLayout role={navRole ?? "USER"} />}>
        <Route
          path="/dashboard"
          element={
            <RequireAuth role={["USER", "NOTARY", "ADMIN"]}>
              <DashboardRedirect />
            </RequireAuth>
          }
        />
        <Route
          path="/upload"
          element={
            <RequireAuth role={["USER", "NOTARY", "ADMIN"]}>
              <Upload />
            </RequireAuth>
          }
        />
        <Route
          path="/my-documents"
          element={
            <RequireAuth role={["USER", "NOTARY", "ADMIN"]}>
              <MyDocuments />
            </RequireAuth>
          }
        />
        <Route
          path="/documents/:id"
          element={
            <RequireAuth role={["USER", "NOTARY", "ADMIN"]}>
              <DocumentDetails />
            </RequireAuth>
          }
        />
        <Route
          path="/profile"
          element={
            <RequireAuth role={["USER", "NOTARY", "ADMIN"]}>
              <Profile />
            </RequireAuth>
          }
        />
        <Route
          path="/notary/dashboard"
          element={
            <RequireAuth role="NOTARY">
              <NotaryDashboard />
            </RequireAuth>
          }
        />
        <Route
          path="/notary/requests/:id"
          element={
            <RequireAuth role="NOTARY">
              <RequestReview />
            </RequireAuth>
          }
        />
        <Route
          path="/admin/dashboard"
          element={
            <RequireAuth role="ADMIN">
              <AdminDashboard />
            </RequireAuth>
          }
        />
        <Route
          path="/admin/notaries"
          element={
            <RequireAuth role="ADMIN">
              <AdminNotaries />
            </RequireAuth>
          }
        />
      </Route>

      {/* ── Certificate (no role guard, owner check happens server-side) ── */}
      <Route element={<PublicLayout />}>
        <Route
          path="/documents/:id/certificate"
          element={<Certificate />}
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <GoogleAuthProvider>
            <MetaMaskProvider>
              <AppBackground />
              <AppRoutes />
            </MetaMaskProvider>
          </GoogleAuthProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
