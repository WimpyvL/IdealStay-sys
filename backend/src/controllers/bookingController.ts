import { Request, Response } from 'express';
import { getPool } from '../config/database';
import { Booking, BookingStatus, PaymentStatus, CancelledBy } from '../types';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// Helper to parse a date-only (YYYY-MM-DD) string as a local date at midnight without timezone shift
const parseDateOnly = (value: string): Date => {
  // Expect format YYYY-MM-DD
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return new Date(NaN);
  const [, y, m, d] = match;
  const year = Number(y);
  const monthIndex = Number(m) - 1; // zero-based
  const day = Number(d);
  return new Date(year, monthIndex, day, 0, 0, 0, 0); // local midnight
};

// Interface for booking creation
interface BookingCreateData {
  property_id: number;
  check_in_date: string; // YYYY-MM-DD
  check_out_date: string; // YYYY-MM-DD
  guests_count: number;
  special_requests?: string;
  payment_method?: string;
}

// Interface for booking search/filter
interface BookingQuery {
  status?: BookingStatus;
  property_id?: string;
  guest_id?: string;
  host_id?: string;
  start_date?: string;
  end_date?: string;
  page?: string;
  limit?: string;
}

/**
 * Helper function to calculate booking pricing
 */
const calculateBookingPricing = (
  pricePerNight: number,
  nights: number,
  guestsCount: number,
  cleaningFee: number = 0,
  securityDeposit: number = 0
) => {
  // Coerce potentially string inputs just in case (MySQL rows may come as strings)
  const nightly = Number(pricePerNight) || 0;
  const n = Number(nights) || 0;
  const g = Number(guestsCount) || 0;
  const cleaning = Number(cleaningFee) || 0;
  const deposit = Number(securityDeposit) || 0;

  const basePrice = nightly * n * g; // include guests in base calculation
  const serviceFeeRaw = basePrice * 0.1; // 10% service fee
  const serviceFee = Math.round(serviceFeeRaw * 100) / 100;
  const totalAmount = Math.round((basePrice + cleaning + serviceFee) * 100) / 100;

  return {
    base_price: Math.round(basePrice * 100) / 100,
    cleaning_fee: cleaning,
    security_deposit: deposit,
    service_fee: serviceFee,
    total_amount: totalAmount
  };
};

/**
 * Helper function to calculate nights between dates
 */
const calculateNights = (checkIn: string, checkOut: string): number => {
  const checkInDate = parseDateOnly(checkIn);
  const checkOutDate = parseDateOnly(checkOut);
  const timeDifference = checkOutDate.getTime() - checkInDate.getTime();
  // Use exact day difference (no DST issues since both at local midnight)
  return Math.round(timeDifference / (1000 * 3600 * 24));
};

/**
 * Check property availability for given dates
 */
