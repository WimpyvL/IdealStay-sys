import { Request, Response } from 'express';
import { getPool } from '../config/database';
import { Property, PropertyType, PropertyStatus, Amenity, PropertyImage } from '../types';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// Interface for property search query parameters
interface PropertySearchQuery {
  location?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: string;
  minPrice?: string;
  maxPrice?: string;
  propertyType?: PropertyType;
  amenities?: string;
  bedrooms?: string;
  bathrooms?: string;
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Interface for property creation/update
interface PropertyCreateData {
  title: string;
  description: string;
  property_type: PropertyType;
  address: string;
  city: string;
  state?: string;
  postal_code?: string;
  country: string;
  latitude?: number;
  longitude?: number;
  max_guests: number;
  bedrooms: number;
  bathrooms: number;
  beds: number;
  price_per_night: number;
  cleaning_fee: number;
  security_deposit: number;
  min_nights: number;
  max_nights: number;
  check_in_time: string;
  check_out_time: string;
  advance_booking_days: number;
  is_instant_book: boolean;
  amenity_ids?: number[];
  status?: PropertyStatus;
}

/**
 * Get all properties with advanced search and filtering
 */
export const getProperties = async (req: Request, res: Response): Promise<Response> => {
  const maxRetries = 2;
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const {
        location,
        checkIn,
        checkOut,
        guests,
        minPrice,
        maxPrice,
        propertyType,
        amenities,
        bedrooms,
        bathrooms,
        page = '1',
        limit = '12',
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = req.query as PropertySearchQuery;

      const pool = getPool();
    
    // Build base query
    let query = `
      SELECT p.*, 
             u.first_name as host_first_name, 
             u.last_name as host_last_name,
             u.profile_image_url as host_profile_image,
             u.host_rating,
             (SELECT image_url FROM property_images WHERE property_id = p.id AND is_primary = 1 LIMIT 1) as primary_image,
             (SELECT GROUP_CONCAT(a.name) FROM property_amenities pa 
              LEFT JOIN amenities a ON pa.amenity_id = a.id 
              WHERE pa.property_id = p.id) as amenity_names
      FROM properties p
      LEFT JOIN users u ON p.host_id = u.id
      WHERE p.status = 'active'
    `;

    const queryParams: any[] = [];
    
    // Location filter
    if (location) {
      query += ` AND (p.city LIKE ? OR p.address LIKE ? OR p.country LIKE ?)`;
      const locationPattern = `%${location}%`;
      queryParams.push(locationPattern, locationPattern, locationPattern);
    }

    // Guest capacity filter
    if (guests) {
      query += ` AND p.max_guests >= ?`;
      queryParams.push(parseInt(guests));
    }

    // Price range filter
    if (minPrice) {
      query += ` AND p.price_per_night >= ?`;
      queryParams.push(parseFloat(minPrice));
    }
    if (maxPrice) {
      query += ` AND p.price_per_night <= ?`;
      queryParams.push(parseFloat(maxPrice));
    }

    // Property type filter
    if (propertyType) {
      query += ` AND p.property_type = ?`;
      queryParams.push(propertyType);
    }

    // Bedrooms filter
    if (bedrooms) {
      query += ` AND p.bedrooms >= ?`;
      queryParams.push(parseInt(bedrooms));
    }

    // Bathrooms filter
    if (bathrooms) {
      query += ` AND p.bathrooms >= ?`;
      queryParams.push(parseInt(bathrooms));
    }

    // Amenities filter
    if (amenities) {
      const amenityIds = amenities.split(',').map(id => parseInt(id.trim()));
      const amenityPlaceholders = amenityIds.map(() => '?').join(',');
      query += `
        AND p.id IN (
          SELECT pa.property_id 
          FROM property_amenities pa 
          WHERE pa.amenity_id IN (${amenityPlaceholders})
          GROUP BY pa.property_id 
          HAVING COUNT(DISTINCT pa.amenity_id) = ?
        )
      `;
      queryParams.push(...amenityIds, amenityIds.length);
    }

    // Availability filter (if check-in and check-out dates provided)
    if (checkIn && checkOut) {
      query += `
        AND p.id NOT IN (
          SELECT DISTINCT b.property_id 
          FROM bookings b 
          WHERE b.status IN ('confirmed', 'pending')
          AND (
            (b.check_in_date <= ? AND b.check_out_date > ?) OR
            (b.check_in_date < ? AND b.check_out_date >= ?) OR
            (b.check_in_date >= ? AND b.check_out_date <= ?)
          )
        )
      `;
      queryParams.push(checkIn, checkIn, checkOut, checkOut, checkIn, checkOut);
    }

    // Sorting
    const validSortFields = ['price_per_night', 'average_rating', 'created_at', 'total_reviews'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    const sortDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';
    query += ` ORDER BY p.${sortField} ${sortDirection}`;

    // Pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit))); // Max 50 per page
    const offset = (pageNum - 1) * limitNum;
    
    query += ` LIMIT ? OFFSET ?`;
    queryParams.push(limitNum, offset);

    // Execute query
    const [rows] = await pool.execute<RowDataPacket[]>(query, queryParams);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(DISTINCT p.id) as total
      FROM properties p
      WHERE p.status = 'active'
    `;
    const countParams: any[] = [];
    
    // Apply same filters for count (simplified version)
    if (location) {
      countQuery += ` AND (p.city LIKE ? OR p.address LIKE ? OR p.country LIKE ?)`;
      const locationPattern = `%${location}%`;
      countParams.push(locationPattern, locationPattern, locationPattern);
    }
    if (guests) {
      countQuery += ` AND p.max_guests >= ?`;
      countParams.push(parseInt(guests));
    }
    if (minPrice) {
      countQuery += ` AND p.price_per_night >= ?`;
      countParams.push(parseFloat(minPrice));
    }
    if (maxPrice) {
      countQuery += ` AND p.price_per_night <= ?`;
      countParams.push(parseFloat(maxPrice));
    }
    if (propertyType) {
      countQuery += ` AND p.property_type = ?`;
      countParams.push(propertyType);
    }
    if (bedrooms) {
      countQuery += ` AND p.bedrooms >= ?`;
      countParams.push(parseInt(bedrooms));
    }
    if (bathrooms) {
      countQuery += ` AND p.bathrooms >= ?`;
      countParams.push(parseInt(bathrooms));
    }

    const [countRows] = await pool.execute<RowDataPacket[]>(countQuery, countParams);
    const total = countRows[0].total;
    const totalPages = Math.ceil(total / limitNum);

    return res.json({
      success: true,
      data: {
        properties: rows,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages,
          hasNext: pageNum < totalPages,
          hasPrev: pageNum > 1
        },
        filters: {
          location,
          checkIn,
          checkOut,
          guests: guests ? parseInt(guests) : undefined,
          minPrice: minPrice ? parseFloat(minPrice) : undefined,
          maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
          propertyType,
          amenities: amenities ? amenities.split(',').map(id => parseInt(id.trim())) : undefined,
          bedrooms: bedrooms ? parseInt(bedrooms) : undefined,
          bathrooms: bathrooms ? parseInt(bathrooms) : undefined
        }
      }
    });

    } catch (error: any) {
      lastError = error;
      console.error(`❌ Error fetching properties (attempt ${attempt}/${maxRetries}):`, error);
      
      // Handle specific database connection errors
      if (error.code === 'PROTOCOL_CONNECTION_LOST' || error.code === 'ECONNREFUSED') {
        if (attempt < maxRetries) {
          console.log(`🔄 Retrying in 1 second... (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
      } else {
        // Non-connection error, don't retry
        break;
      }
    }
  }

  // If we get here, all retries failed
  console.error('❌ All retry attempts failed:', lastError);
  
  if (lastError.code === 'PROTOCOL_CONNECTION_LOST') {
    return res.status(503).json({
      success: false,
      message: 'Database connection lost. Please try again.',
      error: process.env.NODE_ENV === 'development' ? lastError.message : undefined
    });
  }

  if (lastError.code === 'ECONNREFUSED') {
    return res.status(503).json({
      success: false,
      message: 'Database service unavailable',
      error: process.env.NODE_ENV === 'development' ? lastError.message : undefined
    });
  }

  return res.status(500).json({
    success: false,
    message: 'Failed to fetch properties',
    error: process.env.NODE_ENV === 'development' ? lastError.message : undefined
  });
};

/**
 * Get a single property by ID with all related data
 */
export const getPropertyById = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const pool = getPool();

