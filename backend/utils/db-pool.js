/**
 * Database Pool Utility
 * Ensures proper connection management across test scripts
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

let pool = null;

/**
 * Get or create a singleton database pool
 */
function getPool() {
  if (!pool) {
    const connectionLimit = parseInt(process.env.DB_CONNECTION_LIMIT || '3', 10);
    
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: connectionLimit,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    });

    console.log(`🔌 Database pool created (limit: ${connectionLimit})`);
    
    // Handle unexpected exit
    process.on('SIGINT', async () => {
      await closePool();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      await closePool();
      process.exit(0);
    });
  }
  
  return pool;
}

/**
 * Close the database pool
 */
async function closePool() {
  if (pool) {
    console.log('🔌 Closing database pool...');
    await pool.end();
    pool = null;
    console.log('✅ Database pool closed');
  }
}

/**
 * Execute a query with automatic error handling
 */
async function query(sql, params = []) {
  const connection = await getPool().getConnection();
  try {
    const [results] = await connection.execute(sql, params);
    return results;
  } finally {
    connection.release();
  }
}

/**
 * Test database connectivity
 */
async function testConnection() {
  try {
    console.log(`🔍 Testing connection to: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
    const result = await query('SELECT 1 as test, NOW() as server_time');
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    
    if (error.code === 'ER_CON_COUNT_ERROR') {
      console.log('\n💡 Too many connections error. Try:');
      console.log('  - Get-Process node | Stop-Process -Force');
      console.log('  - Contact hosting provider to reset connections');
      console.log('  - Reduce DB_CONNECTION_LIMIT in .env');
    }
    
    return false;
  }
}

module.exports = {
  getPool,
  closePool,
  query,
  testConnection
};
