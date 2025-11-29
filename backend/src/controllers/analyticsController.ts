import { Request, Response } from 'express';
import { RowDataPacket } from 'mysql2';
import { getPool } from '../config/database';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: number;
    email: string;
    role: string;
  };
}

// Get host dashboard statistics
export const getHostStats = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const pool = getPool();
  const hostId = (req.user as any)?.id || (req as any).userId;

    if (!hostId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized - No user ID found'
      });
    }

    // Get host's total properties
    const [propertiesResult] = await pool.execute<RowDataPacket[]>(
      'SELECT COUNT(*) as total_properties FROM properties WHERE host_id = ? AND status != ?',
      [hostId, 'deleted']
    );
    
    // Get host's total bookings
    const [bookingsResult] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as total_bookings 
       FROM bookings b 
       JOIN properties p ON b.property_id = p.id 
       WHERE p.host_id = ?`,
      [hostId]
    );

    // Get total revenue (confirmed bookings only)
    const [revenueResult] = await pool.execute<RowDataPacket[]>(
      `SELECT COALESCE(SUM(b.total_amount), 0) as total_revenue
       FROM bookings b 
       JOIN properties p ON b.property_id = p.id 
       WHERE p.host_id = ? AND b.status IN ('confirmed', 'completed')`,
      [hostId]
    );

    // Get current month revenue
    const [monthlyRevenueResult] = await pool.execute<RowDataPacket[]>(
      `SELECT COALESCE(SUM(b.total_amount), 0) as monthly_revenue
       FROM bookings b 
       JOIN properties p ON b.property_id = p.id 
       WHERE p.host_id = ? 
       AND b.status IN ('confirmed', 'completed')
       AND MONTH(b.created_at) = MONTH(CURRENT_DATE()) 
       AND YEAR(b.created_at) = YEAR(CURRENT_DATE())`,
      [hostId]
    );

    // Get average rating for host's properties
    const [ratingResult] = await pool.execute<RowDataPacket[]>(
      `SELECT AVG(r.rating) as avg_rating, COUNT(r.id) as total_reviews
       FROM reviews r 
       JOIN properties p ON r.property_id = p.id 
       WHERE p.host_id = ?`,
      [hostId]
    );

    return res.json({
      success: true,
      data: {
        total_properties: propertiesResult[0]?.total_properties || 0,
        total_bookings: bookingsResult[0]?.total_bookings || 0,
        total_revenue: parseFloat(revenueResult[0]?.total_revenue) || 0,
        monthly_revenue: parseFloat(monthlyRevenueResult[0]?.monthly_revenue) || 0,
        avg_rating: parseFloat(ratingResult[0]?.avg_rating) || 0,
        total_reviews: ratingResult[0]?.total_reviews || 0
      }
    });

  } catch (error) {
    console.error('❌ Error fetching host stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch host statistics',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

// Get host's recent activity (bookings, reviews, messages)
export const getHostActivity = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const pool = getPool();
  const hostId = (req.user as any)?.id || (req as any).userId;
    const limit = parseInt(req.query.limit as string) || 10;

    if (!hostId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized - No user ID found'
      });
    }

    // Get recent bookings
    const [recentBookings] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        b.id, b.status, b.check_in_date, b.check_out_date, b.total_amount, b.created_at,
        p.title as property_title,
        u.first_name, u.last_name, u.email
       FROM bookings b
       JOIN properties p ON b.property_id = p.id
       JOIN users u ON b.guest_id = u.id
       WHERE p.host_id = ?
       ORDER BY b.created_at DESC
       LIMIT ?`,
      [hostId, limit]
    );

    // Get recent property reviews (guests reviewing host's properties)
    // NOTE: reviews table uses reviewer_id (the guest) and review_type to distinguish context
    const [recentReviews] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        r.id, r.rating, r.comment, r.created_at,
        p.title as property_title,
        u.first_name, u.last_name
       FROM reviews r
       JOIN properties p ON r.property_id = p.id
       JOIN users u ON r.reviewer_id = u.id
       WHERE p.host_id = ?
         AND r.review_type = 'property'
       ORDER BY r.created_at DESC
       LIMIT ?`,
      [hostId, limit]
    );

    // Combine and format activities
    const activities = [
      ...recentBookings.map(booking => ({
        id: `booking-${booking.id}`,
        type: 'booking' as const,
        title: `New booking for ${booking.property_title}`,
        description: `${booking.first_name} ${booking.last_name} booked from ${new Date(booking.check_in_date).toLocaleDateString()} to ${new Date(booking.check_out_date).toLocaleDateString()}`,
        timestamp: booking.created_at,
        status: booking.status,
        amount: booking.total_amount
      })),
      ...recentReviews.map(review => ({
        id: `review-${review.id}`,
        type: 'review' as const,
        title: `New review for ${review.property_title}`,
        description: review.comment || `${review.first_name} ${review.last_name} left a ${review.rating}-star review`,
        timestamp: review.created_at,
        rating: review.rating
      }))
    ];

    // Sort by timestamp
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return res.json({
      success: true,
      data: activities.slice(0, limit)
    });

  } catch (error) {
    console.error('❌ Error fetching host activity:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch host activity',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

// Get host's financial data for charts
export const getHostFinancials = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const pool = getPool();
  const hostId = (req.user as any)?.id || (req as any).userId;
    const period = (req.query.period as string) || 'monthly'; // monthly, weekly, yearly

    if (!hostId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized - No user ID found'
      });
    }

    let dateFormat: string;
    let dateInterval: string;
    
    switch (period) {
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

    // Financial aggregation (past 12 periods based on chosen interval)
    // Using bookings.host_id (denormalized) – no need to join properties for host filtering
    const [financialData] = await pool.execute<RowDataPacket[]>(
      `SELECT 
         DATE_FORMAT(b.created_at, ?) as period,
         COALESCE(SUM(CASE WHEN b.status IN ('confirmed','completed') THEN b.total_amount ELSE 0 END),0) as revenue,
         COUNT(CASE WHEN b.status IN ('confirmed','completed') THEN 1 END) as bookings_count,
         0 as expenses
       FROM bookings b
       WHERE b.host_id = ?
         AND b.created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 12 ${dateInterval})
       GROUP BY period
       ORDER BY period`,
      [dateFormat, hostId]
    );

    const formatted = financialData.map(row => ({
      period: row.period,
      revenue: parseFloat(row.revenue) || 0,
      expenses: parseFloat(row.expenses) || 0,
      net_profit: parseFloat(row.revenue) || 0,
      bookings_count: row.bookings_count || 0
    }));

    return res.json({ success: true, data: formatted });

  } catch (error) {
    console.error('❌ Error fetching host financials:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch host financials',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

// Get admin dashboard statistics
export const getAdminStats = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const pool = getPool();

    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied - Admin role required'
      });
    }

    // Get total users
    const [usersResult] = await pool.execute<RowDataPacket[]>(
      'SELECT COUNT(*) as total_users FROM users'
    );

    // Get total properties
    const [propertiesResult] = await pool.execute<RowDataPacket[]>(
      'SELECT COUNT(*) as total_properties FROM properties WHERE status != ?',
      ['deleted']
    );

    // Get total bookings
    const [bookingsResult] = await pool.execute<RowDataPacket[]>(
      'SELECT COUNT(*) as total_bookings FROM bookings'
    );

    // Get total revenue
    const [revenueResult] = await pool.execute<RowDataPacket[]>(
      'SELECT COALESCE(SUM(total_amount), 0) as total_revenue FROM bookings WHERE status IN (?, ?)',
      ['confirmed', 'completed']
    );

    // Get pending properties for approval
    const [pendingResult] = await pool.execute<RowDataPacket[]>(
      'SELECT COUNT(*) as pending_properties FROM properties WHERE status = ?',
      ['pending']
    );

    // Get monthly growth stats
    const [monthlyGrowth] = await pool.execute<RowDataPacket[]>(
      `SELECT
        COUNT(CASE WHEN MONTH(created_at) = MONTH(CURRENT_DATE()) AND YEAR(created_at) = YEAR(CURRENT_DATE()) THEN 1 END) as new_users_this_month,
        COUNT(CASE WHEN MONTH(created_at) = MONTH(CURRENT_DATE() - INTERVAL 1 MONTH) AND YEAR(created_at) = YEAR(CURRENT_DATE() - INTERVAL 1 MONTH) THEN 1 END) as new_users_last_month
       FROM users`
    );

    const currentMonth = monthlyGrowth[0]?.new_users_this_month || 0;
    const lastMonth = monthlyGrowth[0]?.new_users_last_month || 0;
    const userGrowthRate = lastMonth > 0 ? ((currentMonth - lastMonth) / lastMonth * 100) : 0;

    return res.json({
      success: true,
      data: {
        total_users: usersResult[0]?.total_users || 0,
        total_properties: propertiesResult[0]?.total_properties || 0,
        total_bookings: bookingsResult[0]?.total_bookings || 0,
        total_revenue: parseFloat(revenueResult[0]?.total_revenue) || 0,
        pending_properties: pendingResult[0]?.pending_properties || 0,
        user_growth_rate: Math.round(userGrowthRate * 100) / 100,
        new_users_this_month: currentMonth,
        new_users_last_month: lastMonth
      }
    });

  } catch (error) {
    console.error('❌ Error fetching admin stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch admin statistics',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

// Get all users for admin management
export const getAllUsers = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const pool = getPool();

    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied - Admin role required'
      });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search as string;

    let query = `
      SELECT
        id, email, first_name, last_name, phone, role,
        is_verified, is_active, is_host, host_approved,
        created_at, updated_at
      FROM users
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search) {
      query += ` AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [users] = await pool.execute<RowDataPacket[]>(query, params);

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM users WHERE 1=1';
    const countParams: any[] = [];

    if (search) {
      countQuery += ` AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ?)`;
      countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const [countResult] = await pool.execute<RowDataPacket[]>(countQuery, countParams);
    const total = countResult[0]?.total || 0;

    return res.json({
      success: true,
      data: {
        users: users.map(user => ({
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          phone: user.phone,
          role: user.role,
          status: user.is_active ? 'active' : 'inactive',
          email_verified: user.is_verified,
          is_host: Boolean(user.is_host),
          host_approved: Boolean(user.host_approved),
          created_at: user.created_at,
          updated_at: user.updated_at
        })),
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching users:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

// Update user status (admin only)
export const updateUserStatus = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const pool = getPool();
    const { userId } = req.params;
    const { status } = req.body;

    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied - Admin role required'
      });
    }

    // Validate status
    const validStatuses = ['active', 'inactive', 'suspended'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be one of: active, inactive, suspended'
      });
    }

    // Map status to is_active boolean
    // 'active' -> is_active = 1
    // 'inactive' or 'suspended' -> is_active = 0
    const isActive = status === 'active' ? 1 : 0;

    // Update user status
    await pool.execute(
      'UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [isActive, userId]
    );

    return res.json({
      success: true,
      data: { message: 'User status updated successfully' },
      message: 'User status updated successfully'
    });

  } catch (error) {
    console.error('❌ Error updating user status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update user status',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

// Approve user as host (admin only)
export const approveHost = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const pool = getPool();
    const { userId } = req.params;
    const { admin_notes } = req.body;
    const adminId = req.user?.userId;

    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied - Admin role required'
      });
    }

    // Check if user exists
    const [users] = await pool.execute<RowDataPacket[]>(
      'SELECT id, first_name, last_name, email, is_host, host_approved FROM users WHERE id = ?',
      [userId]
    );

    if (!users.length) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = users[0];

    // Update user to approve as host
    await pool.execute(
      `UPDATE users
       SET is_host = 1,
           host_approved = 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [userId]
    );

    // Log admin action in admin_actions_log table (if it exists)
    try {
      await pool.execute(
        `INSERT INTO admin_actions_log (admin_user_id, action, target_type, target_id, description)
         VALUES (?, 'approve_host', 'user', ?, ?)`,
        [adminId, userId, admin_notes || `Approved ${user.first_name} ${user.last_name} as host`]
      );
    } catch (logError) {
      // Log table might not exist, continue anyway
      console.warn('⚠️ Could not log admin action:', logError);
    }

    return res.json({
      success: true,
      data: { message: 'Host approved successfully' },
      message: 'Host approved successfully'
    });

  } catch (error) {
    console.error('❌ Error approving host:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to approve host',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};