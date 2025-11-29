/**
 * Admin Service
 * Enhanced admin operations for managing properties, bookings, reviews, etc.
 */

import { apiClient, handleApiResponse, ApiResponse } from './api.config';

// ============================================================
// TYPES
// ============================================================

export interface PropertyStatusHistory {
  id: number;
  property_id: number;
  old_status: string;
  new_status: string;
  changed_by_user_id: number;
  notes: string;
  created_at: string;
  first_name: string;
  last_name: string;
  email: string;
}

export interface AdminProperty {
  id: number;
  title: string;
  status: string;
  host_first_name: string;
  host_last_name: string;
  host_email: string;
  city: string;
  price_per_night: number;
  created_at: string;
  primary_image: string;
}

export interface AdminBooking {
  id: number;
  property_title: string;
  property_city: string;
  guest_first_name: string;
  guest_last_name: string;
  guest_email: string;
  host_first_name: string;
  host_last_name: string;
  check_in_date: string;
  check_out_date: string;
  total_amount: number;
  status: string;
  payment_status: string;
  created_at: string;
}

export interface AdminReview {
  id: number;
  property_title: string;
  reviewer_first_name: string;
  reviewer_last_name: string;
  reviewee_first_name: string;
  reviewee_last_name: string;
  rating: number;
  comment: string;
  is_flagged: boolean;
  flag_reason: string;
  admin_action: string;
  created_at: string;
}

export interface Transaction {
  id: number;
  booking_id: number;
  user_id: number;
  transaction_type: string;
  amount: number;
  currency: string;
  status: string;
  description: string;
  created_at: string;
  first_name: string;
  last_name: string;
  email: string;
  property_title: string;
}

export interface Payout {
  id: number;
  host_id: number;
  amount: number;
  currency: string;
  status: string;
  period_start: string;
  period_end: string;
  created_at: string;
  processed_at: string;
  first_name: string;
  last_name: string;
  email: string;
}

export interface RevenueAnalytics {
  revenue_over_time: Array<{
    period: string;
    bookings_count: number;
    total_revenue: number;
    base_revenue: number;
    cleaning_fees: number;
    taxes_collected: number;
    cancelled_revenue: number;
  }>;
  revenue_by_property_type: Array<{
    property_type: string;
    bookings_count: number;
    revenue: number;
  }>;
  revenue_by_location: Array<{
    city: string;
    country: string;
    bookings_count: number;
    revenue: number;
  }>;
  overall_stats: {
    total_bookings: number;
    total_revenue: number;
    avg_booking_value: number;
  };
}

export interface AdminLog {
  id: number;
  admin_user_id: number;
  action: string;
  target_type: string;
  target_id: number;
  description: string;
  changes: any;
  created_at: string;
  first_name: string;
  last_name: string;
  email: string;
}

export interface PlatformSettings {
  [key: string]: {
    value: any;
    type: string;
    description: string;
    updated_at: string;
  };
}

// ============================================================
// ADMIN SERVICE
// ============================================================

