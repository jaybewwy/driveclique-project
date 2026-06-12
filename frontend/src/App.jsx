import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import { AuthProvider, useAuth } from './hooks/useAuth';
import { ClubsProvider } from './hooks/useClubs';
import ToastProvider from './components/Toast';

// Auth pages are small and eagerly loaded — users hit these before JS finishes parsing
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';

// Authenticated pages are lazy-loaded — only downloaded after login
const Dashboard    = lazy(() => import('./pages/Dashboard'));
const MyClubs      = lazy(() => import('./pages/MyClubs'));
const ClubDetail   = lazy(() => import('./pages/ClubDetail'));
const CreateClub   = lazy(() => import('./pages/CreateClub'));
const FindClub     = lazy(() => import('./pages/FindClub'));
const Profile      = lazy(() => import('./pages/Profile'));
const UserSettings = lazy(() => import('./pages/UserSettings'));
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

  return (
    <Suspense fallback={<PageSpinner />}>
      <Routes>
        <Route path="/login"            element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login onLogin={login} />} />
        <Route path="/register"         element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Register onRegister={login} />} />
        <Route path="/forgot-password"  element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <ForgotPassword />} />
        <Route path="/reset-password"   element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <ResetPassword />} />
        <Route path="/verify-email"     element={<VerifyEmail />} />

        <Route path="/dashboard"    element={isAuthenticated ? <Dashboard    user={user} onLogout={logout} /> : <Navigate to="/login" replace />} />
        <Route path="/my-clubs"     element={isAuthenticated ? <MyClubs      user={user} onLogout={logout} /> : <Navigate to="/login" replace />} />
        <Route path="/club/:clubId" element={isAuthenticated ? <ClubDetail   user={user} onLogout={logout} /> : <Navigate to="/login" replace />} />
        <Route path="/create-club"  element={isAuthenticated ? <CreateClub /> : <Navigate to="/login" replace />} />
        <Route path="/find-club"    element={isAuthenticated ? <FindClub     user={user} onLogout={logout} /> : <Navigate to="/login" replace />} />
        <Route path="/profile"      element={isAuthenticated ? <Profile      user={user} onLogout={logout} onUpdateUser={updateUser} /> : <Navigate to="/login" replace />} />
        <Route path="/settings"     element={isAuthenticated ? <UserSettings user={user} onLogout={logout} onUpdateUser={updateUser} /> : <Navigate to="/login" replace />} />
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
