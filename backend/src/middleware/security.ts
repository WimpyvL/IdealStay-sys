/**
 * Security Hardening and Audit for Ideal Stay V3
 * Comprehensive security review and implementation of best practices
 */

import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// ==================================================
// RATE LIMITING CONFIGURATIONS
// ==================================================

/**
 * General API rate limiter
 */
// Environment-driven disabling of rate limiting. If RATE_LIMIT_DISABLED=true, we effectively
// no-op the limiter. Otherwise we set extremely high thresholds when RATE_LIMIT_MODE=relaxed.
const RATE_LIMIT_DISABLED = process.env.RATE_LIMIT_DISABLED === 'true';
const RATE_LIMIT_MODE = process.env.RATE_LIMIT_MODE || 'default'; // default | relaxed

export const generalLimiter = RATE_LIMIT_DISABLED
  ? ((req: any, _res: any, next: any) => next())
  : rateLimit({
      windowMs: RATE_LIMIT_MODE === 'relaxed' ? 60 * 1000 : 15 * 60 * 1000,
      // In relaxed mode allow very high burst, otherwise fall back to legacy default.
      max: RATE_LIMIT_MODE === 'relaxed' ? 10000 : 100,
      message: {
        success: false,
        error: 'Too many requests, please try again later.',
        retryAfter: RATE_LIMIT_MODE === 'relaxed' ? 60 : 15 * 60
      },
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => {
        // Skip rate limiting for health checks AND always skip in development for convenience
        if (req.path === '/health') return true;
        if (process.env.NODE_ENV === 'development') return true;
        return false;
      }
    });

/**
 * Strict rate limiter for authentication endpoints
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 auth attempts per 15 minutes
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

/**
 * File upload rate limiter
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // Limit each IP to 5 uploads per minute
  message: {
    success: false,
    error: 'Upload rate limit exceeded, please wait before uploading again.',
    retryAfter: 60
  }
});

// ==================================================
// INPUT VALIDATION & SANITIZATION
// ==================================================

/**
 * SQL Injection protection middleware
 */
export const sqlInjectionProtection = (req: Request, res: Response, next: NextFunction): void => {
  const checkSQLInjection = (value: any): boolean => {
    if (typeof value !== 'string') return false;
    
    // Common SQL injection patterns
    const sqlInjectionPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
      /(--|#|\/\*|\*\/)/gi,
      /(\b(OR|AND)\b.*\b(=|<|>)\b.*('|"))/gi,
      /('|(\\x27)|(\\x2D\\x2D))/gi,
      /(\\x3C\\x73\\x63\\x72\\x69\\x70\\x74)/gi
    ];
    
    return sqlInjectionPatterns.some(pattern => pattern.test(value));
  };

  const checkAllValues = (obj: any): boolean => {
    if (Array.isArray(obj)) {
      return obj.some(item => checkAllValues(item));
    } else if (obj && typeof obj === 'object') {
      return Object.values(obj).some(value => checkAllValues(value));
    }
    return checkSQLInjection(obj);
  };

  // Check all input sources
  const hasInjection = checkAllValues(req.body) || 
                       checkAllValues(req.query) || 
                       checkAllValues(req.params);

  if (hasInjection) {
    console.warn(`🚨 Potential SQL injection attempt from IP: ${req.ip}`);
    res.status(400).json({
      success: false,
      error: 'Invalid input detected'
    });
    return;
  }

  next();
};

/**
 * XSS Protection middleware
 */
export const xssProtection = (req: Request, res: Response, next: NextFunction): void => {
  const sanitizeString = (value: any): any => {
    if (typeof value === 'string') {
      // Remove potentially dangerous HTML/JavaScript
      return value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
        .replace(/on\w+\s*=\s*'[^']*'/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
    }
    return value;
  };

  const sanitizeObject = (obj: any): any => {
    if (Array.isArray(obj)) {
      return obj.map(item => sanitizeObject(item));
    } else if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitizeObject(value);
      }
      return sanitized;
    }
    return sanitizeString(obj);
  };

  // Sanitize all inputs
  req.body = sanitizeObject(req.body);
  req.query = sanitizeObject(req.query);

  next();
};

// ==================================================
// SECURITY HEADERS MIDDLEWARE
// ==================================================

/**
 * Enhanced security headers
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self'; " +
    "font-src 'self'; " +
    "object-src 'none'; " +
    "media-src 'self'; " +
    "frame-src 'none';"
  );
  
  // Strict Transport Security (HTTPS only)
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  next();
};

// ==================================================
// PASSWORD SECURITY
// ==================================================

/**
 * Password strength validation
 */
export const validatePasswordStrength = (password: string): { valid: boolean; message?: string } => {
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }
  
  if (!/(?=.*[a-z])/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter' };
  }
  
  if (!/(?=.*[A-Z])/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }
  
  if (!/(?=.*\d)/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }
  
  if (!/(?=.*[@$!%*?&])/.test(password)) {
    return { valid: false, message: 'Password must contain at least one special character (@$!%*?&)' };
  }
  
  // Check for common weak passwords
  const commonPasswords = [
    'password', '123456', '123456789', 'qwerty', 'abc123', 
    'password123', 'admin', 'letmein', 'welcome', 'monkey'
  ];
  
  if (commonPasswords.includes(password.toLowerCase())) {
    return { valid: false, message: 'Password is too common, please choose a stronger password' };
  }
  
  return { valid: true };
};

