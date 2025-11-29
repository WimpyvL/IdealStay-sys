import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { performanceMiddleware, enableCompression } from './utils/performance';
import rateLimit from 'express-rate-limit';
import path from 'path';
import config from './config';

// Import middleware
import { notFound } from './middleware/notFound';
import { requestLogger, errorHandler } from './utils/monitoring';
import { 
  securityHeaders, 
  securityLogger, 
  sqlInjectionProtection, 
  xssProtection,
  generalLimiter
} from './middleware/security';

// Import routes
import authRoutes from './routes/authRoutes';
import propertyRoutes from './routes/properties';
import amenityRoutes from './routes/amenities';
import bookingRoutes from './routes/bookings';
import userRoutes from './routes/users';
import reviewRoutes from './routes/reviews';
import messageRoutes from './routes/messages';
import uploadRoutes from './routes/uploads';
import analyticsRoutes from './routes/analytics';
import adminRoutes from './routes/admin';
import financialsRoutes from './routes/financials';

const app = express();

// Trust proxy (important for cPanel hosting)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false, // We set our own CSP
}));

// Enhanced security middleware
app.use(securityHeaders);
app.use(securityLogger);
app.use(sqlInjectionProtection);
app.use(xssProtection);

// CORS configuration
app.use(cors({
  origin: config.CORS_ORIGIN,
  credentials: config.CORS_CREDENTIALS,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
  ],
}));

// Rate limiting intentionally disabled or relaxed. The middleware now no-ops when
// RATE_LIMIT_DISABLED=true. If you want to restore previous behavior, set that env
// var to false and remove this comment.
if (process.env.RATE_LIMIT_DISABLED !== 'true') {
  app.use('/api/', generalLimiter);
}

// Performance monitoring
app.use(performanceMiddleware);

// Compression middleware with optimization
app.use(enableCompression());

// Enhanced logging middleware
app.use(requestLogger);

// Morgan for additional HTTP logging in development
if (config.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, '..', config.UPLOAD_PATH)));

// Health check endpoint with comprehensive monitoring
app.get('/health', async (req, res) => {
  try {
    const { healthCheck } = await import('./utils/monitoring');
    const health = await healthCheck();
    
    res.status(health.status === 'ok' ? 200 : 503).json({
      ...health,
      message: 'Ideal Stay API Health Check 🏡',
      environment: config.NODE_ENV,
      version: config.API_VERSION,
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      message: 'Health check failed',
      timestamp: new Date().toISOString(),
      environment: config.NODE_ENV,
      version: config.API_VERSION,
    });
  }
});

// API Routes
const apiRouter = express.Router();

// Mount all routes under /api/v1
apiRouter.use('/auth', authRoutes);
apiRouter.use('/properties', propertyRoutes);
apiRouter.use('/amenities', amenityRoutes);
apiRouter.use('/bookings', bookingRoutes);
apiRouter.use('/users', userRoutes);
apiRouter.use('/reviews', reviewRoutes);
apiRouter.use('/messages', messageRoutes);
apiRouter.use('/uploads', uploadRoutes);
apiRouter.use('/analytics', analyticsRoutes);
apiRouter.use('/admin', adminRoutes);
apiRouter.use('/financials', financialsRoutes);

// Mount API router
app.use(`/api/${config.API_VERSION}`, apiRouter);

// Welcome route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🏡 Welcome to Ideal Stay API',
    documentation: `/api/${config.API_VERSION}/docs`,
    health: '/health',
    version: config.API_VERSION,
  });
});

// Error handling middleware (must be last)
app.use(notFound);
app.use(errorHandler);

export default app;