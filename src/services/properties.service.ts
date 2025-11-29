/**
 * Properties Service
 * Handles property-related API calls including search, CRUD operations, and management
 */

import { apiClient, handleApiResponse, createApiError, ApiResponse } from './api.config';
import type { Property, Amenity, PropertyImage, Review } from '../../types';
import { AxiosError } from 'axios';

// Property search and filter types
export interface PropertySearchParams {
  location?: string;
  lat?: number;
  lng?: number;
  radius?: number; // in km
  check_in_date?: string; // ISO date
  check_out_date?: string; // ISO date
  guests?: number;
  min_price?: number;
  max_price?: number;
  property_type?: string;
  amenities?: string[]; // amenity IDs
  sort_by?: 'price_asc' | 'price_desc' | 'rating_desc' | 'created_desc';
  page?: number;
  limit?: number;
}

export interface PropertySearchResponse {
  properties: Property[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

// Property creation/update types
export interface CreatePropertyRequest {
  title: string;
  description: string;
  property_type: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postal_code: string;
  latitude: number;
  longitude: number;
  bedrooms: number;
  bathrooms: number;
  beds: number;
  max_guests: number;
  price_per_night: number;
  cleaning_fee?: number;
  security_deposit?: number;
  min_nights?: number;
  max_nights?: number;
  check_in_time?: string;
  check_out_time?: string;
  advance_booking_days?: number;
  is_instant_book?: boolean;
  house_rules?: string;
  amenity_ids?: number[];
  status?: 'draft' | 'pending' | 'active' | 'inactive' | 'suspended';
}

export interface UpdatePropertyRequest extends Partial<CreatePropertyRequest> {
  id: number;
  status?: 'draft' | 'pending' | 'active' | 'inactive' | 'suspended';
}

class PropertiesService {
  // Temporary feature flag to disable fetching all properties to avoid 429 rate limit responses.
  // Set to false to re-enable the network call when backend rate limits are adjusted.
  private static readonly DISABLE_GET_ALL = false; // Re-enabled after removing backend rate limits

  /**
   * Search properties with filters
   */
  async searchProperties(params: PropertySearchParams = {}): Promise<PropertySearchResponse> {
    try {
      const response = await apiClient.get<ApiResponse<PropertySearchResponse>>('/properties/search', {
        params
      });
      return handleApiResponse(response);
    } catch (error) {
      throw createApiError(error as AxiosError);
    }
  }

  /**
   * Get all properties (for explore page)
   */
  async getAllProperties(): Promise<Property[]> {
    try {
      if (PropertiesService.DISABLE_GET_ALL) {
        // Intentionally skip network request to prevent hammering the /properties endpoint
        // which is currently returning HTTP 429 (Too Many Requests).
        console.warn('[propertiesService] getAllProperties disabled – returning empty list to avoid 429 rate limits.');
        return [];
      }
      // Backend endpoint may return either an array of properties OR
      // a paginated object shape like { properties: Property[], total, page, limit }
      // Normalize here so the rest of the app always receives Property[]
      const response = await apiClient.get<ApiResponse<any>>('/properties');
      const data = handleApiResponse(response);

      if (Array.isArray(data)) {
        return data;
      }
      if (data && Array.isArray(data.properties)) {
        return data.properties;
      }
      console.warn('Unexpected getAllProperties response shape - returning empty array', data);
      return [];
    } catch (error) {
      throw createApiError(error as AxiosError);
    }
  }

  /**
   * Get property by ID
   */
  async getPropertyById(id: string | number): Promise<Property> {
    try {
      const response = await apiClient.get<ApiResponse<Property>>(`/properties/${id}`);
      return handleApiResponse(response);
    } catch (error) {
      throw createApiError(error as AxiosError);
    }
  }

  /**
   * Get properties by host ID
   */
  async getPropertiesByHost(hostId: number): Promise<Property[]> {
    try {
      // Backend current implementation exposes authenticated host properties at /properties/host/my-properties
      // and returns shape: { properties: Property[], pagination: {...} }
      // Normalize to just Property[] for existing consumers.
      const response = await apiClient.get<ApiResponse<any>>('/properties/host/my-properties');
      const data = handleApiResponse(response);
      if (Array.isArray(data)) {
        return data as Property[];
      }
      if (data && Array.isArray(data.properties)) {
        return data.properties as Property[];
      }
      console.warn('Unexpected getPropertiesByHost response shape:', data);
      return [];
    } catch (error) {
      throw createApiError(error as AxiosError);
    }
  }

  /**
   * Create new property
   */
  async createProperty(propertyData: CreatePropertyRequest): Promise<Property> {
    try {
      const response = await apiClient.post<ApiResponse<Property>>('/properties', propertyData);
      return handleApiResponse(response);
    } catch (error) {
      throw createApiError(error as AxiosError);
    }
  }

  /**
   * Update existing property
   */
  async updateProperty(propertyData: UpdatePropertyRequest): Promise<Property> {
    try {
      const { id, ...updateData } = propertyData;
      const response = await apiClient.put<ApiResponse<Property>>(`/properties/${id}`, updateData);
      return handleApiResponse(response);
    } catch (error) {
      throw createApiError(error as AxiosError);
    }
  }

  /**
   * Delete property
   */
  async deleteProperty(id: number): Promise<{ message: string }> {
    try {
      const response = await apiClient.delete<ApiResponse<{ message: string }>>(`/properties/${id}`);
      return handleApiResponse(response);
    } catch (error) {
      throw createApiError(error as AxiosError);
    }
  }

  /**
   * Upload property images
   */
  async uploadPropertyImages(propertyId: number, images: File[]): Promise<PropertyImage[]> {
    try {
      const formData = new FormData();
      images.forEach((image) => {
        formData.append('images', image);
      });
      // Set the first image as primary if no images exist yet
      formData.append('isPrimary', 'true');

      const response = await apiClient.post<ApiResponse<any>>(`/properties/${propertyId}/images`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const result = handleApiResponse(response);
      // Backend returns { images: [...], uploaded_count: number, total_images: number }
      return result.images || result;
    } catch (error) {
      throw createApiError(error as AxiosError);
    }
  }

  /**
   * Delete property image
   */
  async deletePropertyImage(propertyId: number, imageId: number): Promise<{ message: string }> {
    try {
      const response = await apiClient.delete<ApiResponse<{ message: string }>>(`/properties/${propertyId}/images/${imageId}`);
      return handleApiResponse(response);
    } catch (error) {
      throw createApiError(error as AxiosError);
    }
  }

  /**
   * Get property reviews
   */
  async getPropertyReviews(propertyId: number): Promise<Review[]> {
    try {
      const response = await apiClient.get<ApiResponse<Review[]>>(`/properties/${propertyId}/reviews`);
      return handleApiResponse(response);
    } catch (error) {
      throw createApiError(error as AxiosError);
    }
  }

  /**
   * Get available amenities
   */
  async getAvailableAmenities(): Promise<Amenity[]> {
    try {
      const response = await apiClient.get<ApiResponse<Amenity[]>>('/amenities');
      return handleApiResponse(response);
    } catch (error) {
      throw createApiError(error as AxiosError);
    }
  }

  /**
   * Check property availability for date range
   */
  async checkAvailability(propertyId: number, checkIn: string, checkOut: string): Promise<{ available: boolean; conflicting_bookings?: any[] }> {
    try {
      // Backend route lives under /bookings/properties/:id/availability (see bookings routes)
      const response = await apiClient.get<ApiResponse<any>>(`/bookings/properties/${propertyId}/availability`, {
        params: { check_in_date: checkIn, check_out_date: checkOut }
      });
      // Response shape from backend: { available: boolean, ... } inside data or nested booking_details
      const data = handleApiResponse(response);
      if (data && typeof data.available === 'boolean') return data;
      if (data && data.booking_details) return { available: true, ...data }; // fallback
      return data;
    } catch (error) {
      // Gracefully handle known 400 unavailability response so UI can show unavailable state
      const err = error as AxiosError<any>;
      const status = err.response?.status;
      const message: string | undefined = err.response?.data?.message || err.message;
      if ((status === 400 || status === 409) && message && /not available for the selected dates/i.test(message)) {
        // Normalize possible conflict arrays
        const conflicts = err.response?.data?.conflicting_bookings || err.response?.data?.conflicts || err.response?.data?.conflictRows || [];
        return { available: false, conflicting_bookings: conflicts };
      }
      throw createApiError(err as AxiosError);
    }
  }

  /**
   * Get property calendar data (for host dashboard)
   */
  async getPropertyCalendar(propertyId: number, year?: number, month?: number): Promise<any> {
    try {
      const params = year && month ? { year, month } : {};
      const response = await apiClient.get<ApiResponse<any>>(`/properties/${propertyId}/calendar`, { params });
      return handleApiResponse(response);
    } catch (error) {
      throw createApiError(error as AxiosError);
    }
  }

  /**
   * Update property availability/pricing for specific dates
   */
  async updatePropertyCalendar(propertyId: number, calendarData: any): Promise<{ message: string }> {
    try {
      const response = await apiClient.put<ApiResponse<{ message: string }>>(`/properties/${propertyId}/calendar`, calendarData);
      return handleApiResponse(response);
    } catch (error) {
      throw createApiError(error as AxiosError);
    }
  }

  /**
   * Get featured properties for homepage
   */
  async getFeaturedProperties(limit: number = 8): Promise<Property[]> {
    try {
      const response = await apiClient.get<ApiResponse<Property[]>>('/properties/featured', {
        params: { limit }
      });
      return handleApiResponse(response);
    } catch (error) {
      throw createApiError(error as AxiosError);
    }
  }

  /**
   * Get nearby properties (for property detail page)
   */
  async getNearbyProperties(lat: number, lng: number, radius: number = 10, limit: number = 6): Promise<Property[]> {
    try {
      const response = await apiClient.get<ApiResponse<Property[]>>('/properties/nearby', {
        params: { lat, lng, radius, limit }
      });
      return handleApiResponse(response);
    } catch (error) {
      throw createApiError(error as AxiosError);
    }
  }
}

// Export singleton instance
export const propertiesService = new PropertiesService();
export default propertiesService;