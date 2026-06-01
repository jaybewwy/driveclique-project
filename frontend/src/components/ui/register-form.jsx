import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, User, Mail, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { authAPI } from '../../services/api';
import { LocationSearch } from './location-search';

const inputRow = cn(
  "flex items-center w-full bg-transparent border border-zinc-700 h-12 rounded-2xl overflow-hidden pl-5 gap-3",
  "focus-within:border-red-500 transition-colors duration-200"
);

export default function RegisterForm({ onRegister }) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName:  '',
    username:  '',
    email:     '',
    password:  '',
    location:  '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

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
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden">

      {/* ── Left panel ── */}
      <div className="hidden md:block md:w-1/2 lg:w-[58%] relative overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1400&q=80"
          alt="Sports car meet"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent flex flex-col justify-end p-12">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-600/30">
              <Car className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">DriveClique</span>
          </div>
          <p className="text-zinc-300 text-base max-w-xs leading-relaxed">
            Join thousands of enthusiasts. Find your club. Hit the road.
          </p>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="w-full md:w-1/2 lg:w-[42%] flex flex-col items-center justify-center bg-zinc-950 px-8 py-10 overflow-y-auto">

        {/* Mobile logo */}
        <div className="flex items-center gap-3 mb-8 md:hidden">
          <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center">
            <Car className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-bold text-white">DriveClique</span>
        </div>

        <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col">
          <h2 className="text-3xl font-bold text-white">Create account</h2>
          <p className="text-zinc-400 text-sm mt-2">Join the community — it's free</p>

          {error && (
            <div className="mt-5 bg-red-900/30 border border-red-600/50 rounded-xl px-4 py-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* First name + Last name */}
          <div className="flex gap-3 mt-7">
            <div className={cn(inputRow, "flex-1")}>
              <User className="w-4 h-4 text-zinc-500 shrink-0" />
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                placeholder="First name"
                autoComplete="given-name"
                className="bg-transparent text-white placeholder-zinc-500 outline-none text-sm w-full h-full"
                required
              />
            </div>
            <div className={cn(inputRow, "flex-1")}>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                placeholder="Last name"
                autoComplete="family-name"
                className="bg-transparent text-white placeholder-zinc-500 outline-none text-sm w-full h-full pl-2"
                required
              />
            </div>
          </div>

          {/* Username */}
          <div className={cn(inputRow, "mt-4")}>
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

          {/* Email */}
          <div className={cn(inputRow, "mt-4")}>
            <Mail className="w-4 h-4 text-zinc-500 shrink-0" />
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Email address"
              autoComplete="email"
              className="bg-transparent text-white placeholder-zinc-500 outline-none text-sm w-full h-full"
              required
            />
          </div>

          {/* Password */}
          <div className={cn(inputRow, "mt-4")}>
            <Lock className="w-4 h-4 text-zinc-500 shrink-0" />
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Password"
              autoComplete="new-password"
              className="bg-transparent text-white placeholder-zinc-500 outline-none text-sm w-full h-full"
              required
            />
          </div>

          {/* Location search */}
          <div className="mt-4">
            <LocationSearch
              value={formData.location}
              onChange={(val) => setFormData(prev => ({ ...prev, location: val }))}
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="mt-8 w-full h-12 rounded-2xl text-white bg-red-600 hover:bg-red-700 font-semibold text-base transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>

          <p className="text-zinc-400 text-sm text-center mt-5">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-red-400 hover:underline font-medium"
            >
              Sign In
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
