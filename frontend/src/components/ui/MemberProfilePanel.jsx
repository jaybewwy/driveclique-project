import { useState, useEffect } from "react";
import { MapPin, Car, Users, X as XIcon } from "lucide-react";
import Modal from "../Modal";
import { authAPI, getErrorMessage } from "../../services/api";

// UC-22 — Member Public Profile View. Fetches on open rather than being
// pre-loaded like the drive detail modal, since it can be triggered from
// several different places (member list, drive attendee list) that don't
// otherwise share data-fetching. `canRemove`/`onRemove` are optional —
// the caller decides eligibility (leader/co-leader over the target's club
// membership) since that depends on club context this panel doesn't have.
const MemberProfilePanel = ({ userId, isOpen, onClose, canRemove, onRemove }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen || !userId) return;
    setProfile(null);
    setError("");
    setLoading(true);
    authAPI
      .getPublicProfile(userId)
      .then((res) => {
        if (res.data.success) setProfile(res.data.profile);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [isOpen, userId]);

  const displayName =
    profile?.useDisplayName && profile?.name ? profile.name : profile?.username;
  const primaryCar = profile?.cars?.find((c) => c.isPrimary) || profile?.cars?.[0];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Member Profile" size="sm">
      {loading && (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-zinc-700 border-t-red-500 rounded-full animate-spin" />
        </div>
      )}

      {!loading && error && (
        <p className="text-red-400 text-sm text-center py-4">{error}</p>
      )}

      {!loading && !error && profile && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            {profile.avatar ? (
              <img
                src={profile.avatar}
                alt={displayName}
                className="w-16 h-16 rounded-2xl object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-600 to-orange-600 flex items-center justify-center text-xl font-bold flex-shrink-0">
                {displayName?.[0]?.toUpperCase() || "?"}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-lg font-semibold text-white truncate">{displayName}</p>
              <p className="text-sm text-zinc-400 truncate">@{profile.username}</p>
              {profile.location && (
                <p className="text-xs text-zinc-400 flex items-center gap-1 mt-1">
                  <MapPin size={12} /> {profile.location}
                </p>
              )}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-1">Bio</p>
            <p className="text-sm text-zinc-300">{profile.bio || "No bio yet."}</p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-1">Car</p>
            {primaryCar && (primaryCar.year || primaryCar.make || primaryCar.model) ? (
              <p className="text-sm text-zinc-300 flex items-center gap-1.5">
                <Car size={14} className="text-zinc-400 flex-shrink-0" />
                {[primaryCar.year, primaryCar.make, primaryCar.model, primaryCar.color]
                  .filter(Boolean)
                  .join(" ")}
              </p>
            ) : (
              <p className="text-sm text-zinc-400">No car listed.</p>
            )}
          </div>

          {profile.mutualClubs?.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-1">
                Mutual Clubs
              </p>
              <div className="flex flex-wrap gap-2">
                {profile.mutualClubs.map((c) => (
                  <span
                    key={c._id}
                    className="text-xs bg-zinc-800 text-zinc-300 px-2.5 py-1 rounded-full"
                  >
                    {c.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm text-zinc-300 bg-black border border-zinc-800 rounded-xl px-3 py-2">
            <Users size={14} className="text-zinc-400 flex-shrink-0" />
            {profile.goingCount} {profile.goingCount === 1 ? "drive" : "drives"} attended
          </div>

          {canRemove && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onRemove?.();
              }}
              className="w-full flex items-center justify-center gap-2 border border-red-600 text-red-500 hover:bg-red-600 hover:text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
            >
              <XIcon size={14} /> Remove from Club
            </button>
          )}
        </div>
      )}
    </Modal>
  );
};

export default MemberProfilePanel;
