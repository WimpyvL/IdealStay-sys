/**
 * Admin Financial Controller
 * Handles admin financial operations, transactions, and payouts
 */

import { Request, Response } from 'express';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { getPool } from '../config/database';

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    userId: number;
    email: string;
    role: string;
  };
}

// ============================================================
// REVENUE ANALYTICS
// ============================================================

/**
 * Get revenue analytics
 * GET /api/admin/analytics/revenue
 */
export const getRevenueAnalytics = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const pool = getPool();
    const { period = 'monthly', start_date, end_date } = req.query;

    let dateFormat: string;
    let dateInterval: string;

    switch (period) {
      case 'daily':
        dateFormat = '%Y-%m-%d';
        dateInterval = 'DAY';
        break;
      case 'weekly':
        dateFormat = '%Y-%u';
        dateInterval = 'WEEK';
        break;
      case 'yearly':
        dateFormat = '%Y';
        dateInterval = 'YEAR';
        break;
      default:
        dateFormat = '%Y-%m';
        dateInterval = 'MONTH';
    }

    // Revenue breakdown by period
    const [revenueData] = await pool.execute<RowDataPacket[]>(
      `SELECT
         DATE_FORMAT(b.created_at, ?) as period,
         COUNT(*) as bookings_count,
         COALESCE(SUM(CASE WHEN b.status IN ('confirmed','completed') THEN b.total_amount ELSE 0 END), 0) as total_revenue,
         COALESCE(SUM(CASE WHEN b.status IN ('confirmed','completed') THEN b.base_price ELSE 0 END), 0) as base_revenue,
         COALESCE(SUM(CASE WHEN b.status IN ('confirmed','completed') THEN b.cleaning_fee ELSE 0 END), 0) as cleaning_fees,
         COALESCE(SUM(CASE WHEN b.status IN ('confirmed','completed') THEN b.taxes ELSE 0 END), 0) as taxes_collected,
         COALESCE(SUM(CASE WHEN b.status = 'cancelled' THEN b.total_amount ELSE 0 END), 0) as cancelled_revenue
       FROM bookings b
       WHERE b.created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 12 ${dateInterval})
       ${start_date ? 'AND b.created_at >= ?' : ''}
       ${end_date ? 'AND b.created_at <= ?' : ''}
       GROUP BY period
       ORDER BY period`,
      [dateFormat, ...(start_date ? [start_date] : []), ...(end_date ? [end_date] : [])]
    );

    // Revenue by property type
    const [revenueByType] = await pool.execute<RowDataPacket[]>(
      `SELECT
         p.property_type,
         COUNT(b.id) as bookings_count,
         COALESCE(SUM(CASE WHEN b.status IN ('confirmed','completed') THEN b.total_amount ELSE 0 END), 0) as revenue
       FROM bookings b
       JOIN properties p ON b.property_id = p.id
       WHERE b.status IN ('confirmed','completed')
       GROUP BY p.property_type
       ORDER BY revenue DESC`
    );

    // Revenue by location
    const [revenueByLocation] = await pool.execute<RowDataPacket[]>(
      `SELECT
         p.city,
         p.country,
         COUNT(b.id) as bookings_count,
         COALESCE(SUM(CASE WHEN b.status IN ('confirmed','completed') THEN b.total_amount ELSE 0 END), 0) as revenue
       FROM bookings b
       JOIN properties p ON b.property_id = p.id
       WHERE b.status IN ('confirmed','completed')
       GROUP BY p.city, p.country
       ORDER BY revenue DESC
       LIMIT 10`
    );

    // Overall statistics
    const [overallStats] = await pool.execute<RowDataPacket[]>(
      `SELECT
         COUNT(*) as total_bookings,
         COALESCE(SUM(CASE WHEN status IN ('confirmed','completed') THEN total_amount ELSE 0 END), 0) as total_revenue,
         COALESCE(AVG(CASE WHEN status IN ('confirmed','completed') THEN total_amount ELSE NULL END), 0) as avg_booking_value
       FROM bookings`
    );

    return res.json({
      success: true,
      data: {
        revenue_over_time: revenueData,
        revenue_by_property_type: revenueByType,
        revenue_by_location: revenueByLocation,
        overall_stats: overallStats[0]
      }
    });
  } catch (error) {
    console.error('❌ Error fetching revenue analytics:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch revenue analytics'
    });
  }
};

// ============================================================
// TRANSACTIONS
// ============================================================

/**
 * Get all transactions
 * GET /api/admin/transactions
 */
export const getTransactions = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const pool = getPool();
    const {
      transaction_type,
      status,
      page = '1',
      limit = '20'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    let query = `
      SELECT t.*,
             u.first_name, u.last_name, u.email,
             b.id as booking_id, p.title as property_title
      FROM transactions t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN bookings b ON t.booking_id = b.id
      LEFT JOIN properties p ON b.property_id = p.id
      WHERE 1=1
    `;

    const queryParams: any[] = [];

    if (transaction_type && transaction_type !== 'all') {
      query += ` AND t.transaction_type = ?`;
      queryParams.push(transaction_type);
    }

    if (status && status !== 'all') {
      query += ` AND t.status = ?`;
      queryParams.push(status);
    }

    query += ` ORDER BY t.created_at DESC LIMIT ? OFFSET ?`;
    queryParams.push(limitNum, offset);

    const [transactions] = await pool.execute<RowDataPacket[]>(query, queryParams);

    // Get total count
    let countQuery = `SELECT COUNT(*) as total FROM transactions WHERE 1=1`;
    const countParams: any[] = [];

    if (transaction_type && transaction_type !== 'all') {
      countQuery += ` AND transaction_type = ?`;
      countParams.push(transaction_type);
    }

    if (status && status !== 'all') {
      countQuery += ` AND status = ?`;
      countParams.push(status);
    }

    const [countResult] = await pool.execute<RowDataPacket[]>(countQuery, countParams);
    const total = countResult[0]?.total || 0;

    return res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          total_pages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    console.error('❌ Error fetching transactions:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions'
    });
  }
};

