/**
 * Authentication Service
 * Handles login, registration, logout, and token management
 */

import { apiClient, handleApiResponse, createApiError, ApiResponse } from './api.config';
import type { User } from '../../types';
import { AxiosError } from 'axios';

// Authentication request types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role?: 'guest' | 'host' | 'admin';
}

export interface ResetPasswordRequest {
  email: string;
  new_password?: string; // test-mode direct reset
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

// Authentication response types
export interface AuthResponse {
  user: User;
  token: string;
  expires_in: number;
}

export interface TokenValidationResponse {
  valid: boolean;
  user?: User;
}

class AuthService {
  /**
   * Login user with email and password
   */
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    try {
      const response = await apiClient.post<ApiResponse<AuthResponse>>('/auth/login', credentials);
      const authData = handleApiResponse(response);
      
      // Store token and user data
      localStorage.setItem('authToken', authData.token);
      localStorage.setItem('user', JSON.stringify(authData.user));
      
      return authData;
    } catch (error) {
      throw createApiError(error as AxiosError);
    }
  }

  /**
   * Register new user
   */
  async register(userData: RegisterRequest): Promise<AuthResponse> {
    try {
      const response = await apiClient.post<ApiResponse<AuthResponse>>('/auth/register', userData);
      const authData = handleApiResponse(response);
      
      // Store token and user data
      localStorage.setItem('authToken', authData.token);
      localStorage.setItem('user', JSON.stringify(authData.user));
      
      return authData;
    } catch (error) {
      throw createApiError(error as AxiosError);
    }
  }

  /**
   * Logout user and clear local storage
   */
  async logout(): Promise<void> {
    try {
      // Call logout endpoint to invalidate token on server
      await apiClient.post('/auth/logout');
    } catch (error) {
      console.warn('Logout endpoint failed:', error);
    } finally {
      // Always clear local storage
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
    }
  }

  /**
   * Reset password - send reset email
   */
  async resetPassword(request: ResetPasswordRequest): Promise<{ message: string }> {
    try {
      const response = await apiClient.post<ApiResponse<{ message: string }>>('/auth/reset-password', request);
      return handleApiResponse(response);
    } catch (error) {
      throw createApiError(error as AxiosError);
    }
  }

  /**
   * Change user password
   */
  async changePassword(request: ChangePasswordRequest): Promise<{ message: string }> {
    try {
      const response = await apiClient.post<ApiResponse<{ message: string }>>('/auth/change-password', request);
      return handleApiResponse(response);
    } catch (error) {
      throw createApiError(error as AxiosError);
    }
  }

  /**
   * Upgrade current authenticated user to host (auto-approved)
   */
  async becomeHost(): Promise<User> {
    try {
      const response = await apiClient.post<ApiResponse<User>>('/users/become-host');
      const updatedUser = handleApiResponse(response);
      // Persist updated user
      localStorage.setItem('user', JSON.stringify(updatedUser));
      return updatedUser;
    } catch (error) {
      throw createApiError(error as AxiosError);
    }
  }

  /**
   * Validate current token and get user data
   */
  async validateToken(): Promise<TokenValidationResponse> {
    try {
      const response = await apiClient.get<ApiResponse<User>>('/auth/validate');
      const user = handleApiResponse(response);
      return { valid: true, user };
    } catch (error) {
      // Token is invalid, clear local storage
      this.clearLocalAuth();
      return { valid: false };
    }
  }

  /**
   * Verify user email using token (client will call when user lands on verify page)
   */
  async verifyEmail(token: string): Promise<{ message: string }> {
    try {
      const response = await apiClient.get<ApiResponse<{ message: string }>>(`/auth/verify/${token}`);
      return handleApiResponse(response);
    } catch (error) {
      throw createApiError(error as AxiosError);
    }
  }

  /**
   * Resend verification email
   */
  async resendVerification(email: string): Promise<{ message: string }> {
    try {
      const response = await apiClient.post<ApiResponse<{ message: string }>>('/auth/resend-verification', { email });
      return handleApiResponse(response);
    } catch (error) {
      throw createApiError(error as AxiosError);
    }
  }

  /**
   * Refresh user data from server
   */
  async refreshUser(): Promise<User> {
    try {
      // Prefer full profile endpoint to ensure profile_image_url freshness
      const user = await this.fetchFullProfile();
      return user;
    } catch (error) {
      throw createApiError(error as AxiosError);
    }
  }

  /**
   * Fetch full user profile from server
   */
  async fetchFullProfile(): Promise<User> {
    try {
      const response = await apiClient.get<ApiResponse<User>>('/users/profile');
      const user = handleApiResponse(response);
      localStorage.setItem('user', JSON.stringify(user));
      return user;
    } catch (error) {
      throw createApiError(error as AxiosError);
    }
  }

  /**
   * Get current user from local storage
   */
  getCurrentUser(): User | null {
    try {
      const userData = localStorage.getItem('user');
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.warn('Failed to parse user data from localStorage:', error);
      return null;
    }
  }

  /**
   * Get current auth token
   */
  getToken(): string | null {
    return localStorage.getItem('authToken');
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    const token = this.getToken();
    const user = this.getCurrentUser();
    return !!(token && user);
  }

  /**
   * Clear local authentication data
   */
  private clearLocalAuth(): void {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  }

  /**
   * Update user profile
   */
  async updateProfile(userData: Partial<User>): Promise<User> {
    try {
      const response = await apiClient.put<ApiResponse<User>>('/auth/profile', userData);
      const updatedUser = handleApiResponse(response);
      
      // Update local storage
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      return updatedUser;
    } catch (error) {
      throw createApiError(error as AxiosError);
    }
  }

  /**
   * Upload profile image
   */
  async uploadProfileImage(imageFile: File): Promise<{ image_url: string }> {
    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      
      const response = await apiClient.post<ApiResponse<{ profile_image_url: string }>>('/users/profile/image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      const result = handleApiResponse(response);
      return { image_url: result.profile_image_url };
    } catch (error) {
      throw createApiError(error as AxiosError);
    }
  }
}

// Export singleton instance
export const authService = new AuthService();
export default authService;