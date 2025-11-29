import { apiClient, handleApiResponse, createApiError, ApiResponse } from './api.config';
import { AxiosError } from 'axios';

export interface AmenityRecord {
  id: number;
  name: string;
  category?: string;
  icon?: string;
  is_active?: boolean;
}

class AmenitiesService {
  /**
   * Try multiple endpoints because admin route requires admin auth.
   * Preference order: /admin/amenities (if accessible) -> /amenities
   */
  async getAllAmenities(): Promise<AmenityRecord[]> {
    // Try public endpoint first (most common case), then admin endpoint
    const candidates = ['/amenities', '/admin/amenities'];
    let lastError: any = null;
    for (const path of candidates) {
      try {
        const resp = await apiClient.get<ApiResponse<any>>(path);
        const data = handleApiResponse(resp);
        const list = Array.isArray(data) ? data : (data.data || data.amenities || []);
        return list.filter((a: any) => a && a.id !== undefined && a.name);
      } catch (err) {
        lastError = err;
        if (process.env.NODE_ENV === 'development') {
          console.warn(`[AmenitiesService] Failed to fetch from ${path}, trying next...`, err);
        }
      }
    }
    if (process.env.NODE_ENV === 'development') {
      console.error('[AmenitiesService] All endpoints failed:', lastError);
    }
    throw createApiError(lastError as AxiosError);
  }
}

export const amenitiesService = new AmenitiesService();
