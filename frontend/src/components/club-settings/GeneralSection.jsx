import { useState } from "react";
import { compressImage } from "../../utils/imageCompressor";
import { useClubUpdate } from "../../hooks/useClubUpdate";
import ClubTagPicker from "../ui/ClubTagPicker";
import { LocationSearch } from "../ui/location-search";
import { SettingsField, settingsInputClass } from "../settings/settingsForm";
import { SaveBar, SettingsPanel } from "./SettingsPanel";

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
  tags: club.tags || [],
});

const hideBrokenImage = (e) => { e.target.style.display = 'none'; };

/** Club Settings → General: avatar, name, description, location, and tags */
const GeneralSection = ({ club, onClubUpdated }) => {
  const [formData, setFormData] = useState(() => initialForm(club));
  const [avatarFileName, setAvatarFileName] = useState('');
  const { saving, message, setMessage, save } = useClubUpdate(club._id);

  const updateField = (field, value) => setFormData((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (formData.description && formData.description.length < 10) {
      setMessage({ type: 'error', text: 'Description must be at least 10 characters long' });
      return;
    }
    const saved = await save(formData, 'Club details saved.');
    if (saved) {
      const { name, description, location, geo, avatar, tags } = saved;
      onClubUpdated({ name, description, location, geo, avatar, tags });
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const { compressedData, fileName } = await compressImage(file);
      updateField('avatar', compressedData);
      setAvatarFileName(fileName);
    } catch (err) {
      console.error('Error compressing image:', err);
      setMessage({ type: 'error', text: 'Failed to process image. Please try again.' });
    }
  };

  return (
    <SettingsPanel title="General" description="Your club's picture, name, description, location, and tags.">
      <div className="space-y-5">
        <div>
          <p className="block text-sm font-medium text-zinc-300 mb-2">Club Avatar</p>
          <div className="flex flex-wrap items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-zinc-700 overflow-hidden flex-shrink-0 border-2 border-zinc-600">
              {formData.avatar ? (
                <img src={formData.avatar} alt="Club avatar preview" className="w-full h-full object-cover" onError={hideBrokenImage} />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-zinc-300 text-xs">No Image</span>
                </div>
              )}
            </div>
            <label className="cursor-pointer bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-xl font-medium text-sm transition flex items-center gap-2 focus-within:ring-2 focus-within:ring-red-600">
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="sr-only"
              />
              Choose Image
            </label>
            {avatarFileName && (
              <p className="text-xs text-zinc-400">Selected: {avatarFileName}</p>
            )}
          </div>
        </div>

        <SettingsField label="Club Name" htmlFor="club-settings-name">
          <input
            id="club-settings-name"
            type="text"
            value={formData.name || ''}
            onChange={(e) => updateField('name', e.target.value)}
            className={settingsInputClass}
          />
        </SettingsField>

        <SettingsField label="Description" htmlFor="club-settings-description">
          <textarea
            id="club-settings-description"
            value={formData.description || ''}
            onChange={(e) => updateField('description', e.target.value)}
            rows={3}
            className={`${settingsInputClass} resize-none`}
          />
        </SettingsField>

        <SettingsField
          label="Location"
          htmlFor="club-settings-location"
          hint={formData.coordinates
            ? "Pinned. This club shows up in nearby searches."
            : "Pick a suggestion so this club shows up in nearby searches."}
        >
          {/* Functional updates: picking a suggestion fires onChange and
              onSelect back to back, so spreading a captured form object
              would let the second call overwrite the first. */}
          <LocationSearch
            id="club-settings-location"
            value={formData.location || ''}
            onChange={(val) => setFormData((prev) => ({ ...prev, location: val, coordinates: null }))}
            onSelect={({ lat, lng }) => updateField('coordinates', { lat, lng })}
          />
        </SettingsField>

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-zinc-300">Club Tags</p>
            <span className="text-xs text-zinc-400">{(formData.tags || []).length}/{MAX_TAGS} selected</span>
          </div>
          <ClubTagPicker
            selected={formData.tags || []}
            onChange={(tags) => updateField('tags', tags)}
            max={MAX_TAGS}
          />
        </div>
      </div>

      <SaveBar onSave={handleSave} saving={saving} message={message} />
    </SettingsPanel>
  );
};

export default GeneralSection;
