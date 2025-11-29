import express from 'express';
import {
  getHostStats,
  getHostActivity,
  getHostFinancials,
  getAdminStats,
  getAllUsers,
  updateUserStatus,
  approveHost
} from '../controllers/analyticsController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

// Dev-only logger to trace 401 causes
const devAuthTrace = (req: any, _res: any, next: any) => {
  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.debug(`[analytics route] ${req.method} ${req.originalUrl} userId=${req.user?.id || req.userId || 'none'} role=${req.user?.role || 'n/a'}`);
  }
  next();
};

const router = express.Router();

// Host analytics routes (require authentication)
router.get('/host/stats', authenticateToken, devAuthTrace, getHostStats);
router.get('/host/activity', authenticateToken, devAuthTrace, getHostActivity);
router.get('/host/financials', authenticateToken, devAuthTrace, getHostFinancials);

// Admin analytics routes (require admin role)
router.get('/admin/stats', authenticateToken, requireAdmin, getAdminStats);
router.get('/admin/users', authenticateToken, requireAdmin, getAllUsers);
router.put('/admin/users/:userId/status', authenticateToken, requireAdmin, updateUserStatus);
router.put('/admin/users/:userId/approve-host', authenticateToken, requireAdmin, approveHost);

export default router;