/**
 * Migration 004: Add Payment History and Refunds tables
 * Run this script to add the missing payment_history and refunds tables
 */

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function runMigration() {
  let connection;
  
  try {
    console.log('🔄 Connecting to database...');
    
    // Create database connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'idealstayco_db',
      multipleStatements: true
    });

    console.log('✅ Connected to database successfully');
    console.log(`📊 Database: ${process.env.DB_NAME || 'idealstayco_db'}`);
    console.log('');

    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', '004-add-payment-history.sql');
    console.log(`📖 Reading migration file: ${migrationPath}`);
    
    const sql = await fs.readFile(migrationPath, 'utf8');
    
    console.log('🚀 Executing migration...');
    console.log('');

    // Execute migration
    const [results] = await connection.query(sql);
    
    console.log('✅ Migration executed successfully!');
    console.log('');

    // Check if tables were created
    console.log('🔍 Verifying tables...');
    
    const [paymentHistoryCheck] = await connection.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name = 'payment_history'
    `);
    
    const [refundsCheck] = await connection.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name = 'refunds'
    `);

    if (paymentHistoryCheck[0].count > 0) {
      console.log('✅ payment_history table exists');
      
      // Get record count
      const [countResult] = await connection.query('SELECT COUNT(*) as count FROM payment_history');
      console.log(`   Records: ${countResult[0].count}`);
    } else {
      console.log('❌ payment_history table NOT FOUND');
    }

    if (refundsCheck[0].count > 0) {
      console.log('✅ refunds table exists');
      
      // Get record count
      const [countResult] = await connection.query('SELECT COUNT(*) as count FROM refunds');
      console.log(`   Records: ${countResult[0].count}`);
    } else {
      console.log('❌ refunds table NOT FOUND');
    }

    console.log('');
    console.log('✨ Migration completed successfully!');
    console.log('');
    console.log('You can now:');
    console.log('- Approve/reject payment confirmations from the Host Dashboard');
    console.log('- Track payment history for all bookings');
    console.log('- Process refunds when needed');
    
  } catch (error) {
    console.error('');
    console.error('❌ Migration failed!');
    console.error('Error:', error.message);
    
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('');
      console.error('💡 Access denied. Please check your database credentials in .env file:');
      console.error('   - DB_HOST');
      console.error('   - DB_USER');
      console.error('   - DB_PASSWORD');
      console.error('   - DB_NAME');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('');
      console.error('💡 Connection refused. Please check:');
      console.error('   - Is MySQL server running?');
      console.error('   - Is DB_HOST correct in .env file?');
    } else if (error.code === 'ER_NO_SUCH_TABLE') {
      console.error('');
      console.error('💡 Required table not found. Make sure the base schema is created first.');
    }
    
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('');
      console.log('🔌 Database connection closed');
    }
  }
}

// Run migration
console.log('');
console.log('═══════════════════════════════════════════════════════');
console.log('  IDEAL STAY V3 - Database Migration 004');
console.log('  Add Payment History and Refunds Tables');
console.log('═══════════════════════════════════════════════════════');
console.log('');

runMigration();
