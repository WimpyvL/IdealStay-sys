import { Request, Response } from 'express';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { getPool } from '../config/database';

/**
 * Create a review for a completed booking (guest -> host/property)
 * POST /api/v1/bookings/:id/review
 * Body: { rating: number (1-5), comment?: string, title?: string }
 */
export const createBookingReview = async (req: Request, res: Response): Promise<Response> => {
  try {
    const bookingId = parseInt(req.params.id, 10);
    const userId = req.userId; // reviewer (guest)
    const { rating, comment, title } = req.body || {};

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    // Basic validation
    if (!bookingId || Number.isNaN(bookingId)) {
      return res.status(400).json({ success: false, message: 'Invalid booking id' });
    }
    if (rating === undefined) {
      return res.status(400).json({ success: false, message: 'Rating is required' });
    }
    const numericRating = Number(rating);
    if (Number.isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
    }

    const pool = getPool();

    // Fetch booking to verify permissions & status
    const [bookingRows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, guest_id, host_id, property_id, status FROM bookings WHERE id = ?`,
      [bookingId]
    );

    if (bookingRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    const booking = bookingRows[0];

    // Only the guest who completed the booking can review (later can extend for host->guest reviews)
    if (booking.guest_id !== userId) {
      return res.status(403).json({ success: false, message: 'You are not allowed to review this booking' });
    }
    if (booking.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'You can only review completed bookings' });
    }

    // Ensure review does not already exist (unique constraint will also protect)
    const [existing] = await pool.execute<RowDataPacket[]>(
      `SELECT id FROM reviews WHERE booking_id = ? AND reviewer_id = ?`,
      [bookingId, userId]
    );
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'You have already reviewed this booking' });
    }

    // Insert review (guest reviewing host's property -> review_type 'property')
    const [insertResult] = await pool.execute<ResultSetHeader>(
      `INSERT INTO reviews (booking_id, property_id, reviewer_id, reviewee_id, rating, title, comment, review_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'property')`,
      [
        bookingId,
        booking.property_id,
        userId,
        booking.host_id, // reviewee is host for property review context
        numericRating,
        title || null,
        comment || null
      ]
    );

    // Recalculate host rating & total reviews (property reviews only for now)
    try {
      const [agg] = await pool.execute<RowDataPacket[]>(
        `SELECT AVG(rating) as avg_rating, COUNT(*) as total
         FROM reviews
         WHERE reviewee_id = ? AND review_type = 'property'`,
        [booking.host_id]
      );
      const avg = Number(agg[0]?.avg_rating) || 0;
      const total = Number(agg[0]?.total) || 0;
      await pool.execute(
        `UPDATE users SET host_rating = ?, host_total_reviews = ? WHERE id = ?`,
        [avg, total, booking.host_id]
      );
    } catch (ratingErr) {
      console.error('⚠️ Failed to update host rating after review:', ratingErr);
    }

    // Recalculate property rating & total reviews
    try {
      const [propAgg] = await pool.execute<RowDataPacket[]>(
        `SELECT AVG(rating) as avg_rating, COUNT(*) as total
         FROM reviews
         WHERE property_id = ? AND review_type = 'property'`,
        [booking.property_id]
      );
      const propAvg = Number(propAgg[0]?.avg_rating) || 0;
      const propTotal = Number(propAgg[0]?.total) || 0;
      await pool.execute(
        `UPDATE properties SET average_rating = ?, total_reviews = ? WHERE id = ?`,
        [propAvg, propTotal, booking.property_id]
      );
    } catch (propRatingErr) {
      console.error('⚠️ Failed to update property rating after review:', propRatingErr);
    }

    // Fetch created review with reviewer info
    const [reviewRows] = await pool.execute<RowDataPacket[]>(
      `SELECT r.*, u.first_name as reviewer_first_name, u.last_name as reviewer_last_name, u.profile_image_url as reviewer_image
       FROM reviews r
       LEFT JOIN users u ON r.reviewer_id = u.id
       WHERE r.id = ?`,
      [insertResult.insertId]
    );

    return res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      data: reviewRows[0]
    });
  } catch (error) {
    console.error('❌ Error creating review:', error);
    // Duplicate unique constraint fallback
    if ((error as any)?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'You have already reviewed this booking' });
    }
    return res.status(500).json({ success: false, message: 'Failed to submit review' });
  }
};

/**
 * Recalculate all property and host ratings from existing reviews
 * POST /api/v1/reviews/recalculate-ratings (admin only)
 */
export const recalculateAllRatings = async (req: Request, res: Response): Promise<Response> => {
  try {
    const pool = getPool();

    // Recalculate property ratings
    await pool.execute(`
      UPDATE properties p
      SET
        average_rating = (
          SELECT COALESCE(AVG(r.rating), 0.00)
          FROM reviews r
          WHERE r.property_id = p.id AND r.review_type = 'property'
        ),
        total_reviews = (
          SELECT COUNT(*)
          FROM reviews r
          WHERE r.property_id = p.id AND r.review_type = 'property'
        )
    `);

    // Recalculate host ratings
    await pool.execute(`
      UPDATE users u
      SET
        host_rating = (
          SELECT COALESCE(AVG(r.rating), 0.00)
          FROM reviews r
          WHERE r.reviewee_id = u.id AND r.review_type = 'property'
        ),
        host_total_reviews = (
          SELECT COUNT(*)
          FROM reviews r
          WHERE r.reviewee_id = u.id AND r.review_type = 'property'
        )
      WHERE u.role IN ('host', 'admin')
    `);

    return res.status(200).json({
      success: true,
      message: 'All ratings recalculated successfully'
    });
  } catch (error) {
    console.error('❌ Error recalculating ratings:', error);
    return res.status(500).json({ success: false, message: 'Failed to recalculate ratings' });
  }
};

export default {
  createBookingReview,
  recalculateAllRatings
};
