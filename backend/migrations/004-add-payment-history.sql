-- Migration 004: Add Payment History and Refunds tables
-- This migration adds tables to track payment status changes and refund processing

-- Create payment_history table if it doesn't exist
CREATE TABLE IF NOT EXISTS payment_history (
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
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- Create refunds table if it doesn't exist
CREATE TABLE IF NOT EXISTS refunds (
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
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- Add indexes to bookings table for better performance (if not exists)
ALTER TABLE bookings 
ADD INDEX IF NOT EXISTS idx_bookings_property_dates (property_id, check_in_date, check_out_date),
ADD INDEX IF NOT EXISTS idx_bookings_guest_status (guest_id, status),
ADD INDEX IF NOT EXISTS idx_bookings_host_status (host_id, status),
ADD INDEX IF NOT EXISTS idx_bookings_payment_status (payment_status),
ADD INDEX IF NOT EXISTS idx_bookings_dates (check_in_date, check_out_date);

-- Verify table creation
SELECT 'Payment History table status' as Description, 
       CASE WHEN COUNT(*) > 0 THEN 'EXISTS' ELSE 'NOT FOUND' END as Status
FROM information_schema.tables 
WHERE table_schema = DATABASE() 
AND table_name = 'payment_history';

SELECT 'Refunds table status' as Description,
       CASE WHEN COUNT(*) > 0 THEN 'EXISTS' ELSE 'NOT FOUND' END as Status
FROM information_schema.tables 
WHERE table_schema = DATABASE() 
AND table_name = 'refunds';