export const adminService = {
  // ============================================================
  // PROPERTY MANAGEMENT
  // ============================================================

  async getProperties(params: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: string;
  } = {}): Promise<{ properties: AdminProperty[]; pagination: any }> {
    const response = await apiClient.get('/admin/properties', { params });
    return handleApiResponse(response);
  },

  async getPropertyHistory(propertyId: number): Promise<PropertyStatusHistory[]> {
    const response = await apiClient.get(`/admin/properties/${propertyId}/history`);
    return handleApiResponse(response);
  },

  async approveProperty(propertyId: number, admin_notes?: string): Promise<void> {
    const response = await apiClient.put(`/admin/properties/${propertyId}/approve`, { admin_notes });
    return handleApiResponse(response);
  },

  async rejectProperty(propertyId: number, rejection_reason: string): Promise<void> {
    const response = await apiClient.put(`/admin/properties/${propertyId}/reject`, { rejection_reason });
    return handleApiResponse(response);
  },

  // ============================================================
  // BOOKING MANAGEMENT
  // ============================================================

  async getBookings(params: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: string;
  } = {}): Promise<{ bookings: AdminBooking[]; pagination: any }> {
    const response = await apiClient.get('/admin/bookings', { params });
    return handleApiResponse(response);
  },

  async cancelBooking(bookingId: number, cancellation_reason: string, admin_notes?: string): Promise<void> {
    const response = await apiClient.put(`/admin/bookings/${bookingId}/cancel`, {
      cancellation_reason,
      admin_notes
    });
    return handleApiResponse(response);
  },

  async processRefund(bookingId: number, refund_amount: number, notes?: string): Promise<void> {
    const response = await apiClient.post(`/admin/bookings/${bookingId}/refund`, {
      refund_amount,
      notes
    });
    return handleApiResponse(response);
  },

  // ============================================================
  // FINANCIAL MANAGEMENT
  // ============================================================

  async getRevenueAnalytics(params: {
    period?: 'daily' | 'weekly' | 'monthly' | 'yearly';
    start_date?: string;
    end_date?: string;
  } = {}): Promise<RevenueAnalytics> {
    const response = await apiClient.get('/admin/analytics/revenue', { params });
    return handleApiResponse(response);
  },

  async getTransactions(params: {
    transaction_type?: string;
    status?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{ transactions: Transaction[]; pagination: any }> {
    const response = await apiClient.get('/admin/transactions', { params });
    return handleApiResponse(response);
  },

  async getPayouts(params: {
    status?: string;
    host_id?: number;
    page?: number;
    limit?: number;
  } = {}): Promise<{ payouts: Payout[]; pagination: any }> {
    const response = await apiClient.get('/admin/payouts', { params });
    return handleApiResponse(response);
  },

  async createPayout(host_id: number, period_start: string, period_end: string): Promise<any> {
    const response = await apiClient.post('/admin/payouts', {
      host_id,
      period_start,
      period_end
    });
    return handleApiResponse(response);
  },

  async processPayout(payoutId: number, data: {
    payout_method: string;
    payout_reference?: string;
    admin_notes?: string;
  }): Promise<void> {
    const response = await apiClient.post(`/admin/payouts/${payoutId}/process`, data);
    return handleApiResponse(response);
  },

  // ============================================================
  // REVIEW MODERATION
  // ============================================================

  async getReviews(params: {
    flagged?: boolean;
    admin_action?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{ reviews: AdminReview[]; pagination: any }> {
    const response = await apiClient.get('/admin/reviews', { params });
    return handleApiResponse(response);
  },

  async moderateReview(reviewId: number, admin_action: string, notes?: string): Promise<void> {
    const response = await apiClient.put(`/admin/reviews/${reviewId}/moderate`, {
      admin_action,
      notes
    });
    return handleApiResponse(response);
  },

  async deleteReview(reviewId: number): Promise<void> {
    const response = await apiClient.delete(`/admin/reviews/${reviewId}`);
    return handleApiResponse(response);
  },

  // ============================================================
  // AMENITY MANAGEMENT
  // ============================================================

  async getAllAmenities(): Promise<any[]> {
    const response = await apiClient.get('/admin/amenities');
    return handleApiResponse(response);
  },

  async createAmenity(data: {
    name: string;
    icon?: string;
    category: string;
    description?: string;
    is_active?: boolean;
  }): Promise<any> {
    const response = await apiClient.post('/admin/amenities', data);
    return handleApiResponse(response);
  },

  async updateAmenity(amenityId: number, data: {
    name?: string;
    icon?: string;
    category?: string;
    description?: string;
    is_active?: boolean;
  }): Promise<void> {
    const response = await apiClient.put(`/admin/amenities/${amenityId}`, data);
    return handleApiResponse(response);
  },

  async deleteAmenity(amenityId: number, permanent: boolean = false): Promise<void> {
    const response = await apiClient.delete(`/admin/amenities/${amenityId}`, {
      params: { permanent }
    });
    return handleApiResponse(response);
  },

  // ============================================================
  // PLATFORM SETTINGS
  // ============================================================

  async getSettings(): Promise<PlatformSettings> {
    const response = await apiClient.get('/admin/settings');
    return handleApiResponse(response);
  },

  async updateSettings(settings: { [key: string]: any }): Promise<void> {
    const response = await apiClient.put('/admin/settings', settings);
    return handleApiResponse(response);
  },

  // ============================================================
  // ADMIN LOGS
  // ============================================================

  async getAdminLogs(params: {
    action?: string;
    admin_id?: number;
    page?: number;
    limit?: number;
  } = {}): Promise<{ logs: AdminLog[]; pagination: any }> {
    const response = await apiClient.get('/admin/logs', { params });
    return handleApiResponse(response);
  },
};

export default adminService;