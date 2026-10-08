import { useNavigate } from "react-router-dom";
import { MapPin, Users } from "lucide-react";

export const ClubNotFound = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-600/10 rounded-full blur-3xl" />
      </div>
      <div className="relative z-10 flex flex-col items-center text-center max-w-sm w-full">
        <div className="w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center mb-6">
          <Users className="w-8 h-8 text-zinc-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Club not found</h1>
        <p className="text-zinc-400 text-sm leading-relaxed mb-8">
          This club doesn't exist or you may not have permission to view it.
          It may have been deleted or the link may be incorrect.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <button
            onClick={() => navigate("/my-clubs")}
            className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 px-5 py-3 rounded-2xl font-semibold text-sm transition-all duration-200"
          >
            My Clubs
          </button>
          <button
            onClick={() => navigate("/find-club")}
            className="flex-1 flex items-center justify-center gap-2 bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.08] px-5 py-3 rounded-2xl font-semibold text-sm transition-all duration-200"
          >
            Find a Club
          </button>
        </div>
      </div>
    </div>
  );
};

export const ClubHero = ({ club }) => (
  <div className="relative overflow-hidden glass-card p-5 mb-6 rounded-3xl">
    <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-red-500/[0.08] to-orange-500/5 rounded-full blur-3xl pointer-events-none" />
    <div className="relative flex items-center gap-4">
      <div className="w-16 h-16 rounded-2xl overflow-hidden ring-2 ring-white/[0.10] shrink-0">
        {club.avatar ? (
          <img src={club.avatar} alt={club.name} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-600 to-orange-600">
            <span className="text-white text-2xl font-bold">{club.name?.charAt(0)?.toUpperCase?.()}</span>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h1 className="text-xl font-bold text-white leading-tight">{club.name}</h1>
        {club.description && <p className="text-zinc-400 text-sm mt-1 line-clamp-2">{club.description}</p>}
        {club.location && (
          <p className="text-zinc-400 text-xs mt-1 flex items-center gap-1">
            <MapPin className="w-3 h-3" />{club.location}
          </p>
        )}
      </div>
    </div>
  </div>
);
