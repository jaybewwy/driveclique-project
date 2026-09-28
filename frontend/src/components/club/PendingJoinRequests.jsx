import { useState } from "react";
import { UserCheck, UserX } from "lucide-react";
import { clubsAPI } from "../../services/api";
import { displayName } from "../../lib/userDisplay";

/**
 * Leader/co-leader approval queue for a private club (UC-10). Lives in the
 * main content column, not the right sidebar — that sidebar is height-capped
 * with overflow-hidden at desktop widths, so new sidebar content silently
 * clips once enough other cards already fill it.
 *
 * onDecided() runs after an approve/reject lands, so the page can refetch
 * the club: both `members` (on accept) and `joinRequests` change together.
 */
const PendingJoinRequests = ({ clubId, requests, onDecided }) => {
  const [processingRequestId, setProcessingRequestId] = useState(null);
  const [error, setError] = useState('');

  const decide = async (requestId, status) => {
    setError('');
    setProcessingRequestId(requestId);
    try {
      const response = await clubsAPI.handleJoinRequest(clubId, requestId, status);
      if (response.data?.success) await onDecided();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to process join request');
    } finally {
      setProcessingRequestId(null);
    }
  };

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center">
            <UserCheck className="w-5 h-5 text-zinc-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold">Pending Join Requests</h3>
            <p className="text-xs text-zinc-400">Members waiting for approval</p>
          </div>
        </div>
        {requests.length > 0 && (
          <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full">{requests.length}</span>
        )}
      </div>
      {error && (
        <p className="text-red-400 text-xs mb-2">{error}</p>
      )}
      {requests.length === 0 ? (
        <div className="bg-zinc-900/30 border border-zinc-800/30 rounded-2xl p-6 text-center">
          <p className="text-zinc-400 text-sm">No pending requests</p>
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map((request) => (
            <div key={request._id} className="flex items-center gap-3 bg-zinc-900/50 border border-zinc-800/50 rounded-2xl px-4 py-3">
              <div className="w-9 h-9 bg-zinc-700 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center">
                {request.user?.avatar ? (
                  <img src={request.user.avatar} alt={request.user.username} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-zinc-400 text-xs">{request.user?.username?.charAt(0)?.toUpperCase?.()}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{displayName(request.user)}</p>
                <p className="text-xs text-zinc-400 truncate">@{request.user?.username}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => decide(request._id, 'accepted')}
                  disabled={processingRequestId === request._id}
                  className="p-1.5 text-zinc-400 hover:text-green-400 hover:bg-green-500/10 rounded-lg transition-all disabled:opacity-50"
                  title="Approve"
                >
                  <UserCheck size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => decide(request._id, 'rejected')}
                  disabled={processingRequestId === request._id}
                  className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-50"
                  title="Reject"
                >
                  <UserX size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PendingJoinRequests;
