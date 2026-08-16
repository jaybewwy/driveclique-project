import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Car, CheckCircle, XCircle } from 'lucide-react';
import { authAPI } from '../services/api';
import { useAuth } from '../hooks/useAuth';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();

  const [status, setStatus] = useState('verifying'); // 'verifying' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) {
      setErrorMsg('This verification link is invalid or missing a token.');
      setStatus('error');
      return;
    }

    authAPI.verifyEmail(token)
      .then(async () => {
        // Sync user state if they are still logged in on this device
        if (user) {
          try {
            const profile = await authAPI.getProfile();
            if (profile.data.success) updateUser(profile.data.user);
          } catch (error) {
            // Non-critical — state will sync on next page load
            console.error('Failed to sync profile after email verification:', error);
          }
        }
        setStatus('success');
      })
      .catch((err) => {
        setErrorMsg(
          err.response?.data?.message ||
          'Verification failed. The link may have expired.'
        );
        setStatus('error');
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const chrome = (
    <div className="text-center mb-10">
      <Car className="w-16 h-16 mx-auto text-red-500 mb-4" />
      <h1 className="text-5xl font-bold">DriveClique</h1>
      <p className="text-zinc-400 mt-2">Connect. Drive. Repeat.</p>
    </div>
  );

  if (status === 'verifying') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {chrome}
          <div className="bg-zinc-900 rounded-3xl p-10 text-center">
            <div className="w-12 h-12 border-4 border-zinc-700 border-t-red-500 rounded-full animate-spin mx-auto mb-6" />
            <p className="text-zinc-400">Verifying your email…</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {chrome}
          <div className="bg-zinc-900 rounded-3xl p-10 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-6" />
            <h2 className="text-3xl font-bold mb-4">Email verified!</h2>
            <p className="text-zinc-300 mb-8">
              Your email is now verified. You'll receive drive reminders and club notifications.
            </p>
            <button
              onClick={() => navigate(user ? '/dashboard' : '/login')}
              className="w-full bg-red-600 hover:bg-red-700 py-4 rounded-2xl font-semibold text-lg transition"
            >
              {user ? 'Go to Dashboard' : 'Sign In'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {chrome}
        <div className="bg-zinc-900 rounded-3xl p-10 text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
          <h2 className="text-3xl font-bold mb-4">Verification failed</h2>
          <p className="text-zinc-400 mb-8">{errorMsg}</p>
          {user ? (
            <button
              onClick={async () => {
                try {
                  await authAPI.resendVerification();
                } catch (error) {
                  // Navigating to /dashboard regardless (below) — its own verification
                  // banner has full retry/error handling, so this only needs to not be silent.
                  console.error('Failed to resend verification email:', error);
                }
                navigate('/dashboard');
              }}
              className="w-full bg-red-600 hover:bg-red-700 py-4 rounded-2xl font-semibold text-lg transition mb-3"
            >
              Resend verification email
            </button>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="w-full bg-red-600 hover:bg-red-700 py-4 rounded-2xl font-semibold text-lg transition mb-3"
            >
              Sign In to resend
            </button>
          )}
          <button
            onClick={() => navigate(user ? '/dashboard' : '/login')}
            className="text-zinc-400 hover:text-zinc-300 text-sm"
          >
            {user ? 'Back to Dashboard' : 'Back to Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
