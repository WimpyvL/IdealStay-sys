/**
 * Bookings Service
 * Handles booking-related API calls including creation, management, and payment processing
 */

import { apiClient, handleApiResponse, createApiError, ApiResponse } from './api.config';
import type { Booking, Transaction, PaymentStatus } from '../../types';
import { AxiosError } from 'axios';

// Booking request types
export interface CreateBookingRequest {
  property_id: number;
  check_in_date: string; // YYYY-MM-DD format
  check_out_date: string; // YYYY-MM-DD format
  guests_count: number;
  special_requests?: string;
  payment_method?: string;
}

export interface BookingSearchParams {
  status?: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  property_id?: number;
  guest_id?: number;
  host_id?: number;
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
}

export interface BookingSearchResponse {
  bookings: Booking[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

// Booking update types
export interface UpdateBookingStatusRequest {
  booking_id: number;
  status: 'confirmed' | 'cancelled' | 'completed';
  reason?: string;
}

export interface UpdatePaymentDetailsRequest {
  payment_status?: PaymentStatus;
  payment_method?: string;
  payment_reference?: string;
  payment_notes?: string;
}

export interface UpdatePaymentDetailsResponse {
  booking: Booking;
  payment_updated: boolean;
  auto_confirmed: boolean;
  status_changed?: boolean;
}

// Pricing calculation types
export interface PricingRequest {
  property_id: number;
  check_in_date: string;
  check_out_date: string;
  guests: number;
}

export interface PricingResponse {
  base_price: number;
  cleaning_fee: number;
  security_deposit: number;
  service_fee: number;
  total_amount: number;
}

class BookingsService {
  /**
   * Create a new booking
   */
  async createBooking(bookingData: CreateBookingRequest): Promise<{ booking: Booking; next_steps: string }> {
    try {
      const response = await apiClient.post<ApiResponse<{ booking: Booking; next_steps: string }>>('/bookings', bookingData);
      return handleApiResponse(response);
    } catch (error) {
      throw createApiError(error as AxiosError);
    }
  }

  /**
   * Get booking by ID
   */
  async getBookingById(id: number): Promise<Booking> {
    try {
      const response = await apiClient.get<ApiResponse<Booking>>(`/bookings/${id}`);
      return handleApiResponse(response);
    } catch (error) {
      throw createApiError(error as AxiosError);
    }
  }

  /**
   * Unified get bookings - backend /bookings endpoint auto-determines role from token.
   * Optional role hint can be passed (guest|host) to assist future backend filtering.
   */
  async getBookings(params: BookingSearchParams = {}, role?: 'guest' | 'host'): Promise<BookingSearchResponse> {
    try {
      const finalParams = { ...params, ...(role ? { role } : {}) };
      const response = await apiClient.get<ApiResponse<BookingSearchResponse>>('/bookings', { params: finalParams });
      return handleApiResponse(response);
    } catch (error) {
      throw createApiError(error as AxiosError);
    }
  }

  /**
   * Update booking status
   */
  async updateBookingStatus(request: UpdateBookingStatusRequest): Promise<Booking> {
    try {
      const { booking_id, ...updateData } = request;
      const response = await apiClient.put<ApiResponse<Booking>>(`/bookings/${booking_id}/status`, updateData);
      return handleApiResponse(response);
    } catch (error) {
      throw createApiError(error as AxiosError);
    }
  }

  /**
   * Cancel a booking
   */
  async cancelBooking(bookingId: number, reason?: string): Promise<Booking> {
    try {
      const response = await apiClient.put<ApiResponse<Booking>>(`/bookings/${bookingId}/cancel`, { reason });
      return handleApiResponse(response);
    } catch (error) {
      throw createApiError(error as AxiosError);
    }
  }

  /**
   * Confirm a booking (host action)
   */
  async confirmBooking(bookingId: number): Promise<Booking> {
    try {
      const response = await apiClient.put<ApiResponse<Booking>>(`/bookings/${bookingId}/confirm`);
      return handleApiResponse(response);
    } catch (error) {
      throw createApiError(error as AxiosError);
    }
  }

  /**
   * Calculate pricing for a booking
   */
  async calculatePricing(request: PricingRequest): Promise<PricingResponse> {
    try {
      const response = await apiClient.post<ApiResponse<PricingResponse>>('/bookings/pricing', request);
      return handleApiResponse(response);
    } catch (error) {
      throw createApiError(error as AxiosError);
    }
  }

  /**
   * Process payment for a booking
   */
  async processPayment(bookingId: number, paymentData: any): Promise<Transaction> {
    try {
      const response = await apiClient.post<ApiResponse<Transaction>>(`/bookings/${bookingId}/payment`, paymentData);
      return handleApiResponse(response);
    } catch (error) {
      throw createApiError(error as AxiosError);
    }
  }

  /**
   * Update payment details for a booking (status, method, reference, notes)
   */
  async updatePaymentDetails(
    bookingId: number,
    paymentData: UpdatePaymentDetailsRequest
  ): Promise<UpdatePaymentDetailsResponse> {
    try {
      const response = await apiClient.put<ApiResponse<UpdatePaymentDetailsResponse>>(
        `/bookings/${bookingId}/payment`,
        paymentData
      );
      return handleApiResponse(response);
    } catch (error) {
      throw createApiError(error as AxiosError);
    }
  }

  /**
   * Get payment details for a booking
   */
  async getBookingPayments(bookingId: number): Promise<Transaction[]> {
    try {
      const response = await apiClient.get<ApiResponse<Transaction[]>>(`/bookings/${bookingId}/payments`);
      return handleApiResponse(response);
    } catch (error) {
      throw createApiError(error as AxiosError);
    }
  }

  /**
   * Check booking availability before creating
   */
  async checkAvailability(propertyId: number, checkIn: string, checkOut: string): Promise<{ available: boolean; conflicts?: any[] }> {
    try {
      const response = await apiClient.get<ApiResponse<{ available: boolean; conflicts?: any[] }>>('/bookings/availability', {
        params: {
          property_id: propertyId,
          check_in_date: checkIn,
          check_out_date: checkOut
        }
      });
      return handleApiResponse(response);
    } catch (error) {
      throw createApiError(error as AxiosError);
    }
  }

  /**
   * Get booking statistics for host dashboard
   */
  async getBookingStats(hostId?: number): Promise<{
    total_bookings: number;
    total_revenue: number;
    pending_bookings: number;
    upcoming_bookings: number;
    current_month_revenue: number;
    occupancy_rate: number;
  }> {
    try {
      const response = await apiClient.get<ApiResponse<any>>('/bookings/stats', {
        params: hostId ? { host_id: hostId } : {}
      });
      return handleApiResponse(response);
    } catch (error) {
      throw createApiError(error as AxiosError);
    }
  }

  /**
   * Search all bookings (admin function)
   */
  async searchAllBookings(params: BookingSearchParams = {}): Promise<BookingSearchResponse> {
    try {
      const response = await apiClient.get<ApiResponse<BookingSearchResponse>>('/bookings/search', {
        params
      });
      return handleApiResponse(response);
    } catch (error) {
      throw createApiError(error as AxiosError);
    }
  }

  /**
   * Get upcoming bookings for a property (host function)
   */
  async getPropertyBookings(propertyId: number, startDate?: string, endDate?: string): Promise<Booking[]> {
    try {
      const params: any = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const response = await apiClient.get<ApiResponse<Booking[]>>(`/bookings/property/${propertyId}`, {
        params
      });
      return handleApiResponse(response);
    } catch (error) {
      throw createApiError(error as AxiosError);
    }
  }

  /**
   * Public booked date ranges (confirmed + pending) for calendar disabling
   */
  async getPropertyBookedDates(propertyId: number, startDate?: string, endDate?: string): Promise<{
    property_id: number;
    start_date: string;
    end_date: string;
    bookings: { id: number; check_in_date: string; check_out_date: string; status: string }[];
  }> {
    try {
      const params: any = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      const response = await apiClient.get<ApiResponse<any>>(`/bookings/properties/${propertyId}/booked-dates`, { params });
      return handleApiResponse(response);
    } catch (error) {
      throw createApiError(error as AxiosError);
    }
  }

  /**
   * Add guest review after booking completion
   */
  async addBookingReview(bookingId: number, reviewData: {
    rating: number;
    comment?: string;
    cleanliness_rating?: number;
    accuracy_rating?: number;
    communication_rating?: number;
    location_rating?: number;
    value_rating?: number;
  }): Promise<{ message: string }> {
    try {
      const response = await apiClient.post<ApiResponse<{ message: string }>>(`/bookings/${bookingId}/review`, reviewData);
      return handleApiResponse(response);
    } catch (error) {
      throw createApiError(error as AxiosError);
    }
  }
}

// Export singleton instance
export const bookingsService = new BookingsService();
export default bookingsService;