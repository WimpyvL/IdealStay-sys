import app from './app';
import config from './config';
import { connectDB } from './config/database';
import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

// Simple in-file socket typing (avoid circular deps). Could be extracted later.
let io: SocketIOServer | null = null;

export const getIO = (): SocketIOServer => {
  if (!io) throw new Error('Socket.io not initialized yet');
  return io;
};

const startServer = async (): Promise<void> => {
  try {
    // Test database connection (skip for Phase 4 testing)
    if (process.env.SKIP_DB_TEST !== 'true') {
      console.log('🔍 Testing database connection...');
      await connectDB();
      console.log('✅ Database connected successfully');
    } else {
      console.log('⚠️  Database connection test skipped (SKIP_DB_TEST=true)');
    }
    
    // Start server
    const httpServer: HttpServer = app.listen(config.PORT, '0.0.0.0', () => {
      console.log('🚀 ================================');
      console.log('🏡 IDEAL STAY V3 API SERVER');
      console.log('🚀 ================================');
      console.log(`🌍 Environment: ${config.NODE_ENV}`);
      console.log(`🔗 Server running on port: ${config.PORT}`);
      console.log(`📡 API Base URL: http://localhost:${config.PORT}/api/${config.API_VERSION}`);
      console.log(`🔍 Health Check: http://localhost:${config.PORT}/health`);
      console.log(`📊 Database: ${config.DB_NAME} @ ${config.DB_HOST}:${config.DB_PORT}`);
      console.log('🚀 ================================');
      
      if (config.NODE_ENV === 'development') {
        console.log('');
        console.log('📋 Available Endpoints:');
        console.log(`   GET  /health - Health check`);
        console.log(`   POST /api/${config.API_VERSION}/auth/register - User registration`);
        console.log(`   POST /api/${config.API_VERSION}/auth/login - User login`);
        console.log(`   GET  /api/${config.API_VERSION}/properties - List properties`);
        console.log(`   GET  /api/${config.API_VERSION}/bookings - List bookings`);
        console.log('');
        console.log('⚠️  Remember to:');
        console.log('   1. Configure your .env file with database credentials');
        console.log('   2. Run the database schema migration');
        console.log('   3. Update CORS origins for production');
        console.log('');
      }
    });

    // Attach Socket.IO
    io = new SocketIOServer(httpServer, {
      cors: {
        origin: config.CORS_ORIGIN,
        credentials: true,
      },
    });

    io.use((socket: Socket, next) => {
      const token = socket.handshake.auth?.token || socket.handshake.headers['authorization']?.toString().replace('Bearer ', '');
      if (!token) return next(); // allow unauth, but events may reject
      try {
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'changeme');
        (socket as any).userId = decoded.userId || decoded.id; // support both shapes
      } catch (err) {
        console.warn('⚠️ Socket auth failed:', (err as Error).message);
      }
      next();
    });

    io.on('connection', (socket: Socket) => {
      const uid = (socket as any).userId;
      if (uid) {
        socket.join(`user:${uid}`); // personal room for notifications
        console.log(`🔌 User ${uid} connected (socket ${socket.id})`);
      } else {
        console.log(`🔌 Unauthenticated socket connected (${socket.id})`);
      }

      socket.on('conversation:join', (conversationId: number) => {
        if (!conversationId) return;
        const room = `conv:${conversationId}`;
        socket.join(room);
        socket.emit('conversation:joined', { conversationId, room });
        console.log('👥 Joined conversation room', { conversationId, socket: socket.id });
      });

      socket.on('conversation:leave', (conversationId: number) => {
        if (!conversationId) return;
        socket.leave(`conv:${conversationId}`);
      });

      socket.on('disconnect', (reason: string) => {
        if (uid) console.log(`🔌 User ${uid} disconnected: ${reason}`);
      });
    });

    // Graceful shutdown handling
    const gracefulShutdown = (signal: string) => {
      console.log(`\\n🛑 Received ${signal}. Graceful shutdown...`);
      httpServer.close(async () => {
        console.log('✅ HTTP server closed');
        try {
          io?.close();
          console.log('✅ WebSocket server closed');
        } catch (e) {
          console.error('❌ Error closing WebSocket server:', e);
        }
        
        // Close database connections
        try {
          // Database connection cleanup will be handled in database.ts
          console.log('✅ Database connections closed');
        } catch (error) {
          console.error('❌ Error closing database connections:', error);
        }
        
        console.log('👋 Server shutdown complete. Goodbye!');
        process.exit(0);
      });
      
      // Force close after 10 seconds
      setTimeout(() => {
        console.error('❌ Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    // Listen for termination signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: unknown, promise: Promise<any>) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      gracefulShutdown('UNHANDLED_REJECTION');
    });
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      console.error('❌ Uncaught Exception thrown:', error);
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    
    if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
      console.error('');
      console.error('🔍 Database Connection Error:');
      console.error('   - Check if MySQL is running');
      console.error('   - Verify database credentials in .env file');
      console.error('   - Ensure database exists and is accessible');
      console.error('');
    }
    
    process.exit(1);
  }
};

// Start the server
startServer();