-- ==================================================
-- IDEAL STAY V3 - COMPREHENSIVE DATABASE SCHEMA
-- ==================================================
-- This schema supports: Users, Properties, Bookings, Reviews, Messages, Images, Amenities, and more
-- Designed for cPanel MySQL hosting with proper indexing and relationships

-- ==================================================
-- 1. USERS TABLE - Core user management
-- ==================================================
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    profile_image_url MEDIUMTEXT COMMENT 'Profile image URL or base64 encoded image data',
    date_of_birth DATE,
    
    -- Role and verification
    role ENUM('guest', 'host', 'admin') DEFAULT 'guest',
    is_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255),
    
    -- Host-specific fields
    is_host BOOLEAN DEFAULT FALSE,
    host_approved BOOLEAN DEFAULT FALSE,
    host_rating DECIMAL(3,2) DEFAULT 0.00,
    host_total_reviews INT DEFAULT 0,
    
    -- Guest-specific fields
    guest_rating DECIMAL(3,2) DEFAULT 0.00,
    guest_total_reviews INT DEFAULT 0,
    
    -- Account status
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP NULL,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_email (email),
    INDEX idx_role (role),
    INDEX idx_is_host (is_host),
    INDEX idx_created_at (created_at)
);

-- ==================================================
-- 2. USER ADDRESSES - Flexible address storage
-- ==================================================
CREATE TABLE user_addresses (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    type ENUM('home', 'billing', 'other') DEFAULT 'home',
    street_address VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_type (type)
);

-- ==================================================
-- 3. AMENITIES - Reusable amenities for properties
-- ==================================================
CREATE TABLE amenities (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) UNIQUE NOT NULL,
    icon VARCHAR(100), -- Icon class or identifier
    category ENUM('basic', 'safety', 'luxury', 'outdoor', 'family') DEFAULT 'basic',
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_category (category),
    INDEX idx_name (name)
);

-- ==================================================
-- 4. PROPERTIES - Main property listings
-- ==================================================
CREATE TABLE properties (
    id INT PRIMARY KEY AUTO_INCREMENT,
    host_id INT NOT NULL,
    
    -- Basic info
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    property_type ENUM('apartment', 'house', 'villa', 'cabin', 'cottage', 'condo', 'townhouse', 'other') NOT NULL,
    
    -- Location
    address VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    
    -- Capacity and rooms
    max_guests INT NOT NULL,
    bedrooms INT NOT NULL,
    bathrooms DECIMAL(3,1) NOT NULL,
    beds INT NOT NULL,
    
    -- Pricing
    price_per_night DECIMAL(10, 2) NOT NULL,
    cleaning_fee DECIMAL(10, 2) DEFAULT 0.00,
    security_deposit DECIMAL(10, 2) DEFAULT 0.00,
    
    -- Booking rules
    min_nights INT DEFAULT 1,
    max_nights INT DEFAULT 365,
    check_in_time TIME DEFAULT '15:00:00',
    check_out_time TIME DEFAULT '11:00:00',
    advance_booking_days INT DEFAULT 365,
    
    -- Property status
    status ENUM('draft', 'pending', 'active', 'inactive', 'suspended') DEFAULT 'draft',
    is_instant_book BOOLEAN DEFAULT FALSE,
    
    -- Performance metrics
    total_bookings INT DEFAULT 0,
    total_reviews INT DEFAULT 0,
    average_rating DECIMAL(3,2) DEFAULT 0.00,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes for performance
    INDEX idx_host_id (host_id),
    INDEX idx_city (city),
    INDEX idx_country (country),
    INDEX idx_status (status),
    INDEX idx_price (price_per_night),
    INDEX idx_max_guests (max_guests),
    INDEX idx_location (latitude, longitude),
    INDEX idx_rating (average_rating),
    INDEX idx_created_at (created_at)
);

