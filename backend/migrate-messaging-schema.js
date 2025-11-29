/**
 * Migrate messaging schema to use conversations-based system
 * This will backup old messages and create new messaging tables
 */

require('dotenv').config();
const { getPool, closePool } = require('./utils/db-pool');

async function migrateMessaging() {
  const pool = getPool();

  try {
    console.log('🔄 Starting messaging schema migration...');

    // Check if old messages exist
    const oldMessages = await pool.query('SELECT COUNT(*) as count FROM messages');
    const oldCount = oldMessages[0].count;
    console.log(`📊 Found ${oldCount} messages in old schema`);

    // Backup old messages table if it has data
    if (oldCount > 0) {
      console.log('💾 Creating backup of old messages table...');
      await pool.query('CREATE TABLE IF NOT EXISTS messages_backup_old_schema LIKE messages');
      await pool.query('INSERT INTO messages_backup_old_schema SELECT * FROM messages');
      console.log('✅ Backup created: messages_backup_old_schema');
    }

    // Drop old messages table
    console.log('🗑️  Dropping old messages table...');
    await pool.query('DROP TABLE IF EXISTS messages');

    // Create new messages table with conversation_id
    console.log('📝 Creating new messages table...');
    await pool.query(`
      CREATE TABLE messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        conversation_id INT NOT NULL,
        sender_id INT NOT NULL,
        recipient_id INT NULL,
        message TEXT NOT NULL,
        is_read TINYINT(1) DEFAULT 0,
        read_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_message_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
        CONSTRAINT fk_message_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_message_recipient FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_messages_conversation_created (conversation_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ New messages table created');

    // If we had old messages, try to migrate them
    if (oldCount > 0) {
      console.log('🔄 Attempting to migrate old messages...');

      // Get old messages
      const oldMsgs = await pool.query(`
        SELECT m.*,
               b.guest_id,
               b.host_id,
               b.property_id as booking_property_id
        FROM messages_backup_old_schema m
        LEFT JOIN bookings b ON m.booking_id = b.id
        ORDER BY m.created_at ASC
      `);

      let migrated = 0;
      let skipped = 0;

      for (const msg of oldMsgs) {
        try {
          // Determine property_id
          const propertyId = msg.booking_property_id || msg.property_id;

          if (!propertyId) {
            console.log(`⚠️  Skipping message ${msg.id}: no property_id`);
            skipped++;
            continue;
          }

          // Find or create conversation
          let conversationId;

          // Try to find existing conversation
          const existingConv = await pool.query(
            `SELECT id FROM conversations
             WHERE property_id = ?
             ${msg.booking_id ? 'AND booking_id = ?' : ''}
             LIMIT 1`,
            msg.booking_id ? [propertyId, msg.booking_id] : [propertyId]
          );

          if (existingConv.length > 0) {
            conversationId = existingConv[0].id;
          } else {
            // Create conversation
            const convResult = await pool.query(
              'INSERT INTO conversations (property_id, booking_id, created_at) VALUES (?, ?, ?)',
              [propertyId, msg.booking_id || null, msg.created_at]
            );
            conversationId = convResult.insertId;

            // Add participants
            if (msg.sender_id && msg.recipient_id) {
              await pool.query(
                'INSERT IGNORE INTO conversation_participants (conversation_id, user_id) VALUES (?, ?), (?, ?)',
                [conversationId, msg.sender_id, conversationId, msg.recipient_id]
              );
            }
          }

          // Insert message into new schema
          await pool.query(
            'INSERT INTO messages (conversation_id, sender_id, recipient_id, message, is_read, read_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [conversationId, msg.sender_id, msg.recipient_id, msg.message, msg.is_read, msg.read_at, msg.created_at]
          );

          migrated++;
        } catch (err) {
          console.log(`⚠️  Error migrating message ${msg.id}:`, err.message);
          skipped++;
        }
      }

      console.log(`✅ Migrated ${migrated} messages, skipped ${skipped}`);
    }

    console.log('\n🎉 Migration complete!');
    console.log('✅ New messaging schema is ready');
    console.log('ℹ️  Old messages backed up in: messages_backup_old_schema');

  } catch (error) {
    console.error('❌ Migration error:', error);
  } finally {
    await closePool();
  }
}

migrateMessaging()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
