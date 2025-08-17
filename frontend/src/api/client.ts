import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add multipart/form-data header for file uploads
export const uploadClient = axios.create({
  baseURL: API_URL,
  // Don't set Content-Type for FormData - axios will set it automatically with boundary
});

// Add response interceptor for better error handling
uploadClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('Upload client error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers,
      }
    });
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API client error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      url: error.config?.url,
    });
    return Promise.reject(error);
  }
);