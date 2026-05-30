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
 * Response interceptor - auto-refresh access token on 401, then retry once
 */
let _isRefreshing = false;
let _refreshSubscribers = [];

// Pages that are intentionally unauthenticated — never redirect away from these
const _isPublicPath = () =>
  ['/login', '/register', '/forgot-password', '/reset-password'].includes(
    window.location.pathname
  );

const onRefreshed = (newToken) => {
  _refreshSubscribers.forEach(cb => cb(newToken));
  _refreshSubscribers = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      const refreshToken = localStorage.getItem('refreshToken');

      if (refreshToken) {
        if (_isRefreshing) {
          // Queue requests that arrive while a refresh is in-flight
          return new Promise((resolve) => {
            _refreshSubscribers.push((token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            });
          });
        }

        originalRequest._retry = true;
        _isRefreshing = true;

        try {
          const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
          const newToken = data.token;
          localStorage.setItem('token', newToken);
          api.defaults.headers.common.Authorization = `Bearer ${newToken}`;
          onRefreshed(newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        } catch {
          // Refresh failed — clear session and redirect to login
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('driveclique_user');
          if (!_isPublicPath()) window.location.href = '/login';
          return Promise.reject(error);
        } finally {
          _isRefreshing = false;
        }
      }

      // No refresh token — clear session
      localStorage.removeItem('token');
      localStorage.removeItem('driveclique_user');
      if (!_isPublicPath()) window.location.href = '/login';
    }

    if (error.response?.status === 403) {
      console.warn('[API] Forbidden access:', error.response.data?.message);
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
  logout: async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('driveclique_user');
    if (refreshToken) {
      try { await api.post('/auth/logout', { refreshToken }); } catch { /* best-effort */ }
    }
  },
  refresh: (refreshToken) => api.post('/auth/refresh', { refreshToken }),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (profileData) => api.put('/auth/profile', profileData),
  searchUsers: (query) => api.get('/auth/users/search', { params: { query } }),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.post('/auth/reset-password', { token, password }),
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
  searchPage: (query, page, limit = 20) => api.get('/clubs/browse', { params: { query, page, limit } }),
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
  removeMember: (clubId, memberId) => api.delete(`/clubs/${clubId}/members/${memberId}`),
  transfer: (clubId, newLeaderId) => api.put(`/clubs/${clubId}/transfer`, { newLeaderId }),
};

/**
 * Drives API calls
 */
export const drivesAPI = {
  getClubDrives: (clubId) => api.get(`/drives/club/${clubId}`),
  create: (driveData) => api.post('/drives', driveData),
  update: (driveId, data) => api.put(`/drives/${driveId}`, data),
  delete: (driveId) => api.delete(`/drives/${driveId}`),
  rsvp: (driveId, status) => api.post(`/drives/${driveId}/rsvp`, { status }),
  cancel: (driveId, cancellationReason) =>
    api.post(`/drives/${driveId}/cancel`, { cancellationReason }),
  getRSVPStatus: (driveId) => api.get(`/drives/${driveId}/rsvp-status`),
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