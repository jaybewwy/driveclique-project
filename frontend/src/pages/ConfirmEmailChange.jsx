import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Car, CheckCircle, XCircle } from 'lucide-react';
import { authAPI } from '../services/api';
import { useAuth } from '../hooks/useAuth';

const ConfirmEmailChange = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();

  const [status, setStatus] = useState('confirming'); // 'confirming' | 'success' | 'error'
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

  const chrome = (
    <div className="text-center mb-10">
      <Car className="w-16 h-16 mx-auto text-red-500 mb-4" />
      <h1 className="text-5xl font-bold">DriveClique</h1>
      <p className="text-zinc-400 mt-2">Connect. Drive. Repeat.</p>
    </div>
  );

  if (status === 'confirming') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {chrome}
          <div className="bg-zinc-900 rounded-3xl p-10 text-center">
            <div className="w-12 h-12 border-4 border-zinc-700 border-t-red-500 rounded-full animate-spin mx-auto mb-6" />
            <p className="text-zinc-400">Confirming your new email address…</p>
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
            <h2 className="text-3xl font-bold mb-4">Email updated!</h2>
            <p className="text-zinc-300 mb-8">
              {newEmail
                ? <>Your account email is now <strong>{newEmail}</strong>. Use it to sign in from now on.</>
                : 'Your account email has been updated.'}
            </p>
            <button
              onClick={() => navigate(user ? '/settings' : '/login')}
              className="w-full bg-red-600 hover:bg-red-700 py-4 rounded-2xl font-semibold text-lg transition"
            >
              {user ? 'Back to Settings' : 'Sign In'}
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
          <h2 className="text-3xl font-bold mb-4">Confirmation failed</h2>
          <p className="text-zinc-400 mb-8">{errorMsg}</p>
          <button
            onClick={() => navigate(user ? '/settings' : '/login')}
            className="w-full bg-red-600 hover:bg-red-700 py-4 rounded-2xl font-semibold text-lg transition"
          >
            {user ? 'Back to Settings' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmEmailChange;