// ==================================================
// API KEY SECURITY
// ==================================================

/**
 * Generate secure API keys
 */
export const generateApiKey = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Hash API keys for storage
 */
export const hashApiKey = (apiKey: string): string => {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
};

// ==================================================
// REQUEST LOGGING FOR SECURITY MONITORING
// ==================================================

/**
 * Security logging middleware
 */
export const securityLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  
  // Log suspicious activity
  const suspiciousPatterns = [
    /\.\./g, // Path traversal
    /\/etc\/passwd/g, // System file access
    /\bscript\b/gi, // Script injection
    /<.*>/g, // HTML/XML injection
  ];
  
  const requestString = JSON.stringify({
    url: req.originalUrl,
    body: req.body,
    query: req.query,
    headers: req.headers
  });
  
  const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(requestString));
  
  if (isSuspicious) {
    console.warn(`🚨 SECURITY: Suspicious request from ${req.ip}:`, {
      method: req.method,
      url: req.originalUrl,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString()
    });
  }
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    // Log failed authentication attempts
    if (req.path.includes('/auth/') && res.statusCode >= 400) {
      console.warn(`🚨 AUTH FAILURE: ${req.ip} - ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    }
    
    // Log admin access attempts
    if (req.path.includes('/admin/') || req.path.includes('/analytics/admin/')) {
      console.info(`🔐 ADMIN ACCESS: ${req.ip} - ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    }
  });
  
  next();
};

// ==================================================
// FILE UPLOAD SECURITY
// ==================================================

/**
 * Validate file uploads for security
 */
export const validateFileUpload = (file: any): { valid: boolean; message?: string } => {
  // Check file size (10MB limit)
  if (file.size > 10 * 1024 * 1024) {
    return { valid: false, message: 'File size exceeds 10MB limit' };
  }
  
  // Check file type
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/webp',
    'image/gif'
  ];
  
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return { valid: false, message: 'Invalid file type. Only images are allowed.' };
  }
  
  // Check file extension
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
  
  if (!allowedExtensions.includes(fileExtension)) {
    return { valid: false, message: 'Invalid file extension' };
  }
  
  return { valid: true };
};

// ==================================================
// EXPORT ALL SECURITY MODULES
// ==================================================

export default {
  // Rate limiters
  generalLimiter,
  authLimiter,
  uploadLimiter,
  
  // Security middleware
  sqlInjectionProtection,
  xssProtection,
  securityHeaders,
  securityLogger,
  
  // Validation
  validatePasswordStrength,
  validateFileUpload,
  
  // API security
  generateApiKey,
  hashApiKey,
};