import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Calendar, MapPin, ArrowLeft, Info, CalendarDays, AlertCircle, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';

const ScheduleDrive = () => {
  const { clubId } = useParams();
  const navigate = useNavigate();
  
  const [clubData, setClubData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [validationError, setValidationError] = useState(null);
  const [isScheduling, setIsScheduling] = useState(false);
  const [success, setSuccess] = useState(false);

  const [scheduleForm, setScheduleForm] = useState({
    name: '',
    date: '',
    time: '',
    location: '',
    description: ''
  });

  const [timePeriod, setTimePeriod] = useState('AM');
  
  // Calendar state for box-calendar date selection
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState(null);
  
  // Get today's date for disabling past dates
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Fetch club data on component mount
  useEffect(() => {
    const fetchClubData = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!clubId) {
          setError('Club ID is required');
          setLoading(false);
          return;
        }
        const response = await axios.get(`http://localhost:5000/api/clubs/${clubId}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        if (response.data.success) {
          setClubData(response.data.club);
        }
        setLoading(false);
      } catch (err) {
        console.error('Error fetching club data:', err);
        setError(err.response?.data?.message || 'Failed to load club information');
        setLoading(false);
      }
    };
    
    fetchClubData();
  }, [clubId]);

  const handleChange = (e) => {
    setScheduleForm({
      ...scheduleForm,
      [e.target.name]: e.target.value
    });
    setValidationError(null);
  };

  const handleTimeChange = (hour, minute) => {
    const h = hour || '12';
    const m = minute || '00';
    setScheduleForm(prev => ({ ...prev, time: `${h}:${m} ${timePeriod}` }));
  };

  const handlePeriodChange = (period) => {
    setTimePeriod(period);
    const currentTime = scheduleForm.time;
    if (currentTime) {
      const [time] = currentTime.split(' ');
      setScheduleForm(prev => ({ ...prev, time: `${time} ${period}` }));
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

  const parseTimeForDropdowns = () => {
    if (!scheduleForm.time) return { hour: '', minute: '', period: 'AM' };
    const [time, period] = scheduleForm.time.split(' ');
    const [hour, minute] = time.split(':');
    return { hour: parseInt(hour, 10), minute, period: period || 'AM' };
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

  const getDisplayDate = () => {
    if (selectedDate) {
      return selectedDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
    return 'Select a date';
  };

  // Calendar navigation
  const goToPreviousMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear(calendarYear - 1);
    } else {
      setCalendarMonth(calendarMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear(calendarYear + 1);
    } else {
      setCalendarMonth(calendarMonth + 1);
    }
  };

  // Check if a date is in the past (disabled)
  const isDateDisabled = (day) => {
    const dateToCheck = new Date(calendarYear, calendarMonth, day);
    return dateToCheck < today;
  };

  // Check if a date is selected
  const isDateSelected = (day) => {
    if (!selectedDate) return false;
    return (
      selectedDate.getDate() === day &&
      selectedDate.getMonth() === calendarMonth &&
      selectedDate.getFullYear() === calendarYear
    );
  };

  // Handle date selection from calendar
  const handleDateSelect = (day) => {
    if (isDateDisabled(day)) return;
    const newDate = new Date(calendarYear, calendarMonth, day);
    setSelectedDate(newDate);
  };

  // Get days in the current month
  const getDaysInMonth = () => {
    const year = calendarYear;
    const month = calendarMonth;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    
    return { daysInMonth, startingDay };
  };

  const validateForm = () => {
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
    
    // Check if date is in the past
    const selectedDateObj = new Date(formattedDate);
    const todayObj = new Date();
    todayObj.setHours(0, 0, 0, 0);
    
    if (selectedDateObj < todayObj) {
      setValidationError('Cannot schedule a drive in the past');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsScheduling(true);
    
    try {
      const token = localStorage.getItem('token');
      const formattedDate = getFormattedDate();
      
      const response = await axios.post(
        'http://localhost:5000/api/drives',
        {
          clubId: clubId,
          name: scheduleForm.name,
          date: formattedDate,
          time: scheduleForm.time,
          location: scheduleForm.location,
          description: scheduleForm.description || ''
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      
      if (response.data?.success) {
        setSuccess(true);
        // Redirect back to club detail page after 2 seconds
        setTimeout(() => {
          navigate(`/club/${clubId}`, { 
            state: { message: 'Drive successfully scheduled!' } 
          });
        }, 2000);
      }
    } catch (err) {
      setValidationError(err.response?.data?.message || 'Failed to schedule drive. Please try again.');
      setIsScheduling(false);
    }
  };

  const { daysInMonth, startingDay } = getDaysInMonth();

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-400 text-lg">Loading club information...</p>
      </div>
    );
  }

  if (error || !clubData) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="bg-zinc-900 rounded-3xl p-8 max-w-md w-full border border-zinc-800">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
            <h2 className="text-2xl font-bold text-white">Error</h2>
          </div>
          <p className="text-zinc-400 mb-6">{error || 'Club not found'}</p>
          <Link 
            to={`/club/${clubId}`} 
            className="flex items-center gap-2 text-red-500 hover:text-red-400 font-medium transition"
          >
            <ArrowLeft size={18} />
            Return to Club
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="bg-zinc-900 rounded-3xl p-8 max-w-md w-full border border-zinc-800 text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Drive Scheduled!</h2>
          <p className="text-zinc-400 mb-6">Redirecting to club page...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate(`/club/${clubId}`)}
          className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6 transition"
        >
          <ArrowLeft size={20} />
          Back to Club
        </button>

        <div className="bg-zinc-900 rounded-3xl overflow-hidden border border-zinc-800">
          {/* Header */}
          <div className="bg-red-600/20 border-b border-red-600/30 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center">
                <CalendarDays className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white">Schedule a Drive</h1>
            </div>
            <p className="text-red-300 ml-14">
              Plan your next club event and share it with members.
            </p>
          </div>

          {/* Club Information */}
          <div className="p-6 border-b border-zinc-800">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Info className="w-5 h-5 text-zinc-400" />
              Club Information
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-zinc-800 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <CalendarDays className="w-4 h-4 text-zinc-500" />
                  <p className="text-xs text-zinc-500">Club Name</p>
                </div>
                <p className="font-medium text-white">{clubData.name}</p>
              </div>
              <div className="bg-zinc-800 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="w-4 h-4 text-zinc-500" />
                  <p className="text-xs text-zinc-500">Location</p>
                </div>
                <p className="font-medium text-white">{clubData.location || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Schedule Form */}
          <form onSubmit={handleSubmit} className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-red-500" />
              Drive Details
            </h2>
            
            {validationError && (
              <div className="mb-6 p-4 bg-red-900/30 border border-red-600 rounded-xl">
                <p className="text-red-400 text-sm">{validationError}</p>
              </div>
            )}

            <div className="space-y-6">
              {/* Drive Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-zinc-300 mb-3">
                  Drive Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={scheduleForm.name}
                  onChange={handleChange}
                  className="w-full bg-black border border-zinc-700 rounded-2xl px-6 py-4 text-white placeholder-zinc-500 focus:outline-none focus:border-red-600 transition"
                  placeholder="e.g. Mountain Run, Cars and Coffee"
                  required
                />
              </div>

              {/* Date Selection - Box Calendar */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-3">
                  Date <span className="text-red-500">*</span>
                </label>
                
                {/* Calendar Box */}
                <div className="bg-black border border-zinc-700 rounded-2xl p-4">
                  {/* Calendar Header */}
                  <div className="flex items-center justify-between mb-4">
                    <button
                      type="button"
                      onClick={goToPreviousMonth}
                      className="p-2 hover:bg-zinc-800 rounded-xl transition"
                    >
                      <ChevronLeft className="w-5 h-5 text-zinc-400" />
                    </button>
                    <span className="text-white font-semibold text-lg">
                      {monthNames[calendarMonth]} {calendarYear}
                    </span>
                    <button
                      type="button"
                      onClick={goToNextMonth}
                      className="p-2 hover:bg-zinc-800 rounded-xl transition"
                    >
                      <ChevronRight className="w-5 h-5 text-zinc-400" />
                    </button>
                  </div>

                  {/* Day Headers */}
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                      <div key={day} className="text-center text-xs text-zinc-500 py-2">
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Calendar Days */}
                  <div className="grid grid-cols-7 gap-1">
                    {/* Empty cells for days before the first day of the month */}
                    {Array.from({ length: startingDay }, (_, i) => (
                      <div key={`empty-${i}`} className="aspect-square"></div>
                    ))}
                    
                    {/* Days of the month */}
                    {Array.from({ length: daysInMonth }, (_, i) => {
                      const day = i + 1;
                      const disabled = isDateDisabled(day);
                      const selected = isDateSelected(day);
                      
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => handleDateSelect(day)}
                          disabled={disabled}
                          className={`
                            aspect-square rounded-xl text-sm font-medium transition
                            flex items-center justify-center
                            ${disabled 
                              ? 'text-zinc-700 cursor-not-allowed' 
                              : selected
                                ? 'bg-red-600 text-white'
                                : 'text-white hover:bg-zinc-800'
                            }
                          `}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Selected Date Display */}
                <div className="mt-3 text-sm text-zinc-400">
                  {selectedDate && (
                    <span className="text-red-400">{getDisplayDate()}</span>
                  )}
                </div>
              </div>

              {/* Time Selection */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-3">
                  Time <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-3">
                  <select
                    value={parseTimeForDropdowns().hour || ''}
                    onChange={(e) =>
                      handleTimeChange(
                        parseInt(e.target.value),
                        parseTimeForDropdowns().minute
                      )
                    }
                    className="flex-1 bg-black border border-zinc-700 rounded-2xl px-4 py-4 focus:outline-none focus:border-red-600 transition"
                    required
                  >
                    <option value="">Hour</option>
                    {hours.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>

                  <select
                    value={parseTimeForDropdowns().minute || ''}
                    onChange={(e) =>
                      handleTimeChange(parseTimeForDropdowns().hour, e.target.value)
                    }
                    className="flex-1 bg-black border border-zinc-700 rounded-2xl px-4 py-4 focus:outline-none focus:border-red-600 transition"
                    required
                  >
                    <option value="">Min</option>
                    {minutes.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>

                  <select
                    value={parseTimeForDropdowns().period}
                    onChange={(e) => handlePeriodChange(e.target.value)}
                    className="flex-1 bg-black border border-zinc-700 rounded-2xl px-4 py-4 focus:outline-none focus:border-red-600 transition"
                  >
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
              </div>

              {/* Location */}
              <div>
                <label htmlFor="location" className="block text-sm font-medium text-zinc-300 mb-3">
                  Location <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="location"
                  name="location"
                  value={scheduleForm.location}
                  onChange={handleChange}
                  className="w-full bg-black border border-zinc-700 rounded-2xl px-6 py-4 text-white placeholder-zinc-500 focus:outline-none focus:border-red-600 transition"
                  placeholder="e.g. Mountain View Parking Lot, 123 Main St"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-zinc-300 mb-3">
                  Description (Optional)
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={scheduleForm.description}
                  onChange={handleChange}
                  rows="4"
                  className="w-full bg-black border border-zinc-700 rounded-2xl px-6 py-4 text-white placeholder-zinc-500 focus:outline-none focus:border-red-600 transition resize-none"
                  placeholder="Additional details about the drive..."
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-8 flex gap-4">
              <button
                type="submit"
                disabled={isScheduling}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-4 px-6 rounded-2xl font-semibold text-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                    <CalendarDays size={20} />
                    Schedule Drive
                  </>
                )}
              </button>
              
              <Link
                to={`/club/${clubId}`}
                className="flex-none bg-zinc-800 hover:bg-zinc-700 text-white py-4 px-6 rounded-2xl font-medium transition flex items-center justify-center gap-2"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>

        {/* Additional Info */}
        <div className="mt-6 p-4 bg-blue-900/20 border border-blue-600/30 rounded-xl">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-blue-400">
                <strong className="font-semibold">Note:</strong> All club members will be notified about this scheduled drive. You can modify or cancel the drive from the club details page if needed.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScheduleDrive;