import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Lock, ArrowRight } from 'lucide-react';
import { authAPI } from '../../services/api';
import { LocationSearch } from './location-search';
import Logo from './Logo';

const inputRow =
  "flex items-center w-full bg-white/[0.06] border border-white/[0.10] h-11 rounded-2xl overflow-hidden px-4 gap-3 " +
  "focus-within:border-red-500/60 focus-within:bg-white/[0.09] focus-within:ring-1 focus-within:ring-red-500/20 transition-all duration-200";

// 0 = empty, 1 = weak, 2 = fair, 3 = good, 4 = strong (advisory only — not enforced)
const getPasswordStrength = (pwd) => {
  if (!pwd) return 0;
  const hasComplexity = /\d/.test(pwd) || /[^a-zA-Z0-9]/.test(pwd);
  const hasMixedCase = /[a-z]/.test(pwd) && /[A-Z]/.test(pwd);
  if (pwd.length < 6) return 1;
  if (pwd.length < 8 || !hasComplexity) return 2;
  if (pwd.length < 10) return 3;
  return hasComplexity && hasMixedCase ? 4 : 3;
};

const STRENGTH_BAR_COLOR = ['bg-white/[0.08]', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-emerald-500'];
const STRENGTH_LABEL = ['', 'Weak', 'Fair', 'Good', 'Strong'];

export default function RegisterForm({ onRegister }) {
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', username: '', email: '', password: '', location: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const navigate = useNavigate();

  const handleChange = (e) =>
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const passwordStrength = getPasswordStrength(formData.password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await authAPI.register({
        username:  formData.username,
        email:     formData.email,
        password:  formData.password,
        firstName: formData.firstName,
        lastName:  formData.lastName,
        location:  formData.location,
      });
      if (response.data.success) {
        const { user: userData, token, refreshToken } = response.data;
        if (token) localStorage.setItem('token', token);
        if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
        localStorage.setItem('driveclique_user', JSON.stringify(userData));
        if (onRegister) onRegister(userData, token, refreshToken);
        sessionStorage.setItem('justLoggedIn', 'true');
        sessionStorage.setItem('justRegistered', 'true');
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-zinc-950">

      {/* ── Left panel ─────────────────────────────────────────────────── */}
      <aside className="hidden md:block md:w-1/2 lg:w-[58%] relative overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1400&q=80"
          alt="Sports car meet"
          className="h-full w-full object-cover scale-105"
          style={{ filter: 'brightness(0.65) contrast(1.1)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/40 to-zinc-950/60" />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-orange-600/15 rounded-full blur-3xl translate-x-1/3 translate-y-1/4 pointer-events-none" />

        <div className="absolute inset-0 flex flex-col justify-between p-10 lg:p-14">
          <div className="flex items-center gap-3">
            <Logo size={36} />
            <div className="flex items-center gap-1">
              <span className="text-lg font-bold text-white tracking-tight">Drive</span>
              <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">Clique</span>
            </div>
          </div>

          <div className="animate-fade-slide-up">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/[0.08] border border-white/[0.12] rounded-full mb-4">
              <div className="w-1.5 h-1.5 bg-orange-400 rounded-full" />
              <span className="text-xs font-medium text-zinc-300">Free to join — forever</span>
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold text-white leading-tight mb-3">
              Find your tribe.<br />Start your journey.
            </h2>
            <p className="text-zinc-400 text-sm leading-relaxed max-w-xs">
              Join thousands of enthusiasts. Find local clubs, schedule drives, and share your passion.
            </p>
          </div>
        </div>
      </aside>

      {/* ── Right panel: register form ─────────────────────────────────── */}
      <main id="main-content" className="w-full md:w-1/2 lg:w-[42%] flex flex-col items-center justify-center bg-zinc-950 px-6 sm:px-10 py-8 overflow-y-auto relative">

        <div className="absolute top-0 left-0 w-72 h-72 bg-orange-600/[0.04] rounded-full blur-3xl pointer-events-none" />

        {/* Mobile logo */}
        <div className="flex items-center gap-3 mb-8 md:hidden">
          <Logo size={36} />
          <div className="flex items-center gap-1">
            <span className="text-xl font-bold text-white">Drive</span>
            <span className="text-xl font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">Clique</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="w-full max-w-[340px] flex flex-col relative z-10">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white tracking-tight">Create your account</h1>
            <p className="text-zinc-400 text-sm mt-1.5">Join the community — it's completely free</p>
          </div>

          {error && (
            <div id="register-error" role="alert" className="mb-5 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 flex items-start gap-2">
              <div className="w-1.5 h-1.5 bg-red-400 rounded-full mt-1.5 shrink-0" />
              <p className="text-red-400 text-sm leading-snug">{error}</p>
            </div>
          )}

          {/* First + Last name */}
          <div className="flex gap-2.5">
            <div className={`${inputRow} flex-1`}>
              <User className="w-4 h-4 text-zinc-400 shrink-0" />
              <input
                type="text" name="firstName" value={formData.firstName}
                onChange={handleChange} placeholder="First" aria-label="First name" autoComplete="given-name"
                aria-invalid={Boolean(error)} aria-describedby={error ? 'register-error' : undefined}
                className="bg-transparent text-white placeholder-zinc-600 outline-none text-sm w-full h-full"
                required
              />
            </div>
            <div className={`${inputRow} flex-1`}>
              <input
                type="text" name="lastName" value={formData.lastName}
                onChange={handleChange} placeholder="Last" aria-label="Last name" autoComplete="family-name"
                aria-invalid={Boolean(error)} aria-describedby={error ? 'register-error' : undefined}
                className="bg-transparent text-white placeholder-zinc-600 outline-none text-sm w-full h-full"
                required
              />
            </div>
          </div>

          {/* Username */}
          <div className={`${inputRow} mt-2.5`}>
            <span className="text-zinc-400 text-sm shrink-0">@</span>
            <input
              type="text" name="username" value={formData.username}
              onChange={handleChange} placeholder="username" aria-label="Username" autoComplete="username"
              aria-invalid={Boolean(error)} aria-describedby={error ? 'register-error' : undefined}
              className="bg-transparent text-white placeholder-zinc-600 outline-none text-sm w-full h-full"
              required
            />
          </div>

          {/* Email */}
          <div className={`${inputRow} mt-2.5`}>
            <Mail className="w-4 h-4 text-zinc-400 shrink-0" />
            <input
              type="email" name="email" value={formData.email}
              onChange={handleChange} placeholder="Email address" aria-label="Email address" autoComplete="email"
              aria-invalid={Boolean(error)} aria-describedby={error ? 'register-error' : undefined}
              className="bg-transparent text-white placeholder-zinc-600 outline-none text-sm w-full h-full"
              required
            />
          </div>

          {/* Password */}
          <div className={`${inputRow} mt-2.5`}>
            <Lock className="w-4 h-4 text-zinc-400 shrink-0" />
            <input
              type="password" name="password" value={formData.password}
              onChange={handleChange} placeholder="Password (min. 8 chars)" aria-label="Password" autoComplete="new-password"
              aria-invalid={Boolean(error)} aria-describedby={error ? 'register-error' : undefined}
              className="bg-transparent text-white placeholder-zinc-600 outline-none text-sm w-full h-full"
              required
              minLength={8}
            />
          </div>

          {formData.password && (
            <div className="mt-1.5 px-0.5">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors duration-200 ${
                      i <= passwordStrength ? STRENGTH_BAR_COLOR[passwordStrength] : 'bg-white/[0.08]'
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                {STRENGTH_LABEL[passwordStrength]
                  ? `${STRENGTH_LABEL[passwordStrength]} — `
                  : ''}
                At least 8 characters, including a number or symbol.
              </p>
            </div>
          )}

          {/* Location */}
          <div className="mt-2.5">
            <LocationSearch
              value={formData.location}
              onChange={(val) => setFormData(prev => ({ ...prev, location: val }))}
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="mt-5 w-full h-11 rounded-2xl text-white font-semibold text-sm
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
                Creating account…
              </span>
            ) : (
              <>Create Account <ArrowRight className="w-4 h-4" /></>
            )}
          </button>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-white/[0.06]" />
            <span className="text-xs text-zinc-400">or</span>
            <div className="flex-1 h-px bg-white/[0.06]" />
          </div>

          <p className="text-zinc-400 text-xs text-center">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-red-400 hover:text-red-300 font-semibold transition-colors"
            >
              Sign in →
            </button>
          </p>
        </form>
      </main>
    </div>
  );
}
