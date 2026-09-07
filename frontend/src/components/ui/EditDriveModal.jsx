import { useState } from "react";
import { X } from "lucide-react";
import { drivesAPI } from "../../services/api";
import { LocationSearch } from "./location-search";
import { DriveMapPicker } from "./drive-map-picker";

// State-owning child, matching ScheduleDriveModal.jsx's pattern (not
// DriveDetailModal.jsx's presentational-only one): this form's draft state
// was already confirmed (via a full grep of ClubDetail.jsx before this
// extraction) to have no reader outside this modal's own fields and its own
// save handler, and the modal is conditionally rendered by its caller
// (`{showEditModal && selectedDrive && <EditDriveModal .../>}`), so a fresh
// mount on every open replaces any need for a manual reset. `selectedDrive`
// itself, `showEditModal`, and the post-save `drives` array update all stay
// in ClubDetail.jsx, since `selectedDrive` is also read by the separate
// drive-detail view modal and by the page's shared overlay/Escape handling.
const EditDriveModal = ({ drive, onClose, onSave }) => {
  const [editFormData, setEditFormData] = useState(() => ({
    name: drive.name,
    date: new Date(drive.date).toISOString().split('T')[0],
    time: drive.time || '',
    location: drive.location || '',
    coordinates: drive.coordinates || null,
    description: drive.description || '',
  }));

  // Mirrors the original inline handler exactly, including its existing
  // silent-failure behavior on error (a console.error with no visible
  // message) — this extraction moves where the form lives, not what saving
  // a drive does.
  const handleUpdateDrive = async () => {
    try {
      const updateData = { ...editFormData };
      if (updateData.date) updateData.date = new Date(updateData.date).toISOString();
      const response = await drivesAPI.update(drive._id, updateData);
      if (response.data?.success) {
        onSave(response.data.drive);
      }
    } catch (error) {
      console.error("Error updating drive:", error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="edit-drive-modal-title" tabIndex={-1} className="bg-zinc-900 rounded-3xl p-8 max-w-md w-full border border-zinc-800 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 id="edit-drive-modal-title" className="text-2xl font-bold">Edit Drive</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Dismiss drive editor"
            className="text-zinc-400 hover:text-white transition"
          >
            <X size={24} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="edit-drive-name" className="block text-sm text-zinc-400 mb-2">Name</label>
            <input
              id="edit-drive-name"
              type="text"
              value={editFormData.name || ''}
              onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
              className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-600"
            />
          </div>

          <div>
            <label htmlFor="edit-drive-date" className="block text-sm text-zinc-400 mb-2">Date</label>
            <input
              id="edit-drive-date"
              type="date"
              value={editFormData.date || ''}
              onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
              className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-600"
            />
          </div>

          <div>
            <label htmlFor="edit-drive-time" className="block text-sm text-zinc-400 mb-2">Time</label>
            <input
              id="edit-drive-time"
              type="text"
              value={editFormData.time || ''}
              onChange={(e) => setEditFormData({ ...editFormData, time: e.target.value })}
              placeholder="e.g., 10:00 AM"
              className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-600"
            />
          </div>

          <div>
            <label htmlFor="edit-drive-location" className="block text-sm text-zinc-400 mb-2">Location</label>
            <LocationSearch
              id="edit-drive-location"
              value={editFormData.location || ''}
              onChange={(v) => setEditFormData({ ...editFormData, location: v })}
              onSelect={({ lat, lng }) => setEditFormData({ ...editFormData, coordinates: { lat, lng } })}
            />
            {editFormData.coordinates?.lat && (
              <div className="mt-3 space-y-1">
                <DriveMapPicker
                  lat={editFormData.coordinates.lat}
                  lng={editFormData.coordinates.lng}
                  onChange={(coords) => setEditFormData({ ...editFormData, coordinates: coords })}
                />
                <p className="text-[11px] text-zinc-400">Drag the pin to fine-tune the exact meeting point.</p>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="edit-drive-description" className="block text-sm text-zinc-400 mb-2">Description</label>
            <textarea
              id="edit-drive-description"
              value={editFormData.description || ''}
              onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
              rows={3}
              className="w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-600 resize-none"
            />
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
              onClick={handleUpdateDrive}
              className="flex-1 bg-red-600 hover:bg-red-700 py-3 rounded-2xl font-medium transition"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditDriveModal;