    // Get property with host information
    // Allow public access only to active/pending, but if requester is the host or an admin, allow any status.
    const requesterId = (req as any).userId; // set by auth middleware if authenticated
    const requesterRole = (req as any).user?.role;
    let propertyQuery = `SELECT p.*, 
              u.first_name as host_first_name, 
              u.last_name as host_last_name,
              u.profile_image_url as host_profile_image,
              u.host_rating,
              u.host_total_reviews,
              u.created_at as host_member_since
       FROM properties p
       LEFT JOIN users u ON p.host_id = u.id
       WHERE p.id = ?`;
    const queryParams: any[] = [id];
    if (!requesterId) {
      // Unauthenticated: only active/pending
      propertyQuery += ` AND p.status IN ('active','pending')`;
    } else if (requesterRole === 'admin') {
      // Admin: no additional restriction
    } else {
      // Authenticated host: allow if property is active/pending OR they own it
      propertyQuery += ` AND (p.status IN ('active','pending') OR p.host_id = ?)`;
      queryParams.push(requesterId);
    }
    let propertyRows: RowDataPacket[] = [];
    try {
      const [rows] = await pool.execute<RowDataPacket[]>(propertyQuery, queryParams);
      propertyRows = rows;
    } catch (dbErr) {
      console.error('❌ DB error executing getPropertyById query:', { propertyQuery, queryParams, error: dbErr });
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch property (query execution)',
        error: process.env.NODE_ENV === 'development' ? dbErr : undefined
      });
    }

    if (propertyRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    const property = propertyRows[0];

    // Get property images
    let imageRows: RowDataPacket[] = [];
    try {
      const [iRows] = await pool.execute<RowDataPacket[]>(
        `SELECT * FROM property_images WHERE property_id = ? ORDER BY display_order ASC`,
        [id]
      );
      imageRows = iRows;
    } catch (imgErr) {
      console.error('❌ Error fetching property images:', { propertyId: id, error: imgErr });
    }

    // Get property amenities
    let amenityRows: RowDataPacket[] = [];
    try {
      const [aRows] = await pool.execute<RowDataPacket[]>(
        `SELECT a.* FROM amenities a
         JOIN property_amenities pa ON a.id = pa.amenity_id
         WHERE pa.property_id = ? AND a.is_active = 1
         ORDER BY a.category, a.name`,
        [id]
      );
      amenityRows = aRows;
    } catch (amenErr) {
      console.error('❌ Error fetching amenities for property:', { propertyId: id, error: amenErr });
    }

    // Get recent reviews (limited to 5 most recent)
    let reviewRows: RowDataPacket[] = [];
    try {
      const [rRows] = await pool.execute<RowDataPacket[]>(
        `SELECT r.*, u.first_name as reviewer_first_name, u.profile_image_url as reviewer_image
         FROM reviews r
         LEFT JOIN users u ON r.reviewer_id = u.id
         WHERE r.property_id = ?
         ORDER BY r.created_at DESC
         LIMIT 5`,
        [id]
      );
      reviewRows = rRows;
    } catch (revErr) {
      console.error('❌ Error fetching reviews for property:', { propertyId: id, error: revErr });
    }

    return res.json({
      success: true,
      data: {
        ...property,
        images: imageRows,
        amenities: amenityRows,
        reviews: reviewRows,
        host: {
          first_name: property.host_first_name,
          last_name: property.host_last_name,
          profile_image_url: property.host_profile_image,
          host_rating: property.host_rating,
          host_total_reviews: property.host_total_reviews,
          member_since: property.host_member_since
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching property:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch property',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

/**
 * Create a new property (hosts only)
 */
export const createProperty = async (req: Request, res: Response): Promise<Response> => {
  try {
    const hostId = req.userId;
    if (!hostId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Verify user is a host
    const pool = getPool();
    const [userRows] = await pool.execute<RowDataPacket[]>(
      'SELECT is_host, host_approved FROM users WHERE id = ?',
      [hostId]
    );

    if (userRows.length === 0 || !userRows[0].is_host) {
      return res.status(403).json({
        success: false,
        message: 'Only approved hosts can create properties'
      });
    }

    const propertyData: PropertyCreateData = req.body;

    // Validate required fields
    const requiredFields = [
      'title', 'description', 'property_type', 'address', 'city', 'country',
      'max_guests', 'bedrooms', 'bathrooms', 'beds', 'price_per_night',
      'min_nights', 'max_nights', 'check_in_time', 'check_out_time'
    ];

    for (const field of requiredFields) {
      if (!propertyData[field as keyof PropertyCreateData]) {
        return res.status(400).json({
          success: false,
          message: `${field} is required`
        });
      }
    }

    // Validate numeric fields
    if (propertyData.price_per_night <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Price per night must be greater than 0'
      });
    }

    if (propertyData.max_guests < 1) {
      return res.status(400).json({
        success: false,
        message: 'Maximum guests must be at least 1'
      });
    }

    // Insert property
    // Status can be 'draft' or 'pending' (submitted for review)
    // Only hosts can create properties, so they cannot set status to 'active' directly
    const allowedStatuses = ['draft', 'pending'];
    const initialStatus = propertyData.status && allowedStatuses.includes(propertyData.status)
      ? propertyData.status
      : 'draft';

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO properties (
        host_id, title, description, property_type, address, city, state,
        postal_code, country, latitude, longitude, max_guests, bedrooms,
        bathrooms, beds, price_per_night, cleaning_fee, security_deposit,
        min_nights, max_nights, check_in_time, check_out_time,
        advance_booking_days, is_instant_book, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        hostId,
        propertyData.title,
        propertyData.description,
        propertyData.property_type,
        propertyData.address,
        propertyData.city,
        propertyData.state || null,
        propertyData.postal_code || null,
        propertyData.country,
        propertyData.latitude || null,
        propertyData.longitude || null,
        propertyData.max_guests,
        propertyData.bedrooms,
        propertyData.bathrooms,
        propertyData.beds,
        propertyData.price_per_night,
        propertyData.cleaning_fee || 0,
        propertyData.security_deposit || 0,
        propertyData.min_nights,
        propertyData.max_nights,
        propertyData.check_in_time,
        propertyData.check_out_time,
        propertyData.advance_booking_days || 0,
        propertyData.is_instant_book || false,
        initialStatus
      ]
    );

    const propertyId = result.insertId;

    // Add amenities if provided
    if (propertyData.amenity_ids && propertyData.amenity_ids.length > 0) {
      const amenityValues = propertyData.amenity_ids.map(amenityId => [propertyId, amenityId]);
      await pool.execute(
        `INSERT INTO property_amenities (property_id, amenity_id) VALUES ${propertyData.amenity_ids.map(() => '(?, ?)').join(', ')}`,
        amenityValues.flat()
      );
    }

    // Fetch the created property
    const [newProperty] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM properties WHERE id = ?',
      [propertyId]
    );

    return res.status(201).json({
      success: true,
      message: 'Property created successfully',
      data: newProperty[0]
    });

  } catch (error) {
    console.error('❌ Error creating property:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create property',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

/**
 * Update an existing property (host or admin only)
 */
export const updateProperty = async (req: Request, res: Response): Promise<Response> => {
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

    // Check if property exists and user has permission
    const [propertyRows] = await pool.execute<RowDataPacket[]>(
      'SELECT host_id FROM properties WHERE id = ?',
      [id]
    );

    if (propertyRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    const property = propertyRows[0];

    // Check permissions (host can only update their own properties, admin can update any)
    if (userRole !== 'admin' && property.host_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own properties'
      });
    }

    const updateData = req.body;
    const allowedFields = [
      'title', 'description', 'property_type', 'address', 'city', 'state',
      'postal_code', 'country', 'latitude', 'longitude', 'max_guests',
      'bedrooms', 'bathrooms', 'beds', 'price_per_night', 'cleaning_fee',
      'security_deposit', 'min_nights', 'max_nights', 'check_in_time',
      'check_out_time', 'advance_booking_days', 'is_instant_book'
    ];

    // Status change rules:
    // - Admin can set any valid status
    // - Host may only move between 'draft' and 'pending' (submit for review) on their own listing
    if (updateData.status) {
      const requestedStatus = String(updateData.status).toLowerCase();
      const validStatuses = ['draft','pending','active','inactive','suspended'];
      if (!validStatuses.includes(requestedStatus)) {
        return res.status(400).json({ success:false, message:'Invalid status value'});
      }
      if (userRole === 'admin') {
        allowedFields.push('status');
      } else {
        // Host path: only allow draft <-> pending transitions
        if (['draft','pending'].includes(requestedStatus)) {
          allowedFields.push('status');
        } else {
          return res.status(403).json({ success:false, message:'Only admins can set this status'});
        }
      }
    }

    // Build update query dynamically
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        updateValues.push(updateData[field]);
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    // Add updated_at timestamp
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(id);

    // Execute update
    await pool.execute(
      `UPDATE properties SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    // Handle amenities update if provided
    if (updateData.amenity_ids !== undefined) {
      // Remove existing amenities
      await pool.execute('DELETE FROM property_amenities WHERE property_id = ?', [id]);
      
      // Add new amenities
      if (updateData.amenity_ids.length > 0) {
        const amenityValues = updateData.amenity_ids.map((amenityId: number) => [id, amenityId]);
        await pool.execute(
          `INSERT INTO property_amenities (property_id, amenity_id) VALUES ${updateData.amenity_ids.map(() => '(?, ?)').join(', ')}`,
          amenityValues.flat()
        );
      }
    }

    // Fetch updated property
    const [updatedProperty] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM properties WHERE id = ?',
      [id]
    );

    return res.json({
      success: true,
      message: 'Property updated successfully',
      data: updatedProperty[0]
    });

  } catch (error) {
    console.error('❌ Error updating property:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update property',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

/**
 * Delete a property (host or admin only)
 */
export const deleteProperty = async (req: Request, res: Response): Promise<Response> => {
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

    // Check if property exists and user has permission
    const [propertyRows] = await pool.execute<RowDataPacket[]>(
      'SELECT host_id FROM properties WHERE id = ?',
      [id]
    );

    if (propertyRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    const property = propertyRows[0];

    // Check permissions
    if (userRole !== 'admin' && property.host_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own properties'
      });
    }

    // Check for active bookings
    const [bookingRows] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM bookings WHERE property_id = ? AND status IN ("confirmed", "pending")',
      [id]
    );

    if (bookingRows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete property with active bookings'
      });
    }

    // Soft delete by setting status to inactive instead of hard delete
    await pool.execute(
      'UPDATE properties SET status = "inactive", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );

    return res.json({
      success: true,
      message: 'Property deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting property:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete property',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

/**
 * Get properties owned by the current host
 */
export const getHostProperties = async (req: Request, res: Response): Promise<Response> => {
  try {
    const hostId = req.userId;
    
    if (!hostId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const pool = getPool();
    const { status, page = '1', limit = '10' } = req.query;

    let query = `
      SELECT p.*, 
             (SELECT COUNT(*) FROM bookings WHERE property_id = p.id AND status = 'confirmed') as total_bookings,
             (SELECT AVG(rating) FROM reviews WHERE property_id = p.id AND review_type = 'property') as avg_rating,
             (SELECT image_url FROM property_images WHERE property_id = p.id AND is_primary = 1 LIMIT 1) as primary_image
      FROM properties p
      WHERE p.host_id = ?
    `;

    const queryParams: any[] = [hostId];

    if (status) {
      query += ' AND p.status = ?';
      queryParams.push(status);
    }

    query += ' ORDER BY p.created_at DESC';

    // Pagination
    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string)));
    const offset = (pageNum - 1) * limitNum;
    
    query += ' LIMIT ? OFFSET ?';
    queryParams.push(limitNum, offset);

    const [rows] = await pool.execute<RowDataPacket[]>(query, queryParams);

    // Get total count
    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM properties WHERE host_id = ?${status ? ' AND status = ?' : ''}`,
      status ? [hostId, status] : [hostId]
    );

    const total = countRows[0].total;
    const totalPages = Math.ceil(total / limitNum);

    return res.json({
      success: true,
      data: {
        properties: rows,
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
    console.error('❌ Error fetching host properties:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch properties',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

/**
 * Get properties for a specific host ID (public-ish endpoint)
 * NOTE: This was added to maintain backward compatibility with earlier frontend
 * code that requested /properties/host/:hostId. Unlike getHostProperties which
 * relies on authentication and req.userId, this endpoint uses a path parameter.
 * Only returns active (and pending) properties to avoid exposing drafts.
 */
export const getPropertiesByHostId = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { hostId } = req.params;
    if (!hostId) {
      return res.status(400).json({ success: false, message: 'hostId is required' });
    }

    const pool = getPool();
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT p.*, 
              (SELECT COUNT(*) FROM bookings WHERE property_id = p.id AND status = 'confirmed') as total_bookings,
              (SELECT AVG(rating) FROM reviews WHERE property_id = p.id AND review_type = 'property') as avg_rating,
              (SELECT image_url FROM property_images WHERE property_id = p.id AND is_primary = 1 LIMIT 1) as primary_image
       FROM properties p
       WHERE p.host_id = ? AND p.status IN ('active','pending')
       ORDER BY p.created_at DESC`,
      [hostId]
    );

    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('❌ Error fetching properties by host id:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch properties' });
  }
};