-- ==================================================
-- 5. PROPERTY AMENITIES - Many-to-many relationship
-- ==================================================
CREATE TABLE property_amenities (
    id INT PRIMARY KEY AUTO_INCREMENT,
    property_id INT NOT NULL,
    amenity_id INT NOT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    FOREIGN KEY (amenity_id) REFERENCES amenities(id) ON DELETE CASCADE,
    
    UNIQUE KEY unique_property_amenity (property_id, amenity_id),
    INDEX idx_property_id (property_id),
    INDEX idx_amenity_id (amenity_id)
);

-- ==================================================
-- 6. PROPERTY IMAGES - Image management for properties
-- ==================================================
CREATE TABLE property_images (
    id INT PRIMARY KEY AUTO_INCREMENT,
    property_id INT NOT NULL,
    image_url VARCHAR(500) NOT NULL,
    alt_text VARCHAR(255),
    display_order INT DEFAULT 0,
    is_primary BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    INDEX idx_property_id (property_id),
    INDEX idx_display_order (display_order),
    INDEX idx_is_primary (is_primary)
);

-- ==================================================
-- 7. BOOKINGS - Core booking management
-- ==================================================
CREATE TABLE bookings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    property_id INT NOT NULL,
    guest_id INT NOT NULL,
    host_id INT NOT NULL, -- Denormalized for performance
    
    -- Booking details
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    guests_count INT NOT NULL,
    
    -- Pricing breakdown
    base_price DECIMAL(10, 2) NOT NULL,
    cleaning_fee DECIMAL(10, 2) DEFAULT 0.00,
    security_deposit DECIMAL(10, 2) DEFAULT 0.00,
    taxes DECIMAL(10, 2) DEFAULT 0.00,
    total_amount DECIMAL(10, 2) NOT NULL,
    
    -- Status and payment
    status ENUM('pending', 'confirmed', 'cancelled', 'completed', 'refunded') DEFAULT 'pending',
    payment_status ENUM('pending', 'paid', 'failed', 'refunded', 'partial') DEFAULT 'pending',
    payment_method VARCHAR(50),
    payment_reference VARCHAR(255),
    
    -- Special requests and notes
    special_requests TEXT,
    host_notes TEXT,
    guest_notes TEXT,
    
    -- Cancellation
    cancelled_at TIMESTAMP NULL,
    cancellation_reason TEXT,
    cancelled_by ENUM('guest', 'host', 'admin') NULL,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    FOREIGN KEY (guest_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes for performance
    INDEX idx_property_id (property_id),
    INDEX idx_guest_id (guest_id),
    INDEX idx_host_id (host_id),
    INDEX idx_status (status),
    INDEX idx_dates (check_in_date, check_out_date),
    INDEX idx_created_at (created_at),
    
    -- Prevent double bookings
    INDEX idx_property_dates (property_id, check_in_date, check_out_date)
);

-- ==================================================
-- 8. REVIEWS - Review system for properties and users
-- ==================================================
CREATE TABLE reviews (
    id INT PRIMARY KEY AUTO_INCREMENT,
    booking_id INT NOT NULL,
    property_id INT NOT NULL,
    reviewer_id INT NOT NULL, -- Who wrote the review
    reviewee_id INT NOT NULL, -- Who is being reviewed (host or guest)
    
    -- Review content
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title VARCHAR(255),
    comment TEXT,
    
    -- Review categories (for properties)
    cleanliness_rating INT CHECK (cleanliness_rating >= 1 AND cleanliness_rating <= 5),
    accuracy_rating INT CHECK (accuracy_rating >= 1 AND accuracy_rating <= 5),
    check_in_rating INT CHECK (check_in_rating >= 1 AND check_in_rating <= 5),
    communication_rating INT CHECK (communication_rating >= 1 AND communication_rating <= 5),
    location_rating INT CHECK (location_rating >= 1 AND location_rating <= 5),
    value_rating INT CHECK (value_rating >= 1 AND value_rating <= 5),
    
    -- Review type
    review_type ENUM('property', 'guest', 'host') NOT NULL,
    
    -- Status
    is_published BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,
    
    -- Response from host/guest
    response TEXT,
    response_date TIMESTAMP NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewee_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Ensure one review per booking per reviewer
    UNIQUE KEY unique_booking_reviewer (booking_id, reviewer_id),
    
    INDEX idx_property_id (property_id),
    INDEX idx_reviewer_id (reviewer_id),
    INDEX idx_reviewee_id (reviewee_id),
    INDEX idx_rating (rating),
    INDEX idx_review_type (review_type),
    INDEX idx_created_at (created_at)
);

