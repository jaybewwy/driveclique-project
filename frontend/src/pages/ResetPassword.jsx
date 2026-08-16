import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Car, CheckCircle } from 'lucide-react';
import { authAPI } from '../services/api';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [formData, setFormData] = useState({ password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-10">
            <Car className="w-16 h-16 mx-auto text-red-500 mb-4" />
            <h1 className="text-5xl font-bold">DriveClique</h1>
          </div>
          <div className="bg-zinc-900 rounded-3xl p-10 text-center">
            <p className="text-red-400 mb-6">This reset link is invalid or missing.</p>
            <button
              onClick={() => navigate('/forgot-password')}
              className="text-red-500 hover:underline font-medium"
            >
              Request a new link
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await authAPI.resetPassword(token, formData.password);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Reset failed. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-10">
            <Car className="w-16 h-16 mx-auto text-red-500 mb-4" />
            <h1 className="text-5xl font-bold">DriveClique</h1>
            <p className="text-zinc-400 mt-2">Connect. Drive. Repeat.</p>
          </div>

          <div className="bg-zinc-900 rounded-3xl p-10 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-6" />
            <h2 className="text-3xl font-bold mb-4">Password updated!</h2>
            <p className="text-zinc-300 mb-8">
              You can now sign in with your new password.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="w-full bg-red-600 hover:bg-red-700 py-4 rounded-2xl font-semibold text-lg transition"
            >
              Go to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <Car className="w-16 h-16 mx-auto text-red-500 mb-4" />
          <h1 className="text-5xl font-bold">DriveClique</h1>
          <p className="text-zinc-400 mt-2">Connect. Drive. Repeat.</p>
        </div>

        <div className="bg-zinc-900 rounded-3xl p-10">
          <h2 className="text-3xl font-bold mb-2 text-center">Set New Password</h2>
          <p className="text-zinc-400 text-center text-sm mb-8">
            Choose a new password for your account.
          </p>

          {error && (
            <div className="bg-red-900/30 border border-red-600 rounded-xl p-4 mb-4">
              <p className="text-red-400 text-center text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <input
              type="password"
              name="password"
              placeholder="New password"
              value={formData.password}
              onChange={handleChange}
              className="w-full bg-black border border-zinc-700 rounded-2xl px-6 py-4 focus:outline-none focus:border-red-600"
              required
            />
            <input
              type="password"
              name="confirmPassword"
              placeholder="Confirm new password"
              value={formData.confirmPassword}
              onChange={handleChange}
              className="w-full bg-black border border-zinc-700 rounded-2xl px-6 py-4 focus:outline-none focus:border-red-600"
              required
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 py-4 rounded-2xl font-semibold text-lg transition disabled:opacity-70"
            >
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/login')}
              className="text-zinc-400 hover:text-zinc-300 text-sm"
            >
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