// ============================================================
// HOST PAYOUTS
// ============================================================

/**
 * Get all host payouts
 * GET /api/admin/payouts
 */
export const getPayouts = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const pool = getPool();
    const {
      status,
      host_id,
      page = '1',
      limit = '20'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    let query = `
      SELECT hp.*,
             u.first_name, u.last_name, u.email
      FROM host_payouts hp
      LEFT JOIN users u ON hp.host_id = u.id
      WHERE 1=1
    `;

    const queryParams: any[] = [];

    if (status && status !== 'all') {
      query += ` AND hp.status = ?`;
      queryParams.push(status);
    }

    if (host_id) {
      query += ` AND hp.host_id = ?`;
      queryParams.push(host_id);
    }

    query += ` ORDER BY hp.created_at DESC LIMIT ? OFFSET ?`;
    queryParams.push(limitNum, offset);

    const [payouts] = await pool.execute<RowDataPacket[]>(query, queryParams);

    // Get total count
    let countQuery = `SELECT COUNT(*) as total FROM host_payouts WHERE 1=1`;
    const countParams: any[] = [];

    if (status && status !== 'all') {
      countQuery += ` AND status = ?`;
      countParams.push(status);
    }

    if (host_id) {
      countQuery += ` AND host_id = ?`;
      countParams.push(host_id);
    }

    const [countResult] = await pool.execute<RowDataPacket[]>(countQuery, countParams);
    const total = countResult[0]?.total || 0;

    return res.json({
      success: true,
      data: {
        payouts,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          total_pages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    console.error('❌ Error fetching payouts:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch payouts'
    });
  }
};

/**
 * Process payout
 * POST /api/admin/payouts/:id/process
 */
export const processPayout = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { payout_method, payout_reference, admin_notes } = req.body;
    const adminId = req.user?.id || req.user?.userId;

    // Get payout details
    const [payout] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM host_payouts WHERE id = ?',
      [id]
    );

    if (!payout.length) {
      return res.status(404).json({
        success: false,
        message: 'Payout not found'
      });
    }

    if (payout[0].status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Payout has already been processed'
      });
    }

    // Update payout status
    await pool.execute(
      `UPDATE host_payouts
       SET status = 'completed',
           payout_method = ?,
           payout_reference = ?,
           admin_notes = ?,
           processed_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [payout_method, payout_reference || null, admin_notes || null, id]
    );

    // Create payout transaction
    await pool.execute(
      `INSERT INTO transactions (user_id, transaction_type, amount, status, description, completed_at)
       VALUES (?, 'payout', ?, 'completed', ?, CURRENT_TIMESTAMP)`,
      [payout[0].host_id, payout[0].amount, `Payout for period ${payout[0].period_start} to ${payout[0].period_end}`]
    );

    // Log admin action
    await pool.execute(
      `INSERT INTO admin_actions_log (admin_user_id, action, target_type, target_id, description)
       VALUES (?, 'process_payout', 'payout', ?, ?)`,
      [adminId, id, `Processed payout of $${payout[0].amount} for host #${payout[0].host_id}`]
    );

    return res.json({
      success: true,
      message: 'Payout processed successfully'
    });
  } catch (error) {
    console.error('❌ Error processing payout:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process payout'
    });
  }
};

/**
 * Create payout for host
 * POST /api/admin/payouts
 */
export const createPayout = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const pool = getPool();
    const { host_id, period_start, period_end, bookings_included } = req.body;

    if (!host_id || !period_start || !period_end) {
      return res.status(400).json({
        success: false,
        message: 'Host ID, period start, and period end are required'
      });
    }

    // Calculate total payout amount from bookings in the period
    const [bookings] = await pool.execute<RowDataPacket[]>(
      `SELECT
         b.id, b.total_amount, b.base_price,
         p.title as property_title
       FROM bookings b
       JOIN properties p ON b.property_id = p.id
       WHERE b.host_id = ?
         AND b.status IN ('confirmed', 'completed')
         AND b.check_out_date >= ?
         AND b.check_out_date <= ?`,
      [host_id, period_start, period_end]
    );

    if (!bookings.length) {
      return res.status(400).json({
        success: false,
        message: 'No completed bookings found for this period'
      });
    }

    // Calculate total (assuming 85% goes to host, 15% platform fee)
    const totalRevenue = bookings.reduce((sum: number, b: any) => sum + parseFloat(b.total_amount), 0);
    const payoutAmount = totalRevenue * 0.85; // 15% platform commission

    // Create payout record
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO host_payouts (host_id, amount, status, period_start, period_end, bookings_included)
       VALUES (?, ?, 'pending', ?, ?, ?)`,
      [host_id, payoutAmount.toFixed(2), period_start, period_end, JSON.stringify(bookings.map((b: any) => b.id))]
    );

    return res.json({
      success: true,
      message: 'Payout created successfully',
      data: {
        payout_id: result.insertId,
        amount: payoutAmount.toFixed(2),
        bookings_count: bookings.length
      }
    });
  } catch (error) {
    console.error('❌ Error creating payout:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create payout'
    });
  }
};