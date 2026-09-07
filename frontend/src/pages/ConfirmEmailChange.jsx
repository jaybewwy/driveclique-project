import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import TokenConfirmationCard from '../components/ui/TokenConfirmationCard';

const ConfirmEmailChange = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();

  const [status, setStatus] = useState('pending'); // 'pending' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const [newEmail, setNewEmail] = useState('');

  useEffect(() => {
    if (!token) {
      setErrorMsg('This confirmation link is invalid or missing a token.');
      setStatus('error');
      return;
    }

    authAPI.confirmEmailChange(token)
      .then(async (res) => {
        setNewEmail(res.data.email || '');
        // Sync user state if they are still logged in on this device. updateUser()
        // replaces the whole stored user object (see useAuth.js), so this refetches
        // the full profile rather than patching in just the email field.
        if (user) {
          try {
            const profile = await authAPI.getProfile();
            if (profile.data.success) updateUser(profile.data.user);
          } catch (error) {
            // Non-critical — state will sync on next page load, same as VerifyEmail.jsx
            console.error('Failed to sync profile after email change:', error);
          }
        }
        setStatus('success');
      })
      .catch((err) => {
        setErrorMsg(
          err.response?.data?.message ||
          'This confirmation failed. The link may have expired.'
        );
        setStatus('error');
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <TokenConfirmationCard
      status={status}
      pendingBody="Confirming your new email address…"
      successTitle="Email updated!"
      successBody={
        newEmail
          ? <>Your account email is now <strong>{newEmail}</strong>. Use it to sign in from now on.</>
          : 'Your account email has been updated.'
      }
      successPrimaryLabel={user ? 'Back to Settings' : 'Sign In'}
      onSuccessPrimary={() => navigate(user ? '/settings' : '/login')}
      errorTitle="Confirmation failed"
      errorBody={errorMsg}
      errorActions={
        <button
          onClick={() => navigate(user ? '/settings' : '/login')}
          className="w-full bg-red-600 hover:bg-red-700 py-4 rounded-2xl font-semibold text-lg transition"
        >
          {user ? 'Back to Settings' : 'Sign In'}
        </button>
      }
    />
  );
};

export default ConfirmEmailChange;