export const checkAvailability = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id: propertyId } = req.params;
    const { check_in_date, check_out_date, guests_count } = req.query;

    // Validate required parameters
    if (!check_in_date || !check_out_date) {
      return res.status(400).json({
        success: false,
        message: 'Check-in and check-out dates are required'
      });
    }

    // Validate date format and logic
  const checkIn = parseDateOnly(check_in_date as string);
  const checkOut = parseDateOnly(check_out_date as string);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0); // local midnight today

    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD'
      });
    }

    if (checkIn >= checkOut) {
      return res.status(400).json({
        success: false,
        message: 'Check-out date must be after check-in date'
      });
    }

    if (checkIn < today) {
      return res.status(400).json({
        success: false,
        message: 'Check-in date cannot be in the past'
      });
    }

    const pool = getPool();

    // Get property details
    const [propertyRows] = await pool.execute<RowDataPacket[]>(
      `SELECT 
         id, title, max_guests, price_per_night, cleaning_fee, security_deposit,
         min_nights, max_nights, advance_booking_days, is_instant_book, status
       FROM properties 
       WHERE id = ?`,
      [propertyId]
    );

    if (propertyRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    const property = propertyRows[0];

    // Check if property is active
    if (property.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Property is not available for booking'
      });
    }

    // Check guest capacity
    const guestCount = guests_count ? parseInt(guests_count as string) : 1;
    if (guestCount > property.max_guests) {
      return res.status(400).json({
        success: false,
        message: `Property can accommodate maximum ${property.max_guests} guests`
      });
    }

    // Check min/max nights restrictions
    const nights = calculateNights(check_in_date as string, check_out_date as string);
    
    if (nights < property.min_nights) {
      return res.status(400).json({
        success: false,
        message: `Minimum stay is ${property.min_nights} nights`
      });
    }

    if (property.max_nights > 0 && nights > property.max_nights) {
      return res.status(400).json({
        success: false,
        message: `Maximum stay is ${property.max_nights} nights`
      });
    }

    // Check advance booking restriction
    if (property.advance_booking_days > 0) {
      const maxAdvanceDate = new Date(today);
      maxAdvanceDate.setDate(today.getDate() + property.advance_booking_days);
      
      if (checkIn > maxAdvanceDate) {
        return res.status(400).json({
          success: false,
          message: `Cannot book more than ${property.advance_booking_days} days in advance`
        });
      }
    }

    // Check for booking conflicts using canonical overlap logic:
    // Overlap exists if NOT (existing.checkout <= new.checkin OR existing.checkin >= new.checkout)
    const [conflictRows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, check_in_date, check_out_date, status FROM bookings
       WHERE property_id = ?
       AND status IN ('confirmed', 'pending')
       AND NOT (check_out_date <= ? OR check_in_date >= ?)`,
      [propertyId, check_in_date, check_out_date]
    );

    if (conflictRows.length > 0) {
      const conflicts = conflictRows.map(r => ({
        id: r.id,
        check_in_date: r.check_in_date,
        check_out_date: r.check_out_date,
        status: r.status
      }));

      // Log conflicts (non-sensitive) for debugging
      console.warn('[Availability] Conflicts detected', {
        property_id: propertyId,
        requested: { check_in_date, check_out_date },
        conflicts_count: conflicts.length,
        conflicts
      });

      return res.status(400).json({
        success: false,
        code: 'DATE_CONFLICT',
        message: 'Property is not available for the selected dates', // backward-compatible message
        conflicts
      });
    }

    // Calculate pricing
    const requestedGuests = Number(guests_count) || 1;
    const pricing = calculateBookingPricing(
      property.price_per_night,
      nights,
      requestedGuests,
      property.cleaning_fee,
      property.security_deposit
    );

    return res.json({
      success: true,
      data: {
        available: true,
        property: {
          id: property.id,
          title: property.title,
          max_guests: property.max_guests,
          is_instant_book: property.is_instant_book
        },
        booking_details: {
          check_in_date,
          check_out_date,
          guests_count: guestCount,
          nights,
          pricing
        }
      }
    });

  } catch (error) {
    console.error('❌ Error checking availability:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check availability',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

/**
 * Create a new booking
 */
export const createBooking = async (req: Request, res: Response): Promise<Response> => {
  try {
    const guestId = req.userId;
    
    if (!guestId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const bookingData: BookingCreateData = req.body;

    // Validate required fields
    const requiredFields = ['property_id', 'check_in_date', 'check_out_date', 'guests_count'];
    for (const field of requiredFields) {
      if (!bookingData[field as keyof BookingCreateData]) {
        return res.status(400).json({
          success: false,
          message: `${field} is required`
        });
      }
    }

    const pool = getPool();

    // Validate date format and logic first
  const checkIn = parseDateOnly(bookingData.check_in_date);
  const checkOut = parseDateOnly(bookingData.check_out_date);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD'
      });
    }

    if (checkIn >= checkOut) {
      return res.status(400).json({
        success: false,
        message: 'Check-out date must be after check-in date'
      });
    }

    if (checkIn < today) {
      return res.status(400).json({
        success: false,
        message: 'Check-in date cannot be in the past'
      });
    }

    // Check for booking conflicts
    const [conflictRows] = await pool.execute<RowDataPacket[]>(
      `SELECT id FROM bookings 
       WHERE property_id = ? 
       AND status IN ('confirmed', 'pending')
       AND (
         (check_in_date <= ? AND check_out_date > ?) OR
         (check_in_date < ? AND check_out_date >= ?) OR
         (check_in_date >= ? AND check_out_date <= ?)
       )`,
      [
        bookingData.property_id,
        bookingData.check_in_date, bookingData.check_in_date,
        bookingData.check_out_date, bookingData.check_out_date,
        bookingData.check_in_date, bookingData.check_out_date
      ]
    );

    if (conflictRows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Property is not available for the selected dates'
      });
    }

    // Get property and host information with additional validation
    const [propertyRows] = await pool.execute<RowDataPacket[]>(
      `SELECT host_id, price_per_night, cleaning_fee, security_deposit, is_instant_book,
              max_guests, min_nights, max_nights, advance_booking_days, status
       FROM properties WHERE id = ?`,
      [bookingData.property_id]
    );

    if (propertyRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    const property = propertyRows[0];

    // Validate property status
    if (property.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Property is not available for booking'
      });
    }

    // Validate guest capacity
    if (bookingData.guests_count > property.max_guests) {
      return res.status(400).json({
        success: false,
        message: `Property can accommodate maximum ${property.max_guests} guests`
      });
    }

    // Validate night restrictions
    const nights = calculateNights(bookingData.check_in_date, bookingData.check_out_date);
    
    if (nights < property.min_nights) {
      return res.status(400).json({
        success: false,
        message: `Minimum stay is ${property.min_nights} nights`
      });
    }

    if (property.max_nights > 0 && nights > property.max_nights) {
      return res.status(400).json({
        success: false,
        message: `Maximum stay is ${property.max_nights} nights`
      });
    }

    const pricing = calculateBookingPricing(
      property.price_per_night,
      nights,
      bookingData.guests_count,
      property.cleaning_fee,
      property.security_deposit
    );

    // Determine initial booking status
    const initialStatus: BookingStatus = property.is_instant_book ? 'confirmed' : 'pending';

    // Create the booking
    // Schema currently has 'taxes' column, not 'service_fee'. Until migration 002 applied, store service fee in taxes.
    // After migration runs, this INSERT should be updated to use service_fee.
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO bookings (
        property_id, guest_id, host_id, check_in_date, check_out_date,
        guests_count, base_price, cleaning_fee, security_deposit, taxes,
        total_amount, status, payment_status, payment_method, special_requests
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        bookingData.property_id,
        guestId,
        property.host_id,
        bookingData.check_in_date,
        bookingData.check_out_date,
        bookingData.guests_count,
        pricing.base_price,
        pricing.cleaning_fee,
        pricing.security_deposit,
        pricing.service_fee, // temporarily stored in taxes column
        pricing.total_amount,
        initialStatus,
        'pending', // Payment status starts as pending
        bookingData.payment_method || null,
        bookingData.special_requests || null
      ]
    );

    // Fetch the created booking with related data
    const [newBooking] = await pool.execute<RowDataPacket[]>(
      `SELECT b.*,
              p.title as property_title, p.address as property_address, p.city as property_city,
              u.first_name as guest_first_name, u.last_name as guest_last_name, u.email as guest_email,
              u.phone as guest_phone, u.profile_image_url as guest_image
       FROM bookings b
       LEFT JOIN properties p ON b.property_id = p.id
       LEFT JOIN users u ON b.guest_id = u.id
       WHERE b.id = ?`,
      [result.insertId]
    );

    // Create a conversation for this booking automatically
    try {
      // Check if a conversation already exists for this property between guest and host
      const [existingConv] = await pool.execute<RowDataPacket[]>(
        `SELECT c.id
         FROM conversations c
         INNER JOIN conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_id = ?
         INNER JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id = ?
         WHERE c.property_id = ?
         LIMIT 1`,
        [guestId, property.host_id, bookingData.property_id]
      );

      let conversationId;
      if (existingConv.length > 0) {
        // Update existing conversation with booking reference
        conversationId = existingConv[0].id;
        await pool.execute(
          'UPDATE conversations SET booking_id = ?, updated_at = NOW() WHERE id = ? AND booking_id IS NULL',
          [result.insertId, conversationId]
        );
      } else {
        // Create new conversation
        const [convResult] = await pool.execute<ResultSetHeader>(
          'INSERT INTO conversations (property_id, booking_id) VALUES (?, ?)',
          [bookingData.property_id, result.insertId]
        );
        conversationId = convResult.insertId;

        // Add both guest and host as participants
        await pool.execute(
          'INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?), (?, ?)',
          [conversationId, guestId, conversationId, property.host_id]
        );
      }
    } catch (convError) {
      // Log error but don't fail the booking
      console.error('⚠️ Failed to create conversation for booking:', convError);
    }

    return res.status(201).json({
      success: true,
      message: `Booking ${initialStatus === 'confirmed' ? 'confirmed' : 'created and pending approval'}`,
      data: {
        booking: newBooking[0],
        next_steps: initialStatus === 'confirmed'
          ? 'Your booking is confirmed! You will receive further details via email.'
          : 'Your booking request has been sent to the host for approval.'
      }
    });

  } catch (error) {
    console.error('❌ Error creating booking:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create booking',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

/**
 * Get bookings (filtered by user role and permissions)
 */
export const getBookings = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = req.userId;
    const userRole = req.user?.role;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const {
      status,
      property_id,
      guest_id,
      host_id,
      start_date,
      end_date,
      page = '1',
      limit = '10'
    } = req.query as BookingQuery;

    const pool = getPool();

    // Build query based on user role
    let baseQuery = `
      SELECT b.*,
        p.title as property_title, p.address as property_address,
        p.city as property_city, p.country as property_country,
        (SELECT image_url FROM property_images WHERE property_id = p.id AND is_primary = 1 LIMIT 1) as property_image,
        g.first_name as guest_first_name, g.last_name as guest_last_name,
        g.email as guest_email, g.phone as guest_phone, g.profile_image_url as guest_image,
        h.first_name as host_first_name, h.last_name as host_last_name,
        h.email as host_email, h.phone as host_phone, h.profile_image_url as host_image,
        r.id as review_id, r.rating as review_rating
      FROM bookings b
      LEFT JOIN properties p ON b.property_id = p.id
      LEFT JOIN users g ON b.guest_id = g.id
      LEFT JOIN users h ON b.host_id = h.id
      LEFT JOIN reviews r ON r.booking_id = b.id AND r.reviewer_id = b.guest_id
      WHERE 1=1
    `;

    const queryParams: any[] = [];
    const conditions: string[] = [];

    // Role-based filtering
    if (userRole === 'admin') {
      // Admin can see all bookings, but apply filters if specified
      if (guest_id) {
        conditions.push('b.guest_id = ?');
        queryParams.push(guest_id);
      }
      if (host_id) {
        conditions.push('b.host_id = ?');
        queryParams.push(host_id);
      }
    } else if (userRole === 'host') {
      // Host can see bookings for their properties and their own guest bookings
      conditions.push('(b.host_id = ? OR b.guest_id = ?)');
      queryParams.push(userId, userId);
    } else {
      // Guests can only see their own bookings
      conditions.push('b.guest_id = ?');
      queryParams.push(userId);
    }

    // Apply additional filters
    if (status) {
      conditions.push('b.status = ?');
      queryParams.push(status);
    }

    if (property_id) {
      conditions.push('b.property_id = ?');
      queryParams.push(property_id);
    }

    if (start_date) {
      conditions.push('b.check_in_date >= ?');
      queryParams.push(start_date);
    }

    if (end_date) {
      conditions.push('b.check_out_date <= ?');
      queryParams.push(end_date);
    }

    // Add conditions to query
    if (conditions.length > 0) {
      baseQuery += ` AND ${conditions.join(' AND ')}`;
    }

    // Add ordering
    baseQuery += ' ORDER BY b.created_at DESC';

    // Pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const paginatedQuery = baseQuery + ' LIMIT ? OFFSET ?';
    queryParams.push(limitNum, offset);

    // Execute query
    const [rows] = await pool.execute<RowDataPacket[]>(paginatedQuery, queryParams);

    // Enrich bookings with full property objects and images
    const enrichedBookings = await Promise.all(
      rows.map(async (booking: any) => {
        // Fetch full property details
        const [propRows] = await pool.execute<RowDataPacket[]>(
          'SELECT * FROM properties WHERE id = ?',
          [booking.property_id]
        );

        // Fetch property images
        const [imageRows] = await pool.execute<RowDataPacket[]>(
          'SELECT * FROM property_images WHERE property_id = ? ORDER BY is_primary DESC, display_order ASC',
          [booking.property_id]
        );

        return {
          ...booking,
          property: propRows.length > 0 ? {
            ...propRows[0],
            images: imageRows
          } : null
        };
      })
    );

    // Get total count - rebuild query without SELECT columns and ORDER BY
    let countQuery = `
      SELECT COUNT(*) as total
      FROM bookings b
      LEFT JOIN properties p ON b.property_id = p.id
      LEFT JOIN users g ON b.guest_id = g.id
      LEFT JOIN users h ON b.host_id = h.id
      WHERE 1=1
    `;

    // Add the same conditions
    if (conditions.length > 0) {
      countQuery += ` AND ${conditions.join(' AND ')}`;
    }

    const countParams = queryParams.slice(0, -2); // Remove LIMIT and OFFSET
    const [countRows] = await pool.execute<RowDataPacket[]>(countQuery, countParams);

    const total = countRows[0].total;
    const totalPages = Math.ceil(total / limitNum);

    return res.json({
      success: true,
      data: {
        bookings: enrichedBookings,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages,
          hasNext: pageNum < totalPages,
          hasPrev: pageNum > 1
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching bookings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

/**
 * Get single booking details
 */
export const getBookingById = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const userRole = req.user?.role;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const pool = getPool();

    // Get booking with all related information
    const [bookingRows] = await pool.execute<RowDataPacket[]>(
      `SELECT b.*,
        (SELECT c.id FROM conversations c WHERE c.booking_id = b.id ORDER BY c.id ASC LIMIT 1) as conversation_id,
              p.title as property_title, p.description as property_description,
              p.address as property_address, p.city as property_city,
              p.state as property_state, p.country as property_country,
              p.latitude, p.longitude, p.check_in_time, p.check_out_time,
              (SELECT image_url FROM property_images WHERE property_id = p.id AND is_primary = 1 LIMIT 1) as property_image,
              g.first_name as guest_first_name, g.last_name as guest_last_name,
              g.email as guest_email, g.phone as guest_phone, g.profile_image_url as guest_image,
              h.first_name as host_first_name, h.last_name as host_last_name,
              h.email as host_email, h.phone as host_phone, h.profile_image_url as host_image,
              h.host_rating,
              r.id as review_id, r.rating as review_rating
       FROM bookings b
       LEFT JOIN properties p ON b.property_id = p.id
       LEFT JOIN users g ON b.guest_id = g.id
       LEFT JOIN users h ON b.host_id = h.id
       LEFT JOIN reviews r ON r.booking_id = b.id AND r.reviewer_id = b.guest_id
       WHERE b.id = ?`,
      [id]
    );

    if (bookingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const booking = bookingRows[0];

    // Check permissions
    const canView = userRole === 'admin' || 
                   booking.guest_id === userId || 
                   booking.host_id === userId;

    if (!canView) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this booking'
      });
    }

    // Get property images
    const [images] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM property_images WHERE property_id = ? ORDER BY display_order',
      [booking.property_id]
    );

    // Get any reviews for this booking
    const [reviews] = await pool.execute<RowDataPacket[]>(
      `SELECT r.*, u.first_name, u.last_name, u.profile_image_url
       FROM reviews r
       LEFT JOIN users u ON r.reviewer_id = u.id
       WHERE r.booking_id = ?`,
      [id]
    );

    return res.json({
      success: true,
      data: {
        ...booking,
        property_images: images,
        reviews: reviews,
        permissions: {
          can_cancel: (booking.status === 'pending' || booking.status === 'confirmed') && 
                     (booking.guest_id === userId || booking.host_id === userId || userRole === 'admin'),
          can_review: booking.status === 'completed' && booking.guest_id === userId,
          can_update_status: booking.host_id === userId || userRole === 'admin'
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching booking:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch booking details',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

/**
 * Update booking status (hosts and admins only)
 */
export const updateBookingStatus = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const { status, host_notes } = req.body;
    const userId = req.userId;
    const userRole = req.user?.role;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    // Validate status
    const validStatuses: BookingStatus[] = ['pending', 'confirmed', 'cancelled', 'completed', 'refunded'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const pool = getPool();

    // Get current booking
    const [bookingRows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM bookings WHERE id = ?',
      [id]
    );

    if (bookingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const booking = bookingRows[0];

    // Check permissions
    const canUpdate = userRole === 'admin' || booking.host_id === userId;
    if (!canUpdate) {
      return res.status(403).json({
        success: false,
        message: 'Only the host or admin can update booking status'
      });
    }

    // Validate status transitions
    const currentStatus = booking.status;
    const validTransitions: Record<string, string[]> = {
      'pending': ['confirmed', 'cancelled'],
      'confirmed': ['completed', 'cancelled'],
      'cancelled': ['refunded'], // Only admin can refund
      'completed': [], // Completed bookings cannot be changed
      'refunded': [] // Refunded bookings cannot be changed
    };

    if (!validTransitions[currentStatus]?.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot change status from ${currentStatus} to ${status}`
      });
    }

    // Additional validation for refunds (admin only)
    if (status === 'refunded' && userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can process refunds'
      });
    }

    // Update booking status
    const updateFields = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
    const updateValues = [status];

    if (host_notes !== undefined) {
      updateFields.push('host_notes = ?');
      updateValues.push(host_notes);
    }

    // Handle status-specific updates
    if (status === 'cancelled') {
      updateFields.push('cancelled_at = CURRENT_TIMESTAMP', 'cancelled_by = ?');
      updateValues.push(userRole === 'admin' ? 'admin' : 'host');
    }

    updateValues.push(id);

    await pool.execute(
      `UPDATE bookings SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    // Fetch updated booking
    const [updatedBooking] = await pool.execute<RowDataPacket[]>(
      `SELECT b.*, p.title as property_title,
              g.first_name as guest_first_name, g.last_name as guest_last_name,
              CONCAT(g.first_name, ' ', g.last_name) as guest_name, g.email as guest_email,
              g.phone as guest_phone, g.profile_image_url as guest_image
       FROM bookings b
       LEFT JOIN properties p ON b.property_id = p.id
       LEFT JOIN users g ON b.guest_id = g.id
       WHERE b.id = ?`,
      [id]
    );

    return res.json({
      success: true,
      message: `Booking status updated to ${status}`,
      data: updatedBooking[0]
    });

  } catch (error) {
    console.error('❌ Error updating booking status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update booking status',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

/**
 * Cancel booking (guests, hosts, or admins)
 */
export const cancelBooking = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const { cancellation_reason } = req.body;
    const userId = req.userId;
    const userRole = req.user?.role;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const pool = getPool();

    // Get current booking
    const [bookingRows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM bookings WHERE id = ?',
      [id]
    );

    if (bookingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const booking = bookingRows[0];

    // Check permissions
    const canCancel = userRole === 'admin' || 
                     booking.guest_id === userId || 
                     booking.host_id === userId;

    if (!canCancel) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to cancel this booking'
      });
    }

    // Check if booking can be cancelled
    if (!['pending', 'confirmed'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: 'Only pending or confirmed bookings can be cancelled'
      });
    }

    // Determine who cancelled
    let cancelledBy: CancelledBy = 'guest';
    if (userRole === 'admin') {
      cancelledBy = 'admin';
    } else if (booking.host_id === userId) {
      cancelledBy = 'host';
    }

    // Update booking
    await pool.execute(
      `UPDATE bookings SET 
         status = 'cancelled',
         cancelled_at = CURRENT_TIMESTAMP,
         cancelled_by = ?,
         cancellation_reason = ?,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [cancelledBy, cancellation_reason || null, id]
    );

    // Fetch updated booking
    const [updatedBooking] = await pool.execute<RowDataPacket[]>(
      `SELECT b.*, p.title as property_title,
              g.first_name as guest_first_name, g.last_name as guest_last_name,
              CONCAT(g.first_name, ' ', g.last_name) as guest_name, g.email as guest_email,
              g.phone as guest_phone, g.profile_image_url as guest_image
       FROM bookings b
       LEFT JOIN properties p ON b.property_id = p.id
       LEFT JOIN users g ON b.guest_id = g.id
       WHERE b.id = ?`,
      [id]
    );

    return res.json({
      success: true,
      message: 'Booking cancelled successfully',
      data: {
        booking: updatedBooking[0],
        cancelled_by: cancelledBy,
        cancellation_info: 'Refund processing will be handled according to the cancellation policy'
      }
    });

  } catch (error) {
    console.error('❌ Error cancelling booking:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to cancel booking',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

/**
 * Calculate pricing (standalone endpoint to support frontend widget)
 * POST /api/v1/bookings/pricing
 * Body: { property_id, check_in_date, check_out_date, guests }
 */
export const calculatePricing = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { property_id, check_in_date, check_out_date, guests } = req.body || {};
    if (!property_id || !check_in_date || !check_out_date) {
      return res.status(400).json({ success: false, message: 'property_id, check_in_date and check_out_date are required' });
    }
    const nights = calculateNights(check_in_date, check_out_date);
    if (nights <= 0) {
      return res.status(400).json({ success: false, message: 'check_out_date must be after check_in_date' });
    }
    const pool = getPool();
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, price_per_night, cleaning_fee, security_deposit, status, min_nights, max_nights, max_guests
       FROM properties WHERE id = ? LIMIT 1`,
      [property_id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }
    const property = rows[0];
    if (property.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Property is not available for booking' });
    }
    if (property.min_nights && nights < property.min_nights) {
      return res.status(400).json({ success: false, message: `Minimum stay is ${property.min_nights} nights` });
    }
    if (property.max_nights && property.max_nights > 0 && nights > property.max_nights) {
      return res.status(400).json({ success: false, message: `Maximum stay is ${property.max_nights} nights` });
    }
    if (guests && guests > property.max_guests) {
      return res.status(400).json({ success: false, message: `Property can accommodate maximum ${property.max_guests} guests` });
    }
    const effectiveGuests = Number(guests) || property.max_guests || 1;
    const pricing = calculateBookingPricing(
      property.price_per_night,
      nights,
      effectiveGuests,
      property.cleaning_fee,
      property.security_deposit
    );
    return res.json({
      success: true,
      data: {
        property_id,
        check_in_date,
        check_out_date,
        nights,
        guests,
        pricing: {
          base_price: pricing.base_price,
          cleaning_fee: pricing.cleaning_fee,
          security_deposit: pricing.security_deposit,
          service_fee: pricing.service_fee,
          total_amount: pricing.total_amount
        }
      }
    });
  } catch (error) {
    console.error('❌ Error calculating pricing:', error);
    return res.status(500).json({ success: false, message: 'Failed to calculate pricing' });
  }
};

/**
 * Public: Get booked date ranges for a property (confirmed + pending)
 * GET /api/v1/bookings/properties/:id/booked-dates
 * Query params:
 * - start_date (optional, default: today)
 * - end_date (optional, default: today + 180 days)
 * Returns minimal list of booking spans to allow calendar disabling.
 */
export const getPropertyBookedDates = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id: propertyId } = req.params;
    let { start_date, end_date } = req.query as { start_date?: string; end_date?: string };

    const today = new Date();
    const defaultStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const defaultEnd = new Date(defaultStart);
    defaultEnd.setDate(defaultStart.getDate() + 180);

    const start = start_date || defaultStart.toISOString().slice(0,10);
    const end = end_date || defaultEnd.toISOString().slice(0,10);

    // Basic validation (optional)
    const startD = parseDateOnly(start);
    const endD = parseDateOnly(end);
    if (isNaN(startD.getTime()) || isNaN(endD.getTime()) || startD >= endD) {
      return res.status(400).json({ success: false, message: 'Invalid date range' });
    }

    const pool = getPool();
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, check_in_date, check_out_date, status
       FROM bookings
       WHERE property_id = ?
         -- Include completed so that a just-finished (or currently finishing) stay still blocks its range
         AND status IN ('confirmed','pending','completed')
         -- Overlap test to pull any span intersecting the requested window
         AND check_in_date < ?
         AND check_out_date > ?
       ORDER BY check_in_date ASC`,
      [propertyId, end, start]
    );

    return res.json({
      success: true,
      data: {
        property_id: Number(propertyId),
        start_date: start,
        end_date: end,
        bookings: rows.map(r => ({
          id: r.id,
          check_in_date: typeof r.check_in_date === 'string' ? r.check_in_date : (r.check_in_date instanceof Date ? r.check_in_date.toISOString().slice(0, 10) : r.check_in_date),
          check_out_date: typeof r.check_out_date === 'string' ? r.check_out_date : (r.check_out_date instanceof Date ? r.check_out_date.toISOString().slice(0, 10) : r.check_out_date),
          status: r.status
        }))
      }
    });
  } catch (error) {
    console.error('❌ Error fetching property booked dates:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch booked dates' });
  }
};