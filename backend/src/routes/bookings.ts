import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import {
  checkAvailability,
  createBooking,
  getBookings,
  getBookingById,
  updateBookingStatus,
  cancelBooking,
  getPropertyBookedDates
} from '../controllers/bookingController';
import { createBookingReview, recalculateAllRatings } from '../controllers/reviewController';
import { calculatePricing } from '../controllers/bookingController';
import {
  updatePaymentStatus,
  getPaymentHistory,
  processRefund,
  getBookingFinancials
} from '../controllers/paymentController';

const router = express.Router();

// ==================================================
// AVAILABILITY CHECKING (Public with property ID context)
// ==================================================

/**
 * GET /api/v1/bookings/properties/:id/availability
 * Check property availability for specific dates
 * Query parameters:
 * - check_in_date: YYYY-MM-DD (required)
 * - check_out_date: YYYY-MM-DD (required)  
 * - guests_count: number (optional, default: 1)
 */
router.get('/properties/:id/availability', checkAvailability);
// Public booked dates for calendar disabling
router.get('/properties/:id/booked-dates', getPropertyBookedDates);
// Pricing calculation (public) - mirrors availability pricing logic without availability validation
router.post('/pricing', calculatePricing);

// ==================================================
// BOOKING MANAGEMENT (Authentication Required)
// ==================================================

/**
 * POST /api/v1/bookings
 * Create a new booking (guests only)
 * Body: {
 *   property_id: number,
 *   check_in_date: string,
 *   check_out_date: string,
 *   guests_count: number,
 *   special_requests?: string,
 *   payment_method?: string
 * }
 */
router.post('/', authenticateToken, requireRole(['guest', 'admin']), createBooking);

/**
 * GET /api/v1/bookings
 * Get bookings filtered by user role and permissions
 * Query parameters:
 * - status: pending|confirmed|cancelled|completed|refunded
 * - property_id: number (filter by property)
 * - guest_id: number (admin only)
 * - host_id: number (admin only)
 * - start_date: YYYY-MM-DD (filter by check-in date)
 * - end_date: YYYY-MM-DD (filter by check-out date)
 * - page: number (default: 1)
 * - limit: number (default: 10, max: 50)
 */
router.get('/', authenticateToken, getBookings);

/**
 * GET /api/v1/bookings/:id
 * Get detailed booking information with permissions check
 */
router.get('/:id', authenticateToken, getBookingById);

// ==================================================
// BOOKING STATUS MANAGEMENT (Host/Admin)
// ==================================================

/**
 * PUT /api/v1/bookings/:id/status
 * Update booking status (host/admin only)
 * Body: {
 *   status: 'pending'|'confirmed'|'cancelled'|'completed'|'refunded',
 *   host_notes?: string
 * }
 */
router.put('/:id/status', authenticateToken, requireRole(['host', 'admin']), updateBookingStatus);

/**
 * POST /api/v1/bookings/:id/cancel
 * Cancel a booking (guest, host, or admin)
 * Body: {
 *   cancellation_reason?: string
 * }
 */
router.post('/:id/cancel', authenticateToken, cancelBooking);

// ==================================================
// PAYMENT MANAGEMENT
// ==================================================

/**
 * PUT /api/v1/bookings/:id/payment
 * Update payment status and details
 * Body: {
 *   payment_status: 'pending'|'paid'|'failed'|'refunded'|'partial',
 *   payment_method?: string,
 *   payment_reference?: string,
 *   payment_notes?: string
 * }
 */
router.put('/:id/payment', authenticateToken, updatePaymentStatus);

/**
 * GET /api/v1/bookings/:id/payment/history
 * Get payment history for a booking
 */
router.get('/:id/payment/history', authenticateToken, getPaymentHistory);

/**
 * POST /api/v1/bookings/:id/refund
 * Process a refund (admin only)
 * Body: {
 *   refund_amount: number,
 *   refund_reason?: string,
 *   refund_method?: string
 * }
 */
router.post('/:id/refund', authenticateToken, requireRole(['admin']), processRefund);

/**
 * POST /api/v1/bookings/:id/review
 * Submit a review for a completed booking (guest -> host/property)
 * Body: { rating: 1-5, comment?: string, title?: string }
 */
router.post('/:id/review', authenticateToken, requireRole(['guest', 'admin']), createBookingReview);

/**
 * POST /api/v1/bookings/reviews/recalculate
 * Recalculate all property and host ratings from existing reviews (admin only)
 */
router.post('/reviews/recalculate', authenticateToken, requireRole(['admin']), recalculateAllRatings);

/**
 * GET /api/v1/bookings/:id/financials
 * Get detailed financial breakdown for a booking
 * (admin, guest, or host of the booking)
 */
router.get('/:id/financials', authenticateToken, getBookingFinancials);

export default router;