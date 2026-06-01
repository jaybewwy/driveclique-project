import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, Lock, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { authAPI } from '../../services/api';

export default function LoginForm({ onLogin }) {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await authAPI.login(formData);
      if (response.data.success && onLogin) {
        const { token, refreshToken } = response.data;
        if (token) localStorage.setItem('token', token);
        if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
        try {
          const profileResponse = await authAPI.getProfile();
          if (profileResponse.data.success) {
            const fullUser = profileResponse.data.user;
            localStorage.setItem('driveclique_user', JSON.stringify(fullUser));
            onLogin(fullUser, token, refreshToken);
          } else {
            localStorage.setItem('driveclique_user', JSON.stringify(response.data.user));
            onLogin(response.data.user, token, refreshToken);
          }
        } catch {
          localStorage.setItem('driveclique_user', JSON.stringify(response.data.user));
          onLogin(response.data.user, token, refreshToken);
        }
        sessionStorage.setItem('justLoggedIn', 'true');
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden">

      {/* ── Left panel: car image (hidden on mobile) ── */}
      <div className="hidden md:block md:w-1/2 lg:w-[58%] relative overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1400&q=80"
          alt="Sports car"
          className="h-full w-full object-cover"
        />
        {/* Gradient overlay with branding */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent flex flex-col justify-end p-12">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-600/30">
              <Car className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">DriveClique</span>
          </div>
          <p className="text-zinc-300 text-base max-w-xs leading-relaxed">
            Connect with car enthusiasts. Discover drives. Build your crew.
          </p>
        </div>
      </div>

      {/* ── Right panel: login form ── */}
      <div className="w-full md:w-1/2 lg:w-[42%] flex flex-col items-center justify-center bg-zinc-950 px-8 py-12">

        {/* Mobile-only logo */}
        <div className="flex items-center gap-3 mb-10 md:hidden">
          <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center">
            <Car className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-bold text-white">DriveClique</span>
        </div>

        <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col">
          <h2 className="text-3xl font-bold text-white">Sign in</h2>
          <p className="text-zinc-400 text-sm mt-2">Welcome back! Please sign in to continue</p>

          {/* Error banner */}
          {error && (
            <div className="mt-5 bg-red-900/30 border border-red-600/50 rounded-xl px-4 py-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Username */}
          <div className={cn(
            "flex items-center mt-7 w-full bg-transparent border border-zinc-700 h-12 rounded-2xl overflow-hidden pl-5 gap-3",
            "focus-within:border-red-500 transition-colors duration-200"
          )}>
            <User className="w-4 h-4 text-zinc-500 shrink-0" />
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="Username"
              autoComplete="username"
              className="bg-transparent text-white placeholder-zinc-500 outline-none text-sm w-full h-full"
              required
            />
          </div>

          {/* Password */}
          <div className={cn(
            "flex items-center mt-4 w-full bg-transparent border border-zinc-700 h-12 rounded-2xl overflow-hidden pl-5 gap-3",
            "focus-within:border-red-500 transition-colors duration-200"
          )}>
            <Lock className="w-4 h-4 text-zinc-500 shrink-0" />
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Password"
              autoComplete="current-password"
              className="bg-transparent text-white placeholder-zinc-500 outline-none text-sm w-full h-full"
              required
            />
          </div>

          {/* Remember me + Forgot password */}
          <div className="flex items-center justify-between mt-5 text-sm">
            <label className="flex items-center gap-2 text-zinc-400 cursor-pointer select-none">
              <input type="checkbox" className="accent-red-600 h-4 w-4 rounded" />
              Remember me
            </label>
            <button
              type="button"
              onClick={() => navigate('/forgot-password')}
              className="text-red-500 hover:underline"
            >
              Forgot password?
            </button>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="mt-8 w-full h-12 rounded-2xl text-white bg-red-600 hover:bg-red-700 font-semibold text-base transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>

          {/* Sign up link */}
          <p className="text-zinc-400 text-sm text-center mt-5">
            Don't have an account?{' '}
            <button
              type="button"
              onClick={() => navigate('/register')}
              className="text-red-400 hover:underline font-medium"
            >
              Sign Up
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
