import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car } from 'lucide-react';
import axios from 'axios';

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post('http://localhost:5000/api/auth/login', {
        username,
        password
      });

      if (response.data.success) {
        if (onLogin) {
          onLogin(response.data.user);
        }
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('driveclique_user', JSON.stringify(response.data.user));
        navigate('/dashboard');
      } else {
        setError(response.data.message || 'Login failed');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Invalid username or password';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <Car className="w-16 h-16 mx-auto text-red-500 mb-4" />
          <h1 className="text-5xl font-bold">DriveClique</h1>
          <p className="text-zinc-400 mt-2">Connect. Drive. Repeat.</p>
        </div>

        <div className="bg-zinc-900 rounded-3xl p-10">
          <h2 className="text-3xl font-bold mb-8 text-center">Sign In</h2>

          {error && <p className="text-red-500 text-center mb-4">{error}</p>}

          <form onSubmit={handleSubmit} className="space-y-6">
            <input 
              type="text" 
              placeholder="Username" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-black border border-zinc-700 rounded-2xl px-6 py-4 focus:outline-none focus:border-red-600"
              required 
            />
            <input 
              type="password" 
              placeholder="Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black border border-zinc-700 rounded-2xl px-6 py-4 focus:outline-none focus:border-red-600"
              required 
            />

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 py-4 rounded-2xl font-semibold text-lg transition disabled:opacity-70"
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-zinc-400">
              Do not have an account?{' '}
              <button 
                onClick={() => navigate('/register')}
                className="text-red-500 hover:underline font-medium"
              >
                Sign Up
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;