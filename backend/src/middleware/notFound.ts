import { Request, Response, NextFunction } from 'express';

export const notFound = (req: Request, res: Response, next: NextFunction): void => {
  const message = `🔍 Route not found: ${req.method} ${req.originalUrl}`;
  
  console.log(`❌ 404 Error: ${message}`);
  
  res.status(404).json({
    success: false,
    error: 'Route not found',
    message: `The requested endpoint ${req.method} ${req.originalUrl} does not exist`,
    suggestion: 'Please check the API documentation for available endpoints',
    timestamp: new Date().toISOString(),
  });
};