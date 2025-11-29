import express from 'express';
import {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  logout,
  verifyEmail,
  resendVerification,
  validateToken,
  requestPasswordReset,
  resetPassword
} from '@/controllers/authController';
import { authenticateToken } from '@/middleware/auth';
import { authLimiter } from '@/middleware/security';

const router = express.Router();

// Public routes (no authentication required) with rate limiting
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/logout', logout);
router.post('/resend-verification', resendVerification);
// Test-mode shortcut: POST /reset-password with { email, new_password? }
// If new_password is provided, password is updated immediately (no email link)
router.post('/reset-password', requestPasswordReset); // Frontend currently calls this with { email, new_password? }
router.post('/reset-password/confirm', resetPassword); // Token + new password
router.get('/verify/:token', verifyEmail);
router.get('/validate', authenticateToken, validateToken);

// Protected routes (authentication required)
router.get('/profile', authenticateToken, getProfile);
router.put('/profile', authenticateToken, updateProfile);
router.put('/change-password', authenticateToken, changePassword);

export default router;