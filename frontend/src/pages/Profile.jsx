import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Car, User, Camera, X, Save, MapPin, Plus, Trash2, Star, Pencil } from "lucide-react";
import { authAPI, getErrorMessage } from "../services/api";
import Sidebar from "../components/Sidebar";
import NavBar from "../components/NavBar";
import { compressImage } from "../utils/imageCompressor";

const MAX_CARS = 5;
const MAX_PHOTOS_PER_CAR = 4;
const emptyCar = () => ({ year: "", make: "", model: "", color: "", nickname: "", photos: [], isPrimary: false });

const Profile = ({ onLogout, onUpdateUser }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    name: "",
    username: "",
    email: "",
    bio: "",
    avatar: "",
    location: "",
    cars: [],
    useDisplayName: false
  });
  const [previewAvatar, setPreviewAvatar] = useState("");
  const [avatarFileName, setAvatarFileName] = useState("");
  const [expandedCarIndex, setExpandedCarIndex] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await authAPI.getProfile();
        if (response.data.success) {
          const userData = response.data.user;
          setUser(userData);
          setFormData({
            firstName: userData.firstName || "",
            lastName:  userData.lastName  || "",
            name:      userData.name      || "",
            username:  userData.username  || "",
            email:     userData.email     || "",
            bio:       userData.bio       || "",
            avatar:    userData.avatar    || "",
            location:  userData.location  || "",
            cars:      userData.cars      || [],
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

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const { compressedData, fileName } = await compressImage(file);
        setPreviewAvatar(compressedData);
        setFormData(prev => ({ ...prev, avatar: compressedData }));
        setAvatarFileName(fileName);
      } catch (error) {
        console.error('Error compressing image:', error);
        setMessage({ type: 'error', text: 'Failed to process image. Please try again.' });
      }
    }
  };

  const handleAddCar = () => {
    if (formData.cars.length >= MAX_CARS) return;
    setFormData(prev => ({
      ...prev,
      cars: [...prev.cars, { ...emptyCar(), isPrimary: prev.cars.length === 0 }]
    }));
    setExpandedCarIndex(formData.cars.length);
  };

  const handleRemoveCar = (index) => {
    setFormData(prev => {
      const cars = prev.cars.filter((_, i) => i !== index);
      const removedWasPrimary = prev.cars[index]?.isPrimary;
      if (removedWasPrimary && cars.length > 0 && !cars.some(c => c.isPrimary)) {
        cars[0] = { ...cars[0], isPrimary: true };
      }
      return { ...prev, cars };
    });
    setExpandedCarIndex(null);
  };

  const handleCarFieldChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      cars: prev.cars.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    }));
  };

  const handleSetPrimaryCar = (index) => {
    setFormData(prev => ({
      ...prev,
      cars: prev.cars.map((c, i) => ({ ...c, isPrimary: i === index }))
    }));
  };

  const handleCarPhotoUpload = async (index, e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const remainingSlots = MAX_PHOTOS_PER_CAR - formData.cars[index].photos.length;
    const filesToAdd = files.slice(0, remainingSlots);
    try {
      const compressed = await Promise.all(filesToAdd.map(file => compressImage(file)));
      setFormData(prev => ({
        ...prev,
        cars: prev.cars.map((c, i) =>
          i === index ? { ...c, photos: [...c.photos, ...compressed.map(r => r.compressedData)] } : c
        )
      }));
    } catch (error) {
      console.error('Error compressing car photo:', error);
      setMessage({ type: 'error', text: 'Failed to process photo. Please try again.' });
    }
  };

  const handleRemoveCarPhoto = (carIndex, photoIndex) => {
    setFormData(prev => ({
      ...prev,
      cars: prev.cars.map((c, i) =>
        i === carIndex ? { ...c, photos: c.photos.filter((_, pi) => pi !== photoIndex) } : c
      )
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setSaving(true);
    setMessage({ type: "", text: "" });

    try {
      const response = await authAPI.updateProfile({
        bio:    formData.bio,
        avatar: formData.avatar,
        cars:   formData.cars
      });

      if (response.data.success) {
        setMessage({ type: "success", text: "Profile updated successfully!" });
        const updatedUser = response.data.user;
        if (onUpdateUser) {
          onUpdateUser(updatedUser);
        }
        setUser(updatedUser);
        setFormData(prev => ({ ...prev, cars: updatedUser.cars || [] }));
        setExpandedCarIndex(null);
        // Clear the avatar file name after successful save
        setAvatarFileName("");
        setPreviewAvatar("");
      }
    } catch (error) {
      setMessage({ type: "error", text: getErrorMessage(error) });
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
      <NavBar user={user} onLogout={onLogout} />

      <div className="flex max-w-7xl mx-auto">
        <Sidebar user={user} />

        {/* Main Content */}
        <div id="main-content" role="main" className="flex-1 max-w-3xl min-h-screen p-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold">My Profile</h1>
            <p className="text-zinc-400 mt-1">Manage your account settings</p>
          </div>

          {message.text && (
            <div className={`mb-6 p-4 rounded-2xl ${
              message.type === "success" 
                ? "bg-green-900/30 border border-green-600" 
                : "bg-red-900/30 border border-red-600"
            }`}>
              <p className={message.type === "success" ? "text-green-400" : "text-red-400"}>
                {message.text}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Profile Picture and Bio Section */}
            <div className="bg-zinc-900 rounded-3xl p-6">
              <h2 className="text-xl font-semibold mb-6">Profile Picture & Bio</h2>
              <div className="flex gap-6">
                {/* Profile Picture */}
                <div className="flex-shrink-0">
                  <div className="w-32 h-32 rounded-full bg-zinc-700 overflow-hidden relative">
                    {(previewAvatar || formData.avatar) ? (
                      <img src={previewAvatar || formData.avatar} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-full h-full p-8 text-zinc-400" />
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
                  {avatarFileName && (
                    <p className="text-xs text-zinc-400 text-center mt-2 truncate max-w-[128px]">
                      {avatarFileName}
                    </p>
                  )}
                  <p className="text-xs text-zinc-400 text-center mt-1">
                    Upload a picture
                  </p>
                </div>

                {/* Bio */}
                <div className="flex-1">
                  <textarea
                    name="bio"
                    value={formData.bio}
                    onChange={handleChange}
                    placeholder="Tell us about yourself..."
                    rows="5"
                    maxLength="500"
                    className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:border-red-600 resize-none"
                  />
                  <p className="text-xs text-zinc-400 mt-1 text-right">
                    {formData.bio.length}/500 characters
                  </p>
                </div>
              </div>
            </div>

            {/* My Garage */}
            <div className="bg-zinc-900 rounded-3xl p-6">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-xl font-semibold">My Garage</h2>
                {formData.cars.length < MAX_CARS && (
                  <button
                    type="button"
                    onClick={handleAddCar}
                    className="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300 transition-colors"
                  >
                    <Plus size={16} /> Add Car
                  </button>
                )}
              </div>
              <p className="text-zinc-400 text-sm mb-6">
                Add up to {MAX_CARS} cars and showcase photos of each. Your primary car is shown to other members.
              </p>

              {formData.cars.length === 0 ? (
                <div className="bg-black rounded-xl p-6 text-center">
                  <Car className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
                  <p className="text-zinc-400 text-sm">No cars yet. Click "Add Car" to add your first vehicle.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {formData.cars.map((car, index) => {
                    const isExpanded = expandedCarIndex === index;
                    const title = [car.year, car.make, car.model].filter(Boolean).join(" ") || "Unnamed Car";
                    return (
                      <div key={index} className="bg-black rounded-xl overflow-hidden">
                        {/* Collapsed summary row */}
                        <div className="flex items-center gap-3 p-4">
                          <div className="w-12 h-12 rounded-lg bg-zinc-800 overflow-hidden flex-shrink-0">
                            {car.photos[0] ? (
                              <img src={car.photos[0]} alt={title} className="w-full h-full object-cover" />
                            ) : (
                              <Car className="w-full h-full p-2.5 text-zinc-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <p className="font-medium truncate min-w-0">{title}</p>
                              {car.isPrimary && (
                                <span className="flex items-center gap-1 text-[10px] font-medium text-amber-400 bg-amber-900/30 px-2 py-0.5 rounded-full flex-shrink-0">
                                  <Star size={10} className="fill-amber-400" /> Primary
                                </span>
                              )}
                            </div>
                            {car.nickname && <p className="text-xs text-zinc-400 truncate">"{car.nickname}"</p>}
                          </div>
                          <button
                            type="button"
                            onClick={() => setExpandedCarIndex(isExpanded ? null : index)}
                            className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors flex-shrink-0"
                            aria-label="Edit car"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveCar(index)}
                            className="p-2 rounded-lg hover:bg-red-900/30 text-zinc-400 hover:text-red-400 transition-colors flex-shrink-0"
                            aria-label="Remove car"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                        {/* Expanded edit form */}
                        {isExpanded && (
                          <div className="px-4 pb-4 space-y-4 border-t border-zinc-800 pt-4">
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <label htmlFor={`car-${index}-year`} className="block text-xs font-medium text-zinc-400 mb-1.5">Year</label>
                                <input
                                  id={`car-${index}-year`}
                                  type="text"
                                  value={car.year}
                                  onChange={(e) => handleCarFieldChange(index, "year", e.target.value)}
                                  placeholder="2020"
                                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-600"
                                />
                              </div>
                              <div>
                                <label htmlFor={`car-${index}-make`} className="block text-xs font-medium text-zinc-400 mb-1.5">Make</label>
                                <input
                                  id={`car-${index}-make`}
                                  type="text"
                                  value={car.make}
                                  onChange={(e) => handleCarFieldChange(index, "make", e.target.value)}
                                  placeholder="Toyota"
                                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-600"
                                />
                              </div>
                              <div>
                                <label htmlFor={`car-${index}-model`} className="block text-xs font-medium text-zinc-400 mb-1.5">Model</label>
                                <input
                                  id={`car-${index}-model`}
                                  type="text"
                                  value={car.model}
                                  onChange={(e) => handleCarFieldChange(index, "model", e.target.value)}
                                  placeholder="GR86"
                                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-600"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label htmlFor={`car-${index}-color`} className="block text-xs font-medium text-zinc-400 mb-1.5">Color</label>
                                <input
                                  id={`car-${index}-color`}
                                  type="text"
                                  value={car.color}
                                  onChange={(e) => handleCarFieldChange(index, "color", e.target.value)}
                                  placeholder="Red"
                                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-600"
                                />
                              </div>
                              <div>
                                <label htmlFor={`car-${index}-nickname`} className="block text-xs font-medium text-zinc-400 mb-1.5">Nickname</label>
                                <input
                                  id={`car-${index}-nickname`}
                                  type="text"
                                  value={car.nickname}
                                  onChange={(e) => handleCarFieldChange(index, "nickname", e.target.value)}
                                  placeholder="The Beast"
                                  maxLength={50}
                                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-600"
                                />
                              </div>
                            </div>

                            {/* Photos */}
                            <div>
                              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                                Photos ({car.photos.length}/{MAX_PHOTOS_PER_CAR})
                              </label>
                              <div className="grid grid-cols-4 gap-2">
                                {car.photos.map((photo, photoIndex) => (
                                  <div key={photoIndex} className="relative aspect-square rounded-lg overflow-hidden bg-zinc-800 group">
                                    <img src={photo} alt="" className="w-full h-full object-cover" />
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveCarPhoto(index, photoIndex)}
                                      className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition"
                                      aria-label="Remove photo"
                                    >
                                      <X className="w-5 h-5 text-white" />
                                    </button>
                                  </div>
                                ))}
                                {car.photos.length < MAX_PHOTOS_PER_CAR && (
                                  <label className="aspect-square rounded-lg border-2 border-dashed border-zinc-700 hover:border-zinc-600 flex flex-col items-center justify-center cursor-pointer transition-colors">
                                    <Camera className="w-5 h-5 text-zinc-400 mb-1" />
                                    <span className="text-[10px] text-zinc-400">Add</span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      multiple
                                      onChange={(e) => handleCarPhotoUpload(index, e)}
                                      className="hidden"
                                    />
                                  </label>
                                )}
                              </div>
                            </div>

                            {!car.isPrimary && (
                              <button
                                type="button"
                                onClick={() => handleSetPrimaryCar(index)}
                                className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-amber-400 transition-colors"
                              >
                                <Star size={14} /> Set as primary car
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Action Buttons */}
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

        {/* Right Sidebar - Profile Preview */}
        <div className="w-80 hidden xl:block p-6 sticky top-16 h-[calc(100vh-4rem)] overflow-hidden">
          <h3 className="font-semibold mb-4">Profile Preview</h3>
          <div className="bg-zinc-900 rounded-2xl p-6 text-center">
            <div className="w-20 h-20 rounded-full bg-zinc-700 mx-auto mb-4 overflow-hidden">
              {formData.avatar ? (
                <img src={formData.avatar} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User className="w-full h-full p-6 text-zinc-400" />
              )}
            </div>
            <h4 className="font-bold text-lg">
              {[formData.firstName, formData.lastName].filter(Boolean).join(' ') || formData.name || formData.username}
            </h4>
            <p className="text-zinc-400 text-sm">@{formData.username}</p>
            {formData.location && (
              <div className="flex items-center justify-center gap-1 text-zinc-400 text-xs mt-1 mb-2">
                <MapPin className="w-3 h-3" />
                <span>{formData.location}</span>
              </div>
            )}
            {formData.bio && (
              <p className="text-zinc-400 text-sm mb-4 break-words">{formData.bio}</p>
            )}
            {(() => {
              const primaryCar = formData.cars.find(c => c.isPrimary) || formData.cars[0];
              return primaryCar && (primaryCar.year || primaryCar.make || primaryCar.model) && (
                <div className="bg-black rounded-xl overflow-hidden">
                  {primaryCar.photos[0] && (
                    <img src={primaryCar.photos[0]} alt="" className="w-full h-24 object-cover" />
                  )}
                  <div className="flex items-center justify-center gap-2 text-sm p-3">
                    <Car size={16} className="text-red-500" />
                    <span className="font-medium">
                      {[primaryCar.year, primaryCar.make, primaryCar.model].filter(Boolean).join(" ")}
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;