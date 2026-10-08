import { Calendar, Car, Lock, ShieldOff, Sparkles, Users, X } from "lucide-react";
import { MobileDrawerButton } from "../ui/MobileDrawer";
import { ClubAvatar, MemberCount } from "./ClubResultCard";

const WHY_JOIN = [
  { icon: Users,    text: "Connect with enthusiasts" },
  { icon: Calendar, text: "Access exclusive drives" },
  { icon: Car,      text: "Share knowledge & tips" },
];

/**
 * Find Clubs' right column (a full-screen drawer below xl): popular clubs,
 * join-by-code, blocked clubs, and the "why join" pitch.
 */
const FindClubSidebar = ({ popularClubs, mobileOpen, onMobileOpen, onMobileClose, onOpenClub, onJoinByCode, onShowBlocked }) => (
  <>
    <MobileDrawerButton onClick={onMobileOpen} breakpointClass="xl:hidden" side="right" label="popular clubs" />

    <div
      className={
        mobileOpen
          ? "flex fixed inset-0 z-50 bg-zinc-950 flex-col p-5 pt-[calc(4rem+var(--sat))] overflow-y-auto gap-5 xl:inset-auto xl:z-auto xl:bg-transparent xl:w-72 xl:pt-5 xl:sticky xl:top-[49px] xl:h-[calc(100vh-49px)]"
          : "hidden xl:flex xl:flex-col xl:w-72 xl:p-5 xl:sticky xl:top-[49px] xl:h-[calc(100vh-49px)] xl:overflow-y-auto xl:gap-5"
      }
    >
      {mobileOpen && (
        <button
          type="button"
          onClick={onMobileClose}
          aria-label="Close popular clubs"
          className="xl:hidden absolute top-[calc(1rem+var(--sat))] right-4 p-2 rounded-lg bg-zinc-900/80 text-zinc-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      <div>
        <p className="section-label mb-3">Popular</p>
        <div className="space-y-2">
          {popularClubs.map((club) => (
            <button
              type="button"
              key={club._id}
              onClick={() => onOpenClub(club._id)}
              className="w-full text-left flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-white/[0.05] group transition-all duration-200"
            >
              <ClubAvatar
                club={club}
                className="w-9 h-9 rounded-xl shrink-0 overflow-hidden ring-1 ring-white/[0.08]"
                initialClassName="text-white font-bold text-xs"
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-xs text-zinc-300 group-hover:text-white transition-colors truncate">{club.name}</p>
                <p className="text-[11px] text-zinc-400"><MemberCount count={club.members.length} /></p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={onJoinByCode}
        className="w-full btn-ghost px-4 py-3 text-sm flex items-center justify-center gap-2"
      >
        <Lock className="w-4 h-4" /> Join with Code
      </button>

      <button
        type="button"
        onClick={onShowBlocked}
        className="w-full btn-ghost px-4 py-3 text-sm flex items-center justify-center gap-2"
      >
        <ShieldOff className="w-4 h-4" /> Blocked Clubs
      </button>

      <div className="relative overflow-hidden p-4 rounded-2xl bg-gradient-to-br from-red-500/[0.08] to-orange-500/[0.06] border border-red-500/15">
        <div className="flex items-start gap-2 mb-3">
          <Sparkles className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
          <p className="text-xs font-semibold text-white">Why join a club?</p>
        </div>
        <ul className="space-y-1.5">
          {WHY_JOIN.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-2 text-[11px] text-zinc-400">
              <Icon className="w-3 h-3 text-red-400 shrink-0" /> {text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  </>
);

export default FindClubSidebar;
