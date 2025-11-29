import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getPool } from '../config/database';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: any;
      userId?: number;
    }
  }
}

// JWT Authentication Middleware
export const authenticateToken = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️  authenticateToken: Missing Authorization header for', req.method, req.originalUrl);
      }
      res.status(401).json({
        success: false,
        message: 'Access token required'
      });
      return;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('❌ JWT_SECRET not configured');
      res.status(500).json({
        success: false,
        message: 'Server configuration error'
      });
      return;
    }

    // Verify JWT token
    const decoded = jwt.verify(token, secret) as any;
    
    // Get user from database
    const pool = getPool();
    const [rows] = await pool.execute(
      'SELECT id, email, first_name, last_name, role, is_verified, is_host, host_approved, host_rating, host_total_reviews, created_at, updated_at FROM users WHERE id = ?',
      [decoded.userId]
    );

    const users = rows as any[];
    
    if (users.length === 0) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️  authenticateToken: Token user not found id=', decoded.userId);
      }
      res.status(401).json({
        success: false,
        message: 'Invalid token - user not found'
      });
      return;
    }

    // Attach user to request
    req.user = users[0];
    req.userId = decoded.userId;
    
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️  authenticateToken: JWT error', error.message);
      }
      res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
      return;
    }
    
    if (error instanceof jwt.TokenExpiredError) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️  authenticateToken: Token expired');
      }
      res.status(401).json({
        success: false,
        message: 'Token expired'
      });
      return;
    }

    console.error('❌ Authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication failed'
    });
    return;
  }
};

// Role-based authorization middleware
export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): Response | void => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

// Admin-only middleware
export const requireAdmin = requireRole(['admin']);

// Host or Admin middleware
export const requireHostOrAdmin = requireRole(['host', 'admin']);

// Optional authentication (for endpoints that work with or without auth)
export const optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return next(); // Continue without authentication
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return next(); // Continue without authentication
    }

    const decoded = jwt.verify(token, secret) as any;
    
    const pool = getPool();
    const [rows] = await pool.execute(
      'SELECT id, email, first_name, last_name, role, is_verified, is_host, host_approved, host_rating, host_total_reviews, created_at, updated_at FROM users WHERE id = ?',
      [decoded.userId]
    );

    const users = rows as any[];
    
    if (users.length > 0) {
      req.user = users[0];
      req.userId = decoded.userId;
    }
    
    next();
  } catch (error) {
    // Continue without authentication if token is invalid
    next();
  }
};