-- ==================================================
-- 9. MESSAGES - Communication between hosts and guests
-- ==================================================
CREATE TABLE messages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    booking_id INT, -- Can be NULL for general inquiries
    property_id INT NOT NULL,
    sender_id INT NOT NULL,
    recipient_id INT NOT NULL,
    
    -- Message content
    subject VARCHAR(255),
    message TEXT NOT NULL,
    
    -- Message status
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP NULL,
    
    -- Message type
    message_type ENUM('inquiry', 'booking', 'general', 'system') DEFAULT 'general',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_booking_id (booking_id),
    INDEX idx_property_id (property_id),
    INDEX idx_sender_id (sender_id),
    INDEX idx_recipient_id (recipient_id),
    INDEX idx_is_read (is_read),
    INDEX idx_created_at (created_at)
);

-- ==================================================
-- 10. FAVORITES - User wishlist/favorites
-- ==================================================
CREATE TABLE favorites (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    property_id INT NOT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    
    UNIQUE KEY unique_user_property (user_id, property_id),
    INDEX idx_user_id (user_id),
    INDEX idx_property_id (property_id)
);

-- ==================================================
-- 11. NOTIFICATIONS - System notifications
-- ==================================================
CREATE TABLE notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    
    -- Notification content
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type ENUM('booking', 'review', 'message', 'payment', 'system') NOT NULL,
    
    -- Related entities
    related_id INT, -- booking_id, message_id, etc.
    related_type VARCHAR(50), -- 'booking', 'message', etc.
    
    -- Status
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_type (type),
    INDEX idx_is_read (is_read),
    INDEX idx_created_at (created_at)
);

-- ==================================================
-- 12. BLOCKED DATES - Property availability management
-- ==================================================
CREATE TABLE blocked_dates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    property_id INT NOT NULL,
    
    blocked_date DATE NOT NULL,
    reason ENUM('booked', 'maintenance', 'personal', 'other') DEFAULT 'other',
    notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    
    UNIQUE KEY unique_property_date (property_id, blocked_date),
    INDEX idx_property_id (property_id),
    INDEX idx_blocked_date (blocked_date)
);

-- ==================================================
-- 13. PAYMENT HISTORY - Track payment status changes
-- ==================================================
CREATE TABLE payment_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    booking_id INT NOT NULL,
    previous_status ENUM('pending', 'paid', 'failed', 'refunded', 'partial') NOT NULL,
    new_status ENUM('pending', 'paid', 'failed', 'refunded', 'partial') NOT NULL,
    payment_method VARCHAR(50),
    payment_reference VARCHAR(100),
    updated_by INT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_payment_history_booking (booking_id),
    INDEX idx_payment_history_date (created_at)
);

-- ==================================================
-- 14. REFUNDS - Track refund processing
-- ==================================================
CREATE TABLE refunds (
    id INT PRIMARY KEY AUTO_INCREMENT,
    booking_id INT NOT NULL,
    refund_amount DECIMAL(10, 2) NOT NULL,
    refund_reason TEXT,
    refund_method VARCHAR(50) DEFAULT 'original_payment',
    refund_reference VARCHAR(100),
    processed_by INT NULL,
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_refunds_booking (booking_id),
    INDEX idx_refunds_date (processed_at)
);

