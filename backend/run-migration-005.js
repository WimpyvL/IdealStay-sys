/**
 * Migration 005: Add archived_at column for conversation participants
 */

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function runMigration() {
  let connection;

  try {
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('  IDEAL STAY V3 - Database Migration 005');
    console.log('  Add conversation participant archive support');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');

    console.log('🔄 Connecting to database...');
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'idealstayco_db',
      port: Number(process.env.DB_PORT || 3306),
      multipleStatements: true,
    });

    console.log('✅ Connected to database successfully');
    console.log(`📊 Database: ${process.env.DB_NAME || 'idealstayco_db'}`);
    console.log('');

    const migrationPath = path.join(__dirname, 'migrations', '005_add_conversation_archive_flag.sql');
    console.log(`📖 Reading migration file: ${migrationPath}`);
    const sql = await fs.readFile(migrationPath, 'utf8');

    console.log('🚀 Executing migration...');
    await connection.query(sql);

    console.log('✅ Migration 005 executed successfully!');

    const [columnCheck] = await connection.query(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE()
         AND table_name = 'conversation_participants'
         AND column_name = 'archived_at'`
    );

    if (columnCheck.length) {
      console.log('✅ Verified archived_at column exists on conversation_participants');
    } else {
      console.log('❌ archived_at column not found. Please inspect the migration output.');
    }

    console.log('');
    console.log('✨ Migration completed. Conversations can now be archived per user.');
  } catch (error) {
    console.error('');
    console.error('❌ Migration failed!');
    console.error('Error:', error.message);
    process.exitCode = 1;
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

runMigration();