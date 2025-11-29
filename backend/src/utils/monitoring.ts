/**
 * Comprehensive Logging and Monitoring System
 * Production-ready logging with different levels and outputs
 */

import fs from 'fs';
import path from 'path';
import { Request, Response, NextFunction } from 'express';

// ==================================================
// LOGGING LEVELS AND CONFIGURATION
// ==================================================

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  metadata?: any;
  requestId?: string;
  userId?: number;
  ip?: string;
  userAgent?: string;
}

class Logger {
  private logLevel: LogLevel;
  private logToFile: boolean;
  private logDirectory: string;
  
  constructor() {
    this.logLevel = this.getLogLevel();
    this.logToFile = process.env.LOG_TO_FILE === 'true';
    this.logDirectory = path.join(process.cwd(), 'logs');
    
    // Create logs directory if it doesn't exist
    if (this.logToFile && !fs.existsSync(this.logDirectory)) {
      fs.mkdirSync(this.logDirectory, { recursive: true });
    }
  }

  private getLogLevel(): LogLevel {
    const level = process.env.LOG_LEVEL?.toLowerCase() || 'info';
    switch (level) {
      case 'error': return LogLevel.ERROR;
      case 'warn': return LogLevel.WARN;
      case 'info': return LogLevel.INFO;
      case 'debug': return LogLevel.DEBUG;
      default: return LogLevel.INFO;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.logLevel;
  }

  private formatLogEntry(level: string, message: string, metadata?: any, context?: any): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
      metadata,
      requestId: context?.requestId,
      userId: context?.userId,
      ip: context?.ip,
      userAgent: context?.userAgent
    };
  }

  private writeLog(entry: LogEntry): void {
    const logLine = JSON.stringify(entry) + '\n';
    
    // Console output with colors
    const colors = {
      ERROR: '\x1b[31m', // Red
      WARN: '\x1b[33m',  // Yellow
      INFO: '\x1b[36m',  // Cyan
      DEBUG: '\x1b[37m', // White
      RESET: '\x1b[0m'
    };
    
    const color = colors[entry.level as keyof typeof colors] || colors.RESET;
    console.log(`${color}[${entry.timestamp}] ${entry.level}: ${entry.message}${colors.RESET}`);
    
    if (entry.metadata) {
      console.log(`${color}Metadata:`, entry.metadata, colors.RESET);
    }

    // File output
    if (this.logToFile) {
      const logFile = path.join(this.logDirectory, `${entry.level.toLowerCase()}.log`);
      fs.appendFileSync(logFile, logLine);
      
      // Also write to combined log
      const combinedLogFile = path.join(this.logDirectory, 'combined.log');
      fs.appendFileSync(combinedLogFile, logLine);
    }
  }

  error(message: string, metadata?: any, context?: any): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      this.writeLog(this.formatLogEntry('ERROR', message, metadata, context));
    }
  }

  warn(message: string, metadata?: any, context?: any): void {
    if (this.shouldLog(LogLevel.WARN)) {
      this.writeLog(this.formatLogEntry('WARN', message, metadata, context));
    }
  }

  info(message: string, metadata?: any, context?: any): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.writeLog(this.formatLogEntry('INFO', message, metadata, context));
    }
  }

  debug(message: string, metadata?: any, context?: any): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.writeLog(this.formatLogEntry('DEBUG', message, metadata, context));
    }
  }
}

// Global logger instance
export const logger = new Logger();

// ==================================================
// REQUEST LOGGING MIDDLEWARE
// ==================================================

/**
 * Enhanced request logging middleware
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  // Generate unique request ID
  const requestId = Math.random().toString(36).substring(2, 15);
  req.requestId = requestId;
  
  const startTime = Date.now();
  
  // Log request
  logger.info('Incoming request', {
    method: req.method,
    url: req.originalUrl,
    headers: {
      'user-agent': req.headers['user-agent'],
      'content-type': req.headers['content-type'],
      'authorization': req.headers.authorization ? 'Bearer [REDACTED]' : undefined
    },
    query: req.query,
    body: req.method === 'POST' || req.method === 'PUT' ? 
      sanitizeLogData(req.body) : undefined
  }, {
    requestId,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logLevel = res.statusCode >= 400 ? 'error' : 'info';
    
    logger[logLevel as 'error' | 'info'](`Request completed`, {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('content-length')
    }, {
      requestId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      userId: (req as any).user?.userId
    });
  });

  next();
};

// ==================================================
// ERROR MONITORING AND TRACKING
// ==================================================

/**
 * Enhanced error handler with comprehensive logging
 */
