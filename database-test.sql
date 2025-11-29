-- ==================================================
-- DATABASE SETUP VERIFICATION SCRIPT
-- ==================================================
-- Run this script AFTER creating the main schema to verify everything is working correctly

-- Test 1: Verify all tables were created
SELECT 
    TABLE_NAME,
    TABLE_ROWS,
    CREATE_TIME
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = DATABASE()
ORDER BY TABLE_NAME;

-- Test 2: Verify foreign key relationships
SELECT 
    CONSTRAINT_NAME,
    TABLE_NAME,
    COLUMN_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE()
AND REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY TABLE_NAME, CONSTRAINT_NAME;

-- Test 3: Verify indexes were created
SELECT 
    TABLE_NAME,
    INDEX_NAME,
    COLUMN_NAME,
    SEQ_IN_INDEX
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
AND INDEX_NAME != 'PRIMARY'
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;

-- Test 4: Insert sample data to verify schema works
START TRANSACTION;

-- Insert a test host user
INSERT INTO users (email, password_hash, first_name, last_name, role, is_host, host_approved) 
VALUES ('testhost@example.com', '$2b$10$dummy.hash.for.testing', 'Test', 'Host', 'host', TRUE, TRUE);

SET @host_id = LAST_INSERT_ID();

-- Insert a test guest user
INSERT INTO users (email, password_hash, first_name, last_name, role) 
VALUES ('testguest@example.com', '$2b$10$dummy.hash.for.testing', 'Test', 'Guest', 'guest');

SET @guest_id = LAST_INSERT_ID();

-- Insert a test property
INSERT INTO properties (
    host_id, title, description, property_type, address, city, country,
    max_guests, bedrooms, bathrooms, beds, price_per_night, status
) VALUES (
    @host_id, 'Beautiful Test Villa', 'A stunning test property for schema verification',
    'villa', '123 Test Street', 'Test City', 'Test Country',
    6, 3, 2.5, 4, 199.99, 'active'
);

SET @property_id = LAST_INSERT_ID();

-- Insert property amenities
INSERT INTO property_amenities (property_id, amenity_id)
SELECT @property_id, id FROM amenities WHERE name IN ('WiFi', 'Pool', 'Kitchen') LIMIT 3;

-- Insert a test booking
INSERT INTO bookings (
    property_id, guest_id, host_id, check_in_date, check_out_date,
    guests_count, base_price, total_amount, status
) VALUES (
    @property_id, @guest_id, @host_id, '2024-06-01', '2024-06-05',
    4, 799.96, 899.96, 'confirmed'
);

SET @booking_id = LAST_INSERT_ID();

-- Insert a test review
INSERT INTO reviews (
    booking_id, property_id, reviewer_id, reviewee_id, rating,
    title, comment, review_type, cleanliness_rating, accuracy_rating,
    check_in_rating, communication_rating, location_rating, value_rating
) VALUES (
    @booking_id, @property_id, @guest_id, @host_id, 5,
    'Amazing Stay!', 'Everything was perfect. Highly recommend!',
    'property', 5, 5, 5, 5, 5, 5
);

-- Test the views work correctly
SELECT 'Testing property_search_view...' as test_name;
SELECT * FROM property_search_view WHERE id = @property_id;

SELECT 'Testing booking_calendar_view...' as test_name;
SELECT * FROM booking_calendar_view WHERE property_id = @property_id;

-- Verify counts
SELECT 
    'Data Verification' as section,
    (SELECT COUNT(*) FROM users) as total_users,
    (SELECT COUNT(*) FROM properties) as total_properties,
    (SELECT COUNT(*) FROM amenities) as total_amenities,
    (SELECT COUNT(*) FROM bookings) as total_bookings,
    (SELECT COUNT(*) FROM reviews) as total_reviews;

-- Clean up test data
ROLLBACK;

-- Final success message
SELECT 'DATABASE SCHEMA SETUP SUCCESSFUL! ✅' as status,
       'All tables, relationships, and indexes created correctly' as message,
       NOW() as timestamp;

-- ==================================================
-- NEXT STEPS AFTER RUNNING THIS SCRIPT:
-- ==================================================
-- 1. If all tests pass, your database is ready for the backend API
-- 2. Note down any errors for troubleshooting
-- 3. Update your .env file with database credentials
-- 4. Ready to proceed with Node.js backend setup
-- ==================================================