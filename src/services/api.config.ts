/**
 * API Configuration for Ideal Stay V3
 * Handles base configuration, interceptors, and error handling for all API calls
 */

import axios, { AxiosInstance, AxiosError, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

// API Configuration Constants
const API_CONFIG = {
  DEVELOPMENT: 'http://localhost:3001/api/v1',
  TIMEOUT: 30000,
};

// Get base URL based on environment (Vite-friendly)
const getBaseURL = (): string => {
  // Prefer Vite env when available
  const viteEnv = (import.meta as any)?.env || {};
  const envBase = viteEnv.VITE_API_BASE_URL || viteEnv.VITE_API_BASE || '';
  if (envBase) return envBase;

  // Fallback to NODE_ENV heuristic
  if (process.env.NODE_ENV === 'development') {
    return API_CONFIG.DEVELOPMENT;
  }

  // Default production assumption: same origin with /api/v1
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    if (origin) return `${origin}/api/v1`;
  } catch {}
  return '/api/v1';
};

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ApiError {
  message: string;
  status: number;
  code?: string;
}

// Create axios instance with default config
export const apiClient: AxiosInstance = axios.create({
  baseURL: getBaseURL(),
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`);
    } else if (process.env.NODE_ENV === 'development') {
      // Helpful debug to trace missing token situations causing 401
      // Avoid spamming for static asset domains by only logging API baseURL matches
      if (config.baseURL && config.url?.startsWith('/')) {
        // eslint-disable-next-line no-console
        console.warn('[apiClient] No auth token present for request:', config.method?.toUpperCase(), config.url);
      }
    }
    if (process.env.NODE_ENV === 'development') {
      const hasAuth = !!config.headers.get('Authorization');
      // eslint-disable-next-line no-console
      console.debug('[apiClient] ->', config.method?.toUpperCase(), config.baseURL + config.url, 'auth:', hasAuth ? 'yes' : 'no');
    }
    return config;
  },
  (error: AxiosError) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error: AxiosError) => {
    // Handle common error scenarios
    if (error.response) {
      const { status, data } = error.response;
      
      switch (status) {
        case 401:
          // Unauthorized - instead of force-clearing auth and redirecting immediately,
          // emit a custom event so AuthContext can decide how to handle (token refresh, show modal, etc.)
          try {
            const authEvent = new CustomEvent('api:unauthorized', { detail: { url: error.config?.url } });
            window.dispatchEvent(authEvent);
          } catch (e) {
            console.warn('Failed to dispatch unauthorized event', e);
          }
          // Do NOT remove token automatically; let higher-level logic manage logout.
          break;
          
        case 403:
          // Forbidden
          console.error('Access forbidden:', data);
          break;
          
        case 404:
          // Not found
          console.error('Resource not found:', error.config?.url);
          break;
          
        case 422:
          // Validation error
          console.error('Validation error:', data);
          break;
          
        case 500:
          // Server error
          console.error('Server error:', data);
          break;
          
        default:
          console.error('API error:', status, data);
      }
    } else if (error.request) {
      // Network error
      console.error('Network error:', error.message);
    } else {
      // Other error
      console.error('Unexpected error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

// Helper function to handle API responses
export const handleApiResponse = <T>(response: AxiosResponse<ApiResponse<T>>): T => {
  if (response.data.success) {
    // If data exists, return it; otherwise return the entire response for void operations
    return response.data.data !== undefined ? response.data.data : response.data as any;
  }
  throw new Error(response.data.error || response.data.message || 'API request failed');
};

// Helper function to create API errors
export const createApiError = (error: AxiosError): ApiError => {
  const errorData = error.response?.data as any;
  const message = errorData?.error || errorData?.message || error.message || 'Unknown error occurred';
  const status = error.response?.status || 500;
  const code = errorData?.code;
  
  return { message, status, code };
};

// Export base URL for use in other services
export const BASE_URL = getBaseURL();
