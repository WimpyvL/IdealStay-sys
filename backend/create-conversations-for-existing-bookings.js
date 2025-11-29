/**
 * Script to create conversations for existing bookings
 * Run this once to backfill conversations for bookings created before the feature was added
 */

require('dotenv').config();
const { getPool, closePool, query } = require('./utils/db-pool');

async function createConversationsForExistingBookings() {
  const pool = getPool();

  try {
    console.log('🔍 Finding bookings without conversations...');

    // Get all bookings that don't have conversations
    const bookings = await query(`
      SELECT b.id as booking_id, b.property_id, b.guest_id, b.host_id
      FROM bookings b
      WHERE NOT EXISTS (
        SELECT 1 FROM conversations c WHERE c.booking_id = b.id
      )
      AND b.status IN ('pending', 'confirmed', 'completed')
    `);

    console.log(`📋 Found ${bookings.length} bookings without conversations`);

    let created = 0;
    let updated = 0;

    for (const booking of bookings) {
      // Check if a conversation already exists for this property between guest and host
      const existingConv = await query(
        `SELECT c.id
         FROM conversations c
         INNER JOIN conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_id = ?
         INNER JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id = ?
         WHERE c.property_id = ?
         LIMIT 1`,
        [booking.guest_id, booking.host_id, booking.property_id]
      );

      if (existingConv.length > 0) {
        // Update existing conversation with booking reference
        await pool.execute(
          'UPDATE conversations SET booking_id = ?, updated_at = NOW() WHERE id = ? AND booking_id IS NULL',
          [booking.booking_id, existingConv[0].id]
        );
        console.log(`✅ Updated conversation ${existingConv[0].id} for booking ${booking.booking_id}`);
        updated++;
      } else {
        // Create new conversation
        const [convResult] = await pool.execute(
          'INSERT INTO conversations (property_id, booking_id) VALUES (?, ?)',
          [booking.property_id, booking.booking_id]
        );
        const conversationId = convResult.insertId;

        // Add both guest and host as participants
        await pool.execute(
          'INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?), (?, ?)',
          [conversationId, booking.guest_id, conversationId, booking.host_id]
        );
        console.log(`✅ Created conversation ${conversationId} for booking ${booking.booking_id}`);
        created++;
      }
    }

    console.log(`\n🎉 Done! Created ${created} new conversations, updated ${updated} existing ones.`);
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await closePool();
  }
}

createConversationsForExistingBookings()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
