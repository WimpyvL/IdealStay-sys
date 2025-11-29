# Ideal Stay V3 - Database Schema Documentation

## Overview
This database schema is designed to support a comprehensive vacation rental platform with all the features needed for hosts, guests, and administrators. The schema is optimized for performance, scalability, and data integrity.

## Core Tables & Relationships

### 1. Users System
- **`users`**: Core user management with role-based access (guest, host, admin)
- **`user_addresses`**: Flexible address storage supporting multiple addresses per user
- **Features**: Email verification, host approval process, separate ratings for host/guest roles

### 2. Property Management
- **`properties`**: Main property listings with comprehensive details
- **`amenities`**: Reusable amenity catalog organized by categories
- **`property_amenities`**: Many-to-many relationship linking properties to amenities
- **`property_images`**: Image management with ordering and primary image designation
- **`blocked_dates`**: Availability management for maintenance, personal use, etc.

### 3. Booking System
- **`bookings`**: Complete booking lifecycle management
- **Features**: 
  - Detailed pricing breakdown (base price, cleaning fee, taxes, deposits)
  - Status tracking (pending → confirmed → completed)
  - Payment status tracking
  - Cancellation handling with reasons and timestamps
  - Special requests and notes system

### 4. Review & Rating System
- **`reviews`**: Comprehensive review system for properties and users
- **Features**:
  - Overall rating + category-specific ratings (cleanliness, accuracy, etc.)
  - Bidirectional reviews (guests review properties/hosts, hosts review guests)
  - Response system for hosts to reply to reviews
  - Review moderation capabilities

### 5. Communication System
- **`messages`**: Direct messaging between hosts and guests
- **`notifications`**: System-wide notification management
- **Features**:
  - Booking-specific and general property inquiries
  - Read receipt tracking
  - Message categorization

### 6. Additional Features
- **`favorites`**: User wishlist/saved properties
- **Performance optimization views** for common queries

## Key Design Decisions

### Security & Data Integrity
- Foreign key constraints with CASCADE deletes where appropriate
- Unique constraints to prevent duplicate relationships
- Check constraints for rating values (1-5 scale)
- Proper indexing for query performance

### Performance Optimization
- Strategic indexing on frequently queried columns
- Composite indexes for complex queries (location, dates, etc.)
- Denormalized data where beneficial (host_id in bookings table)
- Database views for common complex queries

### Scalability Features
- Separate tables for addresses (supports multiple locations)
- Flexible amenity system (easy to add new amenities)
- Extensible notification system
- Modular image storage system

## Data Types & Constraints

### User Ratings
- Decimal(3,2) format: allows ratings like 4.85
- Range: 0.00 to 5.00

### Money Fields
- Decimal(10,2) format: supports up to $99,999,999.99
- Separate fields for different fee types

### Dates & Times
- DATE for booking dates
- TIME for check-in/check-out times
- TIMESTAMP for audit trails

### Status Enums
- **Booking Status**: pending, confirmed, cancelled, completed, refunded
- **Payment Status**: pending, paid, failed, refunded, partial
- **Property Status**: draft, pending, active, inactive, suspended
- **User Roles**: guest, host, admin

## Indexes Strategy

### Primary Indexes (Performance Critical)
- Property search: `idx_city`, `idx_price`, `idx_max_guests`, `idx_rating`
- Booking queries: `idx_dates`, `idx_property_dates` (prevents double booking)
- User lookups: `idx_email`, `idx_role`

### Composite Indexes
- Location-based search: `idx_location` (latitude, longitude)
- Booking conflicts: `idx_property_dates` (property_id, check_in_date, check_out_date)

## Views for Common Operations

### `property_search_view`
Pre-joined data for property search results including:
- Property details and pricing
- Host information and ratings
- Primary image URL
- Average ratings and review counts

### `booking_calendar_view`
Calendar data combining:
- Blocked dates (maintenance, personal use)
- Booking check-in/check-out dates
- Unified view for availability checking

## Sample Queries

### Find Available Properties
```sql
SELECT * FROM property_search_view p
WHERE p.city = 'Miami'
AND p.max_guests >= 4
AND p.id NOT IN (
    SELECT DISTINCT property_id 
    FROM booking_calendar_view 
    WHERE date BETWEEN '2024-01-15' AND '2024-01-20'
);
```

### Calculate Property Availability
```sql
-- Check if property is available for specific dates
SELECT COUNT(*) as conflicts
FROM bookings b
WHERE b.property_id = 123
AND b.status IN ('confirmed', 'pending')
AND NOT (b.check_out_date <= '2024-01-15' OR b.check_in_date >= '2024-01-20');
```

### Get Property with All Details
```sql
SELECT 
    p.*,
    GROUP_CONCAT(a.name) as amenities,
    AVG(r.rating) as avg_rating,
    COUNT(r.id) as review_count
FROM properties p
LEFT JOIN property_amenities pa ON p.id = pa.property_id
LEFT JOIN amenities a ON pa.amenity_id = a.id
LEFT JOIN reviews r ON p.id = r.property_id AND r.is_published = TRUE
WHERE p.id = 123
GROUP BY p.id;
```

## Migration Strategy

1. **Phase 1**: Create core tables (users, properties, amenities)
2. **Phase 2**: Add booking and review systems
3. **Phase 3**: Implement communication features
4. **Phase 4**: Add optimization views and advanced features

## Backup & Maintenance

### Recommended Backup Schedule
- **Daily**: Full database backup
- **Hourly**: Transaction log backup
- **Weekly**: Schema backup

### Maintenance Tasks
- **Weekly**: Update statistics and rebuild indexes
- **Monthly**: Archive old notifications and messages
- **Quarterly**: Review and optimize slow queries

## Security Considerations

### Data Protection
- Password hashes only (never plain text passwords)
- Email verification tokens with expiration
- Soft deletes for important audit data

### Access Control
- Role-based permissions in application layer
- Database user with minimal required permissions
- Regular security audits of data access patterns

This schema provides a robust foundation for your vacation rental platform while maintaining flexibility for future enhancements.