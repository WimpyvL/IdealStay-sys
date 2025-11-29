import { Request, Response, NextFunction } from 'express';

interface ApiError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorHandler = (
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  
  // MongoDB duplicate key error
  if (err.name === 'MongoError' || err.message.includes('duplicate key')) {
    statusCode = 400;
    message = 'Duplicate field value entered';
  }
  
  // MySQL duplicate entry error
  if (err.message.includes('Duplicate entry')) {
    statusCode = 400;
    message = 'Duplicate field value entered';
  }
  
  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }
  
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }
  
  // Validation errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
  }
  
  // MySQL connection errors
  if (err.message.includes('ECONNREFUSED') || err.message.includes('ER_ACCESS_DENIED')) {
    statusCode = 503;
    message = 'Database connection error';
  }
  
  // Log error details in development
  if (process.env.NODE_ENV === 'development') {
    console.error('🚨 Error Details:', {
      message: err.message,
      stack: err.stack,
      statusCode,
      path: req.path,
      method: req.method,
      body: req.body,
      params: req.params,
      query: req.query,
    });
  } else {
    // Log error for monitoring in production
    console.error('🚨 Production Error:', {
      message: err.message,
      statusCode,
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString(),
    });
  }
  
  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      details: {
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString(),
      }
    }),
  });
};