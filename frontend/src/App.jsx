import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import { AuthProvider, useAuth } from './hooks/useAuth';
import { ClubsProvider } from './hooks/useClubs';
import ToastProvider from './components/Toast';
import PageViewTracker from './components/PageViewTracker';
import SkipToContent from './components/SkipToContent';
import { PUBLIC_ROUTES } from './lib/publicRoutes';

// Auth pages are small and eagerly loaded — users hit these before JS finishes parsing
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';
import ConfirmEmailChange from './pages/ConfirmEmailChange';

// Authenticated pages are lazy-loaded — only downloaded after login
const Dashboard    = lazy(() => import('./pages/Dashboard'));
const CalendarPage = lazy(() => import('./pages/Calendar'));
const MyClubs      = lazy(() => import('./pages/MyClubs'));
const ClubDetail   = lazy(() => import('./pages/ClubDetail'));
const CreateClub   = lazy(() => import('./pages/CreateClub'));
const FindClub     = lazy(() => import('./pages/FindClub'));
const Profile      = lazy(() => import('./pages/Profile'));
const UserSettings = lazy(() => import('./pages/UserSettings'));
const DriveCheckIn = lazy(() => import('./pages/DriveCheckIn'));
const AdminAnalytics = lazy(() => import('./pages/AdminAnalytics'));
const NotFound     = lazy(() => import('./pages/NotFound'));

const PageSpinner = () => (
  <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
    <div className="w-10 h-10 border-4 border-zinc-800 border-t-red-500 rounded-full animate-spin" />
  </div>
);

function AppRoutes() {
  const { isAuthenticated, isLoading, user, login, logout, updateUser } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-zinc-800 border-t-red-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Dev-only guard against the route table and PUBLIC_ROUTES (which
  // services/api.js's 401 interceptor relies on) drifting apart — a route
  // added to one but not the other fails silently in production (a visitor
  // gets bounced to /login on a stray background 401) with nothing to point
  // at the actual cause, so this makes the drift loud in the dev console
  // immediately instead. The list below must mirror exactly the <Route>
  // paths declared without an isAuthenticated ? ... : ... auth gate.
  if (import.meta.env.DEV) {
    const declaredPublicPaths = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/confirm-email-change'];
    const missing = PUBLIC_ROUTES.filter((p) => !declaredPublicPaths.includes(p));
    const extra = declaredPublicPaths.filter((p) => !PUBLIC_ROUTES.includes(p));
    if (missing.length || extra.length) {
      console.error('[publicRoutes] App.jsx route table and PUBLIC_ROUTES have drifted:', { missing, extra });
    }
  }

  return (
    <Suspense fallback={<PageSpinner />}>
      <SkipToContent />
      <PageViewTracker />
      <Routes>
        <Route path="/login"            element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login onLogin={login} />} />
        <Route path="/register"         element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Register onRegister={login} />} />
        <Route path="/forgot-password"  element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <ForgotPassword />} />
        <Route path="/reset-password"   element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <ResetPassword />} />
        <Route path="/verify-email"     element={<VerifyEmail />} />
        <Route path="/confirm-email-change" element={<ConfirmEmailChange />} />

        <Route path="/dashboard"    element={isAuthenticated ? <Dashboard    user={user} onLogout={logout} /> : <Navigate to="/login" replace />} />
        <Route path="/calendar"     element={isAuthenticated ? <CalendarPage user={user} onLogout={logout} /> : <Navigate to="/login" replace />} />
        <Route path="/my-clubs"     element={isAuthenticated ? <MyClubs      user={user} onLogout={logout} /> : <Navigate to="/login" replace />} />
        <Route path="/club/:clubId" element={isAuthenticated ? <ClubDetail   user={user} onLogout={logout} /> : <Navigate to="/login" replace />} />
        <Route path="/create-club"  element={isAuthenticated ? <CreateClub /> : <Navigate to="/login" replace />} />
        <Route path="/find-club"    element={isAuthenticated ? <FindClub     user={user} onLogout={logout} /> : <Navigate to="/login" replace />} />
        <Route path="/profile"      element={isAuthenticated ? <Profile      user={user} onLogout={logout} onUpdateUser={updateUser} /> : <Navigate to="/login" replace />} />
        <Route path="/settings"     element={isAuthenticated ? <UserSettings user={user} onLogout={logout} onUpdateUser={updateUser} /> : <Navigate to="/login" replace />} />
        <Route path="/drive/:driveId/checkin" element={isAuthenticated ? <DriveCheckIn user={user} onLogout={logout} /> : <Navigate to="/login" replace />} />
        <Route path="/admin/analytics" element={isAuthenticated ? <AdminAnalytics user={user} onLogout={logout} /> : <Navigate to="/login" replace />} />
        {/* Legacy alias kept so old nav links don't silently redirect to /dashboard */}
        <Route path="/analytics"    element={<Navigate to="/settings" replace />} />

        <Route path="/"  element={<Navigate to="/login" replace />} />
        <Route path="*"  element={<NotFound isAuthenticated={isAuthenticated} />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <Router>
      <ToastProvider>
        <AuthProvider>
          <ClubsProvider>
            <AppRoutes />
          </ClubsProvider>
        </AuthProvider>
      </ToastProvider>
    </Router>
  );
}

export default App;
