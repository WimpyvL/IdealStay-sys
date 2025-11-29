/**
 * Admin Routes
 * All routes for admin dashboard functionality
 */

import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import {
  getAdminProperties,
  getPropertyStatusHistory,
  approveProperty,
  rejectProperty,
  getAdminBookings,
  cancelBookingAsAdmin,
  processRefund,
  getAdminReviews,
  moderateReview,
  deleteReview
} from '../controllers/adminController';
import {
  getRevenueAnalytics,
  getTransactions,
  getPayouts,
  processPayout,
  createPayout
} from '../controllers/adminFinancialController';
import {
  getAllAmenities,
  createAmenity,
  updateAmenity,
  deleteAmenity,
  getSettings,
  updateSettings,
  getAdminLogs
} from '../controllers/adminAmenityController';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticateToken, requireAdmin);

// ============================================================
// PROPERTY MANAGEMENT ROUTES
// ============================================================

/**
 * GET /api/admin/properties
 * Get all properties with filters and search
 * Query params: status, search, page, limit, sortBy, sortOrder
 */
router.get('/properties', getAdminProperties);

/**
 * GET /api/admin/properties/:id/history
 * Get property status change history
 */
router.get('/properties/:id/history', getPropertyStatusHistory);

/**
 * PUT /api/admin/properties/:id/approve
 * Approve a property listing
 * Body: { admin_notes?: string }
 */
router.put('/properties/:id/approve', approveProperty);

/**
 * PUT /api/admin/properties/:id/reject
 * Reject a property listing
 * Body: { rejection_reason: string }
 */
router.put('/properties/:id/reject', rejectProperty);

// ============================================================
// BOOKING MANAGEMENT ROUTES
// ============================================================

/**
 * GET /api/admin/bookings
 * Get all bookings with filters
 * Query params: status, search, page, limit, sortBy, sortOrder
 */
router.get('/bookings', getAdminBookings);

/**
 * PUT /api/admin/bookings/:id/cancel
 * Cancel a booking as admin
 * Body: { cancellation_reason: string, admin_notes?: string }
 */
router.put('/bookings/:id/cancel', cancelBookingAsAdmin);

/**
 * POST /api/admin/bookings/:id/refund
 * Process refund for a cancelled booking
 * Body: { refund_amount: number, notes?: string }
 */
router.post('/bookings/:id/refund', processRefund);

// ============================================================
// FINANCIAL MANAGEMENT ROUTES
// ============================================================

/**
 * GET /api/admin/analytics/revenue
 * Get revenue analytics and breakdowns
 * Query params: period (daily|weekly|monthly|yearly), start_date, end_date
 */
router.get('/analytics/revenue', getRevenueAnalytics);

/**
 * GET /api/admin/transactions
 * Get all transactions
 * Query params: transaction_type, status, page, limit
 */
router.get('/transactions', getTransactions);

/**
 * GET /api/admin/payouts
 * Get all host payouts
 * Query params: status, host_id, page, limit
 */
router.get('/payouts', getPayouts);

/**
 * POST /api/admin/payouts
 * Create a new payout for a host
 * Body: { host_id: number, period_start: string, period_end: string }
 */
router.post('/payouts', createPayout);

/**
 * POST /api/admin/payouts/:id/process
 * Process a pending payout
 * Body: { payout_method: string, payout_reference?: string, admin_notes?: string }
 */
router.post('/payouts/:id/process', processPayout);

// ============================================================
// REVIEW MODERATION ROUTES
// ============================================================

/**
 * GET /api/admin/reviews
 * Get all reviews with filters
 * Query params: flagged (boolean), admin_action, page, limit
 */
router.get('/reviews', getAdminReviews);

/**
 * PUT /api/admin/reviews/:id/moderate
 * Moderate a review
 * Body: { admin_action: 'none'|'approved'|'hidden'|'deleted', notes?: string }
 */
router.put('/reviews/:id/moderate', moderateReview);

/**
 * DELETE /api/admin/reviews/:id
 * Permanently delete a review
 */
router.delete('/reviews/:id', deleteReview);

// ============================================================
// AMENITY MANAGEMENT ROUTES
// ============================================================

/**
 * GET /api/admin/amenities
 * Get all amenities with usage statistics
 */
router.get('/amenities', getAllAmenities);

/**
 * POST /api/admin/amenities
 * Create a new amenity
 * Body: { name: string, icon?: string, category: string, description?: string, is_active?: boolean }
 */
router.post('/amenities', createAmenity);

/**
 * PUT /api/admin/amenities/:id
 * Update an amenity
 * Body: { name?, icon?, category?, description?, is_active? }
 */
router.put('/amenities/:id', updateAmenity);

/**
 * DELETE /api/admin/amenities/:id
 * Delete or deactivate an amenity
 * Query params: permanent (boolean)
 */
router.delete('/amenities/:id', deleteAmenity);

// ============================================================
// PLATFORM SETTINGS ROUTES
// ============================================================

/**
 * GET /api/admin/settings
 * Get all platform settings
 */
router.get('/settings', getSettings);

/**
 * PUT /api/admin/settings
 * Update platform settings
 * Body: { [setting_key]: value, ... }
 */
router.put('/settings', updateSettings);

// ============================================================
// ADMIN LOGS ROUTES
// ============================================================

/**
 * GET /api/admin/logs
 * Get admin action logs
 * Query params: action, admin_id, page, limit
 */
router.get('/logs', getAdminLogs);

export default router;