/**
 * Test script to verify profile_image_url can store base64 images
 */

require('dotenv').config();
const { getPool, closePool, query } = require('./utils/db-pool');

async function testImageSize() {
  try {
    console.log('🔍 Checking profile_image_url column type...');

    // Check column type
    const columns = await query(`
      SHOW COLUMNS FROM users LIKE 'profile_image_url'
    `);

    const column = columns[0];
    console.log('📊 Column details:');
    console.log('   Type:', column.Type);
    console.log('   Null:', column.Null);
    console.log('   Comment:', column.Comment || 'None');

    // Calculate maximum size
    const maxSizes = {
      'varchar': '500 bytes (old)',
      'text': '64 KB',
      'mediumtext': '16 MB',
      'longtext': '4 GB'
    };

    const typeKey = column.Type.toLowerCase().replace(/\([^)]*\)/, '').trim();
    const maxSize = maxSizes[typeKey] || 'Unknown';

    console.log('   Max size:', maxSize);
    console.log('');

    if (column.Type.toLowerCase().includes('mediumtext')) {
      console.log('✅ Column is MEDIUMTEXT - can store base64 images up to ~10MB');
      console.log('✅ Recommended image size: < 2MB for best performance');
    } else if (column.Type.toLowerCase().includes('varchar')) {
      console.log('⚠️  Column is VARCHAR - too small for base64 images!');
      console.log('⚠️  Run migration 003 to fix this issue');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await closePool();
  }
}

testImageSize()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
