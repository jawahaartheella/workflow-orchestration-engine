import axios from 'axios';

// Base API configuration from environment or default to local backend
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach authenticated API key
apiClient.interceptors.request.use(
  (config) => {
    let apiKey = localStorage.getItem('wf_api_key');
    if (!apiKey) {
      // Default to Acme Technologies demo API key for instant out-of-the-box readiness
      apiKey = 'acme_live_secret_key_demo_98765';
      localStorage.setItem('wf_api_key', apiKey);
    }

    config.headers['x-api-key'] = apiKey;
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor with graceful error extraction
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const customError = {
      message: error.response?.data?.message || error.message || 'An unexpected API error occurred',
      status: error.response?.status || 500,
      details: error.response?.data?.details || null,
      isOffline: !error.response,
    };
    return Promise.reject(customError);
  }
);

export default apiClient;
