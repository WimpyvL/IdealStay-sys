import { Request, Response } from 'express';
import { getPool } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

// Configure multer for property images
const propertyStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'properties');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// Configure multer for profile images
const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'profiles');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with user prefix for easy identification
    const uniqueName = `user_${req.userId || 'unknown'}_${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// File filter for images only
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'));
  }
};

// Configure multer for properties
export const upload = multer({
  storage: propertyStorage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per file
    files: 10 // Max 10 files per upload
  }
});

// Configure multer for profile images
export const uploadProfile = multer({
  storage: profileStorage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per file
    files: 1 // Only 1 profile image per upload
  }
});

/**
 * Upload images for a property
 */
export const uploadPropertyImages = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id: propertyId } = req.params;
    const userId = req.userId;
    const userRole = req.user?.role;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const pool = getPool();

    // Verify property exists and user has permission
    const [propertyRows] = await pool.execute<RowDataPacket[]>(
      'SELECT host_id FROM properties WHERE id = ?',
      [propertyId]
    );

    if (propertyRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    const property = propertyRows[0];

    // Check permissions
    if (userRole !== 'admin' && property.host_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only upload images for your own properties'
      });
    }

    // Check if files were uploaded
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No images uploaded'
      });
    }

    // Get current image count and max display order
    const [imageCountRows] = await pool.execute<RowDataPacket[]>(
      'SELECT COUNT(*) as count, MAX(display_order) as maxOrder FROM property_images WHERE property_id = ?',
      [propertyId]
    );

    const currentCount = imageCountRows[0].count;
    const maxOrder = imageCountRows[0].maxOrder || 0;

    // Check if adding these images would exceed the limit (e.g., 20 images max)
    const MAX_IMAGES_PER_PROPERTY = 20;
    if (currentCount + files.length > MAX_IMAGES_PER_PROPERTY) {
      // Clean up uploaded files
      files.forEach(file => {
        fs.unlink(file.path, (err) => {
          if (err) console.error('Error deleting file:', err);
        });
      });

      return res.status(400).json({
        success: false,
        message: `Maximum ${MAX_IMAGES_PER_PROPERTY} images allowed per property. Current: ${currentCount}, Attempting to add: ${files.length}`
      });
    }

    // Process each uploaded file
    const imageRecords = [];
    const { isPrimary = false, altText = '' } = req.body;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const imageUrl = `/uploads/properties/${file.filename}`;
      const displayOrder = maxOrder + i + 1;
      
      // Only set the first image as primary if requested and no primary exists
      const shouldBePrimary = i === 0 && isPrimary === 'true' && currentCount === 0;

      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO property_images (property_id, image_url, alt_text, display_order, is_primary)
         VALUES (?, ?, ?, ?, ?)`,
        [propertyId, imageUrl, altText, displayOrder, shouldBePrimary]
      );

      imageRecords.push({
        id: result.insertId,
        property_id: propertyId,
        image_url: imageUrl,
        alt_text: altText,
        display_order: displayOrder,
        is_primary: shouldBePrimary,
        original_name: file.originalname,
        size: file.size
      });
    }

    return res.status(201).json({
      success: true,
      message: `${files.length} image(s) uploaded successfully`,
      data: {
        images: imageRecords,
        uploaded_count: files.length,
        total_images: currentCount + files.length
      }
    });

  } catch (error) {
    console.error('❌ Error uploading images:', error);

    // Clean up any uploaded files on error
    if (req.files) {
      const files = req.files as Express.Multer.File[];
      files.forEach(file => {
        fs.unlink(file.path, (err) => {
          if (err) console.error('Error deleting file:', err);
        });
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to upload images',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

/**
 * Get all images for a property
 */
export const getPropertyImages = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id: propertyId } = req.params;
    const pool = getPool();

    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM property_images WHERE property_id = ? ORDER BY display_order ASC',
      [propertyId]
    );

    return res.json({
      success: true,
      data: {
        images: rows,
        count: rows.length
      }
    });

  } catch (error) {
    console.error('❌ Error fetching property images:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch property images',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

/**
 * Update image details (alt text, display order, primary status)
 */
export const updatePropertyImage = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id: propertyId, imageId } = req.params;
    const { alt_text, display_order, is_primary } = req.body;
    const userId = req.userId;
    const userRole = req.user?.role;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const pool = getPool();

    // Verify property exists and user has permission
    const [propertyRows] = await pool.execute<RowDataPacket[]>(
      'SELECT host_id FROM properties WHERE id = ?',
      [propertyId]
    );

    if (propertyRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    const property = propertyRows[0];

    // Check permissions
    if (userRole !== 'admin' && property.host_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only manage images for your own properties'
      });
    }

    // Verify image exists for this property
    const [imageRows] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM property_images WHERE id = ? AND property_id = ?',
      [imageId, propertyId]
    );

    if (imageRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Image not found for this property'
      });
    }

    // If setting as primary, remove primary status from other images first
    if (is_primary === true) {
      await pool.execute(
        'UPDATE property_images SET is_primary = FALSE WHERE property_id = ? AND id != ?',
        [propertyId, imageId]
      );
    }

    // Build update query
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    if (alt_text !== undefined) {
      updateFields.push('alt_text = ?');
      updateValues.push(alt_text);
    }

    if (display_order !== undefined) {
      updateFields.push('display_order = ?');
      updateValues.push(display_order);
    }

    if (is_primary !== undefined) {
      updateFields.push('is_primary = ?');
      updateValues.push(is_primary);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    updateValues.push(imageId);

    await pool.execute(
      `UPDATE property_images SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    // Fetch updated image
    const [updatedImage] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM property_images WHERE id = ?',
      [imageId]
    );

    return res.json({
      success: true,
      message: 'Image updated successfully',
      data: updatedImage[0]
    });

  } catch (error) {
    console.error('❌ Error updating image:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update image',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

/**
 * Delete a property image
 */
export const deletePropertyImage = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id: propertyId, imageId } = req.params;
    const userId = req.userId;
    const userRole = req.user?.role;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const pool = getPool();

    // Verify property exists and user has permission
    const [propertyRows] = await pool.execute<RowDataPacket[]>(
      'SELECT host_id FROM properties WHERE id = ?',
      [propertyId]
    );

    if (propertyRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    const property = propertyRows[0];

    // Check permissions
    if (userRole !== 'admin' && property.host_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only manage images for your own properties'
      });
    }

    // Get image details before deletion
    const [imageRows] = await pool.execute<RowDataPacket[]>(
      'SELECT image_url, is_primary FROM property_images WHERE id = ? AND property_id = ?',
      [imageId, propertyId]
    );

    if (imageRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Image not found for this property'
      });
    }

    const image = imageRows[0];

    // Delete from database
    await pool.execute(
      'DELETE FROM property_images WHERE id = ?',
      [imageId]
    );

    // Delete physical file
    const filePath = path.join(process.cwd(), 'uploads', 'properties', path.basename(image.image_url));
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error('Error deleting image file:', err);
        // Don't fail the request if file deletion fails
      }
    });

    // If deleted image was primary, set another image as primary
    if (image.is_primary) {
      await pool.execute(
        'UPDATE property_images SET is_primary = TRUE WHERE property_id = ? ORDER BY display_order ASC LIMIT 1',
        [propertyId]
      );
    }

    return res.json({
      success: true,
      message: 'Image deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting image:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete image',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

/**
 * Reorder property images
 */
export const reorderPropertyImages = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id: propertyId } = req.params;
    const { imageOrders } = req.body; // Array of { id, display_order }
    const userId = req.userId;
    const userRole = req.user?.role;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!Array.isArray(imageOrders)) {
      return res.status(400).json({
        success: false,
        message: 'imageOrders must be an array'
      });
    }

    const pool = getPool();

    // Verify property exists and user has permission
    const [propertyRows] = await pool.execute<RowDataPacket[]>(
      'SELECT host_id FROM properties WHERE id = ?',
      [propertyId]
    );

    if (propertyRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    const property = propertyRows[0];

    // Check permissions
    if (userRole !== 'admin' && property.host_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only manage images for your own properties'
      });
    }

    // Update display orders
    for (const imageOrder of imageOrders) {
      if (typeof imageOrder.id !== 'number' || typeof imageOrder.display_order !== 'number') {
        continue; // Skip invalid entries
      }

      await pool.execute(
        'UPDATE property_images SET display_order = ? WHERE id = ? AND property_id = ?',
        [imageOrder.display_order, imageOrder.id, propertyId]
      );
    }

    // Fetch updated images
    const [updatedImages] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM property_images WHERE property_id = ? ORDER BY display_order ASC',
      [propertyId]
    );

    return res.json({
      success: true,
      message: 'Images reordered successfully',
      data: {
        images: updatedImages
      }
    });

  } catch (error) {
    console.error('❌ Error reordering images:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reorder images',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

/**
 * Upload profile image for a user
 */
export const uploadProfileImage = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Check if file was uploaded
    const file = req.file as Express.Multer.File;
    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No image uploaded'
      });
    }

    const pool = getPool();
    const imageUrl = `/uploads/profiles/${file.filename}`;

    // Get current profile image to delete old one
    const [userRows] = await pool.execute<RowDataPacket[]>(
      'SELECT profile_image_url FROM users WHERE id = ?',
      [userId]
    );

    const currentImageUrl = userRows[0]?.profile_image_url;

    // Update user's profile image URL
    await pool.execute(
      `UPDATE users SET 
        profile_image_url = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [imageUrl, userId]
    );

    // Delete old profile image file if it exists and is a file path (not base64 or external URL)
    if (currentImageUrl && 
        currentImageUrl.startsWith('/uploads/profiles/') &&
        !currentImageUrl.startsWith('data:') &&
        !currentImageUrl.startsWith('http')) {
      
      const oldFilePath = path.join(process.cwd(), currentImageUrl.substring(1)); // Remove leading slash
      fs.unlink(oldFilePath, (err) => {
        if (err) console.warn('Could not delete old profile image:', err.message);
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Profile image uploaded successfully',
      data: {
        profile_image_url: imageUrl,
        original_name: file.originalname,
        size: file.size
      }
    });

  } catch (error) {
    console.error('❌ Error uploading profile image:', error);

    // Clean up uploaded file on error
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting file:', err);
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to upload profile image',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};