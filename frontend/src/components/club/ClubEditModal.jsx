import { useState } from "react";
import { Crown, Trash2 } from "lucide-react";
import { clubsAPI } from "../../services/api";
import { compressImage } from "../../utils/imageCompressor";
import { displayName, idOf } from "../../lib/userDisplay";
import ClubTagPicker from "../ui/ClubTagPicker";
import { LocationSearch } from "../ui/location-search";
import { ClubDialog } from "./ClubDialogs";

const MAX_TAGS = 5;

const initialForm = (club) => ({
  name: club.name,
  description: club.description || '',
  location: club.location || '',
  // UC-46 search point — GeoJSON stores [lng, lat]; the API takes { lat, lng }.
  // Always sent on save (null clears it) so it stays in step with `location`.
  coordinates: club.geo?.coordinates?.length === 2
    ? { lat: club.geo.coordinates[1], lng: club.geo.coordinates[0] }
    : null,
  avatar: club.avatar || '',
  isPrivate: club.isPrivate || false,
  tags: club.tags || [],
});

const hideBrokenImage = (e) => { e.target.style.display = 'none'; };

const TransferOwnershipSection = ({ club, currentUserId, onTransferred }) => {
  const [target, setTarget] = useState(null);
  const [error, setError] = useState('');

  const transfer = async () => {
    if (!target) return;
    setError('');
    try {
      const response = await clubsAPI.transfer(club._id, target._id);
      if (response.data?.success) onTransferred(response.data.club);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to transfer ownership');
    }
  };

  return (
    <div className="border-t border-zinc-700 pt-4 mt-4">
      <h3 className="text-amber-400 font-medium mb-2 flex items-center gap-2">
        <Crown size={16} />
        Transfer Ownership
      </h3>
      <p className="text-zinc-400 text-sm mb-3">
        Select a member to become the new club leader. You will become a regular member.
      </p>
      <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
        {(club.members || [])
          .filter((m) => idOf(m) !== currentUserId)
          .map((member) => (
            <button
              key={member._id}
              type="button"
              onClick={() => setTarget(member)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition text-left ${
                target?._id === member._id
                  ? 'bg-amber-500/20 border border-amber-500/50'
                  : 'bg-zinc-800 hover:bg-zinc-700 border border-transparent'
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-zinc-600 to-zinc-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {member.avatar
                  ? <img src={member.avatar} alt={member.username} className="w-full h-full object-cover" />
                  : <span className="text-xs font-bold">{member.username?.charAt(0)?.toUpperCase()}</span>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{displayName(member)}</p>
                <p className="text-xs text-zinc-400">@{member.username}</p>
              </div>
              {target?._id === member._id && (
                <Crown size={14} className="text-amber-400 flex-shrink-0" />
              )}
            </button>
          ))}
      </div>
      {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
      <button
        type="button"
        onClick={transfer}
        disabled={!target}
        className="w-full bg-amber-600 hover:bg-amber-500 py-2 rounded-xl font-medium transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
      >
        <Crown size={15} />
        Transfer to {target ? displayName(target) : '...'}
      </button>
    </div>
  );
};

/**
 * Leader-only "Manage Club": edit details, transfer ownership, or start
 * deleting the club (onRequestDelete opens the separate confirmation).
 * onSaved(club) / onTransferred(club) receive the server's updated club.
 */
const ClubEditModal = ({ club, currentUserId, onSaved, onTransferred, onRequestDelete, onClose }) => {
  const [formData, setFormData] = useState(() => initialForm(club));
  const [avatarPreview, setAvatarPreview] = useState(club.avatar || '');
  const [avatarFileName, setAvatarFileName] = useState('');
  const [error, setError] = useState('');

  const updateField = (field, value) => setFormData((prev) => ({ ...prev, [field]: value }));

  const save = async () => {
    setError('');
    if (formData.description && formData.description.length < 10) {
      setError('Description must be at least 10 characters long');
      return;
    }
    try {
      const response = await clubsAPI.update(club._id, formData);
      if (response.data?.success) onSaved(response.data.club);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update club. Please try again.');
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const { compressedData, fileName } = await compressImage(file);
      updateField('avatar', compressedData);
      setAvatarPreview(compressedData);
      setAvatarFileName(fileName);
    } catch (err) {
      console.error('Error compressing image:', err);
      setError('Failed to process image. Please try again.');
    }
  };

  return (
    <ClubDialog
      titleId="edit-club-modal-title"
      title="Edit Club"
      closeLabel="Dismiss club editor"
      onClose={onClose}
      panelClassName="max-w-md border-zinc-800 max-h-[90vh] overflow-y-auto"
    >
      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-600 rounded-xl">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        {/* Club Avatar */}
        <div>
          <p className="block text-sm text-zinc-400 mb-2">Club Avatar</p>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-20 h-20 rounded-full bg-zinc-700 overflow-hidden flex-shrink-0 border-2 border-zinc-600">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Club avatar preview" className="w-full h-full object-cover" onError={hideBrokenImage} />
              ) : club.avatar ? (
                <img src={club.avatar} alt="Club avatar" className="w-full h-full object-cover" onError={hideBrokenImage} />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-zinc-400 text-xs">No Image</span>
                </div>
              )}
            </div>
            <label className="cursor-pointer bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-xl font-medium text-sm transition flex items-center gap-2">
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
              Choose Image
            </label>
            {avatarFileName && (
              <p className="text-xs text-zinc-400">Selected: {avatarFileName}</p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="club-edit-name" className="block text-sm text-zinc-400 mb-2">Club Name</label>
          <input
            id="club-edit-name"
            type="text"
            value={formData.name || ''}
            onChange={(e) => updateField('name', e.target.value)}
            className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-600"
          />
        </div>

        <div>
          <label htmlFor="club-edit-description" className="block text-sm text-zinc-400 mb-2">Description</label>
          <textarea
            id="club-edit-description"
            value={formData.description || ''}
            onChange={(e) => updateField('description', e.target.value)}
            rows={3}
            className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-600 resize-none"
          />
        </div>

        <div>
          <label htmlFor="club-edit-location" className="block text-sm text-zinc-400 mb-2">Location</label>
          {/* Functional updates: picking a suggestion fires onChange and
              onSelect back to back, so spreading a captured form object
              would let the second call overwrite the first. */}
          <LocationSearch
            id="club-edit-location"
            value={formData.location || ''}
            onChange={(val) => setFormData((prev) => ({ ...prev, location: val, coordinates: null }))}
            onSelect={({ lat, lng }) => updateField('coordinates', { lat, lng })}
          />
          <p className="text-xs text-zinc-400 mt-2">
            {formData.coordinates
              ? "Pinned. This club shows up in nearby searches."
              : "Pick a suggestion so this club shows up in nearby searches."}
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-zinc-400">Club Tags</p>
            <span className="text-xs text-zinc-400">{(formData.tags || []).length}/{MAX_TAGS} selected</span>
          </div>
          <ClubTagPicker
            selected={formData.tags || []}
            onChange={(tags) => updateField('tags', tags)}
            max={MAX_TAGS}
          />
        </div>

        <div className="bg-zinc-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Privacy Setting</p>
              <p className="text-xs text-zinc-400">
                {formData.isPrivate ? 'Private - Only invited members can join' : 'Public - Anyone can request to join'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => updateField('isPrivate', !formData.isPrivate)}
              className={`relative w-10 h-5 rounded-full transition ${
                formData.isPrivate ? "bg-red-600" : "bg-zinc-600"
              }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition ${
                  formData.isPrivate ? "left-5" : "left-0.5"
                }`}
              />
            </button>
          </div>
        </div>

        <TransferOwnershipSection club={club} currentUserId={currentUserId} onTransferred={onTransferred} />

        {/* Danger Zone - Delete Club */}
        <div className="border-t border-zinc-700 pt-4 mt-4">
          <div className="bg-red-900/20 border border-red-600 rounded-xl p-4">
            <h3 className="text-red-400 font-medium mb-3 flex items-center gap-2">
              <Trash2 size={16} />
              Danger Zone
            </h3>
            <p className="text-red-300 text-sm mb-3">
              Permanently delete this club and all associated data. This action cannot be undone.
            </p>
            <button
              type="button"
              onClick={onRequestDelete}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded-xl font-medium flex items-center justify-center gap-2 transition"
            >
              <Trash2 size={16} />
              Delete Club
            </button>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-zinc-800 hover:bg-zinc-700 py-3 rounded-2xl font-medium transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            className="flex-1 bg-red-600 hover:bg-red-700 py-3 rounded-2xl font-medium transition"
          >
            Save Changes
          </button>
        </div>
      </div>
    </ClubDialog>
  );
};

export default ClubEditModal;
