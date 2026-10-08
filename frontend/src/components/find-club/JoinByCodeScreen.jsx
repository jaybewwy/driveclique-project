import { useState } from "react";
import { Lock, X } from "lucide-react";

const Spinner = () => (
  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
);

/**
 * Full-screen "Join with Invite Code" prompt. onSubmit(code) does the join
 * and rejects on failure; any failure reads as a wrong code.
 */
const JoinByCodeScreen = ({ onSubmit, onClose }) => {
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!inviteCode.trim()) { setError("Please enter an invite code"); return; }
    setLoading(true);
    setError("");
    try {
      await onSubmit(inviteCode.trim());
    } catch {
      setError("Invite code incorrect.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div role="presentation" aria-hidden="true" className="fixed inset-0 bg-true-black/70 backdrop-blur-xl" onClick={onClose} />
      <div className="relative glass-card p-8 max-w-sm w-full animate-fade-slide-up rounded-3xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.07] rounded-lg transition-all"
        >
          <X size={16} />
        </button>

        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-red-600 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-red-500/30">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white mb-1">Join with Invite Code</h2>
          <p className="text-zinc-400 text-sm">Enter the code from a club leader</p>
        </div>

        <div className="space-y-3">
          <input
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            placeholder="e.g. HRK707"
            className="w-full bg-white/[0.06] border border-white/[0.10] rounded-2xl px-4 py-3.5 text-center text-xl font-mono tracking-widest text-white placeholder-zinc-600 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 transition-all"
            // eslint-disable-next-line jsx-a11y/no-autofocus -- focus follows the user's own "Join with Invite Code" click, not page load
            autoFocus
          />

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
              <p className="text-red-400 text-sm text-center">{error}</p>
            </div>
          )}

          <button
            onClick={submit}
            disabled={loading}
            className="w-full btn-primary py-3 text-sm flex items-center justify-center gap-2"
          >
            {loading ? <><Spinner /> Joining…</> : "Join Club"}
          </button>
        </div>

        <p className="text-zinc-400 text-xs text-center mt-5">
          Contact a club leader to get your invite code
        </p>
      </div>
    </div>
  );
};

export default JoinByCodeScreen;
