import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, Lock, User, ArrowRight } from 'lucide-react';
import { authAPI } from '../../services/api';

/* Shared input row style */
const inputRow =
  "flex items-center w-full bg-white/[0.06] border border-white/[0.10] h-11 rounded-2xl overflow-hidden px-4 gap-3 " +
  "focus-within:border-red-500/60 focus-within:bg-white/[0.09] focus-within:ring-1 focus-within:ring-red-500/20 transition-all duration-200";

export default function LoginForm({ onLogin }) {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) =>
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

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
    <div className="flex h-screen w-full overflow-hidden bg-zinc-950">

      {/* ── Left panel: hero image with overlay ───────────────────────── */}
      <div className="hidden md:block md:w-1/2 lg:w-[58%] relative overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1400&q=80"
          alt="Sports car"
          className="h-full w-full object-cover scale-105"
          style={{ filter: 'brightness(0.7) contrast(1.1)' }}
        />

        {/* Multi-layer gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/40 to-zinc-950/60" />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent" />

        {/* Ambient glow accent */}
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-red-600/20 rounded-full blur-3xl -translate-x-1/3 translate-y-1/3 pointer-events-none" />

        {/* Branding content */}
        <div className="absolute inset-0 flex flex-col justify-between p-10 lg:p-14">
          {/* Top logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-red-600 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/30">
              <Car className="w-4.5 h-4.5 text-white" />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-lg font-bold text-white tracking-tight">Drive</span>
              <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">Clique</span>
            </div>
          </div>

          {/* Bottom tagline */}
          <div className="animate-fade-slide-up">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/[0.08] border border-white/[0.12] rounded-full mb-4">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
              <span className="text-xs font-medium text-zinc-300">3,200+ members worldwide</span>
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold text-white leading-tight mb-3">
              Your crew is<br />waiting for you.
            </h2>
            <p className="text-zinc-400 text-sm leading-relaxed max-w-xs">
              Connect with car enthusiasts, discover drives, and build your community — all in one place.
            </p>
          </div>
        </div>
      </div>

      {/* ── Right panel: sign-in form ──────────────────────────────────── */}
      <div className="w-full md:w-1/2 lg:w-[42%] flex flex-col items-center justify-center bg-zinc-950 px-6 sm:px-10 py-12 relative overflow-hidden">

        {/* Subtle ambient gradient */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-red-600/[0.04] rounded-full blur-3xl pointer-events-none" />

        {/* Mobile logo */}
        <div className="flex items-center gap-3 mb-10 md:hidden">
          <div className="w-9 h-9 bg-gradient-to-br from-red-600 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/30">
            <Car className="w-4.5 h-4.5 text-white" />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xl font-bold text-white">Drive</span>
            <span className="text-xl font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">Clique</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="w-full max-w-[340px] flex flex-col relative z-10">
          <div className="mb-7">
            <h2 className="text-2xl font-bold text-white tracking-tight">Welcome back</h2>
            <p className="text-zinc-500 text-sm mt-1.5">Sign in to your account to continue</p>
          </div>

          {/* Error banner */}
          {error && (
            <div className="mb-5 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 flex items-start gap-2">
              <div className="w-1.5 h-1.5 bg-red-400 rounded-full mt-1.5 shrink-0" />
              <p className="text-red-400 text-sm leading-snug">{error}</p>
            </div>
          )}

          {/* Username */}
          <div className={inputRow}>
            <User className="w-4 h-4 text-zinc-500 shrink-0" />
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="Username"
              autoComplete="username"
              className="bg-transparent text-white placeholder-zinc-600 outline-none text-sm w-full h-full"
              required
            />
          </div>

          {/* Password */}
          <div className={`${inputRow} mt-3`}>
            <Lock className="w-4 h-4 text-zinc-500 shrink-0" />
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Password"
              autoComplete="current-password"
              className="bg-transparent text-white placeholder-zinc-600 outline-none text-sm w-full h-full"
              required
            />
          </div>

          {/* Remember + Forgot */}
          <div className="flex items-center justify-between mt-4 text-xs">
            <label className="flex items-center gap-2 text-zinc-500 cursor-pointer select-none hover:text-zinc-400 transition-colors">
              <input type="checkbox" className="accent-red-600 h-3.5 w-3.5 rounded" />
              Remember me
            </label>
            <button
              type="button"
              onClick={() => navigate('/forgot-password')}
              className="text-zinc-500 hover:text-red-400 transition-colors"
            >
              Forgot password?
            </button>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full h-11 rounded-2xl text-white font-semibold text-sm
                       bg-gradient-to-r from-red-600 to-orange-600
                       shadow-lg shadow-red-500/25 hover:shadow-red-500/40
                       hover:scale-[1.02] active:scale-[0.98]
                       transition-all duration-200
                       disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100
                       flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                Signing in…
              </span>
            ) : (
              <>Sign In <ArrowRight className="w-4 h-4" /></>
            )}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-white/[0.06]" />
            <span className="text-xs text-zinc-600">or</span>
            <div className="flex-1 h-px bg-white/[0.06]" />
          </div>

          {/* Sign-up link */}
          <p className="text-zinc-500 text-xs text-center">
            New to DriveClique?{' '}
            <button
              type="button"
              onClick={() => navigate('/register')}
              className="text-red-400 hover:text-red-300 font-semibold transition-colors"
            >
              Create an account →
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
