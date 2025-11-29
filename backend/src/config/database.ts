import mysql from 'mysql2/promise';
import config from './index';

// Database connection pool
let pool: mysql.Pool | null = null;

export const createPool = (): mysql.Pool => {
  if (!pool) {
    pool = mysql.createPool({
      host: config.DB_HOST,
      port: config.DB_PORT,
      user: config.DB_USER,
      password: config.DB_PASSWORD,
      database: config.DB_NAME,
      connectionLimit: config.DB_CONNECTION_LIMIT,
      multipleStatements: false,
      timezone: '+00:00', // Store dates in UTC
      dateStrings: false,
      supportBigNumbers: true,
      bigNumberStrings: false,
    });

    console.log('🔌 MySQL connection pool created');
  }

  return pool;
};

export const getPool = (): mysql.Pool => {
  if (!pool) {
    pool = createPool();
  }
  return pool;
};

export const connectDB = async (): Promise<void> => {
  try {
    console.log(`🔍 Attempting to connect to: ${config.DB_HOST}:${config.DB_PORT}/${config.DB_NAME}`);
    
    const connection = await getPool().getConnection();
    
    // Test the connection with a simple query
    const [rows] = await connection.execute('SELECT 1 as test, NOW() as server_time, VERSION() as mysql_version');
    
    // Get database info
    const [dbInfo] = await connection.execute('SELECT DATABASE() as current_db');
    
    // Release the connection back to the pool
    connection.release();
    
    console.log('✅ Database connection test successful');
    console.log(`📊 Connected to: ${(dbInfo as any[])[0]?.current_db || config.DB_NAME}`);
    console.log(`🗄️  MySQL Version: ${(rows as any[])[0]?.mysql_version || 'Unknown'}`);
    console.log(`⏰ Server Time: ${(rows as any[])[0]?.server_time || 'Unknown'}`);
    
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    
    // Provide helpful error messages
    if (error instanceof Error) {
      console.error('');
      console.error('🔍 Connection Details:');
      console.error(`   Host: ${config.DB_HOST}`);
      console.error(`   Port: ${config.DB_PORT}`);
      console.error(`   Database: ${config.DB_NAME}`);
      console.error(`   User: ${config.DB_USER}`);
      console.error('');
      
      if (error.message.includes('ECONNREFUSED')) {
        console.error('💡 Possible Solutions:');
        console.error('   1. Check if MySQL server is running');
        console.error('   2. Verify host and port are correct');
        console.error('   3. Check firewall settings');
        console.error('   4. For cPanel: Enable Remote MySQL access');
        console.error('   5. Add your IP to cPanel Remote MySQL hosts');
        console.error('');
        throw new Error('Database server is not running or unreachable');
        
      } else if (error.message.includes('ER_ACCESS_DENIED')) {
        console.error('💡 Possible Solutions:');
        console.error('   1. Check username and password are correct');
        console.error('   2. Verify user has database permissions');
        console.error('   3. Check if user can connect from your IP');
        console.error('');
        throw new Error('Database access denied - check credentials');
        
      } else if (error.message.includes('ER_BAD_DB_ERROR')) {
        console.error('💡 Possible Solutions:');
        console.error('   1. Create the database first');
        console.error('   2. Check database name spelling');
        console.error('   3. Import database-schema.sql');
        console.error('');
        throw new Error(`Database '${config.DB_NAME}' does not exist`);
        
      } else if (error.message.includes('ETIMEDOUT')) {
        console.error('💡 Possible Solutions:');
        console.error('   1. Check network connectivity');
        console.error('   2. Verify firewall allows MySQL connections');
        console.error('   3. Check if hosting provider blocks external connections');
        console.error('');
        throw new Error('Database connection timeout - check network connectivity');
        
      } else {
        console.error('💡 For more help, see: DATABASE_CONNECTION_GUIDE.md');
        throw error;
      }
    }
    
    throw error;
  }
};

export const closeDB = async (): Promise<void> => {
  if (pool) {
    try {
      await pool.end();
      pool = null;
      console.log('✅ Database connection pool closed');
    } catch (error) {
      console.error('❌ Error closing database connection pool:', error);
      throw error;
    }
  }
};

// Graceful shutdown helper
process.on('SIGINT', async () => {
  await closeDB();
});

process.on('SIGTERM', async () => {
  await closeDB();
});

export default {
  createPool,
  getPool,
  connectDB,
  closeDB,
};