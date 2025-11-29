import { Request, Response } from 'express';
import { getPool } from '@/config/database';
import { getIO } from '@/server';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// Helper to build standard error response
const serverError = (res: Response, message: string, error?: unknown) => {
  console.error(`❌ ${message}:`, error);
  return res.status(500).json({ success: false, message });
};

const buildConversationQuery = (archivedOnly: boolean) => `SELECT c.id,
        c.created_at,
        c.updated_at,
        c.property_id,
        p.title AS property_title,
        lm.id AS last_message_id,
        lm.message AS last_message_text,
        lm.created_at AS last_message_created_at,
        lm.sender_id AS last_message_sender_id,
        COALESCE(unread.unread_count, 0) AS unread_count,
        cp.archived_at AS participant_archived_at,
        CASE WHEN cp.archived_at IS NULL THEN 0 ELSE 1 END AS is_archived,
        other_user.id AS other_user_id,
        other_user.first_name AS other_user_first_name,
        other_user.last_name AS other_user_last_name,
        other_user.email AS other_user_email,
        other_user.phone AS other_user_phone,
        other_user.profile_image_url AS other_user_profile_image
 FROM conversations c
 INNER JOIN conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = ?
 LEFT JOIN properties p ON c.property_id = p.id
 LEFT JOIN conversation_participants cp_other ON cp_other.conversation_id = c.id AND cp_other.user_id != ?
 LEFT JOIN users other_user ON other_user.id = cp_other.user_id
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
 WHERE cp.user_id = ?${archivedOnly ? ' AND (cp.archived_at IS NOT NULL)' : ' AND (cp.archived_at IS NULL)'}
 ORDER BY COALESCE(lm.created_at, c.updated_at, c.created_at) DESC`;

/**
 * GET /api/v1/messages/conversations
 * List conversations for current user (participant) with last message + unread count
 */
export const getConversations = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });

    const pool = getPool();
    const [rows] = await pool.execute<RowDataPacket[]>(
  buildConversationQuery(false) as any,
      [userId, userId, userId, userId]
    );

    return res.json({ success: true, data: { conversations: rows } });
  } catch (error) {
    return serverError(res, 'Failed to fetch conversations', error);
  }
};

/**
 * GET /api/v1/messages/conversations/archived
 * List archived conversations for current user
 */
export const getArchivedConversations = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });

    const pool = getPool();
    const [rows] = await pool.execute<RowDataPacket[]>(
      buildConversationQuery(true) as any,
      [userId, userId, userId, userId]
    );

    return res.json({ success: true, data: { conversations: rows } });
  } catch (error) {
    return serverError(res, 'Failed to fetch archived conversations', error);
  }
};

/**
 * POST /api/v1/messages/conversations
 * Create (or reuse existing) conversation between participants for a property/booking context
 * Body: { participant_ids: number[] (must include current user), property_id?: number, booking_id?: number }
 */
export const createConversation = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });

    const { participant_ids, property_id, booking_id } = req.body as {
      participant_ids: number[];
      property_id?: number;
      booking_id?: number;
    };

    if (!Array.isArray(participant_ids) || participant_ids.length < 2) {
      return res.status(400).json({ success: false, message: 'At least two participants required' });
    }
    if (!participant_ids.includes(userId)) {
      return res.status(400).json({ success: false, message: 'Current user must be a participant' });
    }

    const pool = getPool();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Attempt to find existing conversation with exact same participant set & property context
      const [existing] = await conn.execute<RowDataPacket[]>(
        `SELECT c.id
         FROM conversations c
         INNER JOIN conversation_participants cp ON cp.conversation_id = c.id
         WHERE c.property_id <=> ?
         GROUP BY c.id
         HAVING COUNT(*) = ? AND SUM(cp.user_id IN (${participant_ids.map(() => '?').join(',')})) = ?`,
        [property_id ?? null, participant_ids.length, ...participant_ids, participant_ids.length]
      );

      if (existing.length) {
        const convId = existing[0].id;
        await conn.execute(
          `UPDATE conversation_participants SET archived_at = NULL WHERE conversation_id = ? AND user_id IN (${participant_ids.map(() => '?').join(',')})`,
          [convId, ...participant_ids]
        );
        await conn.commit();
        conn.release();
        return res.json({ success: true, reused: true, data: { conversation_id: convId } });
      }

      const [convResult] = await conn.execute<ResultSetHeader>(
        'INSERT INTO conversations (property_id, booking_id) VALUES (?, ?)',
        [property_id ?? null, booking_id ?? null]
      );
      const conversationId = convResult.insertId;

      // Insert participants
      await conn.query(
        'INSERT INTO conversation_participants (conversation_id, user_id) VALUES ' +
          participant_ids.map(() => '(?, ?)').join(','),
        participant_ids.flatMap(pid => [conversationId, pid])
      );

      await conn.commit();
      conn.release();
      return res.status(201).json({ success: true, data: { conversation_id: conversationId } });
    } catch (inner) {
      await conn.rollback();
      conn.release();
      throw inner;
    }
  } catch (error) {
    return serverError(res, 'Failed to create conversation', error);
  }
};

/**
 * GET /api/v1/messages/conversations/:id/messages
 * List messages in a conversation (must be participant)
 */
