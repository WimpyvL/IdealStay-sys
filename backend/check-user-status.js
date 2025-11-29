require('dotenv').config();
const { getPool, closePool, query } = require('./utils/db-pool');

async function checkUserStatus() {
  try {
    const email = 'jameykingston6@gmail.com';
    
    console.log(`\n🔍 Checking user status for: ${email}\n`);
    
    // Get user details
    const users = await query(
      'SELECT id, email, first_name, last_name, role, is_host, host_approved, is_verified, created_at FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      console.log('❌ User not found in database');
      return;
    }

    const user = users[0];
    console.log('✅ User found:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.first_name} ${user.last_name}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Is Host: ${user.is_host ? 'YES' : 'NO'}`);
    console.log(`   Host Approved: ${user.host_approved ? 'YES' : 'NO'}`);
    console.log(`   Is Verified: ${user.is_verified ? 'YES' : 'NO'}`);
    console.log(`   Created: ${user.created_at}`);
    
    console.log('\n📊 Expected values for host access:');
    console.log(`   role: 'host' (current: '${user.role}')`);
    console.log(`   is_host: 1 (current: ${user.is_host})`);
    console.log(`   host_approved: 1 (current: ${user.host_approved})`);

    if (user.role !== 'host' || !user.is_host || !user.host_approved) {
      console.log('\n⚠️  User is NOT properly configured as a host!');
      console.log('   Updating user to host status...\n');
      
      await query(
        'UPDATE users SET role = ?, is_host = ?, host_approved = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['host', 1, 1, user.id]
      );
      
      const updatedUser = await query(
        'SELECT id, email, role, is_host, host_approved FROM users WHERE id = ?',
        [user.id]
      );
      
      console.log('✅ User updated successfully:');
      console.log(`   Role: ${updatedUser[0].role}`);
      console.log(`   Is Host: ${updatedUser[0].is_host}`);
      console.log(`   Host Approved: ${updatedUser[0].host_approved}`);
      console.log('\n👉 Please log out and log back in to refresh your session.');
    } else {
      console.log('\n✅ User is properly configured as a host!');
      console.log('   If you\'re still seeing the "Become a Host" page, try:');
      console.log('   1. Log out and log back in');
      console.log('   2. Clear browser cache and local storage');
      console.log('   3. Hard refresh the page (Ctrl+Shift+R)');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await closePool();
  }
}

checkUserStatus()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
