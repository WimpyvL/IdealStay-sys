import { Request, Response } from 'express';
import { getPool } from '../config/database';
import { RowDataPacket } from 'mysql2';

export const getMe = async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }
  return res.json({ success: true, data: req.user });
};

export const getProfile = async (req: Request, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const pool = getPool();
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, email, first_name, last_name, phone, profile_image_url, date_of_birth,
              role, is_verified, is_host, host_approved, created_at, updated_at
       FROM users WHERE id = ?`,
      [req.userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('❌ Error fetching profile:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { first_name, last_name, email, phone, date_of_birth, profile_image_url } = req.body;

    // Validate required fields
    if (!first_name || !last_name || !email) {
      return res.status(400).json({ success: false, message: 'First name, last name, and email are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }

    const pool = getPool();

    // Check if email is already taken by another user
    const [emailCheck] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM users WHERE email = ? AND id != ?',
      [email, req.userId]
    );

    if (emailCheck.length > 0) {
      return res.status(400).json({ success: false, message: 'Email is already in use by another account' });
    }

    // Update user profile
    await pool.execute(
      `UPDATE users SET
        first_name = ?,
        last_name = ?,
        email = ?,
        phone = ?,
        date_of_birth = ?,
        profile_image_url = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [first_name, last_name, email, phone || null, date_of_birth || null, profile_image_url || null, req.userId]
    );

    // Fetch updated user
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, email, first_name, last_name, phone, profile_image_url, date_of_birth,
              role, is_verified, is_host, host_approved, created_at, updated_at
       FROM users WHERE id = ?`,
      [req.userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found after update' });
    }

    return res.json({ success: true, message: 'Profile updated successfully', data: rows[0] });
  } catch (error) {
    console.error('❌ Error updating profile:', error);
    return res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
};

export const becomeHost = async (req: Request, res: Response) => {
  try {
    if (!req.user || !req.userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const pool = getPool();

    // Update user to host (auto-approve for now; could add review workflow later)
    await pool.execute(
      `UPDATE users SET role = 'host', is_host = 1, host_approved = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [req.userId]
    );

    // Fetch updated user
    const [rows] = await pool.execute(
      'SELECT id, email, first_name, last_name, role, is_host, host_approved, host_rating, host_total_reviews, created_at, updated_at FROM users WHERE id = ?',
      [req.userId]
    );

    const users = rows as any[];
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found after update' });
    }

    return res.json({ success: true, message: 'Upgraded to host successfully', data: users[0] });
  } catch (error) {
    console.error('❌ Error upgrading to host:', error);
    return res.status(500).json({ success: false, message: 'Failed to upgrade to host' });
  }
};
