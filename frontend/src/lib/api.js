import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and not already retried, try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh-token`, {
            refreshToken,
          });

          const { token, refreshToken: newRefreshToken } = response.data.data;
          localStorage.setItem('token', token);
          localStorage.setItem('refreshToken', newRefreshToken);

          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, logout user
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  logout: () => api.post('/auth/logout'),
  getCurrentUser: () => api.get('/auth/me'),
  changePassword: (passwords) => api.post('/auth/change-password', passwords),
};

// Campaign API
export const campaignAPI = {
  getAll: (params) => api.get('/campaigns', { params }),
  getById: (id) => api.get(`/campaigns/${id}`),
  create: (data) => api.post('/campaigns', data),
  update: (id, data) => api.put(`/campaigns/${id}`, data),
  delete: (id) => api.delete(`/campaigns/${id}`),
  start: (id) => api.post(`/campaigns/${id}/start`),
  pause: (id) => api.post(`/campaigns/${id}/pause`),
  resume: (id) => api.post(`/campaigns/${id}/resume`),
  getAnalytics: (id, params) => api.get(`/campaigns/${id}/analytics`, { params }),
  getRealtimeStats: (id) => api.get(`/campaigns/${id}/realtime`),
  getDashboard: () => api.get('/campaigns/dashboard'),
  // Daily plan simulation
  simulateDailyPlan: (id, day = 1) => api.get(`/campaigns/${id}/simulate?day=${day}`),
  // Campaign plan (actual plan, not simulation)
  getCampaignPlan: (id) => api.get(`/campaigns/${id}/plan`),
  // Today's plan (what's running today)
  getTodaysPlan: (id) => api.get(`/campaigns/${id}/today`),
  // Current execution plan (what's happening right now)
  getCurrentExecutionPlan: (id) => api.get(`/campaigns/${id}/execution`),
  // Test campaign status
  testCampaignStatus: (id) => api.get(`/campaigns/${id}/test-status`),
  // Regenerate campaign plan
  regenerateCampaignPlan: (id) => api.post(`/campaigns/${id}/regenerate-plan`),
  // Test email sending
  testEmailSending: (id, testEmail) => api.post(`/campaigns/${id}/test-email`, { testEmail }),
  // Get template fields
  getTemplateFields: (id) => api.get(`/campaigns/${id}/template-fields`),
  // Save template data
  saveTemplateData: (id, templateData) => api.post(`/campaigns/${id}/template-data`, { templateData }),
  // Sender email management
  addSenderEmail: (campaignId, data) => api.post(`/campaigns/${campaignId}/senders`, data),
  updateSenderEmail: (campaignId, senderEmailId, data) => api.put(`/campaigns/${campaignId}/senders/${senderEmailId}`, data),
  removeSenderEmail: (campaignId, senderEmailId) => api.delete(`/campaigns/${campaignId}/senders/${senderEmailId}`),
};

// Template API - Updated for SES templates
export const templateAPI = {
  getAll: (params) => api.get('/templates', { params }),
  getByName: (name) => api.get(`/templates/${name}`),
  create: (data) => api.post('/templates', data),
  update: (name, data) => api.put(`/templates/${name}`, data),
  delete: (name) => api.delete(`/templates/${name}`),
  getUsage: (name) => api.get(`/templates/${name}/usage`),
};

// Email API
export const emailAPI = {
  getList: (params) => api.get('/emails/list', { params }),
  getUnsubscribed: () => api.get('/emails/unsubscribed'),
  getStats: () => api.get('/emails/stats'),
  getVerifiedDomains: () => api.get('/emails/verified-domains'),
};

// Email List API
export const emailListAPI = {
  getAll: (params) => api.get('/email-lists', { params }),
  getById: (id) => api.get(`/email-lists/${id}`),
  getPreview: (id, params) => api.get(`/email-lists/${id}/preview`, { params }),
  upload: (formData) => {
    return axios.post(`${API_BASE_URL}/email-lists/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
  },
  update: (id, data) => api.put(`/email-lists/${id}`, data),
  delete: (id) => api.delete(`/email-lists/${id}`),
};

export default api;
