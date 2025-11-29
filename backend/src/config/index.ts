import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

interface Config {
  // Server
  NODE_ENV: string;
  PORT: number;
  API_VERSION: string;
  
  // Database
  DB_HOST: string;
  DB_PORT: number;
  DB_USER: string;
  DB_PASSWORD: string;
  DB_NAME: string;
  DB_CONNECTION_LIMIT: number;
  DB_ACQUIRE_TIMEOUT: number;
  DB_TIMEOUT: number;
  
  // JWT
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  JWT_REFRESH_EXPIRES_IN: string;
  
  // Email
  EMAIL_HOST: string;
  EMAIL_PORT: number;
  EMAIL_USER: string;
  EMAIL_PASSWORD: string;
  EMAIL_FROM: string;
  
  // File Upload
  MAX_FILE_SIZE: number;
  ALLOWED_FILE_TYPES: string[];
  UPLOAD_PATH: string;
  
  // Security
  BCRYPT_SALT_ROUNDS: number;
  RATE_LIMIT_MAX: number;
  RATE_LIMIT_WINDOW: number;
  
  // CORS
  CORS_ORIGIN: string[];
  CORS_CREDENTIALS: boolean;
  
  // Frontend URLs
  FRONTEND_URL: string;
  FRONTEND_RESET_PASSWORD_URL: string;
  FRONTEND_VERIFY_EMAIL_URL: string;
  
  // Logging
  LOG_LEVEL: string;
  LOG_TO_FILE: boolean;
  LOG_FILE_PATH: string;
}

const config: Config = {
  // Server Configuration
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3001', 10),
  API_VERSION: process.env.API_VERSION || 'v1',
  
  // Database Configuration
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: parseInt(process.env.DB_PORT || '3306', 10),
  DB_USER: process.env.DB_USER || 'root',
  DB_PASSWORD: process.env.DB_PASSWORD || '',
  DB_NAME: process.env.DB_NAME || 'idealstay_db',
  DB_CONNECTION_LIMIT: parseInt(process.env.DB_CONNECTION_LIMIT || '25', 10),
  DB_ACQUIRE_TIMEOUT: parseInt(process.env.DB_ACQUIRE_TIMEOUT || '60000', 10),
  DB_TIMEOUT: parseInt(process.env.DB_TIMEOUT || '60000', 10),
  
  // JWT Configuration
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  
  // Email Configuration
  EMAIL_HOST: process.env.EMAIL_HOST || 'smtp.gmail.com',
  EMAIL_PORT: parseInt(process.env.EMAIL_PORT || '587', 10),
  EMAIL_USER: process.env.EMAIL_USER || '',
  EMAIL_PASSWORD: process.env.EMAIL_PASSWORD || '',
  EMAIL_FROM: process.env.EMAIL_FROM || 'noreply@idealstay.com',
  
  // File Upload Configuration
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10), // 5MB
  ALLOWED_FILE_TYPES: process.env.ALLOWED_FILE_TYPES?.split(',') || [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/webp'
  ],
  UPLOAD_PATH: process.env.UPLOAD_PATH || 'uploads',
  
  // Security Configuration
  BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10), // 15 minutes
  
  // CORS Configuration
  CORS_ORIGIN: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173'],
  CORS_CREDENTIALS: process.env.CORS_CREDENTIALS === 'true',
  
  // Frontend URLs
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  FRONTEND_RESET_PASSWORD_URL: process.env.FRONTEND_RESET_PASSWORD_URL || 'http://localhost:5173/reset-password',
  FRONTEND_VERIFY_EMAIL_URL: process.env.FRONTEND_VERIFY_EMAIL_URL || 'http://localhost:5173/verify-email',
  
  // Logging Configuration
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  LOG_TO_FILE: process.env.LOG_TO_FILE === 'true',
  LOG_FILE_PATH: process.env.LOG_FILE_PATH || 'logs/app.log',
};

// Validation
const requiredEnvVars = [
  'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'JWT_SECRET'
];

if (config.NODE_ENV === 'production') {
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.error(`❌ Missing required environment variable: ${envVar}`);
      process.exit(1);
    }
  }
}

// Warnings for development
if (config.NODE_ENV === 'development') {
  if (config.JWT_SECRET === 'your-secret-key-change-in-production') {
    console.warn('⚠️  Using default JWT secret. Change this in production!');
  }
  
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.warn('⚠️  Email configuration missing. Email features will be disabled.');
  }
}

export default config;