/**
 * Admin Amenity Controller
 * Handles CRUD operations for amenities and platform settings
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
// AMENITY MANAGEMENT
// ============================================================

/**
 * Get all amenities with usage statistics
 * GET /api/admin/amenities
 */
export const getAllAmenities = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const pool = getPool();

    const [amenities] = await pool.execute<RowDataPacket[]>(
      `SELECT
         a.*,
         COUNT(DISTINCT pa.property_id) as properties_count
       FROM amenities a
       LEFT JOIN property_amenities pa ON a.id = pa.amenity_id
       GROUP BY a.id
       ORDER BY a.category, a.name`
    );

    return res.json({
      success: true,
      data: amenities
    });
  } catch (error) {
    console.error('❌ Error fetching amenities:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch amenities'
    });
  }
};

/**
 * Create new amenity
 * POST /api/admin/amenities
 */
export const createAmenity = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const pool = getPool();
    const { name, icon, category, description, is_active = true } = req.body;
    const adminId = req.user?.id || req.user?.userId;

    if (!name || !category) {
      return res.status(400).json({
        success: false,
        message: 'Name and category are required'
      });
    }

    // Check if amenity with same name exists
    const [existing] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM amenities WHERE name = ?',
      [name]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Amenity with this name already exists'
      });
    }

    // Create amenity
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO amenities (name, icon, category, description, is_active)
       VALUES (?, ?, ?, ?, ?)`,
      [name, icon || null, category, description || null, is_active ? 1 : 0]
    );

    // Log admin action
    await pool.execute(
      `INSERT INTO admin_actions_log (admin_user_id, action, target_type, target_id, description)
       VALUES (?, 'create_amenity', 'amenity', ?, ?)`,
      [adminId, result.insertId, `Created amenity: ${name}`]
    );

    return res.json({
      success: true,
      message: 'Amenity created successfully',
      data: {
        id: result.insertId,
        name,
        icon,
        category,
        description,
        is_active
      }
    });
  } catch (error) {
    console.error('❌ Error creating amenity:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create amenity'
    });
  }
};

/**
 * Update amenity
 * PUT /api/admin/amenities/:id
 */
export const updateAmenity = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { name, icon, category, description, is_active } = req.body;
    const adminId = req.user?.id || req.user?.userId;

    // Check if amenity exists
    const [existing] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM amenities WHERE id = ?',
      [id]
    );

    if (!existing.length) {
      return res.status(404).json({
        success: false,
        message: 'Amenity not found'
      });
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (icon !== undefined) {
      updates.push('icon = ?');
      values.push(icon);
    }
    if (category !== undefined) {
      updates.push('category = ?');
      values.push(category);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(is_active ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    values.push(id);

    await pool.execute(
      `UPDATE amenities SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Log admin action
    await pool.execute(
      `INSERT INTO admin_actions_log (admin_user_id, action, target_type, target_id, description)
       VALUES (?, 'update_amenity', 'amenity', ?, ?)`,
      [adminId, id, `Updated amenity #${id}`]
    );

    return res.json({
      success: true,
      message: 'Amenity updated successfully'
    });
  } catch (error) {
    console.error('❌ Error updating amenity:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update amenity'
    });
  }
};

/**
 * Delete/deactivate amenity
 * DELETE /api/admin/amenities/:id
 */
export const deleteAmenity = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { permanent = false } = req.query;
    const adminId = req.user?.id || req.user?.userId;

    // Check if amenity exists
    const [existing] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM amenities WHERE id = ?',
      [id]
    );

    if (!existing.length) {
      return res.status(404).json({
        success: false,
        message: 'Amenity not found'
      });
    }

    // Check if amenity is in use
    const [usage] = await pool.execute<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM property_amenities WHERE amenity_id = ?',
      [id]
    );

    if (usage[0].count > 0 && permanent === 'true') {
      return res.status(400).json({
        success: false,
        message: `Cannot delete amenity. It is used by ${usage[0].count} properties. Consider deactivating instead.`
      });
    }

    if (permanent === 'true') {
      // Permanent delete
      await pool.execute('DELETE FROM amenities WHERE id = ?', [id]);

      // Log admin action
      await pool.execute(
        `INSERT INTO admin_actions_log (admin_user_id, action, target_type, target_id, description)
         VALUES (?, 'delete_amenity', 'amenity', ?, ?)`,
        [adminId, id, `Permanently deleted amenity #${id}`]
      );

      return res.json({
        success: true,
        message: 'Amenity deleted permanently'
      });
    } else {
      // Soft delete (deactivate)
      await pool.execute('UPDATE amenities SET is_active = 0 WHERE id = ?', [id]);

      // Log admin action
      await pool.execute(
        `INSERT INTO admin_actions_log (admin_user_id, action, target_type, target_id, description)
         VALUES (?, 'deactivate_amenity', 'amenity', ?, ?)`,
        [adminId, id, `Deactivated amenity #${id}`]
      );

      return res.json({
        success: true,
        message: 'Amenity deactivated successfully'
      });
    }
  } catch (error) {
    console.error('❌ Error deleting amenity:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete amenity'
    });
  }
};

