-- Migration: Replace taxes column with service_fee in bookings table
-- Date: 2025-10-01

-- Check if taxes column exists and service_fee doesn't
ALTER TABLE bookings
  CHANGE COLUMN taxes service_fee DECIMAL(10, 2) DEFAULT 0.00 COMMENT 'Service fee (10% of base price)';

-- Update comment for total_amount to reflect new calculation
ALTER TABLE bookings
  MODIFY COLUMN total_amount DECIMAL(10, 2) NOT NULL COMMENT 'Total = base_price + cleaning_fee + service_fee';
