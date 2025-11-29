/**
 * Analytics Service
 * Handles all analytics and dashboard data API calls
 */

import { apiClient, handleApiResponse, ApiResponse } from './api.config';

// Host Statistics Interface
export interface HostStats {
  total_properties: number;
  total_bookings: number;
  total_revenue: number;
  monthly_revenue: number;
  avg_rating: number;
  total_reviews: number;
}

// Activity Item Interface
export interface ActivityItem {
  id: string;
  type: 'booking' | 'review' | 'message' | 'payment';
  title: string;
  description: string;
  timestamp: string;
  status?: string;
  amount?: number;
  rating?: number;
}

// Financial Data Interface
export interface FinancialData {
  period: string;
  revenue: number;
  expenses: number;
  net_profit: number;
  bookings_count: number;
}

// Admin Statistics Interface
export interface AdminStats {
  total_users: number;
  total_properties: number;
  total_bookings: number;
  total_revenue: number;
  pending_properties: number;
  user_growth_rate: number;
  new_users_this_month: number;
  new_users_last_month: number;
}

// User Management Interface (for admin)
export interface AdminUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role: string;
  status: string;
  email_verified: boolean;
  is_host: boolean;
  host_approved: boolean;
  created_at: string;
  updated_at: string;
}

export interface UsersResponse {
  users: AdminUser[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export const analyticsService = {
  // Host Dashboard APIs
  async getHostStats(): Promise<HostStats> {
    const response = await apiClient.get('/analytics/host/stats');
    return handleApiResponse<HostStats>(response);
  },

  async getHostActivity(limit: number = 10): Promise<ActivityItem[]> {
    const response = await apiClient.get(`/analytics/host/activity?limit=${limit}`);
    return handleApiResponse<ActivityItem[]>(response);
  },

  async getHostFinancials(period: 'weekly' | 'monthly' | 'yearly' = 'monthly'): Promise<FinancialData[]> {
    const response = await apiClient.get(`/analytics/host/financials?period=${period}`);
    return handleApiResponse<FinancialData[]>(response);
  },

  // Admin Dashboard APIs
  async getAdminStats(): Promise<AdminStats> {
    const response = await apiClient.get('/analytics/admin/stats');
    return handleApiResponse<AdminStats>(response);
  },

  async getAllUsers(params: {
    page?: number;
    limit?: number;
    search?: string;
  } = {}): Promise<UsersResponse> {
    const queryParams = new URLSearchParams();
    
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.search) queryParams.append('search', params.search);

    const url = `/analytics/admin/users${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await apiClient.get(url);
    return handleApiResponse<UsersResponse>(response);
  },

  async updateUserStatus(userId: number, status: 'active' | 'inactive' | 'suspended'): Promise<void> {
    const response = await apiClient.put(`/analytics/admin/users/${userId}/status`, { status });
    return handleApiResponse<void>(response);
  },

  async approveHost(userId: number, admin_notes?: string): Promise<void> {
    const response = await apiClient.put(`/analytics/admin/users/${userId}/approve-host`, { admin_notes });
    return handleApiResponse<void>(response);
  },
};

// Export types for use in components
export type {
  HostStats as HostStatsType,
  ActivityItem as ActivityItemType,
  FinancialData as FinancialDataType,
  AdminStats as AdminStatsType,
  AdminUser as AdminUserType,
  UsersResponse as UsersResponseType,
};