import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Car, CheckCircle, XCircle, MapPin } from "lucide-react";
import { drivesAPI } from "../services/api";
import NavBar from "../components/NavBar";

const DriveCheckIn = ({ user, onLogout }) => {
  const { driveId } = useParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState(null); // { driveName, clubName, isCompleted, checkedIn }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    drivesAPI.getCheckinStatus(driveId)
      .then(res => { if (active) setStatus(res.data); })
      .catch(err => { if (active) setError(err.response?.data?.message || "Unable to load check-in."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [driveId]);

  const handleSubmit = async (present) => {
    setSubmitting(true);
    setError("");
    try {
      const res = await drivesAPI.submitCheckin(driveId, present);
      setStatus(prev => ({ ...prev, checkedIn: res.data.checkedIn }));
    } catch (err) {
      setError(err.response?.data?.message || "Could not submit check-in.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <NavBar user={user} onLogout={onLogout} showSearch={false} />

      <div id="main-content" role="main" className="flex items-center justify-center p-6 pt-24">
        <h1 className="sr-only">Drive Check-In</h1>
        <div className="w-full max-w-md">
          <div className="glass-card rounded-3xl p-10 text-center">
            {loading ? (
              <div className="w-10 h-10 border-4 border-zinc-800 border-t-red-500 rounded-full animate-spin mx-auto" />
            ) : error ? (
              <>
                <XCircle className="w-14 h-14 text-red-500 mx-auto mb-4" />
                <p className="text-zinc-300 mb-6">{error}</p>
                <button
                  onClick={() => navigate("/dashboard")}
                  className="btn-primary w-full py-3 rounded-2xl font-semibold"
                >
                  Go to Dashboard
                </button>
              </>
            ) : status?.isCompleted ? (
              <>
                <MapPin className="w-14 h-14 text-zinc-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">Check-in closed</h2>
                <p className="text-zinc-400 mb-6">
                  "{status.driveName}" has already been marked completed by the club leader.
                </p>
                <button
                  onClick={() => navigate("/dashboard")}
                  className="btn-primary w-full py-3 rounded-2xl font-semibold"
                >
                  Go to Dashboard
                </button>
              </>
            ) : status?.checkedIn && status.checkedIn !== "pending" ? (
              <>
                {status.checkedIn === "present" ? (
                  <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
                ) : (
                  <XCircle className="w-14 h-14 text-zinc-400 mx-auto mb-4" />
                )}
                <h2 className="text-2xl font-bold mb-2">
                  {status.checkedIn === "present" ? "You're checked in!" : "Marked as not present"}
                </h2>
                <p className="text-zinc-400 mb-6">
                  "{status.driveName}" — {status.clubName}
                </p>
                <button
                  onClick={() => handleSubmit(status.checkedIn !== "present")}
                  disabled={submitting}
                  className="text-zinc-400 hover:text-zinc-300 text-sm disabled:opacity-50"
                >
                  Change my answer
                </button>
              </>
            ) : (
              <>
                <Car className="w-14 h-14 text-red-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">{status?.driveName}</h2>
                <p className="text-zinc-400 mb-8">{status?.clubName} — let your club know you made it!</p>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => handleSubmit(true)}
                    disabled={submitting}
                    className="btn-primary w-full py-4 rounded-2xl font-semibold text-lg disabled:opacity-70"
                  >
                    {submitting ? "Submitting..." : "I'm here"}
                  </button>
                  <button
                    onClick={() => handleSubmit(false)}
                    disabled={submitting}
                    className="w-full bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.08] py-4 rounded-2xl font-semibold text-lg transition disabled:opacity-70"
                  >
                    I couldn't make it
                  </button>
                </div>

                {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriveCheckIn;
