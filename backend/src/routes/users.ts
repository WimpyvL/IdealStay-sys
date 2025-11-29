import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { getMe, getProfile, updateProfile, becomeHost } from '../controllers/userController';
import { uploadProfile, uploadProfileImage } from '../controllers/imageController';

const router = Router();

// Placeholder root
router.get('/', (req, res) => {
  res.json({ success: true, message: 'User routes root' });
});

// Authenticated user info
router.get('/me', authenticateToken, getMe);

// Get user profile
router.get('/profile', authenticateToken, getProfile);

// Update user profile
router.put('/profile', authenticateToken, updateProfile);

// Upload profile image
router.post('/profile/image', authenticateToken, uploadProfile.single('image'), uploadProfileImage);

// Become a host (auto-approve for now)
router.post('/become-host', authenticateToken, becomeHost);

export default router;