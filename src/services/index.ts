/**
 * Services Index
 * Central export point for all API services
 */

// Configuration
export { apiClient, handleApiResponse, createApiError, BASE_URL } from './api.config';
export type { ApiResponse, ApiError } from './api.config';

// Authentication Service
export { authService } from './auth.service';
export type {
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
  ChangePasswordRequest,
  AuthResponse,
  TokenValidationResponse
} from './auth.service';

// Properties Service
export { propertiesService } from './properties.service';
export type {
  PropertySearchParams,
  PropertySearchResponse,
  CreatePropertyRequest,
  UpdatePropertyRequest
} from './properties.service';

// Bookings Service
export { bookingsService } from './bookings.service';
export type {
  CreateBookingRequest,
  BookingSearchParams,
  BookingSearchResponse,
  UpdateBookingStatusRequest,
  PricingRequest,
  PricingResponse,
  UpdatePaymentDetailsRequest,
  UpdatePaymentDetailsResponse
} from './bookings.service';

// Analytics Service
export { analyticsService } from './analytics.service';
export type {
  HostStatsType,
  ActivityItemType,
  FinancialDataType,
  AdminStatsType,
  AdminUserType,
  UsersResponseType
} from './analytics.service';

// Admin Service
export { adminService } from './admin.service';
export type {
  PropertyStatusHistory,
  AdminProperty,
  AdminBooking,
  AdminReview,
  Transaction,
  Payout,
  RevenueAnalytics,
  AdminLog,
  PlatformSettings
} from './admin.service';

// Amenities Service
export { amenitiesService } from './amenities.service';
export type { AmenityRecord } from './amenities.service';

// Financials Service
export { financialsService } from './financials.service';
export type {
  FinancialSummary,
  FinancialOverview,
  FinancialTrendPoint,
  PayoutStats,
  UpcomingPayout,
  ExpenseBreakdown,
  PropertyPerformance,
  AuditAlert,
  MissingPaymentReference
} from './financials.service';

// Import for default export
import { authService } from './auth.service';
import { propertiesService } from './properties.service';
import { bookingsService } from './bookings.service';
import { analyticsService } from './analytics.service';
import { adminService } from './admin.service';
import { amenitiesService } from './amenities.service';

// Default exports for convenience
export default {
  auth: authService,
  properties: propertiesService,
  bookings: bookingsService,
  analytics: analyticsService,
  admin: adminService,
  amenities: amenitiesService
};