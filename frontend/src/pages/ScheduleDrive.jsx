import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Calendar, MapPin, ArrowLeft, Info, CalendarDays, AlertCircle, CheckCircle } from 'lucide-react';

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
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedYear, setSelectedYear] = useState('');

  // Fetch club data on component mount
  useEffect(() => {
    const fetchClubData = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`http://localhost:5000/api/clubs/${clubId}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        if (response.data.success) {
          setClubData(response.data.club);
        }
        setLoading(false);
      } catch {
        setError('Failed to load club information');
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

  const months = [
    { value: '01', label: 'January' },
    { value: '02', label: 'February' },
    { value: '03', label: 'March' },
    { value: '04', label: 'April' },
    { value: '05', label: 'May' },
    { value: '06', label: 'June' },
    { value: '07', label: 'July' },
    { value: '08', label: 'August' },
    { value: '09', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' }
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear + i);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

  const parseTimeForDropdowns = () => {
    if (!scheduleForm.time) return { hour: '', minute: '', period: 'AM' };
    const [time, period] = scheduleForm.time.split(' ');
    const [hour, minute] = time.split(':');
    return { hour: parseInt(hour, 10), minute, period: period || 'AM' };
  };

  const getFormattedDate = () => {
    if (selectedMonth && selectedDay && selectedYear) {
      return `${selectedYear}-${selectedMonth}-${selectedDay.toString().padStart(2, '0')}`;
    }
    return '';
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
    const selectedDate = new Date(formattedDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
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
    } catch (error) {
      setValidationError(error.response?.data?.message || 'Failed to schedule drive. Please try again.');
      setIsScheduling(false);
    }
  };

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

              {/* Date Selection */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-3">
                  Date <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-3">
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="flex-1 bg-black border border-zinc-700 rounded-2xl px-4 py-4 focus:outline-none focus:border-red-600 transition"
                    required
                  >
                    <option value="">Month</option>
                    {months.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedDay}
                    onChange={(e) => setSelectedDay(parseInt(e.target.value))}
                    className="flex-1 bg-black border border-zinc-700 rounded-2xl px-4 py-4 focus:outline-none focus:border-red-600 transition"
                    required
                  >
                    <option value="">Day</option>
                    {days.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="flex-1 bg-black border border-zinc-700 rounded-2xl px-4 py-4 focus:outline-none focus:border-red-600 transition"
                    required
                  >
                    <option value="">Year</option>
                    {years.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
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
                  placeholder="Additional details about the drive, route information, or special instructions..."
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