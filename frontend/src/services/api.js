/**
 * API Service Layer
 * Centralized API calls with error handling, request/response interceptors,
 * and consistent error messages.
 */

import axios from 'axios';

// API base URL - use environment variable if available, fallback to localhost
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Create axios instance with default configuration
 */
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 second timeout
});

/**
 * Request interceptor - adds auth token to requests
 */
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('[API Request Error]', error);
    return Promise.reject(error);
  }
);

/**
 * Response interceptor - handles common error scenarios
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle different error types
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;
      
      switch (status) {
        case 401:
          // Unauthorized - token expired or invalid
          localStorage.removeItem('token');
          localStorage.removeItem('driveclique_user');
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
          break;
        case 403:
          // Forbidden - insufficient permissions
          console.warn('[API] Forbidden access:', data?.message);
          break;
        case 404:
          // Not found
          console.warn('[API] Resource not found:', error.config?.url);
          break;
        case 500:
          // Server error
          console.error('[API] Server error:', data?.message || 'Internal server error');
          break;
        default:
          console.error('[API] Request failed:', data?.message || error.message);
      }
    } else if (error.request) {
      // Request made but no response received
      console.error('[API] No response received:', error.request);
      error.message = 'Unable to connect to server. Please check your connection.';
    } else {
      // Error setting up request
      console.error('[API] Request setup error:', error.message);
    }

    return Promise.reject(error);
  }
);

/**
 * Extract error message from API response
 * @param {Error} error - Axios error object
 * @returns {string} User-friendly error message
 */
export const getErrorMessage = (error) => {
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  if (error.message) {
    return error.message;
  }
  return 'An unexpected error occurred';
};

/**
 * Auth API calls
 */
export const authAPI = {
  register: (userData) => api.post('/auth/register', userData),
  login: (credentials) => api.post('/auth/login', credentials),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (profileData) => api.put('/auth/profile', profileData),
  searchUsers: (query) => api.get('/auth/users/search', { params: { query } }),
};

/**
 * Clubs API calls
 */
export const clubsAPI = {
  getAll: () => api.get('/clubs'),
  getClubById: (clubId) => api.get(`/clubs/${clubId}`),
  getClubByInviteCode: (inviteCode) => api.get(`/clubs/invite/${inviteCode}`),
  create: (clubData) => api.post('/clubs', clubData),
  update: (clubId, clubData) => api.put(`/clubs/${clubId}`, clubData),
  search: (params) => api.get('/clubs/browse', { params }),
  requestToJoin: (clubId) => api.post(`/clubs/${clubId}/join`),
  handleJoinRequest: (clubId, requestId, status) => 
    api.post(`/clubs/${clubId}/handle-request`, { requestId, status }),
  togglePrivacy: (clubId, isPrivate) => 
    api.post(`/clubs/${clubId}/toggle-privacy`, { isPrivate }),
  joinByInviteCode: (inviteCode) => api.post(`/clubs/join-by-code/${inviteCode}`),
  delete: (clubId, deletionReason, leaderEmail) => 
    api.delete(`/clubs/${clubId}`, { data: { deletionReason, leaderEmail } }),
  getTopClub: () => api.get('/clubs/trending'),
  leave: (clubId) => api.put(`/clubs/${clubId}/leave`),
};

/**
 * Drives API calls
 */
export const drivesAPI = {
  getClubDrives: (clubId) => api.get(`/drives/club/${clubId}`),
  create: (driveData) => api.post('/drives', driveData),
  rsvp: (driveId, status) => api.post(`/drives/${driveId}/rsvp`, { status }),
  cancel: (driveId, cancellationReason) => 
    api.post(`/drives/${driveId}/cancel`, { cancellationReason }),
  getAttendees: (driveId) => api.get(`/drives/${driveId}/attendees`),
  getLeaderDashboard: () => api.get('/drives/dashboard'),
};

/**
 * Export the raw axios instance for custom requests
 */
export { api };
export default {
  auth: authAPI,
  clubs: clubsAPI,
  drives: drivesAPI,
  raw: api,
};