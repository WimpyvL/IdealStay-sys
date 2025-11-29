/**
 * Performance Optimization Utilities
 * Caching, query optimization, and performance monitoring for Ideal Stay V3
 */

import { Request, Response, NextFunction } from 'express';

// Simple in-memory cache implementation
class MemoryCache {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

  set(key: string, data: any, ttlSeconds: number = 300): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlSeconds * 1000
    });
  }

  get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  // Clean expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

// Global cache instance
export const cache = new MemoryCache();

// Cleanup expired cache entries every 5 minutes
setInterval(() => {
  cache.cleanup();
}, 5 * 60 * 1000);

/**
 * Cache middleware for caching API responses
 */
export const cacheMiddleware = (ttlSeconds: number = 300) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Create cache key from URL and query params
    const cacheKey = `${req.method}:${req.originalUrl}`;
    
    // Check cache first
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      console.log(`📋 Cache hit: ${cacheKey}`);
      res.json(cachedData);
      return;
    }

    // Store original json function
    const originalJson = res.json.bind(res);
    
    // Override json function to cache response
    res.json = (data: any) => {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log(`💾 Caching: ${cacheKey}`);
        cache.set(cacheKey, data, ttlSeconds);
      }
      return originalJson(data);
    };

    next();
  };
};

/**
 * Performance monitoring middleware
 */
export const performanceMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Log slow requests (>1000ms)
    if (duration > 1000) {
      console.warn(`⚠️  Slow request: ${req.method} ${req.originalUrl} - ${duration}ms`);
    } else if (duration > 500) {
      console.log(`⏰ Medium request: ${req.method} ${req.originalUrl} - ${duration}ms`);
    } else {
      console.log(`⚡ Fast request: ${req.method} ${req.originalUrl} - ${duration}ms`);
    }
  });
  
  next();
};

/**
 * Database query optimization helpers
 */
export class QueryOptimizer {
  
  /**
   * Build optimized property search query with proper indexing
   */
  static buildPropertySearchQuery(filters: any): { query: string; params: any[] } {
    let baseQuery = `
      SELECT 
        p.*,
        COALESCE(AVG(r.rating), 0) as average_rating,
        COUNT(DISTINCT r.review_id) as review_count,
        GROUP_CONCAT(DISTINCT a.name) as amenities
      FROM properties p
      LEFT JOIN reviews r ON p.property_id = r.property_id
      LEFT JOIN property_amenities pa ON p.property_id = pa.property_id
      LEFT JOIN amenities a ON pa.amenity_id = a.amenity_id
    `;
    
    const conditions: string[] = [];
    const params: any[] = [];
    
    // Add WHERE conditions
    if (filters.location) {
      conditions.push('(p.city LIKE ? OR p.address LIKE ? OR p.country LIKE ?)');
      const locationPattern = `%${filters.location}%`;
      params.push(locationPattern, locationPattern, locationPattern);
    }
    
    if (filters.minPrice) {
      conditions.push('p.price_per_night >= ?');
      params.push(parseFloat(filters.minPrice));
    }
    
    if (filters.maxPrice) {
      conditions.push('p.price_per_night <= ?');
      params.push(parseFloat(filters.maxPrice));
    }
    
    if (filters.guests) {
      conditions.push('p.max_guests >= ?');
      params.push(parseInt(filters.guests));
    }
    
    if (filters.propertyType) {
      conditions.push('p.property_type = ?');
      params.push(filters.propertyType);
    }
    
    if (filters.bedrooms) {
      conditions.push('p.bedrooms >= ?');
      params.push(parseInt(filters.bedrooms));
    }
    
    if (filters.bathrooms) {
      conditions.push('p.bathrooms >= ?');
      params.push(parseInt(filters.bathrooms));
    }
    
    // Always filter for active properties
    conditions.push('p.status = "active"');
    
    if (conditions.length > 0) {
      baseQuery += ' WHERE ' + conditions.join(' AND ');
    }
    
    // Add GROUP BY for aggregated data
    baseQuery += ' GROUP BY p.property_id';
    
    // Add ORDER BY
    const sortBy = filters.sortBy || 'created_at';
    const sortOrder = filters.sortOrder === 'asc' ? 'ASC' : 'DESC';
    
    switch (sortBy) {
      case 'price':
        baseQuery += ` ORDER BY p.price_per_night ${sortOrder}`;
        break;
      case 'rating':
        baseQuery += ` ORDER BY average_rating ${sortOrder}`;
        break;
      case 'reviews':
        baseQuery += ` ORDER BY review_count ${sortOrder}`;
        break;
      default:
        baseQuery += ` ORDER BY p.${sortBy} ${sortOrder}`;
    }
    
    // Add LIMIT for pagination
    const page = parseInt(filters.page) || 1;
    const limit = Math.min(parseInt(filters.limit) || 20, 100); // Max 100 per page
    const offset = (page - 1) * limit;
    
    baseQuery += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    return { query: baseQuery, params };
  }
  
  /**
   * Build optimized booking availability query
   */
  static buildAvailabilityQuery(): string {
    return `
      SELECT 
        b.booking_id,
        b.check_in_date,
        b.check_out_date,
        b.status
      FROM bookings b
      WHERE b.property_id = ?
        AND b.status IN ('pending', 'confirmed', 'active')
        AND (
          (? >= b.check_in_date AND ? < b.check_out_date) OR
          (? > b.check_in_date AND ? <= b.check_out_date) OR
          (? <= b.check_in_date AND ? >= b.check_out_date)
        )
    `;
  }
}

/**
 * Cache invalidation helpers
 */
export class CacheInvalidator {
  
  static invalidatePropertyCache(propertyId: number): void {
    // Clear property-specific cache entries
    const patterns = [
      `GET:/api/v1/properties`,
      `GET:/api/v1/properties/${propertyId}`,
      `GET:/api/v1/properties?`,
    ];
    
    patterns.forEach(pattern => {
      // In a real implementation, you'd use a more sophisticated pattern matching
      cache.delete(pattern);
    });
    
    console.log(`🗑️  Cache invalidated for property ${propertyId}`);
  }
  
  static invalidateUserCache(userId: number): void {
    const patterns = [
      `GET:/api/v1/bookings`,
      `GET:/api/v1/users/${userId}`,
    ];
    
    patterns.forEach(pattern => {
      cache.delete(pattern);
    });
    
    console.log(`🗑️  Cache invalidated for user ${userId}`);
  }
  
  static clearAll(): void {
    cache.clear();
    console.log('🗑️  All cache cleared');
  }
}

/**
 * Database connection pooling optimization
 */
export const optimizeConnectionPool = () => {
  return {
    // Production optimized settings
    connectionLimit: 20,
    acquireTimeout: 60000,
    timeout: 60000,
    idleTimeout: 600000,
    // Enable connection reuse
    reconnect: true,
    // Query timeout
    queryTimeout: 30000,
  };
};

/**
 * Response compression middleware
 */
export const enableCompression = () => {
  const compression = require('compression');
  return compression({
    filter: (req: Request, res: Response) => {
      // Don't compress responses if client doesn't support it
      if (req.headers['x-no-compression']) {
        return false;
      }
      
      // Use compression filter function
      return compression.filter(req, res);
    },
    level: 6, // Compression level (1-9, 6 is good balance)
    threshold: 1024, // Only compress if response is larger than 1KB
  });
};

export default {
  cache,
  cacheMiddleware,
  performanceMiddleware,
  QueryOptimizer,
  CacheInvalidator,
  optimizeConnectionPool,
  enableCompression,
};