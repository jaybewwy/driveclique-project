import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, CheckCircle, ArrowLeft } from 'lucide-react';
import axios from 'axios';

const Register = ({ onRegister }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post('http://localhost:5000/api/auth/register', {
        username,
        email,
        password,
        name: username
      });

      if (response.data.success) {
        const userData = response.data.user;
        if (onRegister) {
          onRegister(userData);
        }
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('driveclique_user', JSON.stringify(userData));
        navigate('/dashboard');
      }
    } catch (err) {
      console.error('Register error:', err);
      setError(err.response?.data?.message || 'Registration failed');
      setSuccess('');
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
          <p className="text-zinc-400 mt-2">Join the community</p>
        </div>

        <div className="bg-zinc-900 rounded-3xl p-10">
          <h2 className="text-3xl font-bold mb-8 text-center">Create Account</h2>

          {success && (
            <div className="bg-green-900/30 border border-green-600 rounded-xl p-4 mb-6 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              <p className="text-green-400 text-center text-sm">{success}</p>
            </div>
          )}

          {error && (
            <div className="bg-red-900/30 border border-red-600 rounded-xl p-4 mb-6 flex items-center gap-3">
              <p className="text-red-400 text-center text-sm">{error}</p>
            </div>
          )}

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

            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black border border-zinc-700 rounded-2xl px-6 py-4 focus:outline-none focus:border-red-600"
              required
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 py-4 rounded-2xl font-semibold text-lg transition disabled:opacity-70"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-zinc-400">
              Already have an account?{' '}
              <button
                onClick={() => navigate('/login')}
                className="text-red-500 hover:underline font-medium"
              >
                Sign In
              </button>
            </p>
            <button
              onClick={() => navigate('/')}
              className="mt-4 text-zinc-500 hover:text-zinc-300 text-sm flex items-center justify-center gap-2 mx-auto"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;