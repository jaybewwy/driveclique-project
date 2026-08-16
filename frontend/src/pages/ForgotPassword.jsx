import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, CheckCircle } from 'lucide-react';
import { authAPI } from '../services/api';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await authAPI.forgotPassword(email);
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
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
            <h2 className="text-3xl font-bold mb-4">Check your email</h2>
            <p className="text-zinc-300 mb-3">
              If an account with that email exists, we've sent a password reset link. It expires in 1 hour.
            </p>
            <p className="text-zinc-400 text-sm mb-8">
              Don't see it? Check your spam folder.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="text-red-500 hover:underline font-medium"
            >
              Back to Sign In
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
          <h2 className="text-3xl font-bold mb-2 text-center">Forgot Password</h2>
          <p className="text-zinc-400 text-center text-sm mb-8">
            Enter your email and we'll send you a reset link.
          </p>

          {error && (
            <div className="bg-red-900/30 border border-red-600 rounded-xl p-4 mb-4">
              <p className="text-red-400 text-center text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
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
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-zinc-400">
              Remember your password?{' '}
              <button
                onClick={() => navigate('/login')}
                className="text-red-500 hover:underline font-medium"
              >
                Sign In
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
