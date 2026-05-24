import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Car, Search, Bell, User, Camera, Home, Users, X, Save } from "lucide-react";
import Sidebar from "../components/Sidebar";

const Profile = ({ onLogout }) => {
  const navigate = useNavigate();
  const [, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    email: "",
    bio: "",
    avatar: "",
    carYear: "",
    carMake: "",
    carModel: "",
    carColor: "",
    useDisplayName: false
  });
  const [previewAvatar, setPreviewAvatar] = useState("");

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          navigate("/login");
          return;
        }
        const response = await axios.get("http://localhost:5000/api/auth/profile", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (response.data.success) {
          const userData = response.data.user;
          setUser(userData);
          setFormData({
            name: userData.name || "",
            username: userData.username || "",
            email: userData.email || "",
            bio: userData.bio || "",
            avatar: userData.avatar || "",
            carYear: userData.car?.year || "",
            carMake: userData.car?.make || "",
            carModel: userData.car?.model || "",
            carColor: userData.car?.color || "",
            useDisplayName: userData.useDisplayName || false
          });
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
        if (error.response?.status === 401) {
          navigate("/login");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Convert to base64 for preview and storage
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result;
        setPreviewAvatar(base64String);
        setFormData(prev => ({ ...prev, avatar: base64String }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: "", text: "" });

    try {
      const token = localStorage.getItem("token");
      const response = await axios.put(
        "http://localhost:5000/api/auth/profile",
        {
          name: formData.name,
          bio: formData.bio,
          avatar: formData.avatar,
          useDisplayName: formData.useDisplayName,
          car: {
            year: formData.carYear,
            make: formData.carMake,
            model: formData.carModel,
            color: formData.carColor
          }
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        setMessage({ type: "success", text: "Profile updated successfully!" });
        // Update localStorage with new user data
        const updatedUser = response.data.user;
        localStorage.setItem("driveclique_user", JSON.stringify(updatedUser));
        setUser(updatedUser);
      }
    } catch (error) {
      setMessage({ type: "error", text: error.response?.data?.message || "Failed to update profile" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-400">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Top Navigation Bar */}
      <nav className="bg-black border-b border-zinc-800 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center">
            <Car className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold">DriveClique</h1>
        </div>

        <div className="flex-1 max-w-xl mx-8">
          <div className="relative">
            <input
              type="text"
              placeholder="Search clubs, drives, or members..."
              className="w-full bg-zinc-900 border border-zinc-700 rounded-full py-3 pl-12 text-sm focus:outline-none focus:border-red-600"
            />
            <Search className="absolute left-4 top-3.5 text-zinc-500 w-5 h-5" />
          </div>
        </div>

        <div className="flex items-center gap-6">
          <button onClick={() => navigate("/dashboard")} className="p-3 hover:bg-zinc-900 rounded-full">
            <Home className="w-6 h-6" />
          </button>
          <button onClick={() => navigate("/my-clubs")} className="p-3 hover:bg-zinc-900 rounded-full">
            <Users className="w-6 h-6" />
          </button>
          <button className="p-3 hover:bg-zinc-900 rounded-full relative">
            <Bell className="w-6 h-6" />
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center">3</span>
          </button>
          <div className="w-9 h-9 bg-zinc-700 rounded-full overflow-hidden cursor-pointer" onClick={() => navigate("/profile")}>
            {formData.avatar ? (
              <img src={formData.avatar} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <User className="w-full h-full p-1" />
            )}
          </div>
          <button onClick={onLogout} className="text-sm text-zinc-400 hover:text-red-500">Logout</button>
        </div>
      </nav>

      <div className="flex max-w-7xl mx-auto">
        <Sidebar />

        {/* Main Content */}
        <div className="flex-1 max-w-3xl min-h-screen p-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold">My Profile</h1>
            <p className="text-zinc-400 mt-1">Manage your account settings</p>
          </div>

          {message.text && (
            <div className={`mb-6 p-4 rounded-2xl ${message.type === "success" ? "bg-green-900/30 border border-green-600" : "bg-red-900/30 border border-red-600"}`}>
              <p className={message.type === "success" ? "text-green-400" : "text-red-400"}>{message.text}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Profile Picture Section */}
            <div className="bg-zinc-900 rounded-3xl p-6">
              <h2 className="text-xl font-semibold mb-6">Profile Picture</h2>
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 rounded-full bg-zinc-700 overflow-hidden flex-shrink-0 relative">
                  {(previewAvatar || formData.avatar) ? (
                    <img src={previewAvatar || formData.avatar} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-full h-full p-6 text-zinc-500" />
                  )}
                  <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition cursor-pointer rounded-full">
                    <Camera className="w-8 h-8 text-white" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                  </label>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Avatar URL
                  </label>
                  <input
                    type="url"
                    name="avatar"
                    value={formData.avatar}
                    onChange={handleChange}
                    placeholder="https://example.com/avatar.jpg"
                    className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:border-red-600"
                  />
                  <p className="text-xs text-zinc-500 mt-2">
                    Enter a URL for your profile picture, or click the camera icon to upload.
                  </p>
                </div>
              </div>
            </div>

            {/* Personal Information */}
            <div className="bg-zinc-900 rounded-3xl p-6">
              <h2 className="text-xl font-semibold mb-6">Personal Information</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Display Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="John Doe"
                    className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:border-red-600"
                  />
                  <p className="text-xs text-zinc-500 mt-1">
                    This name will be shown to other users if you enable the option below.
                  </p>
                </div>

                <div className="flex items-center justify-between bg-black rounded-xl p-4">
                  <div>
                    <div className="text-sm font-medium text-zinc-300">Show Display Name</div>
                    <div className="text-xs text-zinc-500 mt-1">
                      Use your display name instead of username on Dashboard and member lists
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={formData.useDisplayName}
                    onClick={() => setFormData(prev => ({ ...prev, useDisplayName: !prev.useDisplayName }))}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      formData.useDisplayName ? 'bg-red-600' : 'bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        formData.useDisplayName ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    disabled
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-500 cursor-not-allowed"
                  />
                  <p className="text-xs text-zinc-500 mt-1">Username cannot be changed.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    disabled
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-500 cursor-not-allowed"
                  />
                  <p className="text-xs text-zinc-500 mt-1">Email cannot be changed.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Bio
                  </label>
                  <textarea
                    name="bio"
                    value={formData.bio}
                    onChange={handleChange}
                    placeholder="Tell us about yourself..."
                    rows="3"
                    maxLength="500"
                    className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:border-red-600 resize-none"
                  />
                  <p className="text-xs text-zinc-500 mt-1 text-right">
                    {formData.bio.length}/500 characters
                  </p>
                </div>
              </div>
            </div>

            {/* Car Information */}
            <div className="bg-zinc-900 rounded-3xl p-6">
              <h2 className="text-xl font-semibold mb-6">Car Information</h2>
              <p className="text-zinc-400 text-sm mb-6">
                Add your car details to show fellow enthusiasts what you drive.
              </p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Year
                  </label>
                  <input
                    type="text"
                    name="carYear"
                    value={formData.carYear}
                    onChange={handleChange}
                    placeholder="2020"
                    className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:border-red-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Make
                  </label>
                  <input
                    type="text"
                    name="carMake"
                    value={formData.carMake}
                    onChange={handleChange}
                    placeholder="Toyota"
                    className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:border-red-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Model
                  </label>
                  <input
                    type="text"
                    name="carModel"
                    value={formData.carModel}
                    onChange={handleChange}
                    placeholder="GR86"
                    className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:border-red-600"
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Color
                </label>
                <input
                  type="text"
                  name="carColor"
                  value={formData.carColor}
                  onChange={handleChange}
                  placeholder="Red"
                  className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:border-red-600"
                />
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="bg-zinc-800 hover:bg-zinc-700 px-6 py-3 rounded-2xl font-medium flex items-center gap-2 mr-4"
              >
                <X size={20} />
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="bg-red-600 hover:bg-red-700 px-8 py-3 rounded-2xl font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={20} />
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>

        {/* Right Sidebar */}
        <div className="w-80 hidden xl:block p-6 sticky top-16 h-screen overflow-y-auto">
          <h3 className="font-semibold mb-4">Profile Preview</h3>
          <div className="bg-zinc-900 rounded-2xl p-6 text-center">
            <div className="w-20 h-20 rounded-full bg-zinc-700 mx-auto mb-4 overflow-hidden">
              {formData.avatar ? (
                <img src={formData.avatar} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User className="w-full h-full p-6 text-zinc-500" />
              )}
            </div>
            <h4 className="font-bold text-lg">
              {formData.name || formData.username}
            </h4>
            <p className="text-zinc-500 text-sm mb-4">@{formData.username}</p>
            {formData.bio && (
              <p className="text-zinc-400 text-sm mb-4">{formData.bio}</p>
            )}
            {(formData.carYear || formData.carMake || formData.carModel) && (
              <div className="bg-black rounded-xl p-3">
                <div className="flex items-center justify-center gap-2 text-sm">
                  <Car size={16} className="text-red-500" />
                  <span className="font-medium">
                    {[formData.carYear, formData.carMake, formData.carModel].filter(Boolean).join(" ")}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;