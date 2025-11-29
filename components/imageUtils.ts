import { Property } from '../types';
import { BASE_URL } from '../src/services/api.config';

// Resolve the primary image path (raw) from a property record that may have:
// 1. images array with is_primary flag
// 2. images array without primary flag (use first)
// 3. a loose backend field primary_image (host dashboard endpoint)
// 4. legacy shape with images[].url instead of images[].image_url
export function resolvePrimaryPropertyImage(property: (Property & { primary_image?: string }) | null | undefined): string | undefined {
  if (!property) return undefined;
  const images = property.images || [];
  const primaryFromFlag = images.find(img => (img as any).is_primary) || images[0];
  const fromArray = primaryFromFlag?.image_url || (primaryFromFlag as any)?.url;
  const fromField = (property as any).primary_image;
  return fromArray || fromField || undefined;
}

// Ensure image URLs from the API are absolute (backend serves uploads at /uploads on a different origin in dev)
export function toAbsoluteImageUrl(url?: string): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url; // already absolute
  try {
    const origin = new URL(BASE_URL).origin; // e.g., http://localhost:3001
    if (url.startsWith('/')) return origin + url;
    return `${origin}/${url.replace(/^\/+/, '')}`;
  } catch {
    return url;
  }
}
