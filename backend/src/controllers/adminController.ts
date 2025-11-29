/**
 * Admin Controller
 * Handles admin-specific operations for property management, bookings, reviews, etc.
 */

import { Request, Response } from 'express';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { getPool } from '../config/database';
import { PropertyStatus } from '../types';

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    userId: number;
    email: string;
    role: string;
  };
}

// ============================================================
// PROPERTY MANAGEMENT
// ============================================================

/**
 * Get all properties with admin filters and search
 * GET /api/admin/properties
 */
export const getAdminProperties = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const pool = getPool();
    const {
      status,
      search,
      page = '1',
      limit = '12',
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // Build query
    let query = `
      SELECT p.*,
             u.first_name as host_first_name,
             u.last_name as host_last_name,
             u.email as host_email,
             u.host_rating,
             (SELECT image_url FROM property_images WHERE property_id = p.id AND is_primary = 1 LIMIT 1) as primary_image
      FROM properties p
      LEFT JOIN users u ON p.host_id = u.id
      WHERE 1=1
    `;

    const queryParams: any[] = [];

    // Status filter
    if (status && status !== 'all') {
      query += ` AND p.status = ?`;
      queryParams.push(status);
    }

    // Search filter
    if (search) {
      query += ` AND (p.title LIKE ? OR p.city LIKE ? OR p.address LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)`;
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    // Sorting
    const validSortColumns = ['created_at', 'price_per_night', 'title', 'status'];
    const sortColumn = validSortColumns.includes(sortBy as string) ? sortBy : 'created_at';
    const sortDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';
    query += ` ORDER BY p.${sortColumn} ${sortDirection}`;

    // Pagination
    query += ` LIMIT ? OFFSET ?`;
    queryParams.push(limitNum, offset);

    const [properties] = await pool.execute<RowDataPacket[]>(query, queryParams);

    // Get total count
    let countQuery = `SELECT COUNT(*) as total FROM properties p LEFT JOIN users u ON p.host_id = u.id WHERE 1=1`;
    const countParams: any[] = [];

    if (status && status !== 'all') {
      countQuery += ` AND p.status = ?`;
      countParams.push(status);
    }

    if (search) {
      countQuery += ` AND (p.title LIKE ? OR p.city LIKE ? OR p.address LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)`;
      const searchPattern = `%${search}%`;
      countParams.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    const [countResult] = await pool.execute<RowDataPacket[]>(countQuery, countParams);
    const total = countResult[0]?.total || 0;

    return res.json({
      success: true,
      data: {
        properties,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          total_pages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    console.error('❌ Error fetching admin properties:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch properties',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

/**
 * Get property status history
 * GET /api/admin/properties/:id/history
 */
export const getPropertyStatusHistory = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const pool = getPool();
    const { id } = req.params;

    const [history] = await pool.execute<RowDataPacket[]>(
      `SELECT psh.*,
              u.first_name, u.last_name, u.email
       FROM property_status_history psh
       LEFT JOIN users u ON psh.changed_by_user_id = u.id
       WHERE psh.property_id = ?
       ORDER BY psh.created_at DESC`,
      [id]
    );

    return res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('❌ Error fetching property history:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch property history'
    });
  }
};

/**
 * Approve property with notes
 * PUT /api/admin/properties/:id/approve
 */
export const approveProperty = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { admin_notes } = req.body;
    const adminId = req.user?.id || req.user?.userId;

    // Defensive metadata detection to avoid 500 if migration not applied yet
    const [columnInfo] = await pool.execute<RowDataPacket[]>(`SHOW COLUMNS FROM properties LIKE 'admin_notes'`);
    const hasAdminNotes = columnInfo.length > 0;
    const [approvedByInfo] = await pool.execute<RowDataPacket[]>(`SHOW COLUMNS FROM properties LIKE 'approved_by_user_id'`);
    const hasApprovedBy = approvedByInfo.length > 0;
    const [approvedAtInfo] = await pool.execute<RowDataPacket[]>(`SHOW COLUMNS FROM properties LIKE 'approved_at'`);
    const hasApprovedAt = approvedAtInfo.length > 0;

    const [historyTable] = await pool.execute<RowDataPacket[]>(`SHOW TABLES LIKE 'property_status_history'`);
    const hasHistoryTable = historyTable.length > 0;
    const [actionsLogTable] = await pool.execute<RowDataPacket[]>(`SHOW TABLES LIKE 'admin_actions_log'`);
    const hasActionsLog = actionsLogTable.length > 0;

    // Get current property status
    const [property] = await pool.execute<RowDataPacket[]>(
      'SELECT status FROM properties WHERE id = ?',
      [id]
    );

    if (!property.length) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    const oldStatus = property[0].status;

    // Build dynamic update set based on existing columns
    const updateFragments: string[] = ["status = 'active'", 'updated_at = CURRENT_TIMESTAMP'];
    const updateValues: any[] = [];
    if (hasAdminNotes) {
      updateFragments.push('admin_notes = ?');
      updateValues.push(admin_notes || null);
    }
    if (hasApprovedBy) {
      updateFragments.push('approved_by_user_id = ?');
      updateValues.push(adminId || null);
    }
    if (hasApprovedAt) {
      updateFragments.push('approved_at = CURRENT_TIMESTAMP');
    }
    updateValues.push(id);

    // Execute update
    await pool.execute(
      `UPDATE properties SET ${updateFragments.join(', ')} WHERE id = ?`,
      updateValues
    );

    // Best-effort ancillary logging; do not fail main approval if tables missing
    if (hasHistoryTable) {
      try {
        await pool.execute(
          `INSERT INTO property_status_history (property_id, old_status, new_status, changed_by_user_id, notes)
           VALUES (?, ?, 'active', ?, ?)`,
          [id, oldStatus, adminId || null, admin_notes || 'Property approved by admin']
        );
      } catch (e) {
        console.warn('⚠️ Failed to insert property_status_history record:', e);
      }
    }
    if (hasActionsLog) {
      try {
        await pool.execute(
          `INSERT INTO admin_actions_log (admin_user_id, action, target_type, target_id, description)
           VALUES (?, 'approve_property', 'property', ?, ?)`,
          [adminId || null, id, `Approved property #${id}`]
        );
      } catch (e) {
        console.warn('⚠️ Failed to insert admin_actions_log record:', e);
      }
    }

    return res.json({
      success: true,
      message: 'Property approved successfully'
    });
  } catch (error) {
    console.error('❌ Error approving property:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to approve property'
    });
  }
};

/**
 * Reject property with reason
 * PUT /api/admin/properties/:id/reject
 */
export const rejectProperty = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { rejection_reason } = req.body;
    const adminId = req.user?.id || req.user?.userId;

    if (!rejection_reason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    // Get current property status
    const [property] = await pool.execute<RowDataPacket[]>(
      'SELECT status FROM properties WHERE id = ?',
      [id]
    );

    if (!property.length) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    const oldStatus = property[0].status;

    // Update property status
    await pool.execute(
      `UPDATE properties
       SET status = 'inactive',
           rejection_reason = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [rejection_reason, id]
    );

    // Log status change
    await pool.execute(
      `INSERT INTO property_status_history (property_id, old_status, new_status, changed_by_user_id, notes)
       VALUES (?, ?, 'inactive', ?, ?)`,
      [id, oldStatus, adminId, rejection_reason]
    );

    // Log admin action
    await pool.execute(
      `INSERT INTO admin_actions_log (admin_user_id, action, target_type, target_id, description)
       VALUES (?, 'reject_property', 'property', ?, ?)`,
      [adminId, id, `Rejected property #${id}: ${rejection_reason}`]
    );

    return res.json({
      success: true,
      message: 'Property rejected successfully'
    });
  } catch (error) {
    console.error('❌ Error rejecting property:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reject property'
    });
  }
};