// ============================================================
// PLATFORM SETTINGS
// ============================================================

/**
 * Get all platform settings
 * GET /api/admin/settings
 */
export const getSettings = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const pool = getPool();

    const [settings] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM platform_settings ORDER BY setting_key`
    );

    // Format settings for easier consumption
    const formattedSettings: { [key: string]: any } = {};
    settings.forEach((setting: any) => {
      let value = setting.setting_value;

      // Parse value based on type
      switch (setting.setting_type) {
        case 'number':
          value = parseFloat(value);
          break;
        case 'boolean':
          value = value === 'true' || value === '1';
          break;
        case 'json':
          try {
            value = JSON.parse(value);
          } catch (e) {
            // Keep as string if JSON parse fails
          }
          break;
      }

      formattedSettings[setting.setting_key] = {
        value,
        type: setting.setting_type,
        description: setting.description,
        updated_at: setting.updated_at
      };
    });

    return res.json({
      success: true,
      data: formattedSettings
    });
  } catch (error) {
    console.error('❌ Error fetching settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch settings'
    });
  }
};

/**
 * Update platform settings
 * PUT /api/admin/settings
 */
export const updateSettings = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const pool = getPool();
    const settings = req.body;
    const adminId = req.user?.id || req.user?.userId;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Invalid settings format'
      });
    }

    // Update each setting
    for (const [key, value] of Object.entries(settings)) {
      // Convert value to string based on type
      let stringValue: string;
      let settingType: string;

      if (typeof value === 'boolean') {
        stringValue = value ? 'true' : 'false';
        settingType = 'boolean';
      } else if (typeof value === 'number') {
        stringValue = value.toString();
        settingType = 'number';
      } else if (typeof value === 'object') {
        stringValue = JSON.stringify(value);
        settingType = 'json';
      } else {
        stringValue = String(value);
        settingType = 'string';
      }

      // Update or insert setting
      await pool.execute(
        `INSERT INTO platform_settings (setting_key, setting_value, setting_type, updated_by_user_id)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           setting_value = VALUES(setting_value),
           setting_type = VALUES(setting_type),
           updated_by_user_id = VALUES(updated_by_user_id),
           updated_at = CURRENT_TIMESTAMP`,
        [key, stringValue, settingType, adminId]
      );
    }

    // Log admin action
    await pool.execute(
      `INSERT INTO admin_actions_log (admin_user_id, action, target_type, target_id, description, changes)
       VALUES (?, 'update_settings', 'settings', NULL, ?, ?)`,
      [adminId, 'Updated platform settings', JSON.stringify(settings)]
    );

    return res.json({
      success: true,
      message: 'Settings updated successfully'
    });
  } catch (error) {
    console.error('❌ Error updating settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update settings'
    });
  }
};

/**
 * Get admin actions log
 * GET /api/admin/logs
 */
export const getAdminLogs = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const pool = getPool();
    const {
      action,
      admin_id,
      page = '1',
      limit = '50'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    let query = `
      SELECT aal.*,
             u.first_name, u.last_name, u.email
      FROM admin_actions_log aal
      LEFT JOIN users u ON aal.admin_user_id = u.id
      WHERE 1=1
    `;

    const queryParams: any[] = [];

    if (action) {
      query += ` AND aal.action = ?`;
      queryParams.push(action);
    }

    if (admin_id) {
      query += ` AND aal.admin_user_id = ?`;
      queryParams.push(admin_id);
    }

    query += ` ORDER BY aal.created_at DESC LIMIT ? OFFSET ?`;
    queryParams.push(limitNum, offset);

    const [logs] = await pool.execute<RowDataPacket[]>(query, queryParams);

    // Get total count
    let countQuery = `SELECT COUNT(*) as total FROM admin_actions_log WHERE 1=1`;
    const countParams: any[] = [];

    if (action) {
      countQuery += ` AND action = ?`;
      countParams.push(action);
    }

    if (admin_id) {
      countQuery += ` AND admin_user_id = ?`;
      countParams.push(admin_id);
    }

    const [countResult] = await pool.execute<RowDataPacket[]>(countQuery, countParams);
    const total = countResult[0]?.total || 0;

    return res.json({
      success: true,
      data: {
        logs,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          total_pages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    console.error('❌ Error fetching admin logs:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch admin logs'
    });
  }
};