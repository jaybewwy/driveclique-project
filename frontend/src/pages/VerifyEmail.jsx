import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import TokenConfirmationCard from '../components/ui/TokenConfirmationCard';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();

  const [status, setStatus] = useState('pending'); // 'pending' | 'success' | 'error'
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

  return (
    <TokenConfirmationCard
      status={status}
      pendingBody="Verifying your email…"
      successTitle="Email verified!"
      successBody="Your email is now verified. You'll receive drive reminders and club notifications."
      successPrimaryLabel={user ? 'Go to Dashboard' : 'Sign In'}
      onSuccessPrimary={() => navigate(user ? '/dashboard' : '/login')}
      errorTitle="Verification failed"
      errorBody={errorMsg}
      errorActions={
        <>
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
        </>
      }
    />
  );
};

export default VerifyEmail;
