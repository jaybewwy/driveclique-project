import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Lock, FileText, Globe, Users, Tag } from "lucide-react";
import { clubsAPI, getErrorMessage } from "../services/api";
import { LocationSearch } from "../components/ui/location-search";
import ClubTagPicker from "../components/ui/ClubTagPicker";
import { useClubs } from "../hooks/useClubs";
import { trackEvent } from "../services/analytics";

const MAX_TAGS = 5;

const CreateClub = () => {
  const navigate = useNavigate();
  const { addClub } = useClubs();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    location: "",
    maxMembers: "",
    isPrivate: false,
    tags: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (!formData.name || !formData.description) {
      setError("Please fill in all required fields");
      setLoading(false);
      return;
    }

    try {
      const response = await clubsAPI.create({
        name: formData.name,
        description: formData.description,
        location: formData.location,
        maxMembers: formData.maxMembers ? parseInt(formData.maxMembers) : null,
        isPrivate: formData.isPrivate,
        tags: formData.tags,
      });

      if (response.data.success) {
        addClub(response.data.club);
        trackEvent('CLUB_CREATED', { clubId: response.data.club._id });
        setSuccess("Club created successfully! Redirecting to club page...");
        setFormData({ name: "", description: "", location: "", maxMembers: "", isPrivate: false, tags: [] });
        setTimeout(() => {
          navigate(`/club/${response.data.club._id}`);
        }, 2000);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="main-content" role="main" className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="mb-8">
          <button
            onClick={() => navigate("/my-clubs")}
            className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6 transition"
          >
            <ArrowLeft size={20} />
            Back to My Clubs
          </button>
          <h1 className="text-4xl font-bold text-white">Create New Club</h1>
          <p className="text-zinc-400 mt-2">Start your own car community</p>
        </div>

        <div className="bg-zinc-900 rounded-3xl p-10">
          {success && (
            <div className="bg-green-900/30 border border-green-600 rounded-xl p-4 mb-6">
              <p className="text-green-400 text-center">{success}</p>
            </div>
          )}

          {error && (
            <div className="bg-red-900/30 border border-red-600 rounded-xl p-4 mb-6">
              <p className="text-red-400 text-center">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            <div>
              <label htmlFor="create-club-name" className="block text-sm font-medium text-zinc-300 mb-3">
                Club Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="create-club-name"
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g. Southern California Mountain Drivers"
                  className="w-full bg-black border border-zinc-700 rounded-2xl px-6 py-4 pl-12 text-white placeholder-zinc-500 focus:outline-none focus:border-red-600 transition"
                />
                <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
              </div>
            </div>

            <div>
              <label htmlFor="create-club-description" className="block text-sm font-medium text-zinc-300 mb-3">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                id="create-club-description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="What makes your club unique?"
                rows={4}
                className="w-full bg-black border border-zinc-700 rounded-2xl px-6 py-4 text-white placeholder-zinc-500 focus:outline-none focus:border-red-600 transition resize-none"
              />
            </div>

            <div>
              <label htmlFor="create-club-location" className="block text-sm font-medium text-zinc-300 mb-3">
                Location
              </label>
              <LocationSearch
                id="create-club-location"
                value={formData.location}
                onChange={(val) => setFormData({ ...formData, location: val })}
              />
            </div>

            {/* Club Tags */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                  <Tag size={16} className="text-zinc-400" />
                  Club Tags
                </p>
                <span className="text-xs text-zinc-400">{formData.tags.length}/{MAX_TAGS} selected</span>
              </div>
              <ClubTagPicker
                selected={formData.tags}
                onChange={(tags) => setFormData({ ...formData, tags })}
                max={MAX_TAGS}
              />
            </div>

            {/* Club Visibility */}
            <div>
              <p className="block text-sm font-medium text-zinc-300 mb-3">
                Club Visibility
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, isPrivate: false })}
                  className={`flex flex-col items-start gap-2 p-4 rounded-2xl border-2 transition-all ${
                    !formData.isPrivate
                      ? "border-red-600 bg-red-600/10"
                      : "border-zinc-700 bg-black hover:border-zinc-500"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Globe size={18} className={!formData.isPrivate ? "text-red-500" : "text-zinc-400"} />
                    <span className={`font-medium text-sm ${!formData.isPrivate ? "text-white" : "text-zinc-400"}`}>
                      Public
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 text-left">Anyone can find and join this club</p>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, isPrivate: true })}
                  className={`flex flex-col items-start gap-2 p-4 rounded-2xl border-2 transition-all ${
                    formData.isPrivate
                      ? "border-red-600 bg-red-600/10"
                      : "border-zinc-700 bg-black hover:border-zinc-500"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Lock size={18} className={formData.isPrivate ? "text-red-500" : "text-zinc-400"} />
                    <span className={`font-medium text-sm ${formData.isPrivate ? "text-white" : "text-zinc-400"}`}>
                      Private
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 text-left">Join by invite code only</p>
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="create-club-max-members" className="block text-sm font-medium text-zinc-300 mb-3">
                Max Members
              </label>
              <div className="relative">
                <input
                  id="create-club-max-members"
                  type="number"
                  name="maxMembers"
                  value={formData.maxMembers}
                  onChange={handleChange}
                  placeholder=""
                  min="2"
                  className="w-full bg-black border border-zinc-700 rounded-2xl px-6 py-4 pl-12 text-white placeholder-zinc-500 focus:outline-none focus:border-red-600 transition"
                />
                <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 py-4 rounded-2xl font-semibold text-lg transition disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? "Creating Club..." : "Create Club"}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-zinc-400 text-sm">
              As the creator, you will be the club leader and have full control over settings, events, and membership.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateClub;
