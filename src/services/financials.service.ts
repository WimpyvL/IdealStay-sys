import { apiClient, handleApiResponse } from './api.config';
import type { Transaction } from '../../types';

export interface FinancialSummary {
  grossRevenue: number;
  platformFees: number;
  taxes: number;
  netPayout: number;
  paidPayouts: number;
  outstandingBalance: number;
  completedBookings: number;
  bookedNights: number;
  averageDailyRate: number;
  occupancyRate: number;
}

export interface FinancialTrendPoint {
  period: string;
  revenue: number;
  taxes: number;
  cleaningFees: number;
  bookings: number;
}

export interface UpcomingPayout {
  bookingId: number;
  propertyTitle: string;
  amount: number;
  checkInDate: string;
  checkOutDate: string;
}

export interface PayoutStats {
  pendingTotal: number;
  upcomingTotal: number;
  upcomingPayouts: UpcomingPayout[];
  lastPayout: {
    bookingId: number;
    propertyTitle: string;
    amount: number;
    processedAt: string;
  } | null;
}

export interface ExpenseBreakdown {
  platformFees: number;
  cleaningFees: number;
  taxes: number;
  securityDeposits: number;
  hostEarnings: number;
}

export interface PropertyPerformance {
  propertyId: number;
  propertyTitle: string;
  revenue: number;
  nights: number;
  bookings: number;
  cancellations: number;
  averageDailyRate: number;
}

export interface AuditAlert {
  id: string;
  label: string;
  count: number;
  severity: 'high' | 'medium' | 'low';
}

export interface FinancialOverview {
  summary: FinancialSummary;
  payoutStats: PayoutStats;
  expenseBreakdown: ExpenseBreakdown;
  monthlyTrend: FinancialTrendPoint[];
  propertyPerformance: PropertyPerformance[];
  auditAlerts: AuditAlert[];
}

export interface MissingPaymentReference {
  bookingId: number;
  propertyTitle: string;
  propertyImageUrl?: string | null;
  amount: number;
  taxes: number;
  cleaningFee: number;
  securityDeposit: number;
  checkOutDate: string;
  checkInDate: string | null;
  paidAt: string | null;
  createdAt: string;
  guestCount: number;
  stayNights: number;
}

const getOverview = async (): Promise<FinancialOverview> => {
  const res = await apiClient.get('/financials');
  return handleApiResponse<FinancialOverview>(res);
};

const getSummary = async (): Promise<FinancialSummary> => {
  const overview = await getOverview();
  return overview.summary;
};

const getTransactions = async (period: 'all' | '30d' | '90d' | 'year' = 'all'): Promise<Transaction[]> => {
  const query = period === 'all' ? '' : `?period=${period}`;
  const res = await apiClient.get(`/financials/transactions${query}`);
  return handleApiResponse<Transaction[]>(res);
};

const exportMonthlyReport = async (): Promise<Blob> => {
  const res = await apiClient.get('/financials/export/monthly-report', {
    responseType: 'blob',
  });
  return res.data as Blob;
};

const exportLedger = async (period: 'all' | '30d' | '90d' | 'year' = 'all'): Promise<Blob> => {
  const query = period === 'all' ? '' : `?period=${period}`;
  const res = await apiClient.get(`/financials/export/ledger${query}`, {
    responseType: 'blob',
  });
  return res.data as Blob;
};

const getMissingPaymentReferences = async (): Promise<MissingPaymentReference[]> => {
  const res = await apiClient.get('/financials/audit/missing-payout-references');
  return handleApiResponse<MissingPaymentReference[]>(res);
};

export const financialsService = {
  getOverview,
  getSummary,
  getTransactions,
  exportMonthlyReport,
  exportLedger,
  getMissingPaymentReferences,
};

export type { Transaction };
