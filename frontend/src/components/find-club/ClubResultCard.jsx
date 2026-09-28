import { ArrowRight, Ban, Flag, Globe, Lock, MapPin, Navigation, Users } from "lucide-react";

/** "1 member" / "12 members" */
export const MemberCount = ({ count }) => <>{count} {count === 1 ? 'member' : 'members'}</>;

/** A club's avatar, or its initial on the brand gradient */
export const ClubAvatar = ({ club, className, initialClassName }) => (
  <div className={className}>
    {club.avatar ? (
      <img src={club.avatar} alt={club.name} className="w-full h-full object-cover" />
    ) : (
      <div className="w-full h-full bg-gradient-to-br from-red-600 to-orange-600 flex items-center justify-center">
        <span className={initialClassName}>{club.name.charAt(0)}</span>
      </div>
    )}
  </div>
);

/**
 * One search result. Clicking the card opens the club; the buttons report
 * it, block it (non-members only), and join or view it.
 */
const ClubResultCard = ({ club, isMember, isBlocking, onOpen, onReport, onBlock, onJoin }) => (
  <div
    role="button"
    tabIndex={0}
    onClick={onOpen}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onOpen();
      }
    }}
    className="glass-card p-5 cursor-pointer hover:border-white/[0.12] hover:-translate-y-0.5 transition-all duration-200 group rounded-3xl"
  >
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3.5 flex-1 min-w-0">
        <ClubAvatar
          club={club}
          className="w-11 h-11 rounded-xl shrink-0 overflow-hidden ring-1 ring-white/[0.08] group-hover:ring-red-500/20 transition-all"
          initialClassName="text-white font-bold"
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="font-semibold text-white group-hover:text-red-400 transition-colors truncate min-w-0">
              {club.name}
            </h3>
            {club.isPrivate ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/[0.06] border border-white/[0.08] rounded-full text-[10px] text-zinc-400">
                <Lock className="w-2.5 h-2.5" /> Private
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/10 border border-green-500/20 rounded-full text-[10px] text-green-500">
                <Globe className="w-2.5 h-2.5" /> Public
              </span>
            )}
          </div>

          <p className="text-xs text-zinc-400 line-clamp-1 mb-2">
            {club.description || "No description"}
          </p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              <MemberCount count={club.members.length} />
            </span>
            {club.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                <span className="truncate max-w-[160px]">{club.location}</span>
              </span>
            )}
            {club.distanceMiles !== undefined && (
              <span className="flex items-center gap-1.5 text-zinc-300">
                <Navigation className="w-3.5 h-3.5" />
                {club.distanceMiles} mi away
              </span>
            )}
          </div>

          {club.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {club.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 bg-white/[0.06] border border-white/[0.08] rounded-full text-[10px] text-zinc-400"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 self-center flex items-center gap-1.5">
        <button
          onClick={(e) => { e.stopPropagation(); onReport(); }}
          className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-orange-400 hover:bg-orange-500/10 rounded-xl transition-all"
          title="Report club"
        >
          <Flag className="w-3.5 h-3.5" />
        </button>
        {!isMember && (
          <button
            onClick={(e) => { e.stopPropagation(); onBlock(); }}
            disabled={isBlocking}
            className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title="Block club"
          >
            <Ban className="w-3.5 h-3.5" />
          </button>
        )}
        {isMember ? (
          <button
            onClick={(e) => { e.stopPropagation(); onOpen(); }}
            className="btn-ghost px-4 py-2 text-xs font-medium flex items-center gap-1.5"
          >
            View <ArrowRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onJoin(); }}
            className="btn-primary px-4 py-2 text-xs font-medium"
          >
            Join
          </button>
        )}
      </div>
    </div>
  </div>
);

export default ClubResultCard;