// ============================================================
// BOOKING MANAGEMENT
// ============================================================

/**
 * Get all bookings with admin filters
 * GET /api/admin/bookings
 */
export const getAdminBookings = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const pool = getPool();
    const {
      status,
      search,
      page = '1',
      limit = '12',
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    let query = `
      SELECT b.*,
             p.title as property_title, p.city as property_city,
             g.first_name as guest_first_name, g.last_name as guest_last_name, g.email as guest_email,
             h.first_name as host_first_name, h.last_name as host_last_name
      FROM bookings b
      LEFT JOIN properties p ON b.property_id = p.id
      LEFT JOIN users g ON b.guest_id = g.id
      LEFT JOIN users h ON b.host_id = h.id
      WHERE 1=1
    `;

    const queryParams: any[] = [];

    if (status && status !== 'all') {
      query += ` AND b.status = ?`;
      queryParams.push(status);
    }

    if (search) {
      query += ` AND (p.title LIKE ? OR g.first_name LIKE ? OR g.last_name LIKE ? OR g.email LIKE ? OR h.first_name LIKE ? OR h.last_name LIKE ?)`;
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    const validSortColumns = ['created_at', 'check_in_date', 'total_amount', 'status'];
    const sortColumn = validSortColumns.includes(sortBy as string) ? sortBy : 'created_at';
    const sortDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';
    query += ` ORDER BY b.${sortColumn} ${sortDirection}`;

    query += ` LIMIT ? OFFSET ?`;
    queryParams.push(limitNum, offset);

    const [bookings] = await pool.execute<RowDataPacket[]>(query, queryParams);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total
      FROM bookings b
      LEFT JOIN properties p ON b.property_id = p.id
      LEFT JOIN users g ON b.guest_id = g.id
      LEFT JOIN users h ON b.host_id = h.id
      WHERE 1=1
    `;
    const countParams: any[] = [];

    if (status && status !== 'all') {
      countQuery += ` AND b.status = ?`;
      countParams.push(status);
    }

    if (search) {
      countQuery += ` AND (p.title LIKE ? OR g.first_name LIKE ? OR g.last_name LIKE ? OR g.email LIKE ? OR h.first_name LIKE ? OR h.last_name LIKE ?)`;
      const searchPattern = `%${search}%`;
      countParams.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    const [countResult] = await pool.execute<RowDataPacket[]>(countQuery, countParams);
    const total = countResult[0]?.total || 0;

    return res.json({
      success: true,
      data: {
        bookings,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          total_pages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    console.error('❌ Error fetching admin bookings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings'
    });
  }
};

/**
 * Cancel booking as admin
 * PUT /api/admin/bookings/:id/cancel
 */
export const cancelBookingAsAdmin = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { cancellation_reason, admin_notes } = req.body;
    const adminId = req.user?.id || req.user?.userId;

    if (!cancellation_reason) {
      return res.status(400).json({
        success: false,
        message: 'Cancellation reason is required'
      });
    }

    // Get booking details
    const [booking] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM bookings WHERE id = ?',
      [id]
    );

    if (!booking.length) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Update booking
    await pool.execute(
      `UPDATE bookings
       SET status = 'cancelled',
           cancellation_reason = ?,
           cancelled_by = 'admin',
           cancelled_by_admin_id = ?,
           cancelled_at = CURRENT_TIMESTAMP,
           admin_notes = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [cancellation_reason, adminId, admin_notes || null, id]
    );

    // Log admin action
    await pool.execute(
      `INSERT INTO admin_actions_log (admin_user_id, action, target_type, target_id, description)
       VALUES (?, 'cancel_booking', 'booking', ?, ?)`,
      [adminId, id, `Cancelled booking #${id}: ${cancellation_reason}`]
    );

    return res.json({
      success: true,
      message: 'Booking cancelled successfully'
    });
  } catch (error) {
    console.error('❌ Error cancelling booking:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to cancel booking'
    });
  }
};

