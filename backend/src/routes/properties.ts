import express from 'express';
import { authenticateToken, optionalAuth, requireHostOrAdmin, requireRole } from '../middleware/auth';
import { cacheMiddleware } from '../utils/performance';
import {
  getProperties,
  getPropertyById,
  createProperty,
  updateProperty,
  deleteProperty,
  getHostProperties,
  getPropertiesByHostId
} from '../controllers/propertyController';
import {
  uploadPropertyImages,
  getPropertyImages,
  updatePropertyImage,
  deletePropertyImage,
  reorderPropertyImages,
  upload
} from '../controllers/imageController';
import {
  getPropertyAmenities,
  assignPropertyAmenities
} from '../controllers/amenityController';

const router = express.Router();

// ==================================================
// PUBLIC PROPERTY ROUTES (No authentication required)
// ==================================================

/**
 * GET /api/properties/host/my-properties
 * Get current host's properties (must be before /:id route)
 * Query parameters:
 * - status: draft|pending|active|inactive
 * - page: number
 * - limit: number
 */
router.get('/host/my-properties', authenticateToken, requireRole(['host', 'admin']), getHostProperties);

/**
 * GET /api/properties/host/:hostId
 * Get public list of a specific host's properties (active & pending)
 * Used for backward compatibility with older frontend code.
 */
router.get('/host/:hostId', getPropertiesByHostId);

/**
 * GET /api/properties
 * Search and filter properties (public)
 * Query parameters:
 * - location: string (city, address, country)
 * - checkIn: YYYY-MM-DD
 * - checkOut: YYYY-MM-DD
 * - guests: number
 * - minPrice: number
 * - maxPrice: number
 * - propertyType: apartment|house|villa|cabin|cottage|condo|townhouse|other
 * - amenities: comma-separated amenity IDs
 * - bedrooms: number
 * - bathrooms: number
 * - page: number (default: 1)
 * - limit: number (default: 12, max: 50)
 * - sortBy: price_per_night|average_rating|created_at (default: created_at)
 * - sortOrder: asc|desc (default: desc)
 */
router.get('/', cacheMiddleware(300), optionalAuth, getProperties); // Cache for 5 minutes

/**
 * GET /api/properties/:id
 * Get single property details with all related data (public)
 */
router.get('/:id', cacheMiddleware(60), optionalAuth, getPropertyById); // Cache for 1 minute

/**
 * GET /api/properties/:id/images
 * Get all images for a property (public)
 */
router.get('/:id/images', getPropertyImages);

/**
 * GET /api/properties/:propertyId/amenities
 * Get amenities for a specific property (public)
 */
router.get('/:propertyId/amenities', getPropertyAmenities);

// ==================================================
// HOST/ADMIN PROPERTY MANAGEMENT ROUTES
// ==================================================

/**
 * POST /api/properties
 * Create a new property (hosts only)
 * Body: PropertyCreateData
 */
router.post('/', authenticateToken, requireRole(['host', 'admin']), createProperty);

/**
 * PUT /api/properties/:id
 * Update property details (host/admin only)
 * Body: Partial<PropertyCreateData>
 */
router.put('/:id', authenticateToken, requireHostOrAdmin, updateProperty);

/**
 * DELETE /api/properties/:id
 * Soft delete property (host/admin only)
 */
router.delete('/:id', authenticateToken, requireHostOrAdmin, deleteProperty);



// ==================================================
// PROPERTY IMAGE MANAGEMENT ROUTES
// ==================================================

/**
 * POST /api/properties/:id/images
 * Upload images for a property (host/admin only)
 * Multipart form data with files
 * Optional body: isPrimary (boolean), altText (string)
 */
router.post('/:id/images', authenticateToken, requireHostOrAdmin, upload.array('images', 10), uploadPropertyImages);

/**
 * PUT /api/properties/:id/images/:imageId
 * Update image details (host/admin only)
 * Body: { alt_text?, display_order?, is_primary? }
 */
router.put('/:id/images/:imageId', authenticateToken, requireHostOrAdmin, updatePropertyImage);

/**
 * DELETE /api/properties/:id/images/:imageId
 * Delete a property image (host/admin only)
 */
router.delete('/:id/images/:imageId', authenticateToken, requireHostOrAdmin, deletePropertyImage);

/**
 * PUT /api/properties/:id/images/reorder
 * Reorder property images (host/admin only)
 * Body: { imageOrders: Array<{id: number, display_order: number}> }
 */
router.put('/:id/images/reorder', authenticateToken, requireHostOrAdmin, reorderPropertyImages);

// ==================================================
// PROPERTY AMENITY MANAGEMENT ROUTES
// ==================================================

/**
 * PUT /api/properties/:propertyId/amenities
 * Assign amenities to a property (host/admin only)
 * Body: { amenity_ids: number[] }
 */
router.put('/:propertyId/amenities', authenticateToken, requireHostOrAdmin, assignPropertyAmenities);



export default router;