-- ==================================================
-- INITIAL DATA - AMENITIES
-- ==================================================
INSERT INTO amenities (name, icon, category, description) VALUES
-- Basic amenities
('WiFi', 'wifi', 'basic', 'Wireless internet access'),
('Kitchen', 'kitchen', 'basic', 'Full kitchen with cooking facilities'),
('Air Conditioning', 'ac', 'basic', 'Climate control system'),
('Heating', 'heating', 'basic', 'Heating system'),
('TV', 'tv', 'basic', 'Television with cable/streaming'),
('Washer', 'washer', 'basic', 'Washing machine'),
('Dryer', 'dryer', 'basic', 'Clothes dryer'),
('Iron', 'iron', 'basic', 'Iron and ironing board'),
('Hair Dryer', 'hair-dryer', 'basic', 'Hair dryer provided'),

-- Safety amenities
('Smoke Detector', 'smoke-detector', 'safety', 'Smoke alarm system'),
('Carbon Monoxide Detector', 'co-detector', 'safety', 'CO detection system'),
('Fire Extinguisher', 'fire-extinguisher', 'safety', 'Fire safety equipment'),
('First Aid Kit', 'first-aid', 'safety', 'Basic medical supplies'),
('Security Cameras', 'security-camera', 'safety', 'Property security monitoring'),
('Safe', 'safe', 'safety', 'Secure storage for valuables'),

-- Luxury amenities
('Pool', 'pool', 'luxury', 'Swimming pool access'),
('Hot Tub', 'hot-tub', 'luxury', 'Hot tub or jacuzzi'),
('Gym', 'gym', 'luxury', 'Fitness equipment access'),
('Balcony', 'balcony', 'luxury', 'Private balcony or terrace'),
('Fireplace', 'fireplace', 'luxury', 'Indoor fireplace'),
('Piano', 'piano', 'luxury', 'Musical instrument available'),

-- Outdoor amenities
('BBQ Grill', 'bbq', 'outdoor', 'Outdoor grilling facilities'),
('Garden', 'garden', 'outdoor', 'Private garden access'),
('Patio', 'patio', 'outdoor', 'Outdoor seating area'),
('Beach Access', 'beach', 'outdoor', 'Direct beach access'),
('Parking', 'parking', 'outdoor', 'Parking space available'),

-- Family amenities
('Crib', 'crib', 'family', 'Baby crib available'),
('High Chair', 'high-chair', 'family', 'Child high chair'),
('Pack n Play', 'pack-play', 'family', 'Portable crib'),
('Board Games', 'games', 'family', 'Board games and entertainment'),
('Books', 'books', 'family', 'Reading materials available');

-- ==================================================
-- PERFORMANCE OPTIMIZATION VIEWS
-- ==================================================

-- View for property search with key metrics
CREATE VIEW property_search_view AS
SELECT 
    p.id,
    p.title,
    p.city,
    p.country,
    p.property_type,
    p.max_guests,
    p.bedrooms,
    p.bathrooms,
    p.price_per_night,
    p.average_rating,
    p.total_reviews,
    p.latitude,
    p.longitude,
    p.is_instant_book,
    u.first_name as host_name,
    u.host_rating,
    (SELECT image_url FROM property_images WHERE property_id = p.id AND is_primary = TRUE LIMIT 1) as primary_image
FROM properties p
JOIN users u ON p.host_id = u.id
WHERE p.status = 'active';

-- View for booking calendar
CREATE VIEW booking_calendar_view AS
SELECT 
    property_id,
    blocked_date as date,
    'blocked' as status,
    reason
FROM blocked_dates
UNION ALL
SELECT 
    property_id,
    check_in_date as date,
    'check_in' as status,
    CONCAT('Booking #', id) as reason
FROM bookings 
WHERE status IN ('confirmed', 'pending')
UNION ALL
SELECT 
    property_id,
    check_out_date as date,
    'check_out' as status,
    CONCAT('Booking #', id) as reason
FROM bookings 
WHERE status IN ('confirmed', 'pending');

-- ==================================================
-- DATABASE SETUP COMPLETE
-- ==================================================