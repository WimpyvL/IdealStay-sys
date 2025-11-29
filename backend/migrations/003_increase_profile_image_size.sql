-- Migration: Increase profile_image_url column size to support base64 images
-- Date: 2025-10-02

-- Increase profile_image_url from VARCHAR(500) to MEDIUMTEXT to support base64 encoded images
-- MEDIUMTEXT can hold up to 16MB, which is more than enough for profile images
ALTER TABLE users
MODIFY COLUMN profile_image_url MEDIUMTEXT;

-- Add a comment for documentation
ALTER TABLE users
MODIFY COLUMN profile_image_url MEDIUMTEXT COMMENT 'Profile image URL or base64 encoded image data';
