import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Search } from "lucide-react";
import { authAPI } from "../../services/api";

const SEARCH_DEBOUNCE_MS = 300;

/**
 * Leader-only: the club's invite code (with copy) and a user search.
 * The search results' "Invite" buttons aren't wired to anything yet —
 * there's no invite-a-user endpoint, only the shareable code.
 */
const InviteMembersPanel = ({ inviteCode }) => {
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  const copyInviteCode = () => {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const searchUsers = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const response = await authAPI.searchUsers(searchQuery);
      if (response.data?.success) setSearchResults(response.data.users);
    } catch (error) {
      console.error("Error searching users:", error);
    }
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) searchUsers();
      else setSearchResults([]);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchQuery, searchUsers]);

  return (
    <>
      <h3 className="font-semibold mb-4 mt-8">Invite Members</h3>
      <div className="bg-zinc-900 rounded-2xl p-4 space-y-4">
        <div className="bg-black rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="font-mono text-sm">{inviteCode}</span>
          <button
            type="button"
            onClick={copyInviteCode}
            className="text-red-500 hover:text-red-400 flex items-center gap-1 text-sm"
          >
            {copied ? (
              <>
                <Check size={14} />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy size={14} />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        <div className="border-t border-zinc-800 pt-4">
          <h4 className="font-medium mb-3 text-sm">Find Users to Invite</h4>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder=""
              aria-label="Find users to invite"
              className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-600"
            />
            <Search className="absolute right-3 top-2.5 text-zinc-400 w-4 h-4" />
          </div>

          {searchResults.length > 0 && (
            <div className="mt-3 space-y-2">
              {searchResults.map((u) => (
                <div
                  key={u._id}
                  className="flex items-center justify-between bg-black rounded-xl px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-zinc-700 rounded-full" />
                    <span className="text-sm">{u.username}</span>
                  </div>
                  <button className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded-lg text-xs" type="button">
                    Invite
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default InviteMembersPanel;
