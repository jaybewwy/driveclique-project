import axios from "axios";
import { tokenStorage, clearSession } from "./storage";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://10.0.2.2:5000/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 10000,
});

// Set once from the root layout so the interceptor can navigate away on session expiry
// without importing expo-router directly into this module (avoids navigation-before-mount issues).
let _onSessionExpired = null;
export const setSessionExpiredHandler = (handler) => {
  _onSessionExpired = handler;
};

api.interceptors.request.use(
  async (config) => {
    const token = await tokenStorage.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let _isRefreshing = false;
let _refreshSubscribers = [];

const onRefreshed = (newToken) => {
  _refreshSubscribers.forEach((cb) => cb(newToken));
  _refreshSubscribers = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      const refreshToken = await tokenStorage.getRefreshToken();

      if (refreshToken) {
        if (_isRefreshing) {
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
          await tokenStorage.setToken(newToken);
          api.defaults.headers.common.Authorization = `Bearer ${newToken}`;
          onRefreshed(newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        } catch {
          await clearSession();
          if (_onSessionExpired) _onSessionExpired();
          return Promise.reject(error);
        } finally {
          _isRefreshing = false;
        }
      }

      const hadToken = Boolean(await tokenStorage.getToken());
      await clearSession();
      if (hadToken && _onSessionExpired) _onSessionExpired();
    }

    if (error.response?.status === 403) {
      console.warn("[API] Forbidden access:", error.response.data?.message);
    }

    return Promise.reject(error);
  }
);

export const getErrorMessage = (error) => {
  if (error.response?.data?.message) return error.response.data.message;
  if (error.message) return error.message;
  return "An unexpected error occurred";
};

export const authAPI = {
  register: (userData) => api.post("/auth/register", userData),
  login: (username, password) => api.post("/auth/login", { username, password }),
  logout: async () => {
    const refreshToken = await tokenStorage.getRefreshToken();
    await clearSession();
    if (refreshToken) {
      try {
        await api.post("/auth/logout", { refreshToken });
      } catch {
        /* best-effort */
      }
    }
  },
  refresh: (refreshToken) => api.post("/auth/refresh", { refreshToken }),
  getProfile: () => api.get("/auth/profile"),
  updateProfile: (profileData) => api.put("/auth/profile", profileData),
  searchUsers: (query) => api.get("/auth/users/search", { params: { query } }),
  forgotPassword: (email) => api.post("/auth/forgot-password", { email }),
  resetPassword: (token, password) => api.post("/auth/reset-password", { token, password }),
  verifyEmail: (token) => api.get("/auth/verify-email", { params: { token } }),
  resendVerification: () => api.post("/auth/resend-verification"),
  deleteAccount: (password) => api.delete("/auth/account", { data: { password } }),
  changeUsername: (username) => api.put("/auth/username", { username }),
  changePassword: (currentPassword, newPassword) =>
    api.put("/auth/password", { currentPassword, newPassword }),
  registerPushToken: (expoPushToken) => api.post("/auth/push-token", { expoPushToken }),
};

export const clubsAPI = {
  getAll: () => api.get("/clubs"),
  getClubById: (clubId) => api.get(`/clubs/${clubId}`),
  getClubByInviteCode: (inviteCode) => api.get(`/clubs/invite/${inviteCode}`),
  create: (clubData) => api.post("/clubs", clubData),
  update: (clubId, clubData) => api.put(`/clubs/${clubId}`, clubData),
  search: (params) => api.get("/clubs/browse", { params }),
  searchPage: (query, page, limit = 20) =>
    api.get("/clubs/browse", { params: { query, page, limit } }),
  requestToJoin: (clubId) => api.post(`/clubs/${clubId}/join`),
  handleJoinRequest: (clubId, requestId, status) =>
    api.post(`/clubs/${clubId}/handle-request`, { requestId, status }),
  togglePrivacy: (clubId, isPrivate) => api.post(`/clubs/${clubId}/toggle-privacy`, { isPrivate }),
  joinByInviteCode: (inviteCode) => api.post(`/clubs/join-by-code/${inviteCode}`),
  delete: (clubId, deletionReason, leaderEmail) =>
    api.delete(`/clubs/${clubId}`, { data: { deletionReason, leaderEmail } }),
  getTopClub: () => api.get("/clubs/trending"),
  leave: (clubId) => api.put(`/clubs/${clubId}/leave`),
  removeMember: (clubId, memberId) => api.delete(`/clubs/${clubId}/members/${memberId}`),
  transfer: (clubId, newLeaderId) => api.put(`/clubs/${clubId}/transfer`, { newLeaderId }),
  postAnnouncement: (clubId, data) => api.post(`/clubs/${clubId}/announcements`, data),
  deleteAnnouncement: (clubId, announcementId) =>
    api.delete(`/clubs/${clubId}/announcements/${announcementId}`),
};

export const drivesAPI = {
  getClubDrives: (clubId) => api.get(`/drives/club/${clubId}`),
  create: (driveData) => api.post("/drives", driveData),
  update: (driveId, data) => api.put(`/drives/${driveId}`, data),
  delete: (driveId) => api.delete(`/drives/${driveId}`),
  rsvp: (driveId, status) => api.post(`/drives/${driveId}/rsvp`, { status }),
  cancel: (driveId, cancellationReason) =>
    api.post(`/drives/${driveId}/cancel`, { cancellationReason }),
  getRSVPStatus: (driveId) => api.get(`/drives/${driveId}/rsvp-status`),
  getAttendees: (driveId) => api.get(`/drives/${driveId}/attendees`),
  getLeaderDashboard: () => api.get("/drives/dashboard"),
  getAnalytics: () => api.get("/drives/analytics"),
  getMyRSVPs: () => api.get("/drives/my-rsvps"),
  requestCheckin: (driveId) => api.post(`/drives/${driveId}/request-checkin`),
  getCheckinStatus: (driveId) => api.get(`/drives/${driveId}/checkin-status`),
  submitCheckin: (driveId, present) => api.post(`/drives/${driveId}/checkin`, { present }),
};

export const reportsAPI = {
  submit: ({ targetType, targetId, reason, details }) =>
    api.post("/reports", { targetType, targetId, reason, details }),
};

export { api };
export default {
  auth: authAPI,
  clubs: clubsAPI,
  drives: drivesAPI,
  reports: reportsAPI,
  raw: api,
};
