/**
 * Check current MySQL connections and limits
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkConnections() {
  // Use minimal connection limit for this check (don't use shared pool)
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 2,
    queueLimit: 0
  });

  try {
    const connection = await pool.getConnection();
    
    console.log('✅ Successfully connected to database\n');
    
    // Check max connections setting
    const [maxConn] = await connection.execute('SHOW VARIABLES LIKE "max_connections"');
    console.log('📊 Max Connections Setting:', maxConn[0].Value);
    
    // Check current number of connections
    const [processlist] = await connection.execute('SHOW PROCESSLIST');
    console.log(`📊 Current Active Connections: ${processlist.length}`);
    console.log('\n📋 Active Connections:');
    
    processlist.forEach((proc, idx) => {
      console.log(`  ${idx + 1}. ID: ${proc.Id}, User: ${proc.User}, Host: ${proc.Host}, DB: ${proc.db || 'N/A'}, Time: ${proc.Time}s`);
    });
    
    // Check connection status
    const [status] = await connection.execute('SHOW STATUS LIKE "Threads_connected"');
    console.log(`\n📊 Total Threads Connected: ${status[0].Value}`);
    
    const [rejected] = await connection.execute('SHOW STATUS LIKE "Connection_errors_max_connections"');
    console.log(`📊 Rejected Connections (max reached): ${rejected[0].Value}`);
    
    connection.release();
    await pool.end();
    
    console.log('\n💡 Recommendations:');
    console.log('  - Keep DB_CONNECTION_LIMIT low (5-10) for shared hosting');
    console.log('  - Always close pools with pool.end() when done');
    console.log('  - Use connection.release() after queries');
    console.log('  - Avoid creating multiple pools in your app');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (error.code === 'ER_CON_COUNT_ERROR') {
      console.log('\n🔧 Solutions:');
      console.log('  1. Run: Get-Process node | Stop-Process -Force');
      console.log('  2. Contact your hosting provider to increase max_connections');
      console.log('  3. Reduce DB_CONNECTION_LIMIT in .env to 3-5');
      console.log('  4. Check for connection leaks in your code');
    }
    
    await pool.end().catch(() => {});
  }
}

checkConnections();
