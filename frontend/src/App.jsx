import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';

import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import MyClubs from './pages/MyClubs';
import ClubPage from './pages/ClubPage';
import ClubDetail from './pages/ClubDetail';
import CreateClub from './pages/CreateClub';
import FindClub from './pages/FindClub';
import Profile from './pages/Profile';

function getInitialAuth() {
  try {
    const savedUser = localStorage.getItem('driveclique_user');
    const token = localStorage.getItem('token');
    
    if (savedUser && token) {
      const parsedUser = JSON.parse(savedUser);
      return { isAuthenticated: true, user: parsedUser };
    }
  } catch {
    localStorage.removeItem('driveclique_user');
    localStorage.removeItem('token');
  }
  return { isAuthenticated: false, user: null };
}

function App() {
  const initialAuth = getInitialAuth();
  const [isAuthenticated, setIsAuthenticated] = useState(initialAuth.isAuthenticated);
  const [user, setUser] = useState(initialAuth.user);

  const login = (userData) => {
    setIsAuthenticated(true);
    setUser(userData);
    localStorage.setItem('driveclique_user', JSON.stringify(userData));
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUser(null);
    localStorage.removeItem('driveclique_user');
    localStorage.removeItem('token');
  };

  return (
    <Router>
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login onLogin={login} />} />
        <Route path="/register" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Register onRegister={login} />} />

        <Route path="/dashboard" element={isAuthenticated ? <Dashboard user={user} onLogout={logout} /> : <Navigate to="/login" replace />} />
        <Route path="/my-clubs" element={isAuthenticated ? <MyClubs user={user} onLogout={logout} /> : <Navigate to="/login" replace />} />
        <Route path="/clubs/:clubId" element={isAuthenticated ? <ClubPage user={user} onLogout={logout} /> : <Navigate to="/login" replace />} />
        <Route path="/club/:clubId" element={isAuthenticated ? <ClubDetail user={user} onLogout={logout} /> : <Navigate to="/login" replace />} />
        <Route path="/create-club" element={isAuthenticated ? <CreateClub user={user} onLogout={logout} /> : <Navigate to="/login" replace />} />
        <Route path="/find-club" element={isAuthenticated ? <FindClub user={user} onLogout={logout} /> : <Navigate to="/login" replace />} />
        <Route path="/profile" element={isAuthenticated ? <Profile user={user} onLogout={logout} /> : <Navigate to="/login" replace />} />

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;