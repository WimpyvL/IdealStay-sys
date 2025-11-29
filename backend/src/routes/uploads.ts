import { Router } from 'express';
const router = Router();

router.get('/', (req, res) => {
  res.json({ success: true, message: 'Upload routes - Coming soon!' });
});

export default router;