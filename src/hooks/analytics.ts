/**
 * Analytics Hooks
 * Custom React hooks for analytics and dashboard data
 */

import { useState, useEffect, useRef } from 'react';
import { useAuthState } from '../contexts/AuthContext';
import { analyticsService, HostStatsType, ActivityItemType, FinancialDataType, AdminStatsType, UsersResponseType } from '../services';

// Hook for host dashboard statistics
export const useHostStats = () => {
  const { isAuthenticated, token, isLoading: authLoading } = useAuthState();
  const [stats, setStats] = useState<HostStatsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const attempted = useRef(false);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await analyticsService.getHostStats();
      setStats(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch host statistics');
      console.error('Error fetching host stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Wait until auth state known and user authenticated with token
    if (authLoading) return;
    if (!isAuthenticated || !token) {
      setLoading(false);
      return;
    }
    if (!attempted.current) {
      attempted.current = true;
      fetchStats();
    }
  }, [authLoading, isAuthenticated, token]);

  return {
    stats,
    loading,
    error,
    refetch: fetchStats
  };
};

// Hook for host activity feed
export const useHostActivity = (limit: number = 10) => {
  const { isAuthenticated, token, isLoading: authLoading } = useAuthState();
  const [activities, setActivities] = useState<ActivityItemType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const attempted = useRef(false);

  const fetchActivity = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await analyticsService.getHostActivity(limit);
      setActivities(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch host activity');
      console.error('Error fetching host activity:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !token) {
      setLoading(false);
      return;
    }
    // Refetch if limit changes AND already attempted
    if (attempted.current && activities.length > 0 && limit) {
      fetchActivity();
      return;
    }
    if (!attempted.current) {
      attempted.current = true;
      fetchActivity();
    }
  }, [authLoading, isAuthenticated, token, limit]);

  return {
    activities,
    loading,
    error,
    refetch: fetchActivity
  };
};

// Hook for host financial data
export const useHostFinancials = (period: 'weekly' | 'monthly' | 'yearly' = 'monthly') => {
  const { isAuthenticated, token, isLoading: authLoading } = useAuthState();
  const [financials, setFinancials] = useState<FinancialDataType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const attempted = useRef(false);

  const fetchFinancials = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await analyticsService.getHostFinancials(period);
      setFinancials(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch financial data');
      console.error('Error fetching financials:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !token) {
      setLoading(false);
      return;
    }
    if (attempted.current) {
      fetchFinancials();
      return;
    }
    attempted.current = true;
    fetchFinancials();
  }, [authLoading, isAuthenticated, token, period]);

  return {
    financials,
    loading,
    error,
    refetch: fetchFinancials,
    setPeriod: (newPeriod: 'weekly' | 'monthly' | 'yearly') => {
      if (newPeriod !== period) {
        fetchFinancials();
      }
    }
  };
};

// Hook for admin dashboard statistics
export const useAdminStats = () => {
  const [stats, setStats] = useState<AdminStatsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await analyticsService.getAdminStats();
      setStats(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch admin statistics');
      console.error('Error fetching admin stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return {
    stats,
    loading,
    error,
    refetch: fetchStats
  };
};

// Hook for admin user management
export const useAdminUsers = (page: number = 1, limit: number = 10, search?: string) => {
  const [data, setData] = useState<UsersResponseType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await analyticsService.getAllUsers({ page, limit, search });
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch users');
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateUserStatus = async (userId: number, status: 'active' | 'inactive' | 'suspended') => {
    try {
      await analyticsService.updateUserStatus(userId, status);
      // Refresh the users list
      await fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to update user status');
      console.error('Error updating user status:', err);
      throw err; // Re-throw to let component handle the error
    }
  };

  const approveHost = async (userId: number, admin_notes?: string) => {
    try {
      await analyticsService.approveHost(userId, admin_notes);
      // Refresh the users list
      await fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to approve host');
      console.error('Error approving host:', err);
      throw err; // Re-throw to let component handle the error
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, limit, search]);

  return {
    users: data?.users || [],
    pagination: data?.pagination,
    loading,
    error,
    refetch: fetchUsers,
    updateUserStatus,
    approveHost
  };
};