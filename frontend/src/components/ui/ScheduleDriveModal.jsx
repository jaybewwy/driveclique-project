import { useState } from "react";
import { X, MapPin, CalendarDays } from "lucide-react";
import { compressImage } from "../../utils/imageCompressor";
import { drivesAPI } from "../../services/api";
import { trackEvent } from "../../services/analytics";
import { DriveSchedulerPicker } from "./drive-scheduler-picker";
import { LocationSearch } from "./location-search";
import { DriveMapPicker } from "./drive-map-picker";

const ScheduleDriveModal = ({ clubId, onClose, onScheduled }) => {
  const [scheduleForm, setScheduleForm] = useState({
    name: '',
    date: '',
    time: '',
    location: '',
    coordinates: null,
    description: '',
    image: ''
  });
  const [driveImagePreview, setDriveImagePreview] = useState('');
  const [selectedDate, setSelectedDate] = useState(null);
  const [isScheduling, setIsScheduling] = useState(false);
  const [validationError, setValidationError] = useState(null);

  const handleDriveImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const { compressedData } = await compressImage(file);
      setScheduleForm(prev => ({ ...prev, image: compressedData }));
      setDriveImagePreview(compressedData);
    } catch {
      setValidationError('Failed to process image. Please try again.');
    }
  };

  const handleScheduleFormChange = (e) => {
    setScheduleForm({ ...scheduleForm, [e.target.name]: e.target.value });
    setValidationError(null);
  };

  const getFormattedDate = () => {
    if (selectedDate) {
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return '';
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
  };

  const validateScheduleForm = () => {
    const formattedDate = getFormattedDate();
    if (!scheduleForm.name.trim()) {
      setValidationError('Drive name is required');
      return false;
    }
    if (!formattedDate) {
      setValidationError('Please select a valid date');
      return false;
    }
    if (!scheduleForm.time.trim()) {
      setValidationError('Please select a time');
      return false;
    }
    if (!scheduleForm.location.trim()) {
      setValidationError('Location is required');
      return false;
    }
    const todayObj = new Date();
    todayObj.setHours(0, 0, 0, 0);
    if (selectedDate < todayObj) {
      setValidationError('Cannot schedule a drive in the past');
      return false;
    }
    return true;
  };

  const handleScheduleDrive = async () => {
    if (!validateScheduleForm()) return;
    setIsScheduling(true);
    try {
      const response = await drivesAPI.create({
        clubId,
        name: scheduleForm.name,
        date: getFormattedDate(),
        time: scheduleForm.time,
        location: scheduleForm.location,
        coordinates: scheduleForm.coordinates || undefined,
        description: scheduleForm.description || ''
      });
      if (response.data?.success) {
        trackEvent('DRIVE_SCHEDULED', { clubId });
        await onScheduled();
      }
    } catch (err) {
      setValidationError(err.response?.data?.message || 'Failed to schedule drive.');
    } finally {
      setIsScheduling(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="schedule-drive-modal-title" tabIndex={-1} className="bg-zinc-900 rounded-3xl p-6 max-w-2xl w-full border border-zinc-800 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center">
              <CalendarDays className="w-6 h-6 text-white" />
            </div>
            <h2 id="schedule-drive-modal-title" className="text-2xl font-bold">Schedule a Drive</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Dismiss drive scheduling form"
            className="text-zinc-400 hover:text-white transition"
          >
            <X size={24} />
          </button>
        </div>

        {validationError && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-600 rounded-xl">
            <p className="text-red-400 text-sm">{validationError}</p>
          </div>
        )}

        <div className="space-y-6">
          {/* Drive Name */}
          <div>
            <label htmlFor="schedule-drive-name" className="block text-sm font-medium text-zinc-300 mb-3">
              Drive Name <span className="text-red-500">*</span>
            </label>
            <input
              id="schedule-drive-name"
              type="text"
              name="name"
              value={scheduleForm.name}
              onChange={handleScheduleFormChange}
              className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-red-600 transition"
              placeholder="e.g. Mountain Run, Cars and Coffee"
            />
          </div>

          {/* Date & Time Selection */}
          <div>
            <p className="block text-sm font-medium text-zinc-300 mb-2">
              Date &amp; Time <span className="text-red-500">*</span>
            </p>
            <DriveSchedulerPicker
              selectedDate={selectedDate}
              selectedTime={scheduleForm.time}
              onDateChange={handleDateSelect}
              onTimeChange={(time) => {
                setScheduleForm((prev) => ({ ...prev, time }));
                setValidationError(null);
              }}
              minDate={new Date()}
            />
          </div>

          {/* Location */}
          <div>
            <label htmlFor="schedule-drive-location" className="block text-sm font-medium text-zinc-300 mb-3">
              Location <span className="text-red-500">*</span>
            </label>
            <LocationSearch
              id="schedule-drive-location"
              value={scheduleForm.location}
              onChange={(v) => { setScheduleForm(prev => ({ ...prev, location: v })); setValidationError(null); }}
              onSelect={({ lat, lng }) => setScheduleForm(prev => ({ ...prev, coordinates: { lat, lng } }))}
            />
            {scheduleForm.coordinates?.lat && (
              <div className="mt-3 space-y-1">
                <DriveMapPicker
                  lat={scheduleForm.coordinates.lat}
                  lng={scheduleForm.coordinates.lng}
                  onChange={(coords) => setScheduleForm(prev => ({ ...prev, coordinates: coords }))}
                />
                <p className="text-[11px] text-zinc-400">Drag the pin to fine-tune the exact meeting point.</p>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="schedule-drive-description" className="block text-sm font-medium text-zinc-300 mb-3">
              Description (Optional)
            </label>
            <textarea
              id="schedule-drive-description"
              name="description"
              value={scheduleForm.description}
              onChange={handleScheduleFormChange}
              rows={3}
              className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-red-600 transition resize-none"
              placeholder="Additional details about the drive..."
            />
          </div>

          {/* Route Image (Optional) */}
          <div>
            <p className="block text-sm font-medium text-zinc-300 mb-3">
              Route Image <span className="text-zinc-400 text-xs">(Optional)</span>
            </p>
            {driveImagePreview ? (
              <div className="relative">
                <img src={driveImagePreview} alt="Drive route" className="w-full h-32 object-cover rounded-xl border border-zinc-700" />
                <button
                  type="button"
                  onClick={() => { setDriveImagePreview(''); setScheduleForm(prev => ({ ...prev, image: '' })); }}
                  className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 p-1 rounded-lg transition"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-zinc-700 rounded-xl cursor-pointer hover:border-zinc-500 transition">
                <MapPin size={20} className="text-zinc-400 mb-1" />
                <span className="text-xs text-zinc-400">Upload route map or photo</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleDriveImageUpload} />
              </label>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 py-3 rounded-xl font-medium transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleScheduleDrive}
              disabled={isScheduling}
              className="flex-1 bg-red-600 hover:bg-red-700 py-3 rounded-xl font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isScheduling ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Scheduling...
                </>
              ) : (
                <>
                  <CalendarDays size={18} />
                  Schedule Drive
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScheduleDriveModal;
