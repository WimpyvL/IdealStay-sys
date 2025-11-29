import { Request, Response } from 'express';
import { getPool } from '../config/database';
import { Amenity, AmenityCategory } from '../types';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

/**
 * Get all amenities (public endpoint)
 */
export const getAmenities = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { category, active_only = 'true' } = req.query;
    const pool = getPool();

    let query = 'SELECT * FROM amenities';
    const queryParams: any[] = [];
    const conditions: string[] = [];

    // Filter by active status
    if (active_only === 'true') {
      conditions.push('is_active = ?');
      queryParams.push(true);
    }

    // Filter by category
    if (category && typeof category === 'string') {
      conditions.push('category = ?');
      queryParams.push(category);
    }

    // Add WHERE clause if there are conditions
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Order by category and name
    query += ' ORDER BY category, name';

    const [rows] = await pool.execute<RowDataPacket[]>(query, queryParams);

    // Group amenities by category for easier frontend consumption
    const groupedAmenities: Record<string, any[]> = {};
    
    rows.forEach((amenity: any) => {
      if (!groupedAmenities[amenity.category]) {
        groupedAmenities[amenity.category] = [];
      }
      groupedAmenities[amenity.category].push(amenity);
    });

    return res.json({
      success: true,
      data: {
        amenities: rows,
        grouped: groupedAmenities,
        categories: Object.keys(groupedAmenities),
        total: rows.length
      }
    });

  } catch (error) {
    console.error('❌ Error fetching amenities:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch amenities',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

/**
 * Get amenities for a specific property
 */
export const getPropertyAmenities = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { propertyId } = req.params;
    const pool = getPool();

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT a.* FROM amenities a
       JOIN property_amenities pa ON a.id = pa.amenity_id
       WHERE pa.property_id = ? AND a.is_active = 1
       ORDER BY a.category, a.name`,
      [propertyId]
    );

    // Group by category
    const groupedAmenities: Record<string, any[]> = {};
    
    rows.forEach((amenity: any) => {
      if (!groupedAmenities[amenity.category]) {
        groupedAmenities[amenity.category] = [];
      }
      groupedAmenities[amenity.category].push(amenity);
    });

    return res.json({
      success: true,
      data: {
        amenities: rows,
        grouped: groupedAmenities,
        categories: Object.keys(groupedAmenities),
        total: rows.length
      }
    });

  } catch (error) {
    console.error('❌ Error fetching property amenities:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch property amenities',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

/**
 * Assign amenities to a property (hosts and admins only)
 */
export const assignPropertyAmenities = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { propertyId } = req.params;
    const { amenity_ids } = req.body;
    const userId = req.userId;
    const userRole = req.user?.role;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!Array.isArray(amenity_ids)) {
      return res.status(400).json({
        success: false,
        message: 'amenity_ids must be an array'
      });
    }

    const pool = getPool();

    // Verify property exists and user has permission
    const [propertyRows] = await pool.execute<RowDataPacket[]>(
      'SELECT host_id FROM properties WHERE id = ?',
      [propertyId]
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
        message: 'You can only manage amenities for your own properties'
      });
    }

    // Validate amenity IDs exist and are active
    if (amenity_ids.length > 0) {
      const placeholders = amenity_ids.map(() => '?').join(',');
      const [validAmenities] = await pool.execute<RowDataPacket[]>(
        `SELECT id FROM amenities WHERE id IN (${placeholders}) AND is_active = 1`,
        amenity_ids
      );

      if (validAmenities.length !== amenity_ids.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more amenity IDs are invalid or inactive'
        });
      }
    }

    // Remove existing amenities for this property
    await pool.execute(
      'DELETE FROM property_amenities WHERE property_id = ?',
      [propertyId]
    );

    // Add new amenities
    if (amenity_ids.length > 0) {
      const values = amenity_ids.map((amenityId: number) => [propertyId, amenityId]);
      const placeholders = values.map(() => '(?, ?)').join(', ');
      
      await pool.execute(
        `INSERT INTO property_amenities (property_id, amenity_id) VALUES ${placeholders}`,
        values.flat()
      );
    }

    // Fetch updated amenities
    const [updatedAmenities] = await pool.execute<RowDataPacket[]>(
      `SELECT a.* FROM amenities a
       JOIN property_amenities pa ON a.id = pa.amenity_id
       WHERE pa.property_id = ?
       ORDER BY a.category, a.name`,
      [propertyId]
    );

    return res.json({
      success: true,
      message: 'Property amenities updated successfully',
      data: {
        amenities: updatedAmenities,
        assigned_count: amenity_ids.length
      }
    });

  } catch (error) {
    console.error('❌ Error assigning amenities:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to assign amenities',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

/**
 * Create a new amenity (admin only)
 */
export const createAmenity = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { name, icon, category, description } = req.body;
    const userRole = req.user?.role;

    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can create amenities'
      });
    }

    // Validate required fields
    if (!name || !category) {
      return res.status(400).json({
        success: false,
        message: 'Name and category are required'
      });
    }

    // Validate category
    const validCategories: AmenityCategory[] = ['basic', 'safety', 'luxury', 'outdoor', 'family'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: `Invalid category. Must be one of: ${validCategories.join(', ')}`
      });
    }

    const pool = getPool();

    // Check if amenity name already exists
    const [existingRows] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM amenities WHERE LOWER(name) = LOWER(?)',
      [name]
    );

    if (existingRows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'An amenity with this name already exists'
      });
    }

    // Insert new amenity
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO amenities (name, icon, category, description, is_active)
       VALUES (?, ?, ?, ?, ?)`,
      [name, icon || null, category, description || null, true]
    );

    // Fetch the created amenity
    const [newAmenity] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM amenities WHERE id = ?',
      [result.insertId]
    );

    return res.status(201).json({
      success: true,
      message: 'Amenity created successfully',
      data: newAmenity[0]
    });

  } catch (error) {
    console.error('❌ Error creating amenity:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create amenity',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

/**
 * Update an amenity (admin only)
 */
export const updateAmenity = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const { name, icon, category, description, is_active } = req.body;
    const userRole = req.user?.role;

    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can update amenities'
      });
    }

    const pool = getPool();

    // Check if amenity exists
    const [existingRows] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM amenities WHERE id = ?',
      [id]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Amenity not found'
      });
    }

    // Build update query
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    if (name !== undefined) {
      // Check if new name conflicts with existing amenity
      const [nameCheckRows] = await pool.execute<RowDataPacket[]>(
        'SELECT id FROM amenities WHERE LOWER(name) = LOWER(?) AND id != ?',
        [name, id]
      );

      if (nameCheckRows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'An amenity with this name already exists'
        });
      }

      updateFields.push('name = ?');
      updateValues.push(name);
    }

    if (icon !== undefined) {
      updateFields.push('icon = ?');
      updateValues.push(icon);
    }

    if (category !== undefined) {
      const validCategories: AmenityCategory[] = ['basic', 'safety', 'luxury', 'outdoor', 'family'];
      if (!validCategories.includes(category)) {
        return res.status(400).json({
          success: false,
          message: `Invalid category. Must be one of: ${validCategories.join(', ')}`
        });
      }
      updateFields.push('category = ?');
      updateValues.push(category);
    }

    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description);
    }

    if (is_active !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(is_active);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    updateValues.push(id);

    // Execute update
    await pool.execute(
      `UPDATE amenities SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    // Fetch updated amenity
    const [updatedAmenity] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM amenities WHERE id = ?',
      [id]
    );

    return res.json({
      success: true,
      message: 'Amenity updated successfully',
      data: updatedAmenity[0]
    });

  } catch (error) {
    console.error('❌ Error updating amenity:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update amenity',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

/**
 * Delete an amenity (admin only)
 */
export const deleteAmenity = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const userRole = req.user?.role;

    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can delete amenities'
      });
    }

    const pool = getPool();

    // Check if amenity exists
    const [existingRows] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM amenities WHERE id = ?',
      [id]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Amenity not found'
      });
    }

    // Check if amenity is used by any properties
    const [usageRows] = await pool.execute<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM property_amenities WHERE amenity_id = ?',
      [id]
    );

    const usageCount = usageRows[0].count;

    if (usageCount > 0) {
      // Don't hard delete if in use, just deactivate
      await pool.execute(
        'UPDATE amenities SET is_active = FALSE WHERE id = ?',
        [id]
      );

      return res.json({
        success: true,
        message: `Amenity deactivated (was used by ${usageCount} properties)`
      });
    } else {
      // Safe to hard delete
      await pool.execute('DELETE FROM amenities WHERE id = ?', [id]);

      return res.json({
        success: true,
        message: 'Amenity deleted successfully'
      });
    }

  } catch (error) {
    console.error('❌ Error deleting amenity:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete amenity',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

/**
 * Get amenity usage statistics (admin only)
 */
export const getAmenityStats = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userRole = req.user?.role;

    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can view amenity statistics'
      });
    }

    const pool = getPool();

    // Get usage statistics
    const [statsRows] = await pool.execute<RowDataPacket[]>(
      `SELECT 
         a.id,
         a.name,
         a.category,
         a.is_active,
         COUNT(pa.property_id) as usage_count,
         (COUNT(pa.property_id) / (SELECT COUNT(*) FROM properties WHERE status = 'active')) * 100 as usage_percentage
       FROM amenities a
       LEFT JOIN property_amenities pa ON a.id = pa.amenity_id
       LEFT JOIN properties p ON pa.property_id = p.id AND p.status = 'active'
       GROUP BY a.id, a.name, a.category, a.is_active
       ORDER BY usage_count DESC, a.name`
    );

    // Get category distribution
    const [categoryRows] = await pool.execute<RowDataPacket[]>(
      `SELECT 
         a.category,
         COUNT(*) as total_amenities,
         SUM(CASE WHEN a.is_active = 1 THEN 1 ELSE 0 END) as active_amenities,
         AVG(usage_stats.usage_count) as avg_usage
       FROM amenities a
       LEFT JOIN (
         SELECT pa.amenity_id, COUNT(pa.property_id) as usage_count
         FROM property_amenities pa
         JOIN properties p ON pa.property_id = p.id AND p.status = 'active'
         GROUP BY pa.amenity_id
       ) usage_stats ON a.id = usage_stats.amenity_id
       GROUP BY a.category
       ORDER BY total_amenities DESC`
    );

    return res.json({
      success: true,
      data: {
        amenity_stats: statsRows,
        category_distribution: categoryRows,
        total_amenities: statsRows.length,
        active_amenities: statsRows.filter(row => row.is_active).length
      }
    });

  } catch (error) {
    console.error('❌ Error fetching amenity stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch amenity statistics',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};