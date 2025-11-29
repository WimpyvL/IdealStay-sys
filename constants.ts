/**
 * Application Constants
 * Configuration values used throughout the Ideal Stay application
 * 
 * Note: Mock data has been removed as the application now uses real APIs.
 */

// API Configuration
export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api/v1';
export const BACKEND_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

// Utility function to convert relative image URLs to absolute URLs
export const getImageUrl = (relativePath: string): string => {
  if (!relativePath) return DEFAULT_PROPERTY_THUMBNAIL;
  if (relativePath.startsWith('http') || relativePath.startsWith('data:')) return relativePath;
  return `${BACKEND_BASE_URL}${relativePath}`;
};

// Application Configuration
export const APP_NAME = 'Ideal Stay';
export const APP_VERSION = '3.0';

// UI Configuration - Base64 encoded SVGs for reliable fallback images
export const DEFAULT_PROPERTY_IMAGE = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgdmlld0JveD0iMCAwIDgwMCA2MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI4MDAiIGhlaWdodD0iNjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yNDAgMjQwSDU2MFYzNjBIMjQwVjI0MFoiIGZpbGw9IiNFNUU3RUIiLz4KPGNpcmNsZSBjeD0iMzIwIiBjeT0iMjgwIiByPSIyNCIgZmlsbD0iI0QxRDVEQiIvPgo8dGV4dCB4PSI0MDAiIHk9IjQ0MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjM2IiBmaWxsPSIjOUNBM0FGIj5Qcm9wZXJ0eSBJbWFnZTwvdGV4dD4KPC9zdmc+Cg==';

export const DEFAULT_PROPERTY_THUMBNAIL = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgdmlld0JveD0iMCAwIDIwMCAxNTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMTUwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik02MCA2MEgxNDBWOTBINjBWNjBaIiBmaWxsPSIjRTVFN0VCIi8+CjxjaXJjbGUgY3g9IjgwIiBjeT0iNzUiIHI9IjgiIGZpbGw9IiNEMUQ1REIiLz4KPHRleHQgeD0iMTAwIiB5PSIxMjAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMiIgZmlsbD0iIzlDQTNBRiI+Tm8gSW1hZ2U8L3RleHQ+Cjwvc3ZnPgo=';

export const DEFAULT_AVATAR_IMAGE = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgdmlld0JveD0iMCAwIDE1MCAxNTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxNTAiIGhlaWdodD0iMTUwIiByeD0iNzUiIGZpbGw9IiNGM0Y0RjYiLz4KPGNpcmNsZSBjeD0iNzUiIGN5PSI2NSIgcj0iMjAiIGZpbGw9IiNFNUU3RUIiLz4KPHBhdGggZD0iTTQ1IDExNUM0NSAxMDUuMDU5IDUzLjA1OSA5NyA2MyA5N0g4N0M5Ni45NDEgOTcgMTA1IDEwNS4wNTkgMTA1IDExNVYxMjBINDVWMTE1WiIgZmlsbD0iI0U1RTdFQiIvPgo8L3N2Zz4K';

// Map Configuration
export const DEFAULT_MAP_CENTER = {
  lat: 34.0522,
  lng: -118.2437 // Los Angeles, CA
};

// Pagination Defaults
export const DEFAULT_PAGE_SIZE = 12;
export const DEFAULT_SEARCH_LIMIT = 20;

// Date Formats
export const DATE_FORMAT = 'YYYY-MM-DD';
export const DATETIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';

// Currency Configuration
export const DEFAULT_CURRENCY = 'USD';
export const CURRENCY_SYMBOL = '$';

// File Upload Limits
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Authentication Configuration
export const TOKEN_STORAGE_KEY = 'ideal_stay_token';
export const USER_STORAGE_KEY = 'ideal_stay_user';

// Search Configuration
export const MIN_SEARCH_QUERY_LENGTH = 2;
export const SEARCH_DEBOUNCE_DELAY = 300; // milliseconds

// Booking Configuration
export const MIN_STAY_DAYS = 1;
export const MAX_ADVANCE_BOOKING_DAYS = 365;

// Status Enums for Reference
export const USER_ROLES = ['guest', 'host', 'admin'] as const;
// Backend canonical property statuses (database + API):
//   draft | pending | active | inactive | suspended
// Historical frontend used 'approved' and 'rejected'. We keep a mapping so
// components referencing legacy terms still render correctly without breaking.
export const PROPERTY_STATUSES = ['draft', 'pending', 'active', 'inactive', 'suspended'] as const;

// UI / legacy synonym mapping. Use this to present friendly labels while
// keeping backend aligned values. For example, anywhere we previously
// displayed 'approved' we actually mean backend status 'active'. There is no
// current backend 'rejected' status; rejected properties are represented by
// remaining in 'inactive' (or a future explicit status). Adjust if backend adds it.
export const PROPERTY_STATUS_UI_MAP: Record<string, { label: string; badgeClass: string }> = {
  draft: { label: 'Draft', badgeClass: 'draft' },
  pending: { label: 'Pending Review', badgeClass: 'pending' },
  active: { label: 'Approved', badgeClass: 'approved' },
  inactive: { label: 'Inactive', badgeClass: 'inactive' },
  suspended: { label: 'Suspended', badgeClass: 'suspended' },
  // Legacy synonyms
  approved: { label: 'Approved', badgeClass: 'approved' },
  rejected: { label: 'Rejected', badgeClass: 'rejected' }
};
export const BOOKING_STATUSES = ['pending', 'confirmed', 'cancelled', 'completed'] as const;

// Theme Colors (for reference)
export const THEME_COLORS = {
  primary: '#6366F1',
  secondary: '#8B5CF6',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
} as const;

// Legacy Mock Data Notice
export const MOCK_DATA_NOTICE = 'Mock data has been removed. All components now use real APIs.';