export const getMessages = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
    const { id } = req.params;

    const pool = getPool();
    const [participantCheck] = await pool.execute<RowDataPacket[]>(
      'SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ? LIMIT 1',
      [id, userId]
    );
    if (!participantCheck.length) {
      return res.status(403).json({ success: false, message: 'Not a participant in this conversation' });
    }

    const [messages] = await pool.execute<RowDataPacket[]>(
      `SELECT m.id, m.message, m.sender_id, m.recipient_id, m.created_at, m.is_read,
              s.first_name as sender_first_name, s.last_name as sender_last_name,
              r.first_name as recipient_first_name, r.last_name as recipient_last_name
       FROM messages m
       LEFT JOIN users s ON s.id = m.sender_id
       LEFT JOIN users r ON r.id = m.recipient_id
       WHERE m.conversation_id = ?
       ORDER BY m.created_at ASC`,
      [id]
    );

    return res.json({ success: true, data: { messages } });
  } catch (error) {
    return serverError(res, 'Failed to fetch messages', error);
  }
};

/**
 * POST /api/v1/messages/conversations/:id/messages
 * Send a message in a conversation (must be participant) Body: { message: string }
 */
export const sendMessage = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
    const { id } = req.params;
    const { message } = req.body as { message: string };
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    const pool = getPool();
    const conn = await pool.getConnection();
    try {
      // Verify participant
      const [participantRows] = await conn.execute<RowDataPacket[]>(
        'SELECT user_id FROM conversation_participants WHERE conversation_id = ?',
        [id]
      );
      const participants = participantRows.map(r => r.user_id);
      if (!participants.includes(userId)) {
        conn.release();
        return res.status(403).json({ success: false, message: 'Not a participant in this conversation' });
      }
      // Simple logic: choose recipient as the other participant in a 2-person conversation; in group, recipient null
      let recipientId: number | null = null;
      if (participants.length === 2) {
        recipientId = participants.find(p => p !== userId) || null;
      }

      const [result] = await conn.execute<ResultSetHeader>(
        'INSERT INTO messages (conversation_id, sender_id, recipient_id, message, is_read) VALUES (?, ?, ?, ?, 0)',
        [id, userId, recipientId, message.trim()]
      );

      await conn.execute('UPDATE conversations SET updated_at = NOW() WHERE id = ?', [id]);
      conn.release();
      // Fetch the inserted message with metadata to broadcast
      try {
        const pool = getPool();
        const [rows] = await pool.execute<RowDataPacket[]>(
          `SELECT m.id, m.message, m.sender_id, m.recipient_id, m.created_at, m.is_read,
                  s.first_name as sender_first_name, s.last_name as sender_last_name,
                  r.first_name as recipient_first_name, r.last_name as recipient_last_name
           FROM messages m
           LEFT JOIN users s ON s.id = m.sender_id
           LEFT JOIN users r ON r.id = m.recipient_id
           WHERE m.id = ? LIMIT 1`,
          [result.insertId]
        );
        const fullMessage = rows[0];
        if (fullMessage) {
          const io = getIO();
          const convRoom = `conv:${id}`;
          console.log('📤 Emitting message:new', { convRoom, messageId: fullMessage.id, sender: fullMessage.sender_id });
          io.to(convRoom).emit('message:new', { conversation_id: Number(id), message: fullMessage });
          if (recipientId) {
            const userRoom = `user:${recipientId}`;
            console.log('📤 Emitting conversation:update', { userRoom, convId: id });
            io.to(userRoom).emit('conversation:update', { conversation_id: Number(id), last_message: fullMessage });
          }
        }
      } catch (emitErr) {
        console.error('⚠️ Failed to emit websocket event:', emitErr);
      }

      return res.status(201).json({ success: true, data: { message_id: result.insertId } });
    } catch (inner) {
      conn.release();
      throw inner;
    }
  } catch (error) {
    return serverError(res, 'Failed to send message', error);
  }
};

/**
 * POST /api/v1/messages/conversations/:id/read
 * Mark all messages as read for current user
 */
export const markConversationRead = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
    const { id } = req.params;
    const pool = getPool();

    // Ensure participant
    const [participantCheck] = await pool.execute<RowDataPacket[]>(
      'SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ? LIMIT 1',
      [id, userId]
    );
    if (!participantCheck.length) {
      return res.status(403).json({ success: false, message: 'Not a participant in this conversation' });
    }

    await pool.execute(
      'UPDATE messages SET is_read = 1, read_at = NOW() WHERE conversation_id = ? AND recipient_id = ? AND is_read = 0',
      [id, userId]
    );

    return res.json({ success: true, message: 'Conversation marked as read' });
  } catch (error) {
    return serverError(res, 'Failed to mark conversation read', error);
  }
};

/**
 * POST /api/v1/messages/conversations/:id/archive
 * Archive a conversation for the current user (soft-hide)
 */
export const archiveConversation = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
    const { id } = req.params;
    const pool = getPool();

    const [participantCheck] = await pool.execute<RowDataPacket[]>(
      'SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ? LIMIT 1',
      [id, userId]
    );
    if (!participantCheck.length) {
      return res.status(403).json({ success: false, message: 'Not a participant in this conversation' });
    }

    await pool.execute(
      'UPDATE conversation_participants SET archived_at = NOW() WHERE conversation_id = ? AND user_id = ?',
      [id, userId]
    );

    return res.json({ success: true, message: 'Conversation archived' });
  } catch (error) {
    return serverError(res, 'Failed to archive conversation', error);
  }
};

/**
 * POST /api/v1/messages/conversations/:id/unarchive
 * Remove archived flag for the current user on a conversation
 */
export const unarchiveConversation = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
    const { id } = req.params;

    const pool = getPool();
    const [result] = await pool.execute<ResultSetHeader>(
      'UPDATE conversation_participants SET archived_at = NULL WHERE conversation_id = ? AND user_id = ? LIMIT 1',
      [id, userId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'Conversation not archived or not found for user' });
    }

    return res.json({ success: true, message: 'Conversation unarchived' });
  } catch (error) {
    return serverError(res, 'Failed to unarchive conversation', error);
  }
};
