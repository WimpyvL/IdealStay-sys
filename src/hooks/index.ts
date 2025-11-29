/**
 * Custom Hooks for API Data Fetching
 * Provides reusable hooks for common API operations with loading states and error handling
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  propertiesService, 
  bookingsService,
  PropertySearchParams,
  BookingSearchParams
} from '../services';
import type { Property, Booking, Amenity, Review } from '../../types';

// Generic async hook state
interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

// Generic async hook
function useAsync<T>() {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(async (asyncFunction: () => Promise<T>) => {
    setState({ data: null, loading: true, error: null });
    try {
      const result = await asyncFunction();
      setState({ data: result, loading: false, error: null });
      return result;
    } catch (error: any) {
      const errorMessage = error.message || 'An error occurred';
      setState({ data: null, loading: false, error: errorMessage });
      throw error;
    }
  }, []);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return { ...state, execute, reset };
}

// Properties Hooks
export const useProperties = (params?: PropertySearchParams) => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProperties = useCallback(async (searchParams?: PropertySearchParams) => {
    setLoading(true);
    setError(null);
    try {
      let result;
      if (searchParams || params) {
        const searchResponse = await propertiesService.searchProperties(searchParams || params);
        result = searchResponse.properties;
      } else {
        result = await propertiesService.getAllProperties();
      }
      setProperties(result);
      return result;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch properties';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  return { properties, loading, error, refetch: fetchProperties };
};

export const useProperty = (propertyId: string | number) => {
  const { data: property, loading, error, execute } = useAsync<Property>();

  const fetchProperty = useCallback(() => {
    if (propertyId) {
      return execute(() => propertiesService.getPropertyById(propertyId));
    }
    return Promise.reject(new Error('Property ID is required'));
  }, [propertyId, execute]);

  useEffect(() => {
    fetchProperty();
  }, [fetchProperty]);

  return { property, loading, error, refetch: fetchProperty };
};

export const usePropertyReviews = (propertyId: number) => {
  const { data: reviews, loading, error, execute } = useAsync<Review[]>();

  const fetchReviews = useCallback(() => {
    return execute(() => propertiesService.getPropertyReviews(propertyId));
  }, [propertyId, execute]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  return { reviews, loading, error, refetch: fetchReviews };
};

export const useAmenities = () => {
  const { data: amenities, loading, error, execute } = useAsync<Amenity[]>();

  const fetchAmenities = useCallback(() => {
    return execute(() => propertiesService.getAvailableAmenities());
  }, [execute]);

  useEffect(() => {
    fetchAmenities();
  }, [fetchAmenities]);

  return { amenities, loading, error, refetch: fetchAmenities };
};

export const useNearbyProperties = (lat: number, lng: number, radius?: number) => {
  const { data: properties, loading, error, execute } = useAsync<Property[]>();

  const fetchNearbyProperties = useCallback(() => {
    return execute(() => propertiesService.getNearbyProperties(lat, lng, radius));
  }, [lat, lng, radius, execute]);

  useEffect(() => {
    if (lat && lng) {
      fetchNearbyProperties();
    }
  }, [fetchNearbyProperties, lat, lng]);

  return { properties, loading, error, refetch: fetchNearbyProperties };
};

// Bookings Hooks
export const useBookings = (params?: BookingSearchParams) => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBookings = useCallback(async (searchParams?: BookingSearchParams) => {
    setLoading(true);
    setError(null);
    try {
      const response = await bookingsService.getBookings(searchParams || params);
      setBookings(response.bookings);
      return response;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch bookings';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  return { bookings, loading, error, refetch: fetchBookings };
};

export const useGuestBookings = (params?: BookingSearchParams) => {
  const { data, loading, error, execute } = useAsync<any>();

  const fetchGuestBookings = useCallback((searchParams?: BookingSearchParams) => {
    return execute(() => bookingsService.getBookings(searchParams || params, 'guest'));
  }, [params, execute]);

  useEffect(() => {
    fetchGuestBookings();
  }, [fetchGuestBookings]);

  return { 
    bookings: data?.bookings || [], 
    total: data?.total || 0,
    loading, 
    error, 
    refetch: fetchGuestBookings 
  };
};

export const useHostBookings = (params?: BookingSearchParams) => {
  const { data, loading, error, execute } = useAsync<any>();

  const fetchHostBookings = useCallback((searchParams?: BookingSearchParams) => {
    return execute(() => bookingsService.getBookings(searchParams || params, 'host'));
  }, [params, execute]);

  useEffect(() => {
    fetchHostBookings();
  }, [fetchHostBookings]);

  return { 
    bookings: data?.bookings || [], 
    total: data?.total || 0,
    loading, 
    error, 
    refetch: fetchHostBookings 
  };
};

export const useBooking = (bookingId: number) => {
  const { data: booking, loading, error, execute } = useAsync<Booking>();

  const fetchBooking = useCallback(() => {
    return execute(() => bookingsService.getBookingById(bookingId));
  }, [bookingId, execute]);

  useEffect(() => {
    if (bookingId) {
      fetchBooking();
    }
  }, [fetchBooking, bookingId]);

  return { booking, loading, error, refetch: fetchBooking };
};

// Host Dashboard Hooks
export const useHostProperties = (hostId?: number) => {
  const { data: properties, loading, error, execute } = useAsync<Property[]>();
  const lastFetchRef = useRef<number>(0);
  const inFlightRef = useRef<boolean>(false);
  const retryTimeoutRef = useRef<any>(null);
  const [rateLimitedUntil, setRateLimitedUntil] = useState<number | null>(null);

  const fetchHostProperties = useCallback(async (force = false) => {
    if (!hostId) {
      return Promise.reject(new Error('Host ID is required'));
    }
    const now = Date.now();
    if (rateLimitedUntil && now < rateLimitedUntil) {
      return Promise.reject(new Error('Temporarily rate limited, please wait'));
    }
    // Avoid duplicate concurrent fetches
    if (inFlightRef.current) return Promise.resolve(properties || []);
    // Basic cooldown (3s) unless forced
    if (!force && now - lastFetchRef.current < 3000) {
      return Promise.resolve(properties || []);
    }
    inFlightRef.current = true;
    lastFetchRef.current = now;
    try {
      const result = await execute(() => propertiesService.getPropertiesByHost(hostId));
      return result;
    } catch (err: any) {
      // Detect 429 from message
      if (err?.message && /too many requests/i.test(err.message)) {
        // Default backoff 15s or use retryAfter if server provided
        const retryAfterSec = (err as any).retryAfter || 15;
        const until = Date.now() + retryAfterSec * 1000;
        setRateLimitedUntil(until);
        if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = setTimeout(() => {
          setRateLimitedUntil(null);
        }, retryAfterSec * 1000);
      }
      throw err;
    } finally {
      inFlightRef.current = false;
    }
  }, [hostId, execute, properties, rateLimitedUntil]);

  useEffect(() => {
    if (hostId) {
      fetchHostProperties();
    }
    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, [fetchHostProperties, hostId]);

  return { properties, loading, error, refetch: fetchHostProperties, rateLimitedUntil };
};

export const useBookingStats = (hostId?: number) => {
  const { data: stats, loading, error, execute } = useAsync<any>();

  const fetchBookingStats = useCallback(() => {
    return execute(() => bookingsService.getBookingStats(hostId));
  }, [hostId, execute]);

  useEffect(() => {
    fetchBookingStats();
  }, [fetchBookingStats]);

  return { stats, loading, error, refetch: fetchBookingStats };
};

// Utility Hooks
export const useAvailabilityCheck = () => {
  const { data, loading, error, execute } = useAsync<{ available: boolean; conflicts?: any[] }>();

  const checkAvailability = useCallback((propertyId: number, checkIn: string, checkOut: string) => {
    return execute(() => propertiesService.checkAvailability(propertyId, checkIn, checkOut));
  }, [execute]);

  return { 
    availability: data, 
    loading, 
    error, 
    checkAvailability 
  };
};

export const usePricingCalculation = () => {
  const { data, loading, error, execute } = useAsync<any>();

  const calculatePricing = useCallback((propertyId: number, checkIn: string, checkOut: string, guests: number) => {
    return execute(() => bookingsService.calculatePricing({
      property_id: propertyId,
      check_in_date: checkIn,
      check_out_date: checkOut,
      guests
    }));
  }, [execute]);

  // Extract pricing from nested response structure
  const pricing = data?.pricing || data;

  return {
    pricing,
    loading,
    error,
    calculatePricing
  };
};

// Featured Properties Hook
export const useFeaturedProperties = (limit?: number) => {
  const { data: properties, loading, error, execute } = useAsync<Property[]>();

  const fetchFeaturedProperties = useCallback(() => {
    return execute(() => propertiesService.getFeaturedProperties(limit));
  }, [limit, execute]);

  useEffect(() => {
    fetchFeaturedProperties();
  }, [fetchFeaturedProperties]);

  return { properties, loading, error, refetch: fetchFeaturedProperties };
};

// Export the generic useAsync hook for custom usage
export { useAsync };

// Analytics Hooks
export {
  useHostStats,
  useHostActivity,
  useHostFinancials,
  useAdminStats,
  useAdminUsers
} from './analytics';

// Admin Hooks
export {
  useAdminProperties,
  usePropertyHistory,
  useAdminBookings,
  useRevenueAnalytics,
  useTransactions,
  usePayouts,
  useAdminReviews,
  usePlatformSettings
} from './useAdmin';