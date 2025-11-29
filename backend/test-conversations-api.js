/**
 * Test script to verify conversations API
 */

require('dotenv').config();
const { getPool, closePool, query } = require('./utils/db-pool');

async function testConversationsAPI() {
  const pool = getPool();

  try {
    // Get the user ID for gregthomas257@gmail.com
    const users = await query(
      'SELECT id, email, first_name, last_name FROM users WHERE email = ?',
      ['gregthomas257@gmail.com']
    );

    if (users.length === 0) {
      console.log('❌ User not found');
      return;
    }

    const userId = users[0].id;
    console.log(`✅ Found user: ${users[0].email} (ID: ${userId})`);

    // Check conversations for this user
    const conversations = await query(`
      SELECT c.id,
             c.created_at,
             c.updated_at,
             c.property_id,
             p.title AS property_title,
             lm.id AS last_message_id,
             lm.message AS last_message_text,
             lm.created_at AS last_message_created_at,
             lm.sender_id AS last_message_sender_id,
             COALESCE(unread.unread_count, 0) AS unread_count
      FROM conversations c
      INNER JOIN conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = ?
      LEFT JOIN properties p ON c.property_id = p.id
      LEFT JOIN (
         SELECT m1.* FROM messages m1
         INNER JOIN (
           SELECT conversation_id, MAX(created_at) AS max_created
           FROM messages
           GROUP BY conversation_id
         ) latest ON latest.conversation_id = m1.conversation_id AND latest.max_created = m1.created_at
      ) lm ON lm.conversation_id = c.id
      LEFT JOIN (
         SELECT conversation_id, COUNT(*) AS unread_count
         FROM messages
         WHERE is_read = 0 AND recipient_id = ?
         GROUP BY conversation_id
      ) unread ON unread.conversation_id = c.id
      WHERE cp.user_id = ?
      ORDER BY lm.created_at DESC, c.created_at DESC
    `, [userId, userId, userId]);

    console.log(`\n📋 Found ${conversations.length} conversations:`);
    conversations.forEach(conv => {
      console.log(`  - Conversation #${conv.id}: ${conv.property_title || 'No title'}`);
      console.log(`    Last message: ${conv.last_message_text || 'No messages yet'}`);
      console.log(`    Unread: ${conv.unread_count}`);
    });

    // Check conversation participants
    const participants = await query(`
      SELECT cp.conversation_id, cp.user_id, u.email, u.first_name, u.last_name
      FROM conversation_participants cp
      JOIN users u ON cp.user_id = u.id
      WHERE cp.conversation_id IN (
        SELECT conversation_id FROM conversation_participants WHERE user_id = ?
      )
      ORDER BY cp.conversation_id, u.email
    `, [userId]);

    console.log(`\n👥 Participants in conversations:`);
    let currentConvId = null;
    participants.forEach(p => {
      if (p.conversation_id !== currentConvId) {
        console.log(`\n  Conversation #${p.conversation_id}:`);
        currentConvId = p.conversation_id;
      }
      console.log(`    - ${p.first_name} ${p.last_name} (${p.email})`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await closePool();
  }
}

testConversationsAPI()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