/**
 * Process refund for booking
 * POST /api/admin/bookings/:id/refund
 */
export const processRefund = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { refund_amount, notes } = req.body;
    const adminId = req.user?.id || req.user?.userId;

    if (!refund_amount || refund_amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid refund amount is required'
      });
    }

    // Get booking details
    const [booking] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM bookings WHERE id = ?',
      [id]
    );

    if (!booking.length) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking[0].status !== 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Booking must be cancelled before processing refund'
      });
    }

    // Update booking refund status
    await pool.execute(
      `UPDATE bookings
       SET refund_status = 'completed',
           refund_amount = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [refund_amount, id]
    );

    // Create refund transaction
    await pool.execute(
      `INSERT INTO transactions (booking_id, user_id, transaction_type, amount, status, description, completed_at)
       VALUES (?, ?, 'refund', ?, 'completed', ?, CURRENT_TIMESTAMP)`,
      [id, booking[0].guest_id, refund_amount, notes || 'Admin processed refund']
    );

    // Log admin action
    await pool.execute(
      `INSERT INTO admin_actions_log (admin_user_id, action, target_type, target_id, description)
       VALUES (?, 'process_refund', 'booking', ?, ?)`,
      [adminId, id, `Processed refund of $${refund_amount} for booking #${id}`]
    );

    return res.json({
      success: true,
      message: 'Refund processed successfully'
    });
  } catch (error) {
    console.error('❌ Error processing refund:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process refund'
    });
  }
};

