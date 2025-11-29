/**
 * Image utility functions for Ideal Stay V3
 * Handles proper URL resolution for different image sources
 */

// Get the API base URL based on environment
const getApiBaseUrl = (): string => {
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3001';
  }
  return 'https://your-cpanel-domain.com';
};

/**
 * Resolves image URL to the correct format for display
 * @param imagePath - The image path from the database
 * @returns Properly formatted image URL
 */
export const getImageUrl = (imagePath: string | null | undefined): string => {
  if (!imagePath) return '';
  
  // If it's already a full URL (http/https) or base64, return as is
  if (imagePath.startsWith('http') || imagePath.startsWith('data:')) {
    return imagePath;
  }
  
  // If it's a relative path from uploads, prepend the API base URL
  if (imagePath.startsWith('/uploads/')) {
    return `${getApiBaseUrl()}${imagePath}`;
  }
  
  // If it's just a filename (legacy), assume it's in uploads
  if (!imagePath.includes('/') && !imagePath.includes('http')) {
    return `${getApiBaseUrl()}/uploads/profiles/${imagePath}`;
  }
  
  return imagePath;
};

/**
 * Gets a fallback avatar URL based on user info
 * @param firstName - User's first name
 * @param lastName - User's last name
 * @param userId - User's ID for consistent avatar generation
 * @returns Default avatar URL
 */
export const getFallbackAvatarUrl = (firstName?: string, lastName?: string, userId?: number): string => {
  const name = `${firstName || ''} ${lastName || ''}`.trim();
  const seed = userId || name || 'user';
  return `https://i.pravatar.cc/150?u=${encodeURIComponent(seed)}`;
};

/**
 * Gets the profile image URL with fallback
 * @param profileImageUrl - User's profile image URL
 * @param firstName - User's first name (for fallback)
 * @param lastName - User's last name (for fallback)
 * @param userId - User's ID (for fallback)
 * @returns Image URL with fallback
 */
export const getProfileImageUrl = (
  profileImageUrl?: string | null,
  firstName?: string,
  lastName?: string,
  userId?: number
): string => {
  if (profileImageUrl) {
    return getImageUrl(profileImageUrl);
  }
  return getFallbackAvatarUrl(firstName, lastName, userId);
};

export default {
  getImageUrl,
  getFallbackAvatarUrl,
  getProfileImageUrl,
};