import { Router } from 'express';
import { authenticateToken } from '@/middleware/auth';
import {
  getConversations,
  getArchivedConversations,
  createConversation,
  getMessages,
  sendMessage,
  markConversationRead,
  archiveConversation,
  unarchiveConversation
} from '@/controllers/messageController';

const router = Router();

// Conversation list & creation
router.get('/conversations', authenticateToken, getConversations);
router.get('/conversations/archived', authenticateToken, getArchivedConversations);
router.post('/conversations', authenticateToken, createConversation);

// Messages within conversation
router.get('/conversations/:id/messages', authenticateToken, getMessages);
router.post('/conversations/:id/messages', authenticateToken, sendMessage);
router.post('/conversations/:id/read', authenticateToken, markConversationRead);
router.post('/conversations/:id/archive', authenticateToken, archiveConversation);
router.post('/conversations/:id/unarchive', authenticateToken, unarchiveConversation);

export default router;