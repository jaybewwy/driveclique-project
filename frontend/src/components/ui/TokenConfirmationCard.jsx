import { Car, CheckCircle, XCircle } from 'lucide-react';

/**
 * Shared 3-state (pending/success/error) chrome for a full-page "confirm an
 * emailed token" screen — extracted from VerifyEmail.jsx and
 * ConfirmEmailChange.jsx, which were ~90% structurally identical (same
 * DriveClique header, same card wrapper, same spinner/success/error layout)
 * and differed only in copy and, for the error state, in the action buttons
 * offered: VerifyEmail has a "resend" action with its own async logic
 * (authAPI.resendVerification()); ConfirmEmailChange doesn't have an
 * equivalent. Rather than force a false symmetry, `errorActions` is a
 * caller-supplied slot for whatever buttons that page's error state needs,
 * while the success state's single, genuinely-symmetric "navigate
 * somewhere" button is a plain prop pair.
 */
const TokenConfirmationCard = ({
  status, // 'pending' | 'success' | 'error'
  pendingBody,
  successTitle,
  successBody,
  successPrimaryLabel,
  onSuccessPrimary,
  errorTitle,
  errorBody,
  errorActions,
}) => {
  const chrome = (
    <div className="text-center mb-10">
      <Car className="w-16 h-16 mx-auto text-red-500 mb-4" />
      <h1 className="text-5xl font-bold">DriveClique</h1>
      <p className="text-zinc-400 mt-2">Connect. Drive. Repeat.</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {chrome}
        <div className="bg-zinc-900 rounded-3xl p-10 text-center">
          {status === 'pending' && (
            <>
              <div className="w-12 h-12 border-4 border-zinc-700 border-t-red-500 rounded-full animate-spin mx-auto mb-6" />
              <p className="text-zinc-400">{pendingBody}</p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-6" />
              <h2 className="text-3xl font-bold mb-4">{successTitle}</h2>
              <p className="text-zinc-300 mb-8">{successBody}</p>
              <button
                onClick={onSuccessPrimary}
                className="w-full bg-red-600 hover:bg-red-700 py-4 rounded-2xl font-semibold text-lg transition"
              >
                {successPrimaryLabel}
              </button>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
              <h2 className="text-3xl font-bold mb-4">{errorTitle}</h2>
              <p className="text-zinc-400 mb-8">{errorBody}</p>
              {errorActions}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TokenConfirmationCard;
