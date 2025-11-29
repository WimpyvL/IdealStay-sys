import { Request, Response } from 'express';
import { getPool } from '../config/database';
import { PaymentStatus } from '../types';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// Interface for payment update
interface PaymentUpdateData {
  payment_status?: PaymentStatus;
  payment_method?: string;
  payment_reference?: string;
  payment_notes?: string;
}

/**
 * Update booking payment status
 */
export const updatePaymentStatus = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id: bookingId } = req.params;
  const { payment_status, payment_method, payment_reference, payment_notes }: PaymentUpdateData = req.body;
    const userId = req.userId;
    const userRole = req.user?.role;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (
      payment_status === undefined &&
      payment_method === undefined &&
      payment_reference === undefined &&
      payment_notes === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: 'No payment fields provided for update'
      });
    }

    const pool = getPool();

    // Get booking details
    const [bookingRows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM bookings WHERE id = ?',
      [bookingId]
    );

    if (bookingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const booking = bookingRows[0];

    // Check permissions - only admin, host, or guest can update payment status
    const canUpdate = userRole === 'admin' || 
                     booking.host_id === userId || 
                     booking.guest_id === userId;

    if (!canUpdate) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update payment status'
      });
    }

    // Validate payment status transitions when status change is requested
    const currentPaymentStatus = booking.payment_status as PaymentStatus;
    const statusProvided = payment_status !== undefined && payment_status !== null;
    const validStatuses: PaymentStatus[] = ['pending', 'paid', 'failed', 'refunded', 'partial'];

    if (statusProvided) {
      if (!validStatuses.includes(payment_status as PaymentStatus)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid payment status'
        });
      }

      const validTransitions: Record<PaymentStatus, PaymentStatus[]> = {
        pending: ['paid', 'failed', 'partial'],
        partial: ['paid', 'failed', 'refunded'],
        paid: ['refunded', 'partial'],
        failed: ['paid', 'partial', 'pending'],
        refunded: []
      };

      if (currentPaymentStatus === 'refunded' && userRole !== 'admin' && payment_status !== currentPaymentStatus) {
        return res.status(400).json({
          success: false,
          message: 'Only administrators can modify refunded payments'
        });
      }

      if (
        payment_status !== currentPaymentStatus &&
        !validTransitions[currentPaymentStatus]?.includes(payment_status as PaymentStatus)
      ) {
        return res.status(400).json({
          success: false,
          message: `Cannot change payment status from ${currentPaymentStatus} to ${payment_status}`
        });
      }
    }

    // Build update query
    const updateFields = ['updated_at = CURRENT_TIMESTAMP'];
    const updateValues: any[] = [];

    if (statusProvided && payment_status !== currentPaymentStatus) {
      updateFields.push('payment_status = ?');
      updateValues.push(payment_status);
    }

    if (payment_method !== undefined) {
      updateFields.push('payment_method = ?');
      updateValues.push(payment_method);
    }

    if (payment_reference !== undefined) {
      updateFields.push('payment_reference = ?');
      updateValues.push(payment_reference);
    }

    updateValues.push(bookingId);

    // Update payment status
    await pool.execute(
      `UPDATE bookings SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    const newPaymentStatus: PaymentStatus = statusProvided ? (payment_status as PaymentStatus) : currentPaymentStatus;
    const statusChanged = statusProvided && payment_status !== currentPaymentStatus;

    // Create payment history record
    await pool.execute(
      `INSERT INTO payment_history (booking_id, previous_status, new_status, payment_method, 
                                    payment_reference, updated_by, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        bookingId,
        currentPaymentStatus,
        newPaymentStatus,
        payment_method || null,
        payment_reference || null,
        userId,
        payment_notes || null
      ]
    );

    // If payment is confirmed, automatically confirm booking if it's still pending
    if (newPaymentStatus === 'paid' && booking.status === 'pending') {
      await pool.execute(
        'UPDATE bookings SET status = "confirmed", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [bookingId]
      );
    }

    // Fetch updated booking
    const [updatedBooking] = await pool.execute<RowDataPacket[]>(
      `SELECT b.*, p.title as property_title, g.first_name as guest_name, g.email as guest_email
       FROM bookings b
       LEFT JOIN properties p ON b.property_id = p.id
       LEFT JOIN users g ON b.guest_id = g.id
       WHERE b.id = ?`,
      [bookingId]
    );

    return res.json({
      success: true,
      message: statusChanged
        ? `Payment status updated to ${newPaymentStatus}`
        : 'Payment details updated',
      data: {
        booking: updatedBooking[0],
        payment_updated: true,
        status_changed: statusChanged,
        auto_confirmed: newPaymentStatus === 'paid' && booking.status === 'pending'
      }
    });

  } catch (error) {
    console.error('❌ Error updating payment status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update payment status',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

/**
 * Get payment history for a booking
 */
export const getPaymentHistory = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id: bookingId } = req.params;
    const userId = req.userId;
    const userRole = req.user?.role;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const pool = getPool();

    // Check if booking exists and user has permission
    const [bookingRows] = await pool.execute<RowDataPacket[]>(
      'SELECT guest_id, host_id FROM bookings WHERE id = ?',
      [bookingId]
    );

    if (bookingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const booking = bookingRows[0];
    const canView = userRole === 'admin' || 
                   booking.guest_id === userId || 
                   booking.host_id === userId;

    if (!canView) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view payment history'
      });
    }

    // Get payment history
    const [historyRows] = await pool.execute<RowDataPacket[]>(
      `SELECT ph.*, u.first_name, u.last_name, u.role as updated_by_role
       FROM payment_history ph
       LEFT JOIN users u ON ph.updated_by = u.id
       WHERE ph.booking_id = ?
       ORDER BY ph.created_at DESC`,
      [bookingId]
    );

    return res.json({
      success: true,
      data: {
        booking_id: bookingId,
        payment_history: historyRows,
        total_records: historyRows.length
      }
    });

  } catch (error) {
    console.error('❌ Error fetching payment history:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch payment history',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

/**
 * Process refund (admin only)
 */
export const processRefund = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id: bookingId } = req.params;
    const { refund_amount, refund_reason, refund_method = 'original_payment' } = req.body;
    const userId = req.userId;
    const userRole = req.user?.role;

    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can process refunds'
      });
    }

    if (!refund_amount || refund_amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid refund amount is required'
      });
    }

    const pool = getPool();

    // Get booking details
    const [bookingRows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM bookings WHERE id = ?',
      [bookingId]
    );

    if (bookingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const booking = bookingRows[0];

    // Validate refund conditions
    if (booking.payment_status === 'refunded') {
      return res.status(400).json({
        success: false,
        message: 'Booking has already been refunded'
      });
    }

    if (booking.payment_status !== 'paid' && booking.payment_status !== 'partial') {
      return res.status(400).json({
        success: false,
        message: 'Can only refund paid or partially paid bookings'
      });
    }

    if (refund_amount > booking.total_amount) {
      return res.status(400).json({
        success: false,
        message: 'Refund amount cannot exceed booking total'
      });
    }

    // Determine new payment status
    const isFullRefund = refund_amount >= booking.total_amount;
    const newPaymentStatus: PaymentStatus = isFullRefund ? 'refunded' : 'partial';

    // Process refund
    await pool.execute(
      `UPDATE bookings SET 
         payment_status = ?,
         status = CASE WHEN ? = 'refunded' THEN 'refunded' ELSE status END,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [newPaymentStatus, newPaymentStatus, bookingId]
    );

    // Create refund record
    await pool.execute(
      `INSERT INTO refunds (booking_id, refund_amount, refund_reason, refund_method, 
                            processed_by, processed_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [bookingId, refund_amount, refund_reason || null, refund_method, userId]
    );

    // Add to payment history
    await pool.execute(
      `INSERT INTO payment_history (booking_id, previous_status, new_status, 
                                    updated_by, notes, created_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        bookingId,
        booking.payment_status,
        newPaymentStatus,
        userId,
        `Refund processed: $${refund_amount}. Reason: ${refund_reason || 'N/A'}`
      ]
    );

    // Fetch updated booking
    const [updatedBooking] = await pool.execute<RowDataPacket[]>(
      `SELECT b.*, p.title as property_title, g.first_name as guest_name, 
              g.email as guest_email, g.phone as guest_phone
       FROM bookings b
       LEFT JOIN properties p ON b.property_id = p.id
       LEFT JOIN users g ON b.guest_id = g.id
       WHERE b.id = ?`,
      [bookingId]
    );

    return res.json({
      success: true,
      message: `${isFullRefund ? 'Full' : 'Partial'} refund processed successfully`,
      data: {
        booking: updatedBooking[0],
        refund: {
          amount: refund_amount,
          type: isFullRefund ? 'full' : 'partial',
          method: refund_method,
          processed_at: new Date().toISOString()
        }
      }
    });

  } catch (error) {
    console.error('❌ Error processing refund:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process refund',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

/**
 * Get booking financial summary (admin and involved parties only)
 */
export const getBookingFinancials = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id: bookingId } = req.params;
    const userId = req.userId;
    const userRole = req.user?.role;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const pool = getPool();

    // Check permissions
    const [bookingRows] = await pool.execute<RowDataPacket[]>(
      'SELECT guest_id, host_id, * FROM bookings WHERE id = ?',
      [bookingId]
    );

    if (bookingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const booking = bookingRows[0];
    const canView = userRole === 'admin' || 
                   booking.guest_id === userId || 
                   booking.host_id === userId;

    if (!canView) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view financial information'
      });
    }

    // Get refund history if any
    const [refundRows] = await pool.execute<RowDataPacket[]>(
      `SELECT r.*, u.first_name, u.last_name
       FROM refunds r
       LEFT JOIN users u ON r.processed_by = u.id
       WHERE r.booking_id = ?
       ORDER BY r.processed_at DESC`,
      [bookingId]
    );

    // Calculate financial summary
    const totalRefunded = refundRows.reduce((sum: number, refund: any) => sum + refund.refund_amount, 0);
    const netAmount = booking.total_amount - totalRefunded;
    
    // Platform fee calculation (example: 3% of base price)
    const platformFeeRate = 0.03;
    const platformFee = booking.base_price * platformFeeRate;
    const hostPayout = booking.base_price - platformFee;

    return res.json({
      success: true,
      data: {
        booking_id: bookingId,
        financial_summary: {
          base_price: booking.base_price,
          cleaning_fee: booking.cleaning_fee,
          security_deposit: booking.security_deposit,
          taxes: booking.taxes,
          total_amount: booking.total_amount,
          total_refunded: totalRefunded,
          net_amount: netAmount,
          platform_fee: Math.round(platformFee * 100) / 100,
          host_payout: Math.round(hostPayout * 100) / 100
        },
        payment_info: {
          status: booking.payment_status,
          method: booking.payment_method,
          reference: booking.payment_reference
        },
        refunds: refundRows,
        calculated_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error fetching booking financials:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch booking financials',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};