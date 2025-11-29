import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import {
  getAmenities,
  createAmenity,
  updateAmenity,
  deleteAmenity,
  getAmenityStats
} from '../controllers/amenityController';

const router = express.Router();

// ==================================================
// AMENITY ROUTES
// ==================================================

/**
 * GET /api/amenities/stats
 * Get amenity usage statistics (admin only)
 * IMPORTANT: This must be before the / route to avoid conflicts
 */
router.get('/stats', authenticateToken, requireRole(['admin']), getAmenityStats);

/**
 * GET /api/amenities
 * Get all amenities (public)
 * Query parameters:
 * - category: basic|safety|luxury|outdoor|family
 * - active_only: true|false (default: true)
 */
router.get('/', getAmenities);

/**
 * POST /api/amenities
 * Create a new amenity (admin only)
 * Body: { name, icon?, category, description? }
 */
router.post('/', authenticateToken, requireRole(['admin']), createAmenity);

/**
 * PUT /api/amenities/:id
 * Update an amenity (admin only)
 * Body: { name?, icon?, category?, description?, is_active? }
 */
router.put('/:id', authenticateToken, requireRole(['admin']), updateAmenity);

/**
 * DELETE /api/amenities/:id
 * Delete/deactivate an amenity (admin only)
 */
router.delete('/:id', authenticateToken, requireRole(['admin']), deleteAmenity);

export default router;