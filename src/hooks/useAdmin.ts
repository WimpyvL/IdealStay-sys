/**
 * Admin Dashboard Hooks
 * Custom hooks for admin operations
 */

import { useState, useEffect, useCallback } from 'react';
import { adminService } from '../services';
import type {
  AdminProperty,
  AdminBooking,
  AdminReview,
  Transaction,
  Payout,
  RevenueAnalytics,
  PropertyStatusHistory,
  PlatformSettings
} from '../services/admin.service';

// ============================================================
// PROPERTY MANAGEMENT HOOKS
// ============================================================

export const useAdminProperties = (filters?: {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}) => {
  const [properties, setProperties] = useState<AdminProperty[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProperties = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminService.getProperties(filters || {});
      setProperties(data.properties);
      setPagination(data.pagination);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch properties');
      console.error('Error fetching admin properties:', err);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  const approveProperty = async (propertyId: number, notes?: string) => {
    try {
      await adminService.approveProperty(propertyId, notes);
      await fetchProperties();
    } catch (err: any) {
      throw new Error(err.message || 'Failed to approve property');
    }
  };

  const rejectProperty = async (propertyId: number, reason: string) => {
    try {
      await adminService.rejectProperty(propertyId, reason);
      await fetchProperties();
    } catch (err: any) {
      throw new Error(err.message || 'Failed to reject property');
    }
  };

  return {
    properties,
    pagination,
    loading,
    error,
    refetch: fetchProperties,
    approveProperty,
    rejectProperty
  };
};

export const usePropertyHistory = (propertyId: number) => {
  const [history, setHistory] = useState<PropertyStatusHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const data = await adminService.getPropertyHistory(propertyId);
        setHistory(data);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch property history');
      } finally {
        setLoading(false);
      }
    };

    if (propertyId) {
      fetchHistory();
    }
  }, [propertyId]);

  return { history, loading, error };
};

// ============================================================
// BOOKING MANAGEMENT HOOKS
// ============================================================

export const useAdminBookings = (filters?: {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}) => {
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminService.getBookings(filters || {});
      setBookings(data.bookings);
      setPagination(data.pagination);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch bookings');
      console.error('Error fetching admin bookings:', err);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const cancelBooking = async (bookingId: number, reason: string, notes?: string) => {
    try {
      await adminService.cancelBooking(bookingId, reason, notes);
      await fetchBookings();
    } catch (err: any) {
      throw new Error(err.message || 'Failed to cancel booking');
    }
  };

  const processRefund = async (bookingId: number, amount: number, notes?: string) => {
    try {
      await adminService.processRefund(bookingId, amount, notes);
      await fetchBookings();
    } catch (err: any) {
      throw new Error(err.message || 'Failed to process refund');
    }
  };

  return {
    bookings,
    pagination,
    loading,
    error,
    refetch: fetchBookings,
    cancelBooking,
    processRefund
  };
};

// ============================================================
// FINANCIAL HOOKS
// ============================================================

export const useRevenueAnalytics = (period: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'monthly') => {
  const [analytics, setAnalytics] = useState<RevenueAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminService.getRevenueAnalytics({ period });
      setAnalytics(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch revenue analytics');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return { analytics, loading, error, refetch: fetchAnalytics };
};

export const useTransactions = (filters?: {
  transaction_type?: string;
  status?: string;
  page?: number;
  limit?: number;
}) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminService.getTransactions(filters || {});
      setTransactions(data.transactions);
      setPagination(data.pagination);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch transactions');
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  return { transactions, pagination, loading, error, refetch: fetchTransactions };
};

export const usePayouts = (filters?: {
  status?: string;
  host_id?: number;
  page?: number;
  limit?: number;
}) => {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPayouts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminService.getPayouts(filters || {});
      setPayouts(data.payouts);
      setPagination(data.pagination);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch payouts');
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    fetchPayouts();
  }, [fetchPayouts]);

  const processPayout = async (payoutId: number, data: any) => {
    try {
      await adminService.processPayout(payoutId, data);
      await fetchPayouts();
    } catch (err: any) {
      throw new Error(err.message || 'Failed to process payout');
    }
  };

  return {
    payouts,
    pagination,
    loading,
    error,
    refetch: fetchPayouts,
    processPayout
  };
};

// ============================================================
// REVIEW MODERATION HOOKS
// ============================================================

export const useAdminReviews = (filters?: {
  flagged?: boolean;
  admin_action?: string;
  page?: number;
  limit?: number;
}) => {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminService.getReviews(filters || {});
      setReviews(data.reviews);
      setPagination(data.pagination);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch reviews');
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const moderateReview = async (reviewId: number, action: string, notes?: string) => {
    try {
      await adminService.moderateReview(reviewId, action, notes);
      await fetchReviews();
    } catch (err: any) {
      throw new Error(err.message || 'Failed to moderate review');
    }
  };

  const deleteReview = async (reviewId: number) => {
    try {
      await adminService.deleteReview(reviewId);
      await fetchReviews();
    } catch (err: any) {
      throw new Error(err.message || 'Failed to delete review');
    }
  };

  return {
    reviews,
    pagination,
    loading,
    error,
    refetch: fetchReviews,
    moderateReview,
    deleteReview
  };
};

// ============================================================
// SETTINGS HOOKS
// ============================================================

export const usePlatformSettings = () => {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminService.getSettings();
      setSettings(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = async (newSettings: { [key: string]: any }) => {
    try {
      await adminService.updateSettings(newSettings);
      await fetchSettings();
    } catch (err: any) {
      throw new Error(err.message || 'Failed to update settings');
    }
  };

  return { settings, loading, error, updateSettings, refetch: fetchSettings };
};