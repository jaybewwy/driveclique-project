import { useNavigate } from "react-router-dom";
import { Home, Search, ArrowLeft } from "lucide-react";
import Logo from "../components/ui/Logo";

const NotFound = ({ isAuthenticated = false }) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6">
      {/* Ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center max-w-md w-full">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-12">
          <Logo size={36} />
          <span className="text-xl font-bold tracking-tight">
            Drive<span className="text-red-500">Clique</span>
          </span>
        </div>

        {/* 404 number */}
        <p className="text-[120px] font-black leading-none bg-gradient-to-b from-zinc-600 to-zinc-800 bg-clip-text text-transparent select-none mb-2">
          404
        </p>

        <h1 className="text-2xl font-bold text-white mb-3">Page not found</h1>
        <p className="text-zinc-400 text-sm leading-relaxed mb-10">
          The page you're looking for doesn't exist or may have been moved.
          Check the URL and try again.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          {isAuthenticated ? (
            <>
              <button
                onClick={() => navigate("/dashboard")}
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 px-5 py-3 rounded-2xl font-semibold text-sm transition-all duration-200 shadow-lg shadow-red-600/20"
              >
                <Home className="w-4 h-4" />
                Go to Dashboard
              </button>
              <button
                onClick={() => navigate("/find-club")}
                className="flex-1 flex items-center justify-center gap-2 bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.08] px-5 py-3 rounded-2xl font-semibold text-sm transition-all duration-200"
              >
                <Search className="w-4 h-4" />
                Find a Club
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => navigate("/login")}
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 px-5 py-3 rounded-2xl font-semibold text-sm transition-all duration-200 shadow-lg shadow-red-600/20"
              >
                Sign In
              </button>
              <button
                onClick={() => navigate(-1)}
                className="flex-1 flex items-center justify-center gap-2 bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.08] px-5 py-3 rounded-2xl font-semibold text-sm transition-all duration-200"
              >
                <ArrowLeft className="w-4 h-4" />
                Go Back
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotFound;