// ============================================================
// REVIEW MODERATION
// ============================================================

/**
 * Get all reviews with moderation filters
 * GET /api/admin/reviews
 */
export const getAdminReviews = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const pool = getPool();
    const {
      flagged,
      admin_action,
      page = '1',
      limit = '20'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    let query = `
      SELECT r.*,
             p.title as property_title,
             reviewer.first_name as reviewer_first_name, reviewer.last_name as reviewer_last_name,
             reviewee.first_name as reviewee_first_name, reviewee.last_name as reviewee_last_name
      FROM reviews r
      LEFT JOIN properties p ON r.property_id = p.id
      LEFT JOIN users reviewer ON r.reviewer_id = reviewer.id
      LEFT JOIN users reviewee ON r.reviewee_id = reviewee.id
      WHERE 1=1
    `;

    const queryParams: any[] = [];

    if (flagged === 'true') {
      query += ` AND r.is_flagged = 1`;
    }

    if (admin_action && admin_action !== 'all') {
      query += ` AND r.admin_action = ?`;
      queryParams.push(admin_action);
    }

    query += ` ORDER BY r.created_at DESC LIMIT ? OFFSET ?`;
    queryParams.push(limitNum, offset);

    const [reviews] = await pool.execute<RowDataPacket[]>(query, queryParams);

    // Get total count
    let countQuery = `SELECT COUNT(*) as total FROM reviews WHERE 1=1`;
    const countParams: any[] = [];

    if (flagged === 'true') {
      countQuery += ` AND is_flagged = 1`;
    }

    if (admin_action && admin_action !== 'all') {
      countQuery += ` AND admin_action = ?`;
      countParams.push(admin_action);
    }

    const [countResult] = await pool.execute<RowDataPacket[]>(countQuery, countParams);
    const total = countResult[0]?.total || 0;

    return res.json({
      success: true,
      data: {
        reviews,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          total_pages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    console.error('❌ Error fetching admin reviews:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch reviews'
    });
  }
};

/**
 * Moderate review
 * PUT /api/admin/reviews/:id/moderate
 */
export const moderateReview = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { admin_action, notes } = req.body;
    const adminId = req.user?.id || req.user?.userId;

    const validActions = ['none', 'approved', 'hidden', 'deleted'];
    if (!validActions.includes(admin_action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid admin action'
      });
    }

    await pool.execute(
      `UPDATE reviews
       SET admin_action = ?,
           moderated_by_user_id = ?,
           moderated_at = CURRENT_TIMESTAMP,
           is_flagged = FALSE
       WHERE id = ?`,
      [admin_action, adminId, id]
    );

    // Log admin action
    await pool.execute(
      `INSERT INTO admin_actions_log (admin_user_id, action, target_type, target_id, description)
       VALUES (?, 'moderate_review', 'review', ?, ?)`,
      [adminId, id, notes || `Set review #${id} action to ${admin_action}`]
    );

    return res.json({
      success: true,
      message: 'Review moderated successfully'
    });
  } catch (error) {
    console.error('❌ Error moderating review:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to moderate review'
    });
  }
};

/**
 * Delete review
 * DELETE /api/admin/reviews/:id
 */
export const deleteReview = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const pool = getPool();
    const { id } = req.params;
    const adminId = req.user?.id || req.user?.userId;

    await pool.execute('DELETE FROM reviews WHERE id = ?', [id]);

    // Log admin action
    await pool.execute(
      `INSERT INTO admin_actions_log (admin_user_id, action, target_type, target_id, description)
       VALUES (?, 'delete_review', 'review', ?, ?)`,
      [adminId, id, `Deleted review #${id}`]
    );

    return res.json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    console.error('❌ Error deleting review:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete review'
    });
  }
};