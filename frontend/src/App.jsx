import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';

import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard.jsx';

// Initialize state from localStorage directly
const getInitialAuthState = () => {
  const savedUser = localStorage.getItem('driveclique_user');
  return savedUser ? { isAuthenticated: true, user: JSON.parse(savedUser) } : { isAuthenticated: false, user: null };
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(getInitialAuthState().isAuthenticated);
  const [user, setUser] = useState(getInitialAuthState().user);

  const login = (userData) => {
    setIsAuthenticated(true);
    setUser(userData);
    localStorage.setItem('driveclique_user', JSON.stringify(userData));
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUser(null);
    localStorage.removeItem('driveclique_user');
  };

  return (
    <Router>
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" /> : <Login onLogin={login} />} />
        <Route path="/register" element={isAuthenticated ? <Navigate to="/dashboard" /> : <Register />} />
        <Route path="/dashboard" element={isAuthenticated ? <Dashboard user={user} onLogout={logout} /> : <Navigate to="/login" />} />
        <Route path="/" element={<Navigate to="/login" />} />
      </Routes>
    </Router>
  );
}

export default App;