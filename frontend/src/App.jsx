import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import { AuthProvider, useAuth } from './hooks/useAuth';
import { ClubsProvider } from './hooks/useClubs';
import ToastProvider from './components/Toast';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import MyClubs from './pages/MyClubs';
import ClubDetail from './pages/ClubDetail';
import CreateClub from './pages/CreateClub';
import FindClub from './pages/FindClub';
import Profile from './pages/Profile';

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
    <Routes>
      <Route path="/login"    element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login onLogin={login} />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Register onRegister={login} />} />

      <Route path="/dashboard"  element={isAuthenticated ? <Dashboard   user={user} onLogout={logout} /> : <Navigate to="/login" replace />} />
      <Route path="/my-clubs"   element={isAuthenticated ? <MyClubs     user={user} onLogout={logout} /> : <Navigate to="/login" replace />} />
      <Route path="/club/:clubId" element={isAuthenticated ? <ClubDetail user={user} onLogout={logout} /> : <Navigate to="/login" replace />} />
      <Route path="/create-club"  element={isAuthenticated ? <CreateClub user={user} onLogout={logout} /> : <Navigate to="/login" replace />} />
      <Route path="/find-club"    element={isAuthenticated ? <FindClub   user={user} onLogout={logout} /> : <Navigate to="/login" replace />} />
      <Route path="/profile"      element={isAuthenticated ? <Profile    user={user} onLogout={logout} onUpdateUser={updateUser} /> : <Navigate to="/login" replace />} />

      <Route path="/"  element={<Navigate to="/login" replace />} />
      <Route path="*"  element={<Navigate to="/login" replace />} />
    </Routes>
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
