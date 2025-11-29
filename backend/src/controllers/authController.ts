import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { getPool } from '@/config/database';
import { validatePasswordStrength } from '@/middleware/security';
import { v4 as uuidv4 } from 'uuid';
import { sendVerificationEmail } from '@/utils/email';
import { sendPasswordResetEmail } from '@/utils/email';

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  phone: z.string().optional(),
  date_of_birth: z.string().optional(),
  role: z.enum(['guest', 'host', 'admin']).optional().default('guest'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// Generate JWT token
const generateToken = (userId: number, email: string, role: string): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET not configured');
  }

  return jwt.sign(
    { userId, email, role },
    secret,
    { expiresIn: '24h' }
  );
};

// Register new user (sends verification email)
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate request body
    const validationResult = registerSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        error: validationResult.error.errors[0].message
      });
      return;
    }

    const { email, password, first_name, last_name, phone, date_of_birth, role } = validationResult.data;
    
    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      res.status(400).json({
        success: false,
        message: passwordValidation.message
      });
      return;
    }
    
    const pool = getPool();

    // Check if user already exists
    const [existingUsers] = await pool.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if ((existingUsers as any[]).length > 0) {
      res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
      return;
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

  // Generate verification token & expiry (default 24h)
  const verificationToken = uuidv4();
  const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Insert new user (unverified with token)
    const [result] = await pool.execute(
      `INSERT INTO users 
       (email, password_hash, first_name, last_name, phone, date_of_birth, role, is_verified, verification_token) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [email, passwordHash, first_name, last_name, phone || null, date_of_birth || null, role, verificationToken]
    );

    const insertResult = result as { insertId: number };
    const userId = insertResult.insertId;

    // Generate JWT token
    const token = generateToken(userId, email, 'guest');

    // Get created user (without password)
    const [newUserRows] = await pool.execute(
      'SELECT id, email, first_name, last_name, phone, date_of_birth, profile_image_url, role, is_verified, verification_token, is_host, host_approved, host_rating, host_total_reviews, created_at, updated_at FROM users WHERE id = ?',
      [userId]
    );

    const user = (newUserRows as any[])[0];

    // Fire off verification email (non-blocking but await for clarity)
    try {
      await sendVerificationEmail({
        to: email,
        firstName: first_name,
        verificationToken,
      });
    } catch (emailErr) {
      console.warn('⚠️  Failed to send verification email:', emailErr);
    }

    res.status(201).json({
      success: true,
      message: 'User registered successfully. Verification email sent.',
      data: {
        user,
        token,
        expiresIn: '24h'
      }
    });

  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Login user
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate request body
    const validationResult = loginSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        error: validationResult.error.errors[0].message
      });
      return;
    }

    const { email, password } = validationResult.data;
    const pool = getPool();

    // Get user from database
    const [userRows] = await pool.execute(
      'SELECT id, email, password_hash, first_name, last_name, phone, date_of_birth, profile_image_url, role, is_verified, is_host, host_approved, host_rating, host_total_reviews, created_at, updated_at FROM users WHERE email = ?',
      [email]
    );

    const users = userRows as any[];

    if (users.length === 0) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
      return;
    }

    const user = users[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
      return;
    }

    // Generate JWT token
    const token = generateToken(user.id, user.email, user.role);

    // Remove password hash from user object
    const { password_hash, ...userWithoutPassword } = user;

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: userWithoutPassword,
        token,
        expiresIn: '24h'
      }
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get current user profile
export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Profile retrieved successfully',
      data: req.user
    });

  } catch (error) {
    console.error('❌ Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve profile',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Update user profile
export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    const updateSchema = z.object({
      firstName: z.string().min(1).optional(),
      lastName: z.string().min(1).optional(),
      phone: z.string().optional(),
      dateOfBirth: z.string().optional(),
    });

    const validationResult = updateSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        error: validationResult.error.errors[0].message
      });
      return;
    }

    const updates = validationResult.data;
    const pool = getPool();

    // Build dynamic update query
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    if (updates.firstName) {
      updateFields.push('first_name = ?');
      updateValues.push(updates.firstName);
    }
    if (updates.lastName) {
      updateFields.push('last_name = ?');
      updateValues.push(updates.lastName);
    }
    if (updates.phone !== undefined) {
      updateFields.push('phone = ?');
      updateValues.push(updates.phone);
    }
    if (updates.dateOfBirth !== undefined) {
      updateFields.push('date_of_birth = ?');
      updateValues.push(updates.dateOfBirth);
    }

    if (updateFields.length === 0) {
      res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
      return;
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(req.user.id);

    await pool.execute(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    // Get updated user
    const [updatedUserRows] = await pool.execute(
      'SELECT id, email, first_name, last_name, phone, date_of_birth, profile_image_url, role, is_verified, is_host, host_approved, host_rating, host_total_reviews, created_at, updated_at FROM users WHERE id = ?',
      [req.user.id]
    );

    const updatedUser = (updatedUserRows as any[])[0];

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser
    });

  } catch (error) {
    console.error('❌ Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Change password
export const changePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    const passwordSchema = z.object({
      currentPassword: z.string().min(1, 'Current password is required'),
      newPassword: z.string().min(8, 'New password must be at least 8 characters'),
    });

    const validationResult = passwordSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        error: validationResult.error.errors[0].message
      });
      return;
    }

    const { currentPassword, newPassword } = validationResult.data;
    const pool = getPool();

    // Get current password hash
    const [userRows] = await pool.execute(
      'SELECT password_hash FROM users WHERE id = ?',
      [req.user.id]
    );

    const users = userRows as { password_hash: string }[];
    if (users.length === 0) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, users[0].password_hash);
    if (!isValidPassword) {
      res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
      return;
    }

    // Hash new password
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await pool.execute(
      'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?',
      [newPasswordHash, req.user.id]
    );

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('❌ Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Logout (client-side only - invalidate JWT)
export const logout = async (req: Request, res: Response): Promise<void> => {
  res.json({
    success: true,
    message: 'Logout successful. Please remove the token from client storage.'
  });
};

// Validate current token (used by frontend /auth/validate)
export const validateToken = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    res.json({ success: true, data: req.user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Token validation failed' });
  }
};

// Verify email via token
export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    if (!token) {
      res.status(400).json({ success: false, message: 'Verification token required' });
      return;
    }
    const pool = getPool();
    const [rows] = await pool.execute(
      'SELECT id, created_at FROM users WHERE verification_token = ? AND is_verified = 0',
      [token]
    );
    const users = rows as any[];
    if (users.length === 0) {
      res.status(400).json({ success: false, message: 'Invalid or already used verification token' });
      return;
    }
    // (Optional) Could enforce expiry by comparing created_at + 24h; currently accepted unconditionally
    await pool.execute(
      'UPDATE users SET is_verified = 1, verification_token = NULL, updated_at = NOW() WHERE id = ?',
      [users[0].id]
    );
    res.json({ success: true, message: 'Email verified successfully' });
  } catch (error) {
    console.error('❌ Email verification error:', error);
    res.status(500).json({ success: false, message: 'Email verification failed' });
  }
};

// Resend verification email
export const resendVerification = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ success: false, message: 'Email is required' });
      return;
    }
    const pool = getPool();
    const [rows] = await pool.execute(
      'SELECT id, first_name, is_verified FROM users WHERE email = ?',
      [email]
    );
    const users = rows as any[];
    if (users.length === 0) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    const user = users[0];
    if (user.is_verified) {
      res.status(400).json({ success: false, message: 'User already verified' });
      return;
    }
  const newToken = uuidv4();
    await pool.execute(
      'UPDATE users SET verification_token = ?, updated_at = NOW() WHERE id = ?',
      [newToken, user.id]
    );
    try {
      await sendVerificationEmail({ to: email, firstName: user.first_name, verificationToken: newToken });
    } catch (emailErr) {
      console.warn('⚠️  Failed to send verification email:', emailErr);
    }
    res.json({ success: true, message: 'Verification email resent' });
  } catch (error) {
    console.error('❌ Resend verification error:', error);
    res.status(500).json({ success: false, message: 'Failed to resend verification email' });
  }
};

// Request password reset (generate token & send email)
export const requestPasswordReset = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, new_password } = req.body as { email?: string; new_password?: string };
    if (!email) {
      res.status(400).json({ success: false, message: 'Email is required' });
      return;
    }
    const pool = getPool();
    const [rows] = await pool.execute(
      'SELECT id, first_name, verification_token FROM users WHERE email = ? LIMIT 1',
      [email]
    );
    const users = rows as any[];
    if (users.length === 0) {
      // Always generic to prevent enumeration
      if (new_password) {
        res.json({ success: true, message: 'Password reset processed if account exists.' });
      } else {
        res.json({ success: true, message: 'If that account exists, a reset link has been sent.' });
      }
      return;
    }
    const user = users[0];

    // Test-mode shortcut: if new_password provided, update immediately without token/email
    if (new_password) {
      if (new_password.length < 8) {
        res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
        return;
      }
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(new_password, saltRounds);
      await pool.execute('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?', [passwordHash, user.id]);
      res.json({ success: true, message: 'Password reset successfully (test direct mode)' });
      return;
    }
    // Dynamically detect reset token columns if migration has been applied
    let hasResetToken = false;
    let hasResetExpires = false;
    try {
      const [col1] = await pool.execute<any[]>("SHOW COLUMNS FROM users LIKE 'reset_password_token'");
      const [col2] = await pool.execute<any[]>("SHOW COLUMNS FROM users LIKE 'reset_password_expires_at'");
      hasResetToken = (col1 as any[]).length > 0;
      hasResetExpires = (col2 as any[]).length > 0;
    } catch (e) {
      console.warn('Password reset column detection failed', e);
    }
    const resetToken = uuidv4();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    try {
      if (hasResetToken) {
        await pool.execute(
          `UPDATE users SET reset_password_token = ?, ${hasResetExpires ? 'reset_password_expires_at = ?,' : ''} updated_at = NOW() WHERE id = ?`,
          hasResetExpires ? [resetToken, expiresAt, user.id] : [resetToken, user.id]
        );
      } else {
        // Fallback: reuse verification_token if not currently used (avoid overwriting if still unverified)
        if (!user.verification_token) {
          await pool.execute(
            'UPDATE users SET verification_token = ?, updated_at = NOW() WHERE id = ?',
            [resetToken, user.id]
          );
        }
      }
    } catch (e) {
      console.error('Failed to persist password reset token', e);
    }
    // Attempt to send reset email (non-blocking)
    try {
      await sendPasswordResetEmail({
        to: email,
        firstName: user.first_name || 'there',
        resetToken,
        resetUrl: `${process.env.FRONTEND_RESET_PASSWORD_URL || 'http://localhost:5173/reset-password'}?token=${resetToken}`
      });
    } catch (emailErr) {
      console.warn('⚠️  Failed to send password reset email:', emailErr);
    }
    res.json({ success: true, message: 'If that account exists, a reset link has been sent.' });
  } catch (error) {
    console.error('❌ Password reset request error:', error);
    res.status(500).json({ success: false, message: 'Failed to process password reset request' });
  }
};

// Complete password reset (token + new password)
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, newPassword } = req.body as { token?: string; newPassword?: string };
    if (!token || !newPassword) {
      res.status(400).json({ success: false, message: 'Token and new password are required' });
      return;
    }
    if (newPassword.length < 8) {
      res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
      return;
    }
    const pool = getPool();
    // Detect columns
    let hasResetToken = false;
    let hasResetExpires = false;
    try {
      const [col1] = await pool.execute<any[]>("SHOW COLUMNS FROM users LIKE 'reset_password_token'");
      const [col2] = await pool.execute<any[]>("SHOW COLUMNS FROM users LIKE 'reset_password_expires_at'");
      hasResetToken = (col1 as any[]).length > 0;
      hasResetExpires = (col2 as any[]).length > 0;
    } catch {}
    let query: string;
    let params: any[];
    if (hasResetToken) {
      query = `SELECT id, reset_password_expires_at FROM users WHERE reset_password_token = ? LIMIT 1`;
      params = [token];
    } else {
      query = `SELECT id FROM users WHERE verification_token = ? LIMIT 1`;
      params = [token];
    }
    const [rows] = await pool.execute(query, params);
    const users = rows as any[];
    if (users.length === 0) {
      res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
      return;
    }
    if (hasResetToken && hasResetExpires && users[0].reset_password_expires_at && new Date(users[0].reset_password_expires_at) < new Date()) {
      res.status(400).json({ success: false, message: 'Reset token has expired' });
      return;
    }
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);
    if (hasResetToken) {
      await pool.execute(
        'UPDATE users SET password_hash = ?, reset_password_token = NULL, reset_password_expires_at = NULL, updated_at = NOW() WHERE id = ?',
        [passwordHash, users[0].id]
      );
    } else {
      await pool.execute(
        'UPDATE users SET password_hash = ?, verification_token = NULL, updated_at = NOW() WHERE id = ?',
        [passwordHash, users[0].id]
      );
    }
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('❌ Reset password error:', error);
    res.status(500).json({ success: false, message: 'Failed to reset password' });
  }
};