export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction): void => {
  const errorId = Math.random().toString(36).substring(2, 15);
  
  // Determine error type and status code
  let statusCode = 500;
  let errorType = 'InternalServerError';
  
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorType = 'ValidationError';
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    errorType = 'UnauthorizedError';
  } else if (err.name === 'ForbiddenError') {
    statusCode = 403;
    errorType = 'ForbiddenError';
  } else if (err.name === 'NotFoundError') {
    statusCode = 404;
    errorType = 'NotFoundError';
  }

  // Log error with full context
  logger.error('Application error', {
    errorId,
    errorType,
    message: err.message,
    stack: err.stack,
    request: {
      method: req.method,
      url: req.originalUrl,
      headers: sanitizeHeaders(req.headers),
      query: req.query,
      body: sanitizeLogData(req.body)
    }
  }, {
    requestId: req.requestId,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    userId: (req as any).user?.userId
  });

  // Send error response
  const errorResponse = {
    success: false,
    error: statusCode === 500 ? 'Internal server error' : err.message,
    errorId: errorId,
    timestamp: new Date().toISOString()
  };

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    (errorResponse as any).stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
};

// ==================================================
// DATABASE MONITORING
// ==================================================

/**
 * Database operation logger
 */
export const logDatabaseOperation = (operation: string, query: string, params: any[], duration: number): void => {
  const logLevel = duration > 1000 ? 'warn' : 'debug';
  
  logger[logLevel]('Database operation', {
    operation,
    query: query.replace(/\s+/g, ' ').trim(),
    paramCount: params.length,
    duration: `${duration}ms`
  });
  
  // Log slow queries separately
  if (duration > 1000) {
    logger.warn('Slow database query detected', {
      operation,
      query,
      params: sanitizeLogData(params),
      duration: `${duration}ms`
    });
  }
};

// ==================================================
// SECURITY EVENT LOGGING
// ==================================================

/**
 * Security event logger
 */
export const logSecurityEvent = (event: string, details: any, req: Request): void => {
  logger.warn(`Security event: ${event}`, {
    event,
    details,
    request: {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    }
  }, {
    requestId: req.requestId,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });
};

// ==================================================
// BUSINESS LOGIC MONITORING
// ==================================================

/**
 * Business event logger
 */
export const logBusinessEvent = (event: string, userId: number, details: any): void => {
  logger.info(`Business event: ${event}`, {
    event,
    userId,
    details
  });
};

// ==================================================
// UTILITY FUNCTIONS
// ==================================================

/**
 * Sanitize sensitive data for logging
 */
const sanitizeLogData = (data: any): any => {
  if (!data || typeof data !== 'object') return data;
  
  const sanitized = { ...data };
  const sensitiveFields = [
    'password', 'token', 'secret', 'key', 'authorization',
    'credit_card', 'ssn', 'phone', 'email'
  ];
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }
  
  return sanitized;
};

/**
 * Sanitize headers for logging
 */
const sanitizeHeaders = (headers: any): any => {
  const sanitized = { ...headers };
  if (sanitized.authorization) {
    sanitized.authorization = 'Bearer [REDACTED]';
  }
  if (sanitized.cookie) {
    sanitized.cookie = '[REDACTED]';
  }
  return sanitized;
};

// ==================================================
// LOG ROTATION AND CLEANUP
// ==================================================

/**
 * Rotate logs daily and clean up old logs
 */
export const setupLogRotation = (): void => {
  const rotateInterval = 24 * 60 * 60 * 1000; // 24 hours
  const maxLogAge = 30 * 24 * 60 * 60 * 1000; // 30 days
  
  setInterval(() => {
    if (!fs.existsSync(logger['logDirectory'])) return;
    
    const files = fs.readdirSync(logger['logDirectory']);
    const now = Date.now();
    
    files.forEach(file => {
      const filePath = path.join(logger['logDirectory'], file);
      const stats = fs.statSync(filePath);
      
      // Delete files older than maxLogAge
      if (now - stats.mtime.getTime() > maxLogAge) {
        fs.unlinkSync(filePath);
        logger.info(`Deleted old log file: ${file}`);
      }
    });
  }, rotateInterval);
};

// Start log rotation in production
if (process.env.NODE_ENV === 'production') {
  setupLogRotation();
}

// ==================================================
// HEALTH CHECK MONITORING
// ==================================================

/**
 * System health checker
 */
export const healthCheck = async (): Promise<any> => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    checks: {
      database: 'unknown',
      cache: 'ok',
      filesystem: 'unknown'
    }
  };
  
  // Check database connection
  try {
    const { getPool } = require('../config/database');
    const pool = getPool();
    await pool.execute('SELECT 1');
    health.checks.database = 'ok';
  } catch (error) {
    health.checks.database = 'error';
    health.status = 'degraded';
  }
  
  // Check filesystem
  try {
    const tempFile = path.join(process.cwd(), 'temp-health-check.txt');
    fs.writeFileSync(tempFile, 'health check');
    fs.unlinkSync(tempFile);
    health.checks.filesystem = 'ok';
  } catch (error) {
    health.checks.filesystem = 'error';
    health.status = 'degraded';
  }
  
  return health;
};

export default {
  logger,
  requestLogger,
  errorHandler,
  logDatabaseOperation,
  logSecurityEvent,
  logBusinessEvent,
  healthCheck
};

// Extend Request type to include requestId
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}