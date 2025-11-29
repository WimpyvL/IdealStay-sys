/**
 * Run migration 003 - Increase profile_image_url column size
 */

require('dotenv').config();
const { getPool, closePool } = require('./utils/db-pool');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const pool = getPool();

  try {
    console.log('🔄 Running migration 003: Increase profile_image_url column size...');

    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', '003_increase_profile_image_size.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Execute the migration
    await pool.query(sql);

    console.log('✅ Migration 003 completed successfully!');
    console.log('📊 profile_image_url column is now MEDIUMTEXT and can store base64 images');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await closePool();
  }
}

runMigration()
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
