require('dotenv').config();
const { getPool, closePool, query } = require('./utils/db-pool');

async function checkSchema() {
  try {
    // Check if conversations table exists
    const convTable = await query("SHOW TABLES LIKE 'conversations'");
    console.log('Conversations table exists:', convTable.length > 0);

    // Check messages table structure
    const msgColumns = await query("SHOW COLUMNS FROM messages");
    console.log('\nMessages table columns:');
    msgColumns.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type})`);
    });

    // Check if conversation_participants exists
    const cpTable = await query("SHOW TABLES LIKE 'conversation_participants'");
    console.log('\nConversation_participants table exists:', cpTable.length > 0);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await closePool();
  }
}

checkSchema()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
