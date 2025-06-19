import axios from 'axios';
import { toast } from 'react-hot-toast';

// Base API URLs - Updated to match actual backend ports and paths
const API_ENDPOINTS = {
  USER_MANAGEMENT: 'http://localhost:5000',      // API2 - User Management
  CODE_EDITOR: 'http://localhost:3003/api',      // API1 - Code Editor with /api prefix
  EDUCATIONAL_PLATFORM: 'http://localhost:8000'  // API3 - Educational Platform (Updated to correct port)
};

class ApiClient {
  private client: any;
  constructor(baseURL: string) {
    this.client = axios.create({
      baseURL,
      timeout: 120000, // Increased timeout to 2 minutes for Docker container creation
      headers: {
        'Content-Type': 'application/json',
      },
    });// Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config: any) => {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }        // Add custom headers for Code Editor API (API1)
        if (this.client.defaults.baseURL === API_ENDPOINTS.CODE_EDITOR) {
          config.headers['x-user-id'] = user.username || 'demo-user';
          config.headers['x-user-tier'] = user.tier || 'pro'; // Temporarily set to pro to test more languages
        }
        
        return config;
      },
      (error: any) => {
        return Promise.reject(error);
      }
    );    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response: any) => response,
      (error: any) => {
        // Only auto-redirect to login for 401s that are not from submission endpoints
        // This allows pages to handle auth errors gracefully for certain operations
        if (error.response?.status === 401) {
          const url = error.config?.url || '';
          const isSubmissionEndpoint = url.includes('/submit') || url.includes('/evaluate') || url.includes('/submissions');
          
          if (!isSubmissionEndpoint) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
          }
          // For submission endpoints, let the calling code handle the error
        }
        
        // Only show automatic toast for 500+ errors, let pages handle other errors
        if (error.response?.status >= 500) {
          const errorMessage = error.response?.data?.error || error.message || 'Server error occurred';
          toast.error(errorMessage);
        }
        
        return Promise.reject(error);
      }
    );
  }

  async get<T>(url: string, params?: any): Promise<T> {
    const response = await this.client.get(url, { params });
    return response.data;
  }

  async post<T>(url: string, data?: any): Promise<T> {
    const response = await this.client.post(url, data);
    return response.data;
  }

  async put<T>(url: string, data?: any): Promise<T> {
    const response = await this.client.put(url, data);
    return response.data;
  }

  async delete<T>(url: string): Promise<T> {
    const response = await this.client.delete(url);
    return response.data;
  }
}

// Create API clients for each service
export const userManagementApi = new ApiClient(API_ENDPOINTS.USER_MANAGEMENT);
export const codeEditorApi = new ApiClient(API_ENDPOINTS.CODE_EDITOR);
export const educationalPlatformApi = new ApiClient(API_ENDPOINTS.EDUCATIONAL_PLATFORM);

export { API_ENDPOINTS };
