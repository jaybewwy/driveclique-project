import { useState } from "react";
import { Ban, Plus, ShieldOff } from "lucide-react";
import { clubsAPI } from "../../services/api";
import { trackEvent } from "../../services/analytics";

/**
 * What a non-member sees in the club sidebar: Join (instant for public
 * clubs, a request for private ones), or the pending-request notice, plus
 * blocking the club from their own search results (UC-32). A blocked club
 * has to be unblocked before it can be joined.
 *
 * onJoined() runs after an instant public join, so the page can refetch
 * the club and switch to the member view.
 */
const JoinClubPanel = ({ clubId, initiallyBlocked, hasPendingRequest, onJoined }) => {
  const [isBlocked, setIsBlocked] = useState(initiallyBlocked);
  const [blockLoading, setBlockLoading] = useState(false);
  const [blockError, setBlockError] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinFeedback, setJoinFeedback] = useState('');

  const join = async () => {
    setJoinLoading(true);
    setJoinFeedback('');
    try {
      const response = await clubsAPI.requestToJoin(clubId);
      if (response.data.success) {
        if (response.data.clubId) {
          // Public club — joined immediately
          trackEvent('CLUB_JOINED', { clubId });
          await onJoined();
        } else {
          setJoinFeedback('Join request sent! Awaiting leader approval.');
        }
      }
    } catch (err) {
      setJoinFeedback(err.response?.data?.message || 'Failed to send join request.');
    } finally {
      setJoinLoading(false);
    }
  };

  const toggleBlock = async () => {
    setBlockLoading(true);
    setBlockError('');
    try {
      if (isBlocked) {
        await clubsAPI.unblockClub(clubId);
        setIsBlocked(false);
      } else {
        await clubsAPI.blockClub(clubId);
        setIsBlocked(true);
      }
    } catch (err) {
      setBlockError(err.response?.data?.message || 'Failed to update block status.');
    } finally {
      setBlockLoading(false);
    }
  };

  return (
    <div className="mt-3 xl:mt-6 pt-3 xl:pt-5 border-t border-zinc-800">
      {blockError && (
        <p className="text-sm text-center mb-3 text-red-400">{blockError}</p>
      )}
      {isBlocked ? (
        <>
          <p className="text-sm text-center mb-3 text-zinc-400">
            You've blocked this club — unblock it to join.
          </p>
          <button
            type="button"
            onClick={toggleBlock}
            disabled={blockLoading}
            className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-2xl font-medium flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ShieldOff size={18} />
            {blockLoading ? 'Unblocking…' : 'Unblock Club'}
          </button>
        </>
      ) : (
        <>
          {joinFeedback && (
            <p className="text-sm text-center mb-3 text-zinc-400">{joinFeedback}</p>
          )}
          {!hasPendingRequest && !joinFeedback && (
            <button
              onClick={join}
              disabled={joinLoading}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-2xl font-medium flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={18} />
              {joinLoading ? 'Joining...' : 'Join Club'}
            </button>
          )}
          {hasPendingRequest && !joinFeedback && (
            <p className="text-sm text-center text-zinc-400">
              Join request pending approval
            </p>
          )}
          <button
            type="button"
            onClick={toggleBlock}
            disabled={blockLoading}
            className="w-full mt-2 text-xs text-zinc-500 hover:text-red-400 py-2 flex items-center justify-center gap-1.5 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Ban size={13} />
            {blockLoading ? 'Blocking…' : 'Block this club'}
          </button>
        </>
      )}
    </div>
  );
};

export default JoinClubPanel;
