-- Additional tables for Phase 8 - Booking System APIs
-- These tables support payment tracking, refunds, and audit trails

-- Payment History Table (tracks all payment status changes)
CREATE TABLE IF NOT EXISTS payment_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    previous_status ENUM('pending', 'paid', 'failed', 'refunded', 'partial') NOT NULL,
    new_status ENUM('pending', 'paid', 'failed', 'refunded', 'partial') NOT NULL,
    payment_method VARCHAR(50),
    payment_reference VARCHAR(100),
    updated_by INT NOT NULL, -- User ID who made the change
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_payment_history_booking (booking_id),
    INDEX idx_payment_history_date (created_at)
);

-- Refunds Table (tracks refund processing)
CREATE TABLE IF NOT EXISTS refunds (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    refund_amount DECIMAL(10, 2) NOT NULL,
    refund_reason TEXT,
    refund_method VARCHAR(50) DEFAULT 'original_payment',
    refund_reference VARCHAR(100),
    processed_by INT NOT NULL, -- Admin user who processed
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_refunds_booking (booking_id),
    INDEX idx_refunds_date (processed_at)
);

-- Add indexes to bookings table for performance
ALTER TABLE bookings 
ADD INDEX IF NOT EXISTS idx_bookings_property_dates (property_id, check_in_date, check_out_date),
ADD INDEX IF NOT EXISTS idx_bookings_guest_status (guest_id, status),
ADD INDEX IF NOT EXISTS idx_bookings_host_status (host_id, status),
ADD INDEX IF NOT EXISTS idx_bookings_payment_status (payment_status),
ADD INDEX IF NOT EXISTS idx_bookings_dates (check_in_date, check_out_date);

-- Add sample payment history data
INSERT IGNORE INTO payment_history (booking_id, previous_status, new_status, updated_by, notes) 
SELECT 
    id as booking_id,
    'pending' as previous_status,
    payment_status as new_status,
    guest_id as updated_by,
    'Initial payment status' as notes
FROM bookings 
WHERE payment_status != 'pending';

-- Verify table creation
SELECT 'Payment History table created' as Status, COUNT(*) as Records FROM payment_history;
SELECT 'Refunds table created' as Status, COUNT(*) as Records FROM refunds;

-- Show indexes on bookings table
SHOW INDEXES FROM bookings WHERE Key_name LIKE 'idx_bookings_%';
\n+-- =============================================================\n+-- Messaging Feature (Conversations & Messages) - Phase Extension\n+-- =============================================================\n+CREATE TABLE IF NOT EXISTS conversations (\n+    id INT AUTO_INCREMENT PRIMARY KEY,\n+    property_id INT NULL,\n+    booking_id INT NULL,\n+    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n+    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,\n+    CONSTRAINT fk_conversation_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL,\n+    CONSTRAINT fk_conversation_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL\n+) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n+\n+CREATE TABLE IF NOT EXISTS conversation_participants (\n+    conversation_id INT NOT NULL,\n+    user_id INT NOT NULL,\n+    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n+    PRIMARY KEY (conversation_id, user_id),\n+    CONSTRAINT fk_cp_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,\n+    CONSTRAINT fk_cp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE\n+) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n+\n+CREATE TABLE IF NOT EXISTS messages (\n+    id INT AUTO_INCREMENT PRIMARY KEY,\n+    conversation_id INT NOT NULL,\n+    sender_id INT NOT NULL,\n+    recipient_id INT NULL,\n+    message TEXT NOT NULL,\n+    is_read TINYINT(1) DEFAULT 0,\n+    read_at TIMESTAMP NULL,\n+    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n+    CONSTRAINT fk_message_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,\n+    CONSTRAINT fk_message_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,\n+    CONSTRAINT fk_message_recipient FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE SET NULL,\n+    INDEX idx_messages_conversation_created (conversation_id, created_at)\n+) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n+\n+CREATE OR REPLACE VIEW v_conversation_unread AS\n+SELECT m.conversation_id, m.recipient_id AS user_id, COUNT(*) AS unread_count\n+FROM messages m\n+WHERE m.is_read = 0 AND m.recipient_id IS NOT NULL\n+GROUP BY m.conversation_id, m.recipient_id